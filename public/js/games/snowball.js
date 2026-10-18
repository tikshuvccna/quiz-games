// Client side of "קרב כדורי שלג": winter battlefield on the host, drag-and-release slingshot on the phone.
(function () {
  const { esc } = U;
  // must match server/games/snowball.js
  const XS = [52, 62, 72, 82, 92];
  const SNOW_H = 11;
  const G = 10;
  const VMAX = 36;
  const WORLD = 100; // world units shown across the width (phone)
  const X0 = 14; // phone: room left of the sling for pulling back
  const Y_STRETCH = 1.3; // phone: taller vertical scale so targets are bigger
  const heightAt = (x, angle, power) => {
    const a = (angle * Math.PI) / 180;
    const vx = VMAX * power * Math.cos(a);
    return x * Math.tan(a) - (G * x * x) / (2 * vx * vx);
  };
  // where the ball stops (x) for an animation: the hit snowman, or where it lands
  const stopX = (angle, power, hit) => {
    if (hit >= 0) return XS[hit] - 2.5;
    const a = (angle * Math.PI) / 180;
    return Math.min(WORLD + 8, (Math.pow(VMAX * power, 2) * Math.sin(2 * a)) / G);
  };

  const teamBadge = (i, team) => `<div class="tscore" id="t${i}" style="${U.pal(team.color)}">${Art.mascot(i)}<div class="tcol"><span class="tn">${esc(team.name)}</span><span class="ts" id="ts${i}">5</span><span class="tsub" id="tsub${i}">אנשי שלג עומדים</span></div></div>`;

  // fly a snowball element through `el` along the arc; map(x, y) -> [px, py]
  function fly(el, angle, power, toX, map, ms, onDone) {
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const x = toX * k;
      const y = Math.max(0, heightAt(x, angle, power));
      const [px, py] = map(x, y);
      el.style.transform = `translate(${px}px, ${py}px) rotate(${k * 720}deg)`;
      if (k < 1) requestAnimationFrame(step);
      else onDone && onDone();
    };
    requestAnimationFrame(step);
  }

  Games.snowball = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'snowball',
        cls: 'winter',
        stats: `${teamBadge(1, b.teams[1])}<div class="vs">VS</div>${teamBadge(0, b.teams[0])}`,
        stage: `<svg class="sb-mtn" viewBox="0 0 1200 300" preserveAspectRatio="none"><path d="M0 300 L0 190 L140 80 L230 150 L360 40 L470 140 L560 90 L700 190 L820 60 L930 150 L1040 90 L1200 180 V300Z" fill="#b9d6f2"/><path d="M140 80 L180 112 L160 110 L140 126 L118 108 L104 110Z M360 40 L405 82 L380 78 L360 98 L338 80 L318 84Z M820 60 L864 100 L842 96 L820 114 L798 98 L778 100Z M1040 90 L1076 122 L1056 120 L1040 134 L1022 120 L1006 122Z" fill="#fff"/></svg>
          <div class="sb-trees"></div><div class="snowfall"></div><div class="snowfall s2"></div>
          <svg class="hills" viewBox="0 0 1200 200" preserveAspectRatio="none"><path d="M0 120 C200 50 360 70 520 110 C700 40 900 50 1200 100 V200 H0Z" fill="#e6f2ff"/><path d="M0 160 C240 120 420 130 640 150 C860 120 1000 130 1200 145 V200 H0Z" fill="#f6fbff"/></svg>
          <div class="sb-ground"></div>
          <div class="sb-fort f0" style="--tc:${b.teams[0].color}"></div><div class="sb-fort f1" style="--tc:${b.teams[1].color}"></div>
          <div class="sb-field" id="field"></div>`,
      })) {
        this.seen = b.ev.length ? b.ev[b.ev.length - 1].id : 0;
        this.field = document.getElementById('field');
        this.built = null;
      }
      this.renderSnowmen(b);
      [0, 1].forEach((i) => {
        const standing = b.snow[i].filter((s) => s.hp > 0).length;
        U.countTo(document.getElementById('ts' + i), standing);
        document.getElementById('tsub' + i).textContent = `אנשי שלג עומדים · ${b.size[i]} שחקנים`;
        document.getElementById('t' + i).classList.toggle('lead', standing > b.snow[1 - i].filter((s) => s.hp > 0).length);
      });
      U.hostTick(st, `${st.players.length} שחקנים · קבוצה נגד קבוצה`);
      for (const e of b.ev) {
        if (e.id <= this.seen) continue;
        this.seen = e.id;
        this.throwFx(b, e);
      }
    },

    // team t's snowmen stand on the opposite side from team t's throwers
    // world x for an attacker of team `att` → % of stage width
    pct(att, x) {
      const p = 9 + x * 0.85;
      return att === 0 ? p : 100 - p;
    },

    renderSnowmen(b) {
      if (!this.built) {
        this.built = true;
        this.field.innerHTML = [0, 1].map((t) => b.snow[t].map((s, i) => `<div class="sb-man" id="sm${t}-${i}" style="left:${this.pct(1 - t, XS[i])}%;--tc:${b.teams[t].color}"><div class="sb-hp"><i></i></div><div class="sb-art"></div></div>`).join('')).join('') +
          `<div class="sb-thrower th0">${Art.mascot(0)}</div><div class="sb-thrower th1">${Art.mascot(1)}</div>`;
      }
      [0, 1].forEach((t) => b.snow[t].forEach((s, i) => {
        const el = document.getElementById(`sm${t}-${i}`);
        const down = s.hp <= 0;
        if (el.dataset.down !== String(down)) {
          el.dataset.down = down;
          el.querySelector('.sb-art').innerHTML = Art.snowman(b.teams[t].color, down);
          el.classList.toggle('down', down);
        }
        el.querySelector('.sb-hp i').style.width = (s.hp / s.max) * 100 + '%';
        el.querySelector('.sb-hp').classList.toggle('low', s.hp / s.max < 0.35);
      }));
    },

    throwFx(b, e) {
      const field = this.field;
      if (!field) return;
      const W = field.clientWidth;
      const H = field.clientHeight;
      const ground = H * 0.86;
      const unit = (W * 0.85) / 100;
      const map = (x, y) => [(this.pct(e.team, x) / 100) * W - 14, ground - y * unit - 14];
      const ball = document.createElement('div');
      ball.className = 'sb-ball';
      ball.innerHTML = Art.snowball();
      field.appendChild(ball);
      const toX = stopX(e.angle, e.power, e.hit);
      const tag = document.createElement('div');
      tag.className = 'sb-tag';
      tag.style.left = this.pct(e.team, 2) + '%';
      tag.style.setProperty('--tc', b.teams[e.team].color);
      tag.textContent = e.name;
      field.appendChild(tag);
      setTimeout(() => tag.remove(), 1600);
      U.bump(field.querySelector('.th' + e.team), 'heave');
      fly(ball, e.angle, e.power, toX, map, 850, () => {
        const [px, py] = map(toX, Math.max(0, heightAt(toX, e.angle, e.power)));
        ball.remove();
        U.burst(field, px + 14, py + 14, ['#fff', '#dbeeff', '#bfe3ff'], e.hit >= 0 ? 16 : 8, e.hit >= 0 ? 80 : 40);
        if (e.hit >= 0) {
          const man = document.getElementById(`sm${1 - e.team}-${e.hit}`);
          U.bump(man, e.knocked ? 'topple' : 'wobble');
          U.floatText(field, e.knocked ? 'נפל!' : 'פגיעה!', px + 14, py - 30, e.knocked ? 'gold' : 'good');
          if (e.knocked) U.shake(document.getElementById('stage'));
        }
      });
    },

    hostEnded(app, st) {
      if (!U.view(app, 'snowball-end')) return;
      const r = st.results;
      U.hostResults(app, st, {
        title: r.winner < 0 ? 'תיקו!' : `${esc(r.teams[r.winner].name)} ניצחו!`,
        sub: 'אנשי שלג שהופלו',
        body: `<div class="end-visual tug-end">${U.teamsMini(r.teams, r.knocked, r.winner, 'team-final')}</div>`,
        table: U.table(r.players, [
          ['#', (p, i) => i + 1],
          ['שם', (p) => `<span class="nm">${U.avatar(p.name, r.teams[p.team].color)}${esc(p.name)}</span>`],
          ['פגיעות', (p) => `❄️ ${p.hits}`],
          ['הפלות', (p) => `☃️ ${p.knocks}`],
          ['זריקות', (p) => p.throws],
        ], 10),
      });
    },

    // ---------- player ----------
    hud(you) {
      return `<span class="hchip">❄️ ${you.hits}/${you.throws}</span>`;
    },

    playerPhase(app, you, ctx) {
      if (you.phase === 'throw') {
        if (!ctx.setView('throw' + you.qid + ':' + you.turn)) return true;
        this.buildThrow(app, you, ctx);
        return true;
      }
      if (you.phase === 'thrown') {
        if (!ctx.setView('thrown' + you.qid + ':' + you.turn)) return true;
        const t = you.toss;
        const show = () => {
          const title = app.querySelector('.phase-title');
          if (!title) return;
          title.innerHTML = t.hit < 0 ? '<span class="bad-t">פספוס!</span><small>נסו זווית או כוח אחרים</small>' : t.knocked ? '<span class="good-t">הפלתם איש שלג! ☃️</span>' : '<span class="good-t">פגיעה! ❄️</span>';
          if (t.hit >= 0) {
            const man = app.querySelector(`.sb-pman[data-i="${t.hit}"]`);
            if (man) {
              U.bump(man, t.knocked ? 'topple' : 'wobble');
              if (t.knocked) man.innerHTML = Art.snowman(this.enemyColor, true);
            }
            U.sfx('good');
          } else U.sfx('bad');
        };
        // the throw animation is already running locally: show the verdict when it lands
        if (this.flying) this.afterFlight = show;
        else if (app.querySelector('.sb-sling')) show();
        else {
          app.innerHTML = `${ctx.topBar()}<div class="act-result"><div class="ar-art">${Art.snowball()}</div><div class="ar-title">${t.hit < 0 ? 'פספוס!' : t.knocked ? 'הפלתם איש שלג!' : 'פגיעה!'}</div></div>`;
        }
        return true;
      }
      return false;
    },

    buildThrow(app, you, ctx) {
      const enemyColor = (this.enemyColor = you.team === 0 ? '#2f80ff' : '#f2434f');
      app.innerHTML = `${ctx.topBar()}
        <div class="phase-title">משכו אחורה ושחררו!<small>הזווית והכוח קובעים לאן הכדור יעוף</small></div>
        <div class="p-stage sb-sling" id="sling">
          <div class="snowfall"></div>
          <div class="sb-pground"></div>
          <svg class="sb-mtn" viewBox="0 0 400 200" preserveAspectRatio="none"><path d="M0 200 V120 L70 50 L120 100 L190 30 L260 110 L320 60 L400 120 V200Z" fill="#b9d6f2"/><path d="M70 50 L92 72 L70 68 L52 70Z M190 30 L214 54 L190 50 L170 54Z M320 60 L340 80 L320 76 L302 80Z" fill="#fff"/></svg>
          <div class="sb-igloo" style="left:${((X0 + 82) / (WORLD + X0)) * 100}%"></div>
          ${XS.map((x, i) => `<div class="sb-pman ${you.targets[i] <= 0 ? 'down' : ''}" data-i="${i}" style="left:${((x + X0) / (WORLD + X0)) * 100}%">${Art.snowman(enemyColor, you.targets[i] <= 0)}</div>`).join('')}
          <svg class="sb-aim" id="aim"><path id="band" class="band"/><g id="dots"></g></svg>
          <div class="sb-post" style="left:${(X0 / (WORLD + X0)) * 100}%"><i></i><i></i></div>
          <div class="sb-pball" id="pball">${Art.snowball()}</div>
          <div class="sb-hint" id="hint">👆 גררו אחורה</div>
        </div>
        <div class="sb-readout"><span>זווית <b id="ang">—</b></span><span>כוח <b id="pow">—</b></span></div>`;
      const sl = document.getElementById('sling');
      const ball = document.getElementById('pball');
      const dots = document.getElementById('dots');
      const band = document.getElementById('band');
      const W = () => sl.clientWidth;
      const unit = () => W() / (WORLD + X0);
      const yUnit = () => unit() * Y_STRETCH;
      const ground = () => sl.clientHeight * 0.84;
      const origin = () => [unit() * X0, ground() - yUnit() * 3];
      const map = (x, y) => [origin()[0] + x * unit() - 14, origin()[1] - y * yUnit() - 14];
      let start = null;
      let aim = null;
      let done = false;
      this.flying = false;
      this.afterFlight = null;
      const place = (dx, dy) => {
        const [ox, oy] = origin();
        ball.style.transform = `translate(${ox + dx - 14}px, ${oy + dy - 14}px)`;
        band.setAttribute('d', `M${ox - 6} ${oy - 4} L${ox + dx} ${oy + dy} L${ox + 6} ${oy - 4}`);
      };
      place(0, 0);
      const update = (e) => {
        const dx = e.clientX - start[0];
        const dy = e.clientY - start[1];
        const maxPull = Math.min(W() * 0.42, 170);
        const len = Math.min(maxPull, Math.hypot(dx, dy));
        if (len < 6) return;
        // pulling back (left / down) throws forward (right / up)
        let angle = (Math.atan2(dy, -dx) * 180) / Math.PI;
        angle = Math.max(5, Math.min(85, angle));
        const power = Math.max(0.15, len / maxPull);
        const r = (angle * Math.PI) / 180;
        const pull = Math.min(46, len * 0.4); // the pouch stays near the sling
        place(-Math.cos(r) * pull, Math.sin(r) * pull);
        aim = { angle, power };
        document.getElementById('ang').textContent = Math.round(angle) + '°';
        document.getElementById('pow').textContent = Math.round(power * 100) + '%';
        // dotted preview of the first part of the flight
        const range = (Math.pow(VMAX * power, 2) * Math.sin(2 * r)) / G;
        let html = '';
        for (let i = 1; i <= 9; i++) {
          const x = (range * 0.42 * i) / 9;
          const [px, py] = map(x, heightAt(x, angle, power));
          html += `<circle cx="${px + 14}" cy="${py + 14}" r="${4 - i * 0.3}" />`;
        }
        dots.innerHTML = html;
      };
      sl.addEventListener('pointerdown', (e) => {
        if (done) return;
        start = [e.clientX, e.clientY];
        sl.setPointerCapture(e.pointerId);
        document.getElementById('hint').classList.add('gone');
      });
      sl.addEventListener('pointermove', (e) => { if (start && !done) update(e); });
      const release = () => {
        if (!start || done) return;
        start = null;
        if (!aim) return place(0, 0);
        done = true;
        dots.innerHTML = '';
        band.setAttribute('d', '');
        U.sfx('pop');
        if (navigator.vibrate) navigator.vibrate(15);
        ctx.act('throw', aim);
        // local flight; stop at the first standing snowman it would hit (server decides for real)
        const alive = you.targets.map((h) => h > 0);
        let hit = -1;
        for (let i = 0; i < XS.length; i++) {
          const f = heightAt(XS[i] - 3.2, aim.angle, aim.power);
          const m = heightAt(XS[i], aim.angle, aim.power);
          if (f < 0 && m < 0) break;
          if (alive[i] && ((f >= 0 && f <= SNOW_H) || (m >= 0 && m <= SNOW_H))) { hit = i; break; }
        }
        this.flying = true;
        fly(ball, aim.angle, aim.power, stopX(aim.angle, aim.power, hit), map, 800, () => {
          this.flying = false;
          const [px, py] = map(stopX(aim.angle, aim.power, hit), 0);
          U.burst(sl, px + 14, Math.min(py + 14, ground()), ['#fff', '#dbeeff'], 10, 50);
          if (this.afterFlight) this.afterFlight();
        });
      };
      sl.addEventListener('pointerup', release);
      sl.addEventListener('pointercancel', release);
    },

    onBoard() {},

    playerEnded(app, you) {
      const r = you.results;
      const mine = r.players.find((p) => p.name === you.name) || { hits: 0, knocks: 0, throws: 0 };
      const win = r.winner === you.team;
      return U.playerResult({
        win,
        title: r.winner < 0 ? 'תיקו!' : win ? 'הקבוצה שלכם ניצחה!' : 'כמעט! בפעם הבאה',
        extra: U.teamsMini(r.teams, r.knocked, r.winner),
        lines: [`❄️ ${mine.hits} פגיעות מתוך ${mine.throws} זריקות`, `☃️ ${mine.knocks} אנשי שלג שהפלתם`],
      });
    },
  };
})();
