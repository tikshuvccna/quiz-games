// Client side of "מירוץ הקארטים": side-view race track on the host, top-down dodge lanes on the phone.
(function () {
  const { esc } = U;

  Games.race = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'race',
        cls: 'track',
        stats: `<div class="stat" style="${U.pal('#ff8a3d')}"><span class="lbl">🏁 במקום הראשון</span><span class="val small" id="lead">—</span></div><div class="stat" style="${U.pal('#2f80ff')}"><span class="lbl">הקפות</span><span class="val" id="laps">0</span></div>`,
        stage: `<div class="track-sky"><svg class="track-hills" viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M0 80 C120 30 260 40 360 70 C480 20 640 30 760 66 C880 26 1040 30 1200 60 V120 H0Z" fill="#6cc95c"/><path d="M0 100 C200 70 400 80 600 96 C800 70 1000 76 1200 92 V120 H0Z" fill="#4fae47"/></svg><div class="stands"></div></div>
          <div class="lanes-host" id="lb"></div>`,
      })) this.prev = new Map();
      U.hostTick(st, `${b.total} נהגים · כל אחד לעצמו`);
      const leader = b.ranking[0] && b.ranking[0].dist > 0 ? b.ranking[0].name : '—';
      const lead = document.getElementById('lead');
      if (lead.textContent !== leader) { lead.textContent = leader; U.bump(lead); }
      U.countTo(document.getElementById('laps'), b.ranking[0] ? b.ranking[0].lap : 0);
      const lb = document.getElementById('lb');
      const n = Math.max(b.ranking.length, 5);
      lb.style.setProperty('--n', n);
      const keep = new Set();
      b.ranking.forEach((r, i) => {
        keep.add(r.name);
        let row = lb.querySelector(`[data-name="${CSS.escape(r.name)}"]`);
        if (!row) {
          row = document.createElement('div');
          row.className = 'lane-h';
          row.dataset.name = r.name;
          row.innerHTML = `<div class="lane-rank"></div><div class="road-h"><div class="finish"></div><div class="kart-h"><div class="kart-tag">${esc(r.name)}</div><div class="kart-body">${Art.kart(U.color(r.name))}</div><div class="smoke"></div></div></div><div class="lap-b"></div>`;
          lb.appendChild(row);
        }
        row.style.setProperty('--r', i);
        row.querySelector('.lane-rank').textContent = i + 1;
        row.classList.toggle('first', i === 0 && r.dist > 0);
        const k = row.querySelector('.kart-h');
        k.style.left = `calc(${Math.min(100, r.pos)} * (100% - var(--kw)) / 100)`;
        const before = this.prev.get(r.name);
        if (before !== undefined && r.dist !== before) {
          U.bump(k, r.dist > before ? 'zoom' : 'spin');
          if (Math.floor(r.dist / b.lapLen) > Math.floor(before / b.lapLen)) {
            const rr = row.getBoundingClientRect();
            const sr = lb.getBoundingClientRect();
            U.burst(lb, rr.right - sr.left - 60, rr.top - sr.top + rr.height / 2, ['#fff', '#ffd23f', '#1e1145'], 16, 80);
          }
        }
        this.prev.set(r.name, r.dist);
        row.querySelector('.lap-b').innerHTML = `<small>הקפה</small>${r.lap + 1}`;
      });
      [...lb.children].forEach((c) => { if (!keep.has(c.dataset.name)) c.remove(); });
    },

    hostEnded(app, st) {
      if (!U.view(app, 'race-end')) return;
      const r = st.results.players;
      U.hostResults(app, st, {
        title: r[0] ? `${esc(r[0].name)} ניצח/ה במירוץ!` : 'סוף המירוץ',
        sub: 'מירוץ הקארטים',
        body: `<div class="end-visual">${U.podium(r.slice(0, 3).map((p) => ({ name: p.name, value: p.dist, unit: `מרחק · ${p.lap} הקפות` })))}</div>`,
        table: U.table(r, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
          ['מרחק', (p) => p.dist],
          ['הקפות', (p) => p.lap],
          ['נכונות', (p) => p.correct],
          ['רצף שיא', (p) => `🔥 ${p.best}`],
        ]),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">🏎️ ${you.dist}</span><span class="hchip">#${you.rank}</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase === 'dodge') {
        if (!ctx.setView('dodge' + you.qid + ':' + you.turn)) return true;
        const { safe, ms } = you.dodge;
        const color = U.color(you.name);
        const obstacles = [0, 1, 2].map((l) => (l === safe ? `<div class="boost">⏩</div>` : l % 2 ? Art.barrier() : Art.cone()));
        app.innerHTML = `${ctx.topBar()}
          <div class="timebar"><i style="animation-duration:${ms}ms"></i></div>
          <div class="phase-title">היזהרו! בחרו את הנתיב הפנוי<small>נתיב פנוי = +5 · התנגשות = -2</small></div>
          <div class="road-top" id="road">
            <div class="road-lines"></div>
            ${[0, 1, 2].map((l) => `<button class="lane-btn ${l === safe ? 'safe' : 'blocked'}" data-l="${l}"><span class="obstacle">${obstacles[l]}</span></button>`).join('')}
            <div class="me-kart" id="me" style="--lane:1">${Art.kartTop(color)}</div>
          </div>`;
        let done = false;
        const me = document.getElementById('me');
        const go = (lane) => {
          if (done) return;
          done = true;
          if (lane >= 0) {
            me.style.setProperty('--lane', lane);
            me.classList.add(lane === safe ? 'boosting' : 'crash');
            U.sfx(lane === safe ? 'good' : 'boom');
            if (lane !== safe) U.shake(document.getElementById('road'));
          }
          setTimeout(() => ctx.act('dodge', { lane }), lane >= 0 ? 350 : 0);
        };
        app.querySelector('.road-top').onpointerdown = (e) => {
          const b = e.target.closest('.lane-btn');
          if (b) { e.preventDefault(); go(Number(b.dataset.l)); }
        };
        setTimeout(() => go(-1), ms);
        return true;
      }
      if (you.phase === 'raced') {
        if (!ctx.setView('raced' + you.qid + ':' + you.turn)) return true;
        const r = you.raced;
        app.innerHTML = `${ctx.topBar()}<div class="act-result">
          <div class="ar-art kart-res ${r.ok ? 'ok' : 'bad'}">${Art.kart(U.color(you.name))}</div>
          <div class="ar-big ${r.ok ? '' : 'neg'}">${r.ok ? '+5' : '-2'}</div>
          <div class="ar-title">${r.ok ? 'עקיפה מושלמת!' : 'התנגשות!'}</div>
          <div class="pill">מקום ${you.rank} · הקפה ${you.lap}</div></div>`;
        return true;
      }
      return false;
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results.players;
      const idx = r.findIndex((p) => p.name === you.name);
      const mine = r[idx] || { dist: 0, lap: 0, correct: 0, best: 0 };
      return U.playerResult({
        win: idx === 0,
        title: idx === 0 ? 'ניצחתם במירוץ!' : idx < 3 ? 'על הפודיום!' : 'סיימתם את המירוץ!',
        big: `${mine.lap} 🏁`,
        bigLabel: 'הקפות שלמות',
        lines: [`🏅 מקום ${idx + 1} מתוך ${r.length}`, `🏎️ מרחק ${mine.dist}`, `✅ ${mine.correct} תשובות נכונות`],
      });
    },
  };
})();
