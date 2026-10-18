// Client side of "פנדלים": a stadium goal on the host, pick-a-corner kick on the phone.
// The same goal scene + kick animation is used on both screens.
(function () {
  const { esc } = U;
  const KEEPER = '#ffd23f';


  // goal scene (zones = clickable spots on the phone)
  const scene = (zones = false, kickerColor = '#f2434f') => `
    <div class="pk-scene">
      <div class="pk-crowd"><i></i><i></i><i></i></div>
      <div class="pk-pitch"><div class="pk-box"></div><div class="pk-spot"></div></div>
      <div class="pk-goal">
        <div class="pk-net"></div>
        ${zones ? `<div class="pk-zones">${[0, 1, 2, 3, 4, 5].map((z) => `<button class="pk-zone" data-z="${z}"><span>${Art.ball()}</span></button>`).join('')}</div>` : ''}
        <div class="pk-keeper">${Art.goalie(KEEPER)}</div>
      </div>
      <div class="pk-kicker">${Art.kicker(kickerColor)}</div>
      <div class="pk-ball">${Art.ball()}</div>
      <div class="pk-banner"></div>
    </div>`;

  // animate one kick inside a scene element; cb runs when the result is shown
  function playKick(sc, k, opts = {}) {
    const goal = sc.querySelector('.pk-goal');
    const ball = sc.querySelector('.pk-ball');
    const keeper = sc.querySelector('.pk-keeper');
    const kicker = sc.querySelector('.pk-kicker');
    const banner = sc.querySelector('.pk-banner');
    ball.getAnimations().forEach((a) => a.cancel());
    keeper.getAnimations().forEach((a) => a.cancel());
    banner.className = 'pk-banner';
    banner.textContent = '';
    const s = sc.getBoundingClientRect();
    const g = goal.getBoundingClientRect();
    const b = ball.getBoundingClientRect();
    const col = k.zone % 3;
    const row = Math.floor(k.zone / 3);
    let tx = g.left + g.width * (col * 0.33 + 0.165) - (b.left + b.width / 2);
    let ty = g.top + g.height * (row ? 0.7 : 0.27) - (b.top + b.height / 2);
    if (k.post) tx = g.left + (col === 0 ? 0.02 : 0.98) * g.width - (b.left + b.width / 2);
    if (k.post) ty = g.top + g.height * 0.05 - (b.top + b.height / 2);
    U.bump(kicker, 'kick');
    const flight = ball.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1) rotate(0)' },
        { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(.5) rotate(540deg)` },
      ],
      { duration: 520, delay: 180, easing: 'cubic-bezier(.15,.7,.35,1)', fill: 'forwards' }
    );
    // keeper dives toward his guess (a power shot only lets him reach one row)
    const kdx = (k.keeperCol - 1) * g.width * 0.32;
    const up = k.keeperRow === 0 ? -g.height * 0.28 : k.keeperRow === 1 ? g.height * 0.08 : -g.height * 0.12;
    const rot = k.keeperCol === 0 ? -70 : k.keeperCol === 2 ? 70 : 0;
    keeper.animate(
      [{ transform: 'translateX(-50%)' }, { transform: `translate(calc(-50% + ${kdx}px), ${up}px) rotate(${rot}deg)` }],
      { duration: 420, delay: 260, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }
    );
    flight.onfinish = () => {
      const label = k.goal ? 'גוֹל!' : k.post ? 'עמוד!' : 'הצלה!';
      banner.textContent = label;
      banner.className = 'pk-banner show ' + (k.goal ? 'pk-goal-hit' : 'pk-miss');
      if (opts.name) banner.insertAdjacentHTML('beforeend', `<small>${esc(opts.name)}</small>`);
      const bx = b.left - s.left + b.width / 2 + tx;
      const by = b.top - s.top + b.height / 2 + ty;
      if (k.goal) {
        U.bump(goal.querySelector('.pk-net'), 'ripple');
        U.burst(sc, bx, by, ['#fff', '#ffd23f', opts.color || '#2ee59d'], 22, 140);
        U.sfx('win');
      } else {
        // the ball bounces away
        ball.animate(
          [
            { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(.5)` },
            { transform: `translate(calc(-50% + ${tx * 1.4 + (col === 1 ? 60 : 0)}px), calc(-50% + ${ty * 0.3}px)) scale(.6) rotate(-300deg)`, opacity: 0 },
          ],
          { duration: 600, easing: 'ease-out', fill: 'forwards' }
        );
        U.sfx('bad');
        if (k.post) U.shake(goal);
      }
      if (opts.done) opts.done();
    };
  }

  Games.penalty = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'penalty',
        cls: 'stadium',
        stats: U.teamBadges(b.teams),
        stage: `${scene(false)}<div class="pk-taker" id="taker"></div>`,
      })) {
        this.seen = b.ev.length ? b.ev[b.ev.length - 1].id : 0;
        this.queue = [];
        this.busy = false;
      }
      b.teams.forEach((_, i) => {
        U.countTo(document.getElementById('ts' + i), b.goals[i]);
        document.getElementById('tsub' + i).textContent = `${b.shots[i]} בעיטות · ${b.size[i]} שחקנים`;
      });
      U.teamLead(b.goals);
      U.hostTick(st, `${st.players.length} שחקנים · דו־קרב פנדלים`);
      for (const e of b.ev) {
        if (e.id <= this.seen) continue;
        this.seen = e.id;
        this.queue.push(e);
      }
      if (this.queue.length > 3) this.queue = this.queue.slice(-2); // big classes: show only the freshest kicks
      this.next(b);
    },

    next(b) {
      if (this.busy || !this.queue.length) return;
      const sc = document.querySelector('#stage .pk-scene');
      if (!sc) return;
      const e = this.queue.shift();
      this.busy = true;
      const color = b.teams[e.team].color;
      sc.querySelector('.pk-kicker').innerHTML = Art.kicker(color);
      const taker = document.getElementById('taker');
      taker.innerHTML = `${U.avatar(e.name, color)}<b>${esc(e.name)}</b><span>בועט/ת…</span>`;
      taker.style.setProperty('--tc', color);
      U.bump(taker, 'popin-b');
      playKick(sc, e, { name: e.name, color });
      setTimeout(() => {
        this.busy = false;
        const cur = document.querySelector('#stage .pk-scene');
        if (cur === sc) this.next(b);
      }, this.queue.length ? 1500 : 2100);
    },

    hostEnded(app, st) {
      if (!U.view(app, 'penalty-end')) return;
      const r = st.results;
      U.hostResults(app, st, {
        title: r.winner < 0 ? 'תיקו!' : `${esc(r.teams[r.winner].name)} ניצחו!`,
        sub: `שערים · ${r.shots[0] + r.shots[1]} בעיטות`,
        body: `<div class="end-visual tug-end">${U.teamsMini(r.teams, r.goals, r.winner, 'team-final')}</div>`,
        table: U.table(r.players, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name, r.teams[p.team].color)}${esc(p.name)}</span>`],
          ['שערים', (p) => `⚽ ${p.scored}`],
          ['בעיטות', (p) => p.kicks],
          ['נכונות', (p) => p.correct],
        ], 10),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">⚽ ${you.scored}</span><span class="hchip">${you.goals[1]} : ${you.goals[0]}</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase === 'kick') {
        if (!ctx.setView('kick' + you.qid + ':' + you.turn)) return true;
        app.innerHTML = `${ctx.topBar()}
          <div class="timebar"><i style="animation-duration:6000ms"></i></div>
          <div class="phase-title">${you.power ? '⚡ בעיטת עוצמה! ' : ''}לאן בועטים?<small>${you.power ? 'השוער יספיק לכסות רק חצי מהשער' : 'הפינות העליונות מסוכנות: לפעמים פוגעים בעמוד'}</small></div>
          <div class="p-stage pk-phone">${scene(true, ctx.teamColor())}</div>`;
        const sc = app.querySelector('.pk-scene');
        if (you.power) sc.classList.add('power');
        let done = false;
        sc.querySelector('.pk-zones').onclick = (e) => {
          const z = e.target.closest('.pk-zone');
          if (!z || done) return;
          done = true;
          z.classList.add('picked');
          sc.querySelector('.pk-zones').classList.add('locked');
          U.sfx('pop');
          if (navigator.vibrate) navigator.vibrate(15);
          ctx.act('kick', { zone: Number(z.dataset.z) });
        };
        return true;
      }
      if (you.phase === 'kicked') {
        if (!ctx.setView('kicked' + you.qid + ':' + you.turn)) return true;
        const k = you.kick;
        let sc = app.querySelector('.pk-scene');
        if (!sc) {
          app.innerHTML = `${ctx.topBar()}<div class="phase-title">הבעיטה!</div><div class="p-stage pk-phone">${scene(false, ctx.teamColor())}</div>`;
          sc = app.querySelector('.pk-scene');
        } else {
          app.querySelector('.timebar')?.remove();
          sc.querySelector('.pk-zones')?.classList.add('gone');
        }
        playKick(sc, k, {
          color: ctx.teamColor(),
          done: () => {
            const t = app.querySelector('.phase-title');
            if (t) t.innerHTML = k.goal ? `<span class="good-t">גול! +1 ל${you.teamName || 'קבוצה'}</span>` : k.post ? '<span class="bad-t">פגעתם בעמוד…</span>' : '<span class="bad-t">השוער עצר!</span>';
            if (k.goal && navigator.vibrate) navigator.vibrate([20, 40, 20]);
          },
        });
        return true;
      }
      return false;
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results;
      const mine = r.players.find((p) => p.name === you.name) || { scored: 0, kicks: 0, correct: 0 };
      const win = r.winner === you.team;
      return U.playerResult({
        win,
        title: r.winner < 0 ? 'תיקו!' : win ? 'הקבוצה שלכם ניצחה!' : 'כמעט! בפעם הבאה',
        extra: U.teamsMini(r.teams, r.goals, r.winner),
        lines: [`⚽ ${mine.scored} שערים מתוך ${mine.kicks} בעיטות`, `✅ ${mine.correct} תשובות נכונות`],
      });
    },
  };
})();
