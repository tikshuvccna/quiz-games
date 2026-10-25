const socket = io();
const app = document.getElementById('app');
const { esc, mmss } = U;
const MODE_COLOR = '#7c4dff';
let you = null;
let boardState = null;
let session = null; // { pin, token }
let prevPhase = null;

// this tab's seat; the device also remembers it, so closing the browser by mistake and coming back
// (same link / same code) returns the player to their game with everything they did so far
const store = {
  get() { try { return JSON.parse(sessionStorage.getItem('player') || 'null'); } catch { return null; } },
  saved() { try { return JSON.parse(localStorage.getItem('qg-player') || 'null'); } catch { return null; } },
  set(v) {
    try { v ? sessionStorage.setItem('player', JSON.stringify(v)) : sessionStorage.removeItem('player'); } catch {}
    try { v ? localStorage.setItem('qg-player', JSON.stringify({ ...v, at: Date.now() })) : localStorage.removeItem('qg-player'); } catch {}
  },
};

// ---- join screen ----
function showJoin(error = '') {
  you = null;
  prevPhase = null;
  U.clearCountdown();
  U.view(app, 'join');
  const urlPin = new URLSearchParams(location.search).get('pin') || '';
  app.className = 'screen center join';
  app.innerHTML = `
    <div class="join-art"><div class="fl">${Art.item('gem')}</div><div class="fl">${Art.castle('#ff4fa3')}</div><div class="fl">${Art.item('crown')}</div><div class="fl">${Art.rock(4)}</div></div>
    <div class="logo"><div class="logo-mark">${Art.star()}</div><div class="logo-text">פיצוץ מוחות</div></div>
    <div class="card">
      <form class="form" id="f" autocomplete="off">
        <input class="input" id="pin" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="קוד משחק" value="${esc(urlPin)}" aria-label="קוד משחק">
        <input class="input hidden" id="name" maxlength="14" placeholder="הכינוי שלך" aria-label="כינוי" enterkeyhint="go">
        <button class="btn big" type="submit" id="go">המשך</button>
        <div class="error" id="err" role="alert">${esc(error)}</div>
      </form>
    </div>
    <div class="join-foot">${U.soundBtn()}<a href="host.html">אני המארח/ת</a></div>`;
  if (matchMedia('(pointer: fine)').matches) document.getElementById('pin').focus();
  let busy = false;
  let askName = false;
  const err = document.getElementById('err');
  const join = (pin, name) => {
    busy = true;
    document.getElementById('go').disabled = true;
    socket.timeout(6000).emit('player:join', { pin, name }, (to, r) => {
      busy = false;
      const b = document.getElementById('go');
      if (b) b.disabled = false;
      if (to || !r) return (err.textContent = 'אין חיבור לשרת, נסו שוב');
      if (!r.ok) return (err.textContent = r.error);
      session = { pin: r.pin, token: r.token };
      store.set(session);
      U.sfx('pop');
      if (r.back) U.toast && U.toast('ברוכים השבים! ההתקדמות שלכם נשמרה 💪');
    });
  };
  document.getElementById('f').onsubmit = (e) => {
    e.preventDefault();
    if (busy) return;
    const pin = document.getElementById('pin').value.replace(/\D/g, '');
    if (pin.length < 6) return (err.textContent = 'הקוד הוא 6 ספרות');
    err.textContent = '';
    if (askName) {
      const name = document.getElementById('name').value.trim();
      if (!name) return (err.textContent = 'צריך לבחור כינוי');
      return join(pin, name);
    }
    // step 1: check the PIN; auto-name rooms let you straight in
    busy = true;
    socket.timeout(6000).emit('player:check', { pin }, (to, r) => {
      busy = false;
      if (to || !r) return (err.textContent = 'אין חיבור לשרת, נסו שוב');
      if (!r.ok) return (err.textContent = r.error);
      U.applyScene(r.scene);
      if (r.nameMode !== 'custom') return join(pin, '');
      askName = true;
      const n = document.getElementById('name');
      n.classList.remove('hidden');
      document.getElementById('pin').classList.add('locked');
      document.getElementById('go').textContent = r.running ? 'הצטרפו למשחק ▶' : 'יאללה!';
      if (r.running) n.placeholder = 'הכינוי שלך (חוזרים? אותו כינוי)';
      n.focus();
    });
  };
  if (urlPin.length === 6) document.getElementById('f').requestSubmit();
}

