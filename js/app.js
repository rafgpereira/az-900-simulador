/* AZ-900 Simulador — aplicação (telas, navegação, sessão em andamento) */
(function () {
  'use strict';
  const AZ = window.AZ, U = AZ.U, E = AZ.engine, B = AZ.bank, S = AZ.store, R = AZ.render;
  const esc = U.esc;
  const $app = document.getElementById('app');

  /* ---------------- Configurações ---------------- */
  const DEFAULTS = { examCount: 45, examMinutes: 45, trainMode: 'study', trainTimed: false, theme: 'auto' };
  const settings = () => Object.assign({}, DEFAULTS, S.get('settings', {}));
  const saveSettings = patch => S.set('settings', Object.assign(settings(), patch));

  const st = {
    session: null, timer: null, resumeAt: null, ticks: 0, warned5: false,
    chip: null, reviewOpen: false, modal: null,
    resFilter: null, bank: { sub: '', skill: '', type: '', text: '', page: 0 }
  };

  /* ---------------- Tema ---------------- */
  function applyTheme() {
    const t = settings().theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }
  function isDark() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /* ---------------- Modal e avisos ---------------- */
  function modal({ title, body, actions, wide }) {
    closeModal();
    const el = document.createElement('div');
    el.className = 'modal-backdrop';
    el.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="mtitle">
      <h3 id="mtitle">${title}</h3><div class="modal-body">${body}</div>
      <div class="modal-actions">${actions.map((a, i) => `<button type="button" class="btn ${a.cls || ''}" data-mi="${i}">${a.label}</button>`).join('')}</div></div>`;
    el.addEventListener('click', e => {
      if (e.target === el) { closeModal(); return; }
      const b = e.target.closest('[data-mi]');
      if (!b) return;
      const a = actions[+b.dataset.mi];
      const keep = a.run ? a.run(el) === false : false;
      if (!keep) closeModal();
    });
    document.body.appendChild(el);
    st.modal = el;
    const focus = el.querySelector('.btn.primary') || el.querySelector('.btn');
    if (focus) focus.focus();
    return el;
  }
  function closeModal() {
    if (st.modal) { st.modal.remove(); st.modal = null; }
  }
  function toast(msg, kind) {
    let box = document.getElementById('toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toasts';
      box.setAttribute('role', 'status');
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3700);
  }

  /* ---------------- Componentes visuais ---------------- */
  const level = p => (p == null ? 'none' : p >= 80 ? 'ok' : p >= 65 ? 'warn' : 'bad');
  function bar(e, m, opts) {
    opts = opts || {};
    const p = m ? U.pct(e, m) : null;
    const label = p == null ? '—' : p + '%';
    const lv = opts.info ? 'info' : level(p);
    return `<div class="bar-wrap${opts.compact ? ' compact' : ''}"><div class="bar"><span class="fill ${lv}" style="width:${p || 0}%"></span>${opts.mark ? `<i class="bar-mark" style="left:${opts.mark}%"></i>` : ''}</div><span class="bar-val ${lv}">${label}</span></div>`;
  }
  function gauge(score, passed) {
    const r = 54, c = 2 * Math.PI * r;
    const frac = Math.max(0, Math.min(1, score / 1000));
    const passAngle = (700 / 1000) * 360 - 90;
    const px = 64 + r * Math.cos((passAngle * Math.PI) / 180), py = 64 + r * Math.sin((passAngle * Math.PI) / 180);
    return `<svg class="gauge" viewBox="0 0 128 128" role="img" aria-label="Pontuação ${score} de 1000">
      <circle cx="64" cy="64" r="${r}" class="g-track"/>
      <circle cx="64" cy="64" r="${r}" class="g-fill ${passed ? 'ok' : 'bad'}" stroke-dasharray="${c * frac} ${c}" transform="rotate(-90 64 64)"/>
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" class="g-pass"><title>700: nota mínima</title></circle>
      <text x="64" y="62" class="g-num">${score}</text><text x="64" y="82" class="g-sub">de 1000</text></svg>`;
  }
  function ring(pct) {
    const r = 54, c = 2 * Math.PI * r;
    return `<svg class="gauge" viewBox="0 0 128 128" role="img" aria-label="${pct}% de aproveitamento">
      <circle cx="64" cy="64" r="${r}" class="g-track"/>
      <circle cx="64" cy="64" r="${r}" class="g-fill ${level(pct)}" stroke-dasharray="${(c * pct) / 100} ${c}" transform="rotate(-90 64 64)"/>
      <text x="64" y="70" class="g-num">${pct}%</text></svg>`;
  }
  const domClass = id => 'd' + id;

  /* ---------------- Roteamento ---------------- */
  const ROUTES = {
    '': viewHome, sessao: viewSession, resultado: viewResult, progresso: viewProgress,
    historico: viewHistory, banco: viewBank, config: viewSettings
  };
  function route() {
    leaveSession();
    closeModal();
    const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
    const key = ROUTES[name] ? name : '';
    document.body.classList.toggle('in-session', key === 'sessao');
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.route === key));
    ROUTES[key](arg ? decodeURIComponent(arg) : undefined);
    if (key !== 'sessao') window.scrollTo(0, 0);
  }
  const go = hash => {
    if (location.hash === hash) route();
    else location.hash = hash;
  };

  /* =====================================================================
   * INÍCIO
   * ===================================================================== */
  function viewHome() {
    const set = settings();
    const hist = E.history();
    const exams = hist.filter(h => h.kind === 'exam');
    const last = exams[exams.length - 1];
    const best = exams.length ? Math.max(...exams.map(h => h.res.scaled)) : null;
    const last3 = exams.slice(-3);
    const avg3 = last3.length ? Math.round(U.sum(last3.map(h => h.res.scaled)) / last3.length) : null;
    const mt = E.mastery();
    const qs = E.qstats();
    const errCount = B.all.filter(q => qs[q.id] && qs[q.id].lr === 0).length;
    const active = S.get('active', null);
    const totalSeen = mt.total.seen;

    const resume = active
      ? `<div class="resume card">
          <div><b>Sessão em andamento:</b> ${esc(active.title)} — ${esc(active.subtitle || '')}
          <span class="muted">(${active.items.filter(i => E.answerState(B.byId[i.qid] || { t: 'single' }, i.resp) !== 'none').length}/${active.items.length} respondidas)</span></div>
          <div class="resume-actions"><button class="btn primary sm" data-act="resume">Continuar</button><button class="btn sm ghost" data-act="discard">Descartar</button></div>
        </div>`
      : '';

    const countLabel = set.examCount === 'random' ? '40–60' : set.examCount;
    const readiness = avg3 == null ? '' : avg3 >= 800 ? '<span class="pill ok">Pronto para a prova</span>' : avg3 >= 700 ? '<span class="pill warn">Quase lá</span>' : '<span class="pill bad">Continue praticando</span>';

    const domains = AZ.DOMAINS.map(d => {
      const dm = mt.domain[d.id] || { e: 0, m: 0, seen: 0, count: 0 };
      const subs = d.subtopics.map(s => {
        const sm = mt.sub[s.id] || { e: 0, m: 0, seen: 0, count: 0 };
        const skills = s.skillList.map(k => {
          const km = mt.skill[k.id] || { e: 0, m: 0, seen: 0, count: 0 };
          return `<li class="skill-row"><span class="skill-name"><span class="sid">${k.id}</span>${esc(k.name)}</span>
            <span class="skill-meta">${bar(km.e, km.m, { compact: true })}<span class="muted small">${km.seen}/${km.count}</span></span>
            <button class="btn xs ghost" data-act="start" data-kind="skill" data-scope="${k.id}" title="Praticar este conteúdo (${E.SIZES.skill} questões)">Praticar</button></li>`;
        }).join('');
        return `<li class="sub">
          <div class="sub-line">
            <div class="sub-name"><span class="sid">${s.id}</span>${esc(s.name)}</div>
            <div class="sub-meta">${bar(sm.e, sm.m, { compact: true })}<span class="muted small" title="Questões vistas / total no banco">${sm.seen}/${sm.count}</span></div>
            <div class="sub-actions">
              <button class="btn sm" data-act="start" data-kind="sub" data-scope="${s.id}">Praticar · ${E.SIZES.sub}</button>
              <button class="btn sm ghost icon-btn" data-act="toggle" data-target="sk-${s.id.replace('.', '-')}" aria-expanded="false" title="Ver conteúdos do subtópico">Conteúdos <span class="chev">▾</span></button>
            </div>
          </div>
          <ul class="skills" id="sk-${s.id.replace('.', '-')}" hidden>${skills}</ul>
        </li>`;
      }).join('');
      return `<article class="domain-card ${domClass(d.id)}">
        <header class="dc-head">
          <div><span class="d-badge">Eixo ${d.id}</span><span class="weight">${d.weight[0]}–${d.weight[1]}% do exame</span></div>
          <h3>${esc(d.name)}</h3>
          <div class="dc-meta">${bar(dm.e, dm.m)}<span class="muted small">${dm.seen} de ${dm.count} questões já vistas</span></div>
          <button class="btn primary-soft" data-act="start" data-kind="domain" data-scope="${d.id}">Praticar eixo completo · ${E.SIZES.domain} questões</button>
        </header>
        <ul class="subs">${subs}</ul>
      </article>`;
    }).join('');

    const types = {};
    B.all.forEach(q => (types[q.t] = (types[q.t] || 0) + 1));

    $app.innerHTML = `<div class="page">
      ${resume}
      <section class="hero">
        <div class="hero-card">
          <div class="eyebrow">Simulado oficial · habilidades medidas a partir de ${AZ.EXAM.skillsDate}</div>
          <h1>Exame AZ-900<span class="h1-sub">Microsoft Azure Fundamentals</span></h1>
          <p class="lead">Questões sorteadas na proporção do guia de estudo oficial (25–30% · 35–40% · 30–35%), com cronômetro, tela de revisão e pontuação escalonada de 1 a 1000.</p>
          <ul class="facts">
            <li><b>${countLabel}</b><span>questões</span></li>
            <li><b>${set.examMinutes}</b><span>minutos</span></li>
            <li><b>700</b><span>para aprovação</span></li>
          </ul>
          <div class="hero-actions">
            <button class="btn primary lg" data-act="start-exam">Iniciar simulado</button>
            <a class="btn ghost-inv" href="#/config">Ajustar formato</a>
          </div>
        </div>
        <div class="hero-side card">
          <div class="hs-title">Seu desempenho nos simulados ${readiness}</div>
          ${exams.length ? `<div class="hs-grid">
              <div><span class="muted small">Última nota</span><b class="${last.res.passed ? 'c-ok' : 'c-bad'}">${last.res.scaled}</b></div>
              <div><span class="muted small">Melhor nota</span><b>${best}</b></div>
              <div><span class="muted small">Média (3 últimos)</span><b>${avg3}</b></div>
              <div><span class="muted small">Simulados feitos</span><b>${exams.length}</b></div>
            </div>
            <a class="link" href="#/progresso">Ver evolução e mapa de conteúdos →</a>`
            : `<p class="muted small">Você ainda não fez nenhum simulado. Sugestão de rotina de estudo:</p>
              <ol class="steps">
                <li><b>Treine cada subtópico</b> no modo estudo, lendo as explicações.</li>
                <li><b>Faça um simulado</b> para medir sua nota e ver o mapa de conteúdos.</li>
                <li><b>Ataque os pontos fracos</b> e revise os erros.</li>
                <li>Repita até tirar <b>800 ou mais</b> com consistência.</li>
              </ol>`}
          <div class="hs-cover"><span class="muted small">Cobertura do banco</span>${bar(totalSeen, mt.total.count, { info: true })}<span class="muted small">${totalSeen} de ${mt.total.count} questões já vistas</span></div>
        </div>
      </section>

      <section class="quick-grid">
        <button class="quick card" data-act="start" data-kind="quick">
          <span class="q-ico">⚡</span><b>Treino rápido</b><span class="muted">${E.SIZES.quick} questões mistas, proporcionais aos três eixos</span></button>
        <button class="quick card" data-act="start" data-kind="weak">
          <span class="q-ico">🎯</span><b>Pontos fracos</b><span class="muted">${E.SIZES.weak} questões dos conteúdos com menor aproveitamento</span></button>
        <button class="quick card" data-act="start" data-kind="errors" ${errCount ? '' : 'disabled'}>
          <span class="q-ico">↺</span><b>Revisar erros</b><span class="muted">${errCount ? `${errCount} questões erradas na última tentativa (até ${E.SIZES.errors} por sessão)` : 'Nenhum erro pendente'}</span></button>
      </section>

      <section>
        <div class="section-head">
          <h2>Treinar por eixo, subtópico ou conteúdo</h2>
          <p class="muted">Sessões padronizadas: eixo completo com ${E.SIZES.domain} questões, subtópico com ${E.SIZES.sub} e conteúdo específico com ${E.SIZES.skill}. As questões menos vistas têm prioridade, para você rodar todo o banco antes de repetir.</p>
        </div>
        <div class="domains">${domains}</div>
      </section>

      <section class="card bank-strip">
        <div><b>${B.all.length}</b> questões no banco · ${Object.keys(types).map(t => `${types[t]} ${E.TYPE_LABEL[t].toLowerCase()}`).join(' · ')}</div>
        <a class="link" href="#/banco">Explorar o banco de questões →</a>
      </section>
    </div>`;
  }

  /* ---------------- Início de sessões ---------------- */
  function startExamDialog() {
    const set = settings();
    const active = S.get('active', null);
    const count = set.examCount === 'random' ? 40 + Math.floor(Math.random() * 21) : +set.examCount;
    modal({
      title: 'Simulado oficial AZ-900',
      body: `<ul class="rules">
          <li><b>${set.examCount === 'random' ? '40 a 60 questões (quantidade sorteada)' : count + ' questões'}</b> distribuídas como no guia de estudo: conceitos de nuvem (25–30%), arquitetura e serviços (35–40%), gerenciamento e governança (30–35%).</li>
          <li><b>${set.examMinutes} minutos.</b> O exame é encerrado automaticamente quando o tempo acaba.</li>
          <li>Tipos de questão do exame real: múltipla escolha, múltipla seleção, Sim/Não, lista suspensa e arrastar e soltar.</li>
          <li>Questões com várias partes valem um ponto por parte correta. Não há penalidade por erro: responda todas.</li>
          <li>Você pode marcar questões para revisão e voltar a qualquer uma antes de encerrar. A correção aparece só no final.</li>
          <li>A nota vai de 1 a 1000, e a aprovação exige <b>700</b>. Como no exame real, 700 não equivale necessariamente a 70% de acerto.</li>
        </ul>
        ${active ? '<p class="warn-box">Há uma sessão em andamento. Ao iniciar o simulado, ela será descartada.</p>' : ''}`,
      actions: [
        { label: 'Cancelar' },
        { label: 'Iniciar simulado', cls: 'primary', run: () => begin({ kind: 'exam', count, minutes: +set.examMinutes }) }
      ]
    });
  }

  function startTrainDialog(kind, scope) {
    const set = settings();
    const active = S.get('active', null);
    let title = '', desc = '';
    if (kind === 'domain') { const d = AZ.dom[scope]; title = `Eixo ${d.id} · ${d.short}`; desc = `${E.SIZES.domain} questões distribuídas entre os ${d.subtopics.length} subtópicos do eixo, proporcionalmente ao número de conteúdos de cada um.`; }
    if (kind === 'sub') { const s = AZ.sub[scope]; title = `${s.id} · ${s.name}`; desc = `${E.SIZES.sub} questões cobrindo os ${s.skills.length} conteúdos do subtópico, alternando entre eles.`; }
    if (kind === 'skill') { const k = AZ.skill[scope]; title = `${k.id} · ${k.name}`; desc = `Até ${E.SIZES.skill} questões deste conteúdo específico (${B.bySkill[k.id].length} no banco).`; }
    if (kind === 'quick') { title = 'Treino rápido'; desc = `${E.SIZES.quick} questões mistas, na proporção dos três eixos do exame.`; }
    if (kind === 'weak') { title = 'Pontos fracos'; desc = `${E.SIZES.weak} questões dos conteúdos com menor aproveitamento no seu histórico (conteúdos ainda não praticados contam como 50%), priorizando as que você errou.`; }
    if (kind === 'errors') { title = 'Revisar erros'; desc = `Até ${E.SIZES.errors} questões que você errou (ou acertou parcialmente) na última vez em que as respondeu. Ao acertá-las, elas saem desta lista.`; }
    modal({
      title,
      body: `<p>${desc}</p>
        <div class="field"><span class="field-label">Modo</span>
          <label class="radio-card"><input type="radio" name="mode" value="study" ${set.trainMode === 'study' ? 'checked' : ''}><span><b>Estudo</b><small>Verifique cada resposta e veja a explicação na hora.</small></span></label>
          <label class="radio-card"><input type="radio" name="mode" value="exam" ${set.trainMode === 'exam' ? 'checked' : ''}><span><b>Prova</b><small>Correção e explicações apenas ao final.</small></span></label>
        </div>
        <label class="check"><input type="checkbox" name="timed" ${set.trainTimed ? 'checked' : ''}> Cronômetro de 1 minuto por questão (ritmo do exame)</label>
        ${active ? '<p class="warn-box">Há uma sessão em andamento. Ao iniciar esta, ela será descartada.</p>' : ''}`,
      actions: [
        { label: 'Cancelar' },
        {
          label: 'Começar', cls: 'primary',
          run: el => {
            const mode = el.querySelector('input[name="mode"]:checked').value;
            const timed = el.querySelector('input[name="timed"]').checked;
            saveSettings({ trainMode: mode, trainTimed: timed });
            return begin({ kind, scope, mode, timed });
          }
        }
      ]
    });
  }

  function begin(cfg) {
    const s = E.build(cfg);
    if (!s) { toast('Não há questões disponíveis para esta sessão.', 'bad'); return false; }
    st.session = s;
    st.warned5 = false;
    S.set('active', s);
    closeModal();
    go('#/sessao');
    return true;
  }

  /* =====================================================================
   * SESSÃO (simulado ou treino)
   * ===================================================================== */
  const cur = () => st.session.items[st.session.cur];
  const curQ = () => B.byId[cur().qid];
  const isLocked = () => st.session.mode === 'study' && cur().checked;

  function viewSession() {
    if (!st.session) st.session = S.get('active', null);
    const s = st.session;
    if (!s) { go('#/'); return; }
    s.items = s.items.filter(it => B.byId[it.qid]);
    if (!s.items.length) { S.del('active'); st.session = null; go('#/'); return; }
    if (s.cur >= s.items.length) s.cur = 0;
    st.reviewOpen = false;
    st.chip = null;
    renderSession(true);
    startTimer();
  }

  function renderSession(scrollTop) {
    const s = st.session, n = s.items.length, it = cur(), q = curQ();
    const study = s.mode === 'study';
    const locked = isLocked();
    const ans = E.answerState(q, it.resp);
    const answered = s.items.filter(x => E.answerState(B.byId[x.qid], x.resp) !== 'none').length;
    const pts = E.maxPoints(q);
    const isLast = s.cur === n - 1;
    const k = AZ.skill[q.skill];
    const meta = study ? `<span class="tag subtle" title="${esc(k.name)}">${q.skill} · ${esc(k.name)}</span><span class="tag subtle">${E.DIFF_LABEL[q.d]}</span>` : '';
    const nextBtn = isLast
      ? `<button class="btn primary" data-act="review">Revisar e encerrar</button>`
      : `<button class="btn ${study && !it.checked ? '' : 'primary'}" data-act="next">Próxima <span aria-hidden="true">▶</span></button>`;

    $app.innerHTML = `<div class="exam ${study ? 'study' : 'test'}">
      <header class="xbar">
        <div class="xbar-l"><span class="xlogo">AZ-900</span><div class="xtitles"><b>${esc(s.title)}</b><span>${esc(s.subtitle || '')} · ${study ? 'modo estudo' : 'modo prova'}</span></div></div>
        <div class="xbar-r">
          <span class="xcount">Questão <b>${s.cur + 1}</b> de ${n}</span>
          <span class="xtimer" id="xtimer"></span>
          <button class="btn sm ghost-inv" data-act="review">Revisar</button>
          <button class="btn sm ghost-inv" data-act="quit">Sair</button>
        </div>
      </header>
      <div class="xprogress" title="${answered} de ${n} respondidas"><span style="width:${(answered / n) * 100}%"></span></div>
      <main class="xmain">
        <article class="qcard" id="qcard">
          <div class="q-top"><span class="q-num">Questão ${s.cur + 1}</span><span class="tag">${E.TYPE_LABEL[q.t]}</span>${pts > 1 ? `<span class="tag subtle">${pts} pontos</span>` : ''}${meta}${it.marked ? '<span class="tag flagged">⚑ Marcada</span>' : ''}</div>
          <div class="q-body">${R.question(q, it, { locked, chip: st.chip })}</div>
          ${locked ? R.feedback(q, it) : ''}
        </article>
        <p class="kbd-hint">Atalhos: <kbd>1</kbd>–<kbd>6</kbd> escolhe a opção · <kbd>←</kbd> <kbd>→</kbd> navega · <kbd>M</kbd> marca · <kbd>Enter</kbd> ${study ? 'verifica / avança' : 'avança'}</p>
      </main>
      <footer class="xfoot"><div class="xfoot-inner">
        <button class="btn" data-act="prev" ${s.cur === 0 ? 'disabled' : ''}><span aria-hidden="true">◀</span> Anterior</button>
        <button class="btn flag${it.marked ? ' on' : ''}" data-act="mark" aria-pressed="${it.marked}">⚑<span class="hide-sm"> ${it.marked ? 'Desmarcar' : 'Marcar para revisão'}</span></button>
        <span class="spacer"></span>
        ${study && !it.checked ? `<button class="btn ${ans === 'full' ? 'primary' : ''}" data-act="check" ${ans === 'none' ? 'disabled' : ''}>Verificar<span class="hide-sm"> resposta</span></button>` : ''}
        ${nextBtn}
      </div></footer>
      ${st.reviewOpen ? reviewOverlay() : ''}
    </div>`;
    updateTimer();
    if (scrollTop) window.scrollTo(0, 0);
  }

  function reviewOverlay() {
    const s = st.session;
    let done = 0, part = 0, none = 0, marked = 0;
    const cells = s.items.map((it, i) => {
      const q = B.byId[it.qid];
      const a = E.answerState(q, it.resp);
      let cls = a === 'full' ? 'done' : a === 'partial' ? 'part' : 'none';
      if (a === 'full') done++; else if (a === 'partial') part++; else none++;
      if (it.marked) { marked++; cls += ' marked'; }
      if (s.mode === 'study' && it.checked) {
        const r = E.evaluate(q, it.resp);
        cls += r.ok ? ' right' : r.e > 0 ? ' half' : ' wrong';
      }
      if (i === s.cur) cls += ' current';
      return `<button class="cell ${cls}" data-act="goto" data-i="${i}" title="Questão ${i + 1}">${i + 1}${it.marked ? '<i aria-hidden="true">⚑</i>' : ''}</button>`;
    }).join('');
    return `<div class="overlay" data-act="close-review-bg">
      <div class="review-panel" role="dialog" aria-modal="true" aria-label="Tela de revisão">
        <div class="rp-head"><h3>Tela de revisão</h3><button class="btn sm ghost" data-act="close-review" aria-label="Fechar">✕</button></div>
        <p class="muted small">Clique em um número para ir até a questão. Você pode alterar qualquer resposta antes de encerrar.</p>
        <div class="legend">
          <span><i class="sw done"></i>Respondidas: <b>${done}</b></span>
          <span><i class="sw part"></i>Incompletas: <b>${part}</b></span>
          <span><i class="sw none"></i>Não respondidas: <b>${none}</b></span>
          <span><i class="sw marked"></i>Marcadas: <b>${marked}</b></span>
          ${s.mode === 'study' ? '<span><i class="sw right"></i>Verificadas: certa</span><span><i class="sw half"></i>parcial</span><span><i class="sw wrong"></i>errada</span>' : ''}
        </div>
        <div class="grid">${cells}</div>
        <div class="rp-actions">
          <button class="btn sm" data-act="goto-next" data-what="marked" ${marked ? '' : 'disabled'}>Próxima marcada</button>
          <button class="btn sm" data-act="goto-next" data-what="open" ${none + part ? '' : 'disabled'}>Próxima sem resposta</button>
          <span class="spacer"></span>
          <button class="btn primary" data-act="finish">Encerrar ${s.kind === 'exam' ? 'o exame' : 'a sessão'}</button>
        </div>
      </div>
    </div>`;
  }

  /* ---------------- Cronômetro ---------------- */
  function elapsedNow() {
    const s = st.session;
    return s.elapsed + (st.resumeAt ? (Date.now() - st.resumeAt) / 1000 : 0);
  }
  function fold() {
    if (st.session && st.resumeAt) {
      st.session.elapsed = elapsedNow();
      st.resumeAt = Date.now();
    }
  }
  function persist() {
    if (!st.session) return;
    fold();
    S.set('active', st.session);
  }
  function startTimer() {
    stopTimer();
    st.resumeAt = Date.now();
    st.timer = setInterval(tick, 500);
  }
  function stopTimer() {
    if (st.timer) clearInterval(st.timer);
    st.timer = null;
  }
  function leaveSession() {
    if (st.session && st.timer) persist();
    stopTimer();
    st.resumeAt = null;
  }
  function updateTimer() {
    const el = document.getElementById('xtimer');
    if (!el || !st.session) return;
    const s = st.session, e = elapsedNow();
    if (s.timeLimit) {
      const left = s.timeLimit - e;
      el.className = 'xtimer' + (left <= 60 ? ' crit' : left <= 300 ? ' warn' : '');
      el.textContent = '⏱ ' + U.clock(left);
      el.title = 'Tempo restante';
    } else {
      el.className = 'xtimer';
      el.textContent = '⏱ ' + U.clock(e);
      el.title = 'Tempo decorrido';
    }
  }
  function tick() {
    const s = st.session;
    if (!s) return;
    updateTimer();
    if (s.timeLimit) {
      const left = s.timeLimit - elapsedNow();
      if (left <= 300 && !st.warned5 && s.timeLimit > 600) { st.warned5 = true; toast('Restam 5 minutos.', 'warn'); }
      if (left <= 0) { finishSession(true); return; }
    }
    if (++st.ticks % 10 === 0) persist();
  }

  /* ---------------- Interação com a questão ---------------- */
  function changed() {
    persist();
    renderSession();
  }
  function goTo(i) {
    const s = st.session;
    if (i < 0 || i >= s.items.length) return;
    s.cur = i;
    st.chip = null;
    st.reviewOpen = false;
    persist();
    renderSession(true);
  }
  function placeChip(slot, c) {
    if (isLocked()) return;
    const it = cur(), q = curQ();
    const r = it.resp || E.emptyResponse(q);
    r[slot] = c;
    it.resp = r;
    st.chip = null;
    changed();
  }

  function confirmFinish() {
    const s = st.session;
    const open = s.items.filter(it => E.answerState(B.byId[it.qid], it.resp) !== 'full').length;
    const marked = s.items.filter(it => it.marked).length;
    modal({
      title: s.kind === 'exam' ? 'Encerrar o exame?' : 'Encerrar a sessão?',
      body: `${open ? `<p>Você tem <b>${open}</b> questão(ões) sem resposta completa. Partes não respondidas valem zero.</p>` : '<p>Todas as questões foram respondidas.</p>'}
        ${marked ? `<p>${marked} questão(ões) continuam marcadas para revisão.</p>` : ''}
        <p class="muted">Depois de encerrar, não é possível alterar as respostas.</p>`,
      actions: [{ label: 'Voltar' }, { label: 'Encerrar e ver resultado', cls: 'primary', run: () => finishSession(false) }]
    });
  }

  function finishSession(timeout) {
    if (!st.session) return;
    fold();
    stopTimer();
    st.resumeAt = null;
    if (timeout) st.session.elapsed = st.session.timeLimit;
    const rec = E.finish(st.session);
    S.del('active');
    st.session = null;
    st.resFilter = null;
    closeModal();
    go('#/resultado/' + rec.id);
    if (timeout) toast('Tempo esgotado: o exame foi encerrado automaticamente.', 'warn');
  }

  function quitDialog() {
    modal({
      title: 'Sair da sessão?',
      body: '<p>Seu progresso fica salvo neste navegador, e você pode continuar depois pela tela inicial. O cronômetro fica pausado enquanto você estiver fora.</p>',
      actions: [
        { label: 'Continuar respondendo' },
        { label: 'Descartar sessão', cls: 'danger', run: () => { S.del('active'); st.session = null; stopTimer(); st.resumeAt = null; closeModal(); go('#/'); } },
        { label: 'Sair e salvar', cls: 'primary', run: () => { persist(); stopTimer(); st.resumeAt = null; st.session = null; closeModal(); go('#/'); } }
      ]
    });
  }

  /* =====================================================================
   * RESULTADO
   * ===================================================================== */
  function viewResult(id) {
    const rec = E.history().find(h => h.id === id);
    if (!rec) {
      $app.innerHTML = `<div class="page"><div class="card empty"><h2>Resultado não encontrado</h2><p class="muted">Ele pode ter sido apagado do histórico.</p><a class="btn" href="#/">Voltar ao início</a></div></div>`;
      return;
    }
    const res = rec.res, isExam = rec.kind === 'exam';
    if (st.resId !== id) { st.resId = id; st.resFilter = null; }
    const items = rec.items.map((it, i) => ({ it, i, q: B.byId[it.qid] })).filter(x => x.q);
    const wrong = items.filter(x => x.it.e < x.it.m);
    if (!st.resFilter) st.resFilter = wrong.length ? 'wrong' : 'all';

    /* Desempenho por eixo, no estilo do relatório de pontuação da Microsoft */
    const domRows = AZ.DOMAINS.filter(d => res.by.domain[d.id]).map(d => {
      const t = res.by.domain[d.id];
      return `<div class="dbar ${domClass(d.id)}"><div class="dbar-label"><b>${esc(d.name)}</b><span class="muted small">${d.weight[0]}–${d.weight[1]}% do exame · ${t.n} questões · ${t.e}/${t.m} pontos</span></div>${bar(t.e, t.m)}</div>`;
    }).join('');

    /* Mapa de conteúdos (subtópico -> habilidade) */
    const map = AZ.DOMAINS.filter(d => res.by.domain[d.id]).map(d => {
      const subs = d.subtopics.filter(s => res.by.sub[s.id]).map(s => {
        const t = res.by.sub[s.id];
        const skills = s.skillList.filter(k => res.by.skill[k.id]).map(k => {
          const u = res.by.skill[k.id];
          return `<tr class="map-skill"><td><span class="sid">${k.id}</span>${esc(k.name)}</td><td class="num">${u.ok}/${u.n}</td><td class="barcell">${bar(u.e, u.m, { compact: true })}</td><td class="act"><button class="btn xs ghost" data-act="start" data-kind="skill" data-scope="${k.id}">Praticar</button></td></tr>`;
        }).join('');
        return `<tr class="map-sub"><td><span class="sid">${s.id}</span>${esc(s.name)}</td><td class="num">${t.ok}/${t.n}</td><td class="barcell">${bar(t.e, t.m, { compact: true })}</td><td class="act"><button class="btn xs" data-act="start" data-kind="sub" data-scope="${s.id}">Treinar</button></td></tr>${skills}`;
      }).join('');
      return `<tbody class="${domClass(d.id)}"><tr class="map-dom"><td colspan="4">Eixo ${d.id} · ${esc(d.name)}</td></tr>${subs}</tbody>`;
    }).join('');

    const counts = {
      all: items.length,
      wrong: wrong.length,
      partial: items.filter(x => x.it.e > 0 && x.it.e < x.it.m).length,
      ok: items.filter(x => x.it.e === x.it.m).length,
      marked: items.filter(x => x.it.marked).length
    };
    const FL = { all: 'Todas', wrong: 'Com erro', partial: 'Parciais', ok: 'Corretas', marked: 'Marcadas' };
    const filterFn = { all: () => true, wrong: x => x.it.e < x.it.m, partial: x => x.it.e > 0 && x.it.e < x.it.m, ok: x => x.it.e === x.it.m, marked: x => x.it.marked }[st.resFilter] || (() => true);
    const openAll = st.resFilter === 'wrong' || st.resFilter === 'partial';
    const list = items.filter(filterFn).map(({ it, i, q }) => {
      const cls = it.e === it.m ? 'ok' : it.e > 0 ? 'partial' : 'bad';
      const icon = it.e === it.m ? '✓' : it.e > 0 ? '◐' : '✗';
      return `<details class="rv ${cls}"${openAll ? ' open' : ''}>
        <summary><span class="rv-n">${i + 1}</span><span class="rv-ico ${cls}" aria-hidden="true">${icon}</span><span class="rv-text">${esc(R.snippet(q, 160))}</span>
          <span class="rv-meta"><span class="tag subtle">${q.skill}</span>${it.marked ? '<span class="tag flagged">⚑</span>' : ''}<span class="rv-pts">${it.e}/${it.m}</span></span></summary>
        <div class="rv-body"><div class="q-top"><span class="tag">${E.TYPE_LABEL[q.t]}</span><span class="tag subtle">${E.DIFF_LABEL[q.d]}</span></div>${R.question(q, it, { locked: true })}${R.feedback(q, it)}</div>
      </details>`;
    }).join('') || '<p class="muted center">Nenhuma questão neste filtro.</p>';

    const again = isExam
      ? `<button class="btn" data-act="start-exam">Novo simulado</button>`
      : ['domain', 'sub', 'skill', 'quick', 'weak', 'errors'].includes(rec.kind)
        ? `<button class="btn" data-act="start" data-kind="${rec.kind}" data-scope="${esc(rec.scope || '')}">Treinar novamente</button>`
        : '';

    $app.innerHTML = `<div class="page">
      <nav class="crumbs"><a href="#/">Início</a><span>›</span><a href="#/historico">Histórico</a><span>›</span>Resultado</nav>
      <section class="result-hero card ${isExam ? (res.passed ? 'pass' : 'fail') : ''}">
        <div class="rh-gauge">${isExam ? gauge(res.scaled, res.passed) : ring(res.pct)}</div>
        <div class="rh-info">
          <div class="eyebrow">${esc(rec.title)}${rec.subtitle ? ' · ' + esc(rec.subtitle) : ''} · ${U.date(rec.finishedAt)}</div>
          <h1>${isExam ? (res.passed ? '<span class="c-ok">Aprovado</span>' : '<span class="c-bad">Reprovado</span>') : `${res.pct}% de aproveitamento`}</h1>
          <p class="lead">${isExam ? `Pontuação <b>${res.scaled}</b> de 1000 · nota mínima para aprovação: <b>700</b>` : `${res.full} de ${res.total} questões totalmente corretas · modo ${rec.mode === 'study' ? 'estudo' : 'prova'}`}</p>
          <div class="kpis">
            <div><b>${res.e}/${res.m}</b><span>pontos brutos (${res.pct}%)</span></div>
            <div><b>${res.full}/${res.total}</b><span>questões 100% corretas</span></div>
            <div><b>${U.dur(rec.duration)}</b><span>tempo usado${rec.timeLimit ? ' de ' + U.dur(rec.timeLimit) : ''}</span></div>
            ${isExam ? `<div><b>${Math.round(res.cut * 100)}%</b><span>corte bruto estimado</span></div>` : ''}
          </div>
          <div class="rh-actions">
            ${wrong.length ? `<button class="btn primary" data-act="retry" data-id="${rec.id}">Refazer as ${wrong.length} com erro</button>` : ''}
            ${again}
            <a class="btn ghost" href="#/">Início</a>
          </div>
        </div>
      </section>

      ${isExam ? `<details class="card explain"><summary><b>Como esta nota foi calculada?</b></summary>
        <p>Assim como no exame real, cada parte correta de uma questão vale um ponto (questões de Sim/Não, múltipla seleção, listas suspensas e arrastar e soltar valem vários pontos) e não há penalidade por erro. Você fez <b>${res.e}</b> de <b>${res.m}</b> pontos possíveis (${res.pct}%).</p>
        <p>A Microsoft converte os pontos para uma escala de 1 a 1000, e 700 representa o desempenho mínimo exigido, definido por especialistas a partir da dificuldade das questões: provas mais difíceis exigem menos pontos, e provas mais fáceis exigem mais. Este simulador imita esse processo com uma estimativa no estilo Angoff: cada questão tem uma dificuldade, e a probabilidade de um candidato minimamente qualificado acertá-la define a nota de corte bruta da prova. Para este conjunto de questões, o corte ficou em <b>${(res.cut * 100).toFixed(1)}%</b> dos pontos. Esse percentual corresponde a 700; abaixo dele a escala vai de 1 a 699, e acima vai de 700 a 1000.</p>
        <p class="muted small">A fórmula exata da Microsoft não é pública. Use a nota como indicador de prontidão: mire em 800 ou mais com consistência antes da prova.</p>
      </details>` : ''}

      <section class="card">
        <h2>Desempenho por área de habilidade</h2>
        <p class="muted small">Barras curtas indicam pontos fracos. Assim como no relatório oficial, cada área tem um número diferente de questões.</p>
        <div class="dbars">${domRows}</div>
      </section>

      <section class="card">
        <h2>Mapa de conteúdos</h2>
        <div class="table-wrap"><table class="map"><thead><tr><th>Subtópico / conteúdo</th><th class="num">Certas</th><th>Aproveitamento</th><th></th></tr></thead>${map}</table></div>
      </section>

      <section class="card">
        <div class="rv-head"><h2>Correção das questões</h2>
          <div class="seg">${Object.keys(FL).map(f => `<button class="seg-btn${st.resFilter === f ? ' on' : ''}" data-act="res-filter" data-f="${f}" ${counts[f] ? '' : 'disabled'}>${FL[f]} <span>${counts[f]}</span></button>`).join('')}</div>
        </div>
        <div class="rv-tools"><button class="btn xs ghost" data-act="expand" data-open="1">Expandir todas</button><button class="btn xs ghost" data-act="expand" data-open="0">Recolher todas</button></div>
        <div class="rv-list">${list}</div>
      </section>
    </div>`;
  }

  /* =====================================================================
   * PROGRESSO
   * ===================================================================== */
  function lineChart(exams) {
    const pts = exams.slice(-20);
    const W = 680, H = 240, pl = 44, pr = 18, pt = 16, pb = 30;
    const n = pts.length;
    const x = i => pl + (n === 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (n - 1));
    const y = v => pt + (1 - v / 1000) * (H - pt - pb);
    const grid = [0, 250, 500, 750, 1000].map(v => `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="c-grid"/><text x="${pl - 8}" y="${y(v) + 4}" class="c-axis" text-anchor="end">${v}</text>`).join('');
    const pass = `<line x1="${pl}" x2="${W - pr}" y1="${y(700)}" y2="${y(700)}" class="c-pass"/><text x="${W - pr}" y="${y(700) - 6}" class="c-pass-t" text-anchor="end">700 · aprovação</text>`;
    const path = pts.map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(h.res.scaled).toFixed(1)}`).join(' ');
    const step = Math.max(1, Math.ceil(n / 8));
    const labels = pts.map((h, i) => (i % step === 0 || i === n - 1) ? `<text x="${x(i)}" y="${H - 8}" class="c-axis" text-anchor="middle">${U.shortDate(h.finishedAt)}</text>` : '').join('');
    const dots = pts.map((h, i) => `<a href="#/resultado/${h.id}"><circle cx="${x(i)}" cy="${y(h.res.scaled)}" r="5" class="c-dot ${h.res.passed ? 'ok' : 'bad'}"><title>${U.date(h.finishedAt)}: ${h.res.scaled} pontos</title></circle></a>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução das notas dos simulados">${grid}${pass}<path d="${path}" class="c-line"/>${dots}${labels}</svg>`;
  }

  function viewProgress() {
    const hist = E.history();
    const exams = hist.filter(h => h.kind === 'exam');
    const mt = E.mastery();
    const best = exams.length ? Math.max(...exams.map(h => h.res.scaled)) : null;
    const last3 = exams.slice(-3);
    const avg3 = last3.length ? Math.round(U.sum(last3.map(h => h.res.scaled)) / last3.length) : null;
    const passes = exams.filter(h => h.res.passed).length;
    const trainings = hist.length - exams.length;
    const answeredTotal = U.sum(hist.map(h => h.items.filter(i => i.answered).length));

    const tree = AZ.DOMAINS.map(d => {
      const dm = mt.domain[d.id];
      const subs = d.subtopics.map(s => {
        const sm = mt.sub[s.id];
        const skills = s.skillList.map(k => {
          const km = mt.skill[k.id];
          return `<tr class="map-skill"><td><span class="sid">${k.id}</span>${esc(k.name)}</td><td class="num">${km.seen}/${km.count}</td><td class="barcell">${bar(km.e, km.m, { compact: true })}</td><td class="act"><button class="btn xs ghost" data-act="start" data-kind="skill" data-scope="${k.id}">Praticar</button></td></tr>`;
        }).join('');
        return `<tr class="map-sub"><td><span class="sid">${s.id}</span>${esc(s.name)}</td><td class="num">${sm.seen}/${sm.count}</td><td class="barcell">${bar(sm.e, sm.m, { compact: true })}</td><td class="act"><button class="btn xs" data-act="start" data-kind="sub" data-scope="${s.id}">Treinar</button></td></tr>${skills}`;
      }).join('');
      return `<tbody class="${domClass(d.id)}"><tr class="map-dom"><td>Eixo ${d.id} · ${esc(d.name)}</td><td class="num">${dm.seen}/${dm.count}</td><td class="barcell">${bar(dm.e, dm.m, { compact: true })}</td><td class="act"><button class="btn xs" data-act="start" data-kind="domain" data-scope="${d.id}">Treinar</button></td></tr>${subs}</tbody>`;
    }).join('');

    const weakest = Object.values(AZ.skill)
      .map(k => ({ k, t: mt.skill[k.id] }))
      .filter(x => x.t.m >= 3 && x.t.e / x.t.m < 0.8)
      .sort((a, b) => a.t.e / a.t.m - b.t.e / b.t.m)
      .slice(0, 5);

    $app.innerHTML = `<div class="page">
      <div class="page-head"><h1>Progresso</h1><p class="muted">Evolução nos simulados e aproveitamento acumulado em cada conteúdo do exame (todas as sessões, treinos e simulados).</p></div>
      <section class="kpi-grid">
        <div class="card kpi"><span>Simulados feitos</span><b>${exams.length}</b><small>${passes} aprovado(s)</small></div>
        <div class="card kpi"><span>Melhor nota</span><b>${best == null ? '—' : best}</b><small>de 1000</small></div>
        <div class="card kpi"><span>Média dos 3 últimos</span><b class="${avg3 == null ? '' : avg3 >= 700 ? 'c-ok' : 'c-bad'}">${avg3 == null ? '—' : avg3}</b><small>${avg3 == null ? 'faça um simulado' : avg3 >= 800 ? 'pronto para a prova' : avg3 >= 700 ? 'quase lá' : 'continue praticando'}</small></div>
        <div class="card kpi"><span>Aproveitamento geral</span><b>${mt.total.m ? U.pct(mt.total.e, mt.total.m) + '%' : '—'}</b><small>${answeredTotal} respostas em ${trainings} treino(s) e ${exams.length} simulado(s)</small></div>
        <div class="card kpi"><span>Cobertura do banco</span><b>${U.pct(mt.total.seen, mt.total.count)}%</b><small>${mt.total.seen} de ${mt.total.count} questões vistas</small></div>
      </section>
      <section class="card">
        <h2>Notas dos simulados</h2>
        ${exams.length ? lineChart(exams) + (exams.length > 20 ? '<p class="muted small">Mostrando os 20 simulados mais recentes.</p>' : '') : '<p class="muted">Faça seu primeiro simulado para ver a evolução das notas aqui.</p>'}
      </section>
      ${weakest.length ? `<section class="card"><h2>Conteúdos que mais precisam de atenção</h2><ul class="weak-list">${weakest.map(w => `<li><span><span class="sid">${w.k.id}</span>${esc(w.k.name)}</span>${bar(w.t.e, w.t.m, { compact: true })}<button class="btn xs" data-act="start" data-kind="skill" data-scope="${w.k.id}">Praticar</button></li>`).join('')}</ul></section>` : ''}
      <section class="card">
        <h2>Mapa de domínio dos conteúdos</h2>
        <p class="muted small">Aproveitamento acumulado em pontos. A coluna "Vistas" mostra quantas questões do banco você já respondeu em cada parte.</p>
        <div class="table-wrap"><table class="map"><thead><tr><th>Eixo / subtópico / conteúdo</th><th class="num">Vistas</th><th>Aproveitamento</th><th></th></tr></thead>${tree}</table></div>
      </section>
    </div>`;
  }

  /* =====================================================================
   * HISTÓRICO
   * ===================================================================== */
  const KIND_LABEL = { exam: 'Simulado', domain: 'Eixo', sub: 'Subtópico', skill: 'Conteúdo', quick: 'Treino rápido', weak: 'Pontos fracos', errors: 'Revisar erros', retry: 'Refazer' };
  function viewHistory() {
    const hist = E.history().slice().reverse();
    const rows = hist.map(h => {
      const isExam = h.kind === 'exam';
      const result = isExam
        ? `<b class="${h.res.passed ? 'c-ok' : 'c-bad'}">${h.res.scaled}</b> <span class="muted small">${h.res.passed ? 'aprovado' : 'reprovado'}</span>`
        : `<b class="c-${level(h.res.pct)}">${h.res.pct}%</b>`;
      return `<tr>
        <td class="nowrap">${U.date(h.finishedAt)}</td>
        <td><span class="tag ${isExam ? 'tag-exam' : ''}">${KIND_LABEL[h.kind] || h.kind}</span></td>
        <td class="h-title">${esc(h.subtitle && h.kind !== 'exam' ? h.subtitle : h.title)}<span class="muted small"> · ${h.mode === 'study' ? 'estudo' : 'prova'}</span></td>
        <td class="num">${h.res.full}/${h.res.total}</td>
        <td class="num">${result}</td>
        <td class="num hide-sm">${U.dur(h.duration)}</td>
        <td class="act nowrap"><a class="btn xs" href="#/resultado/${h.id}">Ver</a><button class="btn xs ghost" data-act="del-hist" data-id="${h.id}" aria-label="Excluir">✕</button></td>
      </tr>`;
    }).join('');
    $app.innerHTML = `<div class="page">
      <div class="page-head row"><div><h1>Histórico</h1><p class="muted">Todas as sessões concluídas ficam salvas neste navegador (armazenamento local).</p></div>
        ${hist.length ? '<button class="btn ghost danger-text" data-act="clear-hist">Limpar histórico</button>' : ''}</div>
      ${hist.length ? `<div class="card table-card"><div class="table-wrap"><table class="hist"><thead><tr><th>Data</th><th>Tipo</th><th>Sessão</th><th class="num">Certas</th><th class="num">Resultado</th><th class="num hide-sm">Duração</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`
        : '<div class="card empty"><p class="muted">Nenhuma sessão concluída ainda.</p><a class="btn primary" href="#/">Começar a praticar</a></div>'}
    </div>`;
  }

  /* =====================================================================
   * BANCO DE QUESTÕES
   * ===================================================================== */
  const PAGE = 15;
  function viewBank() {
    const f = st.bank;
    const text = f.text.trim().toLowerCase();
    const list = B.all.filter(q =>
      (!f.sub || q.sub === f.sub) &&
      (!f.skill || q.skill === f.skill) &&
      (!f.type || q.t === f.type) &&
      (!text || JSON.stringify([q.q, q.o, q.st, q.bl, q.it, q.ch, q.e]).toLowerCase().includes(text))
    );
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (f.page >= pages) f.page = pages - 1;
    const slice = list.slice(f.page * PAGE, f.page * PAGE + PAGE);
    const subOpts = AZ.DOMAINS.map(d => `<optgroup label="Eixo ${d.id} · ${esc(d.short)}">${d.subtopics.map(s => `<option value="${s.id}"${f.sub === s.id ? ' selected' : ''}>${s.id} · ${esc(s.name)}</option>`).join('')}</optgroup>`).join('');
    const skillOpts = f.sub ? AZ.sub[f.sub].skillList.map(k => `<option value="${k.id}"${f.skill === k.id ? ' selected' : ''}>${k.id} · ${esc(k.name)}</option>`).join('') : '';
    const typeOpts = Object.keys(E.TYPE_LABEL).map(t => `<option value="${t}"${f.type === t ? ' selected' : ''}>${E.TYPE_LABEL[t]}</option>`).join('');
    const cards = slice.map(q => {
      const fake = { qid: q.id, resp: null };
      return `<details class="rv bank">
        <summary><span class="rv-text">${esc(R.snippet(q, 170))}</span><span class="rv-meta"><span class="tag subtle">${q.skill}</span><span class="tag">${E.TYPE_LABEL[q.t]}</span></span></summary>
        <div class="rv-body">${R.question(q, fake, { locked: true, key: true })}${R.feedback(q, fake, { key: true })}</div>
      </details>`;
    }).join('') || '<p class="muted center">Nenhuma questão encontrada.</p>';
    const pager = pages > 1 ? `<div class="pager"><button class="btn sm" data-act="bank-page" data-p="${f.page - 1}" ${f.page === 0 ? 'disabled' : ''}>◀</button><span>Página ${f.page + 1} de ${pages}</span><button class="btn sm" data-act="bank-page" data-p="${f.page + 1}" ${f.page >= pages - 1 ? 'disabled' : ''}>▶</button></div>` : '';

    $app.innerHTML = `<div class="page">
      <div class="page-head"><h1>Banco de questões</h1><p class="muted">Consulte as questões com gabarito e explicação. Para treinar de verdade, prefira responder antes de ver as respostas.</p></div>
      <div class="card filters">
        <label><span>Subtópico</span><select data-bank="sub"><option value="">Todos</option>${subOpts}</select></label>
        <label><span>Conteúdo</span><select data-bank="skill" ${f.sub ? '' : 'disabled'}><option value="">Todos</option>${skillOpts}</select></label>
        <label><span>Tipo</span><select data-bank="type"><option value="">Todos</option>${typeOpts}</select></label>
        <label class="grow"><span>Buscar</span><input type="search" data-bank="text" value="${esc(f.text)}" placeholder="Ex.: ExpressRoute, bloqueio, SLA…"></label>
      </div>
      <p class="muted small">${list.length} questão(ões) encontrada(s).</p>
      <div class="rv-list">${cards}</div>
      ${pager}
    </div>`;
  }

  /* =====================================================================
   * CONFIGURAÇÕES
   * ===================================================================== */
  function viewSettings() {
    const set = settings();
    const counts = [40, 45, 50, 55, 60].map(n => `<option value="${n}"${String(set.examCount) === String(n) ? ' selected' : ''}>${n} questões${n === 45 ? ' (padrão)' : ''}</option>`).join('');
    const mins = [45, 60, 75].map(n => `<option value="${n}"${+set.examMinutes === n ? ' selected' : ''}>${n} minutos${n === 45 ? ' (padrão do exame)' : n === 75 ? ' (com acomodação de +30 min)' : ''}</option>`).join('');
    const hist = E.history();
    $app.innerHTML = `<div class="page narrow">
      <div class="page-head"><h1>Configurações</h1></div>
      <section class="card form">
        <h2>Simulado oficial</h2>
        <label class="frow"><span>Quantidade de questões<small>O exame real tem de 40 a 60 questões. A distribuição por eixo segue sempre as faixas do guia de estudo.</small></span>
          <select data-set="examCount">${counts}<option value="random"${set.examCount === 'random' ? ' selected' : ''}>Aleatória entre 40 e 60</option></select></label>
        <label class="frow"><span>Tempo de prova<small>Exames Fundamentals têm 45 minutos para responder às questões.</small></span>
          <select data-set="examMinutes">${mins}</select></label>
      </section>
      <section class="card form">
        <h2>Treinos</h2>
        <label class="frow"><span>Modo padrão</span>
          <select data-set="trainMode"><option value="study"${set.trainMode === 'study' ? ' selected' : ''}>Estudo (correção imediata)</option><option value="exam"${set.trainMode === 'exam' ? ' selected' : ''}>Prova (correção ao final)</option></select></label>
        <label class="frow"><span>Cronômetro de 1 min por questão</span>
          <select data-set="trainTimed"><option value="0"${!set.trainTimed ? ' selected' : ''}>Desligado</option><option value="1"${set.trainTimed ? ' selected' : ''}>Ligado</option></select></label>
      </section>
      <section class="card form">
        <h2>Aparência</h2>
        <label class="frow"><span>Tema</span>
          <select data-set="theme"><option value="auto"${set.theme === 'auto' ? ' selected' : ''}>Automático (sistema)</option><option value="light"${set.theme === 'light' ? ' selected' : ''}>Claro</option><option value="dark"${set.theme === 'dark' ? ' selected' : ''}>Escuro</option></select></label>
      </section>
      <section class="card form">
        <h2>Dados</h2>
        <p class="muted small">Histórico, estatísticas e configurações ficam salvos apenas neste navegador (localStorage). Exporte um backup para levar seus dados para outro navegador ou computador.</p>
        <div class="btn-row">
          <button class="btn" data-act="export">Exportar backup (.json)</button>
          <label class="btn">Importar backup<input type="file" accept="application/json,.json" data-act-file="import" hidden></label>
        </div>
        <div class="btn-row">
          <button class="btn ghost danger-text" data-act="reset-stats">Zerar estatísticas das questões</button>
          <button class="btn ghost danger-text" data-act="reset-all">Apagar todos os dados</button>
        </div>
        <p class="muted small">${hist.length} sessão(ões) no histórico.</p>
      </section>
      <section class="card form">
        <h2>Sobre</h2>
        <p class="small">Banco com <b>${B.all.length}</b> questões em português, organizadas pelos ${Object.keys(AZ.skill).length} conteúdos do guia de estudo do AZ-900 (habilidades medidas a partir de ${AZ.EXAM.skillsDate}). Projeto de estudo independente, sem afiliação com a Microsoft. Confira sempre a documentação oficial no Microsoft Learn.</p>
      </section>
    </div>`;
  }

  function exportData() {
    const data = { app: 'az900-simulador', version: 1, exportedAt: new Date().toISOString() };
    S.keys.forEach(k => (data[k] = S.get(k, null)));
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `az900-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); } catch (e) { toast('Arquivo inválido.', 'bad'); return; }
      if (!data || data.app !== 'az900-simulador') { toast('Este arquivo não é um backup do simulador.', 'bad'); return; }
      modal({
        title: 'Importar backup?',
        body: `<p>Os dados atuais deste navegador serão substituídos pelos do backup (${(data.history || []).length} sessão(ões) no histórico).</p>`,
        actions: [{ label: 'Cancelar' }, {
          label: 'Importar', cls: 'primary', run: () => {
            S.keys.forEach(k => (data[k] == null ? S.del(k) : S.set(k, data[k])));
            st.session = null;
            applyTheme();
            toast('Backup importado.', 'ok');
            route();
          }
        }]
      });
    };
    reader.readAsText(file);
  }

  /* =====================================================================
   * EVENTOS
   * ===================================================================== */
  const ACTIONS = {
    'start-exam': () => startExamDialog(),
    start: t => startTrainDialog(t.dataset.kind, t.dataset.kind === 'domain' ? +t.dataset.scope : t.dataset.scope || null),
    resume: () => { st.session = S.get('active', null); go('#/sessao'); },
    discard: () => modal({
      title: 'Descartar a sessão em andamento?',
      body: '<p>As respostas dadas nessa sessão serão perdidas.</p>',
      actions: [{ label: 'Cancelar' }, { label: 'Descartar', cls: 'danger', run: () => { S.del('active'); st.session = null; route(); } }]
    }),
    toggle: t => {
      const el = document.getElementById(t.dataset.target);
      if (!el) return;
      el.hidden = !el.hidden;
      t.setAttribute('aria-expanded', String(!el.hidden));
      t.classList.toggle('open', !el.hidden);
    },

    /* sessão */
    opt: t => {
      if (isLocked()) return;
      const it = cur(), q = curQ(), i = +t.dataset.i;
      if (q.t === 'single') it.resp = i;
      else {
        const r = (it.resp || []).slice();
        const k = r.indexOf(i);
        if (k >= 0) r.splice(k, 1);
        else {
          if (r.length >= q.a.length) { toast(`Selecione apenas ${q.a.length} respostas. Desmarque uma para trocar.`, 'warn'); return; }
          r.push(i);
        }
        it.resp = r;
      }
      changed();
    },
    yn: t => {
      if (isLocked()) return;
      const it = cur(), q = curQ();
      const r = (it.resp || E.emptyResponse(q)).slice();
      r[+t.dataset.i] = t.dataset.v === '1';
      it.resp = r;
      changed();
    },
    chip: t => {
      if (isLocked()) return;
      const c = +t.dataset.c;
      st.chip = st.chip === c ? null : c;
      renderSession();
    },
    slot: t => {
      if (isLocked()) return;
      const i = +t.dataset.i;
      const it = cur(), q = curQ();
      if (st.chip != null) { placeChip(i, st.chip); return; }
      if (it.resp && it.resp[i] != null) {
        const r = it.resp.slice();
        r[i] = null;
        it.resp = r.every(v => v == null) ? E.emptyResponse(q) : r;
        changed();
      } else toast('Arraste um valor até a lacuna, ou clique primeiro em um valor e depois na lacuna.');
    },
    prev: () => goTo(st.session.cur - 1),
    next: () => goTo(st.session.cur + 1),
    goto: t => goTo(+t.dataset.i),
    'goto-next': t => {
      const s = st.session, n = s.items.length;
      for (let k = 1; k <= n; k++) {
        const i = (s.cur + k) % n, it = s.items[i];
        const ok = t.dataset.what === 'marked' ? it.marked : E.answerState(B.byId[it.qid], it.resp) !== 'full';
        if (ok) { goTo(i); return; }
      }
    },
    mark: () => { cur().marked = !cur().marked; changed(); },
    check: () => {
      const it = cur();
      if (E.answerState(curQ(), it.resp) === 'none') return;
      it.checked = true;
      changed();
      const fb = $app.querySelector('.fb');
      if (fb) fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    review: () => { st.reviewOpen = true; renderSession(); },
    'close-review': () => { st.reviewOpen = false; renderSession(); },
    'close-review-bg': (t, e) => { if (e.target === t) { st.reviewOpen = false; renderSession(); } },
    finish: () => confirmFinish(),
    quit: () => quitDialog(),

    /* resultado */
    retry: t => {
      const rec = E.history().find(h => h.id === t.dataset.id);
      if (!rec) return;
      const qids = rec.items.filter(i => i.e < i.m).map(i => i.qid);
      modal({
        title: 'Refazer questões com erro',
        body: `<p>${qids.length} questão(ões) de "${esc(rec.title)}", no modo estudo (com correção imediata).</p>`,
        actions: [{ label: 'Cancelar' }, { label: 'Começar', cls: 'primary', run: () => begin({ kind: 'retry', qids, mode: 'study', subtitle: 'Questões com erro de ' + rec.title }) }]
      });
    },
    'res-filter': t => {
      st.resFilter = t.dataset.f;
      const y = window.scrollY;
      route();
      window.scrollTo(0, y);
    },
    expand: t => document.querySelectorAll('.rv-list details').forEach(d => (d.open = t.dataset.open === '1')),

    /* histórico */
    'del-hist': t => modal({
      title: 'Excluir esta sessão do histórico?',
      body: '<p class="muted">As estatísticas por questão já registradas não são alteradas.</p>',
      actions: [{ label: 'Cancelar' }, { label: 'Excluir', cls: 'danger', run: () => { S.set('history', E.history().filter(h => h.id !== t.dataset.id)); route(); } }]
    }),
    'clear-hist': () => modal({
      title: 'Limpar todo o histórico?',
      body: '<p>Todas as sessões concluídas serão removidas. As estatísticas por questão (usadas no mapa de conteúdos) são mantidas.</p>',
      actions: [{ label: 'Cancelar' }, { label: 'Limpar histórico', cls: 'danger', run: () => { S.set('history', []); route(); } }]
    }),

    /* banco */
    'bank-page': t => { st.bank.page = +t.dataset.p; viewBank(); window.scrollTo(0, 0); },

    /* configurações */
    export: () => exportData(),
    'reset-stats': () => modal({
      title: 'Zerar estatísticas das questões?',
      body: '<p>O aproveitamento por conteúdo, a rotação de questões e a lista de erros voltam ao zero. O histórico de sessões é mantido.</p>',
      actions: [{ label: 'Cancelar' }, { label: 'Zerar', cls: 'danger', run: () => { S.del('qstats'); toast('Estatísticas zeradas.', 'ok'); route(); } }]
    }),
    'reset-all': () => modal({
      title: 'Apagar todos os dados?',
      body: '<p>Histórico, estatísticas, sessão em andamento e configurações serão apagados deste navegador. Essa ação não pode ser desfeita.</p>',
      actions: [{ label: 'Cancelar' }, { label: 'Apagar tudo', cls: 'danger', run: () => { S.keys.forEach(k => S.del(k)); st.session = null; applyTheme(); toast('Dados apagados.', 'ok'); route(); } }]
    })
  };

  $app.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled || !$app.contains(t)) return;
    const fn = ACTIONS[t.dataset.act];
    if (fn) fn(t, e);
  });

  $app.addEventListener('keydown', e => {
    /* lacunas de arrastar e soltar acessíveis por teclado */
    const t = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && t.matches('.slot[data-act="slot"]')) {
      e.preventDefault();
      e.stopPropagation();
      ACTIONS.slot(t);
    }
  });

  $app.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.act === 'dd' && st.session) {
      if (isLocked()) return;
      const it = cur(), q = curQ();
      const r = (it.resp || E.emptyResponse(q)).slice();
      r[+t.dataset.i] = t.value === '' ? null : +t.value;
      it.resp = r;
      changed();
      return;
    }
    if (t.dataset.set) {
      let v = t.value;
      if (t.dataset.set === 'trainTimed') v = v === '1';
      if (t.dataset.set === 'examMinutes') v = +v;
      if (t.dataset.set === 'examCount' && v !== 'random') v = +v;
      saveSettings({ [t.dataset.set]: v });
      if (t.dataset.set === 'theme') applyTheme();
      toast('Configuração salva.', 'ok');
      return;
    }
    if (t.dataset.actFile === 'import' && t.files && t.files[0]) {
      importData(t.files[0]);
      t.value = '';
      return;
    }
    if (t.dataset.bank) {
      const f = st.bank;
      f[t.dataset.bank] = t.value;
      if (t.dataset.bank === 'sub') f.skill = '';
      f.page = 0;
      viewBank();
    }
  });

  let searchTimer = null;
  $app.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.bank !== 'text') return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      st.bank.text = t.value;
      st.bank.page = 0;
      viewBank();
      const input = $app.querySelector('input[data-bank="text"]');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    }, 250);
  });

  /* arrastar e soltar */
  $app.addEventListener('dragstart', e => {
    const c = e.target.closest && e.target.closest('.chip[data-c]');
    if (!c || !st.session || isLocked()) return;
    e.dataTransfer.setData('text/plain', c.dataset.c);
    e.dataTransfer.effectAllowed = 'copy';
    c.classList.add('dragging');
  });
  $app.addEventListener('dragend', e => {
    const c = e.target.closest && e.target.closest('.chip');
    if (c) c.classList.remove('dragging');
  });
  $app.addEventListener('dragover', e => {
    const sl = e.target.closest && e.target.closest('.slot[data-act="slot"]');
    if (!sl) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    sl.classList.add('over');
  });
  $app.addEventListener('dragleave', e => {
    const sl = e.target.closest && e.target.closest('.slot');
    if (sl && !sl.contains(e.relatedTarget)) sl.classList.remove('over');
  });
  $app.addEventListener('drop', e => {
    const sl = e.target.closest && e.target.closest('.slot[data-act="slot"]');
    if (!sl) return;
    e.preventDefault();
    const c = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(c)) placeChip(+sl.dataset.i, c);
  });

  /* atalhos de teclado */
  document.addEventListener('keydown', e => {
    if (st.modal) {
      if (e.key === 'Escape') closeModal();
      return;
    }
    if (!st.session || !document.body.classList.contains('in-session')) return;
    if (e.target.matches && e.target.matches('input, select, textarea')) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (st.reviewOpen) {
      if (e.key === 'Escape') { st.reviewOpen = false; renderSession(); }
      return;
    }
    const q = curQ(), it = cur();
    if (/^[1-9]$/.test(e.key) && (q.t === 'single' || q.t === 'multi')) {
      const order = it.perm || q.o.map((_, i) => i);
      const oi = order[+e.key - 1];
      if (oi != null) ACTIONS.opt({ dataset: { i: oi } });
      e.preventDefault();
    } else if (e.key === 'ArrowRight') { goTo(st.session.cur + 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { goTo(st.session.cur - 1); e.preventDefault(); }
    else if (e.key === 'm' || e.key === 'M') { ACTIONS.mark(); }
    else if (e.key === 'Enter') {
      if (e.target.closest && e.target.closest('button, .slot')) return;
      e.preventDefault();
      if (st.session.mode === 'study' && !it.checked && E.answerState(q, it.resp) !== 'none') ACTIONS.check();
      else if (st.session.cur < st.session.items.length - 1) goTo(st.session.cur + 1);
      else ACTIONS.review();
    }
  });

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-global]');
    if (!t) return;
    if (t.dataset.global === 'theme') {
      saveSettings({ theme: isDark() ? 'light' : 'dark' });
      applyTheme();
    }
  });

  window.addEventListener('beforeunload', () => { if (st.session && st.timer) persist(); });
  document.addEventListener('visibilitychange', () => { if (st.session && st.timer) persist(); });
  window.addEventListener('hashchange', route);

  /* ---------------- Inicialização ---------------- */
  applyTheme();
  if (B.errors.length) console.warn(`${B.errors.length} questão(ões) com erro de formato foram ignoradas.`);
  route();
})();
