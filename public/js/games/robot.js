// Client side of "בורחים מהרובוט": a factory chase on the host, a hold-to-sprint heat gauge on the phone.
(function () {
  const { esc } = U;
  const O = Art.O;

  // ---------- art ----------
  const runner = (color) => `<svg class="art rb-runner-art" viewBox="0 0 60 80" aria-hidden="true">
    <ellipse cx="30" cy="77" rx="16" ry="3" fill="#000" opacity=".25"/>
    <g class="rb-leg rb-l1"><path d="M26 52 L20 72" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M26 52 L20 72" stroke="#3b3f63" stroke-width="5" stroke-linecap="round"/></g>
    <g class="rb-leg rb-l2"><path d="M34 52 L40 72" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M34 52 L40 72" stroke="#3b3f63" stroke-width="5" stroke-linecap="round"/></g>
    <g class="rb-arm rb-a1"><path d="M22 36 L12 46" stroke="${O}" stroke-width="8" stroke-linecap="round"/><path d="M22 36 L12 46" stroke="${color}" stroke-width="4.5" stroke-linecap="round"/></g>
    <path d="M18 34 C18 26 42 26 42 34 L40 56 H20Z" fill="${color}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <g class="rb-arm rb-a2"><path d="M38 36 L48 44" stroke="${O}" stroke-width="8" stroke-linecap="round"/><path d="M38 36 L48 44" stroke="${color}" stroke-width="4.5" stroke-linecap="round"/></g>
    <circle cx="31" cy="18" r="13" fill="#ffd9b0" stroke="${O}" stroke-width="3"/>
    <path d="M18 16 C18 6 42 4 44 14 C38 12 26 12 18 16Z" fill="${color}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="35" cy="19" r="2.2" fill="${O}"/><path d="M33 25 C35 26 38 26 40 24" fill="none" stroke="${O}" stroke-width="2" stroke-linecap="round"/>
    <path d="M22 32 C24 30 28 29 31 29" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".5"/>
  </svg>`;

  Art.addDefs('rb-defs', `
    <linearGradient id="rb-steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9d3e6"/><stop offset=".55" stop-color="#7f8ba8"/><stop offset="1" stop-color="#4a5371"/></linearGradient>
    <linearGradient id="rb-dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5371"/><stop offset="1" stop-color="#23283f"/></linearGradient>
    <radialGradient id="rb-eye" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#fff2f2"/><stop offset=".35" stop-color="#ff3b4f"/><stop offset="1" stop-color="#8a0016"/></radialGradient>
    <radialGradient id="rb-light" cx=".5" cy=".6" r=".7"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#ffd23f" stop-opacity=".7"/></radialGradient>
    <linearGradient id="cv-rb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2f55"/><stop offset="1" stop-color="#141733"/></linearGradient>`);

  const robot = () => `<svg class="art rb-robot-art" viewBox="0 0 220 240" aria-hidden="true">
    <ellipse cx="110" cy="232" rx="92" ry="9" fill="#000" opacity=".35"/>
    <g class="rb-tread"><rect x="28" y="190" width="164" height="40" rx="20" fill="url(#rb-dark)" stroke="${O}" stroke-width="5"/>
      ${[52, 86, 120, 154, 176].map((x) => `<g class="rb-wheel" style="transform-origin:${x}px 210px"><circle cx="${x}" cy="210" r="13" fill="#7f8ba8" stroke="${O}" stroke-width="3"/><path d="M${x - 9} 210 H${x + 9} M${x} 201 V219" stroke="${O}" stroke-width="3"/></g>`).join('')}
    </g>
    <g class="rb-armL"><path d="M40 110 C14 120 8 150 18 172" fill="none" stroke="${O}" stroke-width="20" stroke-linecap="round"/><path d="M40 110 C14 120 8 150 18 172" fill="none" stroke="#7f8ba8" stroke-width="12" stroke-linecap="round"/>
      <path d="M8 168 L4 190 M28 168 L32 190" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M8 168 L4 190 M28 168 L32 190" stroke="#ffd23f" stroke-width="4" stroke-linecap="round"/></g>
    <rect x="44" y="96" width="132" height="98" rx="18" fill="url(#rb-steel)" stroke="${O}" stroke-width="5"/>
    <rect x="70" y="114" width="80" height="54" rx="10" fill="#23283f" stroke="${O}" stroke-width="4"/>
    <g class="rb-panel">${[0, 1, 2, 3].map((i) => `<rect x="${80 + i * 17}" y="124" width="11" height="34" rx="3" fill="${['#2ee59d', '#ffd23f', '#ff8a3d', '#ff4d6d'][i]}" opacity=".9"/>`).join('')}</g>
    <path d="M54 104 H96" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".45"/>
    <g class="rb-armR"><path d="M180 110 C206 116 214 140 206 160" fill="none" stroke="${O}" stroke-width="20" stroke-linecap="round"/><path d="M180 110 C206 116 214 140 206 160" fill="none" stroke="#7f8ba8" stroke-width="12" stroke-linecap="round"/>
      <circle cx="206" cy="166" r="14" fill="#ff4d6d" stroke="${O}" stroke-width="4"/><circle class="rb-zapper" cx="206" cy="166" r="6" fill="#fff35c"/></g>
    <rect x="96" y="80" width="28" height="20" fill="url(#rb-dark)" stroke="${O}" stroke-width="4"/>
    <g class="rb-head">
      <path d="M110 6 V24" stroke="${O}" stroke-width="5"/><circle class="rb-antenna" cx="110" cy="8" r="8" fill="#ff4d6d" stroke="${O}" stroke-width="3.5"/>
      <rect x="50" y="22" width="120" height="64" rx="22" fill="url(#rb-steel)" stroke="${O}" stroke-width="5"/>
      <rect x="62" y="38" width="96" height="30" rx="15" fill="#1b0f2e" stroke="${O}" stroke-width="4"/>
      <g class="rb-eye"><ellipse cx="110" cy="53" rx="20" ry="11" fill="url(#rb-eye)"/><ellipse cx="104" cy="49" rx="5" ry="3" fill="#fff" opacity=".8"/></g>
      <path d="M58 30 C70 26 86 25 98 26" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".5"/>
      <rect x="40" y="44" width="12" height="20" rx="4" fill="#4a5371" stroke="${O}" stroke-width="3.5"/><rect x="168" y="44" width="12" height="20" rx="4" fill="#4a5371" stroke="${O}" stroke-width="3.5"/>
    </g>
  </svg>`;

  const door = () => `<svg class="art" viewBox="0 0 100 160" aria-hidden="true">
    <rect x="4" y="4" width="92" height="156" rx="8" fill="#3b4060" stroke="${O}" stroke-width="5"/>
    <rect x="16" y="22" width="68" height="138" fill="#fffbe0"/><rect x="16" y="22" width="68" height="138" fill="url(#rb-light)"/>
    <rect x="18" y="2" width="64" height="16" rx="4" fill="#17c97e" stroke="${O}" stroke-width="3.5"/>
    <text x="50" y="14.5" text-anchor="middle" font-family="Heebo,sans-serif" font-weight="900" font-size="11" fill="#fff">יציאה</text>
  </svg>`;

  Art.covers.robot = () => `<rect width="160" height="100" fill="url(#cv-rb)"/>
    ${[18, 58, 98, 138].map((x) => `<rect x="${x}" y="10" width="26" height="40" rx="3" fill="#353b66" stroke="#444b80" stroke-width="2"/><circle cx="${x + 13}" cy="18" r="2.5" fill="${x % 40 ? '#ff4d6d' : '#2ee59d'}"/>`).join('')}
    <rect y="74" width="160" height="26" fill="#1c2040"/><path d="M0 76 H160" stroke="#ffd23f" stroke-width="3" stroke-dasharray="10 8"/>
    <g transform="translate(4 22) scale(.32)">${Art.inner(robot())}</g>
    <g transform="translate(86 42) scale(.46)">${Art.inner(runner('#ff5a5f'))}</g><g transform="translate(110 40) scale(.46)">${Art.inner(runner('#3b8eff'))}</g><g transform="translate(132 44) scale(.42)">${Art.inner(runner('#2ee59d'))}</g>
    <path d="M74 60 L80 52 L78 60 L86 56" fill="none" stroke="#fff35c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;

  Games.robot = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'robot',
        cls: 'rb-factory',
        stats: `<div class="stat wide" style="${U.pal('#2b3a8f')}"><span class="lbl">🚪 הדרך ליציאה</span><div class="meterbar" style="--m1:#8af5c8;--m2:#17c97e"><i id="pbar"></i><b id="ptxt"></b></div></div>
          <div class="stat" style="${U.pal('#e5304d')}" id="gapBox"><span class="lbl">🤖 הרובוט מאחור</span><span class="val" id="gap">0</span></div>
          <div class="stat" style="${U.pal('#ff8a3d')}"><span class="lbl">🏃 הכי מהיר/ה</span><span class="val small" id="lead">—</span></div>`,
        stage: `<div class="rb-wall"><i></i><i></i><i></i><i></i><i></i><i></i></div>
          <div class="rb-pipes"></div>
          <div class="rb-lamps"><i></i><i></i><i></i><i></i></div>
          <div class="rb-floor"></div>
          <div class="rb-door" id="door">${door()}</div>
          <div class="rb-bot" id="bot">${robot()}<div class="rb-beam"></div></div>
          <div class="rb-pack" id="pack"></div>
          <div class="rb-track"><div class="rb-tline"><i id="tfill"></i></div><b class="rb-tbot" id="tbot">🤖</b><b class="rb-trun" id="trun">🏃</b><b class="rb-texit">🚪</b></div>
          <div class="rb-flash" id="flash"></div>`,
      })) {
        this.seen = b.ev.length ? b.ev[b.ev.length - 1].id : 0;
        this.names = '';
      }
      const p = Math.min(1, b.run / b.goal);
      const gap = Math.max(0, b.run - b.robot);
      U.hostTick(st, `${st.players.length} רצים · כולם ביחד`);
      document.getElementById('pbar').style.width = p * 100 + '%';
      document.getElementById('ptxt').textContent = Math.round(p * 100) + '%';
      U.countTo(document.getElementById('gap'), gap);
      const danger = gap < b.goal * 0.03;
      document.getElementById('gapBox').classList.toggle('rb-danger', danger);
      const lead = document.getElementById('lead');
      const leader = b.top[0] && b.top[0].dist > 0 ? b.top[0].name : '—';
      if (lead.textContent !== leader) { lead.textContent = leader; U.bump(lead); }
      // mini map
      document.getElementById('tfill').style.width = p * 100 + '%';
      document.getElementById('trun').style.left = p * 100 + '%';
      document.getElementById('tbot').style.left = Math.min(1, b.robot / b.goal) * 100 + '%';
      // the robot creeps closer as the gap shrinks; the exit door slides in near the end
      const near = Math.max(0, Math.min(1, gap / (b.goal * 0.14)));
      const stage = document.getElementById('stage');
      stage.style.setProperty('--botx', 2 + (1 - near) * 30 + '%');
      stage.style.setProperty('--doorx', Math.max(0, (p - 0.8) / 0.2) * 100);
      stage.classList.toggle('rb-close', danger);
      // the runners (top contributors in front)
      const key = b.runners.join('|');
      if (key !== this.names) {
        this.names = key;
        const pack = document.getElementById('pack');
        pack.innerHTML = b.runners.map((n, i) => `<div class="rb-runner" data-name="${esc(n)}" style="--i:${i};--row:${i % 3};--col:${Math.floor(i / 3)}">${runner(U.color(n))}<span>${esc(n)}</span></div>`).join('');
      }
      for (const e of b.ev) {
        if (e.id <= this.seen) continue;
        this.seen = e.id;
        this.fx(e);
      }
    },

    fx(e) {
      const stage = document.getElementById('stage');
      const s = stage.getBoundingClientRect();
      if (e.kind === 'boost') {
        const el = document.querySelector(`.rb-runner[data-name="${CSS.escape(e.name)}"]`) || document.getElementById('pack');
        const r = el.getBoundingClientRect();
        U.bump(el, e.perfect ? 'rb-dash-big' : 'rb-dash');
        U.floatText(stage, `+${e.gain} ${e.name}`, r.left - s.left + r.width / 2, r.top - s.top, e.perfect ? 'gold' : 'good');
        U.burst(stage, r.left - s.left, r.bottom - s.top - 8, ['#fff', '#8af5c8', '#ffd23f'], e.perfect ? 14 : 6, 50);
      } else if (e.kind === 'zap') {
        const flash = document.getElementById('flash');
        U.bump(flash, 'on');
        U.bump(document.getElementById('bot'), 'rb-fire');
        U.shake(stage, true);
        U.sfx('boom');
        U.floatText(stage, `⚡ -${e.back}`, s.width * 0.5, s.height * 0.4, 'bad');
      } else if (e.kind === 'rage') {
        U.bump(document.getElementById('bot'), 'rb-rage');
      }
    },

    hostEnded(app, st) {
      if (!U.view(app, 'robot-end')) return;
      const r = st.results;
      U.hostResults(app, st, {
        lost: !r.victory,
        title: r.victory ? '🎉 ברחנו מהרובוט!' : `הגענו ל־${r.pct}% מהדרך`,
        sub: r.victory ? `כל הכבוד לכל הכיתה!${r.zaps ? ` (נתפסנו ${r.zaps} פעמים בדרך)` : ''}` : 'הרובוט ניצח הפעם. בסיבוב הבא נברח!',
        body: `<div class="end-visual rb-end ${r.victory ? 'win' : ''}"><div class="rb-end-door">${door()}</div><div class="rb-end-bot">${robot()}</div><div class="rb-end-run">${runner('#ff5a5f')}${runner('#3b8eff')}${runner('#2ee59d')}</div></div>`,
        table: U.table(r.players, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
          ['מטרים', (p) => `🏃 ${p.dist}`],
          ['ספרינט מושלם', (p) => `✨ ${p.perfect}`],
          ['נכונות', (p) => p.correct],
        ], 10),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">🏃 ${you.dist}</span><span class="hchip">🚪 ${you.pct}%</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase === 'sprint') {
        if (!ctx.setView('sprint' + you.qid + ':' + you.turn)) return true;
        this.sprint(app, you, ctx);
        return true;
      }
      if (you.phase === 'sprinted') {
        if (!ctx.setView('sprinted' + you.qid + ':' + you.turn)) return true;
        const s = you.sprint;
        U.sfx(s.burnt ? 'bad' : s.perfect ? 'win' : 'good');
        app.innerHTML = `${ctx.topBar()}<div class="act-result">
          <div class="ar-art rb-go ${s.burnt ? 'burnt' : ''}">${runner(ctx.teamColor() === '#7c4dff' ? U.color(you.name) : ctx.teamColor())}</div>
          <div class="ar-big ${s.burnt ? 'neg' : ''}">+${s.gain}</div>
          <div class="ar-title">${s.burnt ? 'המנוע התחמם מדי! 🔥' : s.perfect ? 'ספרינט מושלם! ⚡' : 'רצים!'}</div>
          <div class="pill">🤖 הרובוט ${you.gap} מטר מאחור</div></div>`;
        return true;
      }
      return false;
    },

    sprint(app, you, ctx) {
      // a different engine every time, so you have to watch the gauge
      const T = 1300 + Math.random() * 900;
      const color = ctx.teamColor() === '#7c4dff' ? U.color(you.name) : ctx.teamColor();
      app.innerHTML = `${ctx.topBar()}
        <div class="phase-title">החזיקו כדי לרוץ!<small>שחררו באזור הירוק, לפני שהמנוע מתחמם</small></div>
        <div class="p-stage rb-phone" id="rbp">
          <div class="rb-pwall"></div><div class="rb-pfloor" id="pfloor"></div>
          <div class="rb-pbot">${robot()}</div>
          <div class="rb-prun" id="prun">${runner(color)}</div>
          <div class="rb-gauge"><div class="rb-gzones"><i class="cool"></i><i class="ok"></i><i class="best"></i><i class="hot"></i></div><div class="rb-needle" id="needle"></div><b id="heatTxt">0%</b></div>
        </div>
        <button class="btn big green rb-hold" id="hold">🏃 החזיקו לספרינט</button>`;
      const hold = document.getElementById('hold');
      const needle = document.getElementById('needle');
      const stage = document.getElementById('rbp');
      const txt = document.getElementById('heatTxt');
      let t0 = 0;
      let raf = 0;
      let done = false;
      const heatNow = () => (t0 ? (performance.now() - t0) / T : 0);
      const draw = () => {
        const h = heatNow();
        needle.style.bottom = Math.min(100, (h / 1.2) * 100) + '%';
        txt.textContent = Math.round(Math.min(h, 1.2) * 100) + '%';
        stage.style.setProperty('--spd', Math.max(0.12, 0.6 - h * 0.45) + 's');
        stage.classList.toggle('hot', h > 1);
        stage.classList.toggle('best', h >= 0.85 && h <= 1);
        if (h >= 1.2) return finish();
        raf = requestAnimationFrame(draw);
      };
      const start = (e) => {
        e.preventDefault();
        if (done || t0) return;
        t0 = performance.now();
        hold.classList.add('on');
        stage.classList.add('running');
        if (navigator.vibrate) navigator.vibrate(10);
        raf = requestAnimationFrame(draw);
      };
      const finish = () => {
        if (done || !t0) return;
        done = true;
        cancelAnimationFrame(raf);
        const heat = Math.min(heatNow(), 1.2);
        hold.classList.remove('on');
        hold.disabled = true;
        stage.classList.add(heat > 1 ? 'burn' : 'dash');
        if (heat > 1) { U.shake(stage); U.sfx('bad'); if (navigator.vibrate) navigator.vibrate([40, 30, 40]); }
        else if (heat >= 0.85) { const r = stage.getBoundingClientRect(); U.burst(stage, r.width * 0.6, r.height * 0.6, ['#ffd23f', '#fff', '#2ee59d'], 18, 110); U.sfx('good'); }
        else U.sfx('pop');
        setTimeout(() => ctx.act('sprint', { heat }), 450);
      };
      hold.addEventListener('pointerdown', start);
      hold.addEventListener('pointerup', finish);
      hold.addEventListener('pointercancel', finish);
      hold.addEventListener('pointerleave', finish);
      hold.oncontextmenu = (e) => e.preventDefault();
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results;
      const mine = r.players.find((p) => p.name === you.name) || { dist: 0, perfect: 0, correct: 0 };
      return U.playerResult({
        win: r.victory,
        title: r.victory ? 'ברחנו מהרובוט!' : `הגענו ל־${r.pct}% מהדרך`,
        big: `${mine.dist}`,
        bigLabel: 'מטרים שרצתם',
        lines: [`⚡ ${mine.perfect} ספרינטים מושלמים`, `✅ ${mine.correct} תשובות נכונות`],
      });
    },
  };
})();
