// Background music on the big screen (host only). Tracks are the mp3 files in the server's music folder.
// Choices (on/off, volume, a track per moment) are remembered on this computer.
window.Music = (function () {
  const KEY = 'qg-music';
  const SLOTS = [['lobby', '🎈 לובי (המתנה)'], ['game', '🎮 בזמן המשחק'], ['between', '📊 בין שאלות'], ['victory', '🏆 ניצחון']];
  const DEFAULTS = { lobby: 'M1-1', game: 'M2-1', between: 'M4-1', victory: 'M3-1' };
  // song groups by file prefix (M1-… lobby, M2-… thinking…): a moment can play "random from a group" so a long lesson does not repeat one song
  const GROUPS = [['M1', '🎈 לובי'], ['M2', '🤔 חשיבה'], ['M3', '🏆 ניצחון'], ['M4', '📊 בין שאלות'], ['M5', '🤝 שיתופי ורגוע'], ['M6', '⚡ אקשן'], ['M7', '📚 שיעור ולמידה']];
  const isRand = (v) => v === 'rand:all' || /^rand:M\d$/.test(v || '');
  const picks = {};
  const lastPick = {};
  let cfg = { on: true, volume: 0.45, tracks: {} };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
  let tracks = [];
  let audio = null;
  let curSlot = null;
  let curUrl = null;
  let blocked = false;

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {} };

  async function init() {
    try { tracks = await (await fetch('/api/music')).json(); } catch { tracks = []; }
    // a default song per moment (by the file prefix), falling back to any song
    for (const [slot] of SLOTS) {
      if (cfg.tracks[slot] && (cfg.tracks[slot] === 'none' || isRand(cfg.tracks[slot]) || tracks.some((t) => t.file === cfg.tracks[slot]))) continue;
      const t = tracks.find((x) => x.file.startsWith(DEFAULTS[slot])) || tracks.find((x) => x.file.startsWith('M1')) || tracks[0];
      cfg.tracks[slot] = t ? t.file : 'none';
    }
    save();
    drawButton();
    if (curSlot) { const s = curSlot; curSlot = null; play(s); }
  }

  const urlFor = (slot) => {
    const f = cfg.tracks[slot];
    if (isRand(f)) {
      // keep the song that is playing until it ends, then draw another (never the same one twice in a row)
      if (picks[slot] && tracks.some((t) => t.url === picks[slot])) return picks[slot];
      const pool = f === 'rand:all' ? tracks : tracks.filter((t) => t.file.startsWith(f.slice(5) + '-'));
      if (!pool.length) return null;
      const choices = pool.length > 1 ? pool.filter((t) => t.url !== lastPick[slot]) : pool;
      const t = choices[Math.floor(Math.random() * choices.length)];
      picks[slot] = lastPick[slot] = t.url;
      return t.url;
    }
    const t = tracks.find((x) => x.file === f);
    return t ? t.url : null;
  };

  function fade(el, to, ms, done) {
    const from = el.volume;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k < 1) requestAnimationFrame(step);
      else if (done) done();
    };
    requestAnimationFrame(step);
  }

  function play(slot) {
    curSlot = slot;
    if (!tracks.length) return;
    const url = cfg.on ? urlFor(slot) : null;
    if (url === curUrl && audio && !audio.paused) return;
    const old = audio;
    if (old) fade(old, 0, 700, () => old.pause());
    curUrl = url;
    audio = null;
    if (!url) return;
    const a = new Audio(url);
    const rand = isRand(cfg.tracks[slot]);
    a.loop = slot !== 'victory' && !rand;
    if (rand && slot !== 'victory') a.onended = () => { if (audio === a) { delete picks[slot]; curUrl = null; play(slot); } };
    a.volume = 0;
    audio = a;
    a.play().then(() => { blocked = false; fade(a, cfg.volume, 900); }).catch(() => { blocked = true; drawButton(); });
  }

  // browsers block sound until the first click: retry then
  document.addEventListener('pointerdown', () => {
    if (blocked && audio && cfg.on) {
      audio.play().then(() => { blocked = false; fade(audio, cfg.volume, 600); drawButton(); }).catch(() => {});
    }
  });

  function toggle() {
    cfg.on = !cfg.on;
    save();
    if (cfg.on) { curUrl = null; play(curSlot); }
    else if (audio) { const a = audio; fade(a, 0, 400, () => a.pause()); audio = null; curUrl = null; }
    drawButton();
    const box = document.getElementById('musicOn');
    if (box) box.checked = cfg.on;
  }

  function setVolume(v) {
    cfg.volume = Math.max(0, Math.min(1, v));
    save();
    if (audio) audio.volume = cfg.volume;
  }

  function setTrack(slot, file) {
    cfg.tracks[slot] = file;
    delete picks[slot];
    save();
    if (slot === curSlot) { curUrl = null; play(slot); }
  }

  function preview(file) {
    const t = tracks.find((x) => x.file === file);
    if (!t) return;
    const old = audio;
    if (old) fade(old, 0, 300, () => old.pause());
    curUrl = t.url;
    audio = new Audio(t.url);
    audio.volume = cfg.volume;
    audio.loop = true;
    audio.play().catch(() => {});
  }

  // floating 🎵 button on every host screen
  function drawButton() {
    let b = document.getElementById('musicBtn');
    if (!b) {
      b = document.createElement('button');
      b.id = 'musicBtn';
      b.className = 'music-btn';
      b.title = 'מוזיקה';
      b.onclick = toggle;
      document.body.appendChild(b);
    }
    b.classList.toggle('off', !cfg.on);
    b.classList.toggle('blocked', cfg.on && blocked);
    b.innerHTML = cfg.on ? (blocked ? '🎵 לחצו להפעלה' : '🎵') : '🔇';
    b.hidden = !tracks.length;
  }

  // the music section of the room settings tab
  function settingsHtml() {
    if (!tracks.length) return '<section><h3>🎵 מוזיקה</h3><div class="muted">אין שירים בתיקייה music</div></section>';
    const opts = (sel) => `<option value="none" ${sel === 'none' ? 'selected' : ''}>ללא</option><optgroup label="🔀 אקראי">` +
      `<option value="rand:all" ${sel === 'rand:all' ? 'selected' : ''}>🔀 כל השירים</option>` +
      GROUPS.filter(([g]) => tracks.some((t) => t.file.startsWith(g + '-'))).map(([g, l]) => `<option value="rand:${g}" ${sel === 'rand:' + g ? 'selected' : ''}>🔀 ${l}</option>`).join('') +
      '</optgroup>' + tracks.map((t) => `<option value="${U.esc(t.file)}" ${t.file === sel ? 'selected' : ''}>${U.esc(t.title)}</option>`).join('');
    return `<section class="music-set"><h3>🎵 מוזיקה (במסך הגדול)</h3>
      <div class="ms-row"><label class="tog"><input type="checkbox" id="musicOn" ${cfg.on ? 'checked' : ''}> מוזיקה פועלת</label>
      <label class="ms-vol">🔉 <input type="range" id="musicVol" min="0" max="1" step="0.05" value="${cfg.volume}"> 🔊</label></div>
      <div class="ms-slots">${SLOTS.map(([k, l]) => `<label>${l}<span class="ms-sel"><select data-slot="${k}">${opts(cfg.tracks[k])}</select><button class="ms-play" data-play="${k}" title="השמעה">▶</button></span></label>`).join('')}</div></section>`;
  }

  function bind(root) {
    const on = root.querySelector('#musicOn');
    if (!on) return;
    on.onchange = () => { if (on.checked !== cfg.on) toggle(); };
    root.querySelector('#musicVol').oninput = (e) => setVolume(Number(e.target.value));
    root.querySelectorAll('[data-slot]').forEach((s) => (s.onchange = () => setTrack(s.dataset.slot, s.value)));
    root.querySelectorAll('[data-play]').forEach((b) => (b.onclick = () => { const v = cfg.tracks[b.dataset.play]; if (isRand(v)) { delete picks[b.dataset.play]; const u = urlFor(b.dataset.play); const t = tracks.find((x) => x.url === u); if (t) preview(t.file); } else preview(v); }));
  }

  init();
  return { play, toggle, settingsHtml, bind, refresh: init };
})();
