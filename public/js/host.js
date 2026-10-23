const socket = io();
const app = document.getElementById('app');
const { esc } = U;
let st = null;
let joinUrl = '';
let replaced = false;
let tab = 'games';
let filter = 'all';
let videoLib = []; // the video library (videos folder + videos.json)
const MODE = { teams: 'קבוצה נגד קבוצה', ffa: 'כל אחד לעצמו', coop: 'כולם ביחד' };
const MODE_ICON = { teams: '⚔️', ffa: '🏃', coop: '🤝' };
const FILTERS = [['all', 'הכל'], ['teams', '⚔️ קבוצות'], ['ffa', '🏃 אישי'], ['coop', '🤝 שיתופי']];
const NAME_MODES = [
  ['custom', '✏️ כל אחד בוחר שם', 'השחקנים מקלידים כינוי'],
  ['spin', '🎲 שם אקראי + החלפה', 'מקבלים שם מצחיק ויכולים להחליף עד 3 פעמים'],
  ['auto', '🔒 שם אקראי קבוע', 'שם מצחיק שאי אפשר לשנות'],
];

const store = {
  get() { try { return JSON.parse(sessionStorage.getItem('host') || 'null'); } catch { return null; } },
  set(v) { try { v ? sessionStorage.setItem('host', JSON.stringify(v)) : sessionStorage.removeItem('host'); } catch {} },
};

// the address phones use: the best network address (Wi-Fi first), or the one the host picked
let addrs = [];
const pickedIp = { get() { try { return localStorage.getItem('qg-ip') || ''; } catch { return ''; } }, set(v) { try { localStorage.setItem('qg-ip', v); } catch {} } };
async function computeJoinUrl(pin) {
  let base = location.origin;
  if (['localhost', '127.0.0.1'].includes(location.hostname)) {
    try {
      const info = await (await fetch('/api/info')).json();
      addrs = info.addresses || [];
      const want = pickedIp.get();
      const a = addrs.find((x) => x.ip === want) || addrs[0];
      if (a) base = `http://${a.ip}:${info.port}`;
    } catch {}
  }
  joinUrl = `${base}/?pin=${pin}`;
}

const ready = (pin) => computeJoinUrl(pin).then(() => { app.dataset.view = ''; if (st) render(); });

let creating = false;
function create() {
  if (creating) return;
  creating = true;
  socket.emit('host:create', { game: 'territory' }, (r) => {
    creating = false;
    store.set({ pin: r.pin, hostToken: r.hostToken });
    ready(r.pin);
  });
}

// leave this room (drop it on the server) and start a fresh one with a new PIN
window.newGame = () => {
  const go = () => { store.set(null); location.reload(); };
  socket.timeout(1500).emit('host:close', {}, go);
};

socket.on('connect', () => {
  if (replaced) return;
  const saved = store.get();
  if (!saved) return create();
  socket.emit('host:rejoin', saved, (r) => {
    if (r && r.ok) ready(saved.pin);
    else { store.set(null); create(); }
  });
});

socket.on('host:replaced', () => {
  replaced = true;
  st = null;
  U.clearCountdown();
  app.className = 'screen center wait';
  app.dataset.view = 'replaced';
  app.innerHTML = `<div class="logo"><div class="logo-mark">${Art.star()}</div><div class="logo-text">פיצוץ מוחות</div></div>
    <h2>המשחק נפתח בחלון אחר</h2><div class="muted">המסך הזה כבר לא שולט במשחק.</div>
    <button class="btn" style="max-width:320px" onclick="location.reload()">החזירו את השליטה לכאן</button>`;
});

socket.on('host:state', (s) => {
  if (replaced) return;
  const prev = st;
  st = s;
  try {
    render(prev);
  } catch (e) {
    console.error(e);
  }
});

function render(prev) {
  if (!st) return;
  U.applyScene(st.setup.scene);
  if (st.phase !== 'countdown') U.clearCountdown();
  // classic quiz: the "thinking" song while answering, the scoreboard song between questions
  const cs = st.phase === 'playing' && st.board && st.board.kind === 'classic' ? st.board.stage : null;
  Music.play(st.phase === 'lobby' ? 'lobby' : st.phase === 'ended' ? 'victory' : cs && cs !== 'question' && cs !== 'ready' ? 'between' : 'game');
  if (st.phase === 'lobby') renderLobby();
  else if (st.phase === 'countdown') renderCountdown(prev);
  else if (st.phase === 'playing') Games[st.gameId].hostPlaying(app, st);
  else Games[st.gameId].hostEnded(app, st);
}

