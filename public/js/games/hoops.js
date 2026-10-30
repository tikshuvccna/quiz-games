// "סל": three shots. Tap to stop the moving aim over the hoop, tap again to stop the power in the green zone.
FfaBoard.make({
  id: 'hoops',
  emoji: '🏀',
  cls: 'hp-room',
  endTitle: 'מלך/ת הסלים!',
  cover: () => `<rect width="160" height="100" fill="#c7843c"/><rect y="70" width="160" height="30" fill="#a96a2a"/>
    <rect x="52" y="10" width="56" height="34" rx="3" fill="#fff" stroke="#222" stroke-width="3"/><rect x="68" y="26" width="24" height="14" fill="none" stroke="#ff5a1f" stroke-width="3"/>
    <path d="M70 40 L74 56 M90 40 L86 56 M78 40 L80 56" stroke="#fff" stroke-width="2"/><circle cx="80" cy="76" r="12" fill="#ff7a1a" stroke="#222" stroke-width="3"/><path d="M68 76 H92 M80 64 V88" stroke="#222" stroke-width="2"/>`,
  play(app, you, ctx, done) {
    const rd = you.round;
    const shots = rd.shots;
    const BANDS = [[rd.bands[0], 'swish', 'קליעה נקייה! 🌟', '#ffd23f'], [rd.bands[1], 'basket', 'סל!', '#2ee59d'], [rd.bands[2], 'rim', 'כמעט… על הטבעת', '#fff']];
    app.innerHTML = `${ctx.topBar()}<div class="fb-play hp-play"><div class="fb-info" id="hpi"></div><div class="fb-judge" id="hpj"></div>
      <div class="hp-court" id="hpc"><div class="hp-hoop" id="hph"><i class="hp-board"></i><i class="hp-rim"></i><i class="hp-net"></i></div>
        <div class="hp-ball" id="hpb"></div><i class="hp-aimline" id="hpa"></i></div>
      <div class="hp-meter"><div class="hp-zone" id="hpz"></div><div class="hp-mark" id="hpm"></div></div>
      <button class="btn big hp-btn" id="hpt">עצרו כיוון</button></div>`;
    const $ = (id) => app.querySelector('#' + id);
    const out = [];
    let shot = 0;
    let stage = 'aim'; // aim | power | fly
    let aimed = 0;
    let t = 0;
    let raf = 0;
    let dead = false;
    const judge = (txt, color) => { const j = $('hpj'); j.textContent = txt; j.style.color = color; j.classList.remove('pop'); void j.offsetWidth; j.classList.add('pop'); };

    function setup() {
      const s = shots[shot];
      stage = 'aim';
      t = 0;
      $('hpi').textContent = `זריקה ${shot + 1} מתוך ${shots.length}`;
      $('hph').style.left = s.x * 100 + '%';
      $('hpz').style.left = (s.p - rd.bands[1]) * 100 + '%';
      $('hpz').style.width = rd.bands[1] * 2 * 100 + '%';
      $('hpm').style.display = 'none';
      $('hpa').style.display = '';
      $('hpt').textContent = 'עצרו כיוון';
      const b = $('hpb');
      b.style.transition = 'none';
      b.style.left = '50%';
      b.style.top = '82%';
      b.style.transform = 'translate(-50%, -50%) scale(1)';
    }
    function loop(now) {
      if (dead || !$('hpc')) { dead = true; return; } // the screen was replaced (the round ended on the server)
      t = (now - (loop.t0 || now)) / 1000;
      if (stage === 'aim') {
        aimed = 0.5 + 0.5 * Math.sin(t * 2.6 + shot);
        $('hpa').style.left = aimed * 100 + '%';
        $('hpb').style.left = aimed * 100 + '%';
      } else if (stage === 'power') {
        powerV = 0.5 + 0.5 * Math.sin(t * 3.1 + shot * 1.3);
        $('hpm').style.left = powerV * 100 + '%';
      }
      raf = requestAnimationFrame(loop);
    }
    let powerV = 0;
    function tap() {
      if (stage === 'aim') {
        stage = 'power';
        loop.t0 = performance.now();
        $('hpa').style.display = 'none';
        $('hpm').style.display = '';
        $('hpt').textContent = 'עצרו כוח';
        U.sfx('tick');
      } else if (stage === 'power') {
        stage = 'fly';
        U.sfx('pop');
        out.push([+aimed.toFixed(3), +powerV.toFixed(3)]);
        const s = shots[shot];
        const d = Math.max(Math.abs(aimed - s.x), Math.abs(powerV - s.p));
        const band = BANDS.find((b) => d <= b[0]);
        const b = $('hpb');
        // the ball flies to the hoop, or falls short / long / wide by how far off the shot was
        const err = (powerV - s.p) * 60;
        b.style.transition = 'left .7s ease-out, top .7s cubic-bezier(.2,.8,.3,1), transform .7s';
        b.style.left = (band ? s.x * 100 : Math.max(4, Math.min(96, aimed * 100))) + '%';
        b.style.top = band ? '22%' : (34 - err) + '%';
        b.style.transform = 'translate(-50%, -50%) scale(.6)';
        setTimeout(() => {
          if (dead) return;
          if (band) { judge(band[2], band[3]); U.sfx(band[1] === 'swish' ? 'good' : 'coin'); if (band[1] !== 'rim') U.burst($('hpc'), $('hpc').clientWidth * s.x, $('hpc').clientHeight * 0.22, ['#ffd23f', '#fff', '#ff7a1a'], 14, 90); }
          else { judge('החטאה', '#ff6b8a'); U.sfx('bad'); }
        }, 650);
        setTimeout(() => {
          if (dead) return;
          shot++;
          if (shot >= shots.length) { dead = true; cancelAnimationFrame(raf); done({ shots: out }); } else { loop.t0 = performance.now(); setup(); }
        }, 1500);
      }
    }
    app.querySelector('.hp-play').addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
    setup();
    raf = requestAnimationFrame((n) => { loop.t0 = n; loop(n); });
  },
});
