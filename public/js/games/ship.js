// "ספינת חלל": a 12-second Asteroids-style flight on the phone. Drag on the left to steer, hold the right button to fire.
FfaBoard.make({
  id: 'ship',
  emoji: '🛸',
  cls: 'shp-room',
  endTitle: 'מלך/ת החלל!',
  cover: () => `<rect width="160" height="100" fill="#0b0b2e"/>${[[20, 14], [60, 8], [130, 20], [100, 60], [30, 74], [146, 80]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#fff"/>`).join('')}
    <circle cx="44" cy="40" r="14" fill="#8a8aa8" stroke="#fff" stroke-width="2.5"/><circle cx="118" cy="30" r="9" fill="#8a8aa8" stroke="#fff" stroke-width="2.5"/>
    <path d="M80 54 L92 82 L80 76 L68 82Z" fill="#ffd23f" stroke="#1b1340" stroke-width="3"/><path d="M80 40 V30" stroke="#ff4d6d" stroke-width="4" stroke-linecap="round"/>`,
  play(app, you, ctx, done) {
    const rd = you.round;
    app.innerHTML = `${ctx.topBar()}<div class="fb-play"><div class="fb-timer"><i style="animation-duration:${rd.ms}ms"></i></div><div class="fb-info" id="shi">💥 0 · ❤️❤️❤️</div>
      <div class="shp-wrap" id="shw"><canvas id="shc"></canvas><div class="shp-stick" id="shs"><i></i></div><button class="shp-fire" id="shf">🔥</button></div></div>`;
    const wrap = app.querySelector('#shw');
    const cv = app.querySelector('#shc');
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    const ship = { x: W / 2, y: H - 60, vx: 0, vy: 0, inv: 0 };
    let lives = rd.lives;
    let kills = 0;
    let rocks = [];
    let shots = [];
    let sparks = [];
    let fire = false;
    let cool = 0;
    let stick = null; // { x0, y0, dx, dy }
    let t = 0;
    let spawn = 0;
    let ended = false;
    let last = performance.now();
    const keys = new Set();
    const kd = (e) => { if (e.key === ' ') { e.preventDefault(); fire = true; } keys.add(e.key); };
    const ku = (e) => { if (e.key === ' ') fire = false; keys.delete(e.key); };
    document.addEventListener('keydown', kd);
    document.addEventListener('keyup', ku);
    const cleanup = () => { document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); };
    const stickEl = app.querySelector('#shs');
    wrap.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#shf')) return;
      const r = wrap.getBoundingClientRect();
      stick = { x0: e.clientX - r.left, y0: e.clientY - r.top, dx: 0, dy: 0 };
      stickEl.style.display = 'block';
      stickEl.style.left = stick.x0 + 'px';
      stickEl.style.top = stick.y0 + 'px';
      try { wrap.setPointerCapture(e.pointerId); } catch {}
    });
    wrap.addEventListener('pointermove', (e) => {
      if (!stick) return;
      const r = wrap.getBoundingClientRect();
      stick.dx = Math.max(-1, Math.min(1, (e.clientX - r.left - stick.x0) / 50));
      stick.dy = Math.max(-1, Math.min(1, (e.clientY - r.top - stick.y0) / 50));
      stickEl.firstElementChild.style.transform = `translate(${stick.dx * 22}px, ${stick.dy * 22}px)`;
    });
    const release = () => { stick = null; stickEl.style.display = 'none'; };
    wrap.addEventListener('pointerup', release);
    wrap.addEventListener('pointercancel', release);
    const fb = app.querySelector('#shf');
    fb.addEventListener('pointerdown', (e) => { e.preventDefault(); fire = true; try { fb.setPointerCapture(e.pointerId); } catch {} });
    fb.addEventListener('pointerup', () => (fire = false));
    fb.addEventListener('pointercancel', () => (fire = false));

    const hud = () => { app.querySelector('#shi').textContent = `💥 ${kills} · ${'❤️'.repeat(lives) || '💀'}`; };
    function finish() {
      if (ended) return;
      ended = true;
      cleanup();
      done({ kills, lives });
    }
    function frame(now) {
      if (ended) return;
      if (!app.contains(cv)) { ended = true; cleanup(); return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      // steer
      let ax = stick ? stick.dx : 0;
      let ay = stick ? stick.dy : 0;
      if (keys.has('ArrowLeft') || keys.has('a')) ax = -1;
      if (keys.has('ArrowRight') || keys.has('d')) ax = 1;
      if (keys.has('ArrowUp') || keys.has('w')) ay = -1;
      if (keys.has('ArrowDown') || keys.has('s')) ay = 1;
      ship.x = Math.max(16, Math.min(W - 16, ship.x + ax * 260 * dt));
      ship.y = Math.max(H * 0.35, Math.min(H - 30, ship.y + ay * 220 * dt));
      ship.inv = Math.max(0, ship.inv - dt);
      cool -= dt;
      if (fire && cool <= 0 && lives > 0) { shots.push({ x: ship.x, y: ship.y - 18 }); cool = 0.17; U.sfx('tick'); }
      spawn -= dt;
      if (spawn <= 0 && t < rd.ms / 1000 - 1) {
        rocks.push({ x: 20 + Math.random() * (W - 40), y: -30, r: 14 + Math.random() * 16, vy: (70 + Math.random() * 70) * rd.speed, vx: (Math.random() - 0.5) * 60, rot: Math.random() * 6, sp: (Math.random() - 0.5) * 3, hp: 1 });
        spawn = 0.55 / rd.speed;
      }
      shots.forEach((s) => (s.y -= 520 * dt));
      shots = shots.filter((s) => s.y > -10);
      rocks.forEach((r) => { r.y += r.vy * dt; r.x += r.vx * dt; r.rot += r.sp * dt; });
      for (const s of shots) {
        for (const r of rocks) {
          if (!r.dead && Math.hypot(s.x - r.x, s.y - r.y) < r.r + 4) {
            r.dead = true;
            s.y = -99;
            kills++;
            hud();
            U.sfx('boom');
            for (let k = 0; k < 8; k++) sparks.push({ x: r.x, y: r.y, vx: (Math.random() - 0.5) * 240, vy: (Math.random() - 0.5) * 240, l: 0.5 });
          }
        }
      }
      for (const r of rocks) {
        if (!r.dead && lives > 0 && ship.inv <= 0 && Math.hypot(ship.x - r.x, ship.y - r.y) < r.r + 12) {
          r.dead = true;
          lives--;
          ship.inv = 1.4;
          hud();
          U.sfx('bad');
          if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
          for (let k = 0; k < 12; k++) sparks.push({ x: ship.x, y: ship.y, vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 300, l: 0.7 });
          if (lives === 0) setTimeout(finish, 900);
        }
      }
      rocks = rocks.filter((r) => !r.dead && r.y < H + 40);
      sparks.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt; });
      sparks = sparks.filter((p) => p.l > 0);
      draw();
      if (t >= rd.ms / 1000) return finish();
      requestAnimationFrame(frame);
    }
    function draw() {
      g.fillStyle = '#0b0b2e';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff';
      for (let i = 0; i < 40; i++) g.fillRect((i * 97) % W, (i * 53 + t * (20 + (i % 3) * 20)) % H, 2, 2);
      for (const r of rocks) {
        g.save();
        g.translate(r.x, r.y);
        g.rotate(r.rot);
        g.fillStyle = '#8a8aa8';
        g.strokeStyle = '#fff';
        g.lineWidth = 2.5;
        g.beginPath();
        for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.283; const rr = r.r * (0.8 + ((k * 37) % 5) * 0.07); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        g.closePath();
        g.fill();
        g.stroke();
        g.restore();
      }
      g.fillStyle = '#ff4d6d';
      for (const s of shots) g.fillRect(s.x - 2, s.y - 8, 4, 14);
      for (const p of sparks) { g.fillStyle = `rgba(255,${Math.round(180 * p.l)},60,${p.l * 1.6})`; g.fillRect(p.x, p.y, 4, 4); }
      if (lives > 0 && (ship.inv <= 0 || Math.floor(t * 12) % 2)) {
        g.save();
        g.translate(ship.x, ship.y);
        g.fillStyle = '#ffd23f';
        g.strokeStyle = '#1b1340';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(0, -20); g.lineTo(14, 14); g.lineTo(0, 8); g.lineTo(-14, 14);
        g.closePath();
        g.fill();
        g.stroke();
        if (fire || stick) { g.fillStyle = '#ff9a1a'; g.beginPath(); g.moveTo(-5, 10); g.lineTo(0, 22 + Math.random() * 8); g.lineTo(5, 10); g.fill(); }
        g.restore();
      }
    }
    hud();
    requestAnimationFrame((n) => { last = n; frame(n); });
  },
});
