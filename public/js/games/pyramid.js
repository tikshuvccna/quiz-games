// Client side of "הפירמידה האבודה": same quiz flow as the classic quiz, with the teams climbing a pyramid
// between questions and a "how sure are you?" step on the phones.
(function () {
  const { esc } = U;
  const STEP_INSET = 2.9; // % each step is narrower on each side

  const P = Object.create(Games.classic);
  P.pyramidMode = true;
  P.ptsUnit = 'מדרגות';

  P.boardHtml = function (b) {
    const py = b.pyramid;
    const H = py.height;
    const steps = Array.from({ length: H }, (_, k) => `<i class="pyr-step ${k === H - 1 ? 'cap' : ''}" style="--k:${k}"></i>`).join('');
    const prev = this.lastPos || py.pos.map(() => 0);
    const climbers = py.teams
      .map((t, i) => `<div class="pyr-team" id="pyrT${i}" style="${U.pal(t.color)};${this.place(prev[i], i, py)}">${Art.mascot(i)}<span>${prev[i]}</span></div>`)
      .join('');
    const chips = py.teams
      .map((t, i) => `<div class="pyr-chip ${py.winner === i ? 'win' : ''}" style="${U.pal(t.color)}">${Art.mascot(i)}<b>${esc(t.name)}</b><span class="g ${py.gain[i] < 0 ? 'neg' : ''}">${py.gain[i] > 0 ? '▲' + py.gain[i] : py.gain[i] < 0 ? '▼' + -py.gain[i] : '—'}</span><span class="pp">${py.pos[i]}/${H}</span></div>`)
      .join('');
    return `<div class="pyr-scene"><div class="pyr-sun"></div><div class="pyr-dunes"></div>
      <div class="pyr" style="--H:${H}">${steps}${climbers}</div>
      <div class="pyr-side"><h2>🔺 הפירמידה</h2>${chips}<div class="cl-lines col">${(b.lines || []).map((l, i) => `<span style="--i:${i}">${esc(l)}</span>`).join('')}</div></div></div>`;
  };

  // where a team stands: on top of step `pos`, in its own lane across that step
  P.place = function (pos, i, py) {
    const n = py.teams.length;
    const k = Math.min(pos, py.height - 1);
    const inset = k * STEP_INSET;
    const left = inset + ((i + 0.5) / n) * (100 - 2 * inset);
    return `left:${left}%;bottom:${(pos / py.height) * 100}%`;
  };

  // climb animation: draw at the old step, then move to the new one
  P.afterBoard = function (box, b) {
    const py = b.pyramid;
    setTimeout(() => {
      py.teams.forEach((t, i) => {
        const el = document.getElementById('pyrT' + i);
        if (!el) return;
        el.style.cssText += ';' + this.place(py.pos[i], i, py);
        el.querySelector('span').textContent = py.pos[i];
        if (py.gain[i] > 0) U.bump(el, 'hop');
        if (py.gain[i] < 0) U.bump(el, 'slip');
      });
      if (py.winner >= 0) setTimeout(() => U.confetti(3000, 120), 1200);
    }, 450);
    this.lastPos = py.pos.slice();
  };

  P.hud = function (you) {
    return `${you.teamName ? `<span class="hchip">${esc(you.teamName)}</span>` : ''}<span class="hchip">🔺 ${you.score || 0}</span>`;
  };

  P.hostEnded = function (app, st) {
    if (!U.view(app, 'pyramid-end')) return;
    const r = st.results;
    this.lastPos = null;
    U.hostResults(app, st, {
      title: r.winner >= 0 ? `${esc(r.teams[r.winner].name)} כבשו את הפירמידה!` : 'תיקו בפירמידה!',
      sub: `הפירמידה האבודה · ${r.height} מדרגות`,
      body: `<div class="end-visual">${U.teamsMini(r.teams, r.pos, r.winner, 'team-final')}</div>`,
      table: U.table(r.players, [
        ['#', (p, i) => i + 1],
        ['שם', (p) => `<span class="nm">${U.avatar(p.name, r.teams[p.team] ? r.teams[p.team].color : null)}${esc(p.name)}</span>`],
        ['קבוצה', (p) => (r.teams[p.team] ? esc(r.teams[p.team].name) : '')],
        ['מדרגות', (p) => `🔺 ${p.score}`],
        ['נכונות', (p) => `✅ ${p.correct}`],
      ]),
    });
  };

  P.playerEnded = function (app, you) {
    const r = you.results;
    const mine = r.players.find((p) => p.name === you.name) || { score: 0, correct: 0 };
    const win = r.winner === you.team;
    return U.playerResult({
      win,
      title: r.winner < 0 ? 'תיקו!' : win ? 'הקבוצה שלכם כבשה את הפירמידה!' : 'כמעט! בפעם הבאה',
      extra: U.teamsMini(r.teams, r.pos, r.winner),
      lines: [`🔺 תרמתם ${mine.score} מדרגות`, `✅ ${mine.correct} תשובות נכונות`],
    });
  };

  Games.pyramid = P;
})();
