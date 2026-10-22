// Quiz editor: library of quizzes in the admin's folder + a question-by-question editor (autosaves).
(function () {
  const { esc } = U;
  const app = document.getElementById('app');
  const TYPES = [
    ['quiz', 'חידון', 'תשובה אחת או יותר נכונות (2–6)', '🔷'],
    ['tf', 'נכון / לא נכון', 'שתי תשובות', '⚖️'],
    ['type', 'הקלדת תשובה', 'השחקן מקליד, כמה איותים מותרים', '⌨️'],
    ['slider', 'סרגל מספרים', 'בוחרים מספר בטווח', '🎚️'],
    ['order', 'סידור', 'מסדרים פריטים בסדר הנכון', '🔢'],
    ['pin', 'סימון על תמונה', 'לוחצים על המקום הנכון', '📍'],
    ['puzzle', 'פאזל אמיתי', 'התמונה נחתכת לחלקי פאזל שמרכיבים', '🧩'],
    ['poll', 'סקר', 'בלי תשובה נכונה · חידון קלאסי בלבד', '📊'],
    ['slide', 'שקופית מידע', 'רק טקסט/תמונה · חידון קלאסי בלבד', '🖼️'],
  ];
  const TYPE = Object.fromEntries(TYPES.map((t) => [t[0], t]));
  const TIMES = [5, 10, 20, 30, 45, 60, 90, 120, 180, 240];
  const POINTS = [[0, 'ללא ניקוד'], [1, 'רגיל'], [2, 'כפול ×2'], [3, 'משולש ×3'], [4, 'מרובע ×4']];
  const COLORS = ['#e9334f', '#1f73e0', '#e6a400', '#23a14a', '#8b5cf6', '#0fa3b8'];

  let quiz = null; // the quiz being edited
  let cur = 0; // selected question index
  let saveTimer = null;
  let filter = '';

  // ---------- api ----------
  async function api(path, opts = {}) {
    const { headers, ...rest } = opts;
    const json = typeof opts.body === 'string';
    const res = await fetch('/api/q' + path, { ...rest, headers: json ? { 'Content-Type': 'application/json' } : headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'שגיאה'), { issues: data.issues });
    return data;
  }
  const toast = (text, bad) => {
    const t = document.createElement('div');
    t.className = 'ed-toast' + (bad ? ' bad' : '');
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  };

  // ---------- question factory ----------
  function blank(type) {
    const q = { type, text: '', time: 20, points: 1 };
    if (type === 'quiz') q.answers = [{ text: '', correct: true }, { text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }];
    if (type === 'poll') q.answers = [{ text: '' }, { text: '' }, { text: '' }, { text: '' }];
    if (type === 'tf') q.answers = [{ text: 'נכון', correct: true }, { text: 'לא נכון', correct: false }];
    if (type === 'type') q.accept = [''];
    if (type === 'slider') q.slider = { min: 0, max: 100, step: 1, answer: 50, tol: 0 };
    if (type === 'order') q.items = ['', '', ''];
    if (type === 'pin') q.pin = { x: 50, y: 50, r: 10 };
    if (type === 'puzzle') { q.puzzle = { rows: 3, cols: 3 }; q.time = 60; }
    if (type === 'slide') q.points = 0;
    return q;
  }
  // switching type keeps the text/picture/time
  function convert(q, type) {
    const n = blank(type);
    n.text = q.text;
    n.time = q.time;
    if (type !== 'slide') n.points = q.points;
    if (q.image) n.image = q.image;
    if (q.reveal) n.reveal = q.reveal;
    if (q.revealSec) n.revealSec = q.revealSec;
    if (q.video) n.video = q.video;
    if (q.explain) n.explain = q.explain;
    if ((type === 'quiz' || type === 'poll') && q.answers && q.type !== 'tf') n.answers = q.answers.map((a) => ({ text: a.text, correct: type === 'quiz' && !!a.correct }));
    return n;
  }
  // what is still missing before the question can be played
  function problems(q) {
    const p = [];
    if (!q.text.trim()) p.push('חסר טקסט לשאלה');
    if (q.type === 'quiz') {
      if (q.answers.filter((a) => a.text.trim()).length < 2) p.push('צריך לפחות 2 תשובות');
      if (!q.answers.some((a) => a.correct && a.text.trim())) p.push('סמנו תשובה נכונה');
    }
    if (q.type === 'type' && !q.accept.some((a) => a.trim())) p.push('הוסיפו תשובה נכונה אחת לפחות');
    if (q.type === 'order' && q.items.filter((x) => x.trim()).length < 2) p.push('צריך לפחות 2 פריטים');
    if (q.type === 'pin' && !q.image) p.push('צריך תמונה כדי לסמן עליה');
    if (q.type === 'puzzle' && !q.image) p.push('צריך תמונה כדי לחתוך לפאזל');
    if (q.type === 'slider' && (q.slider.answer < q.slider.min || q.slider.answer > q.slider.max)) p.push('התשובה מחוץ לטווח');
    return p;
  }
  const mediaUrl = (name) => `/media/${encodeURIComponent(quiz.id)}/${encodeURIComponent(name)}`;

  // ---------- saving ----------
  function dirty() {
    setStatus('saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 700);
  }
  async function save() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!quiz || quiz.builtin) return;
    try {
      await api('/quizzes/' + encodeURIComponent(quiz.id), { method: 'PUT', body: JSON.stringify({ title: quiz.title, description: quiz.description, questions: quiz.questions }) });
      setStatus('saved');
    } catch (e) {
      setStatus('error');
      toast('השמירה נכשלה: ' + e.message, true);
    }
  }
  function setStatus(s) {
    const el = document.getElementById('status');
    if (el) {
      el.className = 'ed-status ' + s;
      el.textContent = { saving: 'שומר…', saved: 'נשמר ✓', error: 'לא נשמר!' }[s];
    }
  }
  window.addEventListener('beforeunload', (e) => {
    if (saveTimer) { save(); e.preventDefault(); }
  });

  // ---------- library: folders + quizzes ----------
  let curFolder = ''; // '' = top level, '*' = every quiz
  const ICONS = ['🧠', '🌍', '🔬', '📚', '🎨', '🧮'];
  const parentOf = (p) => p.split('/').slice(0, -1).join('/');
  const inFolder = (p, root) => p === root || p.startsWith(root + '/');
  // the address other computers use to reach this one (Wi-Fi first), for share links
  let shareBase = '';
  async function linkBase() {
    if (shareBase) return shareBase;
    shareBase = location.origin;
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
      try {
        const info = await (await fetch('/api/info')).json();
        if (info.publicUrl) shareBase = info.publicUrl.replace(/\/$/, '');
        else if (info.addresses && info.addresses[0]) shareBase = `http://${info.addresses[0].ip}:${info.port}`;
      } catch {}
    }
    return shareBase;
  }

  async function library() {
    quiz = null;
    let list = [];
    let folders = [];
    let root = '';
    try {
      [list, folders, { folder: root }] = await Promise.all([api('/quizzes'), api('/folders'), api('/folder')]);
    } catch (e) {
      app.innerHTML = `<div class="screen center wait"><h2>${esc(e.message)}</h2><div class="muted">פתחו את העורך מהמחשב שמריץ את השרת (localhost:3000/editor.html)</div></div>`;
      return;
    }
    if (curFolder !== '*' && curFolder && !folders.some((f) => f.path === curFolder)) curFolder = '';
    app.innerHTML = `
      <header class="ed-head">
        <div class="logo"><div class="logo-mark">${Art.star()}</div><div class="logo-text">ספריית החידונים</div></div>
        <button class="folder-chip" id="folderBtn" title="המקום שבו נשמרים החידונים במחשב">💾 <span dir="ltr">${esc(root)}</span> · שינוי</button>
        <button class="btn ghost sm" id="sharesBtn">🔗 קישורים ששיתפתי</button>
        <a class="btn ghost sm" href="host.html">🎮 למסך המשחק</a>
      </header>
      <div class="lib-wrap">
        <aside class="lib-side" id="side">
          <button class="btn green sm" id="newFolder">+ תיקייה חדשה</button>
          <div class="tree" id="tree"></div>
          <div class="muted lib-tip">גררו חידון לתיקייה כדי להעביר אותו</div>
        </aside>
        <main class="lib-main">
          <div class="lib-bar"><nav class="crumbs" id="crumbs"></nav><div class="folder-acts" id="folderActs"></div></div>
          <div class="lib-tools">
            <button class="btn green sm" id="newQuiz">+ חידון חדש</button>
            <label class="btn blue sm">⬆ ייבוא קובץ<input type="file" id="importFile" accept=".xlsx,.zip,.qgz" hidden></label>
            <button class="btn ghost sm" id="importLink">🔗 ייבוא מקישור</button>
            <button class="btn ghost sm" id="freeText">📝 ייבוא חופשי</button>
            <a class="btn ghost sm" href="/api/q/template.xlsx">⬇ תבנית ריקה</a>
            <input class="input sm search" id="search" placeholder="🔍 חיפוש" value="${esc(filter)}">
          </div>
          <div class="lib-grid" id="grid"></div>
        </main>
      </div>`;

    const draw = () => {
      // folder tree
      const node = (path, name, icon, count, depth) => `<button class="tf ${curFolder === path ? 'on' : ''}" data-folder="${esc(path)}" style="--d:${depth}" ${path === '*' ? '' : 'data-drop="1"'}><span class="tf-ic">${icon}</span><span class="tf-n">${esc(name)}</span>${count ? `<b>${count}</b>` : ''}</button>`;
      const rootCount = list.filter((q) => !q.builtin && !q.folder).length + 1;
      document.getElementById('tree').innerHTML =
        node('*', 'כל החידונים', '📚', list.length, 0) + node('', 'ראשי', '🏠', rootCount, 0) +
        folders.map((f) => node(f.path, f.name, curFolder === f.path || inFolder(curFolder, f.path) ? '📂' : '📁', f.count, f.depth + 1)).join('');
      // breadcrumbs
      const segs = curFolder && curFolder !== '*' ? curFolder.split('/') : [];
      document.getElementById('crumbs').innerHTML = curFolder === '*' ? '<b>📚 כל החידונים</b>' :
        [`<button data-folder="">🏠 ראשי</button>`, ...segs.map((s, i) => `<span>›</span><button data-folder="${esc(segs.slice(0, i + 1).join('/'))}">${esc(s)}</button>`)].join('');
      document.getElementById('folderActs').innerHTML = curFolder && curFolder !== '*'
        ? `<button data-fact="rename">✏️ שינוי שם</button><button data-fact="share">🔗 שיתוף התיקייה</button><a href="/api/q/folder-package?path=${encodeURIComponent(curFolder)}">⬇ הורדה</a><button data-fact="del" class="del">🗑</button>` : '';
      // sub folders + quizzes
      const f = filter.trim();
      const subs = curFolder === '*' || f ? [] : folders.filter((x) => parentOf(x.path) === curFolder);
      const qs = list.filter((q) => (!f || q.title.includes(f)) && (curFolder === '*' || f || (q.builtin ? curFolder === '' : (q.folder || '') === curFolder)));
      document.getElementById('grid').innerHTML =
        subs.map((x, i) => `<button class="fcard" data-folder="${esc(x.path)}" data-drop="1" style="--i:${i}"><span class="fc-ic">📁</span><b>${esc(x.name)}</b><small>${x.count} חידונים</small></button>`).join('') +
        qs.map((q, i) => `<div class="qcard" style="--i:${i + subs.length}" ${q.builtin ? '' : `draggable="true" data-drag="${esc(q.id)}"`}>
          <div class="qc-cover" data-open="${esc(q.id)}">${q.cover ? `<img src="/media/${encodeURIComponent(q.id)}/${encodeURIComponent(q.cover)}" alt="" loading="lazy">` : `<span>${ICONS[i % 6]}</span>`}<b class="qc-count">${q.count} שאלות</b>${q.types && q.types.some((t) => t !== 'quiz' && t !== 'tf') ? `<b class="qc-types">${q.types.includes('puzzle') ? '🧩' : ''}${q.types.includes('pin') ? '📍' : ''}${q.types.includes('slider') ? '🎚️' : ''}${q.types.includes('type') ? '⌨️' : ''}</b>` : ''}</div>
          <div class="qc-body"><div class="qc-title">${esc(q.title)}</div>
            <div class="qc-sub">${q.builtin ? 'מובנה · שכפלו כדי לערוך' : q.updated ? 'עודכן ' + new Date(q.updated).toLocaleDateString('he-IL') : ''}${curFolder === '*' && q.folder ? ` · 📁 ${esc(q.folder)}` : ''}${q.playable < q.count ? ` · <span class="bad-t">${q.count - q.playable} לא מוכנות</span>` : ''}</div>
            <div class="qc-actions">${q.builtin ? '' : `<button data-open="${esc(q.id)}">✏️ עריכה</button>`}<button data-dup="${esc(q.id)}">⧉ שכפול</button>${q.builtin ? '' : `<button data-menu="${esc(q.id)}" class="more">⋯</button>`}</div>
          </div></div>`).join('') ||
        `<div class="lib-empty"><div class="le-ic">${f ? '🔍' : '📂'}</div><b>${f ? 'לא נמצאו חידונים' : 'התיקייה ריקה'}</b><span class="muted">${f ? 'נסו מילה אחרת' : 'צרו חידון חדש, ייבאו קובץ, או גררו לכאן חידון'}</span></div>`;
    };
    draw();
    const reload = () => library();

    document.getElementById('search').oninput = (e) => { filter = e.target.value; draw(); };
    document.getElementById('folderBtn').onclick = () => folderPicker(root);
    document.getElementById('sharesBtn').onclick = () => sharesManager();
    document.getElementById('newQuiz').onclick = async () => {
      const q = await api('/quizzes', { method: 'POST', body: JSON.stringify({ title: 'חידון חדש', folder: curFolder === '*' ? '' : curFolder }) });
      open(q.id, true);
    };
    document.getElementById('newFolder').onclick = async () => {
      const name = prompt(curFolder && curFolder !== '*' ? `שם התיקייה החדשה (בתוך "${curFolder}"):` : 'שם התיקייה החדשה:');
      if (!name || !name.trim()) return;
      try {
        const r = await api('/folders', { method: 'POST', body: JSON.stringify({ path: (curFolder && curFolder !== '*' ? curFolder + '/' : '') + name.replace(/\//g, '-') }) });
        curFolder = r.path;
        reload();
      } catch (e) { toast(e.message, true); }
    };
    document.getElementById('importFile').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const t = toastSticky('מייבא…');
      try {
        const r = await api(`/import?title=${encodeURIComponent(file.name.replace(/\.(xlsx|zip|qgz)$/i, ''))}&folder=${encodeURIComponent(curFolder === '*' ? '' : curFolder)}`, { method: 'POST', body: await file.arrayBuffer(), headers: { 'Content-Type': 'application/octet-stream' } });
        t.remove();
        if (r.kind === 'folder') { toast(`התיקייה "${r.folder.split('/').pop()}" יובאה עם ${r.count} חידונים`); curFolder = r.folder; return reload(); }
        if (r.kind === 'quiz') { toast(`החידון "${r.title}" יובא (${r.count} שאלות)`); return open(r.id); }
        const notes = [r.special ? `${r.special} מיוחדות` : '', r.images ? `${r.images} תמונות` : '', r.skipped ? `${r.skipped} דולגו` : '', r.downgraded ? `${r.downgraded} יובאו כרב-ברירה` : '', r.missingImages ? `${r.missingImages} תמונות חסרות` : ''].filter(Boolean);
        toast(`יובאו ${r.count} שאלות${notes.length ? ` (${notes.join(', ')})` : ''}`);
        await open(r.id);
        if (r.issues && r.issues.length) importReport(r, file.name);
      } catch (err) {
        t.remove();
        if (err.issues && err.issues.length) importReport({ count: 0, issues: err.issues }, file.name);
        else toast(err.message, true);
      }
    };
    document.getElementById('importLink').onclick = () => linkImporter(curFolder === '*' ? '' : curFolder);
    document.getElementById('freeText').onclick = () => window.FreeImport && window.FreeImport.open({ folder: curFolder === '*' ? '' : curFolder, api, toast, onDone: (id) => open(id) });

    app.onclick = async (e) => {
      const fo = e.target.closest('[data-folder]');
      if (fo && !e.target.closest('[data-menu]')) { curFolder = fo.dataset.folder; filter = ''; document.getElementById('search').value = ''; draw(); return; }
      const fa = e.target.closest('[data-fact]');
      if (fa) return folderAction(fa.dataset.fact);
      const o = e.target.closest('[data-open]');
      if (o) return open(o.dataset.open);
      const d = e.target.closest('[data-dup]');
      if (d) { const q = await api(`/quizzes/${encodeURIComponent(d.dataset.dup)}/duplicate`, { method: 'POST' }); toast('נוצר עותק'); return open(q.id); }
      const m = e.target.closest('[data-menu]');
      if (m) return quizMenu(m, list.find((q) => q.id === m.dataset.menu));
    };
    // drag a quiz card onto a folder (in the tree or a folder card) to move it
    app.ondragstart = (e) => {
      const c = e.target.closest('[data-drag]');
      if (!c) return;
      e.dataTransfer.setData('text/quiz', c.dataset.drag);
      e.dataTransfer.effectAllowed = 'move';
      c.classList.add('dragging');
      document.body.classList.add('drag-quiz');
    };
    app.ondragend = () => {
      document.body.classList.remove('drag-quiz');
      app.querySelectorAll('.dragging, .drop-over').forEach((x) => x.classList.remove('dragging', 'drop-over'));
    };
    app.ondragover = (e) => {
      const t = e.target.closest('[data-drop]');
      if (!t || !e.dataTransfer.types.includes('text/quiz')) return;
      e.preventDefault();
      app.querySelectorAll('.drop-over').forEach((x) => x !== t && x.classList.remove('drop-over'));
      t.classList.add('drop-over');
    };
    app.ondrop = async (e) => {
      const t = e.target.closest('[data-drop]');
      const id = e.dataTransfer.getData('text/quiz');
      if (!t || !id) return;
      e.preventDefault();
      try {
        await api(`/quizzes/${encodeURIComponent(id)}/folder`, { method: 'PUT', body: JSON.stringify({ folder: t.dataset.folder }) });
        toast(`הועבר ל${t.dataset.folder ? '"' + t.dataset.folder.split('/').pop() + '"' : 'תיקייה הראשית'}`);
        reload();
      } catch (err) { toast(err.message, true); }
    };

    async function folderAction(act) {
      const name = curFolder.split('/').pop();
      try {
        if (act === 'rename') {
          const to = prompt('שם חדש לתיקייה:', name);
          if (!to || to === name) return;
          const r = await api('/folders', { method: 'PUT', body: JSON.stringify({ from: curFolder, to: (parentOf(curFolder) ? parentOf(curFolder) + '/' : '') + to.replace(/\//g, '-') }) });
          curFolder = r.path;
          reload();
        } else if (act === 'del') {
          const n = list.filter((q) => q.folder && inFolder(q.folder, curFolder)).length;
          if (!confirm(n ? `למחוק את התיקייה "${name}"? ${n} החידונים שבה יעברו לתיקייה שמעליה.` : `למחוק את התיקייה "${name}"?`)) return;
          await api('/folders?path=' + encodeURIComponent(curFolder), { method: 'DELETE' });
          curFolder = parentOf(curFolder);
          reload();
        } else if (act === 'share') shareDialog({ kind: 'folder', folder: curFolder, title: name });
      } catch (e) { toast(e.message, true); }
    }

    function quizMenu(btn, q) {
      document.querySelector('.pop-menu')?.remove();
      const m = document.createElement('div');
      m.className = 'pop-menu';
      m.innerHTML = `<button data-a="share">🔗 שיתוף</button><button data-a="move">📁 העברה לתיקייה</button><button data-a="rename">✏️ שינוי שם</button>
        <a href="/api/q/quizzes/${encodeURIComponent(q.id)}/package">📦 הורדת חבילה (עם התמונות)</a><a href="/api/q/quizzes/${encodeURIComponent(q.id)}/export.xlsx">⬇ ייצוא לאקסל</a>
        <hr><button data-a="del" class="del">🗑 מחיקה</button>`;
      document.body.appendChild(m);
      const r = btn.getBoundingClientRect();
      m.style.top = Math.min(innerHeight - m.offsetHeight - 10, r.bottom + 6) + 'px';
      m.style.left = Math.max(10, r.left - m.offsetWidth + r.width) + 'px';
      const close = (ev) => { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('pointerdown', close, true); } };
      setTimeout(() => document.addEventListener('pointerdown', close, true));
      m.onclick = async (e) => {
        const a = e.target.closest('[data-a]');
        if (!a) return;
        m.remove();
        try {
          if (a.dataset.a === 'share') shareDialog({ kind: 'quiz', id: q.id, title: q.title });
          if (a.dataset.a === 'move') moveDialog(q, folders, reload);
          if (a.dataset.a === 'rename') {
            const t = prompt('שם חדש לחידון:', q.title);
            if (!t || t === q.title) return;
            const full = await api('/quizzes/' + encodeURIComponent(q.id));
            await api('/quizzes/' + encodeURIComponent(q.id), { method: 'PUT', body: JSON.stringify({ ...full, title: t }) });
            reload();
          }
          if (a.dataset.a === 'del' && confirm(`למחוק את "${q.title}"? (הוא יעבור לתיקיית .trash)`)) { await api('/quizzes/' + encodeURIComponent(q.id), { method: 'DELETE' }); reload(); }
        } catch (err) { toast(err.message, true); }
      };
    }
  }

  function moveDialog(q, folders, done) {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="modal-card fp">
      <div class="modal-head"><h2>📁 להעביר את "${esc(q.title)}"</h2><div class="modal-actions"><button class="btn sm ghost" id="mvClose">✕</button></div></div>
      <div class="fp-list">${[{ path: '', name: '🏠 ראשי', depth: -1 }, ...folders].map((f) => `<button data-to="${esc(f.path)}" style="padding-inline-start:${12 + (f.depth + 1) * 18}px" ${f.path === (q.folder || '') ? 'class="cur"' : ''}>${f.depth >= 0 ? '📁 ' : ''}${esc(f.name)}${f.path === (q.folder || '') ? ' · כאן עכשיו' : ''}</button>`).join('')}</div></div>`;
    document.body.appendChild(m);
    m.onclick = async (e) => {
      if (e.target === m || e.target.id === 'mvClose') return m.remove();
      const b = e.target.closest('[data-to]');
      if (!b) return;
      try {
        await api(`/quizzes/${encodeURIComponent(q.id)}/folder`, { method: 'PUT', body: JSON.stringify({ folder: b.dataset.to }) });
        m.remove();
        toast('הועבר');
        done();
      } catch (err) { toast(err.message, true); }
    };
  }

  // ---------- sharing ----------
  async function shareDialog(item) {
    const base = await linkBase();
    const m = document.createElement('div');
    m.className = 'modal';
    document.body.appendChild(m);
    let perm = 'copy';
    const draw = async () => {
      let s;
      try {
        s = await api('/shares', { method: 'POST', body: JSON.stringify({ ...item, perm }) });
      } catch (e) { m.remove(); return toast(e.message, true); }
      const url = `${base}/share/${s.token}`;
      m.innerHTML = `<div class="modal-card share-card">
        <div class="modal-head"><h2>🔗 שיתוף ${item.kind === 'folder' ? 'התיקייה' : 'החידון'} "${esc(item.title)}"</h2><div class="modal-actions"><button class="btn sm ghost" id="shClose">✕</button></div></div>
        <div class="modal-body sh-body">
          <div class="sh-perms">
            <button data-perm="copy" class="${perm === 'copy' ? 'on' : ''}"><b>📥 צפייה + העתקה</b><small>המורה השני/ה יכול/ה לראות ולהוסיף לספרייה שלו/ה</small></button>
            <button data-perm="view" class="${perm === 'view' ? 'on' : ''}"><b>👀 צפייה בלבד</b><small>רואים את השאלות והתשובות, בלי להוריד</small></button>
          </div>
          <div class="sh-link"><input class="input sm" id="shUrl" dir="ltr" readonly value="${esc(url)}"><button class="btn blue sm" id="shCopy">📋 העתקה</button></div>
          <div class="sh-qr" id="shQr"></div>
          <div class="muted sh-note">${/localhost|127\.0\.0\.1/.test(base) ? '⚠️ המחשב לא מחובר לרשת: הקישור יעבוד רק כאן.' : 'הקישור עובד מכל מחשב או טלפון ברשת הזו כל עוד השרת פועל. במצב אונליין הוא עובד מכל מקום.'} כדי להוסיף לספרייה אחרת: "🔗 ייבוא מקישור" בספרייה של המורה השני/ה.</div>
        </div></div>`;
      fetch('/qr?text=' + encodeURIComponent(url)).then((r) => r.text()).then((svg) => { const q = m.querySelector('#shQr'); if (q) q.innerHTML = svg; }).catch(() => {});
      m.querySelector('#shCopy').onclick = () => { m.querySelector('#shUrl').select(); navigator.clipboard?.writeText(url).then(() => toast('הקישור הועתק')); };
    };
    m.onclick = (e) => {
      if (e.target === m || e.target.id === 'shClose') return m.remove();
      const p = e.target.closest('[data-perm]');
      if (p && p.dataset.perm !== perm) { perm = p.dataset.perm; draw(); }
    };
    draw();
  }

  async function sharesManager() {
    const base = await linkBase();
    const m = document.createElement('div');
    m.className = 'modal';
    document.body.appendChild(m);
    const draw = async () => {
      const list = await api('/shares');
      m.innerHTML = `<div class="modal-card fp">
        <div class="modal-head"><h2>🔗 קישורים ששיתפתי</h2><div class="modal-actions"><button class="btn sm ghost" id="smClose">✕</button></div></div>
        <div class="fp-list sm-list">${list.map((s) => `<div class="sm-row"><span class="sm-ic">${s.kind === 'folder' ? '📁' : '🧠'}</span><div class="sm-t"><b>${esc(s.title)}</b><small>${s.perm === 'copy' ? '📥 צפייה + העתקה' : '👀 צפייה בלבד'} · נפתח ${s.opened || 0} פעמים</small></div>
          <button class="btn ghost sm" data-copy="${esc(base + '/share/' + s.token)}">📋</button><button class="btn ghost sm" data-revoke="${esc(s.token)}">ביטול</button></div>`).join('') || '<div class="muted">עדיין לא שיתפתם כלום</div>'}</div></div>`;
    };
    m.onclick = async (e) => {
      if (e.target === m || e.target.id === 'smClose') return m.remove();
      const c = e.target.closest('[data-copy]');
      if (c) navigator.clipboard?.writeText(c.dataset.copy).then(() => toast('הקישור הועתק'));
      const r = e.target.closest('[data-revoke]');
      if (r && confirm('לבטל את הקישור? מי שיש לו אותו לא יוכל לפתוח אותו יותר.')) { await api('/shares/' + encodeURIComponent(r.dataset.revoke), { method: 'DELETE' }); draw(); }
    };
    draw();
  }

  function linkImporter(folderPath) {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="modal-card share-card">
      <div class="modal-head"><h2>🔗 ייבוא מקישור של מורה אחר/ת</h2><div class="modal-actions"><button class="btn sm ghost" id="liClose">✕</button></div></div>
      <div class="modal-body sh-body">
        <input class="input sm" id="liUrl" dir="ltr" placeholder="http://10.0.0.5:3000/share/…">
        <button class="btn green" id="liGo">ייבוא לספרייה שלי${folderPath ? ` (לתיקייה "${esc(folderPath.split('/').pop())}")` : ''}</button>
        <div class="muted sh-note">המחשב ששיתף צריך להיות דלוק, עם השרת פועל, ובאותה רשת (או במצב אונליין).</div>
      </div></div>`;
    document.body.appendChild(m);
    const inp = m.querySelector('#liUrl');
    inp.focus();
    m.onclick = async (e) => {
      if (e.target === m || e.target.id === 'liClose') return m.remove();
      if (e.target.id !== 'liGo') return;
      const btn = e.target;
      btn.disabled = true;
      btn.textContent = 'מייבא…';
      try {
        const r = await api('/import-link', { method: 'POST', body: JSON.stringify({ url: inp.value, folder: folderPath }) });
        m.remove();
        if (r.kind === 'folder') { toast(`התיקייה יובאה עם ${r.count} חידונים`); curFolder = r.folder; library(); }
        else { toast(`"${r.title}" יובא`); open(r.id); }
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'ייבוא לספרייה שלי';
        toast(err.message, true);
      }
    };
  }

  // ---------- import report: every problem by row and column ----------
  function importReport(r, fileName) {
    const LV = { skip: ['⛔', 'דולגה'], warn: ['⚠️', 'אזהרה'], info: ['ℹ️', 'לידיעה'] };
    const m = document.createElement('div');
    m.className = 'modal';
    const rows = r.issues;
    const skipped = rows.filter((x) => x.level === 'skip').length;
    m.innerHTML = `<div class="modal-card imp-rep">
      <div class="modal-head"><h2>📋 דוח ייבוא</h2><span class="muted">${esc(fileName)} · ${r.count} שאלות יובאו${skipped ? ` · ${skipped} שורות דולגו` : ''}</span>
        <div class="modal-actions"><button class="btn sm ghost" id="irCopy">📋 העתקה</button><button class="btn sm ghost" id="irClose">✕</button></div></div>
      <div class="modal-body"><table class="rep imp"><thead><tr><th></th><th>שורה</th><th>עמודה</th><th>מה קרה</th></tr></thead><tbody>
        ${rows.map((x) => `<tr class="lv-${x.level}"><td>${LV[x.level][0]}</td><td><b>${x.row}</b></td><td><span class="col-tag">${esc(x.col || '')}</span></td><td>${esc(x.reason)}</td></tr>`).join('')}
      </tbody></table><div class="muted" style="margin-top:8px">תקנו את השורות בקובץ וייבאו שוב, או ערכו את השאלות כאן בעורך.</div></div></div>`;
    document.body.appendChild(m);
    m.onclick = (e) => { if (e.target === m || e.target.id === 'irClose') m.remove(); };
    m.querySelector('#irCopy').onclick = () => {
      navigator.clipboard?.writeText(rows.map((x) => `שורה ${x.row} · עמודה ${x.col}: ${x.reason}`).join('\n')).then(() => toast('הועתק'));
    };
  }

  // ---------- folder picker ----------
  async function folderPicker(start) {
    const m = document.createElement('div');
    m.className = 'modal';
    document.body.appendChild(m);
    const go = async (p) => {
      let d;
      try { d = await api('/fs?path=' + encodeURIComponent(p || '')); } catch (e) { return toast(e.message, true); }
      m.innerHTML = `<div class="modal-card fp">
        <div class="modal-head"><h2>📁 בחירת תיקיית החידונים</h2><div class="modal-actions"><button class="btn sm ghost" id="fpClose">✕</button></div></div>
        <div class="fp-path" dir="ltr">${esc(d.path || 'המחשב')}</div>
        <div class="fp-list">${d.parent !== null ? `<button data-p="${esc(d.parent)}" class="up">⬆ למעלה</button>` : ''}${d.dirs.map((x) => `<button data-p="${esc(x.path)}">📁 ${esc(x.name)}</button>`).join('') || '<div class="muted">אין תתי־תיקיות</div>'}</div>
        <div class="fp-foot">${d.path ? `<span class="muted">${d.quizzes || 0} קבצי חידון כאן</span><button class="btn sm ghost" id="fpNew">+ תיקייה חדשה</button><button class="btn sm green" id="fpUse">בחרו תיקייה זו ✓</button>` : '<span class="muted">בחרו כונן או תיקייה</span>'}</div></div>`;
      m.querySelector('.fp-list').onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) go(b.dataset.p); };
      m.querySelector('#fpClose').onclick = () => m.remove();
      const use = m.querySelector('#fpUse');
      if (use) use.onclick = async () => { await api('/folder', { method: 'POST', body: JSON.stringify({ path: d.path }) }); m.remove(); toast('התיקייה נשמרה'); library(); };
      const nw = m.querySelector('#fpNew');
      if (nw) nw.onclick = async () => { const name = prompt('שם התיקייה החדשה:'); if (name) { const r = await api('/fs/mkdir', { method: 'POST', body: JSON.stringify({ path: d.path, name }) }); go(r.path); } };
    };
    go(start);
  }

  // ---------- quiz editor ----------
  async function open(id, focusTitle) {
    try {
      quiz = await api('/quizzes/' + encodeURIComponent(id));
    } catch (e) {
      return toast(e.message, true);
    }
    if (!quiz.questions.length) quiz.questions.push(blank('quiz'));
    cur = 0;
    // the library's click / drag handlers belong to the library screen only
    app.onclick = app.ondragstart = app.ondragend = app.ondragover = app.ondrop = null;
    app.innerHTML = `
      <header class="ed-head">
        <button class="btn ghost sm" id="back">→ לספרייה</button>
        <input class="input sm title-in" id="title" maxlength="80" value="${esc(quiz.title)}" placeholder="שם החידון">
        <span class="ed-status saved" id="status">נשמר ✓</span>
        <a class="btn ghost sm" href="/api/q/quizzes/${encodeURIComponent(quiz.id)}/export.xlsx">⬇ ייצוא לאקסל</a>
      </header>
      <div class="ed-main">
        <aside class="ed-list"><div id="qlist"></div><div class="add-wrap"><button class="btn green" id="addQ">+ שאלה</button><div class="type-menu hidden" id="typeMenu">${TYPES.map(([k, l, d, ic]) => `<button data-add="${k}"><span>${ic}</span><b>${l}</b><small>${d}</small></button>`).join('')}</div></div></aside>
        <section class="ed-stage" id="stage"></section>
        <aside class="ed-side" id="side"></aside>
      </div>`;
    document.getElementById('back').onclick = async () => { await save(); library(); };
    const t = document.getElementById('title');
    t.oninput = () => { quiz.title = t.value; dirty(); };
    if (focusTitle) { t.focus(); t.select(); }
    document.getElementById('addQ').onclick = () => document.getElementById('typeMenu').classList.toggle('hidden');
    document.getElementById('typeMenu').onclick = (e) => {
      const b = e.target.closest('[data-add]');
      if (!b) return;
      quiz.questions.splice(cur + 1, 0, blank(b.dataset.add));
      cur++;
      document.getElementById('typeMenu').classList.add('hidden');
      dirty();
      drawAll();
    };
    // paste a picture anywhere in the editor
    document.onpaste = (e) => {
      const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
      if (f && quiz) { e.preventDefault(); upload(f); }
    };
    drawAll();
  }

  function drawAll() {
    drawList();
    drawStage();
    drawSide();
  }

  function drawList() {
    const box = document.getElementById('qlist');
    box.innerHTML = quiz.questions
      .map((q, i) => {
        const bad = problems(q).length;
        return `<div class="qi ${i === cur ? 'on' : ''} ${bad ? 'bad' : ''}" data-q="${i}">
          <div class="qi-n">${i + 1}</div>
          <div class="qi-body"><span class="qi-type">${TYPE[q.type][3]} ${TYPE[q.type][1]}</span><span class="qi-text">${esc(q.text) || '<i>שאלה חדשה</i>'}</span></div>
          ${q.image ? `<img class="qi-img" src="${mediaUrl(q.image)}" alt="">` : ''}
          <div class="qi-tools"><button data-mv="-1" title="למעלה">▲</button><button data-mv="1" title="למטה">▼</button><button data-dupq title="שכפול">⧉</button><button data-delq title="מחיקה">🗑</button></div>
        </div>`;
      })
      .join('');
    box.onclick = (e) => {
      const it = e.target.closest('.qi');
      if (!it) return;
      const i = Number(it.dataset.q);
      const mv = e.target.closest('[data-mv]');
      if (mv) {
        const to = i + Number(mv.dataset.mv);
        if (to < 0 || to >= quiz.questions.length) return;
        [quiz.questions[i], quiz.questions[to]] = [quiz.questions[to], quiz.questions[i]];
        cur = to;
        dirty();
      } else if (e.target.closest('[data-dupq]')) {
        quiz.questions.splice(i + 1, 0, JSON.parse(JSON.stringify(quiz.questions[i])));
        cur = i + 1;
        dirty();
      } else if (e.target.closest('[data-delq]')) {
        if (!confirm('למחוק את השאלה?')) return;
        quiz.questions.splice(i, 1);
        if (!quiz.questions.length) quiz.questions.push(blank('quiz'));
        cur = Math.min(cur, quiz.questions.length - 1);
        dirty();
      } else cur = i;
      drawAll();
    };
  }

  // refresh only the left list entry and problems (while typing, keep focus)
  function soft() {
    dirty();
    const q = quiz.questions[cur];
    const it = document.querySelector(`.qi[data-q="${cur}"]`);
    if (it) {
      it.querySelector('.qi-text').innerHTML = esc(q.text) || '<i>שאלה חדשה</i>';
      it.classList.toggle('bad', problems(q).length > 0);
    }
    const pb = document.getElementById('probs');
    if (pb) pb.innerHTML = probsHtml(q);
  }
  const probsHtml = (q) => {
    const p = problems(q);
    return p.length ? p.map((x) => `<div class="prob">⚠️ ${x}</div>`).join('') : '<div class="ok-t">✓ השאלה מוכנה</div>';
  };

  // youtube links → video id (watch?v=, youtu.be/, embed/, shorts/)
  const youtubeId = (url) => {
    const m = String(url || '').match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([\w-]{11})/);
    return m ? m[1] : /^[\w-]{11}$/.test(String(url || '').trim()) ? String(url).trim() : '';
  };
  const ytTime = (url, key) => {
    const m = String(url || '').match(new RegExp(`[?&]${key}=(\\d+)`));
    return m ? Number(m[1]) : 0;
  };

  function drawStage() {
    const q = quiz.questions[cur];
    const st = document.getElementById('stage');
    const media = q.type === 'pin' ? '' : `<div class="drop ${q.image ? 'has' : ''}" id="drop">${q.image ? `<img src="${mediaUrl(q.image)}" alt=""><button class="img-x" id="imgX" title="הסרת תמונה">✕</button>` : `<div class="drop-hint">🖼️ גררו תמונה לכאן, הדביקו (Ctrl+V) או לחצו להעלאה<small>${q.type === 'puzzle' ? 'התמונה תיחתך לחלקי פאזל' : 'גם GIF ותמונות מונפשות'}</small></div>`}<input type="file" id="imgFile" accept="image/*,video/*" hidden></div>`;
    const v = q.video;
    const vid = q.type === 'slide' || q.type === 'puzzle' || q.type === 'pin' ? '' : `
      <div class="vid-ed ${v ? 'has' : ''}">
        <div class="vid-row">
          <span class="vid-ic">🎬</span>
          ${v && v.file ? `<span class="vid-file">📁 סרטון שהועלה</span>` : `<input class="input sm" id="vidUrl" dir="ltr" placeholder="קישור ליוטיוב (לא חובה)" value="${v && v.id ? esc('https://youtu.be/' + v.id) : ''}">`}
          <label class="btn ghost sm">⬆ העלאת סרטון<input type="file" id="vidFile" accept="video/*" hidden></label>
          ${v ? `<label class="vid-t">מ־<input type="number" id="vidStart" min="0" value="${v.start || 0}"> שנ׳</label><label class="vid-t">עד <input type="number" id="vidEnd" min="0" value="${v.end || ''}" placeholder="סוף"> שנ׳</label><button class="btn ghost sm" id="vidX">✕</button>` : ''}
        </div>
        ${v ? `<div class="vid-prev">${QMedia.video(v.id ? v : { url: mediaUrl(v.file), start: v.start, end: v.end }, { autoplay: false })}</div><div class="muted ae-tip">בחידון הקלאסי הסרטון מתנגן במסך הגדול. במשחקים, בטלפון של כל שחקן.</div>` : ''}
      </div>`;
    st.innerHTML = `
      <textarea class="q-text-in" id="qtext" maxlength="300" placeholder="הקלידו את השאלה…">${esc(q.text)}</textarea>
      ${media}
      ${vid}
      <div class="ans-ed" id="ansEd"></div>`;
    const ta = document.getElementById('qtext');
    ta.oninput = () => { q.text = ta.value; soft(); };
    if (!q.text) setTimeout(() => ta.focus(), 50);
    const drop = document.getElementById('drop');
    if (drop) {
      drop.onclick = (e) => {
        if (e.target.id === 'imgX') { delete q.image; delete q.reveal; delete q.revealSec; dirty(); drawAll(); return; }
        document.getElementById('imgFile').click();
      };
      document.getElementById('imgFile').onchange = (e) => e.target.files[0] && upload(e.target.files[0]);
      drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
      drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) upload(f); };
    }
    const vu = document.getElementById('vidUrl');
    if (vu) vu.onchange = () => {
      const id = youtubeId(vu.value);
      if (vu.value.trim() && !id) return toast('זה לא נראה כמו קישור ליוטיוב', true);
      if (!id) delete q.video;
      else q.video = { id, start: ytTime(vu.value, 'start') || ytTime(vu.value, 't'), end: ytTime(vu.value, 'end') };
      dirty();
      drawStage();
    };
    const vf = document.getElementById('vidFile');
    if (vf) vf.onchange = (e) => e.target.files[0] && upload(e.target.files[0]);
    const vs = document.getElementById('vidStart');
    const ve = document.getElementById('vidEnd');
    if (vs) vs.onchange = () => { q.video.start = Math.max(0, Number(vs.value) || 0); dirty(); drawStage(); };
    if (ve) ve.onchange = () => { q.video.end = Math.max(0, Number(ve.value) || 0); dirty(); drawStage(); };
    const vx = document.getElementById('vidX');
    if (vx) vx.onclick = () => { delete q.video; dirty(); drawStage(); };
    drawAnswers();
  }

  async function upload(file) {
    const isVideo = file.type.startsWith('video/');
    if (!file.type.startsWith('image/') && !isVideo) return toast('רק תמונות או סרטונים', true);
    if (!isVideo && file.size > 12 * 1024 * 1024) return toast('התמונה גדולה מדי (עד 12MB)', true);
    if (isVideo && file.size > 300 * 1024 * 1024) return toast('הסרטון גדול מדי (עד 300MB)', true);
    const q = quiz.questions[cur];
    if (isVideo && (q.type === 'pin' || q.type === 'puzzle' || q.type === 'slide')) return toast('לשאלה מהסוג הזה אפשר להוסיף רק תמונה', true);
    const t = isVideo ? toastSticky('מעלה סרטון…') : null;
    try {
      const r = await api(`/quizzes/${encodeURIComponent(quiz.id)}/media`, { method: 'POST', body: file, headers: { 'Content-Type': file.type } });
      if (isVideo) q.video = { file: r.name, start: 0, end: 0 };
      else q.image = r.name;
      dirty();
      drawAll();
    } catch (e) {
      toast(e.message, true);
    } finally {
      if (t) t.remove();
    }
  }
  const toastSticky = (text) => {
    const t = document.createElement('div');
    t.className = 'ed-toast';
    t.textContent = text;
    document.body.appendChild(t);
    return t;
  };

  function drawAnswers() {
    const q = quiz.questions[cur];
    const box = document.getElementById('ansEd');
    const rerender = () => { soft(); drawAnswers(); };

    if (q.type === 'quiz' || q.type === 'poll' || q.type === 'tf') {
      const fixed = q.type === 'tf';
      box.innerHTML = `<div class="ae-grid n${q.answers.length}">${q.answers.map((a, i) => `
        <div class="ae-ans ${a.correct ? 'correct' : ''}" style="--a:${fixed ? ['#1f73e0', '#e9334f'][i] : COLORS[i]}">
          <span class="ae-shape">${Art.shape(fixed ? i * 3 : i)}</span>
          <input data-i="${i}" maxlength="${fixed ? 40 : 120}" value="${esc(a.text)}" placeholder="תשובה ${i + 1}${i > 1 ? ' (לא חובה)' : ''}">
          ${q.type === 'poll' ? '' : `<button class="ae-ok" data-ok="${i}" title="תשובה נכונה">${a.correct ? '✓' : ''}</button>`}
          ${!fixed && q.answers.length > 2 ? `<button class="ae-x" data-x="${i}" title="הסרה">✕</button>` : ''}
        </div>`).join('')}</div>
        ${!fixed && q.answers.length < 6 ? '<button class="btn ghost sm" id="addAns">+ תשובה</button>' : ''}
        ${q.type === 'quiz' ? '<div class="muted ae-tip">לחצו על העיגול כדי לסמן תשובה נכונה. כמה נכונות = השחקנים יבחרו את כולן.</div>' : ''}`;
      box.oninput = (e) => { if (e.target.dataset.i !== undefined) { q.answers[e.target.dataset.i].text = e.target.value; soft(); } };
      box.onclick = (e) => {
        const ok = e.target.closest('[data-ok]');
        const x = e.target.closest('[data-x]');
        if (ok) {
          const i = Number(ok.dataset.ok);
          if (fixed) q.answers.forEach((a, k) => (a.correct = k === i));
          else q.answers[i].correct = !q.answers[i].correct;
          rerender();
        } else if (x) { q.answers.splice(Number(x.dataset.x), 1); rerender(); }
        else if (e.target.id === 'addAns') { q.answers.push({ text: '', correct: false }); rerender(); }
      };
      return;
    }

    if (q.type === 'type') {
      box.innerHTML = `<div class="ae-list">${q.accept.map((a, i) => `<div class="ae-row"><span>✓</span><input data-i="${i}" maxlength="60" value="${esc(a)}" placeholder="${i ? 'איות נוסף שמתקבל' : 'התשובה הנכונה'}">${q.accept.length > 1 ? `<button data-x="${i}">✕</button>` : ''}</div>`).join('')}</div>
        ${q.accept.length < 8 ? '<button class="btn ghost sm" id="addAcc">+ איות נוסף</button>' : ''}
        <div class="muted ae-tip">לא משנה: אותיות גדולות/קטנות, רווחים, ניקוד וסימני פיסוק.</div>`;
      box.oninput = (e) => { if (e.target.dataset.i !== undefined) { q.accept[e.target.dataset.i] = e.target.value; soft(); } };
      box.onclick = (e) => {
        const x = e.target.closest('[data-x]');
        if (x) { q.accept.splice(Number(x.dataset.x), 1); rerender(); }
        if (e.target.id === 'addAcc') { q.accept.push(''); rerender(); }
      };
      return;
    }

    if (q.type === 'slider') {
      const s = q.slider;
      const f = (k, l) => `<label>${l}<input type="number" data-k="${k}" value="${s[k]}" step="any"></label>`;
      box.innerHTML = `<div class="ae-slider">${f('min', 'מינימום')}${f('max', 'מקסימום')}${f('step', 'קפיצה')}${f('answer', 'התשובה הנכונה')}${f('tol', 'טווח טעות מותר (±)')}</div>
        <div class="ae-preview"><input type="range" disabled min="${s.min}" max="${s.max}" step="${s.step}" value="${s.answer}"><div class="muted">נכון: ${s.answer}${s.tol ? ` (בין ${s.answer - s.tol} ל־${s.answer + s.tol})` : ''}</div></div>`;
      box.onchange = (e) => { const k = e.target.dataset.k; if (k) { s[k] = Number(e.target.value); rerender(); } };
      return;
    }

    if (q.type === 'order') {
      box.innerHTML = `<div class="muted ae-tip">כתבו את הפריטים בסדר הנכון. השחקנים יקבלו אותם מעורבבים.</div>
        <div class="ae-list">${q.items.map((it, i) => `<div class="ae-row"><span class="ae-num">${i + 1}</span><input data-i="${i}" maxlength="80" value="${esc(it)}" placeholder="פריט ${i + 1}"><button data-up="${i}">▲</button>${q.items.length > 2 ? `<button data-x="${i}">✕</button>` : ''}</div>`).join('')}</div>
        ${q.items.length < 6 ? '<button class="btn ghost sm" id="addIt">+ פריט</button>' : ''}`;
      box.oninput = (e) => { if (e.target.dataset.i !== undefined) { q.items[e.target.dataset.i] = e.target.value; soft(); } };
      box.onclick = (e) => {
        const x = e.target.closest('[data-x]');
        const up = e.target.closest('[data-up]');
        if (x) { q.items.splice(Number(x.dataset.x), 1); rerender(); }
        if (up) { const i = Number(up.dataset.up); if (i > 0) { [q.items[i - 1], q.items[i]] = [q.items[i], q.items[i - 1]]; rerender(); } }
        if (e.target.id === 'addIt') { q.items.push(''); rerender(); }
      };
      return;
    }

    if (q.type === 'pin') {
      box.innerHTML = q.image
        ? `<div class="muted ae-tip">לחצו על התמונה כדי לסמן את המקום הנכון. העיגול הוא האזור שנחשב לתשובה נכונה.</div>
           <div class="pin-box"><div class="pin-ed" id="pinEd"><img src="${mediaUrl(q.image)}" alt=""><i class="pin-zone" style="left:${q.pin.x}%;top:${q.pin.y}%;--r:${q.pin.r}"></i></div></div>
           <label class="ae-rad">גודל האזור <input type="range" id="pinR" min="2" max="40" value="${q.pin.r}"></label>
           <div class="row"><label class="btn ghost sm">🖼️ החלפת תמונה<input type="file" id="pinFile" accept="image/*" hidden></label><button class="btn ghost sm" id="pinX">הסרת תמונה</button></div>`
        : `<div class="drop" id="pinDrop"><div class="drop-hint">📍 העלו תמונה (מפה, שרטוט, גוף האדם…) ואז סמנו עליה את המקום הנכון</div><input type="file" id="pinFile" accept="image/*" hidden></div>`;
      const file = document.getElementById('pinFile');
      file.onchange = (e) => e.target.files[0] && upload(e.target.files[0]);
      const pd = document.getElementById('pinDrop');
      if (pd) {
        pd.onclick = () => file.click();
        pd.ondragover = (e) => e.preventDefault();
        pd.ondrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) upload(f); };
        return;
      }
      const ed = document.getElementById('pinEd');
      U.fitImage(ed, ed.querySelector('img'));
      ed.onclick = (e) => {
        const r = ed.getBoundingClientRect();
        q.pin.x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
        q.pin.y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
        rerender();
      };
      document.getElementById('pinR').oninput = (e) => { q.pin.r = Number(e.target.value); ed.querySelector('.pin-zone').style.setProperty('--r', q.pin.r); soft(); };
      document.getElementById('pinX').onclick = () => { delete q.image; rerender(); drawList(); };
      return;
    }

    if (q.type === 'puzzle') {
      const opt = (k) => [2, 3, 4, 5].map((n) => `<option value="${n}" ${q.puzzle[k] === n ? 'selected' : ''}>${n}</option>`).join('');
      box.innerHTML = `<div class="pz-ed">
          <label>שורות<select id="pzRows">${opt('rows')}</select></label><span class="pz-x">×</span><label>עמודות<select id="pzCols">${opt('cols')}</select></label>
          <span class="muted">= ${q.puzzle.rows * q.puzzle.cols} חלקים</span>
        </div>
        ${q.image ? `<div class="pz-prev" id="pzPrev"></div>` : ''}
        <div class="muted ae-tip">השחקנים מקבלים את החלקים מעורבבים וגוררים אותם למקום. ניקוד לפי מהירות, וחלק מהנקודות גם על פאזל שרובו נכון.</div>`;
      box.onchange = (e) => {
        if (e.target.id === 'pzRows') q.puzzle.rows = Number(e.target.value);
        if (e.target.id === 'pzCols') q.puzzle.cols = Number(e.target.value);
        rerender();
      };
      const pv = document.getElementById('pzPrev');
      if (pv) QMedia.size(mediaUrl(q.image)).then(({ w, h }) => {
        const W = 360;
        const H = Math.round((W * h) / w);
        pv.innerHTML = QMedia.puzzleOutline({ ...q.puzzle, seed: 7 }, mediaUrl(q.image), W, H);
        pv.style.aspectRatio = `${w} / ${h}`;
      });
      return;
    }

    box.innerHTML = '<div class="muted ae-tip">שקופית מידע: מוצגת לכולם בחידון הקלאסי, בלי תשובות.</div>';
  }

  function drawSide() {
    const q = quiz.questions[cur];
    const side = document.getElementById('side');
    side.innerHTML = `
      <label>סוג השאלה<select id="sType">${TYPES.map(([k, l, , ic]) => `<option value="${k}" ${k === q.type ? 'selected' : ''}>${ic} ${l}</option>`).join('')}</select></label>
      <label>⏱ זמן לשאלה<select id="sTime">${TIMES.map((t) => `<option value="${t}" ${t === q.time ? 'selected' : ''}>${t < 60 ? t + ' שניות' : t / 60 + ' דק׳'}</option>`).join('')}</select></label>
      ${q.type === 'slide' ? '' : `<label>⭐ ניקוד<select id="sPts">${POINTS.map(([v, l]) => `<option value="${v}" ${v === q.points ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`}
      ${q.image && q.type !== 'pin' && q.type !== 'puzzle' ? `<label>🌫️ חשיפת התמונה<select id="sReveal">${[['', 'מיד'], ['blur', 'טשטוש שמתבהר'], ['tiles', 'אריחים שנעלמים']].map(([v, l]) => `<option value="${v}" ${(q.reveal || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        ${q.reveal ? `<label>⏳ משך החשיפה<select id="sRevealSec">${[[0, 'לאורך כל הזמן'], [5, '5 שניות'], [10, '10 שניות'], [15, '15 שניות'], [20, '20 שניות'], [30, '30 שניות'], [45, '45 שניות'], [60, 'דקה']].map(([v, l]) => `<option value="${v}" ${(q.revealSec || 0) === v ? 'selected' : ''}>${l}</option>`).join('')}</select><small class="muted">מי שעונה מהר, לפני שרואים הכל, מקבל יותר נקודות</small></label>` : ''}` : ''}
      ${q.type === 'slide' ? '' : `<label>💡 הסבר אחרי התשובה<textarea id="sExplain" maxlength="200" rows="3" placeholder="למה זו התשובה? (לא חובה)">${esc(q.explain || '')}</textarea></label>`}
      <div class="side-note">במשחקים (לא בחידון הקלאסי) אין הגבלת זמן, וניקוד כפול = מתקדמים מהר יותר לתור הבא.</div>
      <div class="probs" id="probs">${probsHtml(q)}</div>
      <div class="side-stats">${quiz.questions.length} שאלות · ${quiz.questions.filter((x) => !problems(x).length).length} מוכנות</div>`;
    side.onchange = (e) => {
      if (e.target.id === 'sType') { quiz.questions[cur] = convert(q, e.target.value); dirty(); drawAll(); }
      if (e.target.id === 'sTime') { q.time = Number(e.target.value); dirty(); }
      if (e.target.id === 'sPts') { q.points = Number(e.target.value); dirty(); }
      if (e.target.id === 'sReveal') { if (e.target.value) q.reveal = e.target.value; else { delete q.reveal; delete q.revealSec; } dirty(); drawSide(); }
      if (e.target.id === 'sRevealSec') { const v = Number(e.target.value); if (v) q.revealSec = v; else delete q.revealSec; dirty(); }
    };
    side.oninput = (e) => {
      if (e.target.id === 'sExplain') { q.explain = e.target.value; dirty(); }
    };
  }

  // keyboard: ctrl+s saves now
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
  });

  const startId = new URLSearchParams(location.search).get('quiz');
  if (startId) open(startId);
  else library();
})();
