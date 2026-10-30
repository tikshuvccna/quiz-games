// Client side of "פאזל קבוצתי": each team builds its own picture; on the phone a correct answer gives you a piece to place.
(function () {
  const { esc } = U;
  const CELL = 40; // the picture is 160 x 120 in a 4 x 3 grid of 40 x 40 pieces

  const rng = (a) => () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // six flat-colour pictures (no gradients, so the same picture can sit on the page many times without id clashes)
  const THEMES = [
    { sky: ['#6ec6ff', '#9fdcff', '#c9ecff'], sun: '#ffe066', hill: ['#5fbf63', '#3fa34d'], water: '#3a9be0', roof: '#d9534f', wall: '#fff3d6', tree: '#2e8b3d' },
    { sky: ['#ff8a5c', '#ffb36b', '#ffd59a'], sun: '#fff0a8', hill: ['#a0522d', '#7a3b1d'], water: '#c0508a', roof: '#6a3d9a', wall: '#ffe9c9', tree: '#5a7a2a' },
    { sky: ['#101845', '#1b2a6b', '#2a3f8f'], sun: '#fffbe0', hill: ['#1f3d4f', '#16303f'], water: '#27508f', roof: '#e8a33d', wall: '#c9d6ff', tree: '#1e5a4a' },
    { sky: ['#cfe8ff', '#e3f2ff', '#f4faff'], sun: '#fff', hill: ['#e8f1f8', '#cfe0ec'], water: '#8fc5e8', roof: '#4a6fa5', wall: '#ffffff', tree: '#3d7a5a' },
    { sky: ['#ff9ad5', '#ffc2e6', '#ffe0f2'], sun: '#fff3a0', hill: ['#b57be8', '#8e55c9'], water: '#5fc9e8', roof: '#ff5fa3', wall: '#fff0fa', tree: '#4cc38a' },
    { sky: ['#2ec4b6', '#6fdccf', '#b7efe6'], sun: '#ffd166', hill: ['#e9c46a', '#d9a640'], water: '#1d7fa8', roof: '#e76f51', wall: '#fff8e8', tree: '#2a9d8f' },
  ];

  // the whole picture for a team (160 x 120)
  function scene(i) {
    const T = THEMES[i % THEMES.length];
    const r = rng(1000 + i * 97);
    const sx = 20 + r() * 120;
    const p = [];
    p.push(`<rect width="160" height="40" fill="${T.sky[0]}"/><rect y="40" width="160" height="25" fill="${T.sky[1]}"/><rect y="65" width="160" height="20" fill="${T.sky[2]}"/>`);
    p.push(`<circle cx="${sx.toFixed(0)}" cy="${(12 + r() * 16).toFixed(0)}" r="${(9 + r() * 5).toFixed(0)}" fill="${T.sun}"/>`);
    for (let k = 0; k < 3; k++) p.push(`<ellipse cx="${(r() * 150).toFixed(0)}" cy="${(10 + r() * 38).toFixed(0)}" rx="${(12 + r() * 10).toFixed(0)}" ry="5" fill="#fff" opacity=".85"/>`);
    // far and near hills
    let d = `M0 78 `;
    for (let x = 0; x <= 160; x += 20) d += `L${x} ${(66 + r() * 14).toFixed(0)} `;
    p.push(`<path d="${d}L160 120 L0 120Z" fill="${T.hill[0]}"/>`);
    d = `M0 92 `;
    for (let x = 0; x <= 160; x += 20) d += `L${x} ${(86 + r() * 10).toFixed(0)} `;
    p.push(`<path d="${d}L160 120 L0 120Z" fill="${T.hill[1]}"/>`);
    // a lake with a boat
    const lx = 8 + r() * 80;
    p.push(`<ellipse cx="${(lx + 30).toFixed(0)}" cy="106" rx="30" ry="8" fill="${T.water}"/>`);
    p.push(`<path d="M${(lx + 22).toFixed(0)} 104 h16 l-3 5 h-10Z" fill="#8a5226"/><path d="M${(lx + 30).toFixed(0)} 104 v-12 l8 9Z" fill="#fff"/>`);
    // a house
    const hx = 100 + r() * 36;
    p.push(`<rect x="${hx.toFixed(0)}" y="88" width="20" height="16" fill="${T.wall}" stroke="#333" stroke-width="1"/><path d="M${(hx - 3).toFixed(0)} 88 L${(hx + 10).toFixed(0)} 76 L${(hx + 23).toFixed(0)} 88Z" fill="${T.roof}" stroke="#333" stroke-width="1"/><rect x="${(hx + 8).toFixed(0)}" y="95" width="5" height="9" fill="#6a4a2a"/>`);
    // trees
    for (let k = 0; k < 3; k++) {
      const tx = 6 + r() * 148;
      const ty = 92 + r() * 18;
      p.push(`<rect x="${(tx - 1.5).toFixed(0)}" y="${ty.toFixed(0)}" width="3" height="8" fill="#6a4a2a"/><circle cx="${tx.toFixed(0)}" cy="${(ty - 3).toFixed(0)}" r="${(6 + r() * 3).toFixed(0)}" fill="${T.tree}"/>`);
    }
    // flowers and birds so that no two pieces look alike
    for (let k = 0; k < 14; k++) p.push(`<circle cx="${(r() * 160).toFixed(0)}" cy="${(100 + r() * 18).toFixed(0)}" r="1.8" fill="${['#ff4d6d', '#ffd23f', '#fff', '#c77dff'][k % 4]}"/>`);
    for (let k = 0; k < 3; k++) { const bx = r() * 150; const by = 12 + r() * 40; p.push(`<path d="M${bx.toFixed(0)} ${by.toFixed(0)} q3 -4 6 0 q3 -4 6 0" fill="none" stroke="#222" stroke-width="1.2"/>`); }
    return p.join('');
  }
  const piece = (team, idx, size) => {
    const x = (idx % 4) * CELL;
    const y = Math.floor(idx / 4) * CELL;
    return `<svg viewBox="${x} ${y} ${CELL} ${CELL}" width="${size}" height="${size}" style="display:block">${scene(team)}</svg>`;
  };

  Art.covers.tpuzzle = () => `<rect width="160" height="100" fill="#2a1f6e"/>${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${14 + (i % 3) * 44}" y="${10 + Math.floor(i / 3) * 44}" width="40" height="40" rx="6" fill="${['#ff4d6d', '#ffd23f', '#2ee59d', '#22c7e8', '#8b5cf6', '#ff8a3d'][i]}" stroke="#fff" stroke-width="2.5"/>`).join('')}
    <path d="M54 30 h6 a5 5 0 1 1 0 10 h-6Z" fill="#fff" opacity=".9"/><text x="72" y="82" font-size="22">🧩</text>`;

  Games.tpuzzle = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'tpuzzle',
        cls: 'tp-room',
        stats: `<div class="stat" style="${U.pal('#8b5cf6')}"><span class="lbl">🧩 חלקים בסך הכול</span><span class="val" id="tpn">0</span></div>`,
        stage: `<div class="tp-grid n${b.teams.length}" id="tpg"></div>`,
      })) this.sig = '';
      U.hostTick(st, `${b.teams.length} קבוצות · ראשונה שמשלימה מנצחת`);
      U.countTo(document.getElementById('tpn'), b.counts.reduce((s, n) => s + n, 0));
      const sig = b.placed.map((a) => a.join(',')).join('|') + ':' + b.winner;
      if (sig !== this.sig) {
        this.sig = sig;
        const total = b.cols * b.rows;
        document.getElementById('tpg').innerHTML = b.teams.map((t, ti) => {
          const have = new Set(b.placed[ti]);
          const cells = Array.from({ length: total }, (_, i) => {
            const x = (i % b.cols) * CELL;
            const y = Math.floor(i / b.cols) * CELL;
            return have.has(i)
              ? `<svg x="${x}" y="${y}" width="${CELL}" height="${CELL}" viewBox="${x} ${y} ${CELL} ${CELL}">${scene(ti)}</svg>`
              : `<rect x="${x + 1}" y="${y + 1}" width="${CELL - 2}" height="${CELL - 2}" rx="4" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.25)" stroke-dasharray="4 3"/><text x="${x + CELL / 2}" y="${y + CELL / 2 + 6}" text-anchor="middle" font-size="16" fill="rgba(255,255,255,.35)">?</text>`;
          }).join('');
          return `<div class="tp-card ${b.winner === ti ? 'won' : ''}" style="${U.pal(t.color)}"><div class="tp-head">${Art.mascot(ti)}<b>${esc(t.name)}</b><span>${b.counts[ti]}/${total}</span></div>
            <svg viewBox="0 0 160 120" class="tp-pic">${cells}</svg></div>`;
        }).join('');
      }
    },

    hostEnded(app, st) {
      if (!U.view(app, 'tpuzzle-end')) return;
      const r = st.results;
      U.hostResults(app, st, {
        title: r.winner < 0 ? 'תיקו!' : `${esc(r.teams[r.winner].name)} ניצחו!`,
        body: `<div class="end-visual">${U.teamsMini(r.teams, r.scores, r.winner, 'team-final compact')}</div>`,
        table: U.table(r.players, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name, r.teams[p.team].color)}${esc(p.name)}</span>`],
          ['חלקים שהונחו', (p) => `🧩 ${p.put}`],
          ['קיבל/ה', (p) => p.given],
          ['נכונות', (p) => p.correct],
        ], 10),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">🧩 ${you.placed ? you.placed.length : 0}/12</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase === 'pz') {
        if (!ctx.setView('pz' + you.qid + ':' + you.turn)) return true;
        const have = new Set(you.placed);
        const tm = you.team;
        const cells = Array.from({ length: you.cols * you.rows }, (_, i) => {
          const x = (i % you.cols) * CELL;
          const y = Math.floor(i / you.cols) * CELL;
          return `<svg x="${x}" y="${y}" width="${CELL}" height="${CELL}" viewBox="${x} ${y} ${CELL} ${CELL}" opacity="${have.has(i) ? 1 : 0.3}">${scene(tm)}</svg>`;
        }).join('');
        const hit = Array.from({ length: you.cols * you.rows }, (_, i) => `<rect class="tp-hit ${have.has(i) ? 'done' : ''}" data-s="${i}" x="${(i % you.cols) * CELL}" y="${Math.floor(i / you.cols) * CELL}" width="${CELL}" height="${CELL}"/>`).join('');
        app.innerHTML = `${ctx.topBar()}<div class="timebar"><i style="animation-duration:${you.ms}ms"></i></div>
          <div class="tp-ph"><div class="tp-want"><small>החלק שלכם</small><div class="tp-piece">${piece(tm, you.piece, 96)}</div></div>
          <div class="phase-title" style="margin:0">איפה הוא בתמונה?<small>הקישו על המקום הנכון</small></div></div>
          <svg class="tp-board" viewBox="0 0 160 120">${cells}<path d="M40 0V120M80 0V120M120 0V120M0 40H160M0 80H160" stroke="#fff" stroke-width=".8" opacity=".7"/>${hit}</svg>`;
        let done = false;
        app.querySelector('.tp-board').addEventListener('pointerdown', (e) => {
          const r = e.target.closest('.tp-hit');
          if (!r || done) return;
          done = true;
          r.classList.add('pick');
          U.sfx('pop');
          if (navigator.vibrate) navigator.vibrate(20);
          ctx.act('place', { slot: Number(r.dataset.s) });
        });
        return true;
      }
      if (you.phase === 'pzdone') {
        if (!ctx.setView('pzd' + you.qid + ':' + you.turn)) return true;
        const n = you.res.note;
        const M = { placed: ['🧩', 'הנחתם את החלק!', 'התמונה של הקבוצה מתקדמת'], dup: ['🤝', 'חבר/ה כבר הניחו אותו', 'עבודת צוות!'], wrong: ['🙈', 'לא שם…', 'החלק חוזר לערימה'], late: ['⏰', 'נגמר הזמן', 'נסו שוב בתור הבא'] }[n] || ['🧩', '', ''];
        app.innerHTML = `${ctx.topBar()}<div class="act-result"><div class="ar-art">${M[0]}</div><div class="ar-title">${M[1]}</div><div class="ar-sub">${M[2]}</div></div>`;
        if (n === 'placed') U.burst(app, app.clientWidth / 2, 200, ['#fff', '#ffd23f', '#2ee59d'], 18, 140);
        return true;
      }
      return false;
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results;
      const mine = r.players.find((p) => p.name === you.name) || { put: 0, given: 0, correct: 0 };
      const win = r.winner === you.team;
      return U.playerResult({
        win,
        title: r.winner < 0 ? 'תיקו!' : win ? 'הקבוצה שלכם סיימה ראשונה!' : 'כמעט! בפעם הבאה',
        extra: U.teamsMini(r.teams, r.scores, r.winner),
        lines: [`🧩 הנחתם ${mine.put} חלקים`, `🎁 קיבלתם ${mine.given} חלקים`, `✅ ${mine.correct} תשובות נכונות`],
      });
    },
  };
})();
