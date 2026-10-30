// "חשבון זריז": eight small sums with three answers each.
FfaBoard.make({
  id: 'mathrush',
  emoji: '➕',
  cls: 'mr-room',
  endTitle: 'מלכי החשבון!',
  cover: () => `<rect width="160" height="100" fill="#1f3a6e"/><text x="80" y="46" text-anchor="middle" font-size="30" font-weight="900" fill="#ffd23f" direction="ltr">7 × 6</text>
    ${['40', '42', '48'].map((t, i) => `<rect x="${18 + i * 44}" y="58" width="40" height="28" rx="8" fill="${i === 1 ? '#2ee59d' : '#fff'}" stroke="#1b1340" stroke-width="2"/><text x="${38 + i * 44}" y="78" text-anchor="middle" font-size="16" font-weight="900" fill="#1b1340">${t}</text>`).join('')}`,
  play(app, you, ctx, done) {
    const rd = you.round;
    app.innerHTML = `${ctx.topBar()}<div class="fb-play"><div class="fb-timer"><i style="animation-duration:${rd.ms}ms"></i></div><div class="fb-info" id="mri">תרגיל 1 מתוך ${rd.items.length}</div>
      <div class="mr-q" id="mrq"></div><div class="mr-opts" id="mro"></div></div>`;
    const answers = [];
    let i = 0;
    let ended = false;
    const finish = () => { if (!ended) { ended = true; done({ answers }); } };
    const show = () => {
      const it = rd.items[i];
      const q = app.querySelector('#mrq');
      q.textContent = it.q + ' = ?';
      q.classList.remove('pop');
      void q.offsetWidth;
      q.classList.add('pop');
      app.querySelector('#mro').innerHTML = it.opts.map((o, k) => `<button class="mr-opt" data-k="${k}">${o}</button>`).join('');
      app.querySelector('#mri').textContent = `תרגיל ${i + 1} מתוך ${rd.items.length}`;
    };
    app.querySelector('#mro').addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.mr-opt');
      if (!b || ended) return;
      e.preventDefault();
      answers.push(Number(b.dataset.k));
      U.sfx('pop');
      i++;
      if (i >= rd.items.length) return setTimeout(finish, 200);
      show();
    });
    show();
    setTimeout(finish, rd.ms);
  },
});
