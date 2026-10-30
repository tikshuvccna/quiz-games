// Client side of "זורקים שטויות": the big screen is a board of players with the pranks flying between them;
// on the phone a prank really changes the question screen (mirror, spin, scrambled letters, oil...).
(function () {
  const { esc } = U;
  const NAMES = { flip: 'מראה', spin: 'סחרור', scramble: 'אותיות מבולבלות', colors: 'צבעים הפוכים', oil: 'שמן על המסך', swap: 'הכול הפוך', shake: 'רעידת אדמה', steal: 'גניבת נקודות' };
  const EMOJI = { flip: '🙃', spin: '🌀', scramble: '🔤', colors: '🎨', oil: '🛢️', swap: '🔃', shake: '💥', steal: '💸' };

  const scrambleText = (s) => s.split(/(\s+)/).map((w) => {
    const a = [...w];
    if (a.length < 3) return w;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.join('');
  }).join('');

  const oilBlobs = () => {
    const el = document.createElement('div');
    el.className = 'pr-oil';
    el.innerHTML = Array.from({ length: 7 }, () => {
      const s = 90 + Math.random() * 130;
      return `<i style="left:${Math.random() * 90 - 5}%;top:${Math.random() * 85}%;width:${s}px;height:${s * (0.7 + Math.random() * 0.5)}px;animation-delay:${(Math.random() * 0.4).toFixed(2)}s"></i>`;
    }).join('');
    // a tap wipes a blob away
    el.onclick = (e) => { if (e.target.tagName === 'I') { e.target.remove(); U.sfx('tick'); } };
    document.body.appendChild(el);
    return el;
  };

  Art.covers.prank = () => `<rect width="160" height="100" fill="#3a1260"/>
    <circle cx="80" cy="50" r="64" fill="#ff4fa3" opacity=".12"/>
    <text x="22" y="44" font-size="34" transform="rotate(-14 22 44)">🙃</text><text x="64" y="40" font-size="40">🤪</text><text x="108" y="46" font-size="32" transform="rotate(16 108 46)">🌀</text>
    <text x="30" y="88" font-size="28" transform="rotate(8 30 88)">🛢️</text><text x="76" y="90" font-size="28">🔤</text><text x="116" y="88" font-size="28" transform="rotate(-10 116 88)">💸</text>`;

  Games.prank = {
    fxTimers: [],
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'prank',
        cls: 'prankroom',
        stats: `<div class="stat" style="${U.pal('#ff4fa3')}"><span class="lbl">🤪 שטויות שנזרקו</span><span class="val" id="npr">0</span></div><div class="stat" style="${U.pal('#8b5cf6')}"><span class="lbl">⭐ מוביל/ה</span><span class="val small" id="lead">—</span></div>`,
        stage: `<div class="pr-bg"></div><div class="pr-grid" id="prgrid"></div><div class="pr-banner" id="prban"></div>`,
      })) {
        this.seen = b.ev.length ? b.ev[b.ev.length - 1].id : 0;
        this.thrown = 0;
        this.cards = new Map();
      }
      U.hostTick(st, `${b.total} שחקנים · כל אחד לעצמו`);
      const lead = document.getElementById('lead');
      const leader = b.players[0] && b.players[0].pts > 0 ? b.players[0].name : '—';
      if (lead.textContent !== leader) { lead.textContent = leader; U.bump(lead); }
      U.countTo(document.getElementById('npr'), b.players.reduce((s, p) => s + p.thrown, 0));

      const grid = document.getElementById('prgrid');
      const names = new Set(b.players.map((p) => p.name));
      for (const [n, el] of this.cards) if (!names.has(n)) { el.remove(); this.cards.delete(n); }
      b.players.forEach((p, i) => {
        let el = this.cards.get(p.name);
        if (!el) {
          el = document.createElement('div');
          el.className = 'pr-card';
          el.innerHTML = `${U.avatar(p.name)}<b>${esc(p.name)}</b><span class="pr-pts">0</span><div class="pr-fx"></div>`;
          grid.appendChild(el);
          this.cards.set(p.name, el);
          U.bump(el, 'drop-in');
        }
        el.style.order = i;
        U.countTo(el.querySelector('.pr-pts'), p.pts);
        el.classList.toggle('shield', p.shield);
        const fx = p.fx.map((k) => EMOJI[k]).join('');
        const fxEl = el.querySelector('.pr-fx');
        if (fxEl.textContent !== fx) fxEl.textContent = fx;
        el.classList.toggle('pranked', p.fx.length > 0);
      });

      const stage = document.getElementById('stage');
      const ban = document.getElementById('prban');
      for (const e of b.ev) {
        if (e.id <= this.seen) continue;
        this.seen = e.id;
        const card = this.cards.get(e.to);
        ban.innerHTML = `<span class="pr-big">${EMOJI[e.prank]}</span><div>${esc(e.from)} ${e.blocked ? 'נחסם/ה על ידי' : `זרק/ה ${NAMES[e.prank]} על`} ${esc(e.to)}</div>`;
        ban.classList.remove('show');
        void ban.offsetWidth;
        ban.classList.add('show');
        if (card) {
          const r = card.getBoundingClientRect();
          const s = stage.getBoundingClientRect();
          const x = r.left - s.left + r.width / 2;
          const y = r.top - s.top + r.height / 2;
          U.bump(card, e.blocked ? 'pr-block' : 'pr-hit');
          U.burst(stage, x, y, e.blocked ? ['#8be0ff', '#fff'] : ['#ff4fa3', '#ffd23f', '#8b5cf6', '#fff'], 20, 140);
          U.floatText(stage, e.blocked ? '🛡️' : EMOJI[e.prank], x, y - 40, e.blocked ? 'good' : 'bad');
        }
        U.sfx(e.blocked ? 'pop' : 'bad');
      }
    },

    hostEnded(app, st) {
      if (!U.view(app, 'prank-end')) return;
      const r = st.results.players;
      U.hostResults(app, st, {
        title: r[0] ? `${esc(r[0].name)} המלך/ה של השטויות!` : 'סוף המשחק',
        sub: 'זורקים שטויות',
        body: `<div class="end-visual">${U.podium(r.slice(0, 3).map((p) => ({ name: p.name, value: p.pts, unit: 'נקודות' })))}</div>`,
        table: U.table(r, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
          ['נקודות', (p) => `⭐ ${p.pts}`],
          ['נזרקו', (p) => `🤪 ${p.thrown}`],
          ['נפגעו', (p) => `🎯 ${p.hit}`],
        ]),
      });
    },

    // ---------- player ----------
    hud(you) {
      setTimeout(() => this.applyFx(you), 0);
      return `<span class="hchip">⭐ ${you.pts}</span>${you.shield ? `<span class="hchip pr-shield">🛡️</span>` : `<span class="hchip">#${you.rank}</span>`}`;
    },

    // pranks are classes on <body> (so they survive the phone redrawing its screen) plus a few DOM tweaks
    applyFx(you) {
      if (!you || you.phase === 'ended') return this.clearFx();
      const keys = (you.fx || []).map((f) => f.k);
      document.body.dataset.fx = keys.join(' ');
      this.fxTimers.forEach(clearTimeout);
      this.fxTimers = (you.fx || []).map((f) => setTimeout(() => this.applyFx({ ...you, fx: you.fx.filter((x) => x !== f && x.left > f.left) }), f.left + 50));
      // scrambled letters: remember the original text, put it back when the prank ends
      const texts = document.querySelectorAll('#app .q-card, #app .ans span, #app .ans b');
      const scr = keys.includes('scramble');
      texts.forEach((t) => {
        if (scr && t.dataset.orig === undefined) { t.dataset.orig = t.textContent; t.textContent = scrambleText(t.textContent); }
        else if (!scr && t.dataset.orig !== undefined) { t.textContent = t.dataset.orig; delete t.dataset.orig; }
      });
      const oil = document.querySelector('.pr-oil');
      if (keys.includes('oil') && !oil) this.oilEl = oilBlobs();
      else if (!keys.includes('oil') && oil) oil.remove();
      // a fresh hit is announced once
      const got = you.got;
      if (got && got.at !== this.lastGot) {
        this.lastGot = got.at;
        this.toast(got.blocked ? `🛡️ חסמתם ${EMOJI[got.k]} של ${got.from}!` : got.k === 'steal' ? `💸 ${got.from} גנב/ה לכם ${got.loss} נקודות!` : `${EMOJI[got.k]} ${got.from} זרק/ה עליכם ${NAMES[got.k]}!`, !got.blocked);
      }
    },

    clearFx() {
      this.fxTimers.forEach(clearTimeout);
      this.fxTimers = [];
      delete document.body.dataset.fx;
      const oil = document.querySelector('.pr-oil');
      if (oil) oil.remove();
    },

    toast(text, bad) {
      const t = document.createElement('div');
      t.className = 'p-toast';
      t.textContent = text;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 2800);
      if (bad) { U.sfx('bad'); if (navigator.vibrate) navigator.vibrate([80, 40, 120]); } else U.sfx('pop');
    },

    playerPhase(app, you, ctx) {
      if (you.phase === 'prank') {
        if (!ctx.setView('prank' + you.qid + ':' + you.turn)) return true;
        app.innerHTML = `${ctx.topBar()}
          <div class="timebar"><i style="animation-duration:${you.pickMs}ms"></i></div>
          <div class="phase-title">1. בחרו שטות<small>${you.turnsLeft > 1 ? `רצף! יש לכם ${you.turnsLeft} זריקות` : '2. בחרו על מי לזרוק'}</small></div>
          <div class="pr-picks">${Object.keys(you.pranks).map((k) => `<button class="pr-pick" data-k="${k}"><span>${you.pranks[k].emoji}</span><b>${esc(you.pranks[k].name)}</b></button>`).join('')}</div>
          <div class="phase-title pr-t2">על מי?</div>
          <div class="pr-targets">${you.targets.map((t) => `<button class="pr-target" data-id="${t.id}">${U.avatar(t.name)}<b>${esc(t.name)}</b><span>${t.shield ? '🛡️' : '⭐ ' + t.pts}</span></button>`).join('')}<button class="pr-target pr-rand" data-id="*">🎲<b>מישהו אקראי</b></button></div>`;
        let kind = null;
        let done = false;
        const picks = app.querySelector('.pr-picks');
        const tg = app.querySelector('.pr-targets');
        picks.onclick = (e) => {
          const b = e.target.closest('.pr-pick');
          if (!b || done) return;
          kind = b.dataset.k;
          picks.querySelectorAll('.pr-pick').forEach((x) => x.classList.toggle('on', x === b));
          app.classList.add('has-kind');
          U.sfx('tick');
        };
        tg.onclick = (e) => {
          const b = e.target.closest('.pr-target');
          if (!b || done) return;
          if (!kind) {
            picks.classList.remove('nudge');
            void picks.offsetWidth;
            picks.classList.add('nudge');
            return;
          }
          done = true;
          let id = b.dataset.id;
          if (id === '*') {
            const all = you.targets;
            id = all[Math.floor(Math.random() * all.length)].id;
          }
          b.classList.add('picked');
          tg.classList.add('locked');
          U.sfx('pop');
          if (navigator.vibrate) navigator.vibrate(20);
          ctx.act('prank', { k: kind, to: id });
        };
        return true;
      }
      if (you.phase === 'sent') {
        if (!ctx.setView('sent' + you.qid + ':' + you.turn)) return true;
        const s = you.sent;
        app.innerHTML = `${ctx.topBar()}<div class="act-result">
          <div class="ar-art pr-fly">${s.blocked ? '🛡️' : EMOJI[s.k]}</div>
          <div class="ar-title">${s.blocked ? `${esc(s.to)} חסם/ה עם מגן!` : `${NAMES[s.k]} על ${esc(s.to)}!`}</div>
          <div class="ar-big">+${s.blocked ? 2 : 5}</div><div class="ar-sub">${s.blocked ? 'לא נורא, ננסה שוב' : 'חחח, הלך עליו/ה 😈'}</div></div>`;
        return true;
      }
      return false;
    },

    onBoard() {},

    playerEnded(app, you) {
      this.clearFx();
      const r = you.results.players;
      const idx = r.findIndex((p) => p.name === you.name);
      const mine = r[idx] || { pts: 0, thrown: 0, hit: 0 };
      return U.playerResult({
        win: idx === 0,
        title: idx === 0 ? 'מלכי השטויות!' : idx < 3 ? 'על הפודיום!' : 'כל הכבוד!',
        big: `${mine.pts}`,
        bigLabel: 'נקודות',
        lines: [`🏅 מקום ${idx + 1} מתוך ${r.length}`, `🤪 ${mine.thrown} שטויות נזרקו`, `🎯 ${mine.hit} פעמים נפגעתם`],
      });
    },
  };
})();
