// "חפרפרות": nine holes, moles pop up, tap them (not the bombs).
FfaBoard.make({
  id: 'mole',
  emoji: '🔨',
  cls: 'ml-room',
  endTitle: 'מלך/ת החפרפרות!',
  cover: () => `<rect width="160" height="100" fill="#7ed957"/><rect y="46" width="160" height="54" fill="#8a5a2b"/>
    ${[0, 1, 2].map((r) => [0, 1, 2].map((c) => `<ellipse cx="${34 + c * 46}" cy="${58 + r * 17}" rx="15" ry="6" fill="#3b2410"/>`).join('')).join('')}
    <text x="60" y="52" font-size="26">🐹</text><text x="104" y="68" font-size="22">🔨</text><text x="16" y="70" font-size="20">🐹</text>`,
  play(app, you, ctx, done) {
    const rd = you.round;
    app.innerHTML = `${ctx.topBar()}<div class="fb-play"><div class="fb-timer"><i style="animation-duration:${rd.ms}ms"></i></div><div class="fb-judge" id="mlj"></div>
      <div class="ml-grid">${Array.from({ length: 9 }, (_, h) => `<div class="ml-hole" data-h="${h}"><i class="ml-mole"></i></div>`).join('')}</div></div>`;
    const holes = [...app.querySelectorAll('.ml-hole')];
    const judge = app.querySelector('#mlj');
    const say = (t, color) => { judge.textContent = t; judge.style.color = color; judge.classList.remove('pop'); void judge.offsetWidth; judge.classList.add('pop'); };
    const t0 = performance.now();
    const taps = [];
    rd.events.forEach((e) => {
      setTimeout(() => { const el = holes[e.h]; el.classList.add('up'); el.classList.toggle('bomb', e.b); el.dataset.live = '1'; }, e.t);
      setTimeout(() => { const el = holes[e.h]; el.classList.remove('up'); delete el.dataset.live; }, e.t + e.d);
    });
    app.querySelector('.ml-grid').addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.ml-hole');
      if (!el) return;
      e.preventDefault();
      taps.push([Number(el.dataset.h), Math.round(performance.now() - t0)]);
      if (el.dataset.live) {
        const bomb = el.classList.contains('bomb');
        el.classList.remove('up');
        delete el.dataset.live;
        el.classList.add(bomb ? 'boom' : 'whack');
        setTimeout(() => el.classList.remove('boom', 'whack'), 300);
        say(bomb ? '💥 פצצה!' : 'פוצץ!', bomb ? '#ff6b8a' : '#ffd23f');
        U.sfx(bomb ? 'bad' : 'coin');
        if (navigator.vibrate) navigator.vibrate(bomb ? [40, 30, 40] : 15);
      } else U.sfx('tick');
    });
    setTimeout(() => done({ taps }), rd.ms + 150);
  },
});
