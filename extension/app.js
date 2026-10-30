// The import page: find Kahoot quizzes (on the open tab, or by searching), choose some, then save them as one file
// or send them straight to the running program.
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get: (k, d) => new Promise((res) => (chrome.storage ? chrome.storage.local.get({ [k]: d }, (v) => res(v[k])) : res(d))),
    set: (k, v) => chrome.storage && chrome.storage.local.set({ [k]: v }),
  };

  // pageNote / searchNote: what to show in a list when it has no quizzes (nothing found, an error)
  const state = { tab: 'page', found: [], results: [], query: '', next: 0, more: false, selected: new Map(), busy: false, pageNote: '', searchNote: '' };

  // ---------- runs inside the Kahoot page (injected): every quiz it links to, or the one it shows ----------
  function scanPage() {
    const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const out = new Map();
    const clean = (t) => String(t || '').replace(/\s+/g, ' ').replace(/\s*[|·–-]\s*Kahoot!?\s*$/i, '').trim().slice(0, 120);
    const add = (uuid, title, cover) => {
      uuid = uuid.toLowerCase();
      const old = out.get(uuid);
      if (!old) out.set(uuid, { uuid, title: clean(title), cover: cover || '' });
      else {
        if (!old.title && title) old.title = clean(title);
        if (!old.cover && cover) old.cover = cover;
      }
    };
    // the page of one quiz (its details page, or the editor)
    const here = location.pathname.match(UUID);
    if (here && /\/(details|creator|kahoots)\b/.test(location.pathname)) add(here[0], document.title);
    // every card that links to a quiz
    for (const a of document.querySelectorAll('a[href]')) {
      const m = a.getAttribute('href').match(UUID);
      if (!m || !/\/(details|creator|kahoots)\b/.test(a.getAttribute('href'))) continue;
      const img = a.querySelector('img');
      add(m[0], a.getAttribute('aria-label') || a.getAttribute('title') || (img && img.alt) || a.textContent, img && img.src);
    }
    // links that are only in the page's source (server-rendered lists)
    const re = /\/details\/[^"'\s<>]*?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
    let m;
    const html = document.documentElement.innerHTML;
    while ((m = re.exec(html)) && out.size < 300) add(m[1], '');
    return [...out.values()];
  }

  // ---------- rendering ----------
  const ico = (it) => (it.cover ? `<img class="cov" src="${esc(it.cover)}" alt="" loading="lazy">` : '<div class="cov">🧠</div>');
  function card(it) {
    const meta = [it.author && '👤 ' + it.author, it.questions ? it.questions + ' שאלות' : ''].filter(Boolean).join(' · ');
    return `<div class="item ${state.selected.has(it.uuid) ? 'on' : ''}" data-id="${esc(it.uuid)}">${ico(it)}<div class="tx"><div class="tt">${esc(it.title || 'חידון ' + it.uuid.slice(0, 8))}</div>${meta ? `<div class="mt">${esc(meta)}</div>` : ''}</div><div class="ck">${state.selected.has(it.uuid) ? '✓' : ''}</div></div>`;
  }
  function draw() {
    $('#pageList').innerHTML = state.found.length ? state.found.map(card).join('') : state.pageNote;
    $('#searchList').innerHTML = state.results.length ? state.results.map(card).join('') : state.searchNote;
    $('#moreBtn').classList.toggle('hidden', !(state.tab === 'search' && state.more));
    const n = state.selected.size;
    $('#selCount').textContent = n;
    $('#saveBtn').disabled = !n || state.busy;
    $('#sendBtn').disabled = !n || state.busy;
    $('#selClear').classList.toggle('hidden', !n);
  }
  const say = (html, cls) => {
    $('#status').classList.remove('hidden');
    const m = $('#msg');
    m.className = cls || '';
    m.innerHTML = html;
  };
  const bar = (frac) => ($('#prog').style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%');

  // ---------- this page ----------
  async function kahootTab() {
    const from = Number(new URLSearchParams(location.search).get('from'));
    const tabs = await chrome.tabs.query({ url: ['https://*.kahoot.it/*', 'https://kahoot.com/*'] });
    return tabs.find((t) => t.id === from) || tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] || null;
  }
  async function scan() {
    $('#pageHint').textContent = 'מחפש חידונים בדף…';
    state.found = [];
    state.pageNote = '';
    draw();
    let tab = null;
    try {
      tab = await kahootTab();
    } catch {}
    if (!tab) {
      $('#pageHint').textContent = '';
      state.pageNote = '<div class="empty"><b>לא נמצא דף של Kahoot פתוח.</b><br>פתחו חידון (או תוצאות חיפוש) באתר Kahoot בלשונית אחרת, ולחצו "סריקה מחדש".<br>או עברו ללשונית 🔎 חיפוש כדי לחפש כאן.</div>';
      draw();
      return;
    }
    try {
      const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scanPage });
      state.found = (r && r.result) || [];
    } catch (e) {
      $('#pageHint').textContent = '';
      state.pageNote = '<div class="empty">לא הצלחנו לקרוא את הדף. רעננו אותו ונסו שוב.</div>';
      draw();
      return;
    }
    $('#pageHint').textContent = state.found.length ? `נמצאו ${state.found.length} חידונים ב־"${(tab.title || '').slice(0, 40)}". סמנו את מי שרוצים.` : '';
    if (!state.found.length) state.pageNote = '<div class="empty"><b>לא נמצאו חידונים בדף הזה.</b><br>פתחו דף של חידון, או תוצאות חיפוש (גללו כדי שיטענו), ולחצו "סריקה מחדש".</div>';
    else if (state.found.length === 1 && !state.selected.size) state.selected.set(state.found[0].uuid, state.found[0]);
    draw();
  }

  // ---------- search ----------
  async function runSearch(more) {
    const q = $('#q').value.trim();
    if (!q) return;
    if (!more) {
      state.query = q;
      state.results = [];
      state.next = 0;
    }
    state.searchNote = '';
    $('#searchHint').textContent = 'מחפש…';
    try {
      const r = await KahootApi.search(state.query, { cursor: state.next, limit: 24 });
      state.results = state.results.concat(r.items.filter((x) => !state.results.some((y) => y.uuid === x.uuid)));
      state.next = r.next;
      state.more = r.more;
      $('#searchHint').textContent = state.results.length ? `מוצגים ${state.results.length} מתוך ${r.total.toLocaleString('he')} חידונים` : '';
      if (!state.results.length) state.searchNote = '<div class="empty"><b>לא נמצאו חידונים.</b><br>נסו מילה אחרת.</div>';
    } catch (e) {
      $('#searchHint').textContent = '';
      state.more = false;
      state.searchNote = `<div class="empty">${esc(e.message)}</div>`;
    }
    draw();
  }

  // ---------- export ----------
  async function makeExport() {
    state.busy = true;
    draw();
    bar(0);
    say('מתחיל…');
    try {
      const res = await KahootApi.buildExport([...state.selected.keys()], {
        JSZip: window.JSZip,
        onProgress: (p) => {
          if (p.phase === 'quiz') { bar((p.done / Math.max(1, p.total)) * 0.4); say(`מוריד חידון ${Math.min(p.done + 1, p.total)} מתוך ${p.total}…<small>${esc(p.title || '')}</small>`); }
          else if (p.phase === 'image') { bar(0.4 + (p.done / Math.max(1, p.total)) * 0.55); say(`מוריד תמונות: ${p.done} מתוך ${p.total}…`); }
          else { bar(0.97); say('אורז לקובץ…'); }
        },
      });
      bar(1);
      return res;
    } finally {
      state.busy = false;
      draw();
    }
  }
  const summary = (res, extra) => {
    const bits = [`${res.quizzes} חידונים`, `${res.images} תמונות`];
    let html = `✔ ${bits.join(' · ')}${extra || ''}`;
    if (res.missingImages) html += `<small>${res.missingImages} תמונות לא ירדו (השאלות יובאו בלעדיהן)</small>`;
    if (res.failed.length) html += `<small>${res.failed.length} חידונים נכשלו: ${esc(res.failed.slice(0, 3).map((f) => f.error).join(' · '))}</small>`;
    return html;
  };

  async function save() {
    try {
      const res = await makeExport();
      if (!res.quizzes) return say(`לא הצלחנו להוריד אף חידון.<small>${esc(res.failed.map((f) => f.error).slice(0, 2).join(' · '))}</small>`, 'bad');
      const blob = new Blob([res.data], { type: 'application/zip' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `kahoot-export-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      say(summary(res, `<br>הקובץ נשמר. בעורך החידונים של פיצוץ מוחות לחצו <b>⬆ ייבוא קובץ</b> ובחרו אותו.`), 'ok');
    } catch (e) {
      say(esc(e.message), 'bad');
    }
  }

  const serverOrigin = () => {
    let v = $('#serverUrl').value.trim();
    if (!v) v = 'http://localhost:3000';
    if (!/^https?:\/\//i.test(v)) v = 'http://' + v;
    try {
      return new URL(v).origin;
    } catch {
      return null;
    }
  };
  async function allowed(origin) {
    if (!chrome.permissions) return true;
    const pattern = origin + '/*';
    if (await chrome.permissions.contains({ origins: [pattern] })) return true;
    return chrome.permissions.request({ origins: [pattern] }); // needs the click that called us
  }

  async function send() {
    const origin = serverOrigin();
    if (!origin) return say('כתובת התוכנה לא תקינה', 'bad');
    $('#server').open = true;
    // the permission prompt must come straight from the click, before any waiting
    if (!(await allowed(origin))) return say('בלי אישור הגישה לא אפשר לשלוח. אפשר לשמור כקובץ במקום.', 'bad');
    await store.set('server', $('#serverUrl').value.trim());
    try {
      const res = await makeExport();
      if (!res.quizzes) return say(`לא הצלחנו להוריד אף חידון.<small>${esc(res.failed.map((f) => f.error).slice(0, 2).join(' · '))}</small>`, 'bad');
      say('שולח לתוכנה…');
      const r = await fetch(`${origin}/api/q/import?title=${encodeURIComponent('Kahoot')}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: res.data });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return say(`התוכנה דחתה את הקובץ: ${esc(d.error || r.status)}`, 'bad');
      const skipped = d.skipped ? `<small>${d.skipped} שאלות דולגו (סוג שלא נתמך או חסר חלק). הפירוט בדוח הייבוא בעורך.</small>` : '';
      say(`${summary(res, ` · ${d.questions || d.count} שאלות יובאו`)}${skipped}<br>נוספו לספריית החידונים בתוכנה${d.folder ? ` (תיקייה "${esc(d.folder.split('/').pop())}")` : ''}. <a href="${esc(origin)}/editor.html" target="_blank" style="color:#ffd23f">פתיחת העורך</a>`, 'ok');
    } catch (e) {
      say(`לא הצלחנו להגיע לתוכנה ב־${esc(origin)}. ודאו שהיא פועלת ושהכתובת נכונה.<small>${esc(e.message)}</small>`, 'bad');
    }
  }

  async function testServer() {
    const origin = serverOrigin();
    if (!origin) return say('כתובת התוכנה לא תקינה', 'bad');
    if (!(await allowed(origin))) return say('בלי אישור הגישה לא אפשר להתחבר.', 'bad');
    try {
      const r = await fetch(origin + '/api/q/quizzes');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const list = await r.json();
      say(`✔ מחובר לתוכנה (${list.filter((x) => !x.builtin).length} חידונים בספרייה)`, 'ok');
    } catch (e) {
      say(`לא הצלחנו להתחבר ל־${esc(origin)}. ודאו שהתוכנה פועלת.`, 'bad');
    }
  }

  // ---------- wiring ----------
  function toggle(e) {
    const el = e.target.closest('.item');
    if (!el) return;
    const id = el.dataset.id;
    if (state.selected.has(id)) state.selected.delete(id);
    else {
      if (state.selected.size >= KahootApi.MAX_QUIZZES) return say(`אפשר לייצא עד ${KahootApi.MAX_QUIZZES} חידונים בבת אחת`, 'bad');
      state.selected.set(id, [...state.found, ...state.results].find((x) => x.uuid === id) || { uuid: id });
    }
    draw();
  }

  async function init() {
    $('#tabs').onclick = (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      state.tab = b.dataset.tab;
      document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x === b));
      $('#pagePane').classList.toggle('hidden', state.tab !== 'page');
      $('#searchPane').classList.toggle('hidden', state.tab !== 'search');
      if (state.tab === 'search') $('#q').focus();
      draw();
    };
    $('#pageList').onclick = toggle;
    $('#searchList').onclick = toggle;
    $('#rescan').onclick = scan;
    $('#searchForm').onsubmit = (e) => { e.preventDefault(); runSearch(false); };
    $('#moreBtn').onclick = () => runSearch(true);
    $('#selClear').onclick = () => { state.selected.clear(); draw(); };
    $('#saveBtn').onclick = save;
    $('#sendBtn').onclick = send;
    $('#testBtn').onclick = testServer;
    $('#serverUrl').value = (await store.get('server', '')) || '';
    $('#serverUrl').placeholder = 'http://localhost:3000';
    draw();
    scan();
  }
  init();
})();
