// "ריצת מכשולים": a 10-second auto-runner. Tap to jump. The phone plays it and reports the obstacles cleared.
FfaBoard.make({
  id: 'runner',
  emoji: '🏃',
  cls: 'rn-room',
  endTitle: 'מלכי הריצה!',
  cover: () => `<rect width="160" height="100" fill="#ffd9a0"/><rect y="74" width="160" height="26" fill="#8a5a2b"/><circle cx="130" cy="22" r="12" fill="#fff3b0"/>
    <rect x="96" y="54" width="12" height="20" rx="3" fill="#2f8f4a" stroke="#14452a" stroke-width="2.5"/><rect x="90" y="60" width="6" height="8" rx="2" fill="#2f8f4a" stroke="#14452a" stroke-width="2"/>
    <circle cx="46" cy="52" r="9" fill="#ffcf9a" stroke="#1b1340" stroke-width="3"/><rect x="40" y="60" width="12" height="14" rx="4" fill="#4a90e2" stroke="#1b1340" stroke-width="3"/>`,
  play(app, you, ctx, done) {
    const rd = you.round;
    app.innerHTML = `${ctx.topBar()}<div class="fb-play"><div class="fb-timer"><i style="animation-duration:${rd.ms}ms"></i></div><div class="fb-info" id="rni">🌵 0</div><div class="rn-wrap" id="rnw"><canvas id="rnc"></canvas></div></div>`;
    const wrap = app.querySelector('#rnw');
    const cv = app.querySelector('#rnc');
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    const GY = H * 0.78; // the ground line
    const me = { x: W * 0.2, y: GY, v: 0 };
    let obs = [];
    let cleared = 0;
    let t = 0;
    let crashed = false;
    let ended = false;
    let started = false;
    let last = performance.now();
    let spawn = 1;
    const jump = () => { started = true; if (me.y >= GY - 1 && !crashed) { me.v = -Math.max(560, H * 1.2); U.sfx('tick'); } };
    wrap.addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });
    const kd = (e) => { if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); jump(); } };
    document.addEventListener('keydown', kd);
    const cleanup = () => document.removeEventListener('keydown', kd);
    const finish = () => { if (ended) return; ended = true; cleanup(); done({ jumps: cleared, crashed }); };
    function frame(now) {
      if (ended) return;
      if (!app.contains(cv)) { ended = true; cleanup(); return; }
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      if (started && !crashed) {
        t += dt;
        me.v += H * 3.4 * dt;
        me.y = Math.min(GY, me.y + me.v * dt);
        if (me.y >= GY) me.v = 0;
        spawn -= dt;
        if (spawn <= 0) { obs.push({ x: W + 20, w: 22 + Math.random() * 14, h: 34 + Math.random() * 26, done: false }); spawn = (0.9 + Math.random() * 0.8) / rd.speed; }
        obs.forEach((o) => (o.x -= 270 * rd.speed * dt));
        obs = obs.filter((o) => o.x > -60);
        for (const o of obs) {
          if (!o.done && o.x + o.w < me.x - 10) { o.done = true; cleared++; U.sfx('coin'); app.querySelector('#rni').textContent = `🌵 ${cleared}`; }
          if (me.x + 12 > o.x && me.x - 12 < o.x + o.w && me.y > GY - o.h + 2) crashed = true;
        }
        if (crashed) { U.sfx('bad'); if (navigator.vibrate) navigator.vibrate([60, 40, 60]); setTimeout(finish, 800); }
      }
      draw();
      requestAnimationFrame(frame);
    }
    function draw() {
      const sky = g.createLinearGradient(0, 0, 0, GY);
      sky.addColorStop(0, '#ffb36b');
      sky.addColorStop(1, '#ffe2a8');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff3b0';
      g.beginPath(); g.arc(W * 0.8, H * 0.2, 28, 0, 7); g.fill();
      g.fillStyle = '#d9a05b';
      g.beginPath(); g.moveTo(0, GY); for (let x = 0; x <= W; x += 30) g.lineTo(x, GY - 26 - 14 * Math.sin(x / 50 + t * 0.4)); g.lineTo(W, GY); g.fill();
      g.fillStyle = '#8a5a2b';
      g.fillRect(0, GY, W, H - GY);
      g.fillStyle = '#a86f35';
      for (let x = -((t * 270 * rd.speed) % 60); x < W; x += 60) g.fillRect(x, GY + 8, 30, 4);
      for (const o of obs) {
        g.fillStyle = '#2f8f4a';
        g.strokeStyle = '#14452a';
        g.lineWidth = 3;
        g.beginPath(); g.roundRect(o.x, GY - o.h, o.w, o.h, 6); g.fill(); g.stroke();
        g.beginPath(); g.roundRect(o.x - 8, GY - o.h * 0.6, 10, 8, 3); g.fill(); g.stroke();
        g.beginPath(); g.roundRect(o.x + o.w - 2, GY - o.h * 0.75, 10, 8, 3); g.fill(); g.stroke();
      }
      // the runner: head, body, swinging legs
      g.save();
      g.translate(me.x, me.y);
      const air = me.y < GY - 2;
      const sw = air ? 0.5 : Math.sin(t * 22) * 0.7;
      g.strokeStyle = '#1b1340';
      g.lineWidth = 4;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(-3, -16); g.lineTo(-3 - Math.sin(sw) * 12, 0); g.moveTo(3, -16); g.lineTo(3 + Math.sin(sw) * 12, 0); g.stroke();
      g.fillStyle = '#4a90e2';
      g.beginPath(); g.roundRect(-10, -40, 20, 26, 6); g.fill(); g.stroke();
      g.fillStyle = '#ffcf9a';
      g.beginPath(); g.arc(0, -50, 11, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#1b1340';
      g.beginPath(); g.arc(4, -52, 2, 0, 7); g.fill();
      g.restore();
      if (!started) { g.fillStyle = 'rgba(0,0,0,.45)'; g.font = '900 20px Heebo, sans-serif'; g.textAlign = 'center'; g.fillText('הקישו כדי לקפוץ', W / 2, H * 0.4); }
    }
    draw();
    requestAnimationFrame((n) => { last = n; frame(n); });
    setTimeout(finish, rd.ms);
  },
});
