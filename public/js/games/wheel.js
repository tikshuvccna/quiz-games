// Client side of "גלגל המזל": a showtime wheel + live leaderboard on the host, spin-the-wheel on the phone.
(function () {
  const { esc } = U;
  const O = Art.O;
  // mirrors server/games/wheel.js SEGS (12 segments, clockwise from the top)
  const SEGS = [
    { k: 'pts', v: 100 }, { k: 'pts', v: 200 }, { k: 'double' }, { k: 'pts', v: 300 }, { k: 'steal' }, { k: 'pts', v: 100 },
    { k: 'half' }, { k: 'pts', v: 500 }, { k: 'swap' }, { k: 'pts', v: 200 }, { k: 'pts', v: 1000 }, { k: 'pts', v: 300 },
  ];
  const BASE = ['#ff4d6d', '#ff8a3d', '#3b8eff', '#2ee59d', '#ff4fa3', '#22c7e8'];
  const look = (s, i) => {
    if (s.k === 'double') return { fill: 'url(#wh-gold)', text: '×2', ink: O, size: 24 };
    if (s.k === 'half') return { fill: '#2a2c45', text: '½', sub: 'חצי', ink: '#ff8aa0', size: 24 };
    if (s.k === 'steal') return { fill: '#7c3aed', text: '🦹', sub: 'גניבה', ink: '#fff', size: 19 };
    if (s.k === 'swap') return { fill: '#0ea5b7', text: '🔄', sub: 'החלפה', ink: '#fff', size: 19 };
    if (s.v === 1000) return { fill: 'url(#wh-jack)', text: '1000', sub: '💰', ink: O, size: 14.5 };
    return { fill: BASE[i % BASE.length], text: String(s.v), ink: '#fff', size: 19 };
  };

  Art.addDefs('wh-defs', `
    <linearGradient id="wh-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset=".5" stop-color="#ffcf33"/><stop offset="1" stop-color="#e09a00"/></linearGradient>
    <linearGradient id="wh-jack" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffbd1"/><stop offset=".4" stop-color="#ffd23f"/><stop offset=".6" stop-color="#fff6c4"/><stop offset="1" stop-color="#f0a500"/></linearGradient>
    <radialGradient id="wh-hub" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#c98a00"/></radialGradient>
    <radialGradient id="wh-shine" cx=".5" cy=".5" r=".5"><stop offset=".7" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".25"/></radialGradient>`);

  const pt = (deg, r) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [(Math.cos(a) * r).toFixed(2), (Math.sin(a) * r).toFixed(2)];
  };

  // the spinning disc (rotate .wh-disc) + a fixed rim, bulbs and pointer
  function wheel() {
    const segs = SEGS.map((s, i) => {
      const L = look(s, i);
      const [x0, y0] = pt(i * 30, 100);
      const [x1, y1] = pt(i * 30 + 30, 100);
      return `<g><path d="M0 0 L${x0} ${y0} A100 100 0 0 1 ${x1} ${y1} Z" fill="${L.fill}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
        <g transform="rotate(${i * 30 + 15})"><text y="-70" text-anchor="middle" font-family="Heebo,sans-serif" font-weight="900" font-size="${L.size}" fill="${L.ink}" stroke="${L.ink === '#fff' ? 'rgba(0,0,0,.35)' : 'none'}" stroke-width="3" paint-order="stroke">${L.text}</text>${L.sub ? `<text y="-50" text-anchor="middle" font-family="Heebo,sans-serif" font-weight="900" font-size="8.5" fill="${L.ink}">${L.sub}</text>` : ''}</g></g>`;
    }).join('');
    const bulbs = Array.from({ length: 24 }, (_, i) => { const [x, y] = pt(i * 15, 109); return `<circle class="wh-bulb ${i % 2 ? 'b' : 'a'}" cx="${x}" cy="${y}" r="4.2"/>`; }).join('');
    return `<div class="wh-wrap"><svg class="art wh-svg" viewBox="-122 -128 244 250" aria-hidden="true">
      <ellipse cx="0" cy="118" rx="80" ry="7" fill="#000" opacity=".3"/>
      <circle r="116" fill="#8a1f4f" stroke="${O}" stroke-width="5"/><circle r="104" fill="${O}"/>
      ${bulbs}
      <g class="wh-disc">${segs}<circle r="100" fill="url(#wh-shine)"/></g>
      <circle r="20" fill="url(#wh-hub)" stroke="${O}" stroke-width="4"/><path d="M0 -10 L3 -3 L10 -3 L4.5 1.5 L6.5 9 L0 4.5 L-6.5 9 L-4.5 1.5 L-10 -3 L-3 -3Z" fill="#fff" opacity=".9"/>
      <g class="wh-ptr"><path d="M0 -92 L-14 -126 H14 Z" fill="#fff" stroke="${O}" stroke-width="4" stroke-linejoin="round"/><circle cy="-118" r="5" fill="#ff4d6d"/></g>
    </svg></div>`;
  }

  // rotation that puts segment `seg` under the pointer, at least `turns` full turns after `from`
  const landAt = (from, seg, turns = 4) => {
    const want = (360 - (seg * 30 + 15) + (Math.random() - 0.5) * 18) % 360;
    const base = from - (from % 360) + 360 * turns;
    return base + want + (base + want < from + 360 * turns ? 360 : 0);
  };
  const angleOf = (el) => {
    const m = getComputedStyle(el).transform;
    if (!m || m === 'none') return 0;
    const [a, b] = m.slice(7, -1).split(',').map(Number);
    return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  };
  function spinTo(disc, seg, ms, from) {
    const start = from !== undefined ? from : angleOf(disc);
    disc.getAnimations().forEach((a) => a.cancel());
    const end = landAt(start, seg);
    disc.style.transform = `rotate(${start}deg)`;
    const anim = disc.animate([{ transform: `rotate(${start}deg)` }, { transform: `rotate(${end}deg)` }], { duration: ms, easing: 'cubic-bezier(.12,.75,.18,1)', fill: 'forwards' });
    // tick sounds as segments pass the pointer
    let last = Math.floor(start / 30);
    const tick = () => {
      if (anim.playState !== 'running') return;
      const a = angleOf(disc);
      const n = Math.floor(a / 30);
      if (n !== last) { last = n; U.sfx('tick'); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return anim;
  }
  const kindText = (e) => e.kind === 'pts' ? (e.delta >= 1000 ? `💰 ג׳קפוט! +${e.delta}` : `+${e.delta}`) : e.kind === 'double' ? `×2 · +${e.delta}` : e.kind === 'half' ? (e.delta < 0 ? `💸 ${e.delta}` : '💸 חצי… מאפס') : e.target ? (e.kind === 'steal' ? `🦹 גנב/ה מ${e.target} · +${e.delta}` : `🔄 התחלף/ה עם ${e.target}`) : `👑 בראש! +${e.delta}`;

  Art.covers.wheel = () => `<rect width="160" height="100" fill="#4a1450"/>${Array.from({ length: 12 }, (_, i) => `<path d="M80 50 L80 0" stroke="#ffd23f" stroke-width="10" opacity=".08" transform="rotate(${i * 30} 80 50)"/>`).join('')}
    <g transform="translate(80 52) scale(.36)">${SEGS.map((s, i) => { const L = look(s, i); const [x0, y0] = pt(i * 30, 100); const [x1, y1] = pt(i * 30 + 30, 100); return `<path d="M0 0 L${x0} ${y0} A100 100 0 0 1 ${x1} ${y1} Z" fill="${L.fill}" stroke="${O}" stroke-width="3"/>`; }).join('')}<circle r="100" fill="none" stroke="#8a1f4f" stroke-width="14"/><circle r="107" fill="none" stroke="${O}" stroke-width="4"/><circle r="18" fill="url(#wh-hub)" stroke="${O}" stroke-width="4"/>
    <path d="M0 -88 L-14 -124 H14 Z" fill="#fff" stroke="${O}" stroke-width="5" stroke-linejoin="round"/></g>
    ${[[18, 18], [140, 22], [20, 80], [144, 82]].map(([x, y]) => `<path d="M${x} ${y - 7} L${x + 2} ${y - 2} L${x + 7} ${y} L${x + 2} ${y + 2} L${x} ${y + 7} L${x - 2} ${y + 2} L${x - 7} ${y} L${x - 2} ${y - 2}Z" fill="#ffd23f"/>`).join('')}`;

  Games.wheel = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'wheel',
        cls: 'wh-show',
        stats: `<div class="stat" style="${U.pal('#c026d3')}"><span class="lbl">👑 בראש</span><span class="val small" id="lead">—</span></div><div class="stat" style="${U.pal('#ff8a3d')}"><span class="lbl">🎡 סיבובים</span><span class="val" id="spins">0</span></div>`,
        stage: `<div class="wh-rays"></div><div class="wh-spot l"></div><div class="wh-spot r"></div>
          <div class="wh-left"><div class="wh-host" id="wheel">${wheel()}</div><div class="wh-who" id="who"></div><div class="wh-banner" id="banner"></div></div>
          <div class="wh-board" id="board"></div>`,
      })) {
        this.seen = b.ev.length ? b.ev[b.ev.length - 1].id : 0;
        this.queue = [];
        this.busy = false;
        this.angle = 0;
        this.count = 0;
        this.prevRank = new Map();
      }
      U.hostTick(st, `${b.total} שחקנים · ${st.teamScores ? 'בקבוצות' : 'כל אחד לעצמו'}`);
      const lead = document.getElementById('lead');
      const leader = b.ranking[0] && b.ranking[0].pts > 0 ? b.ranking[0].name : '—';
      if (lead.textContent !== leader) { lead.textContent = leader; U.bump(lead); }
      this.board(b);
      for (const e of b.ev) {
        if (e.id <= this.seen) continue;
        this.seen = e.id;
        this.count++;
        this.queue.push(e);
      }
      U.countTo(document.getElementById('spins'), this.count);
      if (this.queue.length > 3) this.queue = this.queue.slice(-2);
      this.next(b);
    },

    board(b) {
      const box = document.getElementById('board');
      const max = Math.max(100, ...b.ranking.map((r) => r.pts));
      const keep = new Set();
      b.ranking.forEach((r, i) => {
        keep.add(r.name);
        let row = box.querySelector(`[data-name="${CSS.escape(r.name)}"]`);
        const color = r.team >= 0 && b.teams[r.team] ? b.teams[r.team].color : U.color(r.name);
        if (!row) {
          row = document.createElement('div');
          row.className = 'wh-row';
          row.dataset.name = r.name;
          row.innerHTML = `<span class="wh-rk"></span>${U.avatar(r.name, color)}<span class="wh-nm">${esc(r.name)}</span><div class="wh-bar"><i></i></div><b class="wh-pts"></b>`;
          box.appendChild(row);
        }
        row.style.setProperty('--y', i);
        row.style.setProperty('--bc', color);
        row.querySelector('.wh-rk').textContent = i + 1;
        row.querySelector('.wh-bar i').style.width = Math.max(2, (r.pts / max) * 100) + '%';
        U.countTo(row.querySelector('.wh-pts'), r.pts);
        row.classList.toggle('first', i === 0 && r.pts > 0);
        const was = this.prevRank.get(r.name);
        if (was !== undefined && was > i) U.bump(row, 'wh-up');
        this.prevRank.set(r.name, i);
      });
      [...box.children].forEach((c) => { if (!keep.has(c.dataset.name)) c.remove(); });
    },

    next(b) {
      if (this.busy || !this.queue.length) return;
      const host = document.getElementById('wheel');
      if (!host) return;
      const e = this.queue.shift();
      this.busy = true;
      const color = e.team >= 0 && b.teams[e.team] ? b.teams[e.team].color : U.color(e.name);
      const who = document.getElementById('who');
      who.innerHTML = `${U.avatar(e.name, color)}<b>${esc(e.name)}</b><span>מסובב/ת…</span>`;
      who.style.setProperty('--tc', color);
      U.bump(who, 'popin-b');
      const banner = document.getElementById('banner');
      banner.className = 'wh-banner';
      const fast = this.queue.length > 0;
      const disc = host.querySelector('.wh-disc');
      const anim = spinTo(disc, e.seg, fast ? 2200 : 3400);
      anim.onfinish = () => {
        if (document.getElementById('wheel') !== host) return;
        banner.textContent = kindText(e);
        banner.className = `wh-banner show ${e.delta < 0 ? 'bad' : e.kind !== 'pts' ? 'twist' : ''}`;
        const s = document.getElementById('stage').getBoundingClientRect();
        const r = host.getBoundingClientRect();
        if (e.delta > 0) U.burst(document.getElementById('stage'), r.left - s.left + r.width / 2, r.top - s.top + r.height * 0.1, ['#ffd23f', '#fff', color], e.delta >= 500 ? 26 : 12, 120);
        U.sfx(e.delta < 0 ? 'bad' : e.delta >= 500 ? 'win' : 'coin');
        if (e.target) {
          const row = document.querySelector(`.wh-row[data-name="${CSS.escape(e.target)}"]`);
          if (row) U.shake(row);
        }
        setTimeout(() => { this.busy = false; if (document.getElementById('wheel') === host) this.next(b); }, fast ? 900 : 1600);
      };
    },

    hostEnded(app, st) {
      if (!U.view(app, 'wheel-end')) return;
      const r = st.results.players;
      U.hostResults(app, st, {
        title: r[0] ? `${esc(r[0].name)} מלך/ת הגלגל!` : 'סוף המשחק',
        sub: 'גלגל המזל',
        body: `<div class="end-visual">${U.podium(r.slice(0, 3).map((p) => ({ name: p.name, value: p.pts, unit: 'נקודות' })))}</div>`,
        table: U.table(r, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
          ['נקודות', (p) => `⭐ ${p.pts}`],
          ['סיבובים', (p) => `🎡 ${p.spins}`],
          ['ג׳קפוט', (p) => (p.jackpots ? `💰 ${p.jackpots}` : '—')],
          ['נכונות', (p) => p.correct],
        ]),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">⭐ ${you.pts}</span><span class="hchip">#${you.rank}</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase === 'spin') {
        if (!ctx.setView('spin' + you.qid + ':' + you.turn)) return true;
        app.innerHTML = `${ctx.topBar()}
          <div class="phase-title">סובבו את הגלגל!<small>החליקו על הגלגל או לחצו על הכפתור</small></div>
          <div class="p-stage wh-phone" id="whp">${wheel()}</div>
          <button class="btn big pink" id="spinBtn">🎡 סובבו!</button>`;
        const disc = app.querySelector('.wh-disc');
        let sent = false;
        const go = (e) => {
          if (e) e.preventDefault();
          if (sent) return;
          sent = true;
          document.getElementById('spinBtn').disabled = true;
          disc.classList.add('free');
          U.sfx('pop');
          if (navigator.vibrate) navigator.vibrate(15);
          ctx.act('spin');
        };
        document.getElementById('spinBtn').onclick = go;
        let y0 = null;
        const stage = document.getElementById('whp');
        stage.addEventListener('pointerdown', (e) => { y0 = [e.clientX, e.clientY]; });
        stage.addEventListener('pointerup', (e) => { if (y0 && Math.hypot(e.clientX - y0[0], e.clientY - y0[1]) > 30) go(e); y0 = null; });
        return true;
      }
      if (you.phase === 'spun') {
        if (!ctx.setView('spun' + you.qid + ':' + you.turn)) return true;
        const s = you.spin;
        let disc = app.querySelector('.wh-disc');
        let from;
        if (!disc) {
          app.innerHTML = `${ctx.topBar()}<div class="phase-title">הגלגל מסתובב…</div><div class="p-stage wh-phone" id="whp">${wheel()}</div><button class="btn big pink" disabled>🎡 סובבו!</button>`;
          disc = app.querySelector('.wh-disc');
        } else {
          from = angleOf(disc);
          disc.classList.remove('free');
        }
        const anim = spinTo(disc, s.seg, 3600, from);
        anim.onfinish = () => {
          ctx.refreshTop();
          const t = app.querySelector('.phase-title');
          if (t) t.innerHTML = `<span class="${s.delta < 0 ? 'bad-t' : 'good-t'}">${esc(s.text)}</span><small>${you.pts} נקודות · מקום ${you.rank}</small>`;
          const stage = document.getElementById('whp');
          if (stage) {
            stage.insertAdjacentHTML('beforeend', `<div class="wh-res ${s.delta < 0 ? 'bad' : ''}">${s.delta >= 0 ? '+' : ''}${s.delta}</div>`);
            const r = stage.getBoundingClientRect();
            if (s.delta > 0) U.burst(stage, r.width / 2, r.height * 0.4, ['#ffd23f', '#fff', '#ff4fa3'], s.delta >= 500 ? 26 : 14, 120);
            else if (s.delta < 0) U.shake(stage);
          }
          U.sfx(s.delta < 0 ? 'bad' : s.delta >= 500 ? 'win' : 'coin');
          if (navigator.vibrate) navigator.vibrate(s.delta < 0 ? [40, 30, 40] : 25);
        };
        return true;
      }
      return false;
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results.players;
      const idx = r.findIndex((p) => p.name === you.name);
      const mine = r[idx] || { pts: 0, spins: 0, jackpots: 0, correct: 0 };
      return U.playerResult({
        win: idx === 0,
        title: idx === 0 ? 'מלכי הגלגל!' : idx < 3 ? 'על הפודיום!' : 'כל הכבוד!',
        big: `${mine.pts}`,
        bigLabel: 'נקודות',
        lines: [`🏅 מקום ${idx + 1} מתוך ${r.length}`, `🎡 ${mine.spins} סיבובים${mine.jackpots ? ` · 💰 ${mine.jackpots} ג׳קפוט` : ''}`, `✅ ${mine.correct} תשובות נכונות`],
      });
    },
  };
})();
