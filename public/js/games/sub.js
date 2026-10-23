// Client side of "צוללת ההצלה": the deep-sea chase on the host, a drag-to-steer run past mines on the phone.
(function () {
  const { esc } = U;
  const O = Art.O;

  Art.addDefs('sq-defs', `
    <linearGradient id="sq-hull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset=".5" stop-color="#ffc21f"/><stop offset="1" stop-color="#d98a00"/></linearGradient>
    <radialGradient id="sq-glass" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#e8fbff"/><stop offset=".5" stop-color="#6fd3ff"/><stop offset="1" stop-color="#1b6fb8"/></radialGradient>
    <linearGradient id="sq-fish" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4fb8"/><stop offset=".6" stop-color="#3b2a7a"/><stop offset="1" stop-color="#1e1145"/></linearGradient>
    <radialGradient id="sq-lure" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#fff35c"/><stop offset="1" stop-color="#ffb800" stop-opacity="0"/></radialGradient>
    <radialGradient id="sq-pearl" cx=".35" cy=".3" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#f3e8ff"/><stop offset="1" stop-color="#c9b6f0"/></radialGradient>
    <linearGradient id="sq-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset=".5" stop-color="#ffc21f"/><stop offset="1" stop-color="#b87400"/></linearGradient>
    <linearGradient id="cv-sq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f8fd6"/><stop offset=".6" stop-color="#0b3f7a"/><stop offset="1" stop-color="#061a3d"/></linearGradient>`);

  // ---------- art ----------
  const sub = () => `<svg class="art sq-sub-art" viewBox="0 0 220 120" aria-hidden="true">
    <ellipse cx="110" cy="114" rx="80" ry="5" fill="#000" opacity=".2"/>
    <g class="sq-prop" style="transform-origin:14px 66px"><ellipse cx="14" cy="66" rx="6" ry="22" fill="#7f8ba8" stroke="${O}" stroke-width="3.5"/></g>
    <path d="M18 66 H34" stroke="${O}" stroke-width="7"/>
    <path d="M30 50 L16 36 L30 40Z M30 82 L16 96 L30 92Z" fill="#ff8a3d" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M32 66 C32 40 70 34 116 34 C168 34 204 44 204 66 C204 88 168 98 116 98 C70 98 32 92 32 66Z" fill="url(#sq-hull)" stroke="${O}" stroke-width="5"/>
    <path d="M90 34 L96 12 H140 L146 34" fill="url(#sq-hull)" stroke="${O}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M128 12 V2 H150" fill="none" stroke="${O}" stroke-width="5" stroke-linecap="round"/><rect x="146" y="-2" width="10" height="9" rx="2" fill="#7f8ba8" stroke="${O}" stroke-width="3"/>
    ${[70, 112, 154].map((x) => `<circle cx="${x}" cy="64" r="15" fill="#7f8ba8" stroke="${O}" stroke-width="4"/><circle cx="${x}" cy="64" r="10" fill="url(#sq-glass)"/><path d="M${x - 6} 59 C${x - 3} 56 ${x + 1} 55 ${x + 4} 57" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`).join('')}
    <path d="M44 52 C60 42 90 40 112 40" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".55"/>
    <path d="M40 84 C70 94 150 94 190 80" fill="none" stroke="#000" stroke-width="4" opacity=".12"/>
    <circle cx="198" cy="66" r="6" fill="#fff35c" stroke="${O}" stroke-width="3"/>
  </svg>`;

  const fish = () => `<svg class="art sq-fish-art" viewBox="0 0 240 200" aria-hidden="true">
    <path class="sq-tail" d="M40 100 L2 60 L12 100 L2 140Z" fill="#4a3590" stroke="${O}" stroke-width="5" stroke-linejoin="round" style="transform-origin:40px 100px"/>
    <path d="M36 100 C36 40 90 18 140 22 C190 26 222 62 222 100 C222 142 186 176 136 178 C86 180 36 160 36 100Z" fill="url(#sq-fish)" stroke="${O}" stroke-width="6"/>
    <path d="M96 30 C110 6 132 4 146 24" fill="#4a3590" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>
    <g class="sq-jaw"><path d="M120 112 C150 104 196 104 226 114 C214 158 170 172 132 160 C124 146 120 128 120 112Z" fill="#1b0f2e" stroke="${O}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M128 116 L136 132 L144 114 L152 132 L160 112 L168 130 L176 111 L184 129 L192 111 L200 128 L208 112 L214 126 L222 115" fill="#fff" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M140 160 L146 146 L154 162 L162 146 L170 162 L178 146 L186 158" fill="#fff" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/></g>
    <circle cx="168" cy="72" r="20" fill="#fff" stroke="${O}" stroke-width="4"/><circle class="sq-pupil" cx="174" cy="74" r="9" fill="#ff3b4f"/><circle cx="176" cy="70" r="3" fill="#fff"/>
    <path d="M146 50 L190 58" stroke="${O}" stroke-width="6" stroke-linecap="round"/>
    <path d="M70 120 C80 140 100 146 110 140" fill="none" stroke="#000" stroke-width="4" opacity=".25"/>
    <path d="M70 56 C84 40 104 34 120 34" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".35"/>
    <path d="M70 80 L54 70 M74 96 L56 96" stroke="#6b4fb8" stroke-width="4" stroke-linecap="round"/>
    <g class="sq-lure-g"><path d="M140 26 C150 -4 214 -10 232 30" fill="none" stroke="${O}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="232" cy="38" r="26" fill="url(#sq-lure)" class="sq-glow"/><circle cx="232" cy="38" r="8" fill="#fff35c" stroke="${O}" stroke-width="3"/></g>
  </svg>`;

  const chest = () => `<svg class="art" viewBox="0 0 120 100" aria-hidden="true">
    <ellipse cx="60" cy="94" rx="54" ry="6" fill="#000" opacity=".3"/>
    <path d="M14 44 C14 18 106 18 106 44Z" fill="#a0522d" stroke="${O}" stroke-width="4"/>
    <circle cx="34" cy="30" r="7" fill="url(#sq-gold)" stroke="${O}" stroke-width="2.5"/><circle cx="60" cy="24" r="8" fill="url(#sq-pearl)" stroke="${O}" stroke-width="2.5"/><circle cx="84" cy="32" r="7" fill="url(#sq-gold)" stroke="${O}" stroke-width="2.5"/>
    <rect x="12" y="42" width="96" height="48" rx="6" fill="#b5652f" stroke="${O}" stroke-width="4"/>
    <path d="M12 56 H108 M30 42 V90 M90 42 V90" stroke="url(#sq-gold)" stroke-width="7"/><path d="M12 56 H108 M30 42 V90 M90 42 V90" stroke="${O}" stroke-width="1.5" opacity=".4"/>
    <rect x="52" y="52" width="16" height="18" rx="3" fill="url(#sq-gold)" stroke="${O}" stroke-width="3"/>
  </svg>`;

  const mine = () => `<svg class="art" viewBox="0 0 60 60" aria-hidden="true">
    <g stroke="${O}" stroke-width="4" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M30 30 L${30 + 26 * Math.cos((a * Math.PI) / 180)} ${30 + 26 * Math.sin((a * Math.PI) / 180)}"/>`).join('')}</g>
    <circle cx="30" cy="30" r="17" fill="#3b3f63" stroke="${O}" stroke-width="4"/><circle class="sq-blink" cx="30" cy="30" r="5" fill="#ff3b4f"/>
    <path d="M20 24 C22 20 26 18 30 18" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".5"/>
  </svg>`;

  const pearl = () => `<svg class="art" viewBox="0 0 60 60" aria-hidden="true">
    <path d="M6 40 C6 22 54 22 54 40 L50 48 H10Z" fill="#ff8fb8" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>
    <circle cx="30" cy="32" r="13" fill="url(#sq-pearl)" stroke="${O}" stroke-width="3"/><circle cx="25" cy="27" r="4" fill="#fff"/>
  </svg>`;

  Art.covers.sub = () => `<rect width="160" height="100" fill="url(#cv-sq)"/>
    <path d="M20 0 L40 100 H60 L36 0Z M90 0 L104 100 H118 L100 0Z" fill="#fff" opacity=".08"/>
    <path d="M0 92 C30 84 50 96 80 90 C110 84 130 96 160 88 V100 H0Z" fill="#c9a66b"/>
    <path d="M14 92 C10 80 18 72 12 62 M146 90 C150 78 142 70 148 60" fill="none" stroke="#2ea86b" stroke-width="5" stroke-linecap="round"/>
    <g transform="translate(-6 18) scale(.36)">${Art.inner(fish())}</g>
    <g transform="translate(84 34) scale(.32)">${Art.inner(sub())}</g>
    ${[[70, 30], [78, 18], [140, 26], [150, 14]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="none" stroke="#bfefff" stroke-width="1.5"/>`).join('')}`;

  const THEME = {
    mash: { icon: '⚙️', title: 'מנוע טורבו!', sub: 'הקישו הכי מהר שאפשר כדי לסובב את המדחף', host: 'מסובבים את המדחף!' },
    code: { icon: '🔐', title: 'קוד תא הלחץ', sub: 'הקלידו בטלפון את הקוד שעל המסך הגדול', host: 'הקלידו את הקוד לתא הלחץ:' },
    pop: { icon: '🐚', title: 'פוצצו את הבועות', sub: 'געו בכל בועה עם פנינה', host: 'אוספים פנינים בטלפונים!', spark: '🐚' },
  };
  const mix = (a, b, k) => {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    return `rgb(${[16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k)).join(',')})`;
  };

  Games.sub = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      Chase.hostFrame(app, st, {
        id: 'sub',
        cls: 'sq-sea',
        goal: '💎 הדרך לאוצר',
        gapLabel: '🐟 הדג מאחור',
        color: '#0b5fa8',
        icons: ['🐟', '🚤', '💎'],
        extraStat: `<div class="stat sq-sonar" style="${U.pal('#7c4dff')}" id="sonarBox"><span class="lbl">🌀 סונאר צלילה</span><div class="meterbar" style="--m1:#b8f3ff;--m2:#22c7e8"><i id="sonar"></i><b id="sonarTxt"></b></div></div>`,
        stage: `<div class="sq-water" id="water"></div><div class="sq-rays"><i></i><i></i><i></i><i></i></div>
          <div class="sq-far"></div><div class="sq-bubbles">${'<i></i>'.repeat(14)}</div>
          <div class="sq-floor"><div class="sq-kelp">${'<i></i>'.repeat(9)}</div></div>
          <div class="sq-chest" id="chest">${chest()}</div>
          <div class="sq-fish" id="fish">${fish()}</div>
          <div class="sq-sub" id="ship"><div class="sq-wake"></div>${sub()}</div>
          <div class="sq-crew" id="crew"></div>
          <div class="sq-dive" id="dive"><b>🌀 מצב צלילה ×2</b><span id="diveT"></span></div>`,
      });
      const u = Chase.hostUpdate(st, `${st.players.length} צוללים · כולם ביחד`, (e) => this.fx(e, document.getElementById('stage')));
      // deeper = darker; the fish creeps closer as the gap shrinks; the treasure appears near the end
      document.getElementById('water').style.background = `linear-gradient(180deg, ${mix('#1f9be0', '#04112e', Math.min(1, u.p * 1.2))}, ${mix('#0b4f96', '#020818', Math.min(1, u.p * 1.1))})`;
      u.stage.style.setProperty('--depth', u.p);
      u.stage.style.setProperty('--fishx', -6 + (1 - u.near) * 26 + '%');
      u.stage.style.setProperty('--chest', Math.max(0, (u.p - 0.8) / 0.2));
      document.getElementById('sonar').style.width = b.sonar + '%';
      document.getElementById('sonarTxt').textContent = b.diving ? '×2' : b.sonar + '%';
      u.stage.classList.toggle('sq-diving', b.diving > 0);
      document.getElementById('sonarBox').classList.toggle('ch-danger', b.diving > 0);
      document.getElementById('diveT').textContent = b.diving ? b.diving + ' שנ׳' : '';
      const crew = document.getElementById('crew');
      const key = b.runners.slice(0, 8).join('|');
      if (crew.dataset.key !== key) {
        crew.dataset.key = key;
        crew.innerHTML = b.runners.slice(0, 8).map((n, i) => `<span data-name="${esc(n)}" style="--i:${i};--c:${U.color(n)}">${esc(n)}</span>`).join('');
      }
      Chase.host(u.stage, b.mini, THEME);
    },

    fx(e, stage) {
      if (e.kind === 'boost') {
        const el = document.querySelector(`#crew span[data-name="${CSS.escape(e.name)}"]`) || document.getElementById('ship');
        U.bump(document.getElementById('ship'), e.perfect ? 'sq-zoom-big' : 'sq-zoom');
        Chase.boostFx(stage, el, e, ['#fff', '#bfefff', '#ffd23f']);
      } else if (e.kind === 'caught') {
        U.bump(document.getElementById('fish'), 'sq-bite');
      } else if (e.kind === 'rage') {
        U.bump(document.getElementById('fish'), 'sq-rage');
      } else if (e.kind === 'dive') {
        U.sfx('win');
        const s = stage.getBoundingClientRect();
        U.floatText(stage, '🌀 מצב צלילה!', s.width * 0.5, s.height * 0.35, 'gold');
        U.burst(stage, s.width * 0.5, s.height * 0.5, ['#bfefff', '#fff', '#22c7e8'], 30, 200);
      }
    },

    hostEnded(app, st) {
      if (!U.view(app, 'sub-end')) return;
      const r = st.results;
      U.hostResults(app, st, {
        lost: !r.victory,
        title: r.victory ? '💎 מצאנו את האוצר!' : `צללנו ${r.pct}% מהדרך`,
        sub: r.victory ? `כל הכבוד לכל הצוות!${r.dives ? ` (${r.dives} צלילות טורבו)` : ''}` : 'הדג ניצח הפעם. בסיבוב הבא נגיע לאוצר!',
        body: `<div class="end-visual sq-end ${r.victory ? 'win' : ''}"><div class="sq-end-chest">${chest()}</div><div class="sq-end-fish">${fish()}</div><div class="sq-end-sub">${sub()}</div></div>`,
        table: Chase.table(r, '🌊', 'נסיעה מושלמת'),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">🌊 ${you.dist}</span><span class="hchip">💎 ${you.pct}%</span>`;
    },

    playerPhase(app, you, ctx) {
      if (Chase.phone(app, you, ctx, THEME)) return true;
      if (you.phase === 'dive') {
        if (!ctx.setView('dive' + you.qid + ':' + you.turn)) return true;
        this.steer(app, you, ctx);
        return true;
      }
      if (you.phase === 'dived') {
        if (!ctx.setView('dived' + you.qid + ':' + you.turn)) return true;
        const s = you.res;
        Chase.resultScreen(app, ctx, {
          art: sub(),
          cls: 'sq-go',
          gain: s.gain,
          bad: s.hits >= 3,
          title: s.perfect ? 'נסיעה מושלמת! 💎' : s.hits ? `${s.hits} פגיעות במוקשים 💥` : 'עברתם בשלום!',
          pill: `${s.pearls ? `⚪ ${s.pearls} פנינים · ` : ''}${s.boosted ? '🌀 ×2 · ' : ''}🐟 הדג ${you.gap} מטר מאחור`,
        });
        return true;
      }
      return false;
    },

    // a side-scrolling run: drag the sub up and down; mines and pearls reach it at their given times
    steer(app, you, ctx) {
      const a = you.act;
      app.innerHTML = `${ctx.topBar()}
        <div class="phase-title">גררו את הצוללת למעלה ולמטה!<small>עקפו מוקשים 💣 ואספו פנינים ⚪</small></div>
        <div class="p-stage sq-phone ${you.diving ? 'sq-diving' : ''}" id="sqp">
          <div class="sq-pwater"></div><div class="sq-pbubbles">${'<i></i>'.repeat(8)}</div><div class="sq-pfloor"></div>
          <div class="sq-pfish">${fish()}</div>
          <div class="sq-psub" id="psub">${sub()}</div>
          <div class="sq-score"><span>💥 <b id="hits">0</b></span><span>⚪ <b id="pearls">0</b></span></div>
          <div class="sq-pbar"><i style="animation-duration:${a.ms}ms"></i></div>
          <div class="sq-hint" id="hint">👆 גררו</div>
        </div>`;
      const stage = document.getElementById('sqp');
      const psub = document.getElementById('psub');
      const SUBX = 22; // % from the left where the sub sits
      const TRAVEL = 2200; // ms for a thing to cross the screen
      let y = 50;
      let target = 50;
      let hits = 0;
      const got = [];
      const things = [...a.mines.map(([t, ty]) => ({ t, y: ty, k: 'mine' })), ...a.pearls.map(([t, ty], i) => ({ t, y: ty, k: 'pearl', i }))];
      for (const th of things) {
        th.el = document.createElement('div');
        th.el.className = 'sq-thing ' + th.k;
        th.el.innerHTML = th.k === 'mine' ? mine() : pearl();
        stage.appendChild(th.el);
      }
      const aim = (e) => {
        const r = stage.getBoundingClientRect();
        target = Math.max(8, Math.min(92, ((e.clientY - r.top) / r.height) * 100));
        document.getElementById('hint').style.opacity = 0;
      };
      stage.addEventListener('pointerdown', (e) => { e.preventDefault(); stage.setPointerCapture(e.pointerId); aim(e); });
      stage.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') aim(e); });
      const t0 = performance.now();
      let done = false;
      const frame = (now) => {
        if (done || !stage.isConnected) return;
        const t = now - t0;
        y += (target - y) * 0.18;
        psub.style.top = y + '%';
        psub.style.rotate = Math.max(-18, Math.min(18, (target - y) * 0.8)) + 'deg';
        for (const th of things) {
          if (th.gone) continue;
          const x = SUBX + ((th.t - t) / TRAVEL) * (110 - SUBX);
          th.el.style.left = x + '%';
          th.el.style.top = th.y + '%';
          if (x < -10) { th.gone = true; th.el.remove(); continue; }
          if (Math.abs(x - SUBX) < 7 && Math.abs(th.y - y) < 13) {
            th.gone = true;
            const r = stage.getBoundingClientRect();
            const px = (x / 100) * r.width;
            const py = (th.y / 100) * r.height;
            if (th.k === 'mine') {
              hits++;
              document.getElementById('hits').textContent = hits;
              th.el.classList.add('boom');
              U.shake(stage);
              U.bump(psub, 'sq-hit');
              U.sfx('boom');
              U.burst(stage, px, py, ['#ff4d6d', '#ffd23f', '#fff'], 14, 70);
              if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
            } else {
              got.push(th.i);
              document.getElementById('pearls').textContent = got.length;
              th.el.classList.add('got');
              U.sfx('coin');
              U.burst(stage, px, py, ['#fff', '#f3e8ff', '#bfefff'], 10, 50);
              if (navigator.vibrate) navigator.vibrate(10);
            }
            setTimeout(() => th.el.remove(), 500);
          }
        }
        if (t >= a.ms) {
          done = true;
          stage.classList.add('sq-done');
          return setTimeout(() => stage.isConnected && ctx.act('dive', { hits, pearls: got }), 300);
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },

    onBoard() {},

    playerEnded(app, you) {
      return Chase.playerEnded(you, { win: 'מצאנו את האוצר!', lose: 'צללנו {pct}% מהדרך', line: 'נסיעות מושלמות' });
    },
  };
})();
