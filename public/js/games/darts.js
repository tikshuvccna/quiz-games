// "חצים": a marker sweeps across the board and then up and down; tap to stop each one. Three darts.
FfaBoard.make({
  id: 'darts',
  emoji: '🎯',
  cls: 'dt-room',
  endTitle: 'מלכי החצים!',
  cover: () => `<rect width="160" height="100" fill="#3a2a1a"/><circle cx="80" cy="50" r="42" fill="#222" stroke="#fff" stroke-width="3"/><circle cx="80" cy="50" r="33" fill="#f2e3b3"/><circle cx="80" cy="50" r="24" fill="#d9534f"/><circle cx="80" cy="50" r="15" fill="#f2e3b3"/><circle cx="80" cy="50" r="7" fill="#2ee59d"/>
    <path d="M96 30 L82 48" stroke="#ffd23f" stroke-width="4" stroke-linecap="round"/><path d="M96 30 l8 -8 M96 30 l-2 -9 M96 30 l9 2" stroke="#ff4d6d" stroke-width="3" stroke-linecap="round"/>`,
  play(app, you, ctx, done) {
    const rd = you.round;
    const R = rd.rings;
    const SCORE = [12, 8, 5, 2];
    app.innerHTML = `${ctx.topBar()}<div class="fb-play dt-play"><div class="fb-info" id="dti">חץ 1 מתוך ${rd.n} · עצרו את הכיוון</div><div class="fb-judge" id="dtj"></div>
      <div class="dt-board" id="dtb"><svg viewBox="-1 -1 2 2" id="dts">
        <circle r=".98" fill="#222" stroke="#fff" stroke-width=".03"/><circle r=".8" fill="#f2e3b3"/><circle r=".5" fill="#d9534f"/><circle r=".25" fill="#f2e3b3"/><circle r=".09" fill="#2ee59d"/>
        <line id="dtx" y1="-1" y2="1" stroke="#2f80ff" stroke-width=".035"/><line id="dty" x1="-1" x2="1" stroke="#2f80ff" stroke-width=".035" style="display:none"/></svg><div id="dtd"></div></div>
      <button class="btn big dt-btn" id="dtt">עצרו</button></div>`;
    const $ = (id) => app.querySelector('#' + id);
    const out = [];
    let stage = 'x';
    let x = 0;
    let y = 0;
    let t0 = performance.now();
    let raf = 0;
    let dead = false;
    const judge = (txt, color) => { const j = $('dtj'); j.textContent = txt; j.style.color = color; j.classList.remove('pop'); void j.offsetWidth; j.classList.add('pop'); };
    function loop(now) {
      if (dead || !$('dts')) { dead = true; return; }
      const k = (now - t0) / 1000 * rd.speed;
      if (stage === 'x') { x = Math.sin(k * 2.6) * 0.95; $('dtx').setAttribute('x1', x); $('dtx').setAttribute('x2', x); }
      else if (stage === 'y') { y = Math.sin(k * 3.1) * 0.95; $('dty').setAttribute('y1', y); $('dty').setAttribute('y2', y); }
      raf = requestAnimationFrame(loop);
    }
    function tap() {
      if (stage === 'x') {
        stage = 'y';
        t0 = performance.now();
        $('dtx').setAttribute('stroke', '#ffd23f');
        $('dty').style.display = '';
        $('dti').textContent = `חץ ${out.length + 1} מתוך ${rd.n} · עכשיו את הגובה`;
        U.sfx('tick');
      } else if (stage === 'y') {
        stage = 'fly';
        out.push([+x.toFixed(3), +y.toFixed(3)]);
        const d = Math.hypot(x, y);
        const ri = R.findIndex((r) => d <= r);
        const pts = ri >= 0 ? SCORE[ri] : 0;
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        dot.innerHTML = `<circle cx="${x}" cy="${y}" r=".06" fill="#ffd23f" stroke="#1b1340" stroke-width=".02"/><path d="M${x} ${y} l.15 -.15" stroke="#ff4d6d" stroke-width=".04" stroke-linecap="round"/>`;
        dot.classList.add('dt-dart');
        $('dts').appendChild(dot);
        U.sfx(pts >= 8 ? 'good' : pts ? 'coin' : 'bad');
        judge(pts === 12 ? 'בול! 🎯' : pts ? `+${pts}` : 'החטאה', pts >= 8 ? '#ffd23f' : pts ? '#fff' : '#ff6b8a');
        setTimeout(() => {
          if (dead) return;
          if (out.length >= rd.n) { dead = true; cancelAnimationFrame(raf); return done({ darts: out }); }
          stage = 'x';
          t0 = performance.now();
          $('dtx').setAttribute('stroke', '#2f80ff');
          $('dty').style.display = 'none';
          $('dti').textContent = `חץ ${out.length + 1} מתוך ${rd.n} · עצרו את הכיוון`;
        }, 1100);
      }
    }
    app.querySelector('.dt-play').addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
    raf = requestAnimationFrame((n) => { t0 = n; loop(n); });
  },
});
