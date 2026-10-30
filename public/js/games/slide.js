// "פאזל הזזה": slide the numbered tiles into order. The moves are sent to the server, which replays them.
FfaBoard.make({
  id: 'slide',
  emoji: '🔢',
  cls: 'sl-room',
  endTitle: 'מלכי הפאזל!',
  cover: () => `<rect width="160" height="100" fill="#2a2f6e"/>${[1, 2, 3, 4, 5, 6, 7, 8, 0].map((v, i) => `<rect x="${42 + (i % 3) * 26}" y="${8 + Math.floor(i / 3) * 28}" width="24" height="26" rx="5" fill="${v ? '#ffd23f' : 'rgba(255,255,255,.12)'}" stroke="#fff" stroke-width="1.5"/>${v ? `<text x="${54 + (i % 3) * 26}" y="${27 + Math.floor(i / 3) * 28}" text-anchor="middle" font-size="15" font-weight="900" fill="#1b1340">${v}</text>` : ''}`).join('')}`,
  play(app, you, ctx, done) {
    const rd = you.round;
    const t = rd.tiles.slice();
    app.innerHTML = `${ctx.topBar()}<div class="fb-play"><div class="fb-timer"><i style="animation-duration:${rd.ms}ms"></i></div><div class="fb-info" id="sli">הזיזו את המספרים לפי הסדר 1 עד 8 · מהלכים: 0</div><div class="sl-board" id="slb"></div></div>`;
    const moves = [];
    let ended = false;
    const finish = () => { if (!ended) { ended = true; done({ moves }); } };
    const NEIGH = (i) => { const r = Math.floor(i / 3); const c = i % 3; return [r > 0 && i - 3, r < 2 && i + 3, c > 0 && i - 1, c < 2 && i + 1].filter((x) => x !== false); };
    const draw = () => {
      app.querySelector('#slb').innerHTML = t.map((v, i) => `<button class="sl-tile ${v ? '' : 'blank'} ${v && v === (i + 1) % 9 ? 'ok' : ''}" data-i="${i}">${v || ''}</button>`).join('');
      app.querySelector('#sli').textContent = `הזיזו את המספרים לפי הסדר 1 עד 8 · מהלכים: ${moves.length}`;
    };
    app.querySelector('#slb').addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.sl-tile');
      if (!b || ended) return;
      e.preventDefault();
      const i = Number(b.dataset.i);
      const blank = t.indexOf(0);
      if (!NEIGH(blank).includes(i)) { U.sfx('bad'); return; }
      [t[blank], t[i]] = [t[i], t[blank]];
      moves.push(i);
      U.sfx('tick');
      draw();
      if (t.every((v, k) => v === (k + 1) % 9)) { U.sfx('good'); setTimeout(finish, 500); }
    });
    draw();
    setTimeout(finish, rd.ms);
  },
});
