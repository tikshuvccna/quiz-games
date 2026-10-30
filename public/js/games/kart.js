// Client side of "קארט מאחור": a pseudo-3D road drawn on a canvas on the phone (steer, dodge cones, grab boost pads);
// the big screen is a race board by distance.
(function () {
  const { esc } = U;
  const BASE_V = 650;
  const BOOST_V = 1100;
  const S = 120; // perspective: rel distance of a road row is S * (1 / p - 1)
  const VIEW = 1700;
  const LANES = [-0.7, -0.35, 0, 0.35, 0.7];

  const rng = (a) => () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // the same track for everyone: items (cones and boost pads) and the bends come from the room's seed
  const makeTrack = (seed) => {
    const r = rng(seed);
    const items = [];
    for (let k = 0; k < 500; k++) {
      const d = 600 + k * 230 + r() * 100;
      const boost = r() > 0.8;
      items.push({ d, x: LANES[Math.floor(r() * LANES.length)], boost });
    }
    const ph = (seed % 7) + 1;
    const curve = (d) => 1.0 * Math.sin(d / 900 + ph) + 0.6 * Math.sin(d / 430 + ph * 1.7);
    return { items, curve };
  };

  Art.covers.kart = () => `<rect width="160" height="100" fill="#7fd3ff"/><rect y="52" width="160" height="48" fill="#3fa34d"/>
    <path d="M62 52 L98 52 L140 100 L20 100Z" fill="#555a6e"/><path d="M80 52 L80 100" stroke="#fff" stroke-width="3" stroke-dasharray="7 6"/>
    <path d="M66 52 L22 100 M94 52 L138 100" stroke="#ff4d6d" stroke-width="3" stroke-dasharray="8 6"/>
    <g transform="translate(62 62)"><rect x="2" y="12" width="32" height="14" rx="5" fill="#ff4d6d" stroke="#1b1340" stroke-width="2.5"/><rect x="8" y="4" width="20" height="12" rx="4" fill="#ffd23f" stroke="#1b1340" stroke-width="2.5"/><rect x="-2" y="18" width="8" height="12" rx="3" fill="#222"/><rect x="30" y="18" width="8" height="12" rx="3" fill="#222"/></g>`;

  function drive(app, you, ctx) {
    const d = you.drive;
    app.innerHTML = `${ctx.topBar()}<div class="kt-play"><canvas class="kt-canvas"></canvas>
      <div class="kt-hud"><div class="kt-time"><i></i></div><span class="kt-speed" id="ktv">0</span></div>
      <div class="kt-zone l" data-s="-1"><span>◀</span></div><div class="kt-zone r" data-s="1"><span>▶</span></div></div>`;
    const box = app.querySelector('.kt-play');
    const cv = app.querySelector('canvas');
    const g = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = box.clientWidth;
    const H = box.clientHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    g.scale(dpr, dpr);
    const track = makeTrack(d.seed);
    const horizon = H * 0.4;
    let pos = 0;
    let x = 0;
    let speed = BASE_V * 0.5;
    let boost = 0;
    let steer = 0;
    let held = 0;
    let top = 0;
    let slow = 0;
    let t = 0;
    let done = false;
    let last = performance.now();
    const keys = new Set();
    app.querySelector('.kt-time i').style.animationDuration = d.secs + 's';
    const setHeld = (s) => { held = s; };
    box.addEventListener('pointerdown', (e) => { const z = e.target.closest('.kt-zone'); if (z) { e.preventDefault(); setHeld(Number(z.dataset.s)); } });
    const up = () => setHeld(0);
    box.addEventListener('pointerup', up);
    box.addEventListener('pointercancel', up);
    box.addEventListener('pointerleave', up);
    const onKey = (e, v) => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'a') { if (v) keys.add(-1); else keys.delete(-1); }
      if (k === 'ArrowRight' || k === 'd') { if (v) keys.add(1); else keys.delete(1); }
    };
    const kd = (e) => onKey(e, true);
    const ku = (e) => onKey(e, false);
    document.addEventListener('keydown', kd);
    document.addEventListener('keyup', ku);

    const rowC = new Float32Array(Math.ceil(H) + 2);
    const rowH = new Float32Array(Math.ceil(H) + 2);

    function frame(now) {
      if (done) return;
      if (!document.body.contains(cv)) { document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      // steering: the finger on the left or right half, or the arrow keys
      const want = held || (keys.has(-1) ? -1 : keys.has(1) ? 1 : 0);
      steer += (want - steer) * Math.min(1, dt * 10);
      // the target speed: boost, or cruise, and a hit knocks it down
      const goal = boost > 0 ? BOOST_V : BASE_V;
      speed += (goal - speed) * Math.min(1, dt * (boost > 0 ? 4 : 1.2));
      if (slow > 0) { speed = Math.min(speed, BASE_V * 0.35); slow -= dt; }
      boost = Math.max(0, boost - dt);
      const prev = pos;
      pos += speed * dt;
      top = Math.max(top, speed);
      // the bends push the kart outward, more at speed; steer against them
      x += steer * 1.7 * dt * (0.6 + speed / BASE_V * 0.4) - track.curve(pos) * 0.45 * (speed / BASE_V) * dt;
      x = Math.max(-1.25, Math.min(1.25, x));
      if (Math.abs(x) > 1.0) speed = Math.min(speed, BASE_V * 0.7); // grass slows you down
      for (const it of track.items) {
        if (it.d > prev && it.d <= pos && Math.abs(it.x - x) < 0.2) {
          if (it.boost) { boost = 1.6; U.sfx('coin'); } else { slow = 0.8; U.sfx('bad'); if (navigator.vibrate) navigator.vibrate(40); }
        }
      }
      render();
      app.querySelector('#ktv').textContent = Math.round(speed / 5) + ' קמ"ש';
      if (t >= d.secs) { finish(); return; }
      requestAnimationFrame(frame);
    }

    function render() {
      const sky = g.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, '#4aa8ff');
      sky.addColorStop(1, '#bfe8ff');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, horizon + 1);
      // distant hills slide with the bend
      g.fillStyle = '#6fbf73';
      const shift = -track.curve(pos + 400) * 40 - x * 20;
      g.beginPath();
      g.moveTo(0, horizon);
      for (let i = 0; i <= 8; i++) g.lineTo((W / 8) * i, horizon - 18 - 14 * Math.sin(i * 1.7 + shift / 30));
      g.lineTo(W, horizon);
      g.fill();
      // road rows, near to far: heading and offset of the bend build up with distance
      let heading = 0;
      let off = 0;
      let prevRel = 0;
      for (let y = Math.ceil(H); y > horizon + 1; y--) {
        const p = (y - horizon) / (H - horizon);
        const rel = S * (1 / p - 1);
        const dr = rel - prevRel;
        prevRel = rel;
        heading += track.curve(pos + rel) * dr * 0.00003;
        off += heading * dr;
        const half = W * 0.02 + W * 0.52 * p;
        rowC[y] = W / 2 - x * half * 0.9 + off * W * 0.055 * p;
        rowH[y] = half;
      }
      for (let y = Math.floor(horizon) + 2; y <= H; y++) {
        const p = (y - horizon) / (H - horizon);
        const rel = S * (1 / p - 1);
        const band = Math.floor((rel + pos) / 90) % 2 === 0;
        g.fillStyle = band ? '#3fa34d' : '#37963f';
        g.fillRect(0, y, W, 1.4);
        const c = rowC[y];
        const h = rowH[y];
        g.fillStyle = band ? '#ff4d6d' : '#fff';
        g.fillRect(c - h * 1.14, y, h * 2.28, 1.4);
        g.fillStyle = band ? '#5a5f78' : '#535872';
        g.fillRect(c - h, y, h * 2, 1.4);
        if (band) {
          g.fillStyle = 'rgba(255,255,255,.7)';
          g.fillRect(c - h * 0.015, y, h * 0.03, 1.4);
        }
      }
      // cones and boost pads, far first
      const vis = track.items.filter((it) => it.d > pos + 8 && it.d < pos + VIEW).sort((a, b) => b.d - a.d);
      for (const it of vis) {
        const rel = it.d - pos;
        const p = 1 / (1 + rel / S);
        const y = Math.round(horizon + p * (H - horizon));
        const c = rowC[Math.min(y, rowC.length - 2)] || W / 2;
        const h = rowH[Math.min(y, rowH.length - 2)] || 10;
        const sx = c + it.x * h * 0.9;
        const sc = p * 1.15;
        if (it.boost) {
          g.fillStyle = '#ffd23f';
          g.strokeStyle = '#a66a00';
          g.lineWidth = Math.max(1, 3 * p);
          for (let k = 0; k < 2; k++) {
            const yy = y - k * 22 * sc;
            g.beginPath();
            g.moveTo(sx - 38 * sc, yy);
            g.lineTo(sx, yy - 16 * sc);
            g.lineTo(sx + 38 * sc, yy);
            g.lineTo(sx + 38 * sc, yy + 8 * sc);
            g.lineTo(sx, yy - 8 * sc);
            g.lineTo(sx - 38 * sc, yy + 8 * sc);
            g.closePath();
            g.fill();
            g.stroke();
          }
        } else {
          g.fillStyle = 'rgba(0,0,0,.25)';
          g.beginPath();
          g.ellipse(sx, y, 30 * sc, 7 * sc, 0, 0, 7);
          g.fill();
          g.fillStyle = '#ff7a1a';
          g.beginPath();
          g.moveTo(sx - 26 * sc, y);
          g.lineTo(sx, y - 78 * sc);
          g.lineTo(sx + 26 * sc, y);
          g.closePath();
          g.fill();
          g.fillStyle = '#fff';
          g.fillRect(sx - 17 * sc, y - 38 * sc, 34 * sc, 11 * sc);
          g.fillStyle = '#c74d00';
          g.fillRect(sx - 32 * sc, y - 4 * sc, 64 * sc, 6 * sc);
        }
      }
      // the kart, seen from behind, leaning into the turn
      const kx = W / 2;
      const ky = H - 44;
      g.save();
      g.translate(kx, ky + (boost > 0 ? 3 * Math.sin(t * 60) : 0));
      g.rotate(steer * 0.12);
      g.fillStyle = 'rgba(0,0,0,.3)';
      g.beginPath();
      g.ellipse(0, 26, 52, 10, 0, 0, 7);
      g.fill();
      g.fillStyle = '#222';
      g.fillRect(-52, 0, 20, 30);
      g.fillRect(32, 0, 20, 30);
      g.fillStyle = '#ff4d6d';
      g.strokeStyle = '#1b1340';
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(-40, -12, 80, 36, 10);
      g.fill();
      g.stroke();
      g.fillStyle = '#ffd23f';
      g.beginPath();
      g.roundRect(-20, -34, 40, 28, 9);
      g.fill();
      g.stroke();
      g.fillStyle = '#1b1340';
      g.fillRect(-46, -20, 92, 7);
      if (boost > 0) {
        g.fillStyle = '#ffae1a';
        g.beginPath();
        g.moveTo(-14, 24); g.lineTo(0, 24 + 30 + 10 * Math.random()); g.lineTo(14, 24);
        g.fill();
      }
      g.restore();
      if (boost > 0 || speed > BASE_V * 1.05) {
        g.strokeStyle = 'rgba(255,255,255,.5)';
        g.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * W;
          g.beginPath();
          g.moveTo(a, horizon + 20 + Math.random() * (H - horizon));
          g.lineTo(a + (a - W / 2) * 0.12, H);
          g.stroke();
        }
      }
    }

    function finish() {
      if (done) return;
      done = true;
      document.removeEventListener('keydown', kd);
      document.removeEventListener('keyup', ku);
      ctx.act('drive', { dist: Math.round(pos), top: Math.round(top) });
    }
    requestAnimationFrame((n) => { last = n; frame(n); });
  }

  Games.kart = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'kart',
        cls: 'ktroom',
        stats: `<div class="stat" style="${U.pal('#ff4d6d')}"><span class="lbl">🏁 מוביל/ה</span><span class="val small" id="lead">—</span></div><div class="stat" style="${U.pal('#2ee59d')}"><span class="lbl">🏎️ נוסעים עכשיו</span><span class="val" id="ndr">0</span></div>`,
        stage: `<div class="kt-sky"></div><div class="kt-list" id="ktlist"></div>`,
      })) this.rows = new Map();
      U.hostTick(st, `${b.total} שחקנים · כל אחד לעצמו`);
      const lead = document.getElementById('lead');
      const leader = b.players[0] && b.players[0].dist > 0 ? b.players[0].name : '—';
      if (lead.textContent !== leader) { lead.textContent = leader; U.bump(lead); }
      U.countTo(document.getElementById('ndr'), b.players.filter((p) => p.driving).length);
      const list = document.getElementById('ktlist');
      const max = Math.max(100, ...b.players.map((p) => p.dist));
      const names = new Set(b.players.map((p) => p.name));
      for (const [n, el] of this.rows) if (!names.has(n)) { el.remove(); this.rows.delete(n); }
      b.players.forEach((p, i) => {
        let el = this.rows.get(p.name);
        if (!el) {
          el = document.createElement('div');
          el.className = 'kt-row';
          el.innerHTML = `<span class="kt-rank"></span><b>${esc(p.name)}</b><div class="kt-road"><span class="kt-car">🏎️</span></div><span class="kt-d">0</span>`;
          list.appendChild(el);
          this.rows.set(p.name, el);
          U.bump(el, 'drop-in');
        }
        el.style.order = i;
        el.querySelector('.kt-rank').textContent = i + 1;
        // an RTL track: the car starts on the right and drives left, so use `right`
        el.querySelector('.kt-car').style.right = `calc(${Math.min(100, (p.dist / max) * 100)}% - ${(p.dist / max) * 36}px)`;
        U.countTo(el.querySelector('.kt-d'), p.dist);
        el.classList.toggle('driving', p.driving);
      });
    },

    hostEnded(app, st) {
      if (!U.view(app, 'kart-end')) return;
      const r = st.results.players;
      U.hostResults(app, st, {
        title: r[0] ? `${esc(r[0].name)} אלופ/ת המסלול!` : 'סוף המשחק',
        sub: 'קארט מאחור',
        body: `<div class="end-visual">${U.podium(r.slice(0, 3).map((p) => ({ name: p.name, value: p.dist, unit: 'מטר' })))}</div>`,
        table: U.table(r, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
          ['מרחק', (p) => `🏁 ${p.dist} מ'`],
          ['נסיעות', (p) => p.drives],
          ['מהירות שיא', (p) => `⚡ ${p.top}`],
        ]),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">🏁 ${you.dist}</span><span class="hchip">#${you.rank}</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase === 'drive') {
        if (!ctx.setView('drive' + you.qid + ':' + you.turn)) return true;
        drive(app, you, ctx);
        return true;
      }
      if (you.phase === 'drove') {
        if (!ctx.setView('drove' + you.qid + ':' + you.turn)) return true;
        app.innerHTML = `${ctx.topBar()}<div class="act-result"><div class="ar-art">🏁</div><div class="ar-title">נסעתם ${you.res.dist} מטר!</div>
          <div class="ar-big">${you.res.total}</div><div class="ar-sub">סך הכול מטרים · מקום ${you.rank}</div></div>`;
        return true;
      }
      return false;
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results.players;
      const idx = r.findIndex((p) => p.name === you.name);
      const mine = r[idx] || { dist: 0, drives: 0, top: 0 };
      return U.playerResult({
        win: idx === 0,
        title: idx === 0 ? 'אלופי המסלול!' : idx < 3 ? 'על הפודיום!' : 'כל הכבוד!',
        big: `${mine.dist}`,
        bigLabel: 'מטרים',
        lines: [`🏅 מקום ${idx + 1} מתוך ${r.length}`, `🏎️ ${mine.drives} נסיעות`, `⚡ מהירות שיא ${mine.top}`],
      });
    },
  };
})();
