// Client side of "קרב ספינות": two seas on the host with shells flying across, aim-and-fire on the phone.
(function () {
  const { esc } = U;
  const O = Art.O;

  // a ship as long as `size` cells (horizontal; rotate the box for vertical ones)
  const ship = (size, burnt, vertical) => {
    const w = size * 100;
    const hull = burnt ? '#4a4f66' : '#9aa6c2';
    return `<svg class="art fl-ship-art" viewBox="0 0 ${vertical ? `100 ${w}` : `${w} 100`}" preserveAspectRatio="none" aria-hidden="true"><g ${vertical ? 'transform="translate(100 0) rotate(90)"' : ''}>
      <path d="M10 42 H${w - 30} L${w - 6} 50 L${w - 30} 78 H26 C14 78 8 62 10 42Z" fill="${hull}" stroke="${O}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M18 50 H${w - 34}" stroke="#fff" stroke-width="5" opacity=".35" stroke-linecap="round"/>
      <rect x="${w * 0.3}" y="20" width="${Math.max(60, w * 0.28)}" height="26" rx="6" fill="${burnt ? '#3a3e52' : '#e6ecf5'}" stroke="${O}" stroke-width="5"/>
      <rect x="${w * 0.3 + 16}" y="6" width="18" height="20" fill="${burnt ? '#2a2c3a' : '#ff4d6d'}" stroke="${O}" stroke-width="5"/>
      ${size > 2 ? `<circle cx="${w * 0.72}" cy="34" r="10" fill="#5a6280" stroke="${O}" stroke-width="5"/><path d="M${w * 0.72} 34 L${w * 0.72 + 34} 26" stroke="${O}" stroke-width="9" stroke-linecap="round"/>` : ''}
    </g></svg>`;
  };

  function seaHtml(n, id) {
    return `<div class="fl-sea" id="${id}" style="--n:${n}">${Array.from({ length: n * n }, (_, i) => `<i class="fl-c" data-c="${i}"></i>`).join('')}<div class="fl-ships"></div></div>`;
  }

  // paint shots + sunk ships onto a sea element
  function paintSea(el, n, shots, sunk) {
    const cells = el.querySelectorAll('.fl-c');
    shots.forEach((v, i) => {
      const c = cells[i];
      const cls = ['', 'miss', 'hit', 'sunk'][Number(v)] || '';
      if (c.dataset.s !== cls) {
        c.className = 'fl-c ' + cls;
        c.dataset.s = cls;
        c.innerHTML = cls === 'hit' ? '<b class="fl-fire"></b>' : cls === 'miss' ? '<b class="fl-splash"></b>' : '';
      }
    });
    const box = el.querySelector('.fl-ships');
    const key = sunk.map((s) => s.cells[0]).join(',');
    if (box.dataset.k !== key) {
      box.dataset.k = key;
      box.innerHTML = sunk.map((s) => {
        const c0 = Math.min(...s.cells);
        const x = c0 % n;
        const y = Math.floor(c0 / n);
        return `<div class="fl-ship ${s.hor ? '' : 'v'}" style="--x:${x};--y:${y};--s:${s.size}">${ship(s.size, true, !s.hor)}</div>`;
      }).join('');
    }
  }

  const fleetLeft = (sizes) => sizes.map((s) => `<i style="--s:${s}"></i>`).join('');

  Art.covers.fleet = () => `<rect width="160" height="100" fill="#1f6fb8"/>
    ${Array.from({ length: 6 }, (_, y) => Array.from({ length: 10 }, (_, x) => `<rect x="${x * 16}" y="${y * 16 + 4}" width="16" height="16" fill="none" stroke="#5aa8f0" stroke-width=".8" opacity=".6"/>`).join('')).join('')}
    <g transform="translate(18 34) scale(.16 .26)">${Art.inner(ship(4))}</g>
    <g transform="translate(92 62) scale(.14 .22)">${Art.inner(ship(3, true))}</g>
    <circle cx="124" cy="30" r="10" fill="#ffd23f"/><circle cx="124" cy="30" r="6" fill="#ff7a1a"/><path d="M60 82 C70 40 100 20 122 28" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="4 4"/>
    <circle cx="44" cy="82" r="5" fill="none" stroke="#fff" stroke-width="2"/><circle cx="44" cy="82" r="9" fill="none" stroke="#fff" stroke-width="1.5" opacity=".6"/>`;

  Games.fleet = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'fleet',
        cls: 'fl-ocean',
        stats: U.teamBadges(b.teams),
        // team 0's sea on the left, under its badge
        stage: `<div class="fl-waves"></div>${[0, 1].map((t) => `<section class="fl-side s${t}" style="${U.pal(b.teams[t].color)}"><div class="fl-label">${Art.mascot(t)}<span>הצי של ${esc(b.teams[t].name)}</span><span class="fl-left" id="left${t}"></span></div>${seaHtml(b.n, 'sea' + t)}</section>`).join('')}
          <div class="fl-banner" id="banner"></div><div class="fl-shells" id="shells"></div>`,
      })) {
        this.seen = b.ev.length ? b.ev[b.ev.length - 1].id : 0;
        this.flying = [];
      }
      this.b = b;
      b.teams.forEach((_, i) => {
        U.countTo(document.getElementById('ts' + i), b.points[i]);
        document.getElementById('tsub' + i).textContent = `${b.fleets[i]} ציים הושמדו`;
      });
      U.teamLead(b.points);
      U.hostTick(st, `${st.players.length} מלחים · קרב ספינות`);
      let k = 0;
      for (const e of b.ev) {
        if (e.id <= this.seen) continue;
        this.seen = e.id;
        if (e.kind === 'newfleet') {
          this.flying = this.flying.filter((f) => f.target !== e.target);
          U.bump(document.getElementById('sea' + e.target), 'fl-new');
          this.banner(`⚓ צי חדש ל${esc(b.teams[e.target].name)}!`, 'info');
          continue;
        }
        this.flying.push(e);
        setTimeout(() => this.land(e), k++ * 380);
      }
      this.paintAll();
    },

    // the seas as they are, except shots whose shell is still in the air
    paintAll() {
      const b = this.b;
      b.seas.forEach((s, t) => {
        const el = document.getElementById('sea' + t);
        if (!el) return;
        document.getElementById('left' + t).innerHTML = fleetLeft(s.left);
        const shots = [...s.shots];
        let sunk = s.sunk;
        for (const e of this.flying) {
          if (e.target !== t) continue;
          if (e.ship) {
            for (const c of e.ship.cells) shots[c] = '2';
            sunk = sunk.filter((sh) => sh.cells[0] !== e.ship.cells[0]);
          }
          shots[e.cell] = '0';
        }
        paintSea(el, b.n, shots, sunk);
      });
    },

    land(e) {
      const t = e.target;
      const b = this.b;
      const el = document.getElementById('sea' + t);
      const stage = document.getElementById('stage');
      if (!el || !stage || !this.flying.includes(e)) return;
      const cell = el.querySelectorAll('.fl-c')[e.cell];
      const s = stage.getBoundingClientRect();
      const cr = cell.getBoundingClientRect();
      const from = document.getElementById('sea' + (1 - t)).getBoundingClientRect();
      const x0 = from.left - s.left + from.width / 2;
      const y0 = from.top - s.top + from.height * 0.2;
      const x1 = cr.left - s.left + cr.width / 2;
      const y1 = cr.top - s.top + cr.height / 2;
      const shell = document.createElement('div');
      shell.className = 'fl-shell';
      shell.style.setProperty('--tc', b.teams[e.team].color);
      document.getElementById('shells').appendChild(shell);
      const peak = Math.min(y0, y1) - s.height * 0.28;
      const pts = Array.from({ length: 11 }, (_, k) => {
        const u = k / 10;
        const x = x0 + (x1 - x0) * u;
        const y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * peak + u * u * y1;
        return { transform: `translate(${x}px, ${y}px) scale(${1 + Math.sin(u * Math.PI) * 0.6})` };
      });
      U.sfx('pop');
      shell.animate(pts, { duration: 750, easing: 'ease-in' }).onfinish = () => {
        shell.remove();
        this.flying = this.flying.filter((f) => f !== e);
        if (!document.getElementById('sea' + t)) return;
        this.paintAll();
        if (e.res === 'miss') {
          U.burst(stage, x1, y1, ['#fff', '#bfe9ff', '#7cc2ff'], 10, 50);
          this.banner(`💦 החטאה · ${esc(e.name)}`, 'miss');
        } else {
          U.burst(stage, x1, y1, ['#fff35c', '#ff7a1a', '#ff3b3b', '#fff'], e.res === 'sunk' ? 30 : 18, e.res === 'sunk' ? 140 : 80);
          U.shake(el, e.res === 'sunk');
          U.floatText(stage, `+${e.gain}`, x1, y1 - 20, e.res === 'sunk' ? 'gold' : 'good');
          this.banner(e.fleet ? `💥 ${esc(b.teams[e.team].name)} השמידו צי שלם!` : e.res === 'sunk' ? `🚢 טובעת! · ${esc(e.name)}` : `🔥 פגיעה! · ${esc(e.name)}`, e.res === 'sunk' ? 'sunk' : 'hit');
          U.sfx(e.res === 'sunk' ? 'win' : 'boom');
        }
      };
    },

    banner(html, cls) {
      const bn = document.getElementById('banner');
      if (!bn) return;
      bn.innerHTML = html;
      bn.className = 'fl-banner ' + cls;
      U.bump(bn, 'show');
    },

    hostEnded(app, st) {
      if (!U.view(app, 'fleet-end')) return;
      const r = st.results;
      U.hostResults(app, st, {
        title: r.winner < 0 ? 'תיקו!' : `${esc(r.teams[r.winner].name)} שולטים בים!`,
        sub: `קרב ספינות · ${r.fleets[0] + r.fleets[1]} ציים הושמדו`,
        body: `<div class="end-visual tug-end">${U.teamsMini(r.teams, r.points, r.winner, 'team-final')}</div>`,
        table: U.table(r.players, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name, r.teams[p.team].color)}${esc(p.name)}</span>`],
          ['נקודות', (p) => `⭐ ${p.pts}`],
          ['פגיעות', (p) => `🔥 ${p.hits}/${p.shots}`],
          ['הטביעו', (p) => (p.sunk ? `🚢 ${p.sunk}` : '—')],
          ['נכונות', (p) => p.correct],
        ], 10),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">⭐ ${you.pts}</span><span class="hchip">${you.points.join(' : ')}</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase === 'aim') {
        if (!ctx.setView(`aim${you.qid}:${you.turn}:${you.chain}:${you.aimV}`)) return true;
        app.innerHTML = `${ctx.topBar()}
          <div class="timebar"><i style="animation-duration:12000ms"></i></div>
          <div class="phase-title">${you.chain ? '🔥 פגעתם! ירייה נוספת' : 'לאן יורים?'}<small>הים של ${esc(you.enemy.name)} · נשארו: <span class="fl-left inline">${fleetLeft(you.left)}</span></small></div>
          <div class="p-stage fl-phone">${seaHtml(you.n, 'psea')}<div class="fl-cross" id="cross"></div></div>
          <button class="btn big pink" id="fireBtn" disabled>🚀 אש!</button>`;
        const el = document.getElementById('psea');
        paintSea(el, you.n, you.sea, you.sunk);
        const btn = document.getElementById('fireBtn');
        let pick = -1;
        let sent = false;
        el.onclick = (e) => {
          const c = e.target.closest('.fl-c');
          if (!c || sent || c.dataset.s) return;
          el.querySelectorAll('.fl-c.pick').forEach((x) => x.classList.remove('pick'));
          c.classList.add('pick');
          pick = Number(c.dataset.c);
          btn.disabled = false;
          U.sfx('tick');
          if (navigator.vibrate) navigator.vibrate(8);
        };
        btn.onclick = () => {
          if (pick < 0 || sent) return;
          sent = true;
          btn.disabled = true;
          U.sfx('pop');
          ctx.act('fire', { cell: pick });
        };
        return true;
      }
      if (you.phase === 'fired') {
        if (!ctx.setView(`fired${you.qid}:${you.turn}:${you.chain}`)) return true;
        const f = you.fired;
        let el = document.getElementById('psea');
        if (!el) {
          app.innerHTML = `${ctx.topBar()}<div class="phase-title"></div><div class="p-stage fl-phone">${seaHtml(you.n, 'psea')}</div>`;
          el = document.getElementById('psea');
        }
        app.querySelector('.timebar')?.remove();
        document.getElementById('fireBtn')?.remove();
        paintSea(el, you.n, you.sea, you.sunk);
        const cell = el.querySelectorAll('.fl-c')[f.cell];
        U.bump(cell, 'fl-boom');
        const t = app.querySelector('.phase-title');
        t.innerHTML = f.res === 'miss' ? '<span class="bad-t">💦 החטאה…</span>' : `<span class="good-t">${f.fleet ? '💥 השמדתם צי שלם!' : f.res === 'sunk' ? '🚢 הטבעתם ספינה!' : '🔥 פגיעה!'} +${f.gain}</span>${f.res !== 'miss' && you.chain < 2 ? '<small>מקבלים ירייה נוספת…</small>' : ''}`;
        const r = el.getBoundingClientRect();
        const c = cell.getBoundingClientRect();
        if (f.res !== 'miss') U.burst(el, c.left - r.left + c.width / 2, c.top - r.top + c.height / 2, ['#fff35c', '#ff7a1a', '#fff'], f.res === 'sunk' ? 26 : 14, 90);
        U.sfx(f.res === 'miss' ? 'bad' : f.res === 'sunk' ? 'win' : 'boom');
        if (navigator.vibrate) navigator.vibrate(f.res === 'miss' ? 30 : [30, 30, 60]);
        return true;
      }
      return false;
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results;
      const mine = r.players.find((p) => p.name === you.name) || { pts: 0, hits: 0, shots: 0, sunk: 0, correct: 0 };
      const win = r.winner === you.team;
      return U.playerResult({
        win,
        title: r.winner < 0 ? 'תיקו!' : win ? 'הקבוצה שלכם ניצחה!' : 'כמעט! בפעם הבאה',
        extra: U.teamsMini(r.teams, r.points, r.winner),
        lines: [`🔥 ${mine.hits} פגיעות מתוך ${mine.shots} יריות`, `🚢 ${mine.sunk} ספינות הטבעתם`, `✅ ${mine.correct} תשובות נכונות`],
      });
    },
  };
})();
