// Client side of "מי המתחזה?": the big screen shows the shared task bar, the crew and the meetings;
// on the phone each player secretly knows if they are crew or the impostor.
(function () {
  const { esc } = U;

  Art.covers.impostor = () => `<rect width="160" height="100" fill="#1d1b3a"/>
    <circle cx="125" cy="22" r="10" fill="#fff3b0" opacity=".85"/>
    <ellipse cx="52" cy="62" rx="22" ry="26" fill="#3ec1d3" stroke="#10233a" stroke-width="3"/><rect x="38" y="46" width="30" height="16" rx="8" fill="#bfeaff" stroke="#10233a" stroke-width="3"/>
    <ellipse cx="112" cy="68" rx="18" ry="22" fill="#ff4d6d" stroke="#10233a" stroke-width="3"/><rect x="100" y="55" width="24" height="13" rx="6" fill="#ffd3da" stroke="#10233a" stroke-width="3"/>
    <text x="104" y="40" font-size="26">🕵️</text><text x="30" y="32" font-size="18">?</text><text x="76" y="24" font-size="22">?</text>`;

  Games.impostor = {
    // ---------- host ----------
    hostPlaying(app, st) {
      const b = st.board;
      if (U.hostFrame(app, st, {
        id: 'impostor',
        cls: 'improom',
        stats: `<div class="stat" style="${U.pal('#2ee59d')}"><span class="lbl">🔧 משימות (%)</span><span class="val" id="ipct">0%</span></div><div class="stat" style="${U.pal('#ff4d6d')}"><span class="lbl">👥 עדיין בפנים</span><span class="val" id="ialive">0</span></div>`,
        stage: `<div class="im-bar"><div class="im-fill" id="imfill"></div><i class="im-mark" style="left:${b.marks[0]}%"></i><i class="im-mark" style="left:${b.marks[1]}%"></i></div>
          <div class="im-grid" id="imgrid"></div><div class="im-feed" id="imfeed"></div><div class="im-meet hidden" id="immeet"></div>`,
      })) {
        this.seen = b.ev.length ? b.ev[b.ev.length - 1].id : 0;
      }
      U.hostTick(st, `${b.players.length} שחקנים · מתחזה אחד או יותר בינינו`);
      U.countTo(document.getElementById('ipct'), b.pct);
      U.countTo(document.getElementById('ialive'), b.alive);
      document.getElementById('imfill').style.width = b.pct + '%';

      const grid = document.getElementById('imgrid');
      const sig = b.players.map((p) => p.name + p.alive + p.voted).join('|');
      if (grid.dataset.sig !== sig) {
        grid.dataset.sig = sig;
        grid.innerHTML = b.players.map((p) => `<div class="im-card ${p.alive ? '' : 'out'} ${b.stage === 'meeting' && p.voted ? 'voted' : ''}">${U.avatar(p.name)}<b>${esc(p.name)}</b>${p.alive ? (b.stage === 'meeting' ? `<span>${p.voted ? '🗳️ הצביע/ה' : '🤔 חושב/ת'}</span>` : '') : '<span>👻 הודח/ה</span>'}</div>`).join('');
      }
      document.getElementById('imfeed').innerHTML = b.feed.slice(-3).map((f) => `<div>${esc(f.text)}</div>`).join('');

      const m = document.getElementById('immeet');
      if (b.stage === 'meeting') {
        m.classList.remove('hidden');
        const voted = b.players.filter((p) => p.alive && p.voted).length;
        m.innerHTML = `<div class="im-alarm">🚨</div><h2>פגישה דחופה!</h2><p>מי המתחזה? דברו ביניכם והצביעו בטלפון</p><div class="im-count">${Math.ceil(b.left / 1000)}</div><div class="im-vc">🗳️ ${voted} מתוך ${b.alive} הצביעו</div>`;
      } else if (b.stage === 'result' && b.result) {
        m.classList.remove('hidden');
        const r = b.result;
        m.innerHTML = r.name
          ? `<div class="im-alarm">${r.imp ? '🎉' : '😬'}</div><h2>${esc(r.name)} הודח/ה</h2><p class="im-${r.imp ? 'good' : 'bad'}">${r.imp ? 'זה/ו היה המתחזה! הצוות צדק' : 'לא היה המתחזה… המתחזה עדיין כאן'}</p>`
          : `<div class="im-alarm">🤷</div><h2>אף אחד לא הודח</h2><p>לא היה רוב ברור. ממשיכים בזהירות</p>`;
        if (this.shownResult !== b.meetingNo) { this.shownResult = b.meetingNo; U.sfx(r.imp ? 'good' : 'bad'); }
      } else m.classList.add('hidden');

      const stage = document.getElementById('stage');
      for (const e of b.ev) {
        if (e.id <= this.seen) continue;
        this.seen = e.id;
        if (e.k === 'drain') { U.shake(stage, true); U.sfx('bad'); U.floatText(stage, '⚠️ חבלה!', stage.clientWidth / 2, 120, 'bad'); }
        else if (e.k === 'jam') { U.sfx('bad'); U.floatText(stage, '📡 הפרעה', stage.clientWidth / 2, 120, 'bad'); }
        else if (e.k === 'meeting') U.sfx('boom');
      }
    },

    hostEnded(app, st) {
      if (!U.view(app, 'impostor-end')) return;
      const r = st.results;
      const imps = r.players.filter((p) => p.imp).map((p) => p.name);
      U.hostResults(app, st, {
        title: r.win === 'crew' ? 'הצוות ניצח! 🎉' : 'המתחזים ניצחו! 😈',
        sub: `המתחזים היו: ${imps.map(esc).join(', ')}`,
        lost: r.win !== 'crew',
        body: `<div class="end-visual"><div class="im-endbar"><div style="width:${r.progress}%"></div></div><div class="muted" style="text-align:center">${r.progress}% מהמשימות הושלמו</div></div>`,
        table: U.table(r.players, [
          ['שם', (p) => `<span class="nm">${U.avatar(p.name)}${esc(p.name)}</span>`],
          ['תפקיד', (p) => (p.imp ? '🕵️ מתחזה' : '🔧 צוות')],
          ['תשובות נכונות', (p) => p.correct],
          ['חבלות', (p) => (p.imp ? p.sabotaged : '')],
          ['', (p) => (p.alive ? '' : '👻 הודח/ה')],
        ]),
      });
    },

    // ---------- player ----------
    hud(you) {
      setTimeout(() => this.afterDraw(you), 0);
      return `<span class="hchip ${you.role === 'imp' ? 'im-imp' : 'im-crew'}">${you.role === 'imp' ? '🕵️ מתחזה' : '🔧 צוות'}</span><span class="hchip">${you.pct}%</span>`;
    },

    // the role reveal, jam overlay and the "I saw someone" hint sit on top of whatever screen is showing
    afterDraw(you) {
      if (you.phase === 'ended') return this.clear();
      if (this.shownFor !== you.role + ':' + (you.gameTitle || '') + ':' + (you.round || 0)) {
        this.shownFor = you.role + ':' + (you.gameTitle || '') + ':' + (you.round || 0);
        const mates = you.mates && you.mates.length ? `<small>החבר/ה שלכם למזימה: ${you.mates.map(esc).join(', ')}</small>` : '';
        this.overlay(you.role === 'imp'
          ? `<div class="im-role imp"><span>🕵️</span><h2>אתם המתחזים!</h2><p>ענו נכון כדי להיראות חפים מפשע, ואז חבלו בסרגל או בלבלו חבר. אל תיתפסו!</p>${mates}</div>`
          : `<div class="im-role"><span>🔧</span><h2>אתם בצוות</h2><p>ענו נכון כדי להשלים משימות. בין החברים מסתתר מתחזה, חפשו אותו!</p></div>`, 5000);
      }
      const jam = document.querySelector('.im-jam');
      if (you.jam && !jam) {
        const el = this.overlay(`<div class="im-role jam"><span>📡</span><h2>הפרעה בקליטה!</h2><p>מישהו מפריע לכם… חכו רגע</p></div>`, you.jam, 'im-jam');
        U.sfx('bad');
      }
      if (you.hint && this.lastHint !== you.hint + you.turn + ':' + you.qid) {
        this.lastHint = you.hint + you.turn + ':' + you.qid;
        const t = document.createElement('div');
        t.className = 'p-toast';
        t.textContent = `👀 ראיתם מישהו חשוד… שמו מתחיל ב-${you.hint}?`;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 4200);
      }
    },

    overlay(html, ms, extra = '') {
      const el = document.createElement('div');
      el.className = 'im-over ' + extra;
      el.innerHTML = html;
      el.onclick = () => { if (!extra) el.remove(); };
      document.body.appendChild(el);
      setTimeout(() => el.remove(), ms);
      return el;
    },

    clear() {
      document.querySelectorAll('.im-over').forEach((e) => e.remove());
      this.shownFor = null;
    },

    playerPhase(app, you, ctx) {
      if (you.stage === 'result' && you.phase !== 'question' && you.phase !== 'feedback') {
        if (!ctx.setView('imres' + JSON.stringify(you.result))) return true;
        const r = you.result || {};
        const me = r.name === you.name;
        app.innerHTML = `${ctx.topBar()}<div class="act-result"><div class="ar-art">${r.name ? (r.imp ? '🎉' : '😬') : '🤷'}</div>
          <div class="ar-title">${r.name ? (me ? 'הודחתם!' : `${esc(r.name)} הודח/ה`) : 'אף אחד לא הודח'}</div>
          <div class="ar-sub">${r.name ? (r.imp ? 'זה/ו היה המתחזה!' : 'לא היה המתחזה…') : 'לא היה רוב ברור'}</div></div>`;
        return true;
      }
      if (you.phase === 'out') {
        if (!ctx.setView('imout' + you.turn)) return true;
        app.innerHTML = `${ctx.topBar()}<div class="act-result"><div class="ar-art">👻</div><div class="ar-title">הודחתם</div><div class="ar-sub">עכשיו אתם צופים. עקבו אחרי המסך הגדול ועזרו בלחישות!</div></div>`;
        return true;
      }
      if (you.phase === 'vote') {
        if (!ctx.setView('imvote' + you.turn)) return true;
        app.innerHTML = `${ctx.topBar()}
          <div class="timebar"><i style="animation-duration:${you.meetLeft || 40000}ms"></i></div>
          <div class="phase-title">🚨 פגישה! מי המתחזה?<small>דברו בכיתה, ואז הצביעו</small></div>
          <div class="im-cands">${you.candidates.map((c) => `<button class="im-cand" data-id="${c.id}">${U.avatar(c.name)}<b>${esc(c.name)}</b><span>✔ ${c.correct} · ✖ ${c.wrong}</span></button>`).join('')}<button class="im-cand im-skip" data-id="skip">🤷<b>לא בטוחים (דילוג)</b></button></div>
          <div class="im-voted muted"></div>`;
        const box = app.querySelector('.im-cands');
        const mark = (id) => {
          box.querySelectorAll('.im-cand').forEach((x) => x.classList.toggle('picked', x.dataset.id === id));
          app.querySelector('.im-voted').textContent = '✅ ההצבעה נשלחה, אפשר לשנות עד הסוף';
        };
        if (you.vote) mark(you.vote);
        box.onclick = (e) => {
          const b = e.target.closest('.im-cand');
          if (!b) return;
          mark(b.dataset.id);
          U.sfx('pop');
          if (navigator.vibrate) navigator.vibrate(20);
          ctx.act('vote', { to: b.dataset.id });
        };
        return true;
      }
      if (you.phase === 'sabotage') {
        if (!ctx.setView('imsab' + you.qid + ':' + you.turn)) return true;
        app.innerHTML = `${ctx.topBar()}
          <div class="timebar"><i style="animation-duration:${you.pickMs}ms"></i></div>
          <div class="phase-title">😈 זמן לחבל!<small>בחרו חבלה בשקט</small></div>
          <button class="im-sab" data-k="drain"><span>⚠️</span><b>להוריד את הסרגל המשותף</b></button>
          <div class="phase-title im-t2">או להפריע לחבר בקליטה</div>
          <div class="im-cands">${you.targets.map((t) => `<button class="im-cand" data-id="${t.id}">${U.avatar(t.name)}<b>${esc(t.name)}</b><span>📡 הפרעה</span></button>`).join('')}</div>`;
        let done = false;
        app.onclick = (e) => {
          if (done) return;
          const d = e.target.closest('.im-sab');
          const c = e.target.closest('.im-cand');
          if (!d && !c) return;
          done = true;
          app.onclick = null;
          U.sfx('pop');
          ctx.act('sabotage', d ? { k: 'drain' } : { k: 'jam', to: c.dataset.id });
        };
        return true;
      }
      return false;
    },

    onBoard() {},

    playerEnded(app, you) {
      this.clear();
      const r = you.results;
      const mine = r.players.find((p) => p.name === you.name) || {};
      const won = mine.imp ? r.win === 'imp' : r.win === 'crew';
      return U.playerResult({
        win: won,
        title: r.win === 'crew' ? 'הצוות ניצח!' : 'המתחזים ניצחו!',
        big: `${mine.correct || 0}`,
        bigLabel: 'תשובות נכונות',
        lines: [mine.imp ? '🕵️ הייתם המתחזים' : '🔧 הייתם בצוות', `🔧 ${r.progress}% מהמשימות הושלמו`, `המתחזים: ${r.players.filter((p) => p.imp).map((p) => p.name).join(', ')}`],
      });
    },
  };
})();
