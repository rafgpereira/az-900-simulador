/* AZ-900 Simulador — utilitários, armazenamento local e índice do banco de questões */
(function () {
  'use strict';
  const AZ = window.AZ;

  /* ---------------- Utilitários ---------------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const U = AZ.U = {
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]),
    /* texto com quebras de linha e **negrito** */
    fmt: s => U.esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>'),
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    hash(str) {
      let h = 5381;
      for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
      return (h >>> 0).toString(36);
    },
    clock(sec) {
      sec = Math.max(0, Math.floor(sec));
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
      return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
    },
    dur(sec) {
      sec = Math.round(sec || 0);
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      if (h) return m ? `${h} h ${m} min` : `${h} h`;
      if (m) return s ? `${m} min ${s} s` : `${m} min`;
      return `${s} s`;
    },
    date(ts) {
      return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    },
    shortDate(ts) {
      return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    },
    pct: (e, m) => (m ? Math.round((100 * e) / m) : 0),
    uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    letter: i => String.fromCharCode(65 + i),
    sum: arr => arr.reduce((a, b) => a + b, 0)
  };

  /* ---------------- Armazenamento (localStorage) ---------------- */
  const PREFIX = 'az900sim.v1.';
  AZ.store = {
    get(key, def) {
      try {
        const v = localStorage.getItem(PREFIX + key);
        return v == null ? def : JSON.parse(v);
      } catch (e) {
        return def;
      }
    },
    set(key, val) {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(val));
        return true;
      } catch (e) {
        console.warn('Falha ao salvar no armazenamento local', e);
        return false;
      }
    },
    del(key) {
      try { localStorage.removeItem(PREFIX + key); } catch (e) { /* ignora */ }
    },
    keys: ['settings', 'qstats', 'history', 'active']
  };

  /* ---------------- Índice do currículo ---------------- */
  AZ.dom = {};
  AZ.sub = {};
  AZ.skill = {};
  AZ.DOMAINS.forEach(d => {
    AZ.dom[d.id] = d;
    d.subtopics.forEach(s => {
      s.domain = d.id;
      AZ.sub[s.id] = s;
      s.skillList = s.skills.map(([id, name, ref]) => {
        const k = { id, name, ref: ref || s.learn, sub: s.id, domain: d.id };
        AZ.skill[id] = k;
        return k;
      });
    });
  });

  /* ---------------- Banco de questões ---------------- */
  const B = AZ.bank = { all: [], byId: {}, bySkill: {}, bySub: {}, byDomain: {}, errors: [] };
  Object.keys(AZ.skill).forEach(k => (B.bySkill[k] = []));
  Object.keys(AZ.sub).forEach(k => (B.bySub[k] = []));
  AZ.DOMAINS.forEach(d => (B.byDomain[d.id] = []));

  const typeOf = q => (q.st ? 'yesno' : q.bl ? 'dd' : q.it ? 'match' : Array.isArray(q.a) ? 'multi' : 'single');

  function validate(q) {
    const errs = [];
    if (!AZ.skill[q.skill]) errs.push('habilidade inexistente ' + q.skill);
    if (!q.e) errs.push('sem explicação');
    switch (q.t) {
      case 'single':
        if (!q.o || !q.o[q.a]) errs.push('resposta fora das opções');
        break;
      case 'multi':
        if (!q.o || q.a.length < 2 || q.a.some(i => !q.o[i]) || new Set(q.a).size !== q.a.length) errs.push('resposta múltipla inválida');
        break;
      case 'yesno':
        if (!q.st.length || q.st.some(s => typeof s[1] !== 'boolean')) errs.push('afirmações inválidas');
        break;
      case 'dd': {
        const n = (q.q.match(/\{\d+\}/g) || []).length;
        if (n !== q.bl.length) errs.push('lacunas ≠ listas');
        if (q.bl.some(b => !b.o[b.a])) errs.push('resposta de lista inválida');
        break;
      }
      case 'match':
        if (!q.ch || q.it.some(i => !q.ch[i[1]])) errs.push('associação inválida');
        break;
    }
    return errs;
  }

  AZ._raw.forEach(([subId, list]) => {
    const sub = AZ.sub[subId];
    list.forEach(q => {
      q.sub = subId;
      q.domain = sub ? sub.domain : 0;
      q.skill = subId + '.' + q.s;
      q.t = typeOf(q);
      q.d = q.d || 2;
      const key = q.skill + '|' + (q.q || '') + '|' + JSON.stringify(q.o || q.st || q.bl || q.it);
      let id = 'q' + U.hash(key);
      while (B.byId[id]) id += 'x';
      q.id = id;
      const errs = validate(q);
      if (errs.length) {
        B.errors.push({ id, skill: q.skill, errs });
        return;
      }
      B.all.push(q);
      B.byId[id] = q;
      B.bySkill[q.skill].push(q);
      B.bySub[q.sub].push(q);
      B.byDomain[q.domain].push(q);
    });
  });
  if (B.errors.length) console.warn('Questões inválidas ignoradas:', B.errors);
})();
