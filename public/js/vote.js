// Choosing the game: the teacher's lottery ("🎲 הגרלה"), or a vote of the class where each student may also pick
// "🎲 הפתיעו אותי" (their vote becomes a random game). Phone side and host side.
window.Vote = (function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------------- the student's phone ----------------
  // a signature that changes whenever the vote screen must be redrawn
  const sig = (you) => (you.vote ? [you.vote.done, you.vote.winner, you.vote.mine, you.vote.cands.length].join(',') : '0');

  function phoneHtml(you) {
    const v = you.vote;
    if (!v) return '';
    if (v.done) {
      const w = v.cands.find((c) => c.id === v.winner);
      return `<div class="vt-box vt-done"><div class="vt-title">🎉 הכיתה בחרה</div><div class="vt-win">${w ? `${esc(w.emoji)} ${esc(w.title)}` : ''}</div></div>`;
    }
    return `<div class="vt-box"><div class="vt-title">🗳️ איזה משחק משחקים?</div>
      <div class="vt-bar"><i style="animation-duration:${Math.max(1000, v.left)}ms"></i></div>
      <div class="vt-cands">${v.cands.map((c) => `<button class="vt-cand ${v.mine === c.id ? 'on' : ''}" data-id="${esc(c.id)}"><span class="vt-art">${window.Art ? Art.cover(c.id) : ''}</span><b>${esc(c.title)}</b></button>`).join('')}
        <button class="vt-cand vt-rand ${v.mine === 'rand' ? 'on' : ''}" data-id="rand"><span class="vt-dice">🎲</span><b>הפתיעו אותי</b></button></div>
      <div class="vt-hint">${v.mine ? (v.mine === 'rand' ? 'הצבעת להפתעה: ייבחר לך משחק אקראי' : 'ההצבעה נקלטה, אפשר לשנות') : 'הקישו כדי להצביע'}</div></div>`;
  }

  function bind(root, you, send) {
    const box = root.querySelector('.vt-cands');
    if (!box) return;
    box.onclick = (e) => {
      const b = e.target.closest('.vt-cand');
      if (!b) return;
      if (window.U) U.sfx('pop');
      if (navigator.vibrate) navigator.vibrate(15);
      send(b.dataset.id);
    };
  }

  // ---------------- the teacher's page ----------------
  let seenLottery = null; // null until the first render: a lottery that already happened is not replayed
  let spinning = false;
  let ticker = 0;

  // the lottery: titles flash by and slow down, then land on the chosen game
  function spin(games, winnerId) {
    if (spinning || !games.length) return;
    spinning = true;
    document.getElementById('lotBox')?.remove();
    const m = document.createElement('div');
    m.id = 'lotBox';
    m.className = 'lot-box';
    m.innerHTML = '<div class="lot-card"><div class="lot-title">🎲 מגרילים משחק…</div><div class="lot-art" id="lotArt"></div><div class="lot-name" id="lotName"></div></div>';
    document.body.appendChild(m);
    const show = (g) => { m.querySelector('#lotArt').innerHTML = window.Art ? Art.cover(g.id) : ''; m.querySelector('#lotName').textContent = `${g.emoji} ${g.title}`; };
    const win = games.find((g) => g.id === winnerId) || games[0];
    const order = [];
    for (let i = 0; i < 16; i++) order.push(games[Math.floor(Math.random() * games.length)]);
    order.push(win);
    let i = 0;
    const step = () => {
      show(order[i]);
      if (window.U) U.sfx('tick');
      i++;
      if (i < order.length) return setTimeout(step, 70 + i * i * 2.2);
      m.classList.add('landed');
      m.querySelector('.lot-title').textContent = '🎉 נבחר!';
      if (window.U) { U.sfx('good'); U.confetti && U.confetti(); }
      setTimeout(() => { m.remove(); spinning = false; }, 2200);
    };
    step();
  }

  // called on every host render: plays a new lottery once, and draws the vote panel
  function hostSync(st, ask) {
    const l = st.lastLottery;
    const at = l ? l.at : 0;
    if (seenLottery === null) seenLottery = at;
    else if (at !== seenLottery) {
      seenLottery = at;
      if (l && st.phase === 'lobby' && Date.now() - l.at < 4000) spin(st.games, l.id);
    }
    const v = st.vote;
    let box = document.getElementById('voteBox');
    if (!v || st.phase !== 'lobby') { box?.remove(); clearInterval(ticker); return; }
    if (!box) {
      box = document.createElement('div');
      box.id = 'voteBox';
      box.className = 'modal';
      document.body.appendChild(box);
      box.onclick = (e) => {
        if (e.target.id === 'vtEnd') ask('end');
        else if (e.target.id === 'vtCancel') ask('cancel');
        else if (e.target.id === 'vtOk' || e.target === box) { box.remove(); }
      };
    }
    const total = Math.max(1, v.voters);
    const max = Math.max(1, ...v.cands.map((c) => c.n), v.rand);
    if (v.done) {
      const w = v.cands.find((c) => c.id === v.winner);
      box.innerHTML = `<div class="modal-card vt-host"><h2>🎉 הכיתה בחרה</h2><div class="vt-hwin">${window.Art ? `<span class="vt-hart">${Art.cover(v.winner)}</span>` : ''}<b>${w ? esc(w.emoji + ' ' + w.title) : ''}</b></div>
        <div class="muted">${v.voters} הצביעו · ${v.rand} מהם בחרו "הפתיעו אותי"</div><button class="btn big" id="vtOk">יאללה, ממשיכים</button></div>`;
      clearInterval(ticker);
      return;
    }
    box.innerHTML = `<div class="modal-card vt-host"><h2>🗳️ הכיתה מצביעה על משחק</h2>
      <div class="muted"><span id="vtLeft">${Math.ceil(v.left / 1000)}</span> שניות · ${v.voters} הצביעו</div>
      <div class="vt-rows">${v.cands.map((c) => `<div class="vt-row"><span class="vt-rn">${esc(c.emoji)} ${esc(c.title)}</span><div class="vt-track"><i style="width:${(c.n / max) * 100}%"></i></div><b>${c.n}</b></div>`).join('')}
        <div class="vt-row"><span class="vt-rn">🎲 הפתיעו אותי</span><div class="vt-track"><i style="width:${(v.rand / max) * 100}%"></i></div><b>${v.rand}</b></div></div>
      <div class="vt-btns"><button class="btn" id="vtEnd">סיימו עכשיו</button><button class="btn ghost" id="vtCancel">ביטול</button></div></div>`;
    clearInterval(ticker);
    const end = Date.now() + v.left;
    ticker = setInterval(() => { const el = document.getElementById('vtLeft'); if (el) el.textContent = Math.max(0, Math.ceil((end - Date.now()) / 1000)); }, 500);
    void total;
  }

  return { sig, phoneHtml, bind, spin, hostSync };
})();
