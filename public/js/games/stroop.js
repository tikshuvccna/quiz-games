// "צבעים מבלבלים": a colour word written in another ink: tap the colour of the ink.
FfaBoard.make({
  id: 'stroop',
  emoji: '🎨',
  cls: 'st-room',
  endTitle: 'מלכי הצבעים!',
  cover: () => `<rect width="160" height="100" fill="#251a5e"/><text x="80" y="56" text-anchor="middle" font-size="34" font-weight="900" fill="#ff4d6d">כחול</text>
    ${['#ff4d6d', '#2f80ff', '#2ee59d', '#ffd23f'].map((c, i) => `<rect x="${22 + i * 31}" y="68" width="26" height="22" rx="6" fill="${c}" stroke="#fff" stroke-width="2"/>`).join('')}`,
  play(app, you, ctx, done) {
    const rd = you.round;
    const items = rd.items;
    app.innerHTML = `${ctx.topBar()}<div class="fb-play"><div class="fb-timer"><i style="animation-duration:${rd.ms}ms"></i></div><div class="fb-info" id="sti">1 מתוך ${items.length}</div>
      <div class="st-word" id="stw"></div>
      <div class="st-btns">${rd.colors.map((c, i) => `<button class="st-btn" data-c="${i}" style="--c:${c[1]}"><span>${c[0]}</span></button>`).join('')}</div></div>`;
    const answers = [];
    let i = 0;
    let ended = false;
    const show = () => {
      const it = items[i];
      const w = app.querySelector('#stw');
      w.textContent = rd.colors[it.w][0];
      w.style.color = rd.colors[it.c][1];
      w.classList.remove('pop');
      void w.offsetWidth;
      w.classList.add('pop');
      app.querySelector('#sti').textContent = `${i + 1} מתוך ${items.length}`;
    };
    const finish = () => { if (!ended) { ended = true; done({ answers }); } };
    app.querySelector('.st-btns').addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.st-btn');
      if (!b || ended) return;
      e.preventDefault();
      const c = Number(b.dataset.c);
      answers.push(c);
      const ok = c === items[i].c;
      U.sfx(ok ? 'coin' : 'bad');
      if (navigator.vibrate && !ok) navigator.vibrate(30);
      b.classList.add(ok ? 'good' : 'bad');
      setTimeout(() => b.classList.remove('good', 'bad'), 200);
      i++;
      if (i >= items.length) return setTimeout(finish, 250);
      show();
    });
    show();
    setTimeout(finish, rd.ms);
  },
});
