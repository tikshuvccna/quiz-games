// Client side of "קרב הדרקון": boss fight scene on the host, timing strike meter on phones.
(function () {
  const { esc } = U;

  Games.dragon = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'dragon',
        cls: 'lair',
        stats: `<div class="stat wide boss-stat" style="${U.pal('#c0163d')}"><span class="lbl">🐉 הדרקון</span><div class="meterbar" id="hp" style="--m1:#ff9aa8;--m2:#e5304d"><i></i><b></b></div></div>
          <div class="stat wide crew-stat" style="${U.pal('#1f6fe0')}"><span class="lbl">🛡️ הצוות</span><div class="meterbar" id="crew"><i></i><b></b></div></div>`,
        stage: `<div class="embers"></div><div class="lava"></div>
          <div class="dragon-box" id="dragon">${Art.dragon()}<div class="breath" id="fire"></div></div>
          <div class="heroes" id="heroes"></div>
          <div class="side-board" id="top"></div>
          <div class="rage-banner">🔥 הדרקון זועם! 🔥</div>`,
      })) {
        this.seen = b.ev.length ? b.ev[b.ev.length - 1].id : 0;
        this.heroN = -1;
      }
      const stage = document.getElementById('stage');
      const hp = document.getElementById('hp');
      hp.firstElementChild.style.width = (b.hp / b.maxHp) * 100 + '%';
      hp.lastElementChild.textContent = `${b.hp} / ${b.maxHp}`;
      const crew = document.getElementById('crew');
      crew.firstElementChild.style.width = b.crew + '%';
      crew.lastElementChild.textContent = `${b.crew} / 100`;
      crew.classList.toggle('low', b.crew < 30);
      U.hostTick(st, `${st.players.length} לוחמים · כולם ביחד`);
      stage.classList.toggle('rage', b.rage);
      const n = Math.min(8, Math.max(1, st.players.length));
      if (n !== this.heroN) {
        this.heroN = n;
        const cols = ['#2f80ff', '#2ee59d', '#ff8a3d', '#8b5cf6', '#ff4fa3', '#22c7e8', '#ffd23f', '#f2434f'];
        document.getElementById('heroes').innerHTML = Array.from({ length: n }, (_, i) => `<div class="hero" style="--i:${i}">${Art.knight(cols[i])}</div>`).join('');
      }
      document.getElementById('top').innerHTML = `<h4>⚔️ מובילים בנזק</h4>` + (b.top.map((t, i) => `<div class="sb-row"><span class="rk">${i + 1}</span>${U.avatar(t.name)}<b>${esc(t.name)}</b><span>${t.dmg}</span></div>`).join('') || '<div class="muted">—</div>');
      const dragon = document.getElementById('dragon');
      for (const e of b.ev) {
        if (e.id <= this.seen) continue;
        this.seen = e.id;
        if (e.k === 'atk') {
          U.bump(document.getElementById('fire'), 'go');
          U.bump(dragon, 'roar');
          U.bump(document.getElementById('heroes'), 'burned');
          setTimeout(() => U.shake(stage, true), 350);
          const s = stage.getBoundingClientRect();
          U.floatText(stage, `-${e.dmg} 🛡️`, s.width / 2, s.height * 0.78, 'bad');
          U.sfx('boom');
        } else {
          U.bump(dragon, 'hurt');
          const s = stage.getBoundingClientRect();
          const x = s.width * (0.36 + Math.random() * 0.28);
          const y = s.height * (0.25 + Math.random() * 0.3);
          U.floatText(stage, `-${e.dmg}`, x, y, e.k === 'crit' ? 'gold crit' : '');
          U.burst(stage, x, y, e.k === 'crit' ? ['#fff', '#ffd23f', '#ff4d6d'] : ['#fff', '#ffb347'], e.k === 'crit' ? 18 : 8, e.k === 'crit' ? 120 : 60);
          const slash = document.createElement('i');
          slash.className = 'slash' + (e.k === 'crit' ? ' crit' : '');
          slash.style.left = x + 'px';
          slash.style.top = y + 'px';
          slash.style.setProperty('--rot', -30 + Math.random() * 60 + 'deg');
          stage.appendChild(slash);
          setTimeout(() => slash.remove(), 450);
          if (e.k === 'crit') U.shake(stage);
        }
      }
    },

    hostEnded(app, st) {
      if (!U.view(app, 'dragon-end')) return;
      const r = st.results;
      U.hostResults(app, st, {
        lost: !r.victory,
        title: r.victory ? 'הדרקון הובס!' : 'הדרקון ניצח…',
        sub: r.victory ? 'כל הכבוד ללוחמים!' : `נשארו לו ${r.hp} מתוך ${r.maxHp} חיים`,
        body: `<div class="end-visual"><div class="end-dragon ${r.victory ? 'beaten' : ''}">${Art.dragon()}</div>${U.podium(r.players.slice(0, 3).map((p) => ({ name: p.name, value: p.dmg, unit: 'נזק' })))}</div>`,
        table: U.table(r.players, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
          ['נזק', (p) => `⚔️ ${p.dmg}`],
          ['מכות', (p) => p.hits],
          ['קריטיות', (p) => `💥 ${p.crits}`],
        ]),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">⚔️ ${you.dmg}</span><span class="hchip">🛡️ ${you.crew}</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase === 'strike') {
        if (!ctx.setView('strike' + you.qid + ':' + you.turn)) return true;
        app.innerHTML = `${ctx.topBar()}
          <div class="phase-title">עצרו באמצע למכה קריטית!</div>
          <div class="strike-scene" id="scene"><div class="mini-dragon">${Art.dragon()}</div></div>
          <div class="meter"><div class="zone ok"></div><div class="zone good"></div><div class="zone crit"></div><div class="cursor" id="cur">${Art.sword()}</div></div>
          <button class="btn big pink" id="hit">הכו! ⚔️</button>`;
        const cur = document.getElementById('cur');
        const stop = U.sway((v) => (cur.style.left = v * 100 + '%'), 0.9);
        let done = false;
        const fire = (e) => {
          if (e) e.preventDefault();
          if (done) return;
          done = true;
          const acc = U.accuracy(stop());
          const scene = document.getElementById('scene');
          U.bump(scene.querySelector('.mini-dragon'), 'hurt');
          const r = scene.getBoundingClientRect();
          U.burst(scene, r.width / 2, r.height * 0.45, acc >= 0.9 ? ['#fff', '#ffd23f', '#ff4d6d'] : ['#fff', '#ffb347'], acc >= 0.9 ? 18 : 8, 90);
          if (acc >= 0.9) U.shake(scene, true);
          U.sfx(acc >= 0.9 ? 'boom' : 'pop');
          if (navigator.vibrate) navigator.vibrate(acc >= 0.9 ? [20, 30, 40] : 15);
          setTimeout(() => ctx.act('strike', { acc }), 250);
        };
        document.getElementById('hit').onpointerdown = fire;
        return true;
      }
      if (you.phase === 'struck') {
        if (!ctx.setView('struck' + you.qid + ':' + you.turn)) return true;
        const s = you.struck;
        app.innerHTML = `${ctx.topBar()}<div class="act-result">
          <div class="ar-art">${Art.sword()}</div>
          <div class="ar-big">-${s.dmg}</div><div class="ar-title">${s.crit ? 'מכה קריטית! 💥' : 'פגיעה!'}</div>
          <div class="ar-sub">סה״כ נזק שלכם: ${you.dmg}</div></div>`;
        return true;
      }
      return false;
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results;
      const mine = r.players.find((p) => p.name === you.name) || { dmg: 0, hits: 0, crits: 0 };
      return U.playerResult({
        win: r.victory,
        title: r.victory ? 'הדרקון הובס!' : 'הדרקון ניצח…',
        big: `${mine.dmg}`,
        bigLabel: 'נזק שגרמתם',
        lines: [`⚔️ ${mine.hits} מכות`, `💥 ${mine.crits} מכות קריטיות`],
      });
    },
  };
})();
