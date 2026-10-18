// Client side of "מגני כדור הארץ": canvas battlefield on the host, tap-to-shoot radar on phones.
(function () {
  const { esc } = U;
  const O = '#1e1145';
  const beamColor = (name) => `hsl(${U.hash(name) % 360} 100% 65%)`;

  // seeded irregular rock outline (unit radius)
  function rockShape(id) {
    let s = id * 7919 + 13;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const pts = Array.from({ length: 11 }, (_, i) => {
      const a = (i / 11) * Math.PI * 2;
      const r = 0.82 + rnd() * 0.22;
      return [Math.cos(a) * r, Math.sin(a) * r];
    });
    const craters = Array.from({ length: 3 }, () => [rnd() * 1 - 0.5, rnd() * 1 - 0.5, 0.12 + rnd() * 0.16]);
    return { pts, craters, spin: (rnd() - 0.5) * 1.2 };
  }

  // ---------- host battlefield ----------
  const Space = {
    start(canvas, stage) {
      this.canvas = canvas;
      this.stage = stage;
      this.ctx = canvas.getContext('2d');
      this.snap = null;
      this.snapAt = 0;
      this.fx = [];
      this.debris = [];
      this.seenEv = null;
      this.aim = -Math.PI / 2;
      this.shapes = new Map();
      this.stars = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.3, s: Math.random() * 0.015 + 0.003, t: Math.random() * 6 }));
      const token = (this.token = {});
      const loop = () => {
        if (this.token !== token || !canvas.isConnected) return;
        this.draw();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },

    push(b) {
      const first = this.seenEv === null;
      if (first) this.seenEv = b.ev.length ? b.ev[b.ev.length - 1].id : 0;
      this.snap = b;
      this.snapAt = performance.now();
      for (const e of b.ev) {
        if (e.id <= this.seenEv) continue;
        this.seenEv = e.id;
        const f = { ...e, born: performance.now() };
        this.fx.push(f);
        if (e.k === 'boom') {
          this.spawnDebris(e.x / 100, e.y, e.size);
          U.sfx('boom');
        }
        if (e.k === 'planet') U.shake(this.stage, true);
        if (e.k === 'nova') U.shake(this.stage, true);
      }
    },

    spawnDebris(x, y, size) {
      for (let i = 0; i < 10 + size * 6; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 0.15 + Math.random() * 0.35;
        this.debris.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 1.6, r: 2 + Math.random() * 5, born: performance.now(), c: Math.random() < 0.5 ? '#ffb347' : '#9b8070' });
      }
    },

    pos(a, now) {
      const y = Math.min(1, a.y + (a.v * (now - this.snapAt)) / 1000);
      return { x: a.x / 100, y };
    },

    draw() {
      const cv = this.canvas;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(cv.clientWidth * dpr);
      const H = Math.round(cv.clientHeight * dpr);
      if (!W || !H) return;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const g = this.ctx;
      const now = performance.now();
      const u = Math.min(W, H * 1.8) / 1000; // size unit

      // deep space + nebula
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#05031a');
      bg.addColorStop(1, '#141a52');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      const neb = (x, y, r, c) => { const n = g.createRadialGradient(x, y, 0, x, y, r); n.addColorStop(0, c); n.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = n; g.fillRect(0, 0, W, H); };
      neb(W * 0.2, H * 0.25, W * 0.35, 'rgba(139,92,246,.22)');
      neb(W * 0.85, H * 0.15, W * 0.3, 'rgba(255,79,163,.16)');
      for (const s of this.stars) {
        const y = ((s.y + (now / 1000) * s.s) % 1) * H;
        g.globalAlpha = 0.35 + 0.35 * Math.sin(now / 700 + s.t);
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(s.x * W, y, s.r * dpr, 0, 7);
        g.fill();
      }
      g.globalAlpha = 1;

      // planet: only the top cap is visible; asteroids hit at `horizon`
      const pr = W * 0.95;
      const pcx = W / 2;
      const pcy = H + pr * 0.86;
      const horizon = pcy - pr;
      const snap = this.snap;
      const hpRatio = snap ? snap.hp / snap.maxHp : 1;
      // atmosphere glow
      const atm = g.createRadialGradient(pcx, pcy, pr * 0.98, pcx, pcy, pr * 1.12);
      atm.addColorStop(0, 'rgba(90,200,255,.55)');
      atm.addColorStop(1, 'rgba(90,200,255,0)');
      g.fillStyle = atm;
      g.beginPath();
      g.arc(pcx, pcy, pr * 1.12, 0, 7);
      g.fill();
      g.save();
      g.beginPath();
      g.arc(pcx, pcy, pr, 0, 7);
      g.clip();
      const pg = g.createRadialGradient(pcx - pr * 0.2, pcy - pr * 0.9, pr * 0.05, pcx, pcy, pr);
      pg.addColorStop(0, '#7fdcff');
      pg.addColorStop(0.35, '#2f7fe0');
      pg.addColorStop(1, '#0d2c78');
      g.fillStyle = pg;
      g.fillRect(0, 0, W, H);
      // continents drift slowly
      const drift = (now / 60000) % 1;
      g.fillStyle = '#35c97a';
      g.strokeStyle = '#178a4a';
      g.lineWidth = 4 * u;
      for (let i = 0; i < 6; i++) {
        const x = ((i / 6 + drift) % 1) * W * 1.3 - W * 0.15;
        const y = horizon + (30 + (i % 3) * 22) * u;
        g.beginPath();
        g.ellipse(x, y, (90 + (i % 2) * 60) * u, (22 + (i % 3) * 8) * u, (i % 2 ? 0.2 : -0.15), 0, 7);
        g.fill();
        g.stroke();
      }
      g.restore();
      g.strokeStyle = O;
      g.lineWidth = 6 * u;
      g.beginPath();
      g.arc(pcx, pcy, pr, Math.PI * 1.05, Math.PI * 1.95);
      g.stroke();
      // shield dome: brightness follows hp
      const low = hpRatio < 0.3;
      g.strokeStyle = low ? `rgba(255,90,90,${0.35 + 0.3 * Math.sin(now / 120)})` : `rgba(120,230,255,${0.2 + 0.6 * hpRatio})`;
      g.shadowColor = low ? '#ff4d4d' : '#5ad1ff';
      g.shadowBlur = 30 * u;
      g.lineWidth = 9 * u;
      g.setLineDash(low ? [30 * u, 18 * u] : []);
      g.beginPath();
      g.arc(pcx, pcy, pr + 34 * u, Math.PI * 1.08, Math.PI * 1.92);
      g.stroke();
      g.setLineDash([]);
      g.shadowBlur = 0;

      // turret
      const tx = pcx;
      const ty = horizon + 6 * u;
      g.save();
      g.translate(tx, ty);
      g.rotate(this.aim + Math.PI / 2);
      g.fillStyle = '#c9d4e6';
      g.strokeStyle = O;
      g.lineWidth = 4 * u;
      g.beginPath();
      g.rect(-9 * u, -62 * u, 18 * u, 50 * u);
      g.fill();
      g.stroke();
      g.restore();
      g.fillStyle = '#ff5a7a';
      g.beginPath();
      g.arc(tx, ty, 26 * u, Math.PI, 0);
      g.closePath();
      g.fill();
      g.stroke();

      if (!snap) return;

      // asteroids
      for (const a of snap.ast) {
        const p = this.pos(a, now);
        const x = p.x * W;
        const y = 90 * u + p.y * (horizon - 90 * u);
        const r = (20 + a.max * 9 + (a.boss ? 30 : 0)) * u * 0.95;
        if (!this.shapes.has(a.id)) this.shapes.set(a.id, rockShape(a.id));
        const sh = this.shapes.get(a.id);
        // fire trail
        const tg = g.createLinearGradient(x, y - r * 4, x, y);
        tg.addColorStop(0, 'rgba(255,140,40,0)');
        tg.addColorStop(1, a.boss ? 'rgba(255,60,90,.75)' : 'rgba(255,170,60,.65)');
        g.fillStyle = tg;
        g.beginPath();
        g.moveTo(x - r * 0.75, y);
        g.quadraticCurveTo(x, y - r * 5, x + r * 0.75, y);
        g.fill();
        g.save();
        g.translate(x, y);
        g.rotate((now / 1000) * sh.spin);
        g.beginPath();
        sh.pts.forEach(([px, py], i) => (i ? g.lineTo(px * r, py * r) : g.moveTo(px * r, py * r)));
        g.closePath();
        const bgr = g.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
        bgr.addColorStop(0, a.boss ? '#ff9ab5' : '#d9c4ad');
        bgr.addColorStop(1, a.boss ? '#8a1040' : '#5e4636');
        g.fillStyle = bgr;
        g.shadowColor = a.boss ? '#ff3b6b' : '#ff9a3c';
        g.shadowBlur = 20 * u;
        g.fill();
        g.shadowBlur = 0;
        g.strokeStyle = O;
        g.lineWidth = 4 * u;
        g.stroke();
        g.fillStyle = 'rgba(0,0,0,.25)';
        for (const [cx, cy, cr] of sh.craters) {
          g.beginPath();
          g.arc(cx * r, cy * r, cr * r, 0, 7);
          g.fill();
        }
        g.restore();
        if (a.boss) {
          g.fillStyle = '#fff35c';
          g.strokeStyle = O;
          g.lineWidth = 3 * u;
          [-1, 1].forEach((d) => { g.beginPath(); g.arc(x + d * r * 0.3, y - r * 0.05, r * 0.12, 0, 7); g.fill(); g.stroke(); });
        }
        // hp bar
        if (a.max > 1) {
          const bw = r * 1.4;
          g.fillStyle = 'rgba(0,0,0,.6)';
          g.fillRect(x - bw / 2, y - r - 16 * u, bw, 8 * u);
          g.fillStyle = a.boss ? '#ff4d6d' : '#7dffb0';
          g.fillRect(x - bw / 2, y - r - 16 * u, (bw * a.hp) / a.max, 8 * u);
        }
      }

      // debris
      this.debris = this.debris.filter((d) => now - d.born < 1100);
      for (const d of this.debris) {
        const t = (now - d.born) / 1000;
        g.globalAlpha = 1 - t / 1.1;
        g.fillStyle = d.c;
        g.beginPath();
        g.arc((d.x + d.vx * t) * W, 90 * u + (d.y + d.vy * t + 0.2 * t * t) * (horizon - 90 * u), d.r * u * 1.6, 0, 7);
        g.fill();
      }
      g.globalAlpha = 1;

      // effects: beams, explosions, nova
      this.fx = this.fx.filter((f) => now - f.born < 1000);
      for (const f of this.fx) {
        const t = (now - f.born) / 1000;
        if (f.k === 'hit' || f.k === 'boom') {
          const fx = (f.x / 100) * W;
          const fy = 90 * u + f.y * (horizon - 90 * u);
          if (t < 0.05) this.aim = Math.atan2(fy - ty, fx - tx);
          const bt = Math.min(1, t / 0.35);
          if (bt < 1) {
            const col = beamColor(f.by);
            g.globalAlpha = 1 - bt;
            g.strokeStyle = col;
            g.shadowColor = col;
            g.shadowBlur = 24 * u;
            g.lineWidth = 10 * u;
            g.beginPath();
            g.moveTo(tx + Math.cos(this.aim) * 60 * u, ty + Math.sin(this.aim) * 60 * u);
            g.lineTo(fx, fy);
            g.stroke();
            g.strokeStyle = '#fff';
            g.lineWidth = 3 * u;
            g.stroke();
            g.shadowBlur = 0;
            g.globalAlpha = 1;
          }
          if (f.k === 'boom') {
            const er = (40 + t * 160) * u * (0.7 + f.size * 0.3);
            const eg = g.createRadialGradient(fx, fy, 0, fx, fy, er);
            eg.addColorStop(0, `rgba(255,250,210,${1 - t})`);
            eg.addColorStop(0.45, `rgba(255,150,40,${0.85 * (1 - t)})`);
            eg.addColorStop(1, 'rgba(255,60,0,0)');
            g.fillStyle = eg;
            g.beginPath();
            g.arc(fx, fy, er, 0, 7);
            g.fill();
          }
          if (t < 0.8) {
            g.globalAlpha = 1 - t / 0.8;
            g.font = `900 ${Math.round(22 * u * 1.4)}px Heebo, sans-serif`;
            g.textAlign = 'center';
            g.lineWidth = 5 * u;
            g.strokeStyle = 'rgba(0,0,0,.7)';
            g.strokeText(f.by, fx, fy - 60 * u - t * 40 * u);
            g.fillStyle = beamColor(f.by);
            g.fillText(f.by, fx, fy - 60 * u - t * 40 * u);
            g.globalAlpha = 1;
          }
        } else if (f.k === 'planet') {
          if (t < 0.45) {
            g.fillStyle = `rgba(255, 60, 80, ${0.3 * (1 - t / 0.45)})`;
            g.fillRect(0, 0, W, H);
          }
          const fx = (f.x / 100) * W;
          const er = (30 + t * 220) * u;
          g.strokeStyle = `rgba(255,120,80,${1 - t})`;
          g.lineWidth = 10 * u;
          g.beginPath();
          g.arc(fx, horizon, er, Math.PI, 0);
          g.stroke();
        } else if (f.k === 'nova') {
          g.strokeStyle = `rgba(160,240,255,${1 - t})`;
          g.lineWidth = 30 * u * (1 - t);
          g.beginPath();
          g.arc(tx, ty, t * W, 0, 7);
          g.stroke();
          if (t < 0.25) { g.fillStyle = `rgba(255,255,255,${0.6 * (1 - t / 0.25)})`; g.fillRect(0, 0, W, H); }
        }
      }
      for (const id of [...this.shapes.keys()]) if (!snap.ast.some((a) => a.id === id)) this.shapes.delete(id);
    },
  };

  Games.asteroids = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'asteroids',
        cls: 'space',
        stats: `<div class="stat wide" style="${U.pal('#1f6fe0')}"><span class="lbl">🛡️ מגן כדור הארץ</span><div class="meterbar" id="shield"><i></i><b></b></div></div>
          <div class="stat" style="${U.pal('#8b5cf6')}"><span class="lbl">🌊 גל</span><span class="val" id="wave">1</span></div>
          <div class="stat" style="${U.pal('#ff8a3d')}"><span class="lbl">☄️ הושמדו</span><span class="val" id="kills">0</span></div>`,
        stage: `<canvas id="cv"></canvas><div class="side-board" id="top"></div>`,
      })) Space.start(document.getElementById('cv'), document.getElementById('stage'));
      Space.push(b);
      const ratio = b.hp / b.maxHp;
      const sh = document.getElementById('shield');
      sh.firstElementChild.style.width = ratio * 100 + '%';
      sh.lastElementChild.textContent = `${b.hp} / ${b.maxHp}`;
      sh.classList.toggle('low', ratio < 0.3);
      const w = document.getElementById('wave');
      if (w.textContent !== String(b.wave)) { w.textContent = b.wave; U.bump(w); }
      U.countTo(document.getElementById('kills'), b.kills);
      U.hostTick(st, `${st.players.length} מגינים · כולם ביחד`);
      document.getElementById('top').innerHTML = `<h4>🎯 צלפים מובילים</h4>` + (b.top.map((t, i) => `<div class="sb-row"><span class="rk">${i + 1}</span>${U.avatar(t.name, beamColor(t.name))}<b>${esc(t.name)}</b><span>${t.kills}</span></div>`).join('') || '<div class="muted">—</div>');
    },

    hostEnded(app, st) {
      if (!U.view(app, 'asteroids-end')) return;
      const r = st.results;
      U.hostResults(app, st, {
        lost: !r.victory,
        title: r.victory ? 'כדור הארץ ניצל!' : 'המגן קרס…',
        sub: `שרדתם עד גל ${r.wave} · הושמדו ${r.kills} אסטרואידים`,
        body: `<div class="end-visual"><div class="end-planet ${r.victory ? '' : 'lost'}">${Art.planet()}</div>${U.podium(r.players.slice(0, 3).map((p) => ({ name: p.name, value: p.kills, unit: 'אסטרואידים', color: beamColor(p.name) })))}</div>`,
        table: U.table(r.players, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name, beamColor(p.name))}${esc(p.name)}</span>`],
          ['הושמדו', (p) => `☄️ ${p.kills}`],
          ['נכונות', (p) => p.correct],
        ]),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">🔫 ${you.shots}</span>${you.supers ? `<span class="hchip">⚡ ${you.supers}</span>` : ''}<span class="hchip">🛡️ ${you.hp}</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase !== 'shoot') return false;
      if (ctx.setView('shoot')) {
        this.ctx = ctx;
        this.nodes = new Map();
        app.innerHTML = `${ctx.topBar()}
          <div class="phase-title">לחצו על אסטרואיד כדי לירות!</div>
          <div class="radar" id="field"><div class="radar-stars"></div><div class="radar-planet">${Art.planet()}</div><div class="ammo" id="ammo"></div></div>
          <div class="ctrl"><button class="btn pink" id="nova">⚡ סופר-לייזר</button><button class="btn ghost" id="skip">לשאלה הבאה ⏭</button></div>`;
        this.field = document.getElementById('field');
        this.field.addEventListener('pointerdown', (e) => {
          const r = e.target.closest('.rock');
          if (!r || !this.you || this.you.shots <= 0) return;
          e.preventDefault();
          this.laser(r);
          ctx.act('shoot', { id: Number(r.dataset.id) });
        });
        document.getElementById('nova').onclick = () => {
          U.sfx('boom');
          U.bump(this.field, 'nova-flash');
          ctx.act('shoot', { nova: true });
        };
        document.getElementById('skip').onclick = () => ctx.act('skip');
      } else ctx.refreshTop();
      this.you = you;
      document.getElementById('nova').hidden = !you.supers;
      document.getElementById('ammo').innerHTML = `<b>${you.shots}</b> יריות`;
      this.render(ctx.board());
      return true;
    },

    laser(rock) {
      const f = this.field.getBoundingClientRect();
      const r = rock.getBoundingClientRect();
      const x = r.left - f.left + r.width / 2;
      const y = r.top - f.top + r.height / 2;
      const sx = f.width / 2;
      const sy = f.height - 30;
      const len = Math.hypot(x - sx, y - sy);
      const beam = document.createElement('i');
      beam.className = 'beam';
      beam.style.left = sx + 'px';
      beam.style.top = sy + 'px';
      beam.style.width = len + 'px';
      beam.style.transform = `rotate(${Math.atan2(y - sy, x - sx)}rad)`;
      this.field.appendChild(beam);
      setTimeout(() => beam.remove(), 300);
      U.burst(this.field, x, y, ['#ff9a3c', '#ffd23f', '#fff'], 10, 60);
      U.sfx('pop');
      if (navigator.vibrate) navigator.vibrate(12);
    },

    onBoard(you, b) {
      if (you.phase === 'shoot') this.render(b);
    },

    render(b) {
      if (!b || !this.field || !this.field.isConnected) return;
      const seen = new Set();
      for (const a of b.ast) {
        seen.add(a.id);
        let n = this.nodes.get(a.id);
        if (!n) {
          n = document.createElement('button');
          n.className = 'rock' + (a.boss ? ' boss' : '');
          n.dataset.id = a.id;
          n.style.setProperty('--sz', (a.boss ? 96 : 44 + a.max * 12) + 'px');
          n.innerHTML = `<span class="rock-spin">${Art.rock(a.id, a.boss)}</span><span class="hp"></span>`;
          this.field.appendChild(n);
          this.nodes.set(a.id, n);
        }
        n.style.left = a.x + '%';
        n.style.top = 4 + a.y * 80 + '%';
        n.querySelector('.hp').innerHTML = a.max > 1 ? '<i></i>'.repeat(a.hp) : '';
        if (n.dataset.hp && Number(n.dataset.hp) !== a.hp) U.bump(n, 'hit');
        n.dataset.hp = a.hp;
      }
      for (const [id, n] of this.nodes) {
        if (!seen.has(id)) {
          const f = this.field.getBoundingClientRect();
          const r = n.getBoundingClientRect();
          U.burst(this.field, r.left - f.left + r.width / 2, r.top - f.top + r.height / 2, ['#ff9a3c', '#9b8070', '#fff'], 8, 50);
          n.remove();
          this.nodes.delete(id);
        }
      }
    },

    playerEnded(app, you) {
      const r = you.results;
      const mine = r.players.find((p) => p.name === you.name) || { kills: 0, correct: 0 };
      return U.playerResult({
        win: r.victory,
        title: r.victory ? 'כדור הארץ ניצל!' : 'המגן קרס…',
        big: `${mine.kills} ☄️`,
        bigLabel: 'אסטרואידים על שמכם',
        lines: [`🌊 שרדתם עד גל ${r.wave}`, `💥 ביחד הושמדו ${r.kills}`, `✅ ${mine.correct} תשובות נכונות`],
      });
    },
  };
})();
