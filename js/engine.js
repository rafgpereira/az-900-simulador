/* AZ-900 Simulador — motor: montagem de sessões, correção e pontuação */
(function () {
  'use strict';
  const AZ = window.AZ, U = AZ.U, B = AZ.bank, S = AZ.store;
  const E = AZ.engine = {};

  E.TYPE_LABEL = { single: 'Múltipla escolha', multi: 'Múltipla seleção', yesno: 'Sim / Não', dd: 'Lista suspensa', match: 'Arrastar e soltar' };
  E.DIFF_LABEL = { 1: 'Fácil', 2: 'Média', 3: 'Difícil' };

  /* Tamanhos padronizados das sessões de treino */
  E.SIZES = { domain: 30, sub: 15, skill: 10, quick: 10, weak: 20, errors: 20 };

  /*
   * Probabilidade de um candidato "minimamente qualificado" acertar cada ponto,
   * por dificuldade (estimativa no estilo Angoff modificado). A média ponderada
   * dessas probabilidades sobre as questões sorteadas define a nota de corte
   * bruta do simulado — que é mapeada para 700 na escala de 1 a 1000.
   */
  E.P_MIN = { 1: 0.78, 2: 0.68, 3: 0.55 };

  /* ---------------- Correção ---------------- */
  E.maxPoints = q =>
    q.t === 'single' ? 1 : q.t === 'multi' ? q.a.length : q.t === 'yesno' ? q.st.length : q.t === 'dd' ? q.bl.length : q.it.length;

  /* Um ponto por componente correto (como no exame real); sem penalidade por erro. */
  function evaluate(q, r) {
    const m = E.maxPoints(q);
    let e = 0;
    if (r != null) {
      switch (q.t) {
        case 'single': e = r === q.a ? 1 : 0; break;
        case 'multi': {
          const sel = r || [];
          const hits = sel.filter(i => q.a.includes(i)).length;
          const extra = Math.max(0, sel.length - q.a.length);
          e = Math.max(0, hits - extra);
          break;
        }
        case 'yesno': e = q.st.reduce((s, st, i) => s + (r[i] === st[1] ? 1 : 0), 0); break;
        case 'dd': e = q.bl.reduce((s, b, i) => s + (r[i] === b.a ? 1 : 0), 0); break;
        case 'match': e = q.it.reduce((s, it, i) => s + (r[i] === it[1] ? 1 : 0), 0); break;
      }
    }
    return { e, m, ok: e === m };
  }
  E.evaluate = evaluate;

  /* 'none' | 'partial' | 'full' */
  E.answerState = (q, r) => {
    if (r == null) return 'none';
    if (q.t === 'single') return 'full';
    if (q.t === 'multi') return r.length === 0 ? 'none' : r.length >= q.a.length ? 'full' : 'partial';
    const n = r.filter(v => v != null).length;
    const total = q.t === 'yesno' ? q.st.length : q.t === 'dd' ? q.bl.length : q.it.length;
    return n === 0 ? 'none' : n === total ? 'full' : 'partial';
  };

  E.emptyResponse = q => {
    if (q.t === 'single') return null;
    if (q.t === 'multi') return [];
    const n = q.t === 'yesno' ? q.st.length : q.t === 'dd' ? q.bl.length : q.it.length;
    return new Array(n).fill(null);
  };

  E.makeItem = q => {
    const it = { qid: q.id, resp: null, marked: false, checked: false };
    if (q.o && !q.ns) it.perm = U.shuffle(q.o.map((_, i) => i));
    if (q.bl) it.bperm = q.bl.map(b => U.shuffle(b.o.map((_, i) => i)));
    return it;
  };

  /* ---------------- Estatísticas por questão ---------------- */
  E.qstats = () => S.get('qstats', {});

  /* Domínio de cada habilidade/subtópico/eixo a partir do histórico acumulado */
  E.mastery = () => {
    const qs = E.qstats();
    const agg = { skill: {}, sub: {}, domain: {}, total: { e: 0, m: 0, seen: 0, count: 0 } };
    const add = (map, key, q, st) => {
      const t = map[key] || (map[key] = { e: 0, m: 0, seen: 0, count: 0 });
      t.count++;
      if (st) { t.e += st.e; t.m += st.m; t.seen++; }
    };
    B.all.forEach(q => {
      const st = qs[q.id];
      add(agg.skill, q.skill, q, st);
      add(agg.sub, q.sub, q, st);
      add(agg.domain, q.domain, q, st);
      agg.total.count++;
      if (st) { agg.total.e += st.e; agg.total.m += st.m; agg.total.seen++; }
    });
    return agg;
  };

  /* ---------------- Seleção de questões ---------------- */
  /* chave de rotação: menos vista primeiro, com desempate aleatório */
  const seenKey = (q, qs) => (qs[q.id] ? qs[q.id].n : 0) + Math.random() * 0.98;

  /*
   * Seleciona n questões do conjunto, alternando entre as habilidades (round-robin)
   * para cobrir o máximo de conteúdos, e priorizando as questões menos vistas.
   */
  E.pickBalanced = (pool, n, qs, keyFn) => {
    keyFn = keyFn || seenKey;
    const groups = {};
    pool.forEach(q => (groups[q.skill] = groups[q.skill] || []).push({ q, k: keyFn(q, qs) }));
    const keys = Object.keys(groups);
    keys.forEach(k => groups[k].sort((a, b) => a.k - b.k));
    keys.sort((a, b) => groups[a][0].k - groups[b][0].k);
    const out = [];
    while (out.length < n) {
      let added = false;
      for (const k of keys) {
        if (out.length >= n) break;
        if (groups[k].length) { out.push(groups[k].shift().q); added = true; }
      }
      if (!added) break;
    }
    return out;
  };

  /* Distribuição proporcional (maiores restos), com desempate aleatório */
  E.allocate = (n, weights) => {
    const total = U.sum(weights) || 1;
    const raw = weights.map(w => (n * w) / total);
    const out = raw.map(Math.floor);
    let rest = n - U.sum(out);
    const order = raw.map((r, i) => ({ i, f: r - Math.floor(r) + Math.random() * 1e-6 })).sort((a, b) => b.f - a.f);
    for (let j = 0; rest > 0; j = (j + 1) % order.length, rest--) out[order[j].i]++;
    return out;
  };

  /* Quantidade de questões por eixo, respeitando as faixas percentuais do guia de estudo */
  E.domainCounts = n => {
    const ds = AZ.DOMAINS;
    const ranges = ds.map(d => [Math.ceil((d.weight[0] / 100) * n - 1e-9), Math.floor((d.weight[1] / 100) * n + 1e-9)]);
    const combos = [];
    for (let a = ranges[0][0]; a <= ranges[0][1]; a++)
      for (let b = ranges[1][0]; b <= ranges[1][1]; b++) {
        const c = n - a - b;
        if (c >= ranges[2][0] && c <= ranges[2][1]) combos.push([a, b, c]);
      }
    if (combos.length) return combos[Math.floor(Math.random() * combos.length)];
    return E.allocate(n, ds.map(d => (d.weight[0] + d.weight[1]) / 2));
  };

  /* Seleção estratificada: eixo -> subtópico (proporcional ao nº de conteúdos) -> habilidade */
  function stratified(n, qs) {
    const out = [];
    const counts = E.domainCounts(n);
    AZ.DOMAINS.forEach((d, i) => {
      const alloc = E.allocate(counts[i], d.subtopics.map(s => s.skills.length));
      d.subtopics.forEach((s, j) => out.push(...E.pickBalanced(B.bySub[s.id], alloc[j], qs)));
    });
    return out;
  }

  function weakSkills(limit) {
    const mt = E.mastery();
    return Object.values(AZ.skill)
      .map(k => {
        const t = mt.skill[k.id] || { e: 0, m: 0 };
        /* suavização de Laplace: habilidade nunca praticada conta como 50% */
        return { k, score: (t.e + 1) / (t.m + 2) + Math.random() * 0.01 };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, limit);
  }

  /* ---------------- Montagem de sessões ---------------- */
  /*
   * cfg: { kind: 'exam'|'domain'|'sub'|'skill'|'quick'|'weak'|'errors'|'retry',
   *        scope, count, minutes, mode: 'study'|'exam', timed, qids }
   */
  E.build = cfg => {
    const qs = E.qstats();
    let list = [];
    let title = '', subtitle = '';
    let mode = cfg.mode || 'study';
    let timeLimit = null;
    switch (cfg.kind) {
      case 'exam': {
        list = stratified(cfg.count, qs);
        title = 'Simulado AZ-900';
        subtitle = 'Microsoft Azure Fundamentals';
        mode = 'exam';
        timeLimit = cfg.minutes * 60;
        break;
      }
      case 'domain': {
        const d = AZ.dom[cfg.scope];
        const alloc = E.allocate(E.SIZES.domain, d.subtopics.map(s => s.skills.length));
        d.subtopics.forEach((s, j) => list.push(...E.pickBalanced(B.bySub[s.id], alloc[j], qs)));
        title = `Eixo ${d.id} · ${d.short}`;
        subtitle = d.name;
        break;
      }
      case 'sub': {
        const s = AZ.sub[cfg.scope];
        list = E.pickBalanced(B.bySub[s.id], E.SIZES.sub, qs);
        title = `Subtópico ${s.id}`;
        subtitle = s.name;
        break;
      }
      case 'skill': {
        const k = AZ.skill[cfg.scope];
        list = E.pickBalanced(B.bySkill[k.id], E.SIZES.skill, qs);
        title = `Conteúdo ${k.id}`;
        subtitle = k.name;
        break;
      }
      case 'quick': {
        list = stratified(E.SIZES.quick, qs);
        title = 'Treino rápido';
        subtitle = 'Questões mistas dos três eixos';
        break;
      }
      case 'weak': {
        const weak = weakSkills(8);
        const alloc = E.allocate(E.SIZES.weak, weak.map(w => 1.2 - w.score));
        const key = (q, st) => {
          const s = st[q.id];
          return (s && s.lr === 0 ? -2 : 0) + (s ? s.n : 0) + Math.random() * 0.98;
        };
        weak.forEach((w, i) => list.push(...E.pickBalanced(B.bySkill[w.k.id], alloc[i], qs, key)));
        title = 'Pontos fracos';
        subtitle = 'Conteúdos com menor aproveitamento';
        break;
      }
      case 'errors': {
        list = B.all
          .filter(q => qs[q.id] && qs[q.id].lr === 0)
          .sort((a, b) => qs[b.id].last - qs[a.id].last)
          .slice(0, E.SIZES.errors);
        title = 'Revisar erros';
        subtitle = 'Questões que você errou na última tentativa';
        break;
      }
      case 'retry': {
        list = (cfg.qids || []).map(id => B.byId[id]).filter(Boolean);
        title = 'Refazer questões';
        subtitle = cfg.subtitle || 'Questões selecionadas';
        break;
      }
    }
    if (!list.length) return null;
    list = U.shuffle(list);
    if (cfg.timed && !timeLimit) timeLimit = list.length * 60;
    return {
      id: U.uid(),
      kind: cfg.kind,
      scope: cfg.scope || null,
      title,
      subtitle,
      mode,
      timeLimit,
      elapsed: 0,
      createdAt: Date.now(),
      cur: 0,
      items: list.map(E.makeItem)
    };
  };

  /* ---------------- Pontuação ---------------- */
  E.scaled = (raw, cut) => {
    if (raw <= cut) return Math.max(1, Math.round(1 + (699 * raw) / cut));
    return Math.min(1000, Math.round(700 + (300 * (raw - cut)) / (1 - cut)));
  };

  E.score = items => {
    let e = 0, m = 0, cutNum = 0, full = 0, answered = 0;
    const by = { domain: {}, sub: {}, skill: {} };
    const add = (map, key, it) => {
      const t = map[key] || (map[key] = { e: 0, m: 0, n: 0, ok: 0 });
      t.e += it.e; t.m += it.m; t.n++;
      if (it.e === it.m) t.ok++;
    };
    items.forEach(it => {
      const q = B.byId[it.qid];
      if (!q) return;
      e += it.e; m += it.m;
      cutNum += it.m * E.P_MIN[q.d];
      if (it.e === it.m) full++;
      if (it.answered) answered++;
      add(by.domain, q.domain, it);
      add(by.sub, q.sub, it);
      add(by.skill, q.skill, it);
    });
    const raw = m ? e / m : 0;
    const cut = m ? cutNum / m : 0.68;
    const scaled = E.scaled(raw, cut);
    return { e, m, raw, cut, scaled, passed: scaled >= AZ.EXAM.passing, pct: Math.round(raw * 100), full, answered, total: items.length, by };
  };

  /* Encerra a sessão: corrige, grava histórico e atualiza estatísticas por questão */
  E.finish = session => {
    const items = session.items
      .filter(it => B.byId[it.qid])
      .map(it => {
        const q = B.byId[it.qid];
        const r = evaluate(q, it.resp);
        return {
          qid: it.qid, perm: it.perm, bperm: it.bperm, resp: it.resp, marked: it.marked,
          e: r.e, m: r.m, answered: E.answerState(q, it.resp) !== 'none'
        };
      });
    const res = E.score(items);
    const rec = {
      id: session.id, kind: session.kind, scope: session.scope, title: session.title, subtitle: session.subtitle,
      mode: session.mode, timeLimit: session.timeLimit, duration: Math.round(session.elapsed),
      startedAt: session.createdAt, finishedAt: Date.now(), items, res
    };

    const qs = E.qstats();
    items.forEach(it => {
      /* em treinos, questões não respondidas não entram nas estatísticas */
      if (!it.answered && session.kind !== 'exam') return;
      const s = qs[it.qid] || (qs[it.qid] = { n: 0, c: 0, e: 0, m: 0 });
      s.n++;
      s.e += it.e;
      s.m += it.m;
      s.lr = it.e === it.m ? 1 : 0;
      if (s.lr) s.c++;
      s.last = rec.finishedAt;
    });
    S.set('qstats', qs);

    const hist = S.get('history', []);
    hist.push(rec);
    while (hist.length > 300) hist.shift();
    if (!S.set('history', hist)) {
      /* armazenamento cheio: descarta os registros mais antigos e tenta de novo */
      S.set('history', hist.slice(-100));
    }
    return rec;
  };

  E.history = () => S.get('history', []);
})();
