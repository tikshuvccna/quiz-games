// Small helpers + registry shared by the host and player pages.
window.Games = {};
window.U = {
  esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  // true the first time `name` is shown in `el` (caller then builds the DOM)
  view(el, name) {
    const fresh = el.dataset.view !== name;
    el.dataset.view = name;
    if (fresh) el.dataset.last = 0;
    return fresh;
  },
  mmss: (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,

  // darken (f<1) or lighten (f>1) a #rrggbb color
  shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f))));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  },

  // give an element --c1/--c/--side color vars from one base color
  palette(el, hex) {
    el.style.setProperty('--c1', U.shade(hex, 1.25));
    el.style.setProperty('--c', hex);
    el.style.setProperty('--side', U.shade(hex, 0.55));
  },
  pal: (hex) => `--c1:${U.shade(hex, 1.25)};--c:${hex};--side:${U.shade(hex, 0.55)}`,

  hash: (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7),
  // a pleasant, stable color per player name
  color(name) {
    const P = ['#ff5a5f', '#ff8a3d', '#ffc83d', '#2ee59d', '#22c7e8', '#3b8eff', '#8b5cf6', '#ff4fa3', '#14b8a6', '#f472b6', '#a3e635', '#fb7185'];
    return P[U.hash(name) % P.length];
  },
  // player photos (name → url), filled from the room state; a photo replaces the letter
  photos: {},
  avatar(name, color) {
    const c = color || U.color(name);
    const ph = U.photos[name];
    if (ph) return `<span class="avatar ph" style="--av:${c};background-image:url('${U.esc(ph)}')"></span>`;
    return `<span class="avatar" style="--av:${c}">${U.esc([...String(name).trim()][0] || '?')}</span>`;
  },
  // a short message at the top of the screen
  toast(text) {
    const t = document.createElement('div');
    t.className = 'top-toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3600);
  },

  // ---------- timing mini-games ----------
  // Oscillating 0..1 value (triangle wave). Returns stop(): the value at stop time.
  sway(onFrame, hz) {
    const t0 = performance.now();
    let raf = 0;
    let stopped = false;
    const at = (now) => {
      const ph = (((now - t0) / 1000) * hz) % 1;
      return ph < 0.5 ? ph * 2 : 2 - ph * 2;
    };
    const loop = (now) => {
      if (stopped) return;
      onFrame(at(now));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      return at(performance.now());
    };
  },
  // accuracy 0..1 from a sway value (1 = dead center)
  accuracy: (pos) => 1 - Math.abs(pos - 0.5) * 2,

  // ---------- juice ----------
  // re-trigger a CSS animation class
  bump(el, cls = 'bump') {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  },
  shake(el, strong) {
    U.bump(el, strong ? 'shake-hard' : 'shake');
  },
  // animate a number from its current value to `to`
  countTo(el, to, ms = 600) {
    if (!el) return;
    const from = Number(el.dataset.n || 0);
    to = Number(to) || 0;
    el.dataset.n = to;
    if (from === to) return void (el.textContent = to);
    if (el._raf) cancelAnimationFrame(el._raf);
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (k < 1) el._raf = requestAnimationFrame(step);
    };
    el._raf = requestAnimationFrame(step);
    if (to > from) U.bump(el, 'tick-up');
  },
  // floating text (+5, -12 …) at a point inside `host`
  floatText(host, text, x, y, cls = '') {
    if (!host) return;
    const d = document.createElement('div');
    d.className = 'float-text ' + cls;
    d.textContent = text;
    d.style.left = x + (typeof x === 'number' ? 'px' : '');
    d.style.top = y + (typeof y === 'number' ? 'px' : '');
    host.appendChild(d);
    setTimeout(() => d.remove(), 1200);
  },
  // little particle burst at a point inside `host` (absolute positioned)
  burst(host, x, y, colors = ['#ffd23f', '#ff4fa3', '#22c7e8', '#2ee59d'], n = 14, spread = 90) {
    if (!host) return;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.className = 'particle';
      const a = Math.random() * Math.PI * 2;
      const d = spread * (0.4 + Math.random() * 0.8);
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.setProperty('--dx', Math.cos(a) * d + 'px');
      p.style.setProperty('--dy', Math.sin(a) * d + 'px');
      p.style.setProperty('--pc', colors[i % colors.length]);
      p.style.setProperty('--ps', 6 + Math.random() * 8 + 'px');
      host.appendChild(p);
      setTimeout(() => p.remove(), 900);
    }
  },
  // full-screen confetti (canvas), self-removing
  confetti(ms = 4200, amount = 160) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = document.createElement('canvas');
    cv.className = 'confetti';
    document.body.appendChild(cv);
    const g = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = (cv.width = innerWidth * dpr);
    const H = (cv.height = innerHeight * dpr);
    const C = ['#ffd23f', '#ff4fa3', '#22c7e8', '#2ee59d', '#8b5cf6', '#ff7a1a', '#ffffff'];
    const bits = Array.from({ length: amount }, (_, i) => ({
      x: W * (i % 2 ? 0.1 + Math.random() * 0.2 : 0.7 + Math.random() * 0.2),
      y: H * (0.55 + Math.random() * 0.2),
      vx: (Math.random() - 0.5) * 14 * dpr + (i % 2 ? 6 : -6) * dpr,
      vy: -(14 + Math.random() * 14) * dpr,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      w: (6 + Math.random() * 8) * dpr,
      h: (8 + Math.random() * 10) * dpr,
      c: C[i % C.length],
    }));
    const t0 = performance.now();
    const loop = (now) => {
      const t = now - t0;
      g.clearRect(0, 0, W, H);
      for (const b of bits) {
        b.vy += 0.42 * dpr;
        b.vx *= 0.99;
        b.x += b.vx;
        b.y += b.vy;
        b.r += b.vr;
        g.save();
        g.translate(b.x, b.y);
        g.rotate(b.r);
        g.scale(1, Math.cos(b.r * 3));
        g.globalAlpha = Math.max(0, 1 - Math.max(0, t - ms + 900) / 900);
        g.fillStyle = b.c;
        g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        g.restore();
      }
      if (t < ms) requestAnimationFrame(loop);
      else cv.remove();
    };
    requestAnimationFrame(loop);
  },

  // ---------- sound (WebAudio blips; off by default, only after a user gesture) ----------
  sound: {
    on: (() => { try { return localStorage.getItem('qg-sound') === '1'; } catch { return false; } })(),
    ctx: null,
    toggle() {
      this.on = !this.on;
      try { localStorage.setItem('qg-sound', this.on ? '1' : '0'); } catch {}
      if (this.on) this.unlock();
      document.querySelectorAll('.sound-btn').forEach((b) => (b.innerHTML = Art.sound(this.on)));
      if (this.on) U.sfx('pop');
    },
    unlock() {
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch {}
    },
  },
  sfx(name) {
    const S = U.sound;
    if (!S.on || !S.ctx || S.ctx.state !== 'running') return;
    const ctx = S.ctx;
    const tone = (f, t, d, type = 'sine', v = 0.12, f2) => {
      const o = ctx.createOscillator();
      const gn = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, ctx.currentTime + t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, ctx.currentTime + t + d);
      gn.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gn.gain.exponentialRampToValueAtTime(v, ctx.currentTime + t + 0.01);
      gn.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + d);
      o.connect(gn).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + d + 0.02);
    };
    const fx = {
      pop: () => tone(660, 0, 0.08, 'triangle', 0.1, 990),
      tick: () => tone(880, 0, 0.07, 'square', 0.04),
      go: () => { tone(523, 0, 0.12, 'triangle'); tone(784, 0.1, 0.25, 'triangle'); },
      good: () => { tone(660, 0, 0.1, 'triangle'); tone(990, 0.08, 0.18, 'triangle'); },
      bad: () => tone(220, 0, 0.25, 'sawtooth', 0.06, 140),
      coin: () => { tone(988, 0, 0.06, 'square', 0.05); tone(1319, 0.05, 0.12, 'square', 0.05); },
      boom: () => tone(160, 0, 0.35, 'sawtooth', 0.08, 50),
      win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.1)),
    };
    try { (fx[name] || fx.pop)(); } catch {}
  },
  soundBtn() {
    return `<button class="sound-btn" type="button" title="צלילים" aria-label="צלילים">${Art.sound(U.sound.on)}</button>`;
  },

  // ---------- ×2 / ×3 / ×4 splash (Kahoot-style "double points") ----------
  multSplash(host, points, big = true) {
    if (!host || !(points >= 2)) return;
    const LABEL = { 2: 'ניקוד כפול!', 3: 'ניקוד משולש!', 4: 'ניקוד מרובע!' };
    const d = document.createElement('div');
    d.className = `mult-splash m${points} ${big ? 'big' : ''}`;
    d.innerHTML = `<div class="ms-rays"></div><div class="ms-badge"><b>×${points}</b></div><div class="ms-label">${LABEL[points] || ''}</div>`;
    host.appendChild(d);
    setTimeout(() => {
      const r = d.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      U.burst(host, r.left - hr.left + r.width / 2, r.top - hr.top + r.height / 2, ['#ffd23f', '#ff4fa3', '#22c7e8', '#2ee59d', '#fff'], big ? 34 : 18, big ? 260 : 140);
      U.sfx('win');
    }, 420);
    setTimeout(() => d.remove(), 2300);
  },

  // ---------- 3 · 2 · 1 · GO overlay ----------
  countdown(msLeft, sub = '') {
    let ov = document.getElementById('countdown');
    if (ov) return;
    ov = document.createElement('div');
    ov.id = 'countdown';
    ov.className = 'countdown';
    ov.innerHTML = `<div class="cd-rays"></div><div class="cd-num" id="cdNum"></div><div class="cd-sub">${sub}</div>`;
    document.body.appendChild(ov);
    const end = performance.now() + msLeft;
    let shown = null;
    const step = () => {
      if (!ov.isConnected) return;
      const left = end - performance.now();
      const n = left > 2800 ? 3 : left > 1800 ? 2 : left > 800 ? 1 : 0;
      if (n !== shown) {
        shown = n;
        const el = ov.querySelector('#cdNum');
        el.textContent = n ? n : 'יאללה!';
        el.classList.toggle('go', !n);
        U.bump(el, 'cd-pop');
        U.sfx(n ? 'tick' : 'go');
      }
      if (left > 0) requestAnimationFrame(step);
      else {
        ov.classList.add('out');
        setTimeout(() => ov.remove(), 450);
      }
    };
    requestAnimationFrame(step);
  },
  clearCountdown() {
    const ov = document.getElementById('countdown');
    if (ov) ov.remove();
  },

  // ---------- host game frame ----------
  // Builds the standard host layout once; returns true when it was (re)built.
  hostFrame(app, st, { id, stats = '', stage = '', cls = '' }) {
    if (!U.view(app, id)) return false;
    app.className = 'screen host-game';
    app.innerHTML = `
      <header class="hg-top">
        <div class="hg-brand"><div class="hg-cover">${Art.cover(st.gameId)}</div><div><b>${U.esc(st.gameTitle)}</b><small id="hgSub"></small></div></div>
        <div class="hg-stats">${stats}</div>
        <div class="hg-teams" id="hgTeams"></div>
        <div class="hg-join" id="hgJoin"></div>
        <div class="hg-timer" id="hgTimer"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" class="trk"/><circle cx="22" cy="22" r="19" class="prg" id="hgRing"/></svg><span id="hgLeft"></span></div>
        <button class="hg-players" id="plBtn" title="שחקנים: שינוי שם והסרה" aria-label="שחקנים">👥</button>
        <button class="hg-end" id="endBtn" title="סיום משחק">סיום</button>
      </header>
      <main class="hg-stage ${cls}" id="stage">${stage}</main>
      <div class="feed" id="feed"></div>`;
    document.getElementById('plBtn').onclick = () => window.openPlayersPanel && window.openPlayersPanel();
    document.getElementById('endBtn').onclick = () => { if (confirm('לסיים את המשחק עכשיו?')) socket.emit('host:end'); };
    return true;
  },
  hostTick(st, sub) {
    const left = st.left;
    const total = (st.settings && st.settings.duration) || 300;
    const el = document.getElementById('hgLeft');
    if (el) el.textContent = U.mmss(left);
    const ring = document.getElementById('hgRing');
    if (ring) ring.style.strokeDashoffset = String(119.4 * (1 - left / total));
    const t = document.getElementById('hgTimer');
    if (t) t.classList.toggle('low', left <= 15);
    const s = document.getElementById('hgSub');
    if (s && sub !== undefined) s.textContent = sub;
    const f = document.getElementById('feed');
    if (f && st.board) U.feed(f, st.board.feed, st.board.teams);
    // individual game played in teams: live team totals
    const tbox = document.getElementById('hgTeams');
    if (tbox && st.teamScores) {
      if (tbox.childElementCount !== st.teamScores.length) {
        tbox.innerHTML = st.teamScores.map((t, i) => `<div class="tpill" style="${U.pal(t.color)}">${Art.mascot(i)}<span class="tp-n">${U.esc(t.name)}</span><b id="tps${i}">0</b></div>`).join('');
      }
      const best = Math.max(...st.teamScores.map((t) => t.score));
      st.teamScores.forEach((t, i) => {
        U.countTo(document.getElementById('tps' + i), t.score);
        tbox.children[i].classList.toggle('lead', t.score === best && best > 0);
      });
    }
  },

  // ---------- results ----------
  // list: [{ name, value, unit, sub, color }] best first
  // two team badges side by side (results)
  // team score badges for the host header (team 0 ends up on the left in RTL)
  teamBadge(i, team, val = 0) {
    return `<div class="tscore" id="t${i}" style="${U.pal(team.color)}">${Art.mascot(i)}<div class="tcol"><span class="tn">${U.esc(team.name)}</span><span class="ts" id="ts${i}">${val}</span><span class="tsub" id="tsub${i}"></span></div></div>`;
  },
  teamBadges(teams, val = 0) {
    const order = teams.map((_, i) => i).reverse();
    return `<div class="tbadges n${teams.length}">${order.map((i, k) => (k ? '<div class="vs">VS</div>' : '') + U.teamBadge(i, teams[i], val)).join('')}</div>`;
  },
  // mark the leading team badge
  teamLead(scores) {
    const best = Math.max(...scores);
    const solo = scores.filter((s) => s === best).length === 1;
    scores.forEach((s, i) => { const el = document.getElementById('t' + i); if (el) el.classList.toggle('lead', solo && s === best); });
  },
  teamsMini(teams, scores, winner, cls = 'mini-teams') {
    return `<div class="${cls} n${teams.length}">${teams.map((_, i) => i).reverse().map((i) => `<div class="tscore ${winner === i ? 'lead' : ''}" style="${U.pal(teams[i].color)}">${Art.mascot(i)}<div class="tcol"><span class="tn">${U.esc(teams[i].name)}</span><span class="ts">${scores[i]}</span></div></div>`).join('')}</div>`;
  },
  podium(list) {
    const order = [1, 0, 2];
    const medal = ['gold', 'silver', 'bronze'];
    return `<div class="podium">${order
      .filter((i) => list[i])
      .map((i) => {
        const p = list[i];
        return `<div class="pod pod-${i + 1}" style="--d:${[0.9, 0.5, 0.2][i]}s">
          <div class="pod-who">${i === 0 ? `<div class="pod-crown">${Art.item('crown')}</div>` : ''}${U.avatar(p.name, p.color)}<b>${U.esc(p.name)}</b></div>
          <div class="pod-block ${medal[i]}"><span class="pod-rank">${i + 1}</span><span class="pod-val">${U.esc(p.value)}</span><span class="pod-unit">${U.esc(p.unit || '')}</span></div>
        </div>`;
      })
      .join('')}</div>`;
  },
  // cols: [[header, (row, i) => html]]
  table(rows, cols, max = 12) {
    return `<div class="res-table"><table><thead><tr>${cols.map(([h]) => `<th>${h}</th>`).join('')}</tr></thead><tbody>
      ${rows.slice(0, max).map((r, i) => `<tr style="--i:${i}">${cols.map(([, f]) => `<td>${f(r, i)}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>`;
  },
  // standard host results page; body = extra html (podium / teams), table html, title
  hostResults(app, st, { title, sub = '', body = '', table = '', lost = false }) {
    const r = st.results || {};
    // an individual game played in teams: the team totals decide who won
    let teamHtml = '';
    if (r.teamScores) {
      const w = r.winnerTeam;
      teamHtml = `<div class="end-teamres"><div class="etr-title">${w >= 0 ? `🏆 ${U.esc(r.teamScores[w].name)} ניצחו!` : '🤝 תיקו בין הקבוצות'}</div>${U.teamsMini(r.teamScores, r.teamScores.map((t) => t.score), w, 'team-final compact')}</div>`;
    }
    app.className = 'screen host-end';
    app.innerHTML = `
      <div class="end-head"><div class="end-trophy">${lost ? Art.star() : Art.trophy()}</div><div><h1 class="end-title">${title}</h1>${sub ? `<div class="end-sub">${sub}</div>` : ''}${r.winText && !lost ? `<div class="end-wintext">${U.esc(r.winText)}</div>` : ''}</div></div>
      <div class="end-body">${teamHtml ? `<div class="end-visual">${teamHtml}${body}</div>` : body}${table ? `<div class="card end-table">${table}</div>` : ''}</div>
      <div class="end-actions">
        <button class="btn green" id="rematch">🔁 סיבוב נוסף (אותו קוד)</button>
        <button class="btn ghost" id="report">📊 דוח שחקנים</button>
        <button class="btn ghost" id="again">משחק חדש</button>
      </div>`;
    document.getElementById('again').onclick = () => window.newGame();
    document.getElementById('rematch').onclick = () => socket.emit('host:rematch', {}, () => {});
    document.getElementById('report').onclick = () => window.showReport && window.showReport();
    if (!lost) setTimeout(() => { U.confetti(); U.sfx('win'); }, 600);
  },
  // standard player results card
  playerResult({ title, big = '', bigLabel = '', lines = [], win = false, extra = '' }) {
    if (win) setTimeout(() => U.confetti(3200, 110), 300);
    return `<div class="pres ${win ? 'win' : ''}">
      <div class="pres-trophy">${win ? Art.trophy() : Art.star()}</div>
      <h1>${title}</h1>${win && U.winText ? `<div class="pres-wintext">${U.esc(U.winText)}</div>` : ''}
      ${big !== '' ? `<div class="pres-big">${big}</div><div class="pres-label">${bigLabel}</div>` : ''}${extra}
      <div class="pres-lines">${lines.map((l) => `<div class="pres-line">${l}</div>`).join('')}</div>
    </div>`;
  },

  // size `frame` to the picture's real proportions inside its parent, so % positions on it are exact
  fitImage(frame, img) {
    const fit = () => {
      if (!frame.isConnected) return removeEventListener('resize', fit);
      const box = frame.parentElement.getBoundingClientRect();
      const nw = img.naturalWidth || 4;
      const nh = img.naturalHeight || 3;
      const s = Math.min(box.width / nw, box.height / nh);
      frame.style.width = nw * s + 'px';
      frame.style.height = nh * s + 'px';
    };
    if (img.complete && img.naturalWidth) fit();
    img.addEventListener('load', fit);
    addEventListener('resize', fit);
  },

  // lobby / page background theme
  applyScene(scene) {
    if (window.Scenes) return Scenes.apply(scene);
    if (document.body.dataset.scene !== scene) document.body.dataset.scene = scene || 'classic';
  },

  // append toasts for feed items we haven't shown yet
  feed(el, list, teams) {
    const last = Number(el.dataset.last || 0);
    for (const f of list || []) {
      if (f.id <= last) continue;
      el.dataset.last = f.id;
      const d = document.createElement('div');
      d.className = 'toast';
      d.textContent = f.text;
      if (teams && f.team >= 0 && teams[f.team]) d.style.setProperty('--tc', teams[f.team].color);
      el.appendChild(d);
      while (el.children.length > 3) el.firstElementChild.remove();
      setTimeout(() => d.remove(), 5200);
    }
  },
};

// sound toggle buttons anywhere on the page; unlock audio on the first gesture
document.addEventListener('click', (e) => {
  if (e.target.closest('.sound-btn')) U.sound.toggle();
});
document.addEventListener('pointerdown', () => { if (U.sound.on) U.sound.unlock(); }, { passive: true });
// iOS: stop double-tap zoom on game controls without blocking scrolling
document.addEventListener('dblclick', (e) => { if (!e.target.closest('input, textarea, select')) e.preventDefault(); }, { passive: false });
// a picture shown after the answer: tap to see it big, tap again to close
document.addEventListener('click', (e) => {
  const p = e.target.closest('.fb-pic');
  if (p) p.classList.toggle('zoomed');
});
