// Client side of "מרוץ גולות": the board of marbles while playing, then an animated race decided by the server.
(function () {
  const { esc } = U;
  const COLORS = ['#ff4d6d', '#ffd23f', '#2ee59d', '#22c7e8', '#8b5cf6', '#ff8a3d', '#ff4fa3', '#7dffc4'];

  const G = FfaBoard.make({
    id: 'marble',
    emoji: '🔮',
    cls: 'mb-room',
    cover: () => `<rect width="160" height="100" fill="#2a1f6e"/><path d="M0 70 Q40 40 80 62 T160 50 V100 H0Z" fill="#4a3aa8"/>
      ${[[40, 56, '#ff4d6d'], [70, 66, '#ffd23f'], [102, 54, '#2ee59d'], [128, 64, '#22c7e8'], [86, 38, '#8b5cf6']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="11" fill="${c}" stroke="#fff" stroke-width="2.5"/><circle cx="${x - 3}" cy="${y - 4}" r="3" fill="#fff" opacity=".7"/>`).join('')}`,
    play() {},
  });

  // the stats on the host ranking say "marbles", not rounds
  const hp = G.hostPlaying;
  G.hostPlaying = function (app, st) {
    hp.call(this, app, st);
    document.querySelectorAll('.fb-meta').forEach((m, i) => { const p = st.board.players[i]; if (m && p) m.textContent = `🔮 ${p.pts} · ✔ ${p.rounds}`; });
  };

  G.hud = (you) => `<span class="hchip">🔮 ${you.marbles}</span><span class="hchip">#${you.rank}</span>`;

  // the race plays once per round, then the usual results screen (podium by the race, table, rematch)
  const podium = (app, s0) => {
    const res = s0.results;
    if (!U.view(app, 'marble-pod' + s0.round)) return;
    const w = res.race[0];
    U.hostResults(app, s0, {
      title: `${esc(w.name)} ניצח/ה במרוץ!`,
      sub: `מרוץ גולות · עם ${w.marbles} גולות`,
      body: `<div class="end-visual">${U.podium(res.race.slice(0, 3).map((r) => ({ name: r.name, value: r.marbles, unit: 'גולות' })))}</div>`,
      table: U.table(res.players.slice().sort((x, y) => x.place - y.place), [
        ['מקום', (p) => p.place],
        ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
        ['גולות', (p) => `🔮 ${p.pts}`],
        ['תשובות נכונות', (p) => p.rounds],
        ['דיוק', (p) => `🎯 ${p.acc}%`],
      ]),
    });
  };

  G.hostEnded = function (app, s0) {
    const key = 'r' + s0.round;
    if (this.raceDone === key) return podium(app, typeof st !== 'undefined' && st ? st : s0);
    if (this.raceStarted === key) return;
    this.raceStarted = key;
    U.view(app, 'marble-race' + key);
    const race = s0.results.race.slice(0, 24);
    app.className = 'screen host-game';
    app.innerHTML = `<div class="mb-end"><h1>🔮 מרוץ הגולות!</h1><div class="mb-track">${race.map((r, i) => `<div class="mb-lane"><span class="mb-nm">${esc(r.name)}</span><div class="mb-rail"><i class="mb-ball" style="--c:${COLORS[i % COLORS.length]}"></i></div><span class="mb-n">${r.marbles} 🔮</span></div>`).join('')}</div></div>`;
    // race[] is in finishing order: each ball travels in a few jittery legs, and the winner arrives first
    const DUR = 7000;
    const n = race.length;
    [...app.querySelectorAll('.mb-ball')].forEach((ball, i) => {
      const t = DUR * 0.72 + (n > 1 ? (i / (n - 1)) * DUR * 0.28 : 0);
      const legs = 5;
      let k = 0;
      const go = () => {
        k++;
        ball.style.transition = `left ${t / legs}ms ${k === legs ? 'ease-out' : 'ease-in-out'}`;
        ball.style.left = (k === legs ? 100 : Math.max(4, (k / legs) * 88 + (Math.random() - 0.5) * 10)) + '%';
        if (k < legs) setTimeout(go, t / legs);
      };
      setTimeout(go, 400 + Math.random() * 300);
    });
    U.sfx('boom');
    setTimeout(() => { this.raceDone = key; U.sfx('good'); podium(app, typeof st !== 'undefined' && st ? st : s0); }, DUR + 1800);
  };

  G.playerEnded = function (app, you) {
    const r = you.results.players;
    const mine = r.find((p) => p.name === you.name) || { pts: 0, place: r.length };
    const won = mine.place === 1;
    return U.playerResult({
      win: won,
      title: won ? 'ניצחתם במרוץ!' : mine.place <= 3 ? 'על הפודיום!' : 'כל הכבוד!',
      big: `${mine.place}`,
      bigLabel: 'מקום במרוץ',
      lines: [`🔮 ${mine.pts} גולות`, `✔ ${mine.rounds} תשובות נכונות`, `🏆 המנצח/ת: ${esc(you.results.race[0].name)}`],
    });
  };
})();
