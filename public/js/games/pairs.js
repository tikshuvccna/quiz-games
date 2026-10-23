// Client side of "זיכרון זוגות": one shared board of flip cards on the host, the same board on the phone to pick two.
(function () {
  const { esc } = U;
  // 18 faces (the server deals 12 pairs out of them) - mirrors DECK in server/games/pairs.js
  const FACES = [
    () => Art.mascot(0), () => Art.mascot(1), () => Art.mascot(2), () => Art.mascot(3), () => Art.mascot(4), () => Art.mascot(5),
    () => Art.item('gem'), () => Art.item('crown'), () => Art.item('coin'), () => Art.item('bomb'), () => Art.item('rock'),
    () => Art.ball(), () => Art.rocket(), () => Art.moon(), () => Art.fish('gold'), () => Art.chest(4), () => Art.castle('#ff4fa3'), () => Art.trophy(),
  ];
  const face = (k) => (FACES[k] ? FACES[k]() : '');

  const cardHtml = (i) => `<button class="pr-card" data-i="${i}" style="--i:${i}"><span class="pr-in"><span class="pr-back"><i>?</i></span><span class="pr-face"><span class="pr-art"></span><em class="pr-tag"></em></span></span></button>`;

  // bring card elements in line with the state list; returns cards that just turned face up
  function sync(grid, cards, teams, mine = []) {
    const opened = [];
    cards.forEach((c, i) => {
      const el = grid.children[i];
      if (!el) return;
      const up = c.s !== 'hidden';
      if (up && el.dataset.k !== String(c.k)) {
        el.querySelector('.pr-art').innerHTML = face(c.k);
        el.dataset.k = c.k;
      }
      if (!up && el.dataset.k) {
        // keep the face until the flip-back finishes
        setTimeout(() => { if (!el.classList.contains('up')) { el.querySelector('.pr-art').innerHTML = ''; delete el.dataset.k; } }, 500);
      }
      if (up && !el.classList.contains('up')) opened.push(i);
      if (up) el.classList.remove('wait');
      el.classList.toggle('up', up);
      el.classList.toggle('gone', c.s === 'gone');
      el.classList.toggle('peek', c.s === 'peek');
      el.classList.toggle('mine', mine.includes(i));
      const tc = c.s === 'gone' ? c.team : c.s === 'peek' ? c.bt : -1;
      el.style.setProperty('--tc', tc >= 0 && teams[tc] ? teams[tc].color : '#ffd23f');
      el.querySelector('.pr-tag').textContent = c.s === 'peek' ? c.by || '' : c.s === 'gone' && teams[c.team] ? teams[c.team].name : '';
    });
    return opened;
  }

  Art.covers.pairs = () => `<rect width="160" height="100" fill="#2b1d6e"/><circle cx="20" cy="90" r="34" fill="#3a2a8f"/><circle cx="150" cy="8" r="28" fill="#3a2a8f"/>
    ${[0, 1, 2, 3, 4].map((x) => [0, 1].map((y) => {
      const up = (x === 1 && y === 0) || (x === 3 && y === 1);
      const gx = 14 + x * 27;
      const gy = 12 + y * 40;
      return `<g transform="rotate(${(x - 2) * 3} ${gx + 12} ${gy + 17})"><rect x="${gx}" y="${gy}" width="24" height="34" rx="4" fill="${up ? '#fff' : '#8b5cf6'}" stroke="${Art.O}" stroke-width="2.5"/>${up ? `<g transform="translate(${gx + 2} ${gy + 7}) scale(.2)">${Art.inner(Art.mascot(0))}</g>` : `<text x="${gx + 12}" y="${gy + 23}" font-family="Heebo,sans-serif" font-size="14" font-weight="900" text-anchor="middle" fill="#d9c9ff">?</text>`}</g>`;
    }).join('')).join('')}`;

  Games.pairs = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'pairs',
        cls: 'pr-table',
        stats: U.teamBadges(b.teams),
        stage: `<div class="pr-felt"></div><div class="pr-grid host" id="grid"></div><div class="pr-deal" id="deal"></div>`,
      })) {
        this.board = 0;
        this.seen = b.ev.length ? b.ev[b.ev.length - 1].id : 0;
      }
      b.teams.forEach((_, i) => {
        U.countTo(document.getElementById('ts' + i), b.pairs[i]);
        document.getElementById('tsub' + i).textContent = 'זוגות';
      });
      U.teamLead(b.pairs);
      U.hostTick(st, `${st.players.length} שחקנים · ${b.boards ? `לוח ${b.boards + 1}` : 'לוח ראשון'}`);
      const grid = document.getElementById('grid');
      if (this.board !== b.board) {
        this.board = b.board;
        grid.innerHTML = b.cards.map((_, i) => cardHtml(i)).join('');
        U.bump(grid, 'pr-dealt');
      }
      sync(grid, b.cards, b.teams);
      const stage = document.getElementById('stage');
      for (const e of b.ev) {
        if (e.id <= this.seen) continue;
        this.seen = e.id;
        if (e.kind === 'match') {
          const s = stage.getBoundingClientRect();
          e.cards.forEach((i) => {
            const el = grid.children[i];
            if (!el) return;
            U.bump(el, 'pr-win');
            const r = el.getBoundingClientRect();
            U.burst(stage, r.left - s.left + r.width / 2, r.top - s.top + r.height / 2, ['#fff', '#ffd23f', b.teams[e.team].color], 14, 90);
          });
          const r = grid.children[e.cards[0]]?.getBoundingClientRect();
          if (r) U.floatText(stage, `+1 ${e.name}`, r.left - s.left + r.width / 2, r.top - s.top, 'gold');
          U.sfx('win');
        } else if (e.kind === 'miss') {
          e.cards.forEach((i) => grid.children[i] && setTimeout(() => U.shake(grid.children[i]), 500));
        } else if (e.kind === 'peek') {
          U.sfx('pop');
        } else if (e.kind === 'deal') {
          const d = document.getElementById('deal');
          d.textContent = '🃏 לוח חדש!';
          U.bump(d, 'show');
        }
      }
    },

    hostEnded(app, st) {
      if (!U.view(app, 'pairs-end')) return;
      const r = st.results;
      U.hostResults(app, st, {
        title: r.winner < 0 ? 'תיקו!' : `${esc(r.teams[r.winner].name)} ניצחו!`,
        sub: `זיכרון זוגות · ${r.pairs.reduce((a, b) => a + b, 0)} זוגות${r.boards ? ` · ${r.boards} לוחות נוקו` : ''}`,
        body: `<div class="end-visual tug-end">${U.teamsMini(r.teams, r.pairs, r.winner, 'team-final')}</div>`,
        table: U.table(r.players, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name, r.teams[p.team].color)}${esc(p.name)}</span>`],
          ['זוגות', (p) => `🃏 ${p.found}`],
          ['נכונות', (p) => p.correct],
        ], 10),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">🃏 ${you.found}</span><span class="hchip">${you.pairs.join(' : ')}</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase !== 'flip' && you.phase !== 'flipped') return false;
      const key = `${you.phase}${you.qid}:${you.turn}:${you.chain}`;
      const fresh = ctx.setView(key);
      let grid = document.getElementById('pgrid');
      if (!grid || (fresh && you.phase === 'flip') || Number(grid.dataset.board) !== you.board) {
        app.innerHTML = `${ctx.topBar()}
          <div class="phase-title" id="ptitle"></div>
          <div class="p-stage pr-phone"><div class="pr-grid phone" id="pgrid" data-board="${you.board}">${you.cards.map((_, i) => cardHtml(i)).join('')}</div></div>`;
        grid = document.getElementById('pgrid');
        this.wire(grid, ctx);
      }
      this.teams = (ctx.board() && ctx.board().teams) || this.teams || [];
      const opened = sync(grid, you.cards, this.teams, you.mine);
      grid.classList.toggle('locked', you.phase !== 'flip');
      const t = document.getElementById('ptitle');
      if (you.phase === 'flip') {
        t.innerHTML = you.mine.length ? 'עכשיו את הקלף השני!<small>זוכרים איפה מסתתר הזוג שלו?</small>' : `${you.chain ? '🔥 הפיכה נוספת! ' : ''}הפכו שני קלפים<small>מצאו זוג בשביל ${esc(you.teamName || 'הקבוצה')}</small>`;
      } else if (fresh) {
        const r = you.res;
        t.innerHTML = r.match ? '<span class="good-t">זוג! +1 לקבוצה 🎉</span>' : '<span class="bad-t">לא זוג… תזכרו אותם!</span>';
        U.sfx(r.match ? 'win' : 'bad');
        if (navigator.vibrate) navigator.vibrate(r.match ? [20, 40, 20] : 40);
        if (r.match) {
          const gr = grid.getBoundingClientRect();
          r.cards.forEach((i) => { const c = grid.children[i].getBoundingClientRect(); U.burst(grid, c.left - gr.left + c.width / 2, c.top - gr.top + c.height / 2, ['#ffd23f', '#fff', ctx.teamColor()], 14, 80); U.bump(grid.children[i], 'pr-win'); });
        } else r.cards.forEach((i) => setTimeout(() => grid.children[i] && U.shake(grid.children[i]), 400));
      }
      if (opened.length && you.phase === 'flip') U.sfx('pop');
      return true;
    },

    wire(grid, ctx) {
      grid.onclick = (e) => {
        const el = e.target.closest('.pr-card');
        if (!el || grid.classList.contains('locked') || el.classList.contains('up') || el.classList.contains('wait')) return;
        if (grid.querySelectorAll('.pr-card.wait').length) return;
        el.classList.add('wait');
        setTimeout(() => el.classList.remove('wait'), 1500);
        if (navigator.vibrate) navigator.vibrate(12);
        ctx.act('flip', { card: Number(el.dataset.i) });
      };
    },

    // other players' flips show up live on the phone board
    onBoard(you, board) {
      if (you.phase !== 'flip') return;
      const grid = document.getElementById('pgrid');
      if (!grid || board.board !== you.board) return;
      this.teams = board.teams;
      sync(grid, board.cards, board.teams, you.mine);
    },

    playerEnded(app, you) {
      const r = you.results;
      const mine = r.players.find((p) => p.name === you.name) || { found: 0, correct: 0 };
      const win = r.winner === you.team;
      return U.playerResult({
        win,
        title: r.winner < 0 ? 'תיקו!' : win ? 'הקבוצה שלכם ניצחה!' : 'כמעט! בפעם הבאה',
        extra: U.teamsMini(r.teams, r.pairs, r.winner),
        lines: [`🃏 ${mine.found} זוגות שמצאתם`, `✅ ${mine.correct} תשובות נכונות`],
      });
    },
  };
})();
