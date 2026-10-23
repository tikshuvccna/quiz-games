// Client side of "בורחים מהזומבים": a dusk street chase on the host, swipe-the-obstacle parkour on the phone.
(function () {
  const O = Art.O;

  Art.addDefs('zb-defs', `
    <linearGradient id="zb-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8f07a"/><stop offset="1" stop-color="#6fb83f"/></linearGradient>
    <linearGradient id="zb-house" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9c2"/><stop offset="1" stop-color="#f0c27a"/></linearGradient>
    <radialGradient id="zb-glow" cx=".5" cy=".6" r=".7"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#8af5c8" stop-opacity=".7"/></radialGradient>
    <linearGradient id="cv-zb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1f6b"/><stop offset=".6" stop-color="#b8487a"/><stop offset="1" stop-color="#ff9a5c"/></linearGradient>`);

  // ---------- art ----------
  const SHIRTS = ['#8a5cd6', '#e5655c', '#3b8eff', '#e6a400'];
  const zombie = (i = 0) => `<svg class="art zb-zombie-art" viewBox="0 0 80 110" aria-hidden="true">
    <ellipse cx="40" cy="106" rx="22" ry="4" fill="#000" opacity=".3"/>
    <g class="zb-legA"><path d="M34 74 L30 102" stroke="${O}" stroke-width="10" stroke-linecap="round"/><path d="M34 74 L30 102" stroke="#4a5371" stroke-width="6" stroke-linecap="round"/></g>
    <g class="zb-legB"><path d="M46 74 L50 102" stroke="${O}" stroke-width="10" stroke-linecap="round"/><path d="M46 74 L50 102" stroke="#4a5371" stroke-width="6" stroke-linecap="round"/></g>
    <path d="M24 46 C24 38 56 38 56 46 L54 78 H26Z" fill="${SHIRTS[i % SHIRTS.length]}" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M30 78 L34 70 L38 78 L44 70 L48 78" fill="none" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
    <g class="zb-arms"><path d="M30 50 L66 52" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M30 50 L66 52" stroke="url(#zb-skin)" stroke-width="5" stroke-linecap="round"/>
      <path d="M48 58 L74 60" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M48 58 L74 60" stroke="url(#zb-skin)" stroke-width="5" stroke-linecap="round"/></g>
    <g class="zb-head"><path d="M22 24 C22 8 58 6 58 24 C58 38 50 44 40 44 C30 44 22 38 22 24Z" fill="url(#zb-skin)" stroke="${O}" stroke-width="3.5"/>
      <circle cx="34" cy="24" r="7" fill="#fff" stroke="${O}" stroke-width="2.5"/><circle cx="36" cy="25" r="2.6" fill="${O}"/>
      <circle cx="49" cy="25" r="4.5" fill="#fff" stroke="${O}" stroke-width="2.5"/><circle cx="50" cy="25" r="1.8" fill="${O}"/>
      <path d="M32 35 C38 39 46 39 52 34" fill="#7d1f3a" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/><path d="M42 37 C43 41 47 41 47 37" fill="#ff8fb8" stroke="${O}" stroke-width="1.5"/>
      <path d="M26 14 L32 18 M28 10 L30 18" stroke="${O}" stroke-width="2" stroke-linecap="round"/><path d="M50 12 L54 6 M54 14 L58 9" stroke="#4a5371" stroke-width="3" stroke-linecap="round"/>
      <path d="M27 18 C30 13 36 11 40 11" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".5"/></g>
  </svg>`;

  const house = () => `<svg class="art" viewBox="0 0 140 130" aria-hidden="true">
    <ellipse cx="70" cy="126" rx="64" ry="5" fill="#000" opacity=".3"/>
    <path d="M18 60 V124 H122 V60" fill="url(#zb-house)" stroke="${O}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M6 64 L70 12 L134 64Z" fill="#e5304d" stroke="${O}" stroke-width="5" stroke-linejoin="round"/><path d="M24 54 L70 18" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".4"/>
    <rect x="54" y="80" width="32" height="44" rx="4" fill="url(#zb-glow)" stroke="${O}" stroke-width="4"/>
    <rect x="28" y="74" width="20" height="18" rx="3" fill="#fff35c" stroke="${O}" stroke-width="3.5"/><rect x="92" y="74" width="20" height="18" rx="3" fill="#fff35c" stroke="${O}" stroke-width="3.5"/>
    <rect x="34" y="34" width="72" height="20" rx="6" fill="#17c97e" stroke="${O}" stroke-width="3.5"/>
    <text x="70" y="48.5" text-anchor="middle" font-family="Heebo,sans-serif" font-weight="900" font-size="12" fill="#fff">בית מבטחים</text>
  </svg>`;

  // the phone's obstacles: up = jump the barrier, down = slide under the bar, left / right = zombies block the other lanes
  const barrier = () => `<svg class="art" viewBox="0 0 120 60" aria-hidden="true"><path d="M14 58 V30 M106 58 V30" stroke="${O}" stroke-width="7" stroke-linecap="round"/><rect x="4" y="16" width="112" height="22" rx="5" fill="#fff" stroke="${O}" stroke-width="4"/>${[0, 1, 2, 3, 4].map((k) => `<path d="M${12 + k * 22} 36 L${26 + k * 22} 18" stroke="#ff8a3d" stroke-width="9"/>`).join('')}<rect x="4" y="16" width="112" height="22" rx="5" fill="none" stroke="${O}" stroke-width="4"/></svg>`;
  const bar = () => `<svg class="art" viewBox="0 0 120 60" aria-hidden="true"><path d="M8 58 V6 M112 58 V6" stroke="${O}" stroke-width="7" stroke-linecap="round"/><path d="M8 58 V6 M112 58 V6" stroke="#7f8ba8" stroke-width="3" stroke-linecap="round"/><rect x="4" y="4" width="112" height="16" rx="5" fill="#ffd23f" stroke="${O}" stroke-width="4"/>${[0, 1, 2, 3].map((k) => `<path d="M${16 + k * 26} 18 L${28 + k * 26} 6" stroke="${O}" stroke-width="5"/>`).join('')}</svg>`;

  Art.covers.zombie = () => `<rect width="160" height="100" fill="url(#cv-zb)"/>
    <circle cx="128" cy="20" r="11" fill="#fff6cc"/>
    <path d="M0 70 V40 H18 V28 H34 V46 H50 V34 H66 V70Z M100 70 V36 H118 V44 H136 V30 H160 V70Z" fill="#2a1747"/>
    <rect y="70" width="160" height="30" fill="#3b3550"/><path d="M0 86 H160" stroke="#fff" stroke-width="2.5" stroke-dasharray="12 10" opacity=".6"/>
    <g transform="translate(2 40) scale(.46)">${Art.inner(zombie(0))}</g><g transform="translate(24 46) scale(.4)">${Art.inner(zombie(1))}</g>
    <g transform="translate(78 48) scale(.46)">${Art.inner(Chase.kid('#ff5a5f'))}</g><g transform="translate(100 46) scale(.46)">${Art.inner(Chase.kid('#3b8eff'))}</g>
    <g transform="translate(122 46) scale(.28)">${Art.inner(house())}</g>`;

  const THEME = {
    mash: { icon: '🔨', title: 'בנו מחסום!', sub: 'הקישו הכי מהר שאפשר כדי לדפוק מסמרים', host: 'בונים מחסום נגד הזומבים!' },
    code: { icon: '🔐', title: 'קוד השער', sub: 'הקלידו בטלפון את הקוד שעל המסך הגדול', host: 'הקלידו את הקוד לשער:' },
    pop: { icon: '🍌', title: 'זרקו בננות', sub: 'געו בכל בננה כדי להחליק את הזומבים', host: 'מחליקים זומבים על בננות!', spark: '🍌' },
  };
  const ARROW = { up: '⬆', down: '⬇', left: '⬅', right: '➡' };

  Games.zombie = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      Chase.hostFrame(app, st, {
        id: 'zombie',
        cls: 'zb-street',
        goal: '🏠 הדרך לבית המבטחים',
        gapLabel: '🧟 הזומבים מאחור',
        color: '#5a2d91',
        icons: ['🧟', '🏃', '🏠'],
        stage: `<div class="zb-moon"></div><div class="zb-city far"></div><div class="zb-city"></div>
          <div class="zb-lamps"><i></i><i></i><i></i></div>
          <div class="zb-road"></div>
          <div class="zb-house" id="house">${house()}</div>
          <div class="zb-horde" id="horde">${[0, 1, 2, 3].map((i) => `<div class="zb-z" style="--i:${i}">${zombie(i)}</div>`).join('')}</div>
          <div class="ch-pack zb-pack" id="pack"></div>`,
      });
      const u = Chase.hostUpdate(st, `${st.players.length} רצים · כולם ביחד`, (e) => this.fx(e));
      u.stage.style.setProperty('--zx', -4 + (1 - u.near) * 28 + '%');
      u.stage.style.setProperty('--house', Math.max(0, (u.p - 0.8) / 0.2));
      Chase.pack(document.getElementById('pack'), b.runners, (n) => Chase.kid(U.color(n)));
      Chase.host(u.stage, b.mini, THEME);
    },

    fx(e) {
      const stage = document.getElementById('stage');
      if (e.kind === 'boost') {
        const el = Chase.member(e.name) || document.getElementById('pack');
        U.bump(el, e.perfect ? 'ch-go-big' : 'ch-go');
        Chase.boostFx(stage, el, e, ['#fff', '#8af5c8', '#ffd23f']);
      } else if (e.kind === 'caught') {
        U.bump(document.getElementById('horde'), 'zb-lunge');
      } else if (e.kind === 'rage') {
        U.bump(document.getElementById('horde'), 'zb-rage');
      }
    },

    hostEnded(app, st) {
      if (!U.view(app, 'zombie-end')) return;
      const r = st.results;
      U.hostResults(app, st, {
        lost: !r.victory,
        title: r.victory ? '🏠 הגענו לבית המבטחים!' : `רצנו ${r.pct}% מהדרך`,
        sub: r.victory ? `כל הכבוד לכל הכיתה!${r.catches ? ` (הזומבים השיגו אותנו ${r.catches} פעמים)` : ''}` : 'הזומבים ניצחו הפעם. בסיבוב הבא נברח!',
        body: `<div class="end-visual zb-end ${r.victory ? 'win' : ''}"><div class="zb-end-house">${house()}</div><div class="zb-end-horde">${[0, 1, 2].map((i) => zombie(i)).join('')}</div><div class="zb-end-run">${['#ff5a5f', '#3b8eff', '#2ee59d'].map((c) => Chase.kid(c)).join('')}</div></div>`,
        table: Chase.table(r, '🏃', 'ריצה מושלמת'),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">🏃 ${you.dist}</span><span class="hchip">🏠 ${you.pct}%</span>`;
    },

    playerPhase(app, you, ctx) {
      if (Chase.phone(app, you, ctx, THEME)) return true;
      if (you.phase === 'dash') {
        if (!ctx.setView('dash' + you.qid + ':' + you.turn)) return true;
        this.dash(app, you, ctx);
        return true;
      }
      if (you.phase === 'dashed') {
        if (!ctx.setView('dashed' + you.qid + ':' + you.turn)) return true;
        const s = you.res;
        const color = ctx.teamColor() === '#7c4dff' ? U.color(you.name) : ctx.teamColor();
        Chase.resultScreen(app, ctx, {
          art: Chase.kid(color),
          cls: 'zb-go',
          gain: s.gain,
          bad: s.ok <= 1,
          title: s.perfect ? 'פארקור מושלם! ⚡' : `${s.ok} מתוך 5 מכשולים`,
          pill: `🧟 הזומבים ${you.gap} מטר מאחור`,
        });
        return true;
      }
      return false;
    },

    // obstacles rush in one after another; swipe the right way before each one arrives
    dash(app, you, ctx) {
      const obs = you.act.obs;
      const color = ctx.teamColor() === '#7c4dff' ? U.color(you.name) : ctx.teamColor();
      app.innerHTML = `${ctx.topBar()}
        <div class="phase-title">החליקו לכיוון הנכון!<small>⬆ קפיצה · ⬇ התכופפות · ⬅ ➡ התחמקות</small></div>
        <div class="p-stage zb-phone" id="zp">
          <div class="zb-psky"></div><div class="zb-proad"><i></i><i></i></div>
          <div class="zb-obs" id="obs"></div>
          <div class="zb-me" id="me" style="--lane:0">${Chase.kid(color)}</div>
          <div class="zb-chasers">${zombie(0)}${zombie(2)}</div>
          <div class="zb-marks" id="marks">${obs.map(() => '<i></i>').join('')}</div>
          <div class="zb-swipe" id="hint">👆 החליקו</div>
        </div>`;
      const stage = document.getElementById('zp');
      const box = document.getElementById('obs');
      const me = document.getElementById('me');
      const marks = document.getElementById('marks');
      const moves = [];
      let i = -1;
      let move = null;
      let done = false;
      // a view replaced mid-run (a checkpoint game started) must not send its moves later
      const show = () => {
        if (!stage.isConnected) return;
        i++;
        move = null;
        me.style.setProperty('--lane', 0);
        me.className = 'zb-me';
        if (i >= obs.length) {
          done = true;
          return setTimeout(() => ctx.act('dash', { moves }), 300);
        }
        const o = obs[i];
        const ms = Math.max(1050, 1500 - i * 90);
        const art = o === 'up' ? barrier() : o === 'down' ? bar() : `<div class="zb-block">${zombie(1)}${zombie(3)}</div>`;
        box.className = `zb-obs ${o}`;
        box.innerHTML = `<div class="zb-thing">${art}</div><b class="zb-arrow">${ARROW[o]}</b>`;
        box.style.setProperty('--ms', ms + 'ms');
        void box.offsetWidth;
        box.classList.add('go');
        setTimeout(arrive, ms);
      };
      const arrive = () => {
        if (!stage.isConnected) return;
        const ok = move === obs[i];
        moves.push(move);
        marks.children[i].classList.add(ok ? 'ok' : 'bad');
        if (ok) {
          U.sfx('coin');
          if (navigator.vibrate) navigator.vibrate(10);
        } else {
          U.sfx('bad');
          U.shake(stage);
          me.classList.add('trip');
          if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        }
        box.classList.add('past');
        setTimeout(show, 280);
      };
      const swipe = (dir) => {
        if (done || i < 0 || i >= obs.length || move) return;
        move = dir;
        document.getElementById('hint').style.opacity = 0;
        me.classList.add('do-' + dir);
        if (dir === 'left' || dir === 'right') me.style.setProperty('--lane', dir === 'left' ? -1 : 1);
        U.sfx('pop');
      };
      let sx = 0;
      let sy = 0;
      let down = false;
      stage.addEventListener('pointerdown', (e) => { e.preventDefault(); down = true; sx = e.clientX; sy = e.clientY; });
      const end = (e) => {
        if (!down) return;
        down = false;
        const dx = e.clientX - sx;
        const dy = e.clientY - sy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        swipe(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
      };
      stage.addEventListener('pointerup', end);
      stage.addEventListener('pointercancel', () => (down = false));
      // a computer's arrow keys work too
      const keys = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      const onKey = (e) => {
        if (!stage.isConnected) return removeEventListener('keydown', onKey);
        if (keys[e.key]) { e.preventDefault(); swipe(keys[e.key]); }
      };
      addEventListener('keydown', onKey);
      setTimeout(show, 500);
    },

    onBoard() {},

    playerEnded(app, you) {
      return Chase.playerEnded(you, { win: 'הגענו לבית המבטחים!', lose: 'רצנו {pct}% מהדרך', line: 'ריצות מושלמות' });
    },
  };
})();
