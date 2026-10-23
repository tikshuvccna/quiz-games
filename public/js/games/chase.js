// Shared client parts of the co-op chase games (robot, sub, lava, zombie): the checkpoint mini-games that the whole
// class plays together at 25/50/75% of the way. Chase.host() draws the overlay on the big screen; Chase.phone()
// draws the phone side. Each game passes a theme: { icons, titles } to dress them up.
(function () {
  const { esc } = U;
  const O = Art.O;
  // the door-code keys: a color and a shape each, so color-blind players can read the code too
  const KEYS = [
    ['#ff4d6d', '<circle cx="20" cy="20" r="13"/>'],
    ['#3b8eff', '<rect x="8" y="8" width="24" height="24" rx="4"/>'],
    ['#ffd23f', '<path d="M20 5 L35 33 H5Z" stroke-linejoin="round"/>'],
    ['#2ee59d', '<path d="M20 4 L24.5 15 L36 15.5 L27 23 L30 35 L20 28.5 L10 35 L13 23 L4 15.5 L15.5 15Z" stroke-linejoin="round"/>'],
    ['#b46bff', '<path d="M20 4 L36 20 L20 36 L4 20Z" stroke-linejoin="round"/>'],
    ['#ff8a3d', '<path d="M20 34 C4 23 4 9 13 8 C17 8 19 11 20 13 C21 11 23 8 27 8 C36 9 36 23 20 34Z" stroke-linejoin="round"/>'],
  ];
  const key = (i, cls = '') => `<svg class="ch-key ${cls}" viewBox="0 0 40 40" aria-hidden="true"><g fill="${KEYS[i][0]}" stroke="${O}" stroke-width="3">${KEYS[i][1]}</g><path d="M12 12 C15 9 19 8 22 9" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".55"/></svg>`;
  const BASE = {
    mash: { icon: '⚡', title: 'טעינת טורבו!', sub: 'הקישו על הכפתור הכי מהר שאפשר', host: 'מקישים בטלפונים!' },
    code: { icon: '🔐', title: 'קוד הדלת', sub: 'הקלידו בטלפון את הקוד שעל המסך הגדול', host: 'הקלידו את הקוד:' },
    pop: { icon: '✨', title: 'תפסו את הניצוצות', sub: 'געו בכל ניצוץ שקופץ על המסך', host: 'תופסים ניצוצות בטלפונים!' },
  };
  const spec = (theme, kind) => ({ ...BASE[kind], ...((theme && theme[kind]) || {}) });
  const stars = (n) => `<div class="ch-stars">${[0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}" style="--i:${i}">★</span>`).join('')}</div>`;

  // a cartoon kid: pose 'run' (legs and arms swing) or 'climb' (arms up, legs kicking)
  const kid = (color, pose = 'run') => pose === 'climb'
    ? `<svg class="art ch-kid climb" viewBox="0 0 60 80" aria-hidden="true">
      <g class="ch-armL"><path d="M22 36 L14 12" stroke="${O}" stroke-width="8" stroke-linecap="round"/><path d="M22 36 L14 12" stroke="${color}" stroke-width="4.5" stroke-linecap="round"/><circle cx="14" cy="11" r="4" fill="#ffd9b0" stroke="${O}" stroke-width="2.5"/></g>
      <g class="ch-armR"><path d="M38 36 L46 14" stroke="${O}" stroke-width="8" stroke-linecap="round"/><path d="M38 36 L46 14" stroke="${color}" stroke-width="4.5" stroke-linecap="round"/><circle cx="46" cy="13" r="4" fill="#ffd9b0" stroke="${O}" stroke-width="2.5"/></g>
      <g class="ch-legL"><path d="M26 54 L22 74" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M26 54 L22 74" stroke="#3b3f63" stroke-width="5" stroke-linecap="round"/></g>
      <g class="ch-legR"><path d="M34 54 L40 70" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M34 54 L40 70" stroke="#3b3f63" stroke-width="5" stroke-linecap="round"/></g>
      <path d="M18 34 C18 27 42 27 42 34 L40 57 H20Z" fill="${color}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="30" cy="22" r="12" fill="#ffd9b0" stroke="${O}" stroke-width="3"/>
      <path d="M18 20 C17 10 42 8 43 19 C36 15 25 15 18 20Z" fill="${color}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="25" cy="22" r="2" fill="${O}"/><circle cx="35" cy="22" r="2" fill="${O}"/><path d="M26 28 C28 30 32 30 34 28" fill="none" stroke="${O}" stroke-width="2" stroke-linecap="round"/>
      <path d="M22 33 C24 31 27 30 30 30" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".5"/>
    </svg>`
    : `<svg class="art ch-kid run" viewBox="0 0 60 80" aria-hidden="true">
      <ellipse cx="30" cy="77" rx="16" ry="3" fill="#000" opacity=".25"/>
      <g class="ch-legL"><path d="M26 52 L20 72" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M26 52 L20 72" stroke="#3b3f63" stroke-width="5" stroke-linecap="round"/></g>
      <g class="ch-legR"><path d="M34 52 L40 72" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M34 52 L40 72" stroke="#3b3f63" stroke-width="5" stroke-linecap="round"/></g>
      <g class="ch-armL"><path d="M22 36 L12 46" stroke="${O}" stroke-width="8" stroke-linecap="round"/><path d="M22 36 L12 46" stroke="${color}" stroke-width="4.5" stroke-linecap="round"/></g>
      <path d="M18 34 C18 26 42 26 42 34 L40 56 H20Z" fill="${color}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      <g class="ch-armR"><path d="M38 36 L48 44" stroke="${O}" stroke-width="8" stroke-linecap="round"/><path d="M38 36 L48 44" stroke="${color}" stroke-width="4.5" stroke-linecap="round"/></g>
      <circle cx="31" cy="18" r="13" fill="#ffd9b0" stroke="${O}" stroke-width="3"/>
      <path d="M18 16 C18 6 42 4 44 14 C38 12 26 12 18 16Z" fill="${color}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="35" cy="19" r="2.2" fill="${O}"/><path d="M33 25 C35 26 38 26 40 24" fill="none" stroke="${O}" stroke-width="2" stroke-linecap="round"/>
      <path d="M22 32 C24 30 28 29 31 29" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".5"/>
    </svg>`;

  window.Chase = {
    key,
    kid,

    // the standard chase header (progress, gap, leader) and a mini-map; returns true when the frame was (re)built
    // opts: { id, cls, stage, goal: '🚪 הדרך ליציאה', gapLabel: '🤖 הרובוט מאחור', icons: [chaser, class, goal], vertical }
    hostFrame(app, st, o) {
      const b = st.board;
      const built = U.hostFrame(app, st, {
        id: o.id,
        cls: o.cls,
        stats: `<div class="stat wide" style="${U.pal(o.color || '#2b3a8f')}"><span class="lbl">${o.goal}</span><div class="meterbar" style="--m1:#8af5c8;--m2:#17c97e"><i id="pbar"></i><b id="ptxt"></b></div></div>
          <div class="stat" style="${U.pal('#e5304d')}" id="gapBox"><span class="lbl">${o.gapLabel}</span><span class="val" id="gap">0</span></div>
          ${o.extraStat || ''}
          <div class="stat" style="${U.pal('#ff8a3d')}"><span class="lbl">⭐ הכי מהיר/ה</span><span class="val small" id="lead">—</span></div>`,
        stage: `${o.stage}<div class="ch-track ${o.vertical ? 'vert' : ''}"><div class="ch-tline"><i id="tfill"></i></div><b class="ch-tchase" id="tchase">${o.icons[0]}</b><b class="ch-tus" id="tus">${o.icons[1]}</b><b class="ch-tgoal">${o.icons[2]}</b></div><div class="ch-flash" id="chFlash"></div>`,
      });
      if (built) {
        this.seen = b.ev.length ? b.ev[b.ev.length - 1].id : 0;
        this.names = '';
      }
      return built;
    },

    // refresh the header and mini-map; fx(e) runs for each new event. Returns { p, gap, danger, stage }
    hostUpdate(st, sub, fx) {
      const b = st.board;
      const p = Math.min(1, b.run / b.goal);
      const gap = Math.max(0, b.run - b.chaser);
      const danger = gap < b.goal * 0.03;
      U.hostTick(st, sub);
      document.getElementById('pbar').style.width = p * 100 + '%';
      document.getElementById('ptxt').textContent = Math.round(p * 100) + '%';
      U.countTo(document.getElementById('gap'), gap);
      document.getElementById('gapBox').classList.toggle('ch-danger', danger);
      const lead = document.getElementById('lead');
      const leader = b.top[0] && b.top[0].dist > 0 ? b.top[0].name : '—';
      if (lead.textContent !== leader) { lead.textContent = leader; U.bump(lead); }
      const vert = document.querySelector('.ch-track.vert');
      const prop = vert ? 'bottom' : 'left';
      document.getElementById('tfill').style[vert ? 'height' : 'width'] = p * 100 + '%';
      document.getElementById('tus').style[prop] = p * 100 + '%';
      document.getElementById('tchase').style[prop] = Math.min(1, b.chaser / b.goal) * 100 + '%';
      const stage = document.getElementById('stage');
      stage.classList.toggle('ch-close', danger);
      for (const e of b.ev) {
        if (e.id <= this.seen) continue;
        this.seen = e.id;
        if (e.kind === 'caught') {
          U.bump(document.getElementById('chFlash'), 'on');
          U.shake(stage, true);
          U.sfx('boom');
          const s = stage.getBoundingClientRect();
          U.floatText(stage, `-${e.back}`, s.width * 0.5, s.height * 0.4, 'bad');
        }
        fx(e);
      }
      return { p, gap, danger, stage, near: Math.max(0, Math.min(1, gap / (b.goal * 0.14))) };
    },

    // redraw the class pack when the leaders change; art(name) draws one member
    pack(el, names, art) {
      const k = names.join('|');
      if (el.dataset.key === k) return;
      el.dataset.key = k;
      el.innerHTML = names.map((n, i) => `<div class="ch-member" data-name="${esc(n)}" style="--i:${i};--row:${i % 3};--col:${Math.floor(i / 3)}">${art(n)}<span>${esc(n)}</span></div>`).join('');
    },
    member(name) {
      return document.querySelector(`.ch-member[data-name="${CSS.escape(name)}"]`);
    },

    // float "+gain name" over a team member (or the given element) and sparkle
    boostFx(stage, el, e, colors) {
      const s = stage.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      U.floatText(stage, `+${e.gain} ${e.name}`, r.left - s.left + r.width / 2, r.top - s.top, e.perfect ? 'gold' : 'good');
      U.burst(stage, r.left - s.left + r.width / 2, r.top - s.top + r.height * 0.6, colors, e.perfect ? 14 : 6, 50);
    },

    // the standard results table of a chase game
    table(r, unit, perfectLabel) {
      return U.table(r.players, [
        ['#', (p, i) => i + 1],
        ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
        ['מטרים', (p) => `${unit} ${p.dist}`],
        [perfectLabel, (p) => `✨ ${p.perfect}`],
        ['נכונות', (p) => p.correct],
      ], 10);
    },

    playerEnded(you, { win, lose, line }) {
      const r = you.results;
      const mine = r.players.find((p) => p.name === you.name) || { dist: 0, perfect: 0, correct: 0 };
      return U.playerResult({
        win: r.victory,
        title: r.victory ? win : lose.replace('{pct}', r.pct),
        big: `${mine.dist}`,
        bigLabel: 'מטרים שהבאת לכיתה',
        lines: [`✨ ${mine.perfect} ${line}`, `✅ ${mine.correct} תשובות נכונות`, ...(r.minis ? [`⭐ ${r.minis} מיני-משחקים הצליחו`] : [])],
      });
    },

    // the "+gain" screen after an action
    resultScreen(app, ctx, { art, gain, title, pill, bad, cls = '' }) {
      U.sfx(bad ? 'bad' : 'good');
      app.innerHTML = `${ctx.topBar()}<div class="act-result"><div class="ar-art ${cls}">${art}</div><div class="ar-big ${bad ? 'neg' : ''}">+${gain}</div><div class="ar-title">${title}</div>${pill ? `<div class="pill">${pill}</div>` : ''}</div>`;
    },

    // ---------- host: the overlay on top of the game stage ----------
    host(stage, m, theme) {
      let box = document.getElementById('chMini');
      if (!m) {
        if (box && !box.classList.contains('out')) {
          box.classList.add('out');
          setTimeout(() => box.remove(), 500);
        }
        this.hostKey = '';
        return;
      }
      const k = m.id + ':' + m.stage;
      if (!box || box.classList.contains('out')) {
        if (box) box.remove();
        box = document.createElement('div');
        box.id = 'chMini';
        box.className = 'ch-mini';
        stage.appendChild(box);
        this.hostKey = '';
      }
      const s = spec(theme, m.kind);
      if (this.hostKey !== k) {
        this.hostKey = k;
        const bar = `<div class="ch-bar"><i style="animation-duration:${m.ms}ms"></i></div>`;
        if (m.stage === 'intro') {
          U.sfx('go');
          box.innerHTML = `<div class="ch-card ch-intro"><div class="ch-tag">⭐ נקודת ציון: מיני-משחק לכל הכיתה</div><div class="ch-icon">${s.icon}</div><h2>${esc(s.title)}</h2><p>${esc(s.sub)}</p>${bar}</div>`;
        } else if (m.stage === 'play') {
          U.sfx('tick');
          const body = m.kind === 'code' && m.code
            ? `<div class="ch-code">${m.code.map((c, i) => `<div class="ch-slot" style="--i:${i}">${key(c)}<b>${i + 1}</b></div>`).join('')}</div>`
            : `<div class="ch-icon big">${s.icon}</div>`;
          box.innerHTML = `<div class="ch-card ch-play"><h2>${esc(s.host)}</h2>${body}<div class="ch-done">סיימו <b id="chDone">0</b> מתוך ${m.of}</div>${bar}</div>`;
        } else {
          const r = m.result || { stars: 0, jump: 0, pct: 0 };
          U.sfx(r.stars ? 'win' : 'bad');
          box.innerHTML = `<div class="ch-card ch-result ${r.stars ? 'ch-won' : ''}"><h2>${r.stars >= 3 ? 'מושלם!' : r.stars ? 'כל הכבוד!' : 'אוי, כמעט…'}</h2>${stars(r.stars)}
            <div class="ch-gain">${r.jump ? `+${r.jump} מטר קדימה` : 'אין בונוס הפעם'}</div><div class="ch-pct">הכיתה הצליחה ב־${r.pct}%${r.best ? ` · ⭐ ${esc(r.best)}` : ''}</div></div>`;
          if (r.stars) {
            const b = stage.getBoundingClientRect();
            U.burst(stage, b.width / 2, b.height * 0.42, ['#ffd23f', '#fff', '#2ee59d', '#ff4fa3'], 30, 220);
          }
        }
      }
      const d = document.getElementById('chDone');
      if (d && d.textContent !== String(m.done)) { d.textContent = m.done; U.bump(d); }
    },

    // ---------- phone ----------
    // returns true when the phone is in a checkpoint game (and draws it)
    phone(app, you, ctx, theme) {
      if (you.phase !== 'mini' || !you.mini) return false;
      const m = you.mini;
      const s = spec(theme, m.kind);
      if (m.stage === 'play' && !m.done) {
        if (!ctx.setView('mini' + m.id + ':play')) return true;
        this[m.kind](app, m, s, ctx);
        return true;
      }
      if (!ctx.setView('mini' + m.id + ':' + m.stage + ':' + (m.done ? 1 : 0))) return true;
      if (m.stage === 'intro') {
        U.sfx('go');
        if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
        app.innerHTML = `${ctx.topBar()}<div class="ch-phone ch-intro"><div class="ch-tag">⭐ עצירה! מיני-משחק לכל הכיתה</div><div class="ch-icon">${s.icon}</div><h2>${esc(s.title)}</h2><p>${esc(s.sub)}</p><div class="ch-bar"><i style="animation-duration:${m.ms}ms"></i></div></div>`;
      } else if (m.stage === 'play') {
        app.innerHTML = `${ctx.topBar()}<div class="ch-phone ch-wait"><div class="ch-icon">${s.icon}</div><h2>${m.score >= 0.75 ? 'מצוין!' : m.score >= 0.4 ? 'יפה!' : 'נשלח!'}</h2><div class="ch-score">${Math.round((m.score || 0) * 100)}%</div><p>מחכים לשאר הכיתה<span class="dots"><i></i><i></i><i></i></span></p></div>`;
      } else {
        const r = m.result || { stars: 0, jump: 0 };
        app.innerHTML = `${ctx.topBar()}<div class="ch-phone ch-result ${r.stars ? 'ch-won' : ''}"><h2>${r.stars ? 'הכיתה הצליחה!' : 'לא נורא!'}</h2>${stars(r.stars)}
          <div class="ch-gain">${r.jump ? `+${r.jump} מטר לכולם` : 'ממשיכים לרוץ'}</div>${r.bonus ? `<div class="pill">+${r.bonus} לך</div>` : ''}<p>חוזרים לשאלות…</p></div>`;
      }
      return true;
    },

    // a play screen with a countdown bar. Returns { send(data) once, end: set to what happens when time is up }
    frame(app, m, s, ctx, body) {
      app.innerHTML = `${ctx.topBar()}<div class="ch-phone ch-play"><div class="ch-head"><span>${s.icon}</span><b>${esc(s.title)}</b></div><div class="ch-bar"><i style="animation-duration:${m.ms}ms"></i></div>${body}</div>`;
      const ctl = { sent: false, end: null };
      ctl.send = (data) => {
        if (ctl.sent) return;
        ctl.sent = true;
        clearTimeout(t);
        ctx.act('mini', data);
      };
      // a little before the server's clock runs out, so the packet lands in time
      const t = setTimeout(() => ctl.end && ctl.end(), Math.max(500, m.ms - 150));
      return ctl;
    },

    mash(app, m, s, ctx) {
      const ctl = this.frame(app, m, s, ctx, `<div class="ch-mash"><div class="ch-meter"><i id="chFill"></i></div><div class="ch-count" id="chCount">0</div><button class="ch-tap" id="chTap"><span>${s.icon}</span>הקישו!</button></div>`);
      let taps = 0;
      const btn = document.getElementById('chTap');
      const cnt = document.getElementById('chCount');
      const fill = document.getElementById('chFill');
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        taps++;
        cnt.textContent = taps;
        fill.style.height = Math.min(100, (taps / 45) * 100) + '%';
        U.bump(btn, 'hit');
        if (taps % 5 === 0) U.sfx('tick');
        if (navigator.vibrate) navigator.vibrate(6);
      });
      btn.oncontextmenu = (e) => e.preventDefault();
      ctl.end = () => { btn.disabled = true; ctl.send({ taps }); };
    },

    code(app, m, s, ctx) {
      const ctl = this.frame(app, m, s, ctx, `<div class="ch-look">👀 הסתכלו על המסך הגדול</div><div class="ch-slots" id="chSlots">${'<i></i>'.repeat(4)}</div>
        <div class="ch-keys">${KEYS.map((_, i) => `<button class="ch-kbtn" data-k="${i}">${key(i)}</button>`).join('')}</div><button class="btn ghost ch-back" id="chBack">⌫ מחיקה</button>`);
      const seq = [];
      const slots = document.getElementById('chSlots');
      const draw = () => { [...slots.children].forEach((el, i) => { el.innerHTML = seq[i] !== undefined ? key(seq[i]) : ''; el.classList.toggle('on', seq[i] !== undefined); }); };
      app.querySelectorAll('.ch-kbtn').forEach((b) => {
        b.onclick = () => {
          if (seq.length >= 4) return;
          seq.push(Number(b.dataset.k));
          U.bump(b);
          U.sfx('pop');
          draw();
          if (seq.length === 4) {
            app.querySelectorAll('button').forEach((x) => (x.disabled = true));
            setTimeout(() => ctl.send({ seq }), 350);
          }
        };
      });
      document.getElementById('chBack').onclick = () => { seq.pop(); draw(); };
      ctl.end = () => ctl.send({ seq });
    },

    pop(app, m, s, ctx) {
      const ctl = this.frame(app, m, s, ctx, `<div class="ch-field" id="chField"><div class="ch-hits">🎯 <b id="chHits">0</b> / ${m.pops.length}</div></div>`);
      const field = document.getElementById('chField');
      const hits = [];
      const each = (m.ms - 600) / m.pops.length;
      const timers = m.pops.map(([x, y], i) => setTimeout(() => {
        const b = document.createElement('button');
        b.className = 'ch-spark';
        b.style.cssText = `left:${x}%;top:${y}%;--life:${each + 250}ms`;
        b.innerHTML = s.spark || '✨';
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (b.classList.contains('got')) return;
          b.classList.add('got');
          hits.push(i);
          document.getElementById('chHits').textContent = hits.length;
          const r = field.getBoundingClientRect();
          const br = b.getBoundingClientRect();
          U.burst(field, br.left - r.left + br.width / 2, br.top - r.top + br.height / 2, ['#ffd23f', '#fff', '#ff4fa3'], 8, 50);
          U.sfx('coin');
          if (navigator.vibrate) navigator.vibrate(8);
        });
        field.appendChild(b);
        setTimeout(() => b.remove(), each + 300);
      }, 250 + i * each));
      ctl.end = () => { timers.forEach(clearTimeout); ctl.send({ hits }); };
    },
  };
})();
