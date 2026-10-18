// Client side of "סוגרי שטחים": canvas territory map on the host, follow-camera + D-pad on phones.
(function () {
  const { esc } = U;

  // Canvas renderer shared by host (whole map) and phone (camera around the player)
  class MapView {
    constructor(canvas, opts = {}) {
      this.cv = canvas;
      this.g = canvas.getContext('2d');
      this.opts = opts; // { follow: playerIndex, viewCols }
      this.b = null;
      this.cam = null;
      this.fx = [];
      this.seenEv = 0;
      const tok = (this.tok = {});
      const loop = () => {
        if (this.tok !== tok || !canvas.isConnected) return;
        this.draw();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    stop() { this.tok = null; }

    set(b) {
      if (this.b === null) this.seenEv = b.ev && b.ev.length ? b.ev[b.ev.length - 1].id : 0;
      this.b = b;
      this.colors = new Map(b.players.map((p) => [p.i, p.color]));
      this.names = new Map(b.players.map((p) => [p.i, p.name]));
      for (const e of b.ev || []) {
        if (e.id <= this.seenEv) continue;
        this.seenEv = e.id;
        this.fx.push({ ...e, born: performance.now() });
      }
    }

    draw() {
      const b = this.b;
      const cv = this.cv;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(cv.clientWidth * dpr);
      const H = Math.round(cv.clientHeight * dpr);
      if (!W || !H) return;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const g = this.g;
      g.direction = 'ltr';
      g.clearRect(0, 0, W, H);
      if (!b) return;
      const now = performance.now();
      const { cols, rows, owner, trail } = b;

      // cell size + offset: fit whole map, or follow a player
      let cs, ox, oy;
      if (this.opts.follow != null) {
        cs = W / (this.opts.viewCols || 11);
        const me = b.players.find((p) => p.i === this.opts.follow);
        const tx = me ? (me.pos % cols) + 0.5 : cols / 2;
        const ty = me ? Math.floor(me.pos / cols) + 0.5 : rows / 2;
        if (!this.cam) this.cam = { x: tx, y: ty };
        this.cam.x += (tx - this.cam.x) * 0.2;
        this.cam.y += (ty - this.cam.y) * 0.2;
        ox = W / 2 - this.cam.x * cs;
        oy = H / 2 - this.cam.y * cs;
      } else {
        cs = Math.min(W / cols, H / rows);
        ox = (W - cs * cols) / 2;
        oy = (H - cs * rows) / 2;
      }
      const x0 = Math.max(0, Math.floor(-ox / cs));
      const y0 = Math.max(0, Math.floor(-oy / cs));
      const x1 = Math.min(cols, Math.ceil((W - ox) / cs));
      const y1 = Math.min(rows, Math.ceil((H - oy) / cs));

      // board base
      g.fillStyle = '#1b1446';
      g.fillRect(ox, oy, cs * cols, cs * rows);
      g.strokeStyle = 'rgba(255,255,255,.05)';
      g.lineWidth = 1;
      g.beginPath();
      for (let x = x0; x <= x1; x++) { g.moveTo(ox + x * cs, oy + y0 * cs); g.lineTo(ox + x * cs, oy + y1 * cs); }
      for (let y = y0; y <= y1; y++) { g.moveTo(ox + x0 * cs, oy + y * cs); g.lineTo(ox + x1 * cs, oy + y * cs); }
      g.stroke();

      // land
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const o = owner[y * cols + x];
          if (o < 0) continue;
          const c = this.colors.get(o) || '#888';
          const px = ox + x * cs;
          const py = oy + y * cs;
          g.fillStyle = c;
          g.fillRect(px, py, cs + 0.5, cs + 0.5);
          // bevel only along region edges: light on top, dark below and on the sides
          const bw = Math.max(1.5, cs * 0.14);
          if (y === 0 || owner[(y - 1) * cols + x] !== o) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(px, py, cs, bw); }
          if (y === rows - 1 || owner[(y + 1) * cols + x] !== o) { g.fillStyle = 'rgba(10,5,40,.45)'; g.fillRect(px, py + cs - bw * 1.4, cs, bw * 1.4); }
          g.fillStyle = 'rgba(10,5,40,.3)';
          if (x === 0 || owner[y * cols + x - 1] !== o) g.fillRect(px, py, bw * 0.7, cs);
          if (x === cols - 1 || owner[y * cols + x + 1] !== o) g.fillRect(px + cs - bw * 0.7, py, bw * 0.7, cs);
        }
      }
      // trails: glowing dashes
      const pulse = 0.55 + 0.25 * Math.sin(now / 160);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const t = trail[y * cols + x];
          if (t < 0) continue;
          const c = this.colors.get(t) || '#fff';
          const px = ox + x * cs;
          const py = oy + y * cs;
          g.globalAlpha = 0.35;
          g.fillStyle = c;
          g.fillRect(px, py, cs, cs);
          g.globalAlpha = pulse;
          g.fillStyle = c;
          g.beginPath();
          g.arc(px + cs / 2, py + cs / 2, cs * 0.26, 0, 7);
          g.fill();
          g.globalAlpha = 1;
        }
      }
      // map frame
      g.strokeStyle = 'rgba(255,255,255,.35)';
      g.lineWidth = Math.max(2, cs * 0.12);
      g.strokeRect(ox, oy, cs * cols, cs * rows);

      // heads
      for (const p of b.players) {
        const x = (p.pos % cols) + 0.5;
        const y = Math.floor(p.pos / cols) + 0.5;
        const px = ox + x * cs;
        const py = oy + y * cs;
        if (px < -cs || py < -cs || px > W + cs || py > H + cs) continue;
        const me = p.i === this.opts.follow;
        const r = cs * (me ? 0.62 : 0.5) * (me ? 1 + 0.06 * Math.sin(now / 150) : 1);
        g.shadowColor = 'rgba(0,0,0,.5)';
        g.shadowBlur = cs * 0.3;
        g.shadowOffsetY = cs * 0.08;
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(px, py, r + Math.max(2, cs * 0.1), 0, 7);
        g.fill();
        g.shadowColor = 'transparent';
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(px, py, r, 0, 7);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,.35)';
        g.beginPath();
        g.arc(px - r * 0.3, py - r * 0.3, r * 0.35, 0, 7);
        g.fill();
        g.fillStyle = '#fff';
        g.font = `900 ${Math.round(r * 1.05)}px Heebo, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText([...p.name][0] || '?', px, py + r * 0.06);
        if (cs > 14 && (me || !this.opts.follow)) {
          g.font = `800 ${Math.round(Math.max(11, cs * 0.42))}px Heebo, sans-serif`;
          const label = p.name;
          const tw = g.measureText(label).width + cs * 0.4;
          g.fillStyle = 'rgba(10,5,40,.75)';
          g.beginPath();
          if (g.roundRect) g.roundRect(px - tw / 2, py - r - cs * 0.75, tw, cs * 0.6, cs * 0.2);
          else g.rect(px - tw / 2, py - r - cs * 0.75, tw, cs * 0.6);
          g.fill();
          g.fillStyle = '#fff';
          g.fillText(label, px, py - r - cs * 0.45);
        }
      }

      // effects: captures pulse, cuts flash
      this.fx = this.fx.filter((f) => now - f.born < 1200);
      for (const f of this.fx) {
        const k = (now - f.born) / 1200;
        const px = ox + ((f.t % cols) + 0.5) * cs;
        const py = oy + (Math.floor(f.t / cols) + 0.5) * cs;
        g.globalAlpha = 1 - k;
        if (f.k === 'cap') {
          g.strokeStyle = this.colors.get(f.i) || '#fff';
          g.lineWidth = cs * 0.25;
          g.beginPath();
          g.arc(px, py, cs * (1 + k * 6), 0, 7);
          g.stroke();
          g.fillStyle = '#fff';
          g.font = `900 ${Math.round(cs * 1.1)}px Heebo, sans-serif`;
          g.textAlign = 'center';
          g.fillText('+' + f.n, px, py - cs * (1 + k * 2.5));
        } else if (f.k === 'cut') {
          g.font = `900 ${Math.round(cs * 1.6)}px sans-serif`;
          g.textAlign = 'center';
          g.fillText('✂️', px, py - k * cs * 2);
        }
        g.globalAlpha = 1;
      }
    }
  }

  Games.closer = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'closer',
        cls: 'closer-stage',
        stats: `<div class="stat" style="${U.pal('#2ee59d')}"><span class="lbl">👑 שולט/ת במפה</span><span class="val small" id="lead">—</span></div><div class="stat" style="${U.pal('#8b5cf6')}"><span class="lbl">שטח נכבש</span><span class="val" id="taken">0%</span></div>`,
        stage: `<div class="closer-layout"><div class="closer-lb"><h3>טבלת שטחים</h3><div id="lb"></div><div class="closer-tip">צאו מהשטח, סגרו לולאה וחזרו הביתה. דריכה על זנב של מישהו חותכת אותו ✂️</div></div><div class="map-box"><canvas id="map"></canvas></div></div>`,
      })) {
        if (this.hostMap) this.hostMap.stop();
        this.hostMap = new MapView(document.getElementById('map'));
      }
      this.hostMap.set(b);
      U.hostTick(st, `${b.players.length} שחקנים · כל אחד לעצמו`);
      const leader = b.players[0] && b.players[0].tiles > 0 ? b.players[0].name : '—';
      const lead = document.getElementById('lead');
      if (lead.textContent !== leader) { lead.textContent = leader; U.bump(lead); }
      document.getElementById('taken').textContent = b.players.reduce((s, p) => s + p.pct, 0) + '%';
      const max = Math.max(1, ...b.players.map((p) => p.pct));
      document.getElementById('lb').innerHTML = b.players.slice(0, 10)
        .map((p, i) => `<div class="clb ${i === 0 ? 'first' : ''}"><span class="rk">${i + 1}</span>${U.avatar(p.name, p.color)}<b>${esc(p.name)}</b><span class="cbar"><i style="width:${(p.pct / max) * 100}%;background:${p.color}"></i></span><span class="pct">${p.pct}%</span></div>`).join('');
    },

    hostEnded(app, st) {
      if (!U.view(app, 'closer-end')) return;
      const r = st.results.players;
      U.hostResults(app, st, {
        title: r[0] ? `${esc(r[0].name)} שלט/ה במפה!` : 'סוף המשחק',
        sub: 'סוגרי שטחים',
        body: `<div class="end-visual closer-end">${U.podium(r.slice(0, 3).map((p) => ({ name: p.name, value: p.pct + '%', unit: `${p.tiles} משבצות`, color: p.color })))}<div class="map-box end-map"><canvas id="map"></canvas></div></div>`,
        table: U.table(r, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name, p.color)}${esc(p.name)}</span>`],
          ['שטח', (p) => p.pct + '%'],
          ['נכבשו', (p) => p.captured],
          ['חיתוכים', (p) => `✂️ ${p.cuts}`],
          ['נכונות', (p) => p.correct],
        ]),
      });
      const m = new MapView(document.getElementById('map'));
      m.set({ ...st.results.board, ev: [] });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">👣 ${you.steps}</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase !== 'move') return false;
      if (ctx.setView('move')) {
        this.ctx = ctx;
        app.innerHTML = `${ctx.topBar()}
          <div class="alert hidden" id="alert"></div>
          <div class="move-info"><span class="steps-big"><b id="steps"></b> צעדים</span><span id="hint"></span></div>
          <div class="map-box phone"><canvas id="map"></canvas><div class="my-pct" id="pct"></div></div>
          <div class="pad-row">
            <div class="dpad">
              <button data-d="u" class="up" aria-label="למעלה">▲</button><button data-d="l" class="lf" aria-label="שמאלה">◀</button><button data-d="r" class="rt" aria-label="ימינה">▶</button><button data-d="d" class="dn" aria-label="למטה">▼</button>
            </div>
            <button class="btn ghost done-btn" id="done"></button>
          </div>`;
        if (this.map) this.map.stop();
        this.map = new MapView(document.getElementById('map'), { follow: you.ci, viewCols: 11 });
        this.bindPad(ctx);
      } else ctx.refreshTop();
      const alert = document.getElementById('alert');
      if (alert.textContent !== (you.alert || '')) {
        alert.textContent = you.alert || '';
        alert.classList.toggle('hidden', !you.alert);
        if (you.alert) { U.shake(alert); U.sfx('bad'); }
      }
      const steps = document.getElementById('steps');
      steps.textContent = you.steps;
      steps.parentElement.classList.toggle('low', you.steps <= 3);
      document.getElementById('hint').textContent = you.open ? 'חזרו לשטח שלכם כדי לסגור!' : 'צאו מהשטח וסגרו לולאה';
      const done = document.getElementById('done');
      done.textContent = you.open ? 'ויתור על הלולאה' : 'סיימתי ⏭';
      done.classList.toggle('danger', you.open);
      this.you = you;
      this.draw(ctx.board());
      return true;
    },

    bindPad(ctx) {
      let timer = null;
      const stop = () => { clearInterval(timer); timer = null; };
      const go = (d) => {
        if (!this.you || this.you.phase !== 'move') return stop();
        ctx.act('move', { dir: d });
        if (navigator.vibrate) navigator.vibrate(6);
      };
      const pad = document.querySelector('.dpad');
      pad.onpointerdown = (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        e.preventDefault();
        try { pad.setPointerCapture(e.pointerId); } catch {}
        go(b.dataset.d);
        U.bump(b, 'pressed');
        stop();
        timer = setInterval(() => go(b.dataset.d), 190); // hold to keep walking
      };
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => pad.addEventListener(ev, stop));
      pad.oncontextmenu = (e) => e.preventDefault();
      document.getElementById('done').onclick = () => {
        if (this.you && this.you.open && !confirm('לוותר על הלולאה? הזנב שלכם יימחק')) return;
        ctx.act('done');
      };
      window.onkeydown = (e) => {
        const d = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r' }[e.key];
        if (d && this.you && this.you.phase === 'move' && document.getElementById('map')) { e.preventDefault(); go(d); }
      };
    },

    onBoard(you, b) {
      if (you.phase === 'move') this.draw(b);
    },

    draw(b) {
      if (!b || !this.map || !this.map.cv.isConnected) return;
      this.map.set(b);
      const me = b.players.find((p) => p.i === (this.you && this.you.ci));
      const el = document.getElementById('pct');
      if (el && me) el.textContent = `השטח שלך: ${me.pct}%`;
    },

    playerEnded(app, you) {
      const r = you.results.players;
      const idx = r.findIndex((p) => p.name === you.name);
      const mine = r[idx] || { pct: 0, captured: 0, cuts: 0 };
      return U.playerResult({
        win: idx === 0,
        title: idx === 0 ? 'שלטתם במפה!' : idx < 3 ? 'על הפודיום!' : 'כל הכבוד!',
        big: `${mine.pct}%`,
        bigLabel: 'מהמפה בבעלותכם',
        lines: [`🏅 מקום ${idx + 1} מתוך ${r.length}`, `🟩 ${mine.captured} משבצות נכבשו`, `✂️ ${mine.cuts} חיתוכים`],
      });
    },
  };
})();
