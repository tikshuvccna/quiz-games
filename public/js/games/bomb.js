// Client side of "הפצצה המתקתקת": players sit around a circle on the host and bombs hop between them.
(function () {
  const { esc } = U;

  // stable seat order (by name) so nobody jumps around when scores change
  const seatOf = (names, name) => names.indexOf(name);

  Games.bomb = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'bomb',
        cls: 'bombroom',
        stats: `<div class="stat" style="${U.pal('#ff4d6d')}"><span class="lbl">💣 פצצות בסיבוב</span><span class="val" id="nb">0</span></div><div class="stat" style="${U.pal('#8b5cf6')}"><span class="lbl">⭐ מוביל/ה</span><span class="val small" id="lead">—</span></div>`,
        stage: `<div class="bm-glow"></div><div class="bm-ring" id="ring"></div><div class="bm-center" id="center"></div><div class="bm-layer" id="blayer"></div>`,
      })) {
        this.seen = b.ev.length ? b.ev[b.ev.length - 1].id : 0;
        this.names = [];
        this.bombEls = new Map();
      }
      U.hostTick(st, `${b.total} שחקנים · כל אחד לעצמו`);
      U.countTo(document.getElementById('nb'), b.bombs.length);
      const lead = document.getElementById('lead');
      const leader = b.players[0] && b.players[0].pts > 0 ? b.players[0].name : '—';
      if (lead.textContent !== leader) { lead.textContent = leader; U.bump(lead); }

      // seats around an ellipse
      const ring = document.getElementById('ring');
      const names = b.players.map((p) => p.name).sort((x, y) => x.localeCompare(y, 'he'));
      if (names.join('|') !== this.names.join('|')) {
        this.names = names;
        ring.innerHTML = names.map((n, i) => {
          const a = (i / names.length) * Math.PI * 2 - Math.PI / 2;
          return `<div class="bm-seat" data-name="${esc(n)}" style="left:${50 + Math.cos(a) * 42}%;top:${50 + Math.sin(a) * 38}%">${U.avatar(n)}<b>${esc(n)}</b><span class="bm-pts">0</span></div>`;
        }).join('');
      }
      for (const p of b.players) {
        const seat = ring.querySelector(`[data-name="${CSS.escape(p.name)}"]`);
        if (!seat) continue;
        U.countTo(seat.querySelector('.bm-pts'), p.pts);
        seat.classList.toggle('hot', p.holding > 0);
      }
      document.getElementById('center').innerHTML = `<div class="bm-title">${Art.item('bomb')}</div><div class="bm-top">${b.players.slice().sort((x, y) => y.pts - x.pts).slice(0, 3).map((p, i) => `<div><span>${['🥇', '🥈', '🥉'][i]}</span>${esc(p.name)}<b>${p.pts}</b></div>`).join('')}</div>`;

      // bombs sit on their holder's seat and glide when thrown
      const layer = document.getElementById('blayer');
      const pos = (name) => {
        const seat = ring.querySelector(`[data-name="${CSS.escape(name)}"]`);
        return seat ? [seat.style.left, seat.style.top] : ['50%', '50%'];
      };
      const keep = new Set();
      for (const bm of b.bombs) {
        keep.add(bm.id);
        let el = this.bombEls.get(bm.id);
        if (!el) {
          el = document.createElement('div');
          el.className = 'bm-bomb';
          el.innerHTML = Art.item('bomb');
          layer.appendChild(el);
          this.bombEls.set(bm.id, el);
          const [x, y] = pos(bm.holder);
          el.style.left = x;
          el.style.top = y;
          U.bump(el, 'drop-in');
        }
        if (el.dataset.holder !== bm.holder) {
          const first = !el.dataset.holder;
          el.dataset.holder = bm.holder;
          const [x, y] = pos(bm.holder);
          el.style.left = x;
          el.style.top = y;
          if (!first) U.bump(el, 'toss');
        }
        el.style.setProperty('--heat', bm.heat.toFixed(2));
        el.classList.toggle('critical', bm.heat > 0.75);
      }
      for (const [id, el] of this.bombEls) if (!keep.has(id)) { el.remove(); this.bombEls.delete(id); }

      const stage = document.getElementById('stage');
      for (const e of b.ev) {
        if (e.id <= this.seen) continue;
        this.seen = e.id;
        if (e.k !== 'boom') continue;
        const seat = ring.querySelector(`[data-name="${CSS.escape(e.to)}"]`);
        if (!seat) continue;
        const r = seat.getBoundingClientRect();
        const s = stage.getBoundingClientRect();
        const x = r.left - s.left + r.width / 2;
        const y = r.top - s.top + r.height / 2;
        const boom = document.createElement('div');
        boom.className = 'bm-boom';
        boom.style.left = x + 'px';
        boom.style.top = y + 'px';
        stage.appendChild(boom);
        setTimeout(() => boom.remove(), 900);
        U.burst(stage, x, y, ['#ffd23f', '#ff7a1a', '#ff4d6d', '#fff'], 26, 160);
        U.floatText(stage, `-${e.loss}`, x, y - 50, 'bad');
        U.shake(stage, true);
        U.sfx('boom');
      }
    },

    hostEnded(app, st) {
      if (!U.view(app, 'bomb-end')) return;
      const r = st.results.players;
      U.hostResults(app, st, {
        title: r[0] ? `${esc(r[0].name)} שרד/ה הכי טוב!` : 'סוף המשחק',
        sub: 'הפצצה המתקתקת',
        body: `<div class="end-visual">${U.podium(r.slice(0, 3).map((p) => ({ name: p.name, value: p.pts, unit: 'נקודות' })))}</div>`,
        table: U.table(r, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
          ['נקודות', (p) => `⭐ ${p.pts}`],
          ['פיצוצים', (p) => `💥 ${p.booms}`],
          ['זריקות', (p) => p.passes],
        ]),
      });
    },

    // ---------- player ----------
    hud(you) {
      if (you.alert && you.alert !== this.lastAlert) {
        this.lastAlert = you.alert;
        setTimeout(() => this.toast(you.alert), 0);
      } else if (!you.alert) this.lastAlert = null;
      return `<span class="hchip">⭐ ${you.pts}</span>${you.holding ? `<span class="hchip bm-hot">💣 אצלכם!</span>` : `<span class="hchip">#${you.rank}</span>`}`;
    },

    toast(text) {
      const t = document.createElement('div');
      t.className = 'p-toast';
      t.textContent = text;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 2800);
      if (/בום/.test(text)) { U.sfx('boom'); if (navigator.vibrate) navigator.vibrate([80, 40, 120]); }
      else if (navigator.vibrate) navigator.vibrate([30, 30, 30]);
    },

    playerPhase(app, you, ctx) {
      if (you.phase === 'pass') {
        if (!ctx.setView('pass' + you.qid + ':' + you.turn)) return true;
        app.innerHTML = `${ctx.topBar()}
          <div class="timebar"><i style="animation-duration:7000ms"></i></div>
          <div class="bm-hold">${Art.item('bomb')}</div>
          <div class="phase-title">על מי זורקים את הפצצה?<small>מהר, לפני שהיא מתפוצצת!</small></div>
          <div class="bm-targets">${you.targets.map((t) => `<button class="bm-target" data-id="${t.id}">${U.avatar(t.name)}<b>${esc(t.name)}</b><span>⭐ ${t.pts}</span></button>`).join('')}</div>`;
        let done = false;
        app.querySelector('.bm-targets').onclick = (e) => {
          const b = e.target.closest('.bm-target');
          if (!b || done) return;
          done = true;
          b.classList.add('picked');
          app.querySelector('.bm-targets').classList.add('locked');
          U.bump(app.querySelector('.bm-hold'), 'toss-out');
          U.sfx('pop');
          if (navigator.vibrate) navigator.vibrate(20);
          ctx.act('pass', { to: b.dataset.id });
        };
        return true;
      }
      if (you.phase === 'passed') {
        if (!ctx.setView('passed' + you.qid + ':' + you.turn)) return true;
        app.innerHTML = `${ctx.topBar()}<div class="act-result">
          <div class="ar-art bm-fly">${Art.item('bomb')}</div>
          <div class="ar-title">זרקתם על ${esc(you.pass.to)}!</div>
          <div class="ar-big">+5</div><div class="ar-sub">הפצצה כבר לא אצלכם 😅</div></div>`;
        return true;
      }
      return false;
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results.players;
      const idx = r.findIndex((p) => p.name === you.name);
      const mine = r[idx] || { pts: 0, booms: 0, passes: 0 };
      return U.playerResult({
        win: idx === 0,
        title: idx === 0 ? 'שרדתם הכי טוב!' : idx < 3 ? 'על הפודיום!' : 'כל הכבוד!',
        big: `${mine.pts}`,
        bigLabel: 'נקודות',
        lines: [`🏅 מקום ${idx + 1} מתוך ${r.length}`, `💥 ${mine.booms} פיצוצים אצלכם`, `💣 ${mine.passes} זריקות`],
      });
    },
  };
})();
