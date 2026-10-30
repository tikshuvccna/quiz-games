// "מקלידים מהר": type each word as it appears.
FfaBoard.make({
  id: 'typing',
  emoji: '⌨️',
  cls: 'ty-room',
  endTitle: 'אצבעות הזהב!',
  cover: () => `<rect width="160" height="100" fill="#243a6e"/>${Array.from({ length: 3 }, (_, r) => Array.from({ length: 7 }, (_, c) => `<rect x="${16 + c * 19 + (r === 1 ? 5 : r === 2 ? 10 : 0)}" y="${50 + r * 16}" width="16" height="13" rx="3" fill="#dfe6ff" stroke="#fff"/>`).join('')).join('')}<text x="80" y="36" text-anchor="middle" font-size="22" font-weight="900" fill="#ffd23f">שלום</text>`,
  play(app, you, ctx, done) {
    const rd = you.round;
    app.innerHTML = `${ctx.topBar()}<div class="fb-play"><div class="fb-timer"><i style="animation-duration:${rd.ms}ms"></i></div><div class="fb-info" id="tyi">1 מתוך ${rd.words.length}</div>
      <div class="ty-word" id="tyw"></div><input class="input ty-in" id="tyx" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="הקלידו כאן"><button class="btn big ty-ok" id="tyo">✓</button></div>`;
    const typed = [];
    let i = 0;
    let ended = false;
    const inp = app.querySelector('#tyx');
    const finish = () => { if (!ended) { ended = true; done({ typed }); } };
    const show = () => {
      const w = app.querySelector('#tyw');
      w.textContent = rd.words[i];
      w.classList.remove('pop');
      void w.offsetWidth;
      w.classList.add('pop');
      inp.value = '';
      app.querySelector('#tyi').textContent = `${i + 1} מתוך ${rd.words.length}`;
      inp.focus();
    };
    const submit = () => {
      if (ended) return;
      const v = inp.value.trim();
      typed.push(v);
      const ok = v === rd.words[i];
      U.sfx(ok ? 'coin' : 'bad');
      inp.classList.add(ok ? 'good' : 'bad');
      setTimeout(() => inp.classList.remove('good', 'bad'), 250);
      i++;
      if (i >= rd.words.length) return setTimeout(finish, 300);
      show();
    };
    app.querySelector('#tyo').addEventListener('pointerdown', (e) => { e.preventDefault(); submit(); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    show();
    setTimeout(finish, rd.ms);
  },
});
