// "תגובה מהירה": wait for green, then tap as fast as you can. Five trials.
FfaBoard.make({
  id: 'reaction',
  emoji: '⚡',
  cls: 'rc-room',
  endTitle: 'הכי מהירים!',
  cover: () => `<rect width="160" height="100" fill="#103a2a"/><circle cx="80" cy="50" r="34" fill="#2ee59d" stroke="#fff" stroke-width="4"/><path d="M88 22 L64 56 H80 L72 80 L98 44 H82Z" fill="#fff"/>`,
  play(app, you, ctx, done) {
    const rd = you.round;
    app.innerHTML = `${ctx.topBar()}<div class="fb-play"><div class="fb-info" id="rci">בדיקה 1 מתוך ${rd.delays.length}</div><div class="rc-pad wait" id="rcp"><b>חכו…</b><small>הקישו כשהמסך הופך לירוק</small></div><div class="fb-info" id="rcr"></div></div>`;
    const pad = app.querySelector('#rcp');
    const times = [];
    let trial = 0;
    let greenAt = 0;
    let timer = 0;
    let ended = false;
    const finish = () => { if (!ended) { ended = true; clearTimeout(timer); done({ times }); } };
    const arm = () => {
      if (trial >= rd.delays.length) return finish();
      app.querySelector('#rci').textContent = `בדיקה ${trial + 1} מתוך ${rd.delays.length}`;
      pad.className = 'rc-pad wait';
      pad.innerHTML = '<b>חכו…</b><small>הקישו כשהמסך הופך לירוק</small>';
      greenAt = 0;
      timer = setTimeout(() => {
        greenAt = performance.now();
        pad.className = 'rc-pad go';
        pad.innerHTML = '<b>עכשיו!</b>';
        U.sfx('pop');
      }, rd.delays[trial]);
    };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (ended) return;
      if (!greenAt) {
        // too early: this trial scores nothing, and we wait a moment before the next one
        clearTimeout(timer);
        times.push(0);
        pad.className = 'rc-pad early';
        pad.innerHTML = '<b>מוקדם מדי!</b>';
        U.sfx('bad');
        trial++;
        timer = setTimeout(arm, 1100);
        return;
      }
      const t = Math.round(performance.now() - greenAt);
      times.push(t);
      pad.className = 'rc-pad done';
      pad.innerHTML = `<b>${t}</b><small>אלפיות השנייה</small>`;
      app.querySelector('#rcr').textContent = t <= 300 ? '⚡ מהיר מאוד!' : t <= 450 ? '👍 יפה' : '🙂 אפשר מהר יותר';
      U.sfx(t <= 450 ? 'coin' : 'tick');
      greenAt = 0;
      trial++;
      timer = setTimeout(arm, 1100);
    });
    arm();
    setTimeout(finish, rd.ms);
  },
});
