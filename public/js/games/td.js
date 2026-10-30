// Client side of "מגיני הטירה": the whole battle is drawn on the big screen; a reward opens a build map on the phone.
(function () {
  const { esc } = U;
  const COL = { archer: '#4cc38a', cannon: '#555a6e', mage: '#a06bff' };
  const ICON = { archer: '🏹', cannon: '💣', mage: '🔮' };

  const pathD = (path) => path.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');

  // one tower on the map (a stone base, a coloured top and its level)
  function tower(x, y, t, big) {
    const s = big ? 1 : 0.9;
    return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="5" rx="6.5" ry="2.4" fill="rgba(0,0,0,.3)"/>
      <rect x="-4.5" y="-3" width="9" height="8" rx="1.5" fill="#9aa1b8" stroke="#3b3f55" stroke-width=".8"/>
      ${t.type === 'archer' ? `<path d="M-5.5 -3 L0 -10 L5.5 -3Z" fill="${COL.archer}" stroke="#1d5a3c" stroke-width=".8"/>` : t.type === 'cannon' ? `<rect x="-5" y="-7" width="10" height="5" rx="2" fill="${COL.cannon}" stroke="#222" stroke-width=".8"/><circle cx="4" cy="-4.5" r="2" fill="#222"/>` : `<circle cx="0" cy="-7" r="4.2" fill="${COL.mage}" stroke="#4a2a99" stroke-width=".8"/><circle cx="-1.2" cy="-8.2" r="1.2" fill="#fff" opacity=".7"/>`}
      ${Array.from({ length: t.lvl }, (_, i) => `<circle cx="${(i - (t.lvl - 1) / 2) * 3.4}" cy="7.6" r="1.1" fill="#ffd23f"/>`).join('')}</g>`;
  }

  function castle(x, y) {
    return `<g transform="translate(${x} ${y})"><rect x="-9" y="-8" width="18" height="14" fill="#cfd4e6" stroke="#3b3f55" stroke-width="1"/>
      <rect x="-11" y="-14" width="6" height="10" fill="#b9bfd6" stroke="#3b3f55" stroke-width="1"/><rect x="5" y="-14" width="6" height="10" fill="#b9bfd6" stroke="#3b3f55" stroke-width="1"/>
      <path d="M-11 -14 l3 -4 l3 4Z M5 -14 l3 -4 l3 4Z" fill="#d9534f"/><path d="M-3 6 v-7 a3 3 0 0 1 6 0 v7Z" fill="#6a4a2a"/><path d="M0 -8 v-8 l6 2 l-6 2" fill="#ff4d6d" stroke="#3b3f55" stroke-width=".6"/></g>`;
  }

  Art.covers.td = () => `<rect width="160" height="100" fill="#7ed957"/><path d="M-5 30 H70 V70 H150" fill="none" stroke="#c9a66b" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
    <g transform="translate(138 70) scale(1.6)"><rect x="-9" y="-8" width="18" height="14" fill="#cfd4e6" stroke="#3b3f55" stroke-width="1"/><rect x="-11" y="-14" width="6" height="10" fill="#b9bfd6" stroke="#3b3f55" stroke-width="1"/><rect x="5" y="-14" width="6" height="10" fill="#b9bfd6" stroke="#3b3f55" stroke-width="1"/><path d="M-11 -14 l3 -4 l3 4Z M5 -14 l3 -4 l3 4Z" fill="#d9534f"/></g>
    <g transform="translate(40 52) scale(1.8)"><rect x="-4.5" y="-3" width="9" height="8" rx="1.5" fill="#9aa1b8" stroke="#3b3f55" stroke-width=".8"/><path d="M-5.5 -3 L0 -10 L5.5 -3Z" fill="#4cc38a" stroke="#1d5a3c" stroke-width=".8"/></g>
    <circle cx="20" cy="30" r="6" fill="#d9534f" stroke="#fff" stroke-width="2"/><circle cx="94" cy="70" r="6" fill="#d9534f" stroke="#fff" stroke-width="2"/>`;

  Games.td = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'td',
        cls: 'td-room',
        stats: `<div class="stat" style="${U.pal('#ff4d6d')}"><span class="lbl">🏰 חיי הטירה</span><span class="val" id="tdhp">0</span></div><div class="stat" style="${U.pal('#8b5cf6')}"><span class="lbl">⚔️ גל</span><span class="val" id="tdw">0</span></div><div class="stat" style="${U.pal('#2ee59d')}"><span class="lbl">☠️ הובסו</span><span class="val" id="tdk">0</span></div>`,
        stage: `<svg class="td-map" id="tdmap" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid meet"></svg><div class="td-next hidden" id="tdn"></div><div class="td-banner hidden" id="tdb"></div>`,
      })) this.seenWave = 0;
      U.hostTick(st, `${st.players.length} שחקנים · כולם ביחד נגד ${b.waves} גלים`);
      U.countTo(document.getElementById('tdhp'), b.hp);
      U.countTo(document.getElementById('tdk'), b.killed);
      document.getElementById('tdw').textContent = `${b.wave}/${b.waves}`;
      const n = document.getElementById('tdn');
      if (b.next > 0 && b.enemies.length < 3) { n.classList.remove('hidden'); n.textContent = `⚔️ הגל הבא בעוד ${b.next} שניות`; } else n.classList.add('hidden');
      if (b.wave !== this.seenWave && b.wave > 0) {
        this.seenWave = b.wave;
        const bn = document.getElementById('tdb');
        bn.textContent = `⚔️ גל ${b.wave}!`;
        bn.classList.remove('hidden', 'show');
        void bn.offsetWidth;
        bn.classList.add('show');
        U.sfx('boom');
      }
      const end = b.path[b.path.length - 1];
      const SH = { archer: '#ffe066', cannon: '#ff9a3d', mage: '#c9a3ff' };
      document.getElementById('tdmap').innerHTML = `
        <rect width="160" height="90" fill="#7ed957"/><rect y="0" width="160" height="90" fill="#6cc94a" opacity=".35"/>
        <path d="${pathD(b.path)}" fill="none" stroke="#a9834a" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${pathD(b.path)}" fill="none" stroke="#dcc08a" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${pathD(b.path)}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1" stroke-dasharray="3 4" stroke-linecap="round"/>
        ${castle(end[0], end[1] - 3)}
        ${b.slots.map((s, i) => (b.towers[i] ? tower(s[0], s[1], b.towers[i], true) : `<circle cx="${s[0]}" cy="${s[1]}" r="5" fill="rgba(255,255,255,.18)" stroke="#fff" stroke-width=".8" stroke-dasharray="2 2"/>`)).join('')}
        ${b.shots.map((s) => `<line x1="${b.slots[s.from][0]}" y1="${b.slots[s.from][1] - 5}" x2="${s.x}" y2="${s.y}" stroke="${SH[s.type]}" stroke-width="${s.type === 'cannon' ? 1.8 : 1}" stroke-linecap="round"/><circle cx="${s.x}" cy="${s.y}" r="${s.type === 'cannon' ? 4 : 2}" fill="${SH[s.type]}" opacity=".6"/>`).join('')}
        ${b.enemies.map((e) => { const r = e.boss ? 5.2 : 3.1; return `<g transform="translate(${e.x} ${e.y})"><ellipse cy="${r}" rx="${r}" ry="1.4" fill="rgba(0,0,0,.3)"/><circle r="${r}" fill="${e.slow ? '#7fbcff' : e.boss ? '#7a2a8a' : '#d9534f'}" stroke="#2a1020" stroke-width=".8"/><circle cx="${-r * 0.35}" cy="-${r * 0.2}" r="${r * 0.2}" fill="#fff"/><circle cx="${r * 0.35}" cy="-${r * 0.2}" r="${r * 0.2}" fill="#fff"/><rect x="${-r}" y="${-r - 3}" width="${r * 2}" height="1.6" fill="#400"/><rect x="${-r}" y="${-r - 3}" width="${r * 2 * e.hp}" height="1.6" fill="#2ee59d"/></g>`; }).join('')}`;
      if (b.win !== null && b.win !== undefined) {
        const bn = document.getElementById('tdb');
        bn.textContent = b.win ? '🎉 הטירה ניצלה!' : '💔 הטירה נפלה';
        bn.classList.remove('hidden', 'show');
        bn.classList.add('show', 'big');
      }
    },

    hostEnded(app, st) {
      if (!U.view(app, 'td-end')) return;
      const r = st.results;
      U.hostResults(app, st, {
        title: r.win ? 'הטירה ניצלה! 🏰' : 'הטירה נפלה…',
        lost: !r.win,
        sub: `שרדתם ${r.wave} מתוך ${r.waves} גלים · הובסו ${r.killed} מפלצות`,
        body: `<div class="end-visual"><div class="muted" style="text-align:center;font-size:1.4rem">🏰 ${r.hp} חיים נשארו</div></div>`,
        table: U.table(r.players, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
          ['מגדלים', (p) => `🏗️ ${p.built}`],
          ['שדרוגים', (p) => `⬆️ ${p.upgraded}`],
          ['נכונות', (p) => p.correct],
        ]),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">🏰 ${you.hp}</span><span class="hchip">⚔️ ${you.wave}</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase !== 'build') return false;
      if (!ctx.setView('tdb' + you.qid + ':' + you.turn)) return true;
      let kind = 'archer';
      const draw = () => {
        app.innerHTML = `${ctx.topBar()}<div class="timebar"><i style="animation-duration:16000ms"></i></div>
          <div class="phase-title">בנו או שדרגו מגדל<small>בחרו סוג, ואז הקישו על מקום (מגדל קיים ישודרג)</small></div>
          <svg class="td-pmap" viewBox="0 0 160 90"><rect width="160" height="90" fill="#7ed957"/>
            <path d="${pathD(you.path)}" fill="none" stroke="#a9834a" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><path d="${pathD(you.path)}" fill="none" stroke="#dcc08a" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>
            ${castle(you.path[you.path.length - 1][0], you.path[you.path.length - 1][1] - 3)}
            ${you.slots.map((s, i) => `<g class="td-slot ${you.towers[i] && you.towers[i].lvl >= you.max ? 'full' : ''}" data-s="${i}">${you.towers[i] ? tower(s[0], s[1], you.towers[i], true) : `<circle cx="${s[0]}" cy="${s[1]}" r="6" fill="rgba(255,255,255,.3)" stroke="#fff" stroke-width="1" stroke-dasharray="2 2"/>`}<circle cx="${s[0]}" cy="${s[1]}" r="9" fill="transparent"/></g>`).join('')}
          </svg>
          <div class="td-types">${Object.keys(you.types).map((k) => `<button class="td-type ${k === kind ? 'on' : ''}" data-k="${k}"><span>${ICON[k]}</span><b>${esc(you.types[k])}</b></button>`).join('')}</div>
          <button class="btn ghost" id="tdSkip">דלגו</button>`;
        app.querySelector('.td-types').onclick = (e) => { const b = e.target.closest('.td-type'); if (b) { kind = b.dataset.k; U.sfx('tick'); draw(); } };
        let done = false;
        app.querySelector('.td-pmap').onclick = (e) => {
          const sl = e.target.closest('.td-slot');
          if (!sl || done || sl.classList.contains('full')) return;
          done = true;
          U.sfx('pop');
          if (navigator.vibrate) navigator.vibrate(20);
          ctx.act('build', { slot: Number(sl.dataset.s), type: kind });
        };
        app.querySelector('#tdSkip').onclick = () => { if (!done) { done = true; ctx.act('skip'); } };
      };
      draw();
      return true;
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results;
      const mine = r.players.find((p) => p.name === you.name) || { built: 0, upgraded: 0, correct: 0 };
      return U.playerResult({
        win: r.win,
        title: r.win ? 'הטירה ניצלה!' : 'הטירה נפלה, ננסה שוב',
        big: `${r.wave}/${r.waves}`,
        bigLabel: 'גלים',
        lines: [`🏗️ בניתם ${mine.built} מגדלים`, `⬆️ שדרגתם ${mine.upgraded}`, `☠️ הכיתה הביסה ${r.killed} מפלצות`],
      });
    },
  };
})();
