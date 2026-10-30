// Client side of "תרגול ולמידה": the big screen shows everybody's progress (and who is stuck); each phone studies alone:
// flashcards, practice until mastery (a question comes back until it was answered right twice) or a test with a summary.
(function () {
  const { esc } = U;
  const MODE = { mastery: 'תרגול עד שליטה', flashcards: 'כרטיסיות', test: 'מבחן' };

  Art.covers.study = () => `
    <defs><linearGradient id="sd-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b1a8f"/><stop offset="1" stop-color="#14b8a6"/></linearGradient></defs>
    <rect width="160" height="100" fill="url(#sd-bg)"/>
    <g transform="translate(80 54)">
      <rect x="-40" y="-30" width="64" height="46" rx="7" fill="#fff" opacity=".45" transform="rotate(-14)"/>
      <rect x="-34" y="-30" width="64" height="46" rx="7" fill="#ffe27a" transform="rotate(-5)"/>
      <rect x="-26" y="-30" width="64" height="46" rx="7" fill="#fff" stroke="#1e1145" stroke-width="3" transform="rotate(6)"/>
      <g transform="rotate(6)"><rect x="-14" y="-18" width="40" height="5" rx="2.5" fill="#8b5cf6"/><rect x="-14" y="-8" width="30" height="5" rx="2.5" fill="#c4b5fd"/><rect x="-14" y="2" width="22" height="5" rx="2.5" fill="#c4b5fd"/></g>
    </g>
    <circle cx="124" cy="30" r="16" fill="#2ee59d" stroke="#1e1145" stroke-width="3"/><path d="M116 30 l6 6 l11 -12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M28 24 l3 7 l8 1 l-6 5 l2 8 l-7 -4 l-7 4 l2 -8 l-6 -5 l8 -1z" fill="#ffd23f" stroke="#1e1145" stroke-width="2" stroke-linejoin="round"/>`;

  const bar = (you) => `<div class="std-prog"><i style="width:${you.pct}%"></i><span>${you.done}/${you.total}</span></div>`;

  Games.study = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'study',
        cls: 'study-stage',
        stats: `<div class="stat" style="${U.pal('#8b5cf6')}"><span class="lbl">ממוצע</span><span class="val" id="stAvg"></span></div><div class="stat" style="${U.pal('#22c7e8')}"><span class="lbl">סיימו</span><span class="val" id="stFin"></span></div>`,
        stage: '<div id="stBody" class="std-body"></div>',
      })) app.classList.add('untimed');
      U.hostTick(st, `${MODE[b.mode]} · ${b.total} שאלות`);
      document.getElementById('stAvg').textContent = b.avg + '%';
      document.getElementById('stFin').textContent = `${b.finished}/${b.players.length}`;
      const sig = JSON.stringify(b.players.map((p) => [p.name, p.pct, p.finished, p.stuck, p.wrong, p.again, p.connected]));
      const box = document.getElementById('stBody');
      if (box.dataset.sig === sig) return;
      box.dataset.sig = sig;
      box.innerHTML = `<div class="std-head"><b>${MODE[b.mode]}</b><span>${b.stuck ? `🆘 ${b.stuck} תקועים: כדאי להגיע אליהם` : 'כל אחד לומד בקצב שלו'}</span></div>
        <div class="std-grid">${b.players.map((p) => `<div class="std-p ${p.finished ? 'fin' : ''} ${p.stuck ? 'stuck' : ''} ${p.connected ? '' : 'off'}">
          ${U.avatar(p.name)}<div class="std-pn"><b>${esc(p.name)}</b>
            <div class="std-bar"><i style="width:${p.pct}%"></i></div>
            <small>${p.finished ? '✅ סיים/ה' : p.stuck ? '🆘 תקוע/ה' : p.connected ? 'לומד/ת' : 'מנותק/ת'} · ${p.done}/${b.total}${b.mode === 'flashcards' ? (p.again ? ` · 🔁 ${p.again}` : '') : p.wrong ? ` · ✗ ${p.wrong}` : ''}</small></div></div>`).join('')}</div>`;
    },

    hostEnded(app, st) {
      if (!U.view(app, 'study-end')) return;
      const r = st.results.players;
      const avg = r.length ? Math.round(r.reduce((s, p) => s + p.pct, 0) / r.length) : 0;
      U.hostResults(app, st, {
        title: 'סיימנו ללמוד!',
        sub: `${MODE[st.results.mode]} · ${st.results.total} שאלות`,
        body: `<div class="end-visual"><div class="cl-learn-sum"><b>${avg}%</b><span>התקדמות ממוצעת של הכיתה</span></div></div>`,
        table: U.table(r, [
          ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
          ['התקדמות', (p) => `${p.pct}%${p.finished ? ' ✅' : ''}`],
          st.results.mode === 'flashcards' ? ['חזרות', (p) => `🔁 ${p.again}`] : ['נכונות', (p) => `✅ ${p.correct}`],
          st.results.mode === 'flashcards' ? ['ידעו', (p) => p.done] : ['טעויות', (p) => p.wrong],
        ]),
      });
    },

    // ---------- player ----------
    hud(you) {
      return you.total ? `<span class="hchip">📚 ${you.done}/${you.total}</span>` : '';
    },

    playerPhase(app, you, ctx) {
      const ph = you.phase;
      if (!ph.startsWith('st_')) return false;
      const key = `${ph}:${you.qid}`;
      if (ph === 'st_question') {
        if (!ctx.setView(key)) return true;
        app.innerHTML = `${ctx.topBar()}${bar(you)}<div class="q-wrap" id="qw"></div>`;
        QView.render(document.getElementById('qw'), you.question, {
          noSplash: true,
          meta: `<span>${MODE[you.mode]}</span>`,
          onAnswer: (data) => ctx.act('answer', { ...data, qid: you.qid }),
        });
        return true;
      }
      if (!ctx.setView(key)) return ctx.refreshTop(), true;

      if (ph === 'st_card') {
        const c = you.card;
        app.innerHTML = `${ctx.topBar()}${bar(you)}<div class="std-wrap">
          <div class="std-card" id="stc"><div class="std-face front">${c.image ? `<img src="${esc(c.image)}" alt="">` : ''}<div class="std-t">${esc(c.text)}</div><small>לחצו להפוך ↻</small></div>
            <div class="std-face back"><div class="std-lbl">התשובה</div><div class="std-t">${esc(c.back)}</div>${c.explain ? `<div class="std-ex">💡 ${esc(c.explain)}</div>` : ''}${c.afterImage ? `<img src="${esc(c.afterImage)}" alt="">` : ''}</div></div>
          <div class="std-btns" id="stb"><button class="std-again" data-k="0">🔁 עוד פעם</button><button class="std-know" data-k="1">✅ ידעתי</button></div></div>`;
        const card = document.getElementById('stc');
        const btns = document.getElementById('stb');
        card.onclick = () => { card.classList.toggle('flipped'); btns.classList.toggle('show', card.classList.contains('flipped')); U.sfx('tick'); };
        btns.onclick = (e) => {
          const b = e.target.closest('[data-k]');
          if (!b || btns.classList.contains('sent')) return;
          btns.classList.add('sent');
          U.sfx(b.dataset.k === '1' ? 'good' : 'pop');
          ctx.act('card', { known: b.dataset.k === '1', qid: you.qid });
        };
        return true;
      }

      let html = '';
      if (ph === 'st_feedback') {
        const l = you.last;
        html = `<div class="std-wrap std-fb ${l.ok ? 'ok' : 'no'}">
          <div class="fb-icon">${l.ok ? Art.check() : Art.cross()}</div>
          <div class="fb-title">${l.ok ? (l.mastered ? '🏆 שלטתם בשאלה!' : 'נכון!') : 'לא נכון'}</div>
          ${l.ok ? (l.mastered ? '' : `<div class="pill">עוד ${l.needed} תשובה נכונה כדי לשלוט בשאלה</div>`) : `<div class="fb-answer">התשובה הנכונה<b>${esc(l.correctText)}</b></div><div class="pill">השאלה תחזור עוד מעט</div>`}
          ${l.afterImage ? `<img class="fb-pic" src="${esc(l.afterImage)}" alt="">` : ''}
          ${l.explain ? `<div class="fb-explain">${esc(l.explain)}</div>` : ''}
          <button class="btn big" id="stn">הבא ▶</button></div>`;
      } else if (ph === 'st_done') {
        const mistakes = (you.review || []).filter((r) => !r.ok);
        const test = you.mode === 'test';
        html = `<div class="std-wrap std-done"><div class="std-trophy">${test ? '📝' : '🎉'}</div>
          <h2>${test ? 'סיימתם את המבחן!' : you.mode === 'flashcards' ? 'עברתם על כל הכרטיסיות!' : 'שלטתם בכל השאלות!'}</h2>
          ${test ? `<div class="std-score"><b>${you.correct}</b><span>מתוך ${you.total} נכונות · ${Math.round((you.correct / Math.max(1, you.total)) * 100)}%</span></div>` : `<div class="pill">${you.mode === 'flashcards' ? `🔁 חזרתם על כרטיסיות ${you.again} פעמים` : `✅ ${you.correct} נכונות · ✗ ${you.wrong} טעויות בדרך`}</div>`}
          ${test ? (mistakes.length ? `<div class="std-rev"><h3>מה כדאי לחזור עליו</h3>${mistakes.map((r) => `<div class="std-r"><b>${esc(r.q)}</b><div class="a">✓ ${esc(r.answer)}</div><div class="w">✗ ${esc(r.chosen)}</div>${r.explain ? `<div class="e">💡 ${esc(r.explain)}</div>` : ''}</div>`).join('')}</div>` : '<div class="pill">בלי טעויות! מושלם 👏</div>') : ''}
          <div class="muted">מחכים לשאר הכיתה<span class="dots"><i></i><i></i><i></i></span></div></div>`;
      } else return false;
      app.innerHTML = `${ctx.topBar()}${bar(you)}${html}`;
      const n = document.getElementById('stn');
      if (n) n.onclick = () => { n.disabled = true; ctx.act('next', { qid: you.qid }); };
      if (ph === 'st_done') U.sfx('good');
      return true;
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results.players;
      const me = r.find((p) => p.name === you.name) || { pct: 0, done: 0 };
      return U.playerResult({
        win: me.finished,
        title: me.finished ? 'כל הכבוד על הלמידה!' : 'הלמידה הסתיימה',
        big: `${me.pct}%`,
        bigLabel: 'התקדמות',
        lines: [`📚 ${me.done} מתוך ${you.results.total} שאלות`, `✅ ${me.correct} נכונות`],
      });
    },
  };
})();
