// "נחש": a 10-second snake round on the phone. Swipe or use the arrows; eat apples, do not hit the wall or yourself.
FfaBoard.make({
  id: 'snake',
  emoji: '🐍',
  cls: 'snk-room',
  endTitle: 'מלך/ת הנחשים!',
  cover: () => `<rect width="160" height="100" fill="#173d2b"/>${Array.from({ length: 9 }, (_, i) => `<rect x="${20 + i * 14}" y="${i < 5 ? 60 : 60 - (i - 4) * 10}" width="12" height="12" rx="4" fill="${i === 8 ? '#9bffb0' : '#3ecf6d'}" stroke="#0b2018" stroke-width="2"/>`).join('')}
    <circle cx="128" cy="26" r="9" fill="#ff4d6d" stroke="#fff" stroke-width="2"/><path d="M128 17 q4 -6 9 -5" stroke="#3ecf6d" stroke-width="3" fill="none"/>`,
  play(app, you, ctx, done) {
    const rd = you.round;
    const C = rd.cols;
    const R = rd.rows;
    app.innerHTML = `${ctx.topBar()}<div class="fb-play"><div class="fb-timer"><i style="animation-duration:${rd.ms}ms"></i></div><div class="fb-info" id="snc">🍎 0</div>
      <div class="snk-wrap" id="snw"><canvas id="snv"></canvas></div>
      <div class="snk-pad"><button data-d="l">◀</button><button data-d="d">▼</button><button data-d="u">▲</button><button data-d="r">▶</button></div></div>`;
    const wrap = app.querySelector('#snw');
    const cv = app.querySelector('#snv');
    const cell = Math.max(8, Math.floor(Math.min(wrap.clientWidth / C, wrap.clientHeight / R)));
    cv.width = cell * C;
    cv.height = cell * R;
    const g = cv.getContext('2d');
    const V = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
    const OPP = { u: 'd', d: 'u', l: 'r', r: 'l' };
    let snake = [[5, 8], [5, 9], [5, 10]];
    let dir = 'u';
    let want = 'u';
    let apple = null;
    let apples = 0;
    let crashed = false;
    let ended = false;
    const placeApple = () => {
      for (let k = 0; k < 200; k++) {
        const a = [Math.floor(Math.random() * C), Math.floor(Math.random() * R)];
        if (!snake.some((s) => s[0] === a[0] && s[1] === a[1])) return a;
      }
      return [0, 0];
    };
    apple = placeApple();
    const turn = (d) => { if (d && OPP[d] !== dir) want = d; };
    app.querySelector('.snk-pad').addEventListener('pointerdown', (e) => { const b = e.target.closest('button'); if (b) { e.preventDefault(); turn(b.dataset.d); } });
    let sx = 0;
    let sy = 0;
    wrap.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
    wrap.addEventListener('pointerup', (e) => {
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : dy > 0 ? 'd' : 'u');
    });
    const keys = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r' };
    const onKey = (e) => { if (keys[e.key]) { e.preventDefault(); turn(keys[e.key]); } };
    document.addEventListener('keydown', onKey);

    function draw() {
      g.fillStyle = '#12301f';
      g.fillRect(0, 0, cv.width, cv.height);
      for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if ((x + y) % 2 === 0) { g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x * cell, y * cell, cell, cell); }
      g.fillStyle = '#ff4d6d';
      g.beginPath();
      g.arc((apple[0] + 0.5) * cell, (apple[1] + 0.55) * cell, cell * 0.36, 0, 7);
      g.fill();
      g.fillStyle = '#3ecf6d';
      g.fillRect((apple[0] + 0.45) * cell, (apple[1] + 0.05) * cell, cell * 0.1, cell * 0.2);
      snake.forEach((s, i) => {
        g.fillStyle = i === 0 ? '#9bffb0' : i % 2 ? '#3ecf6d' : '#34b862';
        g.beginPath();
        g.roundRect(s[0] * cell + 1, s[1] * cell + 1, cell - 2, cell - 2, cell * 0.3);
        g.fill();
      });
      const h = snake[0];
      g.fillStyle = '#10261a';
      for (const o of [-0.18, 0.18]) { g.beginPath(); g.arc((h[0] + 0.5 + (V[dir][1] ? o : 0) + V[dir][0] * 0.12) * cell, (h[1] + 0.5 + (V[dir][0] ? o : 0) + V[dir][1] * 0.12) * cell, cell * 0.08, 0, 7); g.fill(); }
    }
    function finish() {
      if (ended) return;
      ended = true;
      clearInterval(tick);
      document.removeEventListener('keydown', onKey);
      done({ apples, crashed });
    }
    function step() {
      if (ended) return;
      if (!app.contains(cv)) { ended = true; clearInterval(tick); document.removeEventListener('keydown', onKey); return; }
      dir = want;
      const h = snake[0];
      const n = [h[0] + V[dir][0], h[1] + V[dir][1]];
      const hitWall = n[0] < 0 || n[1] < 0 || n[0] >= C || n[1] >= R;
      const hitSelf = snake.slice(0, -1).some((s) => s[0] === n[0] && s[1] === n[1]);
      if (hitWall || hitSelf) {
        crashed = true;
        U.sfx('bad');
        if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
        cv.classList.add('snk-crash');
        clearInterval(tick);
        setTimeout(finish, 600);
        return;
      }
      snake.unshift(n);
      if (n[0] === apple[0] && n[1] === apple[1]) {
        apples++;
        app.querySelector('#snc').textContent = `🍎 ${apples}`;
        U.sfx('coin');
        apple = placeApple();
      } else snake.pop();
      draw();
    }
    draw();
    const tick = setInterval(step, rd.step);
    setTimeout(finish, rd.ms);
  },
});
