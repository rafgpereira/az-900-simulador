/* AZ-900 Simulador — renderização das questões (resposta, correção e gabarito) */
(function () {
  'use strict';
  const AZ = window.AZ, U = AZ.U, E = AZ.engine;
  const R = AZ.render = {};
  const NUM = { 2: 'DUAS', 3: 'TRÊS', 4: 'QUATRO' };

  R.instruction = q => {
    switch (q.t) {
      case 'multi':
        return `Selecione <b>${NUM[q.a.length] || q.a.length}</b> respostas. Cada resposta correta apresenta parte da solução. <span class="note">OBSERVAÇÃO: cada seleção correta vale um ponto.</span>`;
      case 'yesno':
        return 'Para cada uma das afirmações a seguir, selecione <b>Sim</b> se a afirmação for verdadeira. Caso contrário, selecione <b>Não</b>. <span class="note">OBSERVAÇÃO: cada seleção correta vale um ponto.</span>';
      case 'dd':
        return 'Para responder, selecione a opção apropriada em cada lista suspensa da área de resposta.' + (q.bl.length > 1 ? ' <span class="note">OBSERVAÇÃO: cada seleção correta vale um ponto.</span>' : '');
      case 'match':
        return 'Para responder, arraste o valor apropriado da coluna da esquerda até a descrição correspondente na área de resposta (ou clique no valor e depois na lacuna). Cada valor pode ser usado uma vez, mais de uma vez ou nenhuma vez. <span class="note">OBSERVAÇÃO: cada correspondência correta vale um ponto.</span>';
      default:
        return 'Selecione a resposta correta.';
    }
  };

  /*
   * opts.locked : respostas travadas, exibindo a correção
   * opts.key    : modo gabarito (sem resposta do usuário; mostra apenas a resposta correta)
   * opts.chip   : valor selecionado no modo "clique para posicionar" (arrastar e soltar)
   */
  R.question = (q, item, opts) => {
    opts = opts || {};
    const locked = !!opts.locked;
    const key = !!opts.key && item.resp == null;
    let html = `<div class="q-instr">${R.instruction(q)}</div>`;
    if (q.t === 'dd') {
      const parts = q.q.split(/\n\n+/);
      const prompt = parts.filter(p => !/\{\d+\}/.test(p));
      const area = parts.filter(p => /\{\d+\}/.test(p));
      if (prompt.length) html += `<div class="q-text">${prompt.map(U.fmt).join('<br><br>')}</div>`;
      html += `<div class="answer-area"><div class="aa-label">Área de resposta</div><div class="dd-sentence">${area
        .map(p => ddSentence(q, item, p, locked, key))
        .join('<br><br>')}</div></div>`;
      return html;
    }
    if (q.q) html += `<div class="q-text">${U.fmt(q.q)}</div>`;
    if (q.t === 'yesno') html += yesno(q, item, locked, key);
    else if (q.t === 'match') html += match(q, item, locked, key, opts.chip);
    else html += options(q, item, locked, key);
    return html;
  };

  function options(q, item, locked, key) {
    const order = item.perm || q.o.map((_, i) => i);
    const multi = q.t === 'multi';
    const sel = multi ? item.resp || [] : item.resp == null ? [] : [item.resp];
    const rows = order.map((oi, pos) => {
      const chosen = sel.includes(oi);
      const correct = multi ? q.a.includes(oi) : q.a === oi;
      let cls = 'opt' + (chosen ? ' sel' : '');
      let mark = '';
      if (locked) {
        if (key) { if (correct) { cls += ' ok'; mark = '✓'; } }
        else if (correct && chosen) { cls += ' ok'; mark = '✓'; }
        else if (correct) { cls += ' miss'; mark = '✓'; }
        else if (chosen) { cls += ' bad'; mark = '✗'; }
      }
      return `<button type="button" class="${cls}" data-act="opt" data-i="${oi}" role="${multi ? 'checkbox' : 'radio'}" aria-checked="${chosen}"${locked ? ' disabled' : ''}>
        <span class="opt-ind" aria-hidden="true"></span><span class="opt-key">${U.letter(pos)}</span><span class="opt-text">${U.fmt(q.o[oi])}</span>${mark ? `<span class="opt-mark" aria-hidden="true">${mark}</span>` : ''}</button>`;
    });
    return `<div class="opts ${multi ? 'is-multi' : 'is-single'}" role="${multi ? 'group' : 'radiogroup'}">${rows.join('')}</div>`;
  }

  function yesno(q, item, locked, key) {
    const r = item.resp || [];
    const rows = q.st.map((st, i) => {
      const v = r[i];
      const cell = (val, label) => {
        const chosen = v === val;
        const right = st[1] === val;
        let cls = 'yn-btn' + (chosen ? ' sel' : '');
        if (locked) {
          if (key) { if (right) cls += ' ok'; }
          else if (chosen && right) cls += ' ok';
          else if (chosen) cls += ' bad';
          else if (right) cls += ' miss';
        }
        return `<td class="yn-cell"><button type="button" class="${cls}" data-act="yn" data-i="${i}" data-v="${val ? 1 : 0}" aria-label="${label}: afirmação ${i + 1}" aria-pressed="${chosen}"${locked ? ' disabled' : ''}><span class="yn-dot"></span></button></td>`;
      };
      const rowCls = locked && !key ? (v === st[1] ? 'row-ok' : 'row-bad') : '';
      return `<tr class="${rowCls}"><td class="yn-st">${U.fmt(st[0])}</td>${cell(true, 'Sim')}${cell(false, 'Não')}</tr>`;
    });
    return `<div class="answer-area"><div class="aa-label">Área de resposta</div><table class="yn"><thead><tr><th>Afirmação</th><th>Sim</th><th>Não</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  }

  function ddSentence(q, item, p, locked, key) {
    const r = item.resp || [];
    return U.fmt(p).replace(/\{(\d+)\}/g, (_, n) => {
      const i = +n, b = q.bl[i];
      const order = (item.bperm && item.bperm[i]) || b.o.map((_, k) => k);
      const v = r[i];
      if (locked) {
        if (key) return `<span class="dd-val ok">${U.esc(b.o[b.a])}</span>`;
        if (v == null) return `<span class="dd-val none">sem resposta</span><span class="dd-fix">${U.esc(b.o[b.a])}</span>`;
        if (v === b.a) return `<span class="dd-val ok">${U.esc(b.o[v])}</span>`;
        return `<span class="dd-val bad">${U.esc(b.o[v])}</span><span class="dd-fix">${U.esc(b.o[b.a])}</span>`;
      }
      return `<select class="dd-select${v == null ? ' empty' : ''}" data-act="dd" data-i="${i}" aria-label="Lista suspensa ${i + 1}"><option value="">Selecione…</option>${order
        .map(k => `<option value="${k}"${v === k ? ' selected' : ''}>${U.esc(b.o[k])}</option>`)
        .join('')}</select>`;
    });
  }

  function match(q, item, locked, key, chip) {
    const r = item.resp || [];
    const vals = q.ch
      .map((c, ci) => `<button type="button" class="chip${chip === ci ? ' picked' : ''}" draggable="${locked ? 'false' : 'true'}" data-act="chip" data-c="${ci}"${locked ? ' disabled' : ''}>${U.esc(c)}</button>`)
      .join('');
    const rows = q.it.map((it, i) => {
      const v = key ? it[1] : r[i];
      let cls = 'slot' + (v == null ? ' empty' : ' filled');
      let fix = '';
      if (locked) {
        if (key) cls += ' ok';
        else if (v === it[1]) cls += ' ok';
        else {
          cls += ' bad';
          fix = `<div class="slot-fix">Correto: <b>${U.esc(q.ch[it[1]])}</b></div>`;
        }
      }
      const inner = v == null ? `<span class="slot-ph">${locked ? 'sem resposta' : 'Solte aqui'}</span>` : `<span class="chip in-slot">${U.esc(q.ch[v])}</span>`;
      const attrs = locked ? '' : ` data-act="slot" data-i="${i}" tabindex="0" role="button" aria-label="Lacuna ${i + 1}"`;
      return `<div class="m-row"><div class="${cls}"${attrs}>${inner}</div><div class="m-text">${U.fmt(it[0])}${fix}</div></div>`;
    });
    return `<div class="match${locked ? ' locked' : ''}"><div class="m-vals"><div class="aa-label">Valores</div><div class="chips">${vals}</div></div><div class="answer-area m-area"><div class="aa-label">Área de resposta</div>${rows.join('')}</div></div>`;
  }

  /* Bloco de correção com explicação e referência ao Microsoft Learn */
  R.feedback = (q, item, opts) => {
    opts = opts || {};
    const r = E.evaluate(q, item.resp);
    const st = E.answerState(q, item.resp);
    const k = AZ.skill[q.skill], s = AZ.sub[q.sub];
    let cls, head;
    if (opts.key) { cls = 'neutral'; head = 'Gabarito e explicação'; }
    else if (st === 'none') { cls = 'bad'; head = 'Não respondida'; }
    else if (r.ok) { cls = 'ok'; head = 'Correto'; }
    else if (r.e > 0) { cls = 'partial'; head = 'Parcialmente correto'; }
    else { cls = 'bad'; head = 'Incorreto'; }
    const plural = r.m > 1 ? 'pontos' : 'ponto';
    const pts = opts.key ? `${r.m} ${plural}` : `${r.e}/${r.m} ${plural}`;
    const learn = s.learn !== k.ref ? `<a href="${U.esc(s.learn)}" target="_blank" rel="noopener">Módulo no Microsoft Learn ↗</a>` : '';
    return `<div class="fb ${cls}">
      <div class="fb-head"><span class="fb-icon" aria-hidden="true"></span><b>${head}</b><span class="fb-pts">${pts}</span></div>
      <div class="fb-exp">${U.fmt(q.e)}</div>
      <div class="fb-meta"><span class="fb-skill">${U.esc(k.id)} · ${U.esc(k.name)}</span><span class="fb-links"><a href="${U.esc(k.ref)}" target="_blank" rel="noopener">Documentação oficial ↗</a>${learn}</span></div>
    </div>`;
  };

  /* Trecho curto do enunciado para listas */
  R.snippet = (q, max) => {
    max = max || 150;
    let t;
    if (q.t === 'yesno') t = q.st.map(s => s[0]).join(' / ');
    else {
      const parts = q.q.split(/\n\n+/).filter(p => !/^Selecione (a resposta|as respostas)/.test(p));
      /* questões "Solução: ... atende à meta?" se diferenciam pela solução proposta */
      t = (q.ns ? parts.slice(0, 2).join(' ') : parts[0]) || q.q;
    }
    t = t.replace(/\{\d+\}/g, '____').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  };
})();
