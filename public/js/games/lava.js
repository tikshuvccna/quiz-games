// Client side of "הרצפה היא לבה": the class climbing out of a volcano on the host, stone-hopping on the phone.
(function () {
  const O = Art.O;

  Art.addDefs('lav-defs', `
    <linearGradient id="lav-hot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff07a"/><stop offset=".4" stop-color="#ff8a1f"/><stop offset="1" stop-color="#d11f1f"/></linearGradient>
    <linearGradient id="lav-cool" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9b4cc"/><stop offset=".55" stop-color="#6b7591"/><stop offset="1" stop-color="#3f4660"/></linearGradient>
    <linearGradient id="lav-flow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe14d"/><stop offset=".3" stop-color="#ff7a1a"/><stop offset="1" stop-color="#b3120f"/></linearGradient>
    <linearGradient id="cv-lav" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a5c"/><stop offset=".35" stop-color="#5a1e2e"/><stop offset="1" stop-color="#2a0f18"/></linearGradient>`);

  // ---------- art ----------
  // a stone ledge; hot ones glow and crack
  const stone = (hot) => `<svg class="art lav-stone-art" viewBox="0 0 100 50" aria-hidden="true">
    <ellipse cx="50" cy="44" rx="44" ry="6" fill="#000" opacity=".3"/>
    <path d="M6 22 C6 8 22 4 50 4 C78 4 94 8 94 22 C94 36 80 42 50 42 C20 42 6 36 6 22Z" fill="url(#${hot ? 'lav-hot' : 'lav-cool'})" stroke="${O}" stroke-width="4"/>
    ${hot ? `<path d="M30 10 L38 22 L32 30 M62 8 L56 20 L66 28 L60 38" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : `<path d="M20 14 C30 8 48 7 60 8" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".5"/><circle cx="70" cy="26" r="4" fill="#4a5371" opacity=".6"/><circle cx="34" cy="30" r="3" fill="#4a5371" opacity=".6"/>`}
  </svg>`;

  const wave = `<svg class="lav-wave" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true"><path d="M0 12 C25 2 25 2 50 10 C75 18 75 18 100 10 C125 2 125 2 150 10 C175 18 175 18 200 10 V20 H0Z" fill="#ffb02e"/><path d="M0 14 C25 6 25 6 50 13 C75 20 75 20 100 13 C125 6 125 6 150 13 C175 20 175 20 200 13" fill="none" stroke="#fff3a0" stroke-width="2.5"/></svg>`;

  Art.covers.lava = () => `<rect width="160" height="100" fill="url(#cv-lav)"/>
    <path d="M0 0 H34 L24 30 L30 60 L18 100 H0Z M160 0 H126 L136 34 L128 66 L142 100 H160Z" fill="#3a1a1f" stroke="#1e0c10" stroke-width="2"/>
    <g transform="translate(48 50) scale(.28)">${Art.inner(stone(false))}</g><g transform="translate(86 30) scale(.26)">${Art.inner(stone(true))}</g><g transform="translate(60 14) scale(.24)">${Art.inner(stone(false))}</g>
    <g transform="translate(56 26) scale(.36)">${Art.inner(Chase.kid('#ff5a5f', 'climb'))}</g><g transform="translate(88 44) scale(.34)">${Art.inner(Chase.kid('#3b8eff', 'climb'))}</g>
    <path d="M0 80 C20 72 40 86 60 78 C80 70 100 86 120 78 C140 70 150 80 160 76 V100 H0Z" fill="url(#lav-flow)"/>
    <path d="M0 80 C20 72 40 86 60 78 C80 70 100 86 120 78 C140 70 150 80 160 76" fill="none" stroke="#fff3a0" stroke-width="2"/>
    ${[[30, 70], [100, 64], [130, 56]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#ffd23f"/>`).join('')}`;

  const THEME = {
    mash: { icon: '🧊', title: 'קררו את הלבה!', sub: 'הקישו הכי מהר שאפשר כדי להתיז מים', host: 'מתיזים מים על הלבה!' },
    code: { icon: '🔐', title: 'קוד המעלית', sub: 'הקלידו בטלפון את הקוד שעל המסך הגדול', host: 'הקלידו את הקוד למעלית:' },
    pop: { icon: '💎', title: 'תפסו את הקריסטלים', sub: 'געו בכל קריסטל שנוצץ בסלע', host: 'אוספים קריסטלים בטלפונים!', spark: '💎' },
  };

  Games.lava = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      Chase.hostFrame(app, st, {
        id: 'lava',
        cls: 'lav-volcano',
        goal: '☁️ הדרך למעלה',
        gapLabel: '🌋 הלבה מתחת',
        color: '#a8321e',
        icons: ['🌋', '🧗', '☁️'],
        vertical: true,
        stage: `<div class="lav-rim" id="rim"><div class="lav-sky"></div></div>
          <div class="lav-wallL"></div><div class="lav-wallR"></div>
          <div class="lav-ledges">${[0, 1, 2, 3, 4].map((i) => `<i style="--i:${i}">${stone(i === 2)}</i>`).join('')}</div>
          <div class="ch-pack lav-pack" id="pack"></div>
          <div class="lav-embers">${'<i></i>'.repeat(12)}</div>
          <div class="lav-lava" id="lava">${wave}<div class="lav-bubbles"><i></i><i></i><i></i><i></i><i></i></div></div>`,
      });
      const u = Chase.hostUpdate(st, `${st.players.length} מטפסים · כולם ביחד`, (e) => this.fx(e));
      // the lava rises as it gains on the class; the crater rim with the sky appears near the top
      u.stage.style.setProperty('--lava', 7 + (1 - u.near) * 30 + '%');
      u.stage.style.setProperty('--rim', Math.max(0, (u.p - 0.75) / 0.25));
      Chase.pack(document.getElementById('pack'), b.runners, (n) => Chase.kid(U.color(n), 'climb'));
      Chase.host(u.stage, b.mini, THEME);
    },

    fx(e) {
      const stage = document.getElementById('stage');
      if (e.kind === 'boost') {
        const el = Chase.member(e.name) || document.getElementById('pack');
        U.bump(el, e.perfect ? 'ch-go-big' : 'ch-go');
        Chase.boostFx(stage, el, e, ['#fff', '#ffd23f', '#8af5c8']);
      } else if (e.kind === 'caught' || e.kind === 'rage') {
        U.bump(document.getElementById('lava'), e.kind === 'caught' ? 'lav-surge-big' : 'lav-surge');
      }
    },

    hostEnded(app, st) {
      if (!U.view(app, 'lava-end')) return;
      const r = st.results;
      U.hostResults(app, st, {
        lost: !r.victory,
        title: r.victory ? '☁️ יצאנו מהר הגעש!' : `טיפסנו ${r.pct}% מהדרך`,
        sub: r.victory ? `כל הכבוד לכל הכיתה!${r.catches ? ` (הלבה השיגה אותנו ${r.catches} פעמים)` : ''}` : 'הלבה ניצחה הפעם. בסיבוב הבא נגיע למעלה!',
        body: `<div class="end-visual lav-end ${r.victory ? 'win' : ''}"><div class="lav-sky"></div><div class="lav-end-kids">${['#ff5a5f', '#3b8eff', '#2ee59d'].map((c) => Chase.kid(c, 'climb')).join('')}</div><div class="lav-lava">${wave}</div></div>`,
        table: Chase.table(r, '🧗', 'טיפוס מושלם'),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">🧗 ${you.dist}</span><span class="hchip">☁️ ${you.pct}%</span>`;
    },

    playerPhase(app, you, ctx) {
      if (Chase.phone(app, you, ctx, THEME)) return true;
      if (you.phase === 'climb') {
        if (!ctx.setView('climb' + you.qid + ':' + you.turn)) return true;
        this.climb(app, you, ctx);
        return true;
      }
      if (you.phase === 'climbed') {
        if (!ctx.setView('climbed' + you.qid + ':' + you.turn)) return true;
        const s = you.res;
        const color = ctx.teamColor() === '#7c4dff' ? U.color(you.name) : ctx.teamColor();
        Chase.resultScreen(app, ctx, {
          art: Chase.kid(color, 'climb'),
          cls: 'lav-go',
          gain: s.gain,
          bad: s.fell,
          title: s.perfect ? 'טיפוס מושלם! 🧗' : s.fell ? 'האבן התפוררה! 🔥' : `${s.steps} קפיצות`,
          pill: `🌋 הלבה ${you.gap} מטר מתחת`,
        });
        return true;
      }
      return false;
    },

    // rows of three stones; tap a cool one on each row before the lava reaches your feet
    climb(app, you, ctx) {
      const rows = you.act.rows;
      const color = ctx.teamColor() === '#7c4dff' ? U.color(you.name) : ctx.teamColor();
      app.innerHTML = `${ctx.topBar()}
        <div class="phase-title">קפצו רק על אבנים קרירות!<small>אבן לוהטת 🔥 מתפוררת · מהר, הלבה עולה</small></div>
        <div class="p-stage lav-phone" id="lp">
          <div class="lav-pwall"></div>
          <div class="lav-col" id="col" style="--step:0"><div class="lav-row start" style="--r:-1"><span class="lav-stone cool" style="--k:1">${stone(false)}</span></div>${rows.map((r, ri) => `<div class="lav-row" data-r="${ri}" style="--r:${ri}">${r.map((h, k) => `<button class="lav-stone ${h ? 'hot' : 'cool'}" data-k="${k}" style="--k:${k}">${stone(h)}</button>`).join('')}</div>`).join('')}</div>
          <div class="lav-me" id="me" style="--k:1">${Chase.kid(color, 'climb')}</div>
          <div class="lav-plava" id="plava">${wave}</div>
          <div class="lav-steps" id="steps">${rows.map(() => '<i></i>').join('')}</div>
        </div>`;
      const stage = document.getElementById('lp');
      const col = document.getElementById('col');
      const me = document.getElementById('me');
      const lava = document.getElementById('plava');
      const steps = document.getElementById('steps');
      const picks = [];
      let row = 0;
      let timer = 0;
      let done = false;
      const finish = (why) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        stage.classList.add(why);
        setTimeout(() => stage.isConnected && ctx.act('climb', { picks }), why === 'top' ? 500 : 900);
      };
      const arm = () => {
        stage.querySelectorAll('.lav-row').forEach((el) => el.classList.toggle('now', Number(el.dataset.r) === row));
        const ms = row < 2 ? 1700 : 1350;
        lava.style.animation = 'none';
        void lava.offsetWidth;
        lava.style.animation = `lavrise ${ms}ms linear forwards`;
        timer = setTimeout(() => {
          // too slow: the lava got you
          U.sfx('bad');
          U.shake(stage);
          if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
          finish('burnt');
        }, ms);
      };
      stage.querySelectorAll('.lav-stone').forEach((btn) => {
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          const r = Number(btn.closest('.lav-row').dataset.r);
          if (done || r !== row) return;
          clearTimeout(timer);
          const k = Number(btn.dataset.k);
          picks.push(k);
          me.style.setProperty('--k', k);
          U.bump(me, 'hop');
          if (rows[r][k]) {
            btn.classList.add('crumble');
            U.sfx('bad');
            U.shake(stage);
            if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
            return finish('fell');
          }
          U.sfx('pop');
          if (navigator.vibrate) navigator.vibrate(10);
          btn.classList.add('landed');
          steps.children[r].classList.add('on');
          row++;
          col.style.setProperty('--step', row);
          if (row >= rows.length) {
            const sr = stage.getBoundingClientRect();
            U.burst(stage, sr.width / 2, sr.height * 0.4, ['#ffd23f', '#fff', '#2ee59d'], 20, 120);
            U.sfx('good');
            return finish('top');
          }
          arm();
        });
      });
      arm();
    },

    onBoard() {},

    playerEnded(app, you) {
      return Chase.playerEnded(you, { win: 'יצאנו מהר הגעש!', lose: 'טיפסנו {pct}% מהדרך', line: 'טיפוסים מושלמים' });
    },
  };
})();