function renderCountdown(prev) {
  if (!prev || prev.phase !== 'countdown') U.countdown(st.cd || 3000, esc(st.gameTitle));
  if (!U.view(app, 'countdown')) return;
  app.className = 'screen center wait';
  app.innerHTML = '';
}

// youtube links → video id (watch?v=, youtu.be/, embed/, shorts/)
function youtubeId(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/);
  return m ? m[1] : /^[\w-]{11}$/.test(url || '') ? url : '';
}

function renderLobby() {
  if (U.view(app, 'lobby')) {
    app.className = 'screen lobby';
    app.innerHTML = `
      <div class="lobby-head">
        <div class="logo"><div class="logo-mark">${Art.star()}</div><div class="logo-text">פיצוץ מוחות</div></div>
        <div class="lobby-round" id="round"></div>
        ${U.soundBtn()}
      </div>
      <div class="card join-panel">
        <div class="join-step">היכנסו מהטלפון ל־<b id="joinHost"></b></div>
        <div class="pin-label">קוד המשחק</div>
        <div class="pin" id="pin"></div>
        <div class="join-or"><span>או סרקו</span></div>
        <div class="qr" id="qr"></div>
        <div class="join-url" id="joinUrl"></div>
        <div class="net-row" id="netRow"></div>
        <div class="lobby-video" id="video"></div>
      </div>
      <div class="card lobby-main">
        <div class="quiz-bar">
          <span class="qb-label">📚 חידון:</span>
          <select id="quizSel" class="quiz-sel"></select>
          <span class="qb-count" id="quizCount"></span>
          <a class="btn ghost sm" href="editor.html" target="_blank">✏️ עורך השאלות</a>
        </div>
        <div class="lm-top">
          <div class="lm-tabs"><button data-tab="games">🎮 משחקים</button><button data-tab="room">⚙️ הגדרות חדר</button></div>
          <div class="mode-filter" id="filter">${FILTERS.map(([k, l]) => `<button data-filter="${k}">${l}</button>`).join('')}</div>
        </div>
        <div class="lm-body">
          <div class="game-cards" id="games"></div>
          <div class="room-setup hidden" id="roomSetup">
            <section><h3>שמות השחקנים</h3><div class="opt-cards" id="nameModes">${NAME_MODES.map(([k, l, d]) => `<button class="opt-card" data-name-mode="${k}"><b>${l}</b><small>${d}</small></button>`).join('')}</div></section>
            <section><h3>🎨 רקע <small class="muted">(במסך הגדול ובטלפונים)</small></h3><div class="scene-picks" id="scenes"></div>
              <label class="lite-tog"><input type="checkbox" id="liteMode"> ⚡ מצב חסכוני במחשב הזה (בלי אנימציות ברקע)</label>
              <small class="muted">רקעים משלכם: שימו תמונות או סרטונים בתיקייה <b dir="ltr">backgrounds</b> של התוכנה.</small></section>
            <section><h3>🎬 סרטון בזמן ההמתנה</h3><div class="video-lib" id="videoLib"></div><div class="row"><input class="input sm" id="videoUrl" placeholder="או הדביקו קישור ליוטיוב" dir="ltr"><button class="btn sm blue" id="videoSet">הצג</button><button class="btn sm ghost" id="videoClear">הסר</button></div></section>
            <div id="musicSet">${Music.settingsHtml()}</div>
            <section><h3>🏆 טקסט למנצחים</h3><input class="input sm" id="winText" maxlength="140" placeholder="למשל: כל הכבוד! פרס מחכה לכם אצל המורה 🎁"><small class="muted">יופיע בטלפון של המנצחים ובמסך התוצאות</small></section>
          </div>
        </div>
        <div class="game-info"><div class="blurb" id="blurb"></div><div class="settings" id="settings"></div></div>
        <div class="players-box"><div class="section-title" style="margin-bottom:8px">שחקנים <span class="count" id="count">0</span></div><div class="chips" id="players"></div></div>
        <div class="start-row"><button class="btn big green" id="start">התחילו משחק ▶</button></div>
      </div>`;
    app.onclick = (e) => {
      const k = e.target.closest('[data-kick]');
      if (k) return socket.emit('host:kick', k.dataset.kick);
      const g = e.target.closest('[data-game]');
      if (g && st && g.dataset.game !== st.gameId) { socket.emit('host:game', g.dataset.game); U.sfx('pop'); }
      const t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; renderLobby(); }
      const f = e.target.closest('[data-filter]');
      if (f) { filter = f.dataset.filter; renderLobby(); }
      const nm = e.target.closest('[data-name-mode]');
      if (nm) socket.emit('host:setup', { nameMode: nm.dataset.nameMode });
      const sc = e.target.closest('[data-scene-pick]');
      if (sc) socket.emit('host:setup', { scene: sc.dataset.scenePick });
      const vl = e.target.closest('[data-video-pick]');
      if (vl) { const v = vl.dataset.videoPick; socket.emit('host:setup', { video: st.setup.video === v ? '' : v }); }
    };
    document.getElementById('start').onclick = () => socket.emit('host:start');
    document.getElementById('games').dataset.sig = '';
    const lm = document.getElementById('liteMode');
    lm.checked = Scenes.lite();
    lm.onchange = () => Scenes.setLite(lm.checked);
    // the scene + video galleries (incl. the teacher's own files) load once per lobby
    Scenes.loadFiles().then(() => { document.getElementById('scenes').dataset.sig = ''; renderLobby(); });
    fetch('/api/videos').then((r) => r.json()).then((v) => { videoLib = v; document.getElementById('videoLib').dataset.sig = ''; renderLobby(); }).catch(() => {});
    const vu = document.getElementById('videoUrl');
    document.getElementById('videoSet').onclick = () => {
      if (vu.value && !youtubeId(vu.value)) return alert('זה לא נראה כמו קישור ליוטיוב');
      socket.emit('host:setup', { video: vu.value });
    };
    document.getElementById('videoClear').onclick = () => { vu.value = ''; socket.emit('host:setup', { video: '' }); };
    const wt = document.getElementById('winText');
    wt.onchange = () => socket.emit('host:setup', { winText: wt.value });
    document.getElementById('quizSel').onchange = (e) => socket.emit('host:setup', { quiz: e.target.value });
    Music.bind(document.getElementById('musicSet'));
  }

  // quiz picker
  const qs = document.getElementById('quizSel');
  const sig = (st.quizzes || []).map((q) => q.id + q.title + q.playable + q.folder).join('|');
  if (qs.dataset.sig !== sig) {
    qs.dataset.sig = sig;
    // grouped by library folder
    const opt = (q) => `<option value="${esc(q.id)}" ${q.playable ? '' : 'disabled'}>${esc(q.title)} (${q.playable})</option>`;
    const groups = new Map();
    for (const q of st.quizzes || []) {
      const f = q.folder || '';
      if (!groups.has(f)) groups.set(f, []);
      groups.get(f).push(q);
    }
    qs.innerHTML = [...groups.keys()].sort((a, b) => (a ? 1 : 0) - (b ? 1 : 0) || a.localeCompare(b, 'he'))
      .map((f) => (f ? `<optgroup label="📁 ${esc(f.replace(/\//g, ' › '))}">${groups.get(f).map(opt).join('')}</optgroup>` : groups.get(f).map(opt).join(''))).join('');
  }
  if (document.activeElement !== qs) qs.value = st.setup.quiz;
  const cq = (st.quizzes || []).find((q) => q.id === st.setup.quiz);
  document.getElementById('quizCount').textContent = cq ? `${cq.playable} שאלות מוכנות` : '';

  document.getElementById('pin').textContent = st.pin;
  document.getElementById('round').textContent = st.round ? `🔁 סיבוב ${st.round + 1}` : '';
  renderNet();
  if (joinUrl) {
    document.getElementById('joinUrl').textContent = joinUrl;
    document.getElementById('joinHost').textContent = joinUrl.replace(/^https?:\/\//, '').split('/')[0];
    const qr = document.getElementById('qr');
    if (qr.dataset.u !== joinUrl) {
      qr.dataset.u = joinUrl;
      fetch('/qr?text=' + encodeURIComponent(joinUrl)).then((r) => r.text()).then((svg) => (qr.innerHTML = svg)).catch(() => {});
    }
  }

  // tabs + filter
  document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  document.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('on', b.dataset.filter === filter));
  document.getElementById('filter').classList.toggle('hidden', tab !== 'games');
  document.getElementById('games').classList.toggle('hidden', tab !== 'games');
  document.getElementById('roomSetup').classList.toggle('hidden', tab !== 'room');

  // game cards: build once, then only move the selection / filter
  const box = document.getElementById('games');
  if (box.dataset.sig !== st.games.map((g) => g.id).join()) {
    box.dataset.sig = st.games.map((g) => g.id).join();
    box.innerHTML = st.games
      .map((g) => `<button class="gcard mode-${g.mode}" data-game="${g.id}" data-mode="${g.mode}"><span class="gc-art">${Art.cover(g.id)}</span><span class="gc-body"><span class="tt">${esc(g.title)}</span><span class="md">${MODE_ICON[g.mode]} ${MODE[g.mode]}</span></span></button>`)
      .join('');
  }
  box.querySelectorAll('.gcard').forEach((c) => {
    c.classList.toggle('sel', c.dataset.game === st.gameId);
    c.classList.toggle('hidden', filter !== 'all' && c.dataset.mode !== filter && c.dataset.game !== st.gameId);
  });
  document.getElementById('blurb').textContent = st.games.find((g) => g.id === st.gameId).blurb;

  // room setup
  document.querySelectorAll('[data-name-mode]').forEach((b) => b.classList.toggle('on', b.dataset.nameMode === st.setup.nameMode));
  const scBox = document.getElementById('scenes');
  const scList = Scenes.all();
  if (scBox.dataset.sig !== scList.map((x) => x.id).join()) {
    scBox.dataset.sig = scList.map((x) => x.id).join();
    scBox.innerHTML = scList.map((x) => `<button class="scene-pick" data-scene-pick="${esc(x.id)}" title="${esc(x.name)}">${Scenes.previewHtml(x)}<span class="sp-name">${esc(x.name)}</span></button>`).join('');
  }
  document.querySelectorAll('[data-scene-pick]').forEach((b) => b.classList.toggle('on', b.dataset.scenePick === st.setup.scene));
  const vlBox = document.getElementById('videoLib');
  if (vlBox.dataset.sig !== videoLib.map((v) => v.key).join()) {
    vlBox.dataset.sig = videoLib.map((v) => v.key).join();
    vlBox.innerHTML = videoLib.map((v) => `<button class="vl-pick" data-video-pick="${esc(v.kind === 'youtube' ? 'https://youtu.be/' + v.key : v.key)}">${v.thumb ? `<img src="${esc(v.thumb)}" alt="" loading="lazy">` : '<span class="vl-file">🎞️</span>'}<span>${esc(v.title)}</span></button>`).join('');
  }
  vlBox.querySelectorAll('[data-video-pick]').forEach((b) => b.classList.toggle('on', b.dataset.videoPick === st.setup.video || (youtubeId(b.dataset.videoPick) && youtubeId(b.dataset.videoPick) === youtubeId(st.setup.video))));
  const wt = document.getElementById('winText');
  if (document.activeElement !== wt) wt.value = st.setup.winText || '';
  const vu = document.getElementById('videoUrl');
  if (document.activeElement !== vu && !vu.value && !String(st.setup.video || '').startsWith('file:')) vu.value = st.setup.video || '';
  // a local file from the video library (works without internet) or a YouTube link
  const localVid = String(st.setup.video || '').startsWith('file:') ? videoLib.find((v) => v.key === st.setup.video) : null;
  const vid = localVid ? st.setup.video : youtubeId(st.setup.video);
  const vbox = document.getElementById('video');
  if (vbox.dataset.id !== vid) {
    vbox.dataset.id = vid;
    vbox.innerHTML = localVid ? `<video src="${esc(localVid.url)}" autoplay loop playsinline controls></video>` : vid ? `<iframe src="https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&loop=1&playlist=${vid}&rel=0&modestbranding=1" title="סרטון" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>` : '';
    document.querySelector('.join-panel').classList.toggle('with-video', !!vid);
  }

  renderSettings();
  const count = document.getElementById('count');
  if (count.textContent !== String(st.players.length)) { count.textContent = st.players.length; U.bump(count); }
  renderPlayers();
  document.getElementById('start').disabled = st.players.length < 1;
}

