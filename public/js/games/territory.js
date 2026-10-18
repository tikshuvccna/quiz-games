// Client side of "כובשי הממלכה": 3D island board + host/player screens.
(function () {
  const { esc } = U;
  const ICON = { a: () => Art.sword(), f: (c) => Art.shield(c), c: (c) => Art.flag(c) };
  const NEUTRAL = { c: '#7fcf5a', c1: '#a6e67c', s: '#3f8a31' };
  const ACT_LABEL = { a: 'תקיפה', f: 'חיזוק', c: 'כיבוש' };

  const Board = {
    // flip = draw the board transposed (tall), used on portrait phones
    mount(el, cols, rows, flip) {
      el.classList.add('board');
      el.dataset.flip = flip ? 1 : 0;
      el.style.setProperty('--cols', flip ? rows : cols);
      el.style.setProperty('--rows', flip ? cols : rows);
      el.dataset.size = cols * rows;
      el.innerHTML = '';
      for (let i = 0; i < cols * rows; i++) {
        const d = document.createElement('div');
        d.className = 'tile';
        const r = Math.floor(i / cols);
        const c = i % cols;
        if (flip) {
          d.style.gridRow = c + 1;
          d.style.gridColumn = r + 1;
        }
        d.style.zIndex = (flip ? c : r) + 1; // lower rows draw on top so the tile fronts show
        d.innerHTML = '<i class="ic"></i><b class="lv"></b><u class="ac"></u>';
        el.appendChild(d);
      }
    },

    // opts: { kinds: Map(tile -> 'a'|'f'|'c') | null, onTap(i), team }
    update(el, b, opts = {}) {
      if (el.dataset.size !== String(b.cols * b.rows) || el.dataset.flip !== (opts.flip ? '1' : '0')) this.mount(el, b.cols, b.rows, opts.flip);
      el.classList.toggle('t4', b.teams.length >= 4);
      const castles = new Set(b.castles);
      const pal = b.teams.map((t) => ({ c: t.color, c1: U.shade(t.color, 1.3), s: U.shade(t.color, 0.55) }));
      const myColor = opts.team >= 0 ? b.teams[opts.team].color : '#fff';
      for (let i = 0; i < el.children.length; i++) {
        const t = el.children[i];
        const owner = b.cells[i];
        const lvl = b.lvl[i];
        const isCastle = castles.has(i);
        const key = owner + ':' + lvl + ':' + isCastle;
        if (t.dataset.key !== key) {
          const was = t.dataset.key;
          if (was !== undefined && was.split(':')[0] !== String(owner)) {
            U.bump(t, 'pop');
            if (opts.fx) opts.fx(t, owner);
          } else if (was !== undefined) U.bump(t, 'thud');
          t.dataset.key = key;
          const p = owner >= 0 ? pal[owner] : NEUTRAL;
          t.style.setProperty('--c', p.c);
          t.style.setProperty('--c1', p.c1);
          t.style.setProperty('--s', p.s);
          t.style.setProperty('--lvl', owner >= 0 ? lvl : 0);
          t.querySelector('.lv').innerHTML = owner >= 0 && lvl >= 2 ? '<i></i>'.repeat(lvl - 1) : '';
          t.classList.toggle('neutral', owner < 0);
          t.classList.toggle('castle', isCastle);
          t.querySelector('.ic').innerHTML = isCastle ? Art.castle(owner >= 0 ? b.teams[owner].color : '#ffd23f') : '';
        }
        const k = opts.kinds ? opts.kinds.get(i) : null;
        if (t.dataset.k !== (k || '')) {
          t.dataset.k = k || '';
          t.classList.toggle('valid', !!k);
          t.querySelector('.ac').innerHTML = k ? ICON[k](myColor) : '';
        }
        t.classList.toggle('dim', !!opts.kinds && !k);
        t.onclick = k && opts.onTap ? () => opts.onTap(i, t) : null;
      }
    },
  };


  Games.territory = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'territory',
        stats: U.teamBadges(b.teams),
        cls: 'sea',
        stage: `<div class="waves"></div><div class="board-wrap"><div id="board"></div></div>
          <div class="legend-bar"><span>${Art.castle('#ffd23f')} טירה = 2 נק׳ + דגל בונוס</span><span>${Art.sword()} תקיפה מחלישה אריח אויב</span><span>${Art.shield('#9aa6c2')} חיזוק מגן</span><span>${Art.flame()} רצף 3 = דגל בונוס</span></div>`,
      })) this.stage = document.getElementById('stage');
      b.teams.forEach((_, i) => {
        U.countTo(document.getElementById('ts' + i), b.scores[i]);
        document.getElementById('tsub' + i).textContent = `${b.tiles[i]} אריחים · ${b.castleCount[i]} טירות`;
      });
      U.teamLead(b.scores);
      U.hostTick(st, `${st.players.length} שחקנים · קבוצה נגד קבוצה`);
      const stage = this.stage;
      Board.update(document.getElementById('board'), b, {
        fx: (t, owner) => {
          const r = t.getBoundingClientRect();
          const s = stage.getBoundingClientRect();
          U.burst(stage, r.left - s.left + r.width / 2, r.top - s.top + r.height / 2, [b.teams[owner] ? b.teams[owner].color : '#fff', '#fff', '#ffd23f'], 12, 70);
        },
      });
    },

    hostEnded(app, st) {
      if (!U.view(app, 'territory-end')) return;
      const r = st.results;
      const title = r.winner < 0 ? 'תיקו!' : `${esc(r.teams[r.winner].name)} ניצחו!`;
      U.hostResults(app, st, {
        title,
        body: `<div class="end-visual">${U.teamsMini(r.teams, r.scores, r.winner, 'team-final compact')}
          <div class="board-wrap end-board"><div id="board"></div></div></div>`,
        table: U.table(r.players, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name, r.teams[p.team].color)}${esc(p.name)}</span>`],
          ['כבש/ה', (p) => p.captured],
          ['דגלים', (p) => p.placed],
          ['נכונות', (p) => p.correct],
        ], 10),
      });
      Board.update(document.getElementById('board'), r.board);
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">${Art.flag('#fff')} ${you.flags}</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase !== 'place') return false;
      if (ctx.setView('place')) {
        app.innerHTML = `${ctx.topBar()}<div class="phase-title" id="pt"></div>
          <div class="p-board sea"><div class="board-wrap"><div id="board" class="small"></div></div></div>
          <div class="act-legend"><span>${Art.flag(ctx.teamColor())} כיבוש</span><span>${Art.sword()} תקיפה</span><span>${Art.shield(ctx.teamColor())} חיזוק</span></div>
          <button class="btn ghost hidden" id="skip">אין מהלך — חזרה לשאלות</button>`;
        this.el = document.getElementById('board');
        this.ctx = ctx;
        document.getElementById('skip').onclick = () => ctx.act('skip');
      } else ctx.refreshTop();
      this.you = you;
      document.getElementById('pt').innerHTML = `בחרו אריח! <small>${you.flags} ${you.flags > 1 ? 'דגלים' : 'דגל'} לשימוש · כבשו אריח צמוד לשטח שלכם</small>`;
      document.getElementById('skip').classList.toggle('hidden', !!(you.valid && you.valid.length));
      this.draw(you, ctx.board());
      return true;
    },

    onBoard(you, b) {
      if (you.phase === 'place') this.draw(you, b);
    },

    draw(you, b) {
      if (!b || !this.el || !document.body.contains(this.el)) return;
      Board.update(this.el, b, {
        team: you.team,
        flip: this.el.parentElement.clientHeight > this.el.parentElement.clientWidth * 1.1,
        kinds: new Map(you.valid || []),
        onTap: (i, t) => {
          const kind = new Map(you.valid || []).get(i);
          U.sfx(kind === 'a' ? 'boom' : 'coin');
          if (navigator.vibrate) navigator.vibrate(12);
          U.bump(t, 'pop');
          this.ctx.act('place', { tile: i });
        },
      });
    },

    playerEnded(app, you) {
      const r = you.results;
      const mine = r.players.find((p) => p.name === you.name) || { placed: 0, correct: 0, wrong: 0, captured: 0 };
      const win = r.winner === you.team;
      return U.playerResult({
        win,
        title: r.winner < 0 ? 'תיקו!' : win ? 'הקבוצה שלכם ניצחה!' : 'כמעט! בפעם הבאה',
        extra: U.teamsMini(r.teams, r.scores, r.winner),
        lines: [`🏰 כבשתם ${mine.captured} אריחים`, `🚩 הנחתם ${mine.placed} דגלים`, `✅ ${mine.correct} תשובות נכונות`],
      });
    },
  };
})();
