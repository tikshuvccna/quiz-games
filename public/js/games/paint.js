// Client side of "ציור במספרים": a big paint-by-numbers canvas on the host, a zoomed patch to paint on the phone.
(function () {
  const { esc } = U;
  const PAPER = '#f6f1e7';

  // draw a finished picture (gallery thumbnails, results)
  function drawThumb(cv, pic, doneStr) {
    const s = Math.max(1, Math.floor(Math.min(cv.width / pic.w, cv.height / pic.h)));
    const g = cv.getContext('2d');
    const ox = Math.floor((cv.width - pic.w * s) / 2);
    const oy = Math.floor((cv.height - pic.h * s) / 2);
    g.clearRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < pic.px.length; i++) {
      g.fillStyle = !doneStr || doneStr[i] === '1' ? pic.pal[pic.px[i]] : PAPER;
      g.fillRect(ox + (i % pic.w) * s, oy + Math.floor(i / pic.w) * s, s, s);
    }
  }

  Art.covers.paint = () => {
    const pal = ['#ff6fae', '#ff9a6b', '#ffd27a', '#2369c9', '#63b0f2'];
    let cells = '';
    for (let y = 0; y < 6; y++) for (let x = 0; x < 10; x++) {
      const painted = x + y * 0.8 < 7.5;
      const c = y < 2 ? 0 : y < 3 ? 1 : y < 4 ? 2 : (x + y) % 3 ? 3 : 4;
      cells += `<rect x="${30 + x * 10}" y="${14 + y * 10}" width="10" height="10" fill="${painted ? pal[c] : '#f6f1e7'}" stroke="#d9cfbd" stroke-width=".6"/>${painted ? '' : `<text x="${35 + x * 10}" y="${21.5 + y * 10}" font-family="Heebo,sans-serif" font-size="6" font-weight="800" text-anchor="middle" fill="#b9ad96">${c + 1}</text>`}`;
    }
    return `<rect width="160" height="100" fill="#ffe1c9"/><circle cx="20" cy="86" r="26" fill="#ffc7a8"/><circle cx="146" cy="12" r="22" fill="#ffd2e6"/>
      <rect x="24" y="8" width="112" height="72" rx="4" fill="#a8693a" stroke="${Art.O}" stroke-width="3"/>${cells}
      <path d="M98 70 L128 40" stroke="${Art.O}" stroke-width="7" stroke-linecap="round"/><path d="M98 70 L128 40" stroke="#ffd23f" stroke-width="4" stroke-linecap="round"/>
      <path d="M92 76 C92 70 96 68 100 70 C102 74 98 78 92 76Z" fill="#ff4fa3" stroke="${Art.O}" stroke-width="2"/>
      ${[['#ff4d6d', 14, 30], ['#3b8eff', 146, 50], ['#2ee59d', 140, 84], ['#ffd23f', 10, 60]].map(([c, x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="${c}" stroke="${Art.O}" stroke-width="2"/>`).join('')}`;
  };

  Games.paint = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'paint',
        cls: 'pt-studio',
        stats: `<div class="stat wide" style="${U.pal('#d94f8a')}"><span class="lbl" id="picName">🎨</span><div class="meterbar" style="--m1:#ffe36e;--m2:#ff8a3d"><i id="pbar"></i><b id="ptxt"></b></div></div>
          <div class="stat" style="${U.pal('#8b5cf6')}"><span class="lbl">🖼️ ציורים שהושלמו</span><span class="val" id="count">0</span></div>`,
        stage: `<div class="pt-splats"><i></i><i></i><i></i><i></i><i></i></div>
          <div class="pt-easel"><div class="pt-frame" id="frame"><canvas id="cv"></canvas></div><div class="pt-legs"><i></i><i></i></div></div>
          <aside class="pt-side"><div class="pt-box"><b>🖌️ הציירים</b><div id="top"></div></div><div class="pt-box"><b>🖼️ הגלריה</b><div class="pt-gallery" id="gal"></div></div></aside>
          <div class="pt-reveal" id="reveal"></div>`,
      })) {
        this.pic = null;
        this.pops = new Map();
        this.galIds = null;
        this.size();
        this.loop();
        if (!this.onResize) addEventListener('resize', (this.onResize = () => this.size()));
      }
      this.st = b;
      U.hostTick(st, `${st.players.length} ציירים · כולם ביחד`);
      document.getElementById('picName').textContent = `🎨 ${b.pic.name}`;
      document.getElementById('pbar').style.width = b.pct + '%';
      document.getElementById('ptxt').textContent = b.pct + '%';
      U.countTo(document.getElementById('count'), b.count);
      document.getElementById('top').innerHTML = b.top.map((t, i) => `<div><span>${i + 1}. ${esc(t.name)}</span><em>${t.cells}</em></div>`).join('') || '<div>—</div>';
      // a finished picture: celebrate it, then show the new blank one
      if (this.pic && this.pic.id !== b.pic.id) {
        const fin = b.gallery.find((g) => g.id === this.pic.id);
        if (fin) this.celebrate(fin);
        this.pops.clear();
      } else if (this.pic) {
        const now = performance.now();
        for (let i = 0; i < b.pic.done.length; i++) if (b.pic.done[i] === '1' && this.pic.done[i] !== '1') this.pops.set(i, now + (this.pops.size % 12) * 25);
      }
      if (!this.pic || this.pic.id !== b.pic.id || this.pic.w !== b.pic.w) { this.pic = b.pic; this.size(); }
      this.pic = b.pic;
      const ids = b.gallery.map((g) => g.id).join(',');
      if (ids !== this.galIds) {
        this.galIds = ids;
        const gal = document.getElementById('gal');
        gal.innerHTML = b.gallery.length ? b.gallery.slice().reverse().map(() => '<canvas width="150" height="90"></canvas>').join('') : '<small>עוד אין… בקרוב!</small>';
        b.gallery.slice().reverse().forEach((g, i) => drawThumb(gal.children[i], g));
      }
    },

    size() {
      const cv = document.getElementById('cv');
      const frame = document.getElementById('frame');
      if (!cv || !frame || !this.pic) return;
      const box = frame.parentElement.getBoundingClientRect();
      const cell = Math.max(6, Math.floor(Math.min((box.width - 40) / this.pic.w, (box.height - 70) / this.pic.h)));
      const dpr = Math.min(2, devicePixelRatio || 1);
      cv.style.width = this.pic.w * cell + 'px';
      cv.style.height = this.pic.h * cell + 'px';
      cv.width = this.pic.w * cell * dpr;
      cv.height = this.pic.h * cell * dpr;
      this.cell = cell * dpr;
    },

    loop() {
      const cv = document.getElementById('cv');
      if (!cv) return;
      const step = (now) => {
        if (!cv.isConnected) return;
        this.draw(cv, now);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },

    draw(cv, now) {
      const pic = this.pic;
      if (!pic || !this.cell) return;
      const g = cv.getContext('2d');
      const s = this.cell;
      g.clearRect(0, 0, cv.width, cv.height);
      g.font = `800 ${Math.floor(s * 0.5)}px Heebo, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const showNum = s >= 14;
      for (let i = 0; i < pic.px.length; i++) {
        const x = (i % pic.w) * s;
        const y = Math.floor(i / pic.w) * s;
        if (pic.done[i] === '1') continue;
        g.fillStyle = PAPER;
        g.fillRect(x, y, s, s);
        g.strokeStyle = '#ddd2bf';
        g.lineWidth = 1;
        g.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
        if (showNum) {
          g.fillStyle = '#b7aa92';
          g.fillText(Number(pic.px[i]) + 1, x + s / 2, y + s / 2 + 1);
        }
      }
      // painted cells, the fresh ones popping in
      for (let i = 0; i < pic.px.length; i++) {
        if (pic.done[i] !== '1') continue;
        const x = (i % pic.w) * s;
        const y = Math.floor(i / pic.w) * s;
        const t0 = this.pops.get(i);
        let k = 1;
        if (t0 !== undefined) {
          k = Math.max(0, Math.min(1, (now - t0) / 380));
          if (k >= 1) this.pops.delete(i);
        }
        const sc = k < 1 ? 0.2 + 1.1 * Math.sin(k * Math.PI * 0.62) : 1;
        const w = s * Math.min(1.25, sc);
        g.fillStyle = pic.pal[pic.px[i]];
        g.fillRect(x + (s - w) / 2, y + (s - w) / 2, w, w);
        if (k < 1) {
          g.fillStyle = `rgba(255,255,255,${0.7 * (1 - k)})`;
          g.fillRect(x, y, s, s);
        }
      }
      // cells someone is painting right now glow in their color
      const pulse = 0.55 + 0.45 * Math.sin(now / 220);
      for (const [name, cells] of Object.entries(this.st.rs || {})) {
        g.strokeStyle = U.color(name);
        g.globalAlpha = pulse;
        g.lineWidth = Math.max(2, s * 0.14);
        for (const i of cells) g.strokeRect((i % pic.w) * s + g.lineWidth / 2, Math.floor(i / pic.w) * s + g.lineWidth / 2, s - g.lineWidth, s - g.lineWidth);
        g.globalAlpha = 1;
      }
    },

    celebrate(fin) {
      const rv = document.getElementById('reveal');
      if (!rv) return;
      rv.innerHTML = `<div class="pt-rv-card"><div class="pt-rv-title">🖼️ ציור הושלם!</div><canvas width="${fin.w * 16}" height="${fin.h * 16}"></canvas><div class="pt-rv-name">${esc(fin.name)}</div></div>`;
      drawThumb(rv.querySelector('canvas'), fin);
      U.bump(rv, 'show');
      U.confetti(3000, 120);
      U.sfx('win');
      setTimeout(() => rv.classList.remove('show'), 3600);
    },

    hostEnded(app, st) {
      if (!U.view(app, 'paint-end')) return;
      const r = st.results;
      const done = r.count > 0;
      U.hostResults(app, st, {
        lost: !done && r.pct < 50,
        title: done ? `🖼️ ציירנו ${r.count === 1 ? 'ציור שלם' : `${r.count} ציורים`}!` : `צבענו ${r.pct}% מהציור`,
        sub: 'ציור במספרים · עבודת צוות של כל הכיתה',
        body: `<div class="end-visual pt-end"><div class="pt-end-wall">${(r.gallery.length ? r.gallery : [{ ...r.current, partial: true }]).slice(-3).map(() => '<div class="pt-end-frame"><canvas width="360" height="216"></canvas></div>').join('')}</div></div>`,
        table: U.table(r.players, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
          ['משבצות', (p) => `🖌️ ${p.cells}`],
          ['מושלמים', (p) => `✨ ${p.perfect}`],
          ['נכונות', (p) => p.correct],
        ], 10),
      });
      const pics = r.gallery.length ? r.gallery.slice(-3) : [r.current];
      app.querySelectorAll('.pt-end-frame canvas').forEach((cv, i) => drawThumb(cv, pics[i], r.gallery.length ? null : r.current.done));
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">🖌️ ${you.cells}</span><span class="hchip">🎨 ${you.pct}%</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase === 'paint') {
        if (!ctx.setView('paint' + you.qid + ':' + you.turn)) return true;
        this.painter(app, you, ctx);
        return true;
      }
      if (you.phase === 'painted') {
        if (!ctx.setView('painted' + you.qid + ':' + you.turn)) return true;
        const d = you.paint;
        U.sfx(d.perfect ? 'win' : d.good ? 'good' : 'bad');
        app.innerHTML = `${ctx.topBar()}<div class="act-result">
          <div class="ar-art pt-brush">${Art.covers.paint ? `<svg class="art" viewBox="0 0 160 100">${Art.covers.paint()}</svg>` : ''}</div>
          <div class="ar-big ${d.good ? '' : 'neg'}">+${d.good}</div>
          <div class="ar-title">${d.perfect ? 'צביעה מושלמת! ✨' : d.good ? 'יופי של צביעה!' : 'נגמר הזמן…'}</div>
          <div class="pill">🎨 ${esc(you.picName)} · ${you.pct}%</div></div>`;
        return true;
      }
      return false;
    },

    painter(app, you, ctx) {
      const P = you.patch;
      const mineAt = new Map(P.cells.map((c, k) => [c, P.px[k]]));
      const colors = [...new Set(P.px)].sort((a, b) => a - b);
      let sel = colors[0];
      const painted = new Map(); // cell -> color
      let done = false;
      const cellsHtml = P.win.map((isDone, i) => {
        const cx = P.x0 + (i % P.w);
        const cy = P.y0 + Math.floor(i / P.w);
        const c = cy * P.W + cx;
        const col = P.winPx[i];
        if (isDone) return `<i class="pt-c done" style="--pc:${P.pal[col]}"></i>`;
        if (mineAt.has(c)) return `<b class="pt-c mine" data-c="${c}" data-n="${col}">${col + 1}</b>`;
        return `<i class="pt-c other">${col + 1}</i>`;
      }).join('');
      app.innerHTML = `${ctx.topBar()}
        <div class="timebar"><i style="animation-duration:25000ms"></i></div>
        <div class="phase-title">צבעו לפי המספרים!<small>בחרו צבע וגררו על המשבצות שלו · <span id="cnt">0/${P.cells.length}</span></small></div>
        <div class="p-stage pt-phone"><div class="pt-grid" id="grid" style="--w:${P.w};--h:${P.h}">${cellsHtml}</div></div>
        <div class="pt-pal" id="pal">${colors.map((c) => `<button class="pt-sw" data-n="${c}" style="--pc:${P.pal[c]}"><span>${c + 1}</span></button>`).join('')}</div>`;
      const grid = document.getElementById('grid');
      const pal = document.getElementById('pal');
      const cnt = document.getElementById('cnt');
      const mark = () => {
        pal.querySelectorAll('.pt-sw').forEach((b) => {
          b.classList.toggle('on', Number(b.dataset.n) === sel);
          const left = P.cells.filter((c) => mineAt.get(c) === Number(b.dataset.n) && !painted.has(c)).length;
          b.classList.toggle('empty', !left);
        });
        grid.querySelectorAll('.pt-c.mine').forEach((el) => el.classList.toggle('hint', Number(el.dataset.n) === sel && !painted.has(Number(el.dataset.c))));
      };
      const send = () => {
        if (done) return;
        done = true;
        ctx.act('paint', { cells: [...painted.entries()] });
      };
      const paintAt = (el) => {
        if (done || !el || !el.classList.contains('mine')) return;
        const c = Number(el.dataset.c);
        if (painted.has(c)) return;
        if (Number(el.dataset.n) !== sel) {
          if (el._bad) return;
          el._bad = true;
          U.bump(el, 'bad');
          setTimeout(() => (el._bad = false), 400);
          if (navigator.vibrate) navigator.vibrate(25);
          return;
        }
        painted.set(c, sel);
        el.classList.add('done', 'fresh');
        el.classList.remove('hint');
        el.style.setProperty('--pc', P.pal[sel]);
        U.sfx('pop');
        cnt.textContent = `${painted.size}/${P.cells.length}`;
        mark();
        // the color is finished: hop to the next one that still has squares
        if (!P.cells.some((q) => mineAt.get(q) === sel && !painted.has(q))) {
          const next = colors.find((n) => P.cells.some((q) => mineAt.get(q) === n && !painted.has(q)));
          if (next !== undefined) { sel = next; mark(); }
        }
        if (painted.size === P.cells.length) {
          const r = grid.getBoundingClientRect();
          U.burst(grid, r.width / 2, r.height / 2, ['#ffd23f', '#fff', '#ff4fa3', '#2ee59d'], 20, 130);
          setTimeout(send, 500);
        }
      };
      let down = false;
      grid.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        down = true;
        paintAt(e.target.closest('.pt-c'));
      });
      grid.addEventListener('pointermove', (e) => {
        if (!down) return;
        paintAt(document.elementFromPoint(e.clientX, e.clientY)?.closest('.pt-c'));
      });
      const up = () => (down = false);
      addEventListener('pointerup', up);
      addEventListener('pointercancel', up);
      pal.onclick = (e) => {
        const b = e.target.closest('.pt-sw');
        if (!b) return;
        sel = Number(b.dataset.n);
        U.sfx('tick');
        mark();
      };
      mark();
      setTimeout(() => { if (grid.isConnected) send(); }, 25000);
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results;
      const mine = r.players.find((p) => p.name === you.name) || { cells: 0, perfect: 0, correct: 0 };
      return U.playerResult({
        win: r.count > 0,
        title: r.count > 0 ? `ציירנו ${r.count === 1 ? 'ציור שלם' : `${r.count} ציורים`}!` : `צבענו ${r.pct}% מהציור`,
        big: `${mine.cells}`,
        bigLabel: 'משבצות שצבעתם',
        lines: [`✨ ${mine.perfect} צביעות מושלמות`, `✅ ${mine.correct} תשובות נכונות`],
      });
    },
  };
})();
