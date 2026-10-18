// Client side of "מרדף היהלומים": treasure cave leaderboard + catch arena on the phone.
(function () {
  const { esc } = U;
  const TIER_NAMES = ['תיבת עץ', 'תיבת ברזל', 'תיבת כסף', 'תיבת זהב', 'אוצר המלך'];
  const VALUE = { coin: 1, gem: 3, crown: 10, rock: -2, bomb: -5 };
  const FALL_MS = 2300;

  // absolutely positioned rows that glide to their new rank
  function racers(box, ranking, build, update) {
    const keep = new Set();
    const n = Math.max(ranking.length, 6);
    box.style.setProperty('--n', n);
    ranking.forEach((r, i) => {
      keep.add(r.name);
      let row = box.querySelector(`[data-name="${CSS.escape(r.name)}"]`);
      if (!row) {
        row = document.createElement('div');
        row.className = 'rrow';
        row.dataset.name = r.name;
        row.innerHTML = build(r);
        box.appendChild(row);
      }
      row.style.setProperty('--r', i);
      row.classList.toggle('first', i === 0);
      update(row, r, i);
    });
    [...box.children].forEach((c) => { if (!keep.has(c.dataset.name)) c.remove(); });
  }

  Games.gems = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'gems',
        cls: 'cave',
        stats: `<div class="stat" style="${U.pal('#2f80ff')}"><span class="lbl">💎 בקופה המשותפת</span><span class="val" id="sum">0</span></div><div class="stat" style="${U.pal('#8b5cf6')}"><span class="lbl">מוביל/ה</span><span class="val small" id="lead">—</span></div>`,
        stage: `<div class="crystals"></div>
          <div class="gems-layout">
            <div class="tiers">${[4, 3, 2, 1, 0].map((t) => `<div class="tier" data-t="${t}"><div class="tier-art">${Art.chest(t)}</div><div><b>${TIER_NAMES[t]}</b><small>${b.tiers[t]}+ 💎</small></div></div>`).join('')}</div>
            <div class="racers" id="lb"></div>
          </div>`,
      })) this.prev = new Map();
      const sum = b.ranking.reduce((s, r) => s + r.gems, 0);
      U.countTo(document.getElementById('sum'), sum);
      const lead = document.getElementById('lead');
      const leader = b.ranking[0] && b.ranking[0].gems > 0 ? b.ranking[0].name : '—';
      if (lead.textContent !== leader) { lead.textContent = leader; U.bump(lead); }
      U.hostTick(st, `${b.total} ציידי אוצרות · כל אחד לעצמו`);
      const max = Math.max(20, ...b.ranking.map((r) => r.gems));
      const lb = document.getElementById('lb');
      racers(lb, b.ranking,
        (r) => `<span class="rk"></span>${U.avatar(r.name)}<span class="rn">${esc(r.name)}</span><span class="rbar"><i></i><b></b></span><span class="rchest"></span>`,
        (row, r, i) => {
          row.querySelector('.rk').textContent = i + 1;
          row.querySelector('.rbar i').style.width = Math.max(4, (r.gems / max) * 100) + '%';
          const num = row.querySelector('.rbar b');
          const before = this.prev.get(r.name);
          U.countTo(num, r.gems);
          if (before !== undefined && r.gems > before) {
            const rr = row.getBoundingClientRect();
            const sr = lb.getBoundingClientRect();
            U.floatText(lb, `+${r.gems - before}`, rr.left - sr.left + 120, rr.top - sr.top + rr.height / 2, 'gold');
          }
          this.prev.set(r.name, r.gems);
          const ch = row.querySelector('.rchest');
          if (ch.dataset.t !== String(r.tier)) {
            if (ch.dataset.t !== undefined) U.bump(ch, 'bump');
            ch.dataset.t = r.tier;
            ch.innerHTML = Art.chest(r.tier);
          }
        });
    },

    hostEnded(app, st) {
      if (!U.view(app, 'gems-end')) return;
      const r = st.results.players;
      U.hostResults(app, st, {
        title: r[0] ? `${esc(r[0].name)} אספ/ה הכי הרבה!` : 'סוף המשחק',
        sub: 'מרדף היהלומים',
        body: `<div class="end-visual">${U.podium(r.slice(0, 3).map((p) => ({ name: p.name, value: p.gems, unit: '💎 יהלומים' })))}</div>`,
        table: U.table(r, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
          ['יהלומים', (p) => `💎 ${p.gems}`],
          ['אוצר', (p) => TIER_NAMES[p.tier]],
          ['נכונות', (p) => p.correct],
          ['רצף שיא', (p) => `🔥 ${p.best}`],
        ]),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">💎 ${you.gems}</span><span class="hchip">#${you.rank}</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase === 'catch') {
        if (!ctx.setView('catch' + you.catch.id)) return true;
        this.startCatch(app, you, ctx);
        return true;
      }
      if (you.phase === 'collected') {
        if (!ctx.setView('collected' + you.gems + ':' + you.stats.correct)) return true;
        const c = you.collected;
        U.sfx(c.gain > 0 ? 'win' : 'bad');
        app.innerHTML = `${ctx.topBar()}<div class="act-result">
          <div class="ar-art chest-art">${Art.chest(you.tier)}</div>
          <div class="ar-big ${c.gain < 0 ? 'neg' : ''}">${c.gain >= 0 ? '+' : ''}${c.gain}</div>
          <div class="ar-title">${c.gain > 0 ? 'אוצר נאסף!' : 'אאוץ׳…'}</div>
          <div class="ar-sub">${c.n} פריטים נתפסו${c.mult > 1 ? ' · ×2 בונוס רצף!' : ''}</div>
          <div class="pill">${TIER_NAMES[you.tier]} · מקום ${you.rank}</div></div>`;
        return true;
      }
      return false;
    },

    startCatch(app, you, ctx) {
      const c = you.catch;
      app.innerHTML = `${ctx.topBar()}
        <div class="timebar"><i style="animation-duration:${c.ms}ms"></i></div>
        <div class="catch-hint"><span>תפסו</span>${Art.item('coin')}${Art.item('gem')}${Art.item('crown')}<span>· היזהרו</span>${Art.item('rock')}${Art.item('bomb')}${c.mult > 1 ? '<b>×2!</b>' : ''}</div>
        <div class="arena" id="arena"><div class="arena-score" id="ascore">0</div><div class="arena-chest" id="achest">${Art.chest(you.tier)}</div></div>`;
      const arena = document.getElementById('arena');
      const h = arena.clientHeight || 420;
      const caught = [];
      let score = 0;
      let finished = false;
      for (const it of c.items) {
        const d = document.createElement('div');
        d.className = 'drop ' + it.k;
        d.innerHTML = Art.item(it.k);
        d.dataset.id = it.id;
        d.style.left = `calc(${it.x}% - 34px)`;
        d.style.setProperty('--d', it.t + 'ms');
        d.style.setProperty('--ah', h + 90 + 'px');
        d.style.setProperty('--rot', (Math.random() * 60 - 30).toFixed(0) + 'deg');
        d.addEventListener('animationend', () => d.classList.add('gone'));
        arena.appendChild(d);
      }
      arena.addEventListener('pointerdown', (e) => {
        const d = e.target.closest('.drop');
        if (!d || d.classList.contains('got') || d.classList.contains('gone') || finished) return;
        const ar = arena.getBoundingClientRect();
        const dr = d.getBoundingClientRect();
        const x = dr.left - ar.left + dr.width / 2;
        const y = dr.top - ar.top + dr.height / 2;
        d.style.setProperty('--y', y - 34 + 'px');
        d.classList.add('got');
        const id = Number(d.dataset.id);
        caught.push(id);
        const kind = c.items.find((i) => i.id === id).k;
        const v = VALUE[kind] * (VALUE[kind] > 0 ? c.mult : 1);
        score += v;
        const sc = document.getElementById('ascore');
        sc.textContent = score;
        U.bump(sc, 'bump');
        U.floatText(arena, (v > 0 ? '+' : '') + v, x, y, v > 0 ? (v >= 10 ? 'gold' : 'good') : 'bad');
        U.burst(arena, x, y, v > 0 ? ['#ffd23f', '#7de3ff', '#fff'] : ['#ff4d6d', '#555', '#ff9a3c'], v > 0 ? 10 : 14, 70);
        if (v < 0) U.shake(arena);
        else U.bump(document.getElementById('achest'), 'bump');
        U.sfx(v > 0 ? 'coin' : 'boom');
        if (navigator.vibrate) navigator.vibrate(v > 0 ? 15 : [30, 30, 30]);
      });
      const lastT = Math.max(...c.items.map((i) => i.t));
      setTimeout(() => {
        finished = true;
        ctx.act('catch', { ids: caught });
      }, Math.min(c.ms, lastT + FALL_MS) + 150);
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results.players;
      const idx = r.findIndex((p) => p.name === you.name);
      const mine = r[idx] || { gems: 0, correct: 0, best: 0, tier: 0 };
      return U.playerResult({
        win: idx === 0,
        title: idx === 0 ? 'ניצחתם!' : idx < 3 ? 'על הפודיום!' : 'כל הכבוד!',
        big: `${mine.gems} 💎`,
        bigLabel: TIER_NAMES[mine.tier || 0],
        lines: [`🏅 מקום ${idx + 1} מתוך ${r.length}`, `✅ ${mine.correct} תשובות נכונות`, `🔥 רצף שיא ${mine.best}`],
      });
    },
  };
})();