socket.on('connect', () => {
  // force a rebuild of whatever view comes next (buttons may have been locked mid-answer)
  app.dataset.view = app.dataset.view === 'join' ? 'join' : '';
  session = store.get();
  if (session) {
    socket.emit('player:rejoin', session, (r) => {
      if (!r || !r.ok) { store.set(null); session = null; showJoin(); }
    });
    return;
  }
  // a new tab (or the browser was closed): come back to the game this device was in, unless it is
  // still open in another tab. A link with a different code means a new game.
  const saved = store.saved();
  const urlPin = new URLSearchParams(location.search).get('pin');
  if (saved && Date.now() - (saved.at || 0) < 6 * 3600 * 1000 && (!urlPin || urlPin === saved.pin)) {
    socket.emit('player:rejoin', { ...saved, soft: true }, (r) => {
      if (r && r.ok) { session = { pin: saved.pin, token: saved.token }; store.set(session); }
      else if (app.dataset.view !== 'join') showJoin();
    });
  }
});

// a player photo: cut to a centered square, 160 px, small JPEG (kept in memory on the server only)
function sendPhoto(file) {
  const img = new Image();
  img.onload = () => {
    const S = 160;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, S, S);
    URL.revokeObjectURL(img.src);
    socket.emit('player:photo', { photo: c.toDataURL('image/jpeg', 0.72) });
    U.sfx('pop');
  };
  img.onerror = () => alert('לא הצלחנו לקרוא את התמונה');
  img.src = URL.createObjectURL(file);
}

socket.on('kicked', (d) => {
  store.set(null);
  session = null;
  showJoin(d && d.replaced ? 'המשחק נפתח בחלון אחר' : 'הוסרת מהמשחק');
});

socket.on('board', (d) => {
  boardState = d.board;
  if (!you) return;
  const l = document.getElementById('left');
  if (l) l.textContent = mmss(d.left);
  const G = Games[you.gameId];
  if (G && G.onBoard && you.phase !== 'ended') G.onBoard(you, boardState);
});

socket.on('you', (y) => {
  const was = you && you.phase;
  you = y;
  try {
    render(was);
  } catch (e) {
    console.error(e);
  }
});

const act = (type, data) => socket.emit('player:action', { type, data });
const setView = (name) => U.view(app, name);
const teamColor = () => (you.team >= 0 && you.teamColor ? you.teamColor : MODE_COLOR);

function topBar() {
  const G = Games[you.gameId];
  return `<div class="p-top" style="${U.pal(teamColor())}">
      ${U.avatar(you.name, you.team >= 0 ? U.shade(teamColor(), 0.75) : U.color(you.name))}
      <span class="p-name">${esc(you.name)}</span>
      <span class="hud-mid">${you.need > 1 && (you.phase === 'question' || you.phase === 'feedback') ? `<span class="hchip" title="תשובות לתור הבא"><span class="pips">${Array.from({ length: you.need }, (_, i) => `<span class="pip ${i < you.charge ? 'on' : ''}"></span>`).join('')}</span></span>` : ''}${G ? G.hud(you) : ''}</span>
      ${you.untimed ? '' : `<span class="p-timer" id="left">${mmss(you.left || 0)}</span>`}
    </div>`;
}
// refresh only the top bar of an existing view
const refreshTop = () => {
  const t = app.querySelector('.p-top');
  if (t) t.outerHTML = topBar();
};

