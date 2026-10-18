// Client side of "דייגים": a lake with everyone's boats on the host, hold-to-reel mini game on the phone.
(function () {
  const { esc } = U;
  const NAMES = { boot: 'נעל ישנה', small: 'דג קטן', medium: 'דג בינוני', big: 'דג גדול', gold: 'דג זהב', octo: 'תמנון ענק' };
  const SLOTS = 8;
  const REEL_MS = 12000;

  const boat = (name, color) => `<div class="fs-boat" style="--bc:${color}">
      <svg class="fs-rod-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M34 42 L80 12" class="rod"/><path d="M80 12 Q86 34 89.5 60" class="str"/></svg><div class="fs-bob">${Art.bobber()}</div>
      <div class="fs-who">${U.avatar(name, color)}</div>
      <div class="fs-hull"></div>
      <div class="fs-tag"><b class="fs-name">${esc(name)}</b><span class="fs-pts">0</span></div>
    </div>`;

  Games.fishing = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'fishing',
        cls: 'lake',
        stats: `<div class="stat" style="${U.pal('#22a6e8')}"><span class="lbl">🎣 הדייג/ת המוביל/ה</span><span class="val small" id="lead">—</span></div><div class="stat" style="${U.pal('#ff8a3d')}"><span class="lbl">נקודות</span><span class="val" id="top">0</span></div>`,
        stage: `<div class="fs-sky"><div class="sun"></div><div class="cloud c1"></div><div class="cloud c2"></div></div>
          <svg class="fs-shore" viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M0 120 V70 C120 40 240 60 360 50 C520 30 640 70 800 52 C960 34 1080 56 1200 44 V120Z" fill="#3f9b4a"/><path d="M0 120 V92 C200 80 420 96 640 86 C860 76 1040 92 1200 84 V120Z" fill="#2f7d3a"/></svg>
          <div class="fs-water"><div class="fs-ripples"></div><div class="fs-fishes"><i></i><i></i><i></i><i></i></div></div>
          <div class="fs-boats" id="boats"></div>`,
      })) {
        this.seen = b.ev.length ? b.ev[b.ev.length - 1].id : 0;
        this.slots = new Array(SLOTS).fill(null);
      }
      U.hostTick(st, `${b.total} דייגים · כל אחד לעצמו`);
      const leader = b.ranking[0] && b.ranking[0].total > 0 ? b.ranking[0].name : '—';
      const lead = document.getElementById('lead');
      if (lead.textContent !== leader) { lead.textContent = leader; U.bump(lead); }
      U.countTo(document.getElementById('top'), b.ranking[0] ? b.ranking[0].total : 0);

      // keep each player's boat in the same spot; free spots go to newcomers in the top 8
      const box = document.getElementById('boats');
      const names = new Set(b.ranking.map((r) => r.name));
      this.slots = this.slots.map((n) => (n && names.has(n) ? n : null));
      for (const r of b.ranking) {
        if (this.slots.includes(r.name)) continue;
        const free = this.slots.indexOf(null);
        if (free >= 0) this.slots[free] = r.name;
      }
      this.slots.forEach((name, i) => {
        let el = box.querySelector(`[data-slot="${i}"]`);
        if (!name) { if (el) el.remove(); return; }
        if (!el || el.dataset.name !== name) {
          if (el) el.remove();
          el = document.createElement('div');
          el.className = 'fs-spot';
          el.dataset.slot = i;
          el.dataset.name = name;
          el.style.setProperty('--x', (i % 4) * 23.5 + 2 + (Math.floor(i / 4) ? 5 : 0) + '%');
          el.style.setProperty('--y', Math.floor(i / 4) ? '58%' : '18%');
          el.style.setProperty('--d', (i * 0.37) % 2 + 's');
          el.innerHTML = boat(name, U.color(name));
          box.appendChild(el);
        }
        const r = b.ranking.find((x) => x.name === name);
        const rank = b.ranking.indexOf(r);
        U.countTo(el.querySelector('.fs-pts'), r.total);
        el.classList.toggle('first', rank === 0 && r.total > 0);
      });
      for (const e of b.ev) {
        if (e.id <= this.seen) continue;
        this.seen = e.id;
        const spot = box.querySelector(`[data-name="${CSS.escape(e.name)}"]`);
        if (!spot) continue;
        const f = document.createElement('div');
        f.className = 'fs-jump';
        f.innerHTML = Art.fish(e.k);
        spot.appendChild(f);
        setTimeout(() => f.remove(), 1500);
        const r = spot.getBoundingClientRect();
        const s = box.getBoundingClientRect();
        U.floatText(box, `+${e.v}`, r.left - s.left + r.width / 2, r.top - s.top - 10, e.v >= 25 ? 'gold' : 'good');
        U.burst(box, r.left - s.left + r.width / 2, r.top - s.top + r.height * 0.55, ['#bfefff', '#fff', '#7cc8f5'], 10, 60);
        U.bump(spot.querySelector('.fs-bob'), 'dunk');
      }
    },

    hostEnded(app, st) {
      if (!U.view(app, 'fishing-end')) return;
      const r = st.results.players;
      U.hostResults(app, st, {
        title: r[0] ? `${esc(r[0].name)} הדייג/ת הגדול/ה!` : 'סוף המשחק',
        sub: 'דייגים',
        body: `<div class="end-visual">${U.podium(r.slice(0, 3).map((p) => ({ name: p.name, value: p.total, unit: 'נקודות' })))}</div>`,
        table: U.table(r, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
          ['נקודות', (p) => p.total],
          ['דגים', (p) => `🐟 ${p.count}`],
          ['השלל הכי טוב', (p) => (p.best ? NAMES[p.best] : '—')],
        ]),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">🐟 ${you.total}</span><span class="hchip">#${you.rank}</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase === 'reel') {
        if (!ctx.setView('reel' + you.qid + ':' + you.turn)) return true;
        this.reel(app, you, ctx);
        return true;
      }
      if (you.phase === 'landed') {
        if (!ctx.setView('landed' + you.qid + ':' + you.turn)) return true;
        const r = you.result;
        if (r.ok) U.sfx(r.v >= 25 ? 'win' : 'coin');
        else U.sfx('bad');
        app.innerHTML = `${ctx.topBar()}<div class="act-result fs-result ${r.ok ? '' : 'lost'}">
          <div class="fs-catch">${Art.fish(r.k)}</div>
          <div class="ar-big ${r.ok ? '' : 'neg'}">${r.ok ? '+' + r.v : '0'}</div>
          <div class="ar-title">${r.ok ? `תפסתם ${NAMES[r.k]}!` : `ה${NAMES[r.k]} ברח…`}</div>
          <div class="pill">🐟 ${you.total} נקודות · מקום ${you.rank}</div></div>`;
        if (r.ok) {
          const s = app.querySelector('.fs-result');
          const rc = s.getBoundingClientRect();
          U.burst(s, rc.width / 2, rc.height * 0.3, ['#bfefff', '#ffd23f', '#fff'], 16, 120);
        }
        return true;
      }
      return false;
    },

    reel(app, you, ctx) {
      const f = you.fish;
      const zoneSize = Math.max(0.17, 0.3 - f.speed * 0.07);
      app.innerHTML = `${ctx.topBar()}
        <div class="phase-title">החזיקו כדי לגלגל!<small>שמרו את הדג בתוך האזור הירוק</small></div>
        <div class="p-stage fs-reel" id="reel">
          <div class="fs-col" id="col">
            <div class="fs-zone" id="zone" style="height:${zoneSize * 100}%"></div>
            <div class="fs-mark" id="mark">${Art.fish(f.k)}</div>
          </div>
          <div class="fs-prog"><i id="prog"></i></div>
          <div class="fs-rod"><div class="fs-reelwheel" id="wheel"></div></div>
        </div>
        <button class="btn big blue" id="hold">החזיקו ⟳</button>`;
      const zone = document.getElementById('zone');
      const mark = document.getElementById('mark');
      const prog = document.getElementById('prog');
      const wheel = document.getElementById('wheel');
      const btn = document.getElementById('hold');
      const col = document.getElementById('col');
      let holding = false;
      let zy = 0.15; // bottom of the zone, 0..1-zoneSize
      let zv = 0;
      let fy = 0.5; // fish position 0..1
      let target = 0.5;
      let progress = 0.3;
      let last = performance.now();
      const t0 = last;
      let retarget = 0;
      let done = false;
      let spin = 0;
      const down = (e) => { e.preventDefault(); holding = true; btn.classList.add('on'); };
      const up = () => { holding = false; btn.classList.remove('on'); };
      btn.addEventListener('pointerdown', down);
      col.addEventListener('pointerdown', down);
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => { btn.addEventListener(ev, up); col.addEventListener(ev, up); });
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
      const finish = (ok) => {
        if (done) return;
        done = true;
        ctx.act('reel', { ok });
      };
      const loop = (now) => {
        if (done || !document.body.contains(col)) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        // fish wanders: picks a new spot every so often, faster fish move further and quicker
        retarget -= dt;
        if (retarget <= 0) {
          target = Math.max(0.05, Math.min(0.95, fy + (Math.random() - 0.5) * (0.5 + f.speed * 0.4)));
          retarget = 0.5 + Math.random() * (1.4 - f.speed * 0.5);
        }
        fy += (target - fy) * Math.min(1, dt * (1.5 + f.speed * 2.2));
        // the catch zone: holding lifts it, letting go lets it sink
        zv += (holding ? 2.6 : -2.2) * dt;
        zv *= 0.92;
        zy = Math.max(0, Math.min(1 - zoneSize, zy + zv * dt * 2.4));
        if (zy === 0 || zy === 1 - zoneSize) zv *= -0.3;
        const inside = fy >= zy && fy <= zy + zoneSize;
        progress += (inside ? 0.32 : -0.22) * dt;
        progress = Math.max(0, Math.min(1, progress));
        zone.style.bottom = zy * 100 + '%';
        zone.classList.toggle('on', inside);
        mark.style.bottom = `calc(${fy * 100}% - 18px)`;
        prog.style.height = progress * 100 + '%';
        prog.classList.toggle('hot', progress > 0.75);
        if (holding) spin += dt * 900;
        wheel.style.transform = `rotate(${spin}deg)`;
        if (progress >= 1) return finish(true);
        if (progress <= 0 || now - t0 > REEL_MS) return finish(false);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results.players;
      const idx = r.findIndex((p) => p.name === you.name);
      const mine = r[idx] || { total: 0, count: 0, best: null };
      return U.playerResult({
        win: idx === 0,
        title: idx === 0 ? 'הדייג/ת הגדול/ה!' : idx < 3 ? 'על הפודיום!' : 'כל הכבוד!',
        big: `${mine.total}`,
        bigLabel: 'נקודות',
        extra: mine.best ? `<div class="pres-fish">${Art.fish(mine.best)}</div>` : '',
        lines: [`🏅 מקום ${idx + 1} מתוך ${r.length}`, `🐟 ${mine.count} דגים`, mine.best ? `⭐ השלל הכי טוב: ${NAMES[mine.best]}` : ''].filter(Boolean),
      });
    },
  };
})();
