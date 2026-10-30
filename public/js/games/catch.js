// "תפוס את הפירות": drag the basket under the falling fruit; the rotten ones cost points.
FfaBoard.make({
  id: 'catch',
  emoji: '🧺',
  cls: 'ct-room',
  endTitle: 'מלכי הסל!',
  cover: () => `<rect width="160" height="100" fill="#bfe8ff"/><rect y="74" width="160" height="26" fill="#6cc94a"/>
    <circle cx="44" cy="28" r="9" fill="#ff4d6d" stroke="#fff" stroke-width="2"/><circle cx="92" cy="18" r="9" fill="#ffb347" stroke="#fff" stroke-width="2"/><circle cx="124" cy="40" r="9" fill="#9b5de5" stroke="#fff" stroke-width="2"/>
    <path d="M52 66 h56 l-8 22 h-40Z" fill="#c8893a" stroke="#6a4a1a" stroke-width="3"/><path d="M58 74 h44 M56 80 h48" stroke="#6a4a1a" stroke-width="2"/>`,
  play(app, you, ctx, done) {
    const rd = you.round;
    app.innerHTML = `${ctx.topBar()}<div class="fb-play"><div class="fb-timer"><i style="animation-duration:${rd.ms}ms"></i></div><div class="fb-info" id="cti">🍎 0</div><div class="ct-wrap" id="ctw"><canvas id="ctc"></canvas></div></div>`;
    const wrap = app.querySelector('#ctw');
    const cv = app.querySelector('#ctc');
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    const basket = { x: W / 2, w: 74 };
    let items = [];
    let caught = 0;
    let rotten = 0;
    let t = 0;
    let spawn = 0.4;
    let ended = false;
    let last = performance.now();
    const FRUIT = ['🍎', '🍊', '🍌', '🍇', '🍐'];
    const move = (e) => { const r = wrap.getBoundingClientRect(); basket.x = Math.max(basket.w / 2, Math.min(W - basket.w / 2, e.clientX - r.left)); };
    wrap.addEventListener('pointerdown', (e) => { e.preventDefault(); move(e); });
    wrap.addEventListener('pointermove', move);
    const kd = (e) => { if (e.key === 'ArrowLeft') basket.x = Math.max(basket.w / 2, basket.x - 40); if (e.key === 'ArrowRight') basket.x = Math.min(W - basket.w / 2, basket.x + 40); };
    document.addEventListener('keydown', kd);
    const cleanup = () => document.removeEventListener('keydown', kd);
    const finish = () => { if (ended) return; ended = true; cleanup(); done({ caught, rotten }); };
    const by = H - 46;
    function frame(now) {
      if (ended) return;
      if (!app.contains(cv)) { ended = true; cleanup(); return; }
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      t += dt;
      spawn -= dt;
      if (spawn <= 0) { items.push({ x: 20 + Math.random() * (W - 40), y: -20, v: (150 + Math.random() * 110) * rd.speed, bad: Math.random() < 0.22, e: FRUIT[Math.floor(Math.random() * FRUIT.length)] }); spawn = 0.5 / rd.speed + Math.random() * 0.25; }
      items.forEach((it) => (it.y += it.v * dt));
      for (const it of items) {
        if (!it.gone && it.y > by - 8 && it.y < by + 22 && Math.abs(it.x - basket.x) < basket.w / 2 + 6) {
          it.gone = true;
          if (it.bad) { rotten++; U.sfx('bad'); if (navigator.vibrate) navigator.vibrate(40); } else { caught++; U.sfx('coin'); }
          app.querySelector('#cti').textContent = `🍎 ${caught}${rotten ? ` · 🤢 ${rotten}` : ''}`;
        }
      }
      items = items.filter((it) => !it.gone && it.y < H + 30);
      draw();
      if (t >= rd.ms / 1000) return finish();
      requestAnimationFrame(frame);
    }
    function draw() {
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#8fd3ff');
      sky.addColorStop(1, '#dff3ff');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#6cc94a';
      g.fillRect(0, H - 30, W, 30);
      g.font = '30px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      g.textAlign = 'center';
      for (const it of items) g.fillText(it.bad ? '🤢' : it.e, it.x, it.y);
      g.fillStyle = '#c8893a';
      g.strokeStyle = '#6a4a1a';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(basket.x - basket.w / 2, by); g.lineTo(basket.x + basket.w / 2, by); g.lineTo(basket.x + basket.w / 2 - 10, by + 30); g.lineTo(basket.x - basket.w / 2 + 10, by + 30); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(basket.x - basket.w / 2 + 6, by + 10); g.lineTo(basket.x + basket.w / 2 - 6, by + 10); g.moveTo(basket.x - basket.w / 2 + 8, by + 20); g.lineTo(basket.x + basket.w / 2 - 8, by + 20); g.stroke();
    }
    draw();
    requestAnimationFrame((n) => { last = n; frame(n); });
  },
});
