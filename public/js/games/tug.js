// Client side of "מלחמת חבל": a field scene with two teams of little pullers.
(function () {
  const { esc } = U;
  const MAX_SHOWN = 5;

  const crew = (team, n, color) =>
    Array.from({ length: Math.min(MAX_SHOWN, Math.max(1, n)) }, (_, i) => `<div class="puller-wrap" style="--i:${i}">${Art.puller(color, team)}</div>`).join('');

  const teamBadge = (i, team) => `<div class="tscore" id="t${i}" style="${U.pal(team.color)}">${Art.mascot(i)}<div class="tcol"><span class="tn">${esc(team.name)}</span><span class="ts" id="ts${i}">0</span><span class="tsub" id="tsub${i}"></span></div></div>`;

  Games.tug = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'tug',
        cls: 'field',
        stats: `${teamBadge(1, b.teams[1])}<div class="vs">VS</div>${teamBadge(0, b.teams[0])}`,
        stage: `
          <div class="sky"><div class="sun"></div><div class="cloud c1"></div><div class="cloud c2"></div><div class="cloud c3"></div></div>
          <svg class="hills" viewBox="0 0 1200 200" preserveAspectRatio="none"><path d="M0 120 C150 40 300 60 420 110 C560 30 760 40 880 100 C980 50 1100 60 1200 90 V200 H0Z" fill="#7fd36b"/><path d="M0 160 C200 110 380 120 600 150 C800 110 1000 120 1200 140 V200 H0Z" fill="#5fbf55"/></svg>
          <div class="ground"></div>
          <div class="goal g0" style="--tc:${b.teams[0].color}"><div class="goal-flag">${Art.flag(b.teams[0].color)}</div></div>
          <div class="goal g1" style="--tc:${b.teams[1].color}"><div class="goal-flag">${Art.flag(b.teams[1].color)}</div></div>
          <div class="pit"></div>
          <div class="tugline" id="line">
            <div class="rope"></div>
            <div class="marker"><div class="ribbon"></div></div>
            <div class="crew c0" id="c0">${crew(0, b.size[0], b.teams[0].color)}</div>
            <div class="crew c1" id="c1">${crew(1, b.size[1], b.teams[1].color)}</div>
          </div>
          <div class="tug-meter"><i id="tm"></i><b></b></div>`,
      })) {
        this.seen = b.ev.length ? b.ev[b.ev.length - 1].id : 0;
        this.stage = document.getElementById('stage');
      }
      [0, 1].forEach((i) => {
        U.countTo(document.getElementById('ts' + i), b.power[i]);
        document.getElementById('tsub' + i).textContent = `${b.size[i]} שחקנים · ${b.pulling[i] ? `${b.pulling[i]} מושכים עכשיו!` : 'כוח משיכה'}`;
        document.getElementById('c' + i).classList.toggle('busy', b.pulling[i] > 0);
      });
      U.hostTick(st, `${st.players.length} שחקנים · קבוצה נגד קבוצה`);
      // pos -100..100 → the whole rope slides left (team 0) or right (team 1)
      const shift = (b.pos / 100) * 34; // % of stage width
      document.getElementById('line').style.transform = `translateX(${shift}%)`;
      document.getElementById('tm').style.left = 50 + b.pos / 2 + '%';
      document.getElementById('t0').classList.toggle('lead', b.pos < -2);
      document.getElementById('t1').classList.toggle('lead', b.pos > 2);
      for (const e of b.ev) {
        if (e.id <= this.seen) continue;
        this.seen = e.id;
        const c = document.getElementById('c' + e.team);
        U.bump(c, 'heave');
        const r = c.getBoundingClientRect();
        const s = this.stage.getBoundingClientRect();
        const x = r.left - s.left + r.width / 2;
        const y = r.top - s.top;
        U.floatText(this.stage, `+${e.power} ${e.name}`, x, y, e.power >= 15 ? 'gold' : '');
        U.burst(this.stage, x, r.bottom - s.top, ['#c99a5a', '#e8c88e', '#fff'], 8, 50);
        if (e.power >= 15) U.shake(this.stage);
      }
    },

    hostEnded(app, st) {
      if (!U.view(app, 'tug-end')) return;
      const r = st.results;
      U.hostResults(app, st, {
        title: r.winner < 0 ? 'תיקו!' : `${esc(r.teams[r.winner].name)} ניצחו!`,
        sub: 'כוח משיכה כולל',
        body: `<div class="end-visual tug-end">${U.teamsMini(r.teams, r.power, r.winner, 'team-final')}</div>`,
        table: U.table(r.players, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name, r.teams[p.team].color)}${esc(p.name)}</span>`],
          ['כוח', (p) => p.total],
          ['משיכות', (p) => p.pulls],
          ['נכונות', (p) => p.correct],
        ], 10),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">💪 ${you.pulls}</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase === 'pull') {
        if (!ctx.setView('pull' + you.pulls)) return true;
        const ms = you.pullMs;
        const color = ctx.teamColor();
        app.innerHTML = `${ctx.topBar()}
          <div class="timebar"><i style="animation-duration:${ms}ms"></i></div>
          <div class="phase-title">לחצו הכי מהר שאפשר!<small>כל לחיצה = עוד כוח משיכה לקבוצה</small></div>
          <div class="tap-zone" id="zone">
            <button class="tapbtn" id="tap" style="${U.pal(color)}">
              <span class="tap-art">${Art.puller('#fff', you.team)}</span>
              <span class="tap-cnt" id="cnt">0</span>
              <span class="tap-lbl">משכו!</span>
            </button>
          </div>`;
        let taps = 0;
        let over = false;
        const btn = document.getElementById('tap');
        const zone = document.getElementById('zone');
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (over) return;
          taps++;
          document.getElementById('cnt').textContent = taps;
          U.bump(btn, 'tapped');
          const zr = zone.getBoundingClientRect();
          U.burst(zone, e.clientX - zr.left, e.clientY - zr.top, ['#fff', '#ffd23f', color], 5, 60);
          if (taps % 5 === 0) U.sfx('tick');
          if (navigator.vibrate) navigator.vibrate(8);
        });
        btn.addEventListener('contextmenu', (e) => e.preventDefault());
        setTimeout(() => {
          over = true;
          btn.disabled = true;
          ctx.act('pull', { taps });
        }, ms);
        return true;
      }
      if (you.phase === 'pulled') {
        if (!ctx.setView('pulled' + you.pulls)) return true;
        U.sfx('good');
        app.innerHTML = `${ctx.topBar()}<div class="act-result">
          <div class="ar-art">${Art.puller(ctx.teamColor(), you.team)}</div>
          <div class="ar-big">+${you.pulled}</div><div class="ar-title">כוח משיכה!</div>
          <div class="ar-sub">${you.pulled >= 15 ? 'משיכה אדירה! 💥' : 'עוד תשובה נכונה = עוד משיכה'}</div></div>`;
        return true;
      }
      return false;
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results;
      const mine = r.players.find((p) => p.name === you.name) || { total: 0, pulls: 0, correct: 0 };
      const win = r.winner === you.team;
      return U.playerResult({
        win,
        title: r.winner < 0 ? 'תיקו!' : win ? 'הקבוצה שלכם ניצחה!' : 'כמעט! בפעם הבאה',
        extra: U.teamsMini(r.teams, r.power, r.winner),
        lines: [`💪 כוח משיכה ${mine.total}`, `🪢 ${mine.pulls} משיכות`, `✅ ${mine.correct} תשובות נכונות`],
      });
    },
  };
})();
