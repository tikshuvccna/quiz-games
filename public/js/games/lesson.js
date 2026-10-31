// Client side of "שיעור": the classic quiz's screens plus a presenter's controls on the big screen (back, outline, keys,
// a live "did they understand?" meter) and the 👍 🤔 🙋 buttons on every phone during slides.
(function () {
  const { esc } = U;
  const C = Games.classic;
  let outlineOpen = false;
  let st0 = null; // the latest host state, for the keyboard handler

  Art.covers.lesson = () => `
    <defs><linearGradient id="ls-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b1a7a"/><stop offset="1" stop-color="#ff4fa3"/></linearGradient></defs>
    <rect width="160" height="100" fill="url(#ls-bg)"/>
    <rect x="28" y="14" width="104" height="62" rx="6" fill="#fff" stroke="#1e1145" stroke-width="3"/>
    <rect x="38" y="24" width="52" height="7" rx="3.5" fill="#8b5cf6"/><rect x="38" y="38" width="40" height="5" rx="2.5" fill="#c4b5fd"/><rect x="38" y="48" width="46" height="5" rx="2.5" fill="#c4b5fd"/><rect x="38" y="58" width="32" height="5" rx="2.5" fill="#c4b5fd"/>
    <circle cx="106" cy="48" r="17" fill="#ffd23f" stroke="#1e1145" stroke-width="2.5"/><path d="M98 48 l6 6 l11 -12" fill="none" stroke="#1e1145" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M70 76 h20 l5 12 h-30z" fill="#1e1145"/><rect x="60" y="86" width="40" height="5" rx="2.5" fill="#1e1145"/>
    <text x="14" y="30" font-size="16">👍</text><text x="134" y="30" font-size="16">🙋</text>`;

  const go = (cmd, arg) => socket.emit('host:cmd', { cmd, arg });

  function drawOutline(b) {
    let box = document.getElementById('lsOutline');
    if (!outlineOpen) return box && box.remove();
    if (!box) {
      box = document.createElement('div');
      box.id = 'lsOutline';
      box.className = 'ls-outline';
      document.body.appendChild(box);
      box.onclick = (e) => {
        const li = e.target.closest('[data-i]');
        if (li) { go('goto', Number(li.dataset.i)); outlineOpen = false; drawOutline(b); }
        if (e.target.closest('[data-close]')) { outlineOpen = false; drawOutline(b); }
      };
    }
    const sig = b.lesson.outline.length + ':' + b.index;
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    box.innerHTML = `<div class="ls-o-head"><b>מבנה השיעור</b><button data-close>✕</button></div><ol>${b.lesson.outline.map((t, i) => `<li data-i="${i}" class="${i === b.index ? 'cur' : ''}"><span>${i + 1}</span>${esc(t)}</li>`).join('')}</ol>`;
    const cur = box.querySelector('li.cur');
    if (cur) cur.scrollIntoView({ block: 'center' });
  }

  // a QR code and a link for the teacher's own phone: notes, what is next, the class's reactions, next / back
  function presenterLink(st) {
    document.getElementById('lsPresBox')?.remove();
    let tok = '';
    try { tok = (JSON.parse(sessionStorage.getItem('host') || '{}') || {}).hostToken || ''; } catch {}
    const base = typeof joinUrl === 'string' && joinUrl ? joinUrl.replace(/\/\?pin=.*$/, '') : location.origin;
    const url = `${base}/presenter.html?pin=${encodeURIComponent(st.pin)}&t=${encodeURIComponent(tok)}`;
    const m = document.createElement('div');
    m.className = 'modal';
    m.id = 'lsPresBox';
    m.innerHTML = `<div class="modal-card" style="max-width:420px;text-align:center"><h3>📱 מסך מציג</h3>
      <p>סרקו בטלפון שלכם: תראו את ההערות, מה הבא, איך הכיתה מגיבה, וכפתורי הבא / קודם. התלמידים לא רואים את זה.</p>
      <div id="lsPresQr" style="width:220px;margin:0 auto;background:#fff;border-radius:12px;padding:8px"></div>
      <input class="input sm" readonly dir="ltr" value="${U.esc(url)}" style="margin-top:10px;width:100%" onclick="this.select()">
      <p class="muted" style="font-size:.85rem">הקישור שולט בשיעור: אל תשתפו אותו עם התלמידים.</p>
      <button class="btn" id="lsPresX">סגירה</button></div>`;
    document.body.appendChild(m);
    m.querySelector('#lsPresX').onclick = () => m.remove();
    m.onclick = (e) => { if (e.target === m) m.remove(); };
    fetch('/qr?text=' + encodeURIComponent(url)).then((r) => r.text()).then((svg) => { const q = m.querySelector('#lsPresQr'); if (q) q.innerHTML = svg; }).catch(() => {});
  }

  // the presenter's controls: back, outline, and the live meter while a slide is on
  function chrome(app, st) {
    const b = st.board;
    st0 = st;
    let bar = document.getElementById('lsBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'lsBar';
      bar.className = 'ls-bar';
      bar.innerHTML = '<button id="lsPrev" title="שלב קודם (←)">◀ קודם</button><button id="lsOut" title="מבנה השיעור (O)">📑 מבנה</button><button id="lsPres" title="מסך מציג בטלפון או במחשב נייד, עם ההערות שלכם">📱 מסך מציג</button><div class="ls-meter" id="lsMeter"></div><span class="ls-keys">רווח / → הבא · ← קודם</span>';
      app.appendChild(bar);
      bar.querySelector('#lsPrev').onclick = () => go('prev');
      bar.querySelector('#lsPres').onclick = () => presenterLink(st0);
      bar.querySelector('#lsOut').onclick = () => { outlineOpen = !outlineOpen; drawOutline(st0.board); };
    }
    bar.querySelector('#lsPrev').disabled = b.index <= 0;
    const lbl = document.querySelector('#clNum');
    if (lbl) lbl.parentElement.querySelector('.lbl').textContent = 'שלב';
    const m = bar.querySelector('#lsMeter');
    const r = b.lesson.reacts;
    if (b.stage === 'slide' && r) {
      const bad = r.unsure + r.ask;
      m.className = 'ls-meter on' + (r.n >= 2 && bad / Math.max(1, r.n) >= 0.3 ? ' warn' : '');
      m.innerHTML = `<span>👍 ${r.got}</span><span>🤔 ${r.unsure}</span><span>🙋 ${r.ask}</span>${r.n >= 2 && bad / r.n >= 0.3 ? '<b>⚠️ חלק מהכיתה לא איתך</b>' : ''}`;
    } else m.className = 'ls-meter';
    drawOutline(b);
  }

  // keys: → / space / PageDown = next, ← / PageUp = back, O = outline
  if (!window.__lessonKeys) {
    window.__lessonKeys = true;
    addEventListener('keydown', (e) => {
      if (!st0 || st0.gameId !== 'lesson' || st0.phase !== 'playing') return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || ''))) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); socket.emit('host:next'); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go('prev'); }
      else if (e.key === 'o' || e.key === 'O') { outlineOpen = !outlineOpen; drawOutline(st0.board); }
      else if (e.key === 'Escape' && outlineOpen) { outlineOpen = false; drawOutline(st0.board); }
    });
  }

  const L = Object.assign({}, C, {
    hostPlaying(app, st) {
      C.hostPlaying.call(this, app, st);
      chrome(app, st);
    },

    hostEnded(app, st) {
      document.getElementById('lsOutline')?.remove();
      outlineOpen = false;
      st0 = null;
      const steps = (st.results.lesson && st.results.lesson.steps) || [];
      // what to revisit: slides where many were lost, and checks that most got wrong
      const lost = steps.filter((s) => s.kind === 'slide' && s.got + s.unsure + s.ask >= 2 && (s.unsure + s.ask) / (s.got + s.unsure + s.ask) >= 0.3);
      const hard = steps.filter((s) => s.kind === 'activity' && s.pct !== null && s.pct < 60);
      const acts = steps.filter((s) => s.kind === 'activity');
      const r = st.results.players;
      if (!U.view(app, 'lesson-end')) return;
      U.hostResults(app, st, {
        title: 'סיום השיעור',
        sub: `${st.results.total} שלבים · ${acts.length} פעילויות · ${r.length} תלמידים`,
        body: `<div class="ls-sum">
          <section><h3>🔁 כדאי לחזור על</h3>${lost.length || hard.length ? `<ul>${lost.map((s) => `<li>🖼️ <b>${esc(s.title)}</b><small>🤔 ${s.unsure} · 🙋 ${s.ask} מתוך ${s.got + s.unsure + s.ask} שהגיבו</small></li>`).join('')}${hard.map((s) => `<li>🎯 <b>${esc(s.title)}</b><small>רק ${s.pct}% ענו נכון</small></li>`).join('')}</ul>` : '<p>הכיתה הייתה איתך לאורך כל השיעור 👏</p>'}</section>
          <section><h3>🙋 מעורבות</h3>${acts.length ? `<ul>${acts.map((s) => `<li><b>${esc(s.title)}</b><small>${s.answered} ענו${s.pct !== null ? ` · ${s.pct}% נכון` : ''}</small></li>`).join('')}</ul>` : '<p>לא היו פעילויות בשיעור.</p>'}</section></div>`,
        table: st.results.style === 'learn' ? '' : U.table(r, [['#', (p, i) => i + 1], ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`], ['נקודות', (p) => p.score], ['נכונות', (p) => `✅ ${p.correct}`]]),
      });
    },

    // ---------- phones ----------
    playerPhase(app, you, ctx) {
      if (you.phase !== 'c_slide') return C.playerPhase.call(this, app, you, ctx);
      const key = `c_slide:${you.qid}:${you.react || ''}`;
      if (!ctx.setView(key)) return ctx.refreshTop(), true;
      const q = you.q || {};
      // an HTML activity the teacher also put on the phones: the student can try it too
      if (q.html && q.html.phones && window.Slides) {
        app.innerHTML = `${ctx.topBar()}<div class="ls-p ls-p-html"><div class="ls-hframe">${Slides.htmlFrame(q.html, q.text)}</div><div class="ls-bs ls-bs-sm">${[['got', '👍', 'הבנתי'], ['unsure', '🤔', 'לא בטוח'], ['ask', '🙋', 'שאלה']].map(([v, i, t]) => `<button class="ls-b ${you.react === v ? 'on' : ''}" data-v="${v}"><i>${i}</i><span>${t}</span></button>`).join('')}</div></div>`;
        app.querySelector('.ls-bs').onclick = (e) => { const b = e.target.closest('.ls-b'); if (!b) return; U.sfx('pop'); ctx.act('react', { value: b.dataset.v, qid: you.qid }); };
        return true;
      }
      const label = q.text || (q.bullets && q.bullets[0]) || '';
      const B = (v, ico, t) => `<button class="ls-b ${you.react === v ? 'on' : ''}" data-v="${v}"><i>${ico}</i><span>${t}</span></button>`;
      app.innerHTML = `${ctx.topBar()}<div class="ls-p"><div class="ls-pic">📺</div><div class="ls-pt">${label ? esc(label) : 'הסתכלו על המסך'}</div><div class="ls-pq">איך זה הולך?</div>
        <div class="ls-bs">${B('got', '👍', 'הבנתי')}${B('unsure', '🤔', 'לא בטוח')}${B('ask', '🙋', 'יש לי שאלה')}</div>
        <div class="muted">${you.react ? 'תודה! אפשר לשנות בכל רגע' : 'לחצו כדי לספר למורה'}</div></div>`;
      app.querySelector('.ls-bs').onclick = (e) => {
        const b = e.target.closest('.ls-b');
        if (!b) return;
        U.sfx('pop');
        if (navigator.vibrate) navigator.vibrate(10);
        ctx.act('react', { value: b.dataset.v, qid: you.qid });
      };
      return true;
    },
  });

  Games.lesson = L;
})();
