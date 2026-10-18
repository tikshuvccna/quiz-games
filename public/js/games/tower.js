// Client side of "מגדל השמיים": sunset skyline of player towers, crane-drop timing game on the phone.
(function () {
  const { esc } = U;
  const hue = (s) => U.hash(s) % 360;

  Games.tower = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'tower',
        cls: 'sunset',
        stats: `<div class="stat" style="${U.pal('#8b5cf6')}"><span class="lbl">🏗️ המגדל הגבוה</span><span class="val small" id="lead">—</span></div><div class="stat" style="${U.pal('#ff8a3d')}"><span class="lbl">קומות</span><span class="val" id="top">0</span></div>`,
        stage: `<div class="sun big"></div><div class="cloud c1"></div><div class="cloud c2"></div>
          <svg class="city" viewBox="0 0 1200 160" preserveAspectRatio="none"><path d="M0 160 V110 h40 v-30 h30 v40 h30 v-70 h50 v60 h20 v-20 h40 v50 h30 v-90 h40 v70 h40 v-40 h30 v60 h50 v-100 h40 v80 h30 v-50 h40 v70 h40 v-30 h30 v-50 h50 v90 h40 v-60 h30 v40 h40 v-80 h40 v90 h30 v-40 h40 v60 h40 V160Z" fill="#3b2470" opacity=".55"/></svg>
          <div class="skyline" id="sky"></div><div class="street"></div>`,
      })) this.prev = new Map();
      U.hostTick(st, `${b.total} בונים · כל אחד לעצמו`);
      const leader = b.ranking[0] && b.ranking[0].floors > 0 ? b.ranking[0].name : '—';
      const lead = document.getElementById('lead');
      if (lead.textContent !== leader) { lead.textContent = leader; U.bump(lead); }
      U.countTo(document.getElementById('top'), b.ranking[0] ? b.ranking[0].floors : 0);
      const sky = document.getElementById('sky');
      const maxF = Math.max(10, ...b.ranking.map((r) => r.floors));
      sky.style.setProperty('--max', maxF);
      const keep = new Set();
      b.ranking.forEach((r, i) => {
        keep.add(r.name);
        let col = sky.querySelector(`[data-name="${CSS.escape(r.name)}"]`);
        if (!col) {
          col = document.createElement('div');
          col.className = 'tw-col';
          col.dataset.name = r.name;
          col.innerHTML = `<div class="tstack"><div class="tcrown">${Art.item('crown')}</div><div class="tnum"></div><div class="troof"></div><div class="tbody"></div></div><div class="tname">${esc(r.name)}</div>`;
          col.style.setProperty('--h', hue(r.name));
          sky.appendChild(col);
        }
        col.style.order = i;
        col.style.setProperty('--f', r.floors);
        col.classList.toggle('first', i === 0 && r.floors > 0);
        col.querySelector('.tnum').textContent = r.floors;
        const before = this.prev.get(r.name);
        if (before !== undefined && r.floors !== before) {
          U.bump(col.querySelector('.tstack'), r.floors > before ? 'grow' : 'wobble');
          const cr = col.getBoundingClientRect();
          const sr = sky.getBoundingClientRect();
          const top = col.querySelector('.troof').getBoundingClientRect();
          U.floatText(sky, r.floors > before ? `+${r.floors - before}` : `-${before - r.floors}`, cr.left - sr.left + cr.width / 2, top.top - sr.top - 20, r.floors > before ? 'good' : 'bad');
          if (r.floors < before) U.burst(sky, cr.left - sr.left + cr.width / 2, top.top - sr.top + 20, ['#ff9a6b', '#fff', '#8a5226'], 10, 60);
        }
        this.prev.set(r.name, r.floors);
      });
      [...sky.children].forEach((c) => { if (!keep.has(c.dataset.name)) c.remove(); });
    },

    hostEnded(app, st) {
      if (!U.view(app, 'tower-end')) return;
      const r = st.results.players;
      U.hostResults(app, st, {
        title: r[0] ? `${esc(r[0].name)} בנה/תה הכי גבוה!` : 'סוף המשחק',
        sub: 'מגדל השמיים',
        body: `<div class="end-visual">${U.podium(r.slice(0, 3).map((p) => ({ name: p.name, value: p.floors, unit: 'קומות' })))}</div>`,
        table: U.table(r, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
          ['קומות', (p) => `🏗️ ${p.floors}`],
          ['מושלמות', (p) => `✨ ${p.perfects}`],
          ['נכונות', (p) => p.correct],
        ]),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">🏗️ ${you.floors}</span><span class="hchip">#${you.rank}</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase === 'drop') {
        if (!ctx.setView('drop' + you.qid + ':' + you.turn)) return true;
        const h = hue(you.name);
        const shown = Math.min(you.floors, 4);
        app.innerHTML = `${ctx.topBar()}
          <div class="phase-title">עצרו את הבלוק מעל המגדל!<small>באמצע בדיוק = 2 קומות</small></div>
          <div class="crane" id="crane" style="--h:${h}">
            <div class="crane-beam"></div>
            <div class="swing" id="swing"><div class="cable"></div><div class="hook"></div><div class="blk" id="blk"><i></i><i></i><i></i></div></div>
            <div class="target"></div>
            <div class="my-tower" style="--n:${shown}">${'<div class="floor"><i></i><i></i><i></i></div>'.repeat(shown)}<div class="ground-slab"></div></div>
            <div class="floors-badge">🏗️ ${you.floors}</div>
          </div>
          <button class="btn big" id="dropBtn">הניחו! ⬇</button>`;
        const swing = document.getElementById('swing');
        const crane = document.getElementById('crane');
        const stop = U.sway((v) => (swing.style.left = `${8 + v * 84}%`), you.speed);
        let done = false;
        const fire = (e) => {
          if (e) e.preventDefault();
          if (done) return;
          done = true;
          const v = stop();
          const acc = U.accuracy(v);
          
          const blk = document.getElementById('blk');
          const top = crane.querySelector('.my-tower').getBoundingClientRect().top;
          blk.style.setProperty('--dy', top - blk.getBoundingClientRect().bottom + 'px');
          crane.classList.add('dropping', acc >= 0.88 ? 'perfect' : acc >= 0.5 ? 'ok' : 'miss');
          U.sfx(acc >= 0.5 ? 'pop' : 'bad');
          if (navigator.vibrate) navigator.vibrate(15);
          setTimeout(() => {
            if (acc >= 0.88) { const r = crane.getBoundingClientRect(); U.burst(crane, r.width / 2, r.height * 0.55, ['#ffd23f', '#fff', '#2ee59d'], 16, 90); U.sfx('good'); }
            if (acc < 0.5) U.shake(crane);
          }, 380);
          setTimeout(() => ctx.act('drop', { acc }), 450);
        };
        document.getElementById('dropBtn').onpointerdown = fire;
        crane.onpointerdown = fire;
        return true;
      }
      if (you.phase === 'dropped') {
        if (!ctx.setView('dropped' + you.qid + ':' + you.turn)) return true;
        const d = you.drop;
        app.innerHTML = `${ctx.topBar()}<div class="act-result">
          <div class="ar-art mini-tower ${d.gain ? '' : 'fall'}" style="--h:${hue(you.name)}">${'<div class="floor"><i></i><i></i><i></i></div>'.repeat(Math.min(5, Math.max(1, you.floors)))}</div>
          <div class="ar-big ${d.gain ? '' : 'neg'}">${d.perfect ? '+2' : d.gain ? '+1' : '0'}</div>
          <div class="ar-title">${d.perfect ? 'מושלם! ✨' : d.gain ? 'קומה חדשה!' : 'הבלוק נפל…'}</div>
          <div class="pill">🏗️ ${you.floors} קומות · מקום ${you.rank}</div></div>`;
        return true;
      }
      return false;
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results.players;
      const idx = r.findIndex((p) => p.name === you.name);
      const mine = r[idx] || { floors: 0, perfects: 0, correct: 0 };
      return U.playerResult({
        win: idx === 0,
        title: idx === 0 ? 'המגדל הגבוה ביותר!' : idx < 3 ? 'על הפודיום!' : 'כל הכבוד!',
        big: `${mine.floors}`,
        bigLabel: 'קומות',
        lines: [`🏅 מקום ${idx + 1} מתוך ${r.length}`, `✨ ${mine.perfects} הנחות מושלמות`, `✅ ${mine.correct} תשובות נכונות`],
      });
    },
  };
})();
