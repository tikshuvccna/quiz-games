// Client side of "טיל לירח": the class rocket climbing to the moon on the host, a Simon memory game on the phone.
(function () {
  const { esc } = U;
  const PADS = ['#e9334f', '#1f73e0', '#e6a400', '#23a14a'];
  const MARKS = [
    { at: 0.25, icon: '☁️', label: 'עננים' },
    { at: 0.5, icon: '🌌', label: 'חלל' },
    { at: 0.75, icon: '🛰️', label: 'תחנת חלל' },
    { at: 1, icon: '🌕', label: 'הירח' },
  ];
  const mix = (a, b, k) => {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const c = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k));
    return `rgb(${c.join(',')})`;
  };

  Games.rocket = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'rocket',
        cls: 'launch',
        stats: `<div class="stat wide" style="${U.pal('#3b2a90')}"><span class="lbl">🚀 הדרך לירח</span><div class="meterbar" style="--m1:#ffe36e;--m2:#ff8a3d"><i id="pbar"></i><b id="ptxt"></b></div></div><div class="stat" style="${U.pal('#ff4fa3')}"><span class="lbl">⛽ ממלא/ת הדלק</span><span class="val small" id="lead">—</span></div>`,
        stage: `<div class="rk-sky" id="sky"></div><div class="rk-stars" id="stars"></div>
          <div class="rk-moon" id="moon">${Art.moon()}</div>
          <div class="rk-clouds" id="clouds"><i></i><i></i><i></i><i></i><i></i></div>
          <div class="rk-ground" id="ground"></div>
          <div class="rk-ship" id="ship"><div class="rk-trail"></div>${Art.rocket()}</div>
          <div class="rk-gauge"><div class="rk-track"><i id="gfill"></i>${MARKS.map((m) => `<span class="rk-mark" style="bottom:${m.at * 100}%"><em>${m.icon}</em><small>${m.label}</small></span>`).join('')}<b class="rk-me" id="gme">🚀</b></div></div>
          <div class="topshoot rk-top" id="top"></div>`,
      })) {
        this.seen = b.ev.length ? b.ev[b.ev.length - 1].id : 0;
      }
      const p = Math.min(1, b.alt / b.goal);
      U.hostTick(st, `${st.players.length} אסטרונאוטים · כולם ביחד`);
      document.getElementById('pbar').style.width = p * 100 + '%';
      document.getElementById('ptxt').textContent = Math.round(p * 100) + '%';
      document.getElementById('gfill').style.height = p * 100 + '%';
      document.getElementById('gme').style.bottom = p * 100 + '%';
      const lead = document.getElementById('lead');
      const leader = b.top[0] && b.top[0].fuel > 0 ? b.top[0].name : '—';
      if (lead.textContent !== leader) { lead.textContent = leader; U.bump(lead); }
      document.getElementById('top').innerHTML = `<b>⛽ צוות הדלק</b>${b.top.map((t, i) => `<div>${i + 1}. ${esc(t.name)} · ${t.fuel}</div>`).join('') || '<div>—</div>'}`;
      // the sky darkens into space, clouds and ground fall away, the moon grows closer
      document.getElementById('sky').style.background = `linear-gradient(180deg, ${mix('#4aa8ff', '#05031a', Math.min(1, p * 1.6))}, ${mix('#bfe6ff', '#1d1060', Math.min(1, p * 1.4))})`;
      document.getElementById('stars').style.opacity = Math.max(0, (p - 0.2) * 1.6);
      document.getElementById('clouds').style.transform = `translateY(${p * 160}%)`;
      document.getElementById('clouds').style.opacity = Math.max(0, 1 - p * 2.2);
      document.getElementById('ground').style.transform = `translateY(${Math.min(100, p * 500)}%)`;
      const moon = document.getElementById('moon');
      moon.style.setProperty('--s', 0.25 + p * 1.1);
      moon.style.setProperty('--y', (1 - p) * -10 + '%');
      const ship = document.getElementById('ship');
      const stage = document.getElementById('stage');
      for (const e of b.ev) {
        if (e.id <= this.seen) continue;
        this.seen = e.id;
        U.bump(ship, e.perfect ? 'boost-big' : 'boost');
        const r = ship.getBoundingClientRect();
        const s = stage.getBoundingClientRect();
        const x = r.left - s.left + r.width / 2 + (Math.random() - 0.5) * 120;
        U.floatText(stage, `+${e.boost} ${e.name}`, x, r.top - s.top + r.height * 0.3, e.perfect ? 'gold' : 'good');
        U.burst(stage, r.left - s.left + r.width / 2, r.bottom - s.top - 10, ['#ffd23f', '#ff7a1a', '#fff'], e.perfect ? 18 : 8, 70);
      }
    },

    hostEnded(app, st) {
      if (!U.view(app, 'rocket-end')) return;
      const r = st.results;
      U.hostResults(app, st, {
        lost: !r.victory,
        title: r.victory ? '🌕 נחתנו על הירח!' : `הגענו ל־${r.pct}% מהדרך`,
        sub: r.victory ? 'משימה הושלמה! כל הכבוד לכל הצוות' : 'בפעם הבאה נגיע עד הירח!',
        body: `<div class="end-visual rk-end ${r.victory ? 'win' : ''}"><div class="rk-end-moon">${Art.moon()}</div><div class="rk-end-ship">${Art.rocket()}</div></div>`,
        table: U.table(r.players, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
          ['דלק', (p) => `⛽ ${p.fuel}`],
          ['רצפים מושלמים', (p) => `✨ ${p.perfect}`],
          ['נכונות', (p) => p.correct],
        ], 10),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">⛽ ${you.fuel}</span><span class="hchip">🚀 ${you.pct}%</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase === 'memory') {
        if (!ctx.setView('memory' + you.qid + ':' + you.turn)) return true;
        this.simon(app, you, ctx);
        return true;
      }
      if (you.phase === 'boosted') {
        if (!ctx.setView('boosted' + you.qid + ':' + you.turn)) return true;
        const bst = you.boost;
        U.sfx(bst.perfect ? 'win' : 'good');
        app.innerHTML = `${ctx.topBar()}<div class="act-result">
          <div class="ar-art rk-launch">${Art.rocket()}</div>
          <div class="ar-big">+${bst.boost}</div>
          <div class="ar-title">${bst.perfect ? 'רצף מושלם! 🔥' : `זכרתם ${bst.right} מתוך ${bst.len}`}</div>
          <div class="pill">🚀 ${you.pct}% מהדרך לירח</div></div>`;
        return true;
      }
      return false;
    },

    simon(app, you, ctx) {
      const seq = you.seq;
      app.innerHTML = `${ctx.topBar()}
        <div class="phase-title" id="sTitle">צפו ברצף…<small>אחר כך חזרו עליו בדיוק</small></div>
        <div class="sm-dots" id="dots">${seq.map(() => '<i></i>').join('')}</div>
        <div class="sm-pads watching" id="pads">${PADS.map((c, i) => `<button class="sm-pad" data-i="${i}" style="--pc:${c}">${Art.shape(i)}</button>`).join('')}</div>`;
      const pads = document.getElementById('pads');
      const btns = [...pads.children];
      const dots = [...document.getElementById('dots').children];
      const flash = (i, ms = 380) => {
        btns[i].classList.add('lit');
        U.sfx('tick');
        setTimeout(() => btns[i].classList.remove('lit'), ms);
      };
      // playback, getting a little faster for long sequences
      const gap = seq.length > 4 ? 520 : 620;
      seq.forEach((v, k) => setTimeout(() => { if (document.body.contains(pads)) flash(v); }, 500 + k * gap));
      const input = [];
      let done = false;
      setTimeout(() => {
        if (!document.body.contains(pads)) return;
        pads.classList.remove('watching');
        document.getElementById('sTitle').innerHTML = 'תורכם! 👆<small>לחצו על הצבעים לפי הסדר</small>';
      }, 500 + seq.length * gap);
      pads.onpointerdown = (e) => {
        const b = e.target.closest('.sm-pad');
        if (!b || done || pads.classList.contains('watching')) return;
        e.preventDefault();
        const v = Number(b.dataset.i);
        flash(v, 200);
        input.push(v);
        const k = input.length - 1;
        if (v !== seq[k]) {
          done = true;
          dots[k].classList.add('bad');
          U.shake(pads);
          U.sfx('bad');
          if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
          setTimeout(() => ctx.act('memory', { seq: input }), 450);
          return;
        }
        dots[k].classList.add('ok');
        if (input.length === seq.length) {
          done = true;
          const r = pads.getBoundingClientRect();
          U.burst(pads, r.width / 2, r.height / 2, ['#ffd23f', '#fff', '#2ee59d'], 18, 120);
          setTimeout(() => ctx.act('memory', { seq: input }), 350);
        }
      };
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results;
      const mine = r.players.find((p) => p.name === you.name) || { fuel: 0, perfect: 0, correct: 0 };
      return U.playerResult({
        win: r.victory,
        title: r.victory ? 'נחתנו על הירח!' : `הגענו ל־${r.pct}% מהדרך`,
        big: `${mine.fuel}`,
        bigLabel: 'דלק שהבאתם',
        lines: [`✨ ${mine.perfect} רצפים מושלמים`, `✅ ${mine.correct} תשובות נכונות`],
      });
    },
  };
})();
