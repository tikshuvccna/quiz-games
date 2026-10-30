// Client side of "קצב": on the phone four lanes with falling notes; the big screen shows who is playing and the scores.
(function () {
  const { esc } = U;
  const LANE_COLORS = ['#ff4d6d', '#ffd23f', '#2ee59d', '#22c7e8'];
  const SAY = { perfect: 'מושלם!', good: 'טוב!', ok: 'בסדר', miss: 'פספוס' };

  Art.covers.rhythm = () => `<rect width="160" height="100" fill="#251046"/>
    ${[0, 1, 2, 3].map((i) => `<rect x="${24 + i * 32}" y="0" width="26" height="100" fill="#fff" opacity=".07"/>`).join('')}
    ${[[0, 18], [1, 44], [2, 8], [3, 60], [1, 74], [2, 32]].map(([l, y]) => `<circle cx="${37 + l * 32}" cy="${y}" r="10" fill="${LANE_COLORS[l]}" stroke="#fff" stroke-width="2.5"/>`).join('')}
    <rect x="18" y="84" width="124" height="5" rx="2.5" fill="#fff" opacity=".8"/><text x="62" y="30" font-size="24">🥁</text>`;

  Games.rhythm = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'rhythm',
        cls: 'rhroom',
        stats: `<div class="stat" style="${U.pal('#8b5cf6')}"><span class="lbl">⭐ מוביל/ה</span><span class="val small" id="lead">—</span></div><div class="stat" style="${U.pal('#2ee59d')}"><span class="lbl">🥁 מנגנים עכשיו</span><span class="val" id="npl">0</span></div>`,
        stage: `<div class="rh-glow"></div><div class="rh-list" id="rhlist"></div>`,
      })) this.rows = new Map();
      U.hostTick(st, `${b.total} שחקנים · כל אחד לעצמו`);
      const lead = document.getElementById('lead');
      const leader = b.players[0] && b.players[0].pts > 0 ? b.players[0].name : '—';
      if (lead.textContent !== leader) { lead.textContent = leader; U.bump(lead); }
      U.countTo(document.getElementById('npl'), b.players.filter((p) => p.playing).length);
      const list = document.getElementById('rhlist');
      const max = Math.max(20, ...b.players.map((p) => p.pts));
      const names = new Set(b.players.map((p) => p.name));
      for (const [n, el] of this.rows) if (!names.has(n)) { el.remove(); this.rows.delete(n); }
      b.players.forEach((p, i) => {
        let el = this.rows.get(p.name);
        if (!el) {
          el = document.createElement('div');
          el.className = 'rh-row';
          el.innerHTML = `<span class="rh-rank"></span>${U.avatar(p.name)}<b>${esc(p.name)}</b><div class="rh-track"><i></i></div><span class="rh-pts">0</span><span class="rh-meta"></span>`;
          list.appendChild(el);
          this.rows.set(p.name, el);
          U.bump(el, 'drop-in');
        }
        el.style.order = i;
        el.querySelector('.rh-rank').textContent = i + 1;
        el.querySelector('.rh-track i').style.width = Math.max(2, (p.pts / max) * 100) + '%';
        U.countTo(el.querySelector('.rh-pts'), p.pts);
        el.querySelector('.rh-meta').textContent = p.songs ? `🎵 ${p.songs} · 🎯 ${p.acc}%${p.combo > 4 ? ` · 🔥 ${p.combo}` : ''}` : '';
        el.classList.toggle('playing', p.playing);
      });
    },

    hostEnded(app, st) {
      if (!U.view(app, 'rhythm-end')) return;
      const r = st.results.players;
      U.hostResults(app, st, {
        title: r[0] ? `${esc(r[0].name)} מלך/ת הקצב!` : 'סוף המשחק',
        sub: 'קצב',
        body: `<div class="end-visual">${U.podium(r.slice(0, 3).map((p) => ({ name: p.name, value: p.pts, unit: 'נקודות' })))}</div>`,
        table: U.table(r, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
          ['נקודות', (p) => `⭐ ${p.pts}`],
          ['שירים', (p) => `🎵 ${p.songs}`],
          ['דיוק', (p) => `🎯 ${p.acc}%`],
          ['קומבו שיא', (p) => `🔥 ${p.combo}`],
        ]),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">⭐ ${you.pts}</span><span class="hchip">#${you.rank}</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase === 'beat') {
        if (!ctx.setView('beat' + you.qid + ':' + you.turn)) return true;
        this.play(app, you, ctx);
        return true;
      }
      if (you.phase === 'beated') {
        if (!ctx.setView('beated' + you.qid + ':' + you.turn)) return true;
        const r = you.res;
        app.innerHTML = `${ctx.topBar()}<div class="act-result">
          <div class="ar-art">${r.full ? '🏆' : r.hits >= r.total / 2 ? '🥁' : '🎧'}</div>
          <div class="ar-title">${r.full ? 'שיר מושלם!' : `${r.hits} מתוך ${r.total} תווים`}</div>
          <div class="ar-big">+${r.pts}</div><div class="ar-sub">🔥 קומבו ${r.combo} · מושלם ${r.perfect} · טוב ${r.good}</div></div>`;
        if (r.full) U.burst(app, app.clientWidth / 2, 200, ['#fff', '#ffd23f', '#ff4fa3'], 24, 160);
        return true;
      }
      return false;
    },

    play(app, you, ctx) {
      const s = you.song;
      const FALL = s.fall;
      app.innerHTML = `${ctx.topBar()}
        <div class="rh-play">
          <div class="rh-judge" id="rhj"></div><div class="rh-combo" id="rhc"></div>
          <div class="rh-lanes" id="rhl">
            ${[0, 1, 2, 3].map((l) => `<div class="rh-lane" data-l="${l}" style="--c:${LANE_COLORS[l]}"></div>`).join('')}
            <div class="rh-line"></div>
          </div>
          <div class="rh-pads" id="rhp">${[0, 1, 2, 3].map((l) => `<button class="rh-pad" data-l="${l}" style="--c:${LANE_COLORS[l]}"></button>`).join('')}</div>
        </div>`;
      const lanes = [...app.querySelectorAll('.rh-lane')];
      s.notes.forEach((n) => {
        const el = document.createElement('i');
        el.className = 'rh-note';
        // starts above the lane, reaches the hit line exactly at n.t
        el.style.animation = `rh-fall ${FALL}ms linear ${n.t - FALL}ms both, rh-out 200ms linear ${n.t + 150}ms both`;
        lanes[n.lane].appendChild(el);
        n.el = el;
      });
      const t0 = performance.now();
      const taps = [];
      let combo = 0;
      let sent = false;
      const judge = app.querySelector('#rhj');
      const comboEl = app.querySelector('#rhc');
      const say = (kind, color) => {
        judge.textContent = SAY[kind];
        judge.style.color = color;
        judge.classList.remove('pop');
        void judge.offsetWidth;
        judge.classList.add('pop');
      };
      const tap = (l) => {
        if (sent) return;
        const t = performance.now() - t0;
        taps.push([l, Math.round(t)]);
        const pad = app.querySelector(`.rh-pad[data-l="${l}"]`);
        pad.classList.add('hit');
        setTimeout(() => pad.classList.remove('hit'), 90);
        // local feedback only: the server grades
        let best = null;
        for (const n of s.notes) if (n.lane === l && !n.done && (!best || Math.abs(n.t - t) < Math.abs(best.t - t))) best = n;
        const d = best ? Math.abs(best.t - t) : Infinity;
        if (d <= 200) {
          best.done = true;
          best.el.classList.add('gone');
          combo++;
          say(d <= 80 ? 'perfect' : d <= 140 ? 'good' : 'ok', d <= 80 ? '#ffd23f' : d <= 140 ? '#2ee59d' : '#fff');
          U.sfx('tick');
        } else {
          combo = 0;
          say('miss', '#ff6b8a');
        }
        comboEl.textContent = combo >= 3 ? `🔥 ${combo}` : '';
      };
      const pads = app.querySelector('#rhp');
      // pointerdown, not click: a click waits for the finger to lift
      pads.addEventListener('pointerdown', (e) => {
        const b = e.target.closest('.rh-pad');
        if (b) { e.preventDefault(); tap(Number(b.dataset.l)); }
      });
      // keyboard for a computer: D F J K
      const keys = { d: 0, f: 1, j: 2, k: 3 };
      const onKey = (e) => { if (e.key.toLowerCase() in keys && !e.repeat) tap(keys[e.key.toLowerCase()]); };
      document.addEventListener('keydown', onKey);
      const finish = () => {
        if (sent) return;
        sent = true;
        document.removeEventListener('keydown', onKey);
        ctx.act('taps', { taps });
      };
      setTimeout(finish, s.end + 400);
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results.players;
      const idx = r.findIndex((p) => p.name === you.name);
      const mine = r[idx] || { pts: 0, songs: 0, acc: 0, combo: 0 };
      return U.playerResult({
        win: idx === 0,
        title: idx === 0 ? 'מלכי הקצב!' : idx < 3 ? 'על הפודיום!' : 'כל הכבוד!',
        big: `${mine.pts}`,
        bigLabel: 'נקודות',
        lines: [`🏅 מקום ${idx + 1} מתוך ${r.length}`, `🎵 ${mine.songs} שירים · 🎯 ${mine.acc}% דיוק`, `🔥 קומבו שיא ${mine.combo}`],
      });
    },
  };
})();
