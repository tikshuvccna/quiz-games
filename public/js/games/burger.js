// "המבורגריה": memorize the burger's layers, then stack them in the same order.
(function () {
  const L = [
    { n: 'לחמנייה (תחתונה)', c: '#e8a64e', t: '#7a4a10' }, // 0
    { n: 'חסה', c: '#52c75a', t: '#0f4a14' }, // 1
    { n: 'עגבנייה', c: '#ff5a4f', t: '#5a0f0a' }, // 2
    { n: 'גבינה', c: '#ffd23f', t: '#6a4a00' }, // 3
    { n: 'קציצה', c: '#8a4a2a', t: '#fff' }, // 4
    { n: 'בצל', c: '#c9a3e8', t: '#3a1a5a' }, // 5
    { n: 'מלפפון חמוץ', c: '#2f8f4a', t: '#fff' }, // 6
    { n: 'לחמנייה (עליונה)', c: '#f2b45e', t: '#7a4a10' }, // 7
  ];
  const layer = (i, extra = '') => `<div class="brg-layer ${extra}" style="--c:${L[i].c};--t:${L[i].t}" data-i="${i}">${L[i].n}</div>`;
  const stack = (arr, label) => `<div class="brg-stack"><small>${label}</small><div class="brg-plate">${[...arr].reverse().map((i, k) => layer(i, k === 0 ? 'last' : '')).join('')}</div></div>`;

  FfaBoard.make({
    id: 'burger',
    emoji: '🍔',
    cls: 'brg-room',
    endTitle: 'השף/ית המצטיין/ת!',
    cover: () => `<rect width="160" height="100" fill="#ffb347"/><rect y="78" width="160" height="22" fill="#d9822b"/>
      <rect x="44" y="64" width="72" height="12" rx="6" fill="#e8a64e" stroke="#7a4a10" stroke-width="2.5"/><rect x="40" y="56" width="80" height="8" rx="4" fill="#8a4a2a" stroke="#4a2410" stroke-width="2.5"/>
      <rect x="42" y="50" width="76" height="6" rx="3" fill="#ffd23f" stroke="#6a4a00" stroke-width="2"/><rect x="40" y="43" width="80" height="7" rx="3" fill="#52c75a" stroke="#0f4a14" stroke-width="2"/>
      <path d="M44 43 C44 22 116 22 116 43Z" fill="#f2b45e" stroke="#7a4a10" stroke-width="2.5"/>`,
    play(app, you, ctx, done) {
      const rd = you.round;
      const recipe = rd.recipe;
      app.innerHTML = `${ctx.topBar()}<div class="fb-play"><div class="fb-timer"><i style="animation-duration:${rd.ms}ms"></i></div>
        <div class="fb-info" id="brgi">זכרו את הסדר!</div>
        <div class="brg-stage" id="brgs">${stack(recipe, 'ההזמנה')}</div>
        <div class="brg-menu hidden" id="brgm">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<button class="brg-ing" data-i="${i}" style="--c:${L[i].c};--t:${L[i].t}">${L[i].n}</button>`).join('')}<button class="brg-ing undo" data-u="1">↩ מחיקה</button></div></div>`;
      const seq = [];
      let ended = false;
      const finish = () => {
        if (ended) return;
        ended = true;
        done({ seq });
      };
      setTimeout(() => {
        if (ended || !app.querySelector('#brgs')) return;
        app.querySelector('#brgi').textContent = 'עכשיו הרכיבו אותו!';
        const st = app.querySelector('#brgs');
        const draw = () => { st.innerHTML = stack(seq, `ההמבורגר שלכם (${seq.length}/${recipe.length})`); };
        draw();
        app.querySelector('#brgm').classList.remove('hidden');
        app.querySelector('#brgm').addEventListener('pointerdown', (e) => {
          const b = e.target.closest('.brg-ing');
          if (!b || ended) return;
          e.preventDefault();
          if (b.dataset.u) { seq.pop(); draw(); return; }
          seq.push(Number(b.dataset.i));
          U.sfx('pop');
          if (navigator.vibrate) navigator.vibrate(10);
          draw();
          if (seq.length >= recipe.length) setTimeout(finish, 450);
        });
      }, rd.showMs);
      setTimeout(finish, rd.ms);
    },
  });
})();
