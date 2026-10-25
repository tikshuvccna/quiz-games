// Client side of "חידון קלאסי": the big screen runs the quiz (question, timer, answer chart, leaderboard),
// phones answer and see their own result.
(function () {
  const { esc } = U;
  const COLORS = ['#e9334f', '#1f73e0', '#e6a400', '#23a14a', '#8b5cf6', '#0fa3b8'];
  const TF = ['#1f73e0', '#e9334f'];
  const color = (q, i) => (q.type === 'tf' ? TF[i] : COLORS[i]);
  const shape = (q, i) => Art.shape(q.type === 'tf' ? i * 3 : i);
  let timerRaf = 0;

  // circular countdown on the host, bar on phones
  function runTimer(el, ms, total) {
    cancelAnimationFrame(timerRaf);
    if (!el) return;
    const end = performance.now() + ms;
    const ring = el.querySelector('.ring');
    const num = el.querySelector('b');
    const step = (now) => {
      if (!el.isConnected) return;
      const left = Math.max(0, end - now);
      num.textContent = Math.ceil(left / 1000);
      if (ring) ring.style.strokeDashoffset = String(276 * (1 - left / total));
      el.classList.toggle('low', left < 5000);
      if (left > 0) timerRaf = requestAnimationFrame(step);
    };
    timerRaf = requestAnimationFrame(step);
  }

  function tiles(q, rv) {
    const max = rv ? Math.max(1, ...rv.dist) : 1;
    return `<div class="cl-answers n${q.options.length} ${rv ? 'revealed' : ''}">${q.options
      .map((o, i) => {
        const ok = rv && rv.correct.includes(i);
        return `<div class="cl-ans ${rv ? (ok ? 'ok' : q.type === 'poll' ? '' : 'no') : ''}" style="--a:${color(q, i)};--i:${i}">
          ${shape(q, i)}<span class="t">${esc(o)}</span>${rv ? `<span class="cnt">${ok ? '✓ ' : ''}${rv.dist[i]}</span><i class="bar" style="--w:${(rv.dist[i] / max) * 100}%"></i>` : ''}</div>`;
      })
      .join('')}</div>`;
  }

  function media(q, rv) {
    if (q.type === 'pin') {
      const pins = rv ? rv.pins.map(([x, y, ok]) => `<i class="cl-pin ${ok ? 'ok' : ''}" style="left:${x}%;top:${y}%"></i>`).join('') + QMedia.pinZone(rv.target, 'cl-target') : '';
      return `<div class="cl-pinbox"><div class="cl-pinframe" id="pinFrame"><img src="${esc(q.image)}" alt="">${pins}</div></div>`;
    }
    if (q.type === 'puzzle') return `<div class="cl-pinbox"><div class="cl-pinframe cl-pz" id="pinFrame" data-pz="1"><img src="${esc(q.image)}" alt=""></div></div>`;
    // the question video plays on the big screen (with sound) while the class answers
    if (q.video && !rv) return QMedia.video(q.video, { autoplay: true, cls: 'cl-video' });
    // after the answer: the explanation picture (or the picture that was held back), with a zoom button
    const shown = rv && rv.afterImage ? rv.afterImage : q.image;
    if (rv && shown) return QMedia.picture(shown, { cls: 'cl-img', done: true, cover: `<button class="cl-zoom" data-zoom="${esc(shown)}" title="הגדלה">🔍</button>` });
    return q.image ? QMedia.picture(q.image, { reveal: q.reveal, revealSec: q.revealSec, cls: 'cl-img', done: !!rv }) : '';
  }

  function body(q, rv) {
    if (q.type === 'quiz' || q.type === 'tf' || q.type === 'poll') return tiles(q, rv);
    if (q.type === 'slider') {
      if (!rv) return `<div class="cl-slider"><span>${q.slider.min}</span><i></i><span>${q.slider.max}</span></div><div class="cl-hint">🎚️ בחרו מספר בטלפון</div>`;
      const pos = (v) => ((v - q.slider.min) / (q.slider.max - q.slider.min)) * 100;
      return `<div class="cl-slider rv"><span>${q.slider.min}</span><i>${rv.values.map((v) => `<b class="dot" style="left:${pos(v)}%"></b>`).join('')}<b class="ans" style="left:${pos(rv.answer)}%">${rv.answer}</b></i><span>${q.slider.max}</span></div>
        <div class="cl-hint">התשובה: <b>${rv.answer}</b>${rv.tol ? ` (±${rv.tol})` : ''} · ממוצע הכיתה: <b>${rv.avg ?? '—'}</b></div>`;
    }
    if (q.type === 'type') {
      if (!rv) return '<div class="cl-hint big">⌨️ הקלידו את התשובה בטלפון</div>';
      return `<div class="cl-hint">התשובה: <b>${esc(rv.correctText)}</b></div><div class="cl-typed">${rv.top.map((t) => `<span class="${t.ok ? 'ok' : ''}">${esc(t.text)} <b>${t.n}</b></span>`).join('') || '<span>אף אחד לא ענה</span>'}</div>`;
    }
    if (q.type === 'order') {
      const items = rv ? rv.items : q.items;
      return `<div class="cl-order ${rv ? 'rv' : ''}">${items.map((t, i) => `<span style="--i:${i}">${rv ? `<b>${i + 1}</b>` : ''}${esc(t)}</span>`).join(rv ? '' : '')}</div>${rv ? '' : '<div class="cl-hint">🧩 סדרו בטלפון בסדר הנכון</div>'}`;
    }
    if (q.type === 'pin') return rv ? `<div class="cl-hint">${rv.right} מתוך ${rv.answered} פגעו במקום הנכון</div>` : '<div class="cl-hint">📍 סמנו בטלפון את המקום הנכון</div>';
    if (q.type === 'puzzle') return rv ? `<div class="cl-hint">🧩 ${rv.right} מתוך ${rv.answered} הרכיבו את כל הפאזל · בממוצע <b>${rv.avgPct}%</b> מהחלקים במקום</div>` : `<div class="cl-hint">🧩 הרכיבו את הפאזל בטלפון (${q.puzzle.rows}×${q.puzzle.cols} חלקים)</div>`;
    return '';
  }

  Games.classic = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'classic',
        cls: 'classic-stage',
        stats: `<div class="stat" style="${U.pal('#8b5cf6')}"><span class="lbl">שאלה</span><span class="val" id="clNum"></span></div><div class="stat" style="${U.pal('#22c7e8')}"><span class="lbl">ענו</span><span class="val" id="clAns">0</span></div>`,
        stage: '<div id="clBody" class="cl-body"></div><button class="btn big cl-next" id="clNext">הבא ▶</button>',
      })) {
        app.classList.add('untimed');
        document.getElementById('clNext').onclick = () => { socket.emit('host:next'); U.sfx('pop'); };
      }
      U.hostTick(st, `${b.players} משתתפים${b.bonus ? ' · ⭐ הזדמנות שנייה' : ''}`);
      document.getElementById('clNum').textContent = b.q ? `${b.index + 1}/${b.total}` : '—';
      document.getElementById('clAns').textContent = `${b.answered || 0}/${b.players}`;
      const next = document.getElementById('clNext');
      const label = { ready: 'פתחו תשובות ▶', question: 'סיימו את הזמן ⏭', reveal: b.last ? 'לתוצאות 🏆' : 'ללוח המובילים ▶', board: 'לשאלה הבאה ▶', slide: 'הבא ▶' }[b.stage];
      next.textContent = label || 'הבא ▶';
      next.classList.toggle('hidden', !b.manual && b.stage !== 'slide');
      const key = `${b.stage}:${b.bonus}:${b.index}`;
      const box = document.getElementById('clBody');
      if (box.dataset.key === key) {
        // same stage: only live numbers change
        const n = document.getElementById('clCount');
        if (n) U.countTo(n, b.answered || 0, 300);
        return;
      }
      box.dataset.key = key;
      const q = b.q;
      if (!q) return;
      if (b.stage === 'ready') {
        box.innerHTML = `<div class="cl-ready">${b.bonus ? '<div class="cl-bonus">⭐ הזדמנות שנייה · ניקוד כפול</div>' : ''}<div class="cl-qnum">שאלה ${b.index + 1} מתוך ${b.total}</div><div class="cl-qtext big">${esc(q.text)}</div><div class="cl-readybar"><i></i></div></div>`;
        U.sfx('tick');
      } else if (b.stage === 'slide') {
        box.innerHTML = `<div class="cl-slide">${q.text ? `<div class="cl-qtext big">${esc(q.text)}</div>` : ''}${media(q)}</div>`;
      } else if (b.stage === 'question') {
        box.innerHTML = `<div class="cl-q">
          <div class="cl-qtext">${esc(q.text)}${q.points !== 1 ? `<span class="pts-chip p${q.points}">${q.points ? '×' + q.points : 'ללא ניקוד'}</span>` : ''}</div>
          <div class="cl-mid"><div class="cl-timer" id="clTimer"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="trk"/><circle cx="50" cy="50" r="44" class="ring"/></svg><b></b></div>
            <div class="cl-media">${media(q)}</div>
            <div class="cl-counter"><b id="clCount">0</b><span>תשובות</span></div></div>
          ${body(q)}</div>`;
        if (b.remain === null) document.querySelector('#clTimer b').textContent = '∞';
        else runTimer(document.getElementById('clTimer'), b.remain, (b.time || q.time) * 1000);
        U.sfx('go');
      } else if (b.stage === 'reveal') {
        const rv = b.reveal;
        box.innerHTML = `<div class="cl-q rv">
          <div class="cl-qtext">${esc(q.text)}</div>
          <div class="cl-mid"><div class="cl-score-sum"><b>${rv.right}</b><span>ענו נכון</span></div><div class="cl-media">${media(q, rv)}</div><div class="cl-counter"><b>${rv.answered}</b><span>ענו</span></div></div>
          ${body(q, rv)}
          ${rv.explain ? `<div class="cl-explain">💡 ${esc(rv.explain)}</div>` : ''}
          ${rv.boostPct !== undefined ? `<div class="cl-hint">🚀 ${rv.boostPct}% בחרו בוסט</div>` : ''}
          ${b.lines && b.lines.length ? `<div class="cl-lines">${b.lines.map((l, i) => `<span style="--i:${i}">${esc(l)}</span>`).join('')}</div>` : ''}</div>`;
        U.sfx(q.type === 'poll' ? 'pop' : 'good');
      } else if (b.stage === 'board' && this.boardHtml) {
        box.innerHTML = this.boardHtml(b);
        if (this.afterBoard) this.afterBoard(box, b);
      } else if (b.stage === 'board') {
        const teams = b.teams && b.teams.length ? `<div class="cl-teams">${b.teams.map((t, i) => `<div class="cl-team" style="${U.pal(t.color)};--w:${(t.score / Math.max(1, ...b.teams.map((x) => x.score))) * 100}%">${Art.mascot(i)}<span>${esc(t.name)}</span><b>${t.score}</b><i></i></div>`).join('')}</div>` : '';
        box.innerHTML = `<div class="cl-board"><h2>🏆 לוח המובילים</h2>${teams}
          <div class="cl-rows">${b.board.map((p, i) => `<div class="cl-row" style="--i:${i}">
            <span class="rk">${p.rank}</span>${U.avatar(p.name, p.team >= 0 && b.teams ? b.teams[p.team].color : null)}<span class="nm">${esc(p.name)}</span>
            ${p.streak >= 3 ? `<span class="stk">${Art.flame()}${p.streak}</span>` : ''}${p.prev && p.prev > p.rank ? `<span class="up">▲${p.prev - p.rank}</span>` : ''}<b class="sc" data-n="0">0</b></div>`).join('')}</div>
          <div class="cl-lines">${(b.lines || []).map((l, i) => `<span style="--i:${i}">${esc(l)}</span>`).join('')}</div></div>`;
        box.querySelectorAll('.cl-row .sc').forEach((el, i) => setTimeout(() => U.countTo(el, b.board[i].score, 900), 250 + i * 120));
      }
      QMedia.mount(box);
      const zb = box.querySelector('[data-zoom]');
      if (zb) zb.onclick = () => this.zoom(zb.dataset.zoom, b.reveal && b.reveal.explain, q.text);
      // pins sit on the picture's real proportions
      const pf = document.getElementById('pinFrame');
      if (pf) U.fitImage(pf, pf.querySelector('img'));
      if (pf && pf.dataset.pz && b.q.puzzle) {
        const img = pf.querySelector('img');
        const draw = () => { pf.insertAdjacentHTML('beforeend', QMedia.puzzleOutline(b.q.puzzle, b.q.image, img.naturalWidth || 400, img.naturalHeight || 300)); };
        if (img.complete && img.naturalWidth) draw();
        else img.addEventListener('load', draw, { once: true });
      }
    },

    // full-screen picture after the answer, so the teacher can explain it (click / Esc closes)
    zoom(src, explain, text) {
      document.getElementById('clZoom')?.remove();
      const z = document.createElement('div');
      z.id = 'clZoom';
      z.className = 'cl-zoomed';
      z.innerHTML = `<div class="clz-q">${esc(text || '')}</div><img src="${esc(src)}" alt="">${explain ? `<div class="clz-ex">💡 ${esc(explain)}</div>` : ''}<button class="clz-x">✕</button>`;
      document.body.appendChild(z);
      const close = () => { z.remove(); removeEventListener('keydown', key); };
      const key = (e) => { if (e.key === 'Escape') close(); };
      z.onclick = close;
      addEventListener('keydown', key);
    },

    hostEnded(app, st) {
      if (!U.view(app, 'classic-end')) return;
      const r = st.results.players;
      U.hostResults(app, st, {
        title: r[0] ? `${esc(r[0].name)} ניצח/ה!` : 'סוף החידון',
        sub: `חידון קלאסי · ${st.results.total} שאלות`,
        body: `<div class="end-visual">${U.podium(r.slice(0, 3).map((p) => ({ name: p.name, value: p.score, unit: 'נקודות' })))}</div>`,
        table: U.table(r, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
          ['נקודות', (p) => p.score],
          ['נכונות', (p) => `✅ ${p.correct}`],
          ['רצף שיא', (p) => `🔥 ${p.best}`],
        ]),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">⭐ ${you.score || 0}</span>${you.rank ? `<span class="hchip">#${you.rank}</span>` : ''}`;
    },

    playerPhase(app, you, ctx) {
      const ph = you.phase;
      const key = `${ph}:${you.qid}`;
      if (ph === 'c_question') {
        if (!ctx.setView(key)) return true;
        app.innerHTML = `${ctx.topBar()}${you.remain === null ? '' : `<div class="timebar"><i style="animation-duration:${you.remain}ms"></i></div>`}<div class="q-wrap" id="qw"></div>`;
        const send = (data) => ctx.act('answer', { ...data, qid: you.qid });
        QView.render(document.getElementById('qw'), you.question, {
          noVideo: true,
          meta: `<span>שאלה ${you.qnum} מתוך ${you.total}${you.bonus ? ' · ⭐ כפול' : ''}</span>`,
          // confidence / pyramid: after picking an answer, say how sure you are
          onAnswer: (data) => (you.conf ? this.askConf(app, you.conf, (v) => send({ ...data, conf: v })) : send(data)),
        });
        return true;
      }
      if (!ph.startsWith('c_')) return false;
      if (!ctx.setView(key)) return ctx.refreshTop(), true;
      let html = '';
      if (ph === 'c_ready') {
        html = `<div class="cl-p-ready"><div class="pill">שאלה ${you.qnum} מתוך ${you.total}${you.bonus ? ' · ⭐ ניקוד כפול' : ''}</div><div class="cl-p-big">התכוננו!</div>${you.text ? `<div class="q-card">${esc(you.text)}</div>` : ''}<div class="cl-readybar"><i></i></div></div>`;
      } else if (ph === 'c_locked') {
        html = `<div class="cl-p-wait"><div class="cl-p-icon">✔</div><h2>התשובה נשלחה!</h2><div class="muted">מחכים לשאר הכיתה<span class="dots"><i></i><i></i><i></i></span></div></div>`;
      } else if (ph === 'c_watch' || ph === 'c_watch_res') {
        html = `<div class="cl-p-wait"><div class="cl-p-icon">👀</div><h2>${you.bonus ? 'הזדמנות שנייה' : 'צפו במסך'}</h2><div class="muted">${you.bonus ? '5 השחקנים עם הכי מעט נקודות עונים עכשיו על שאלות בניקוד כפול' : 'השאלה הבאה תכף מגיעה'}</div><div class="pill">⭐ ${you.score} · מקום ${you.rank}</div></div>`;
      } else if (ph === 'c_slide') {
        html = `<div class="cl-p-wait"><div class="cl-p-icon">📺</div><h2>הסתכלו על המסך</h2></div>`;
      } else if (ph === 'c_result') {
        const r = you.res || {};
        const poll = r.ok === null;
        const cls = poll ? 'poll' : r.ok ? 'good' : 'bad';
        const title = poll ? 'תודה על ההצבעה!' : !r.answered ? '⏰ לא הספקתם' : r.ok ? 'נכון!' : 'לא נכון';
        html = `<div class="fb-screen ${cls}">
          ${poll ? '<div class="cl-p-icon">📊</div>' : `<div class="fb-icon">${r.ok ? Art.check() : Art.cross()}</div>`}
          <div class="fb-title">${title}</div>
          ${r.pts ? `<div class="cl-p-pts ${r.pts < 0 ? 'neg' : ''}">${r.pts > 0 ? '+' : ''}${r.pts}${this.ptsUnit ? ` <small>${this.ptsUnit}</small>` : ''}</div>` : ''}
          ${r.conf === 1 && you.stage !== undefined && !this.pyramidMode ? `<div class="pill">🚀 ${r.ok ? 'הבוסט הצליח!' : 'הבוסט נכשל'}</div>` : ''}
          ${r.ok && r.streak >= 2 ? `<div class="streak">${Art.flame()} רצף ${r.streak}</div>` : ''}
          ${!r.ok && !poll && you.correctText ? `<div class="fb-answer">התשובה הנכונה<b>${esc(you.correctText)}</b></div>` : ''}
          ${you.afterImage ? `<img class="fb-pic" src="${esc(you.afterImage)}" alt="">` : ''}
          ${you.explain ? `<div class="fb-explain">${esc(you.explain)}</div>` : ''}
          <div class="fb-note">מקום ${you.rank}${you.above ? (you.above.gap > 0 ? ` · עוד ${you.above.gap} ${this.ptsUnit || 'נק׳'} כדי לעקוף את ${esc(you.above.name)}` : ` · צמוד ל־${esc(you.above.name)}!`) : you.rank === 1 ? ' · אתם בראש! 👑' : ''}</div></div>`;
        if (!poll) {
          U.sfx(r.ok ? 'good' : 'bad');
          if (navigator.vibrate) navigator.vibrate(r.ok ? 20 : [40, 40, 40]);
        }
      } else return false;
      app.innerHTML = `${ctx.topBar()}${html}`;
      if (ph === 'c_result' && you.res && you.res.ok) {
        const s = app.querySelector('.fb-screen');
        const rc = s.getBoundingClientRect();
        U.burst(s, rc.width / 2, rc.height * 0.3, ['#fff', '#ffd23f', '#b6ffd9'], 18, 140);
      }
      return true;
    },

    askConf(app, opts, done) {
      const box = document.getElementById('qw');
      box.classList.remove('sent'); // the answer step marked it; the confidence step starts fresh
      box.innerHTML = `<div class="conf-ask"><h2>כמה אתם בטוחים?</h2><div class="conf-opts n${opts.length}">${opts.map((o) => `<button class="conf-opt" data-v="${o.v}"><span class="ce">${o.emoji}</span><b>${esc(o.label)}</b><small>${esc(o.desc)}</small></button>`).join('')}</div></div>`;
      box.querySelector('.conf-opts').onclick = (e) => {
        const b = e.target.closest('.conf-opt');
        if (!b || box.classList.contains('sent')) return;
        box.classList.add('sent');
        b.classList.add('picked');
        U.sfx('pop');
        done(Number(b.dataset.v));
      };
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results.players;
      const idx = r.findIndex((p) => p.name === you.name);
      const mine = r[idx] || { score: 0, correct: 0, best: 0 };
      return U.playerResult({
        win: idx === 0,
        title: idx === 0 ? 'ניצחתם! 🏆' : idx < 3 ? 'על הפודיום!' : 'כל הכבוד!',
        big: `${mine.score}`,
        bigLabel: 'נקודות',
        lines: [`🏅 מקום ${idx + 1} מתוך ${r.length}`, `✅ ${mine.correct} תשובות נכונות`, `🔥 רצף שיא ${mine.best}`],
      });
    },
  };
})();
