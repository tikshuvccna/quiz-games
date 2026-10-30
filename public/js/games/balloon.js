// "פוצצו בלונים": numbered balloons float up and down; pop them in order.
FfaBoard.make({
  id: 'balloon',
  emoji: '🎈',
  cls: 'bl-room',
  endTitle: 'מלכי הבלונים!',
  cover: () => `<rect width="160" height="100" fill="#8fd3ff"/>${[[30, 40, '#ff4d6d', 1], [66, 28, '#ffd23f', 2], [100, 46, '#2ee59d', 3], [128, 30, '#8b5cf6', 4]].map(([x, y, c, n]) => `<ellipse cx="${x}" cy="${y}" rx="15" ry="19" fill="${c}" stroke="#fff" stroke-width="2.5"/><path d="M${x} ${y + 19} q-4 14 0 26" stroke="#555" stroke-width="1.5" fill="none"/><text x="${x}" y="${y + 6}" text-anchor="middle" font-size="16" font-weight="900" fill="#fff">${n}</text>`).join('')}`,
  play(app, you, ctx, done) {
    const rd = you.round;
    // the same seeded positions every time for this round
    let a = rd.seed;
    const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const COLORS = ['#ff4d6d', '#ffd23f', '#2ee59d', '#22c7e8', '#8b5cf6', '#ff8a3d', '#ff4fa3'];
    // a jittered 3-column grid, shuffled: balloons never hide each other
    const rows = Math.ceil(rd.n / 3);
    const slots = Array.from({ length: rd.n }, (_, i) => i);
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
    app.innerHTML = `${ctx.topBar()}<div class="fb-play"><div class="fb-timer"><i style="animation-duration:${you.round.ms}ms"></i></div><div class="fb-info" id="bli">הבא: 1</div>
      <div class="bl-sky" id="bls">${Array.from({ length: rd.n }, (_, i) => `<button class="bl-ball" data-n="${i + 1}" style="left:${(3 + (slots[i] % 3) * 32 + rnd() * 6).toFixed(0)}%;top:${(2 + Math.floor(slots[i] / 3) * (86 / rows) + rnd() * 4).toFixed(0)}%;--c:${COLORS[i % COLORS.length]};--d:${(2.4 + rnd() * 2).toFixed(1)}s;--dl:-${(rnd() * 3).toFixed(1)}s"><b>${i + 1}</b></button>`).join('')}</div></div>`;
    const order = [];
    let next = 1;
    let ended = false;
    const finish = () => { if (!ended) { ended = true; done({ order }); } };
    app.querySelector('#bls').addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.bl-ball');
      if (!b || ended || b.classList.contains('popped')) return;
      e.preventDefault();
      const n = Number(b.dataset.n);
      order.push(n);
      if (n === next) {
        b.classList.add('popped');
        U.sfx('coin');
        if (navigator.vibrate) navigator.vibrate(12);
        next++;
        app.querySelector('#bli').textContent = next > rd.n ? 'כל הכבוד!' : `הבא: ${next}`;
        if (next > rd.n) setTimeout(finish, 500);
      } else {
        b.classList.add('shake');
        setTimeout(() => b.classList.remove('shake'), 350);
        U.sfx('bad');
      }
    });
    setTimeout(finish, rd.ms);
  },
});