function render(was) {
  if (!you) return;
  const ph = you.phase;
  const G = Games[you.gameId];
  if (ph !== 'countdown') U.clearCountdown();
  if (you.photo) U.photos[you.name] = you.photo;
  U.applyScene(you.scene);

  if (ph === 'lobby' || ph === 'countdown' || ph === 'spectate') {
    const key = [ph, you.gameId, you.team, you.name, you.canReroll, you.round, you.photo, you.photos].join(':');
    if (you.photo) U.photos[you.name] = you.photo;
    else delete U.photos[you.name];
    if (ph === 'countdown' && was !== 'countdown') U.countdown(you.cd || 3000, esc(you.gameTitle));
    if (!setView(key)) return;
    app.className = 'screen center wait';
    const team = you.team >= 0
      ? `<div class="team-banner" style="${U.pal(you.teamColor)}">${Art.mascot(you.team)}<span>את/ה בקבוצת ${esc(you.teamName)}!</span></div>`
      : '';
    app.innerHTML = `
      <div class="wait-cover">${Art.cover(you.gameId)}</div>
      <div class="wait-game">${esc(you.gameTitle)}</div>
      <div class="wait-me">${U.avatar(you.name)}<div class="wait-name">${esc(you.name)}</div>${you.canReroll ? '<button class="btn ghost reroll" id="reroll">🎲 שם אחר</button>' : ''}</div>
      ${ph === 'lobby' && you.round > 0 ? `<div class="pill">🔁 סיבוב ${you.round + 1}</div>` : ''}
      ${team}
      <h2>${ph === 'lobby' ? 'את/ה בפנים!' : ph === 'spectate' ? 'המשחק כבר רץ' : 'מתחילים!'}</h2>
      <div class="muted">${ph === 'lobby' ? 'מחכים שהמארח/ת יתחיל<span class="dots"><i></i><i></i><i></i></span>' : ''}</div>
      ${ph === 'lobby' && you.photos ? `<label class="btn ghost photo-btn">📷 ${you.photo ? 'החלפת תמונה' : 'הוספת תמונה (לא חובה)'}<input type="file" id="photoIn" accept="image/*" capture="user" hidden></label>${you.photo ? '<button class="btn ghost photo-btn" id="photoX">הסרת התמונה</button>' : ''}` : ''}
      ${ph === 'lobby' ? U.soundBtn() : ''}`;
    const pi = document.getElementById('photoIn');
    if (pi) pi.onchange = (e) => e.target.files[0] && sendPhoto(e.target.files[0]);
    const px = document.getElementById('photoX');
    if (px) px.onclick = () => socket.emit('player:photo', { photo: '' });
    const rr = document.getElementById('reroll');
    if (rr) rr.onclick = () => { socket.emit('player:reroll'); U.sfx('pop'); };
    return;
  }

  if (ph === 'question') {
    // one build per question (qid); a reconnect clears the view key and forces a rebuild
    if (!setView('q:' + you.qid)) return refreshTop();
    app.className = 'screen play';
    const n = you.stats.correct + you.stats.wrong + 1;
    app.innerHTML = `${topBar()}<div class="q-wrap" id="qw"></div>`;
    const qid = you.qid;
    QView.render(document.getElementById('qw'), you.question, {
      meta: `<span>שאלה ${n}</span>${you.streak >= 2 ? `<span class="streak-chip">${Art.flame()} ${you.streak}</span>` : ''}`,
      onAnswer: (data) => act('answer', { ...data, qid }),
    });
    return;
  }

  if (ph === 'feedback') {
    if (!setView('feedback:' + you.qid)) return refreshTop();
    app.className = 'screen play';
    const l = you.last;
    U.sfx(l.correct ? 'good' : 'bad');
    if (navigator.vibrate) navigator.vibrate(l.correct ? 20 : [40, 40, 40]);
    app.innerHTML = `${topBar()}
      <div class="fb-screen ${l.correct ? 'good' : 'bad'}">
        <div class="fb-icon">${l.correct ? Art.check() : Art.cross()}</div>
        <div class="fb-title">${l.correct ? 'נכון!' : 'לא נכון'}</div>
        ${l.correct && l.streak >= 2 ? `<div class="streak">${Art.flame()} רצף ${l.streak}</div>` : ''}
        ${l.correct ? (l.note ? `<div class="fb-note">${esc(l.note)}</div>` : '') : `<div class="fb-answer">התשובה הנכונה<b>${esc(l.correctText)}</b></div>${l.note ? `<div class="fb-note">${esc(l.note)}</div>` : ''}`}
        ${l.afterImage ? `<img class="fb-pic" src="${esc(l.afterImage)}" alt="">` : ''}
        ${l.explain && !l.correct ? `<div class="fb-explain">${esc(l.explain)}</div>` : ''}
      </div>`;
    if (l.correct) {
      const s = app.querySelector('.fb-screen');
      const r = s.getBoundingClientRect();
      U.burst(s, r.width / 2, r.height * 0.33, ['#fff', '#ffd23f', '#b6ffd9'], 18, 140);
    }
    return;
  }

  if (ph === 'ended') {
    if (!setView('ended')) return;
    app.className = 'screen center wait';
    U.winText = you.results.winText || '';
    const tr = you.results.teamScores;
    const myTeam = tr && you.team >= 0 ? `<div class="pres-team ${you.results.winnerTeam === you.team ? 'won' : ''}" style="${U.pal(you.teamColor)}">${Art.mascot(you.team)}<span>${you.results.winnerTeam === you.team ? `הקבוצה שלכם ניצחה! 🏆` : you.results.winnerTeam < 0 ? 'תיקו בין הקבוצות' : `${esc(tr[you.results.winnerTeam].name)} ניצחו`}</span><b>${tr[you.team].score}</b></div>` : '';
    app.innerHTML = `${myTeam}${G.playerEnded(app, you)}<div class="muted">מחכים למארח/ת: סיבוב נוסף יתחיל כאן אוטומטית</div><button class="btn ghost" id="again" style="max-width:360px">יציאה</button>`;
    document.getElementById('again').onclick = () => { store.set(null); session = null; location.href = '/'; };
    return;
  }

  app.className = 'screen play';
  if (G && G.playerPhase(app, you, { act, setView, topBar, refreshTop, board: () => boardState, teamColor })) return;
  // unknown phase: keep the player informed instead of a blank screen
  if (setView('wait:' + ph)) {
    app.className = 'screen center wait';
    app.innerHTML = `<h2>רגע…</h2>`;
  }
}

showJoin();
