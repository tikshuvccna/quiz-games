// "קשתות": targets slide across the phone; tap on one as it passes. Taps are sent with their position and time.
FfaBoard.make({
  id: 'archery',
  emoji: '🎯',
  cls: 'ar-room',
  endTitle: 'קשתים מעולים!',
  cover: () => `<rect width="160" height="100" fill="#8fd3ff"/><rect y="62" width="160" height="38" fill="#5fbf63"/>
    ${[[40, 40, 22], [112, 34, 18]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#c0392b" stroke-width="3"/><circle cx="${x}" cy="${y}" r="${r * 0.66}" fill="#ff4d6d"/><circle cx="${x}" cy="${y}" r="${r * 0.33}" fill="#fff"/><circle cx="${x}" cy="${y}" r="${r * 0.12}" fill="#ff4d6d"/>`).join('')}
    <path d="M70 94 L96 58" stroke="#6a4a2a" stroke-width="3"/><path d="M96 58 l-3 8 l7 -3Z" fill="#555"/>`,
  play(app, you, ctx, done) {
    const rd = you.round;
    app.innerHTML = `${ctx.topBar()}<div class="fb-play"><div class="fb-timer"><i style="animation-duration:${rd.ms}ms"></i></div><div class="fb-judge" id="arj"></div>
      <div class="ar-field" id="arf"><div class="ar-hint">הקישו על המטרה כשהיא חולפת</div></div></div>`;
    const field = app.querySelector('#arf');
    const judge = app.querySelector('#arj');
    const t0 = performance.now();
    const taps = [];
    const els = rd.targets.map((tg) => {
      const el = document.createElement('div');
      el.className = 'ar-target';
      el.style.top = tg.y * 100 + '%';
      el.style.display = 'none';
      el.innerHTML = '<i></i><i></i><i></i>';
      field.appendChild(el);
      return el;
    });
    let raf = 0;
    let ended = false;
    const finish = () => { if (!ended) { ended = true; cancelAnimationFrame(raf); done({ taps }); } };
    const loop = (now) => {
      if (ended || !field.isConnected) return;
      const t = now - t0;
      rd.targets.forEach((tg, i) => {
        const k = (t - tg.t) / tg.ms;
        const el = els[i];
        if (k < 0 || k > 1 || el.dataset.hit) { el.style.display = 'none'; return; }
        el.style.display = 'block';
        const x = tg.dir > 0 ? k : 1 - k;
        el.style.left = x * 100 + '%';
      });
      raf = requestAnimationFrame(loop);
    };
    // the server judges by the time since the round began: use the same clock for taps
    raf = requestAnimationFrame(loop);
    field.addEventListener('pointerdown', (e) => {
      if (ended) return;
      e.preventDefault();
      const r = field.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      const t = performance.now() - t0;
      taps.push([+x.toFixed(3), +y.toFixed(3), Math.round(t)]);
      const mark = document.createElement('i');
      mark.className = 'ar-mark';
      mark.style.left = x * 100 + '%';
      mark.style.top = y * 100 + '%';
      field.appendChild(mark);
      setTimeout(() => mark.remove(), 500);
      // local feedback only; the server decides
      const hit = rd.targets.findIndex((tg) => { const k = (t - tg.t) / tg.ms; if (k < 0 || k > 1) return false; const tx = tg.dir > 0 ? k : 1 - k; return Math.hypot((x - tx) * 0.55, y - tg.y) <= 0.11; });
      if (hit >= 0) { judge.textContent = 'בול! 🎯'; judge.style.color = '#ffd23f'; U.sfx('coin'); els[hit].dataset.hit = '1'; } else { judge.textContent = 'החטאה'; judge.style.color = '#ff6b8a'; U.sfx('tick'); }
      judge.classList.remove('pop');
      void judge.offsetWidth;
      judge.classList.add('pop');
    });
    setTimeout(finish, rd.ms);
  },
});