// which network the join address is on, and a switch when the PC has more than one
function renderNet() {
  const row = document.getElementById('netRow');
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const host = joinUrl.replace(/^https?:\/\//, '').split(/[:/]/)[0];
  const cur = addrs.find((a) => a.ip === host);
  const sig = [local, addrs.map((a) => a.ip).join(), host].join('|');
  if (row.dataset.sig === sig) return;
  row.dataset.sig = sig;
  if (local && !addrs.length) {
    row.innerHTML = '<div class="net-warn">⚠️ המחשב לא מחובר לרשת: הטלפונים לא יוכלו להתחבר. התחברו ל־Wi-Fi ורעננו.</div>';
    return;
  }
  if (!cur) return void (row.innerHTML = '');
  row.innerHTML = `<span class="net-chip">${cur.kind === 'wifi' ? '📶' : cur.kind === 'hotspot' ? '📡' : '🔌'} ${esc(cur.label)}${cur.kind === 'wifi' || cur.kind === 'ethernet' ? '' : ` · ${esc(cur.name)}`}</span>${addrs.length > 1 ? `<select id="netSel" title="כתובת אחרת">${addrs.map((a) => `<option value="${esc(a.ip)}" ${a.ip === host ? 'selected' : ''}>${esc(a.label)} · ${esc(a.ip)}</option>`).join('')}</select>` : ''}`;
  const sel = document.getElementById('netSel');
  if (sel) sel.onchange = () => { pickedIp.set(sel.value); ready(st.pin); };
}

function renderPlayers() {
  const el = document.getElementById('players');
  if (!st.players.length) {
    el.innerHTML = `<div class="empty-players">מחכים לשחקנים<span class="dots"><i></i><i></i><i></i></span></div>`;
    return;
  }
  el.querySelector('.empty-players')?.remove();
  const keep = new Set(st.players.map((p) => p.id));
  [...el.children].forEach((c) => { if (!keep.has(c.dataset.id)) c.remove(); });
  for (const p of st.players) {
    let c = el.querySelector(`[data-id="${p.id}"]`);
    if (!c) {
      c = document.createElement('span');
      c.className = 'chip';
      c.dataset.id = p.id;
      c.innerHTML = `<span class="av"></span><span class="nm"></span><button data-kick="${p.id}" title="הסרה" aria-label="הסרה">✕</button>`;
      el.appendChild(c);
      U.sfx('pop');
    }
    // names can change (auto names: reroll)
    if (c.dataset.name !== p.name) {
      c.dataset.name = p.name;
      c.querySelector('.av').innerHTML = U.avatar(p.name);
      c.querySelector('.nm').textContent = p.name;
    }
    c.classList.toggle('off', !p.connected);
  }
}

function renderSettings() {
  const box = document.getElementById('settings');
  const sig = st.gameId + '|' + st.untimed + '|' + st.options.map((o) => o.key + o.label).join();
  if (box.dataset.game !== sig) {
    box.dataset.game = sig;
    const dur = [[120, '2 דקות'], [180, '3 דקות'], [300, '5 דקות'], [480, '8 דקות'], [600, '10 דקות']];
    const sel = (key, label, choices) => `<label>${label}<select data-key="${key}">${choices.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>`;
    box.innerHTML = (st.untimed ? '' : sel('duration', '⏱ משך', dur)) + st.options.map((o) => sel(o.key, o.label, o.choices)).join('');
    box.onchange = () => {
      const s = {};
      box.querySelectorAll('select').forEach((x) => (s[x.dataset.key] = x.value));
      socket.emit('host:settings', s);
    };
  }
  box.querySelectorAll('select').forEach((x) => {
    if (document.activeElement !== x) x.value = st.settings[x.dataset.key];
  });
}

// ---------- players report (stats across every round in this room) ----------
function csv(rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

window.showReport = () => {
  socket.emit('host:report', {}, (r) => {
    if (!r || !r.ok) return;
    const rep = r.report;
    document.getElementById('reportModal')?.remove();
    const m = document.createElement('div');
    m.id = 'reportModal';
    m.className = 'modal';
    m.innerHTML = `<div class="modal-card">
      <div class="modal-head"><h2>📊 דוח שחקנים</h2><span class="muted">${rep.rounds.length} סיבובים · ${rep.players.length} שחקנים</span>
        <div class="modal-actions"><button class="btn sm blue" id="csvSum">⬇ סיכום (CSV)</button><button class="btn sm ghost" id="csvAns">⬇ כל התשובות (CSV)</button><button class="btn sm ghost" id="closeRep">✕</button></div></div>
      <div class="modal-body">
        <table class="rep"><thead><tr><th>שם</th><th>נקודות</th><th>נכונות</th><th>שגויות</th><th>דיוק</th>${rep.rounds.map((x) => `<th>סיבוב ${x.round}<small>${esc(x.game)}</small></th>`).join('')}</tr></thead>
        <tbody>${rep.players.map((p, i) => `<tr class="rp" data-i="${i}"><td><span class="nm">${U.avatar(p.name)}${esc(p.name)}</span></td><td>${p.points}</td><td class="good-t">${p.correct}</td><td class="bad-t">${p.wrong}</td><td><span class="acc" style="--a:${p.accuracy}%">${p.accuracy}%</span></td>${rep.rounds.map((x) => { const rr = p.rounds.find((y) => y.round === x.round); return `<td>${rr ? `${rr.score}<small>מקום ${rr.rank}</small>` : '—'}</td>`; }).join('')}</tr>
          <tr class="rp-detail hidden" id="rd${i}"><td colspan="${5 + rep.rounds.length}"><div class="answers-log">${p.answers.map((a) => `<div class="al ${a.ok ? 'ok' : 'no'}"><span>${a.ok ? '✅' : '❌'}</span><b>${esc(a.q)}</b><span>ענה/תה: ${esc(a.chosen)}</span>${a.ok ? '' : `<span class="muted">נכון: ${esc(a.answer)}</span>`}<small>${(a.ms / 1000).toFixed(1)} שנ׳</small></div>`).join('') || '<span class="muted">אין תשובות</span>'}</div></td></tr>`).join('')}</tbody></table>
        <div class="muted" style="margin-top:8px">לחצו על שחקן כדי לראות את כל התשובות שלו. עותק נשמר גם בתיקייה reports בשרת.</div>
      </div></div>`;
    document.body.appendChild(m);
    m.onclick = (e) => {
      if (e.target === m || e.target.id === 'closeRep') return m.remove();
      const row = e.target.closest('.rp');
      if (row) document.getElementById('rd' + row.dataset.i).classList.toggle('hidden');
    };
    const day = new Date().toISOString().slice(0, 10);
    document.getElementById('csvSum').onclick = () =>
      download(`report-${day}-${rep.pin}.csv`, csv([['שם', 'נקודות', 'נכונות', 'שגויות', 'דיוק %', ...rep.rounds.map((x) => `סיבוב ${x.round} - ${x.game}`)], ...rep.players.map((p) => [p.name, p.points, p.correct, p.wrong, p.accuracy, ...rep.rounds.map((x) => (p.rounds.find((y) => y.round === x.round) || {}).score ?? '')])]));
    document.getElementById('csvAns').onclick = () =>
      download(`answers-${day}-${rep.pin}.csv`, csv([['שם', 'סיבוב', 'משחק', 'שאלה', 'תשובה שנבחרה', 'תשובה נכונה', 'נכון?', 'זמן (שניות)'], ...rep.players.flatMap((p) => p.answers.map((a) => [p.name, a.round, a.game, a.q, a.chosen, a.answer, a.ok ? 'כן' : 'לא', (a.ms / 1000).toFixed(1)]))]));
  });
};

// coming back from the editor tab: re-read the quiz library
window.addEventListener('focus', () => { if (st && st.phase === 'lobby') socket.emit('host:quizzes'); });
