// "כבו את האור": 3x3 lights out. Tap a square to flip it and its neighbours; switch everything off.
FfaBoard.make({
  id: 'lights',
  emoji: '💡',
  cls: 'lt-room',
  endTitle: 'מלכי האורות!',
  cover: () => `<rect width="160" height="100" fill="#14183a"/>${Array.from({ length: 9 }, (_, i) => `<rect x="${44 + (i % 3) * 26}" y="${8 + Math.floor(i / 3) * 28}" width="24" height="26" rx="6" fill="${[0, 2, 4, 6, 8].includes(i) ? '#ffe066' : '#2a3068'}" stroke="#fff" stroke-width="1.5"/>`).join('')}`,
  play(app, you, ctx, done) {
    const rd = you.round;
    const b = rd.cells.slice();
    app.innerHTML = `${ctx.topBar()}<div class="fb-play"><div class="fb-timer"><i style="animation-duration:${rd.ms}ms"></i></div><div class="fb-info" id="lti">כבו את כל האורות · הקשות: 0</div><div class="lt-board" id="ltb"></div></div>`;
    const taps = [];
    let ended = false;
    const flip = (i) => { const r = Math.floor(i / 3); const c = i % 3; b[i] = !b[i]; if (r > 0) b[i - 3] = !b[i - 3]; if (r < 2) b[i + 3] = !b[i + 3]; if (c > 0) b[i - 1] = !b[i - 1]; if (c < 2) b[i + 1] = !b[i + 1]; };
    const finish = () => { if (!ended) { ended = true; done({ taps }); } };
    const draw = () => {
      app.querySelector('#ltb').innerHTML = b.map((on, i) => `<button class="lt-cell ${on ? 'on' : ''}" data-i="${i}"></button>`).join('');
      app.querySelector('#lti').textContent = `כבו את כל האורות · הקשות: ${taps.length}`;
    };
    app.querySelector('#ltb').addEventListener('pointerdown', (e) => {
      const c = e.target.closest('.lt-cell');
      if (!c || ended) return;
      e.preventDefault();
      const i = Number(c.dataset.i);
      flip(i);
      taps.push(i);
      U.sfx('tick');
      draw();
      if (!b.some(Boolean)) { U.sfx('good'); setTimeout(finish, 600); }
    });
    draw();
    setTimeout(finish, rd.ms);
  },
});
