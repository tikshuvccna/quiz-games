// "זיכרון ריבועים": some squares light up, then tap the ones you remember.
FfaBoard.make({
  id: 'memgrid',
  emoji: '🧠',
  cls: 'mg-room',
  endTitle: 'מלכי הזיכרון!',
  cover: () => `<rect width="160" height="100" fill="#1e2a6e"/>${Array.from({ length: 9 }, (_, i) => `<rect x="${44 + (i % 3) * 26}" y="${10 + Math.floor(i / 3) * 26}" width="24" height="24" rx="5" fill="${[1, 4, 8].includes(i) ? '#ffd23f' : 'rgba(255,255,255,.14)'}" stroke="#fff" stroke-width="1.5"/>`).join('')}`,
  play(app, you, ctx, done) {
    const rd = you.round;
    const n = rd.size;
    app.innerHTML = `${ctx.topBar()}<div class="fb-play"><div class="fb-timer"><i style="animation-duration:${rd.ms}ms"></i></div><div class="fb-info" id="mgi">זכרו אילו ריבועים נדלקים…</div>
      <div class="mg-board n${n}" id="mgb">${Array.from({ length: n * n }, (_, i) => `<button class="mg-cell" data-i="${i}"></button>`).join('')}</div></div>`;
    const cells = [...app.querySelectorAll('.mg-cell')];
    const picks = [];
    let phase = 'show';
    let ended = false;
    const finish = () => { if (!ended) { ended = true; done({ picks }); } };
    rd.cells.forEach((c) => cells[c].classList.add('lit'));
    setTimeout(() => {
      if (ended || !app.contains(cells[0])) return;
      cells.forEach((c) => c.classList.remove('lit'));
      phase = 'pick';
      app.querySelector('#mgi').textContent = `הקישו על ${rd.cells.length} ריבועים שנדלקו`;
      U.sfx('pop');
    }, rd.showMs);
    app.querySelector('#mgb').addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.mg-cell');
      if (!b || phase !== 'pick' || ended || b.classList.contains('pick')) return;
      e.preventDefault();
      const i = Number(b.dataset.i);
      picks.push(i);
      b.classList.add('pick', rd.cells.includes(i) ? 'right' : 'wrong');
      U.sfx(rd.cells.includes(i) ? 'coin' : 'bad');
      if (picks.length >= rd.cells.length) { phase = 'done'; setTimeout(finish, 700); }
    });
    setTimeout(finish, rd.ms);
  },
});
