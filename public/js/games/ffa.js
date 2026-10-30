// Shared client of the "answer, then play a short round on your phone" games (mole, hoops, snake, burger, ship).
// FfaBoard.make({ id, cls, endTitle, endBig, cover, play(app, you, ctx, done) }) returns the Games entry:
// the host's ranked board, the phone's round screen (play draws it, calls done(data) when finished) and the result screens.
window.FfaBoard = (function () {
  const { esc } = U;

  function make(def) {
    const G = {
      // ---------- host ----------
      hostPlaying(app, st) {
        const b = st.board;
        if (U.hostFrame(app, st, {
          id: def.id,
          cls: 'fb-room ' + (def.cls || ''),
          stats: `<div class="stat" style="${U.pal('#8b5cf6')}"><span class="lbl">⭐ מוביל/ה</span><span class="val small" id="lead">—</span></div><div class="stat" style="${U.pal('#2ee59d')}"><span class="lbl">${def.emoji || '🎮'} משחקים עכשיו</span><span class="val" id="npl">0</span></div>`,
          stage: `<div class="fb-glow"></div><div class="fb-list" id="fblist"></div>`,
        })) this.rows = new Map();
        U.hostTick(st, `${b.total} שחקנים · כל אחד לעצמו`);
        const lead = document.getElementById('lead');
        const leader = b.players[0] && b.players[0].pts > 0 ? b.players[0].name : '—';
        if (lead.textContent !== leader) { lead.textContent = leader; U.bump(lead); }
        U.countTo(document.getElementById('npl'), b.players.filter((p) => p.playing).length);
        const list = document.getElementById('fblist');
        const max = Math.max(20, ...b.players.map((p) => p.pts));
        const names = new Set(b.players.map((p) => p.name));
        for (const [n, el] of this.rows) if (!names.has(n)) { el.remove(); this.rows.delete(n); }
        b.players.forEach((p, i) => {
          let el = this.rows.get(p.name);
          if (!el) {
            el = document.createElement('div');
            el.className = 'fb-row';
            el.innerHTML = `<span class="fb-rank"></span>${U.avatar(p.name)}<b>${esc(p.name)}</b><div class="fb-track"><i></i></div><span class="fb-pts">0</span><span class="fb-meta"></span>`;
            list.appendChild(el);
            this.rows.set(p.name, el);
            U.bump(el, 'drop-in');
          }
          el.style.order = i;
          el.querySelector('.fb-rank').textContent = i + 1;
          el.querySelector('.fb-track i').style.width = Math.max(2, (p.pts / max) * 100) + '%';
          U.countTo(el.querySelector('.fb-pts'), p.pts);
          el.querySelector('.fb-meta').textContent = p.rounds ? `${def.emoji || '🎮'} ${p.rounds} · 🎯 ${p.acc}%` : '';
          el.classList.toggle('playing', p.playing);
        });
      },

      hostEnded(app, st) {
        if (!U.view(app, def.id + '-end')) return;
        const r = st.results.players;
        U.hostResults(app, st, {
          title: r[0] ? `${esc(r[0].name)} ${def.endTitle || 'ניצח/ה!'}` : 'סוף המשחק',
          sub: st.gameTitle,
          body: `<div class="end-visual">${U.podium(r.slice(0, 3).map((p) => ({ name: p.name, value: p.pts, unit: 'נקודות' })))}</div>`,
          table: U.table(r, [
            ['#', (p, i) => i + 1],
            ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
            ['נקודות', (p) => `⭐ ${p.pts}`],
            ['סיבובים', (p) => p.rounds],
            ['דיוק', (p) => `🎯 ${p.acc}%`],
            ['סיבוב שיא', (p) => `🔥 ${p.best}`],
          ]),
        });
      },

      // ---------- player ----------
      hud(you) {
        return `<span class="hchip">⭐ ${you.pts}</span><span class="hchip">#${you.rank}</span>`;
      },

      playerPhase(app, you, ctx) {
        if (you.phase === 'ffa') {
          if (!ctx.setView('ffa' + you.qid + ':' + you.turn)) return true;
          let sent = false;
          const done = (data) => {
            if (sent) return;
            sent = true;
            ctx.act('play', data || {});
          };
          def.play(app, you, ctx, done);
          return true;
        }
        if (you.phase === 'ffa_done') {
          if (!ctx.setView('ffadone' + you.qid + ':' + you.turn)) return true;
          const r = you.res;
          app.innerHTML = `${ctx.topBar()}<div class="act-result"><div class="ar-art">${r.full ? '🏆' : def.emoji || '🎮'}</div><div class="ar-title">${esc(r.title)}</div>
            <div class="ar-big">+${r.pts}</div><div class="ar-sub">${esc(r.sub)}</div></div>`;
          if (r.full) U.burst(app, app.clientWidth / 2, 200, ['#fff', '#ffd23f', '#ff4fa3'], 24, 160);
          return true;
        }
        return false;
      },

      onBoard() {},

      playerEnded(app, you) {
        const r = you.results.players;
        const idx = r.findIndex((p) => p.name === you.name);
        const mine = r[idx] || { pts: 0, rounds: 0, acc: 0, best: 0 };
        return U.playerResult({
          win: idx === 0,
          title: idx === 0 ? def.endTitle || 'ניצחתם!' : idx < 3 ? 'על הפודיום!' : 'כל הכבוד!',
          big: `${mine.pts}`,
          bigLabel: 'נקודות',
          lines: [`🏅 מקום ${idx + 1} מתוך ${r.length}`, `${def.emoji || '🎮'} ${mine.rounds} סיבובים · 🎯 ${mine.acc}% דיוק`, `🔥 סיבוב שיא ${mine.best}`],
        });
      },
    };
    if (def.cover) Art.covers[def.id] = def.cover;
    Games[def.id] = G;
    return G;
  }

  return { make };
})();
