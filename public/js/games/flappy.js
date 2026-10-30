// "ציפור מעופפת": a 10-second flappy-bird round. Tap to flap. The phone plays it and reports the gaps passed.
FfaBoard.make({
  id: 'flappy',
  emoji: '🐦',
  cls: 'fl-room',
  endTitle: 'מלכי השמיים!',
  cover: () => `<rect width="160" height="100" fill="#7fd3ff"/><rect x="90" y="0" width="22" height="34" fill="#4cc38a" stroke="#1d5a3c" stroke-width="3"/><rect x="90" y="68" width="22" height="32" fill="#4cc38a" stroke="#1d5a3c" stroke-width="3"/>
    <ellipse cx="50" cy="50" rx="17" ry="14" fill="#ffd23f" stroke="#1b1340" stroke-width="3"/><circle cx="57" cy="45" r="4" fill="#fff" stroke="#1b1340" stroke-width="1.5"/><path d="M64 52 l12 3 l-12 4Z" fill="#ff7a1a" stroke="#1b1340" stroke-width="2"/>`,
  play(app, you, ctx, done) {
    const rd = you.round;
    app.innerHTML = `${ctx.topBar()}<div class="fb-play"><div class="fb-timer"><i style="animation-duration:${rd.ms}ms"></i></div><div class="fb-info" id="fli">🚧 0</div><div class="fl-wrap" id="flw"><canvas id="flc"></canvas></div></div>`;
    const wrap = app.querySelector('#flw');
    const cv = app.querySelector('#flc');
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    const bird = { x: W * 0.28, y: H / 2, v: 0 };
    let pipes = [];
    let passed = 0;
    let t = 0;
    let started = false;
    let crashed = false;
    let ended = false;
    let last = performance.now();
    let spawn = 0.6;
    const GAP = Math.max(130, H * 0.27);
    const flap = () => { started = true; if (!crashed) { bird.v = -Math.max(360, H * 0.62); U.sfx('tick'); } };
    wrap.addEventListener('pointerdown', (e) => { e.preventDefault(); flap(); });
    const kd = (e) => { if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); flap(); } };
    document.addEventListener('keydown', kd);
    const cleanup = () => document.removeEventListener('keydown', kd);
    const finish = () => { if (ended) return; ended = true; cleanup(); done({ pipes: passed, crashed }); };
    function frame(now) {
      if (ended) return;
      if (!app.contains(cv)) { ended = true; cleanup(); return; }
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      if (started && !crashed) {
        t += dt;
        bird.v += H * 1.9 * dt;
        bird.y += bird.v * dt;
        spawn -= dt;
        if (spawn <= 0) { pipes.push({ x: W + 30, gy: 70 + GAP / 2 + Math.random() * (H - GAP - 140), done: false }); spawn = 1.55 / rd.speed; }
        pipes.forEach((p) => (p.x -= 165 * rd.speed * dt));
        pipes = pipes.filter((p) => p.x > -60);
        for (const p of pipes) {
          if (!p.done && p.x + 24 < bird.x) { p.done = true; passed++; U.sfx('coin'); app.querySelector('#fli').textContent = `🚧 ${passed}`; }
          if (bird.x + 12 > p.x - 24 && bird.x - 12 < p.x + 24 && (bird.y - 12 < p.gy - GAP / 2 || bird.y + 12 > p.gy + GAP / 2)) crashed = true;
        }
        if (bird.y > H - 12 || bird.y < 0) crashed = true;
        if (crashed) { U.sfx('bad'); if (navigator.vibrate) navigator.vibrate([60, 40, 60]); setTimeout(finish, 800); }
      }
      draw();
      requestAnimationFrame(frame);
    }
    function draw() {
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#59b8ff');
      sky.addColorStop(1, '#bfe8ff');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,.8)';
      for (let i = 0; i < 4; i++) { const cx = ((i * 190 - t * 30) % (W + 120) + W + 120) % (W + 120) - 60; g.beginPath(); g.ellipse(cx, 50 + i * 55, 38, 14, 0, 0, 7); g.fill(); }
      for (const p of pipes) {
        g.fillStyle = '#4cc38a';
        g.strokeStyle = '#1d5a3c';
        g.lineWidth = 3;
        g.fillRect(p.x - 24, 0, 48, p.gy - GAP / 2);
        g.strokeRect(p.x - 24, 0, 48, p.gy - GAP / 2);
        g.fillRect(p.x - 24, p.gy + GAP / 2, 48, H);
        g.strokeRect(p.x - 24, p.gy + GAP / 2, 48, H);
        g.fillRect(p.x - 29, p.gy - GAP / 2 - 18, 58, 18);
        g.strokeRect(p.x - 29, p.gy - GAP / 2 - 18, 58, 18);
        g.fillRect(p.x - 29, p.gy + GAP / 2, 58, 18);
        g.strokeRect(p.x - 29, p.gy + GAP / 2, 58, 18);
      }
      g.save();
      g.translate(bird.x, bird.y);
      g.rotate(Math.max(-0.5, Math.min(1, bird.v / 700)));
      g.fillStyle = '#ffd23f';
      g.strokeStyle = '#1b1340';
      g.lineWidth = 3;
      g.beginPath(); g.ellipse(0, 0, 17, 13, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(7, -4, 5, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#1b1340';
      g.beginPath(); g.arc(8, -4, 2, 0, 7); g.fill();
      g.fillStyle = '#ff7a1a';
      g.beginPath(); g.moveTo(14, 2); g.lineTo(26, 5); g.lineTo(14, 9); g.fill();
      g.fillStyle = '#f2b640';
      g.beginPath(); g.ellipse(-4, 4 + Math.sin(t * 25) * 3, 9, 5, -0.3, 0, 7); g.fill(); g.stroke();
      g.restore();
      if (!started) { g.fillStyle = 'rgba(0,0,0,.45)'; g.font = '900 20px Heebo, sans-serif'; g.textAlign = 'center'; g.fillText('הקישו כדי להתחיל לרפרף', W / 2, H * 0.7); }
    }
    draw();
    requestAnimationFrame((n) => { last = n; frame(n); });
    setTimeout(finish, rd.ms);
  },
});
