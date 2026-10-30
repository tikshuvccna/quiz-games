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
    ['match', 'התאמה', 'מחברים כל פריט לבן הזוג שלו', '🔗'],
    ['sort', 'מיון לקבוצות', 'מכניסים כל פריט לקבוצה הנכונה', '🗂️'],
    ['pin', 'סימון על תמונה', 'לוחצים על המקום הנכון', '📍'],
    ['puzzle', 'פאזל אמיתי', 'התמונה נחתכת לחלקי פאזל שמרכיבים', '🧩'],
    ['poll', 'סקר', 'בלי תשובה נכונה, אפשר גם כמה תשובות · חידון קלאסי בלבד', '📊'],
    ['cloud', 'ענן מילים', 'כולם שולחים מילה והנפוצות גדולות · חידון קלאסי בלבד', '☁️'],
    ['open', 'תשובה פתוחה', 'כולם כותבים תשובה חופשית · חידון קלאסי בלבד', '✍️'],
    ['brain', 'סיעור מוחות', 'רעיונות מהכיתה ואז הצבעה · חידון קלאסי בלבד', '💡'],
    ['qna', 'שאלות מהכיתה', 'התלמידים שולחים שאלות ומצביעים על החשובות · חידון קלאסי בלבד', '❓'],
    ['rate', 'דירוג / סולם', 'כוכבים או סולם 1–5 / 1–7 / 1–10, בלי תשובה נכונה · חידון קלאסי בלבד', '⭐'],
    ['rank', 'דירוג פריטים', 'מסדרים לפי העדפה והכיתה רואה את הדירוג המשותף · חידון קלאסי בלבד', '🏅'],
    ['drop', 'סיכה חופשית', 'כולם מניחים סיכה על תמונה · חידון קלאסי בלבד', '📌'],
    ['tap', 'מרוץ הקשות', 'כולם מקישים כמה שיותר מהר, בלי תשובה נכונה · חידון קלאסי ושיעור', '👆'],
    ['slide', 'שקופית', 'כותרת, נקודות, תמונה או סרטון · חידון קלאסי ושיעור', '🖼️'],
    ['pdf', 'עמוד PDF', 'עמוד מקובץ PDF כשקופית · חידון קלאסי ושיעור', '📄'],
  ];
  const TYPE = Object.fromEntries(TYPES.map((t) => [t[0], t]));
  const TIMES = [5, 10, 20, 30, 45, 60, 90, 120, 180, 240];
  const POINTS = [[0, 'ללא ניקוד'], [1, 'רגיל'], [2, 'כפול ×2'], [3, 'משולש ×3'], [4, 'מרובע ×4']];
  const UNSCORED = ['slide', 'pdf', 'tap', 'cloud', 'open', 'brain', 'qna', 'drop', 'rate', 'rank']; // no points
  const LIMITS = { cloud: 3, open: 1, brain: 3, qna: 2 };
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
    // a 404 without our JSON error = the page is newer than the running server
    if (res.status === 404 && !data.error) throw new Error('השרת פועל עם גרסה ישנה: סגרו את חלון השרת והפעילו שוב את start.bat');
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
    if (type === 'order' || type === 'rank') q.items = ['', '', ''];
    if (type === 'rate') q.scale = { max: 5, low: '', high: '' };
    if (type === 'match') { q.pairs = [{ a: '', b: '' }, { a: '', b: '' }, { a: '', b: '' }]; q.time = 30; }
    if (type === 'sort') { q.buckets = [{ name: '', items: [] }, { name: '', items: [] }]; q.time = 30; }
    if (type === 'pin') q.pin = { shape: 'circle', x: 50, y: 50, r: 10 };
    if (type === 'puzzle') { q.puzzle = { rows: 3, cols: 3 }; q.time = 60; }
    if (UNSCORED.includes(type)) q.points = 0;
    if (LIMITS[type]) q.limit = LIMITS[type];
    if (type === 'pdf') q.pdf = { file: '', page: 1 };
    if (type === 'tap') q.time = 10;
    return q;
  }
  // switching type keeps the text/picture/time
  function convert(q, type) {
    const n = blank(type);
    n.text = q.text;
    n.time = q.time;
    if (!UNSCORED.includes(type)) n.points = q.points;
    if (q.body) n.body = q.body;
    if (q.image) n.image = q.image;
    if (q.reveal) n.reveal = q.reveal;
    if (q.revealSec) n.revealSec = q.revealSec;
    if (q.video) n.video = q.video;
    if (q.explain) n.explain = q.explain;
    if (q.explainImage) n.explainImage = q.explainImage;
    if (q.imageWhen) n.imageWhen = q.imageWhen;
    if ((type === 'quiz' || type === 'poll') && q.answers && q.type !== 'tf') n.answers = q.answers.map((a) => ({ text: a.text, correct: type === 'quiz' && !!a.correct, ...(a.image ? { image: a.image } : {}) }));
    return n;
  }
  // what is still missing before the question can be played
  function problems(q) {
    const p = [];
    const slideish = q.type === 'pdf' || (q.type === 'slide' && (q.image || q.video || q.body || (q.bullets && q.bullets.some((b) => b.trim()))));
    if (!q.text.trim() && !slideish) p.push('חסר טקסט לשאלה');
    if (q.type === 'pdf' && !(q.pdf && q.pdf.file)) p.push('בחרו קובץ PDF ועמוד');
    if (q.type === 'quiz') {
      if (q.answers.filter((a) => a.text.trim() || a.image).length < 2) p.push('צריך לפחות 2 תשובות');
      if (!q.answers.some((a) => a.correct && (a.text.trim() || a.image))) p.push('סמנו תשובה נכונה');
    }
    if (q.type === 'poll' && q.answers.filter((a) => a.text.trim() || a.image).length < 2) p.push('צריך לפחות 2 אפשרויות');
    if (q.type === 'drop' && !q.image) p.push('צריך תמונה כדי להניח עליה סיכה');
    if (q.type === 'pin' && q.pin.shape === 'polygon' && (q.pin.points || []).length < 3) p.push('מצולע צריך לפחות 3 נקודות');
    if (q.type === 'type' && !q.accept.some((a) => a.trim())) p.push('הוסיפו תשובה נכונה אחת לפחות');
    if ((q.type === 'order' || q.type === 'rank') && q.items.filter((x) => x.trim()).length < 2) p.push('צריך לפחות 2 פריטים');
    if (q.type === 'match' && q.pairs.filter((x) => x.a.trim() && x.b.trim()).length < 2) p.push('צריך לפחות 2 זוגות מלאים');
    if (q.type === 'sort') {
      if (q.buckets.some((b) => !b.name.trim())) p.push('לכל קבוצה צריך שם');
      if (q.buckets.some((b) => !b.items.some((x) => x.trim()))) p.push('בכל קבוצה צריך לפחות פריט אחד');
      if (q.buckets.reduce((n, b) => n + b.items.filter((x) => x.trim()).length, 0) > 8) p.push('אפשר עד 8 פריטים בסך הכל');
    }
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
      await api('/quizzes/' + encodeURIComponent(quiz.id), { method: 'PUT', body: JSON.stringify({ title: quiz.title, description: quiz.description, background: quiz.background || '', questions: quiz.questions }) });
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
            <label class="btn blue sm">⬆ ייבוא קובץ<input type="file" id="importFile" accept=".xlsx,.zip,.qgz,.json" hidden></label>
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
          <div class="qc-cover" data-open="${esc(q.id)}">${q.cover ? `<img src="/media/${encodeURIComponent(q.id)}/${encodeURIComponent(q.cover)}" alt="" loading="lazy">` : `<span>${ICONS[i % 6]}</span>`}<b class="qc-count">${q.count} שאלות</b>${q.types && q.types.some((t) => t !== 'quiz' && t !== 'tf') ? `<b class="qc-types">${['puzzle', 'pin', 'slider', 'match', 'sort', 'type', 'cloud', 'open', 'brain', 'qna', 'drop', 'rate', 'rank'].filter((t) => q.types.includes(t)).map((t) => TYPE[t][3]).join('')}</b>` : ''}</div>
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
        const r = await api(`/import?title=${encodeURIComponent(file.name.replace(/\.(xlsx|zip|qgz|json)$/i, ''))}&folder=${encodeURIComponent(curFolder === '*' ? '' : curFolder)}`, { method: 'POST', body: await file.arrayBuffer(), headers: { 'Content-Type': 'application/octet-stream' } });
        t.remove();
        const report = () => r.issues && r.issues.length && importReport(r, file.name);
        if (r.kind === 'folder') { toast(`התיקייה "${r.folder.split('/').pop()}" יובאה עם ${r.count} חידונים`); curFolder = r.folder; await reload(); return report(); }
        if (r.kind === 'quiz') { toast(`החידון "${r.title}" יובא (${r.count} שאלות)`); await open(r.id); return report(); }
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
        <label class="bg-sel" title="הרקע שנבחר אוטומטית כשבוחרים את החידון במסך המשחק">🎨<select id="bgSel"><option value="">רקע: לפי החדר</option></select></label>
        <span class="ed-status saved" id="status">נשמר ✓</span>
        <a class="btn ghost sm" href="/api/q/quizzes/${encodeURIComponent(quiz.id)}/export.xlsx">⬇ ייצוא לאקסל</a>
        <a class="btn green sm" href="/host.html?present=${encodeURIComponent(quiz.id)}" target="_blank" title="פותח חדר שיעור עם השקופיות והפעילויות האלה">▶ הצגה</a>
      </header>
      <div class="ed-main">
        <aside class="ed-list"><div id="qlist"></div><div class="add-wrap"><button class="btn green" id="addQ">+ שאלה</button><div class="type-menu hidden" id="typeMenu">${TYPES.map(([k, l, d, ic]) => `<button data-add="${k}"><span>${ic}</span><b>${l}</b><small>${d}</small></button>`).join('')}</div></div></aside>
        <section class="ed-stage" id="stage"></section>
        <aside class="ed-side" id="side"></aside>
      </div>`;
    document.getElementById('back').onclick = async () => { await save(); library(); };
    const bg = document.getElementById('bgSel');
    Scenes.loadFiles().then(() => {
      bg.innerHTML = `<option value="">רקע: לפי החדר</option>` + Scenes.all().map((x) => `<option value="${esc(x.id)}" ${quiz.background === x.id ? 'selected' : ''}>${esc(x.name)}${x.file ? ' (קובץ)' : x.anim ? ' ✨' : ''}</option>`).join('');
    });
    bg.onchange = () => { quiz.background = bg.value; dirty(); };
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
    const media = q.type === 'pin' || q.type === 'pdf' ? '' : `<div class="drop ${q.image ? 'has' : ''}" id="drop">${q.image ? `<img src="${mediaUrl(q.image)}" alt=""><button class="img-x" id="imgX" title="הסרת תמונה">✕</button>` : `<div class="drop-hint">🖼️ גררו תמונה לכאן, הדביקו (Ctrl+V) או לחצו להעלאה<small>${q.type === 'puzzle' ? 'התמונה תיחתך לחלקי פאזל' : q.type === 'drop' ? 'השחקנים יניחו עליה סיכות' : 'גם GIF ותמונות מונפשות'}</small></div>`}<input type="file" id="imgFile" accept="image/*,video/*" hidden></div>`;
    const v = q.video;
    const vid = q.type === 'puzzle' || q.type === 'pin' || q.type === 'drop' || q.type === 'pdf' ? '' : `
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

  // the PDF files this quiz already has (to reuse one behind several activities)
  const pdfFiles = () => [...new Set(quiz.questions.flatMap((x) => (x.pdf && x.pdf.file ? [x.pdf.file] : [])))];

  async function upload(file, slot) {
    const isVideo = file.type.startsWith('video/');
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    if (isPdf && file.size > 80 * 1024 * 1024) return toast('ה־PDF גדול מדי (עד 80MB)', true);
    if (slot === 'explain' && isVideo) return toast('תמונת ההסבר צריכה להיות תמונה', true);
    if (String(slot).startsWith('ans:') && isVideo) return toast('תמונת תשובה צריכה להיות תמונה', true);
    if (!file.type.startsWith('image/') && !isVideo && !isPdf) return toast('רק תמונות, סרטונים או PDF', true);
    if (!isVideo && !isPdf && file.size > 12 * 1024 * 1024) return toast('התמונה גדולה מדי (עד 12MB)', true);
    if (isVideo && file.size > 300 * 1024 * 1024) return toast('הסרטון גדול מדי (עד 300MB)', true);
    const q = quiz.questions[cur];
    if (isVideo && (q.type === 'pin' || q.type === 'puzzle' || q.type === 'drop')) return toast('לשאלה מהסוג הזה אפשר להוסיף רק תמונה', true);
    const t = isVideo || isPdf ? toastSticky(isPdf ? 'מעלה PDF…' : 'מעלה סרטון…') : null;
    try {
      const r = await api(`/quizzes/${encodeURIComponent(quiz.id)}/media`, { method: 'POST', body: file, headers: { 'Content-Type': isPdf ? 'application/pdf' : file.type } });
      if (isPdf) q.pdf = { file: r.name, page: (q.pdf && q.pdf.page) || 1 };
      else if (isVideo) q.video = { file: r.name, start: 0, end: 0 };
      else if (slot === 'explain') q.explainImage = r.name;
      else if (String(slot).startsWith('ans:')) q.answers[Number(slot.slice(4))].image = r.name;
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
          ${fixed ? '' : `<label class="ae-pic" title="תמונה לתשובה">${a.image ? `<img src="${mediaUrl(a.image)}" alt=""><b data-xpic="${i}">✕</b>` : '🖼️'}<input type="file" accept="image/*" data-pic="${i}" hidden></label>`}
          ${q.type === 'poll' ? '' : `<button class="ae-ok" data-ok="${i}" title="תשובה נכונה">${a.correct ? '✓' : ''}</button>`}
          ${!fixed && q.answers.length > 2 ? `<button class="ae-x" data-x="${i}" title="הסרה">✕</button>` : ''}
        </div>`).join('')}</div>
        ${!fixed && q.answers.length < 6 ? '<button class="btn ghost sm" id="addAns">+ תשובה</button>' : ''}
        ${q.type === 'poll' ? `<label class="ae-multi"><input type="checkbox" id="pollMulti" ${q.multi ? 'checked' : ''}> אפשר לבחור כמה תשובות</label>` : ''}
        ${q.type === 'quiz' ? '<div class="muted ae-tip">לחצו על העיגול כדי לסמן תשובה נכונה. כמה נכונות = השחקנים יבחרו את כולן. לכל תשובה אפשר להוסיף תמונה (🖼️).</div>' : ''}`;
      box.onchange = (e) => {
        if (e.target.dataset.pic !== undefined && e.target.files[0]) upload(e.target.files[0], 'ans:' + e.target.dataset.pic);
        if (e.target.id === 'pollMulti') { if (e.target.checked) q.multi = true; else delete q.multi; dirty(); }
      };
      box.oninput = (e) => { if (e.target.dataset.i !== undefined) { q.answers[e.target.dataset.i].text = e.target.value; soft(); } };
      box.onclick = (e) => {
        const ok = e.target.closest('[data-ok]');
        const x = e.target.closest('[data-x]');
        const xp = e.target.closest('[data-xpic]');
        if (xp) { e.preventDefault(); delete q.answers[Number(xp.dataset.xpic)].image; rerender(); return; }
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

    if (q.type === 'match') {
      box.innerHTML = `<div class="muted ae-tip">כתבו זוגות: בעמודה הימנית הפריט, ובשמאלית בן הזוג שלו. השחקנים מקבלים את העמודה השמאלית מעורבבת. ניקוד חלקי למי שחיבר חלק מהזוגות נכון.</div>
        <div class="ae-list">${q.pairs.map((p, i) => `<div class="ae-row"><span class="ae-num">${i + 1}</span><input data-a="${i}" maxlength="60" value="${esc(p.a)}" placeholder="פריט ${i + 1}"><span class="pz-x">=</span><input data-b="${i}" maxlength="60" value="${esc(p.b)}" placeholder="בן הזוג">${q.pairs.length > 2 ? `<button data-x="${i}">✕</button>` : ''}</div>`).join('')}</div>
        ${q.pairs.length < 6 ? '<button class="btn ghost sm" id="addPair">+ זוג</button>' : ''}`;
      box.oninput = (e) => {
        if (e.target.dataset.a !== undefined) q.pairs[e.target.dataset.a].a = e.target.value;
        if (e.target.dataset.b !== undefined) q.pairs[e.target.dataset.b].b = e.target.value;
        soft();
      };
      box.onclick = (e) => {
        const x = e.target.closest('[data-x]');
        if (x) { q.pairs.splice(Number(x.dataset.x), 1); rerender(); }
        if (e.target.id === 'addPair') { q.pairs.push({ a: '', b: '' }); rerender(); }
      };
      return;
    }

    if (q.type === 'sort') {
      const used = q.buckets.reduce((n, b) => n + b.items.filter((x) => x.trim()).length, 0);
      box.innerHTML = `<div class="muted ae-tip">שתי או שלוש קבוצות. בכל קבוצה כתבו את הפריטים שלה, פריט בכל שורה (עד 8 פריטים בסך הכל, כרגע ${used}). השחקנים מקבלים את כל הפריטים מעורבבים.</div>
        <div class="ae-buckets">${q.buckets.map((b, i) => `<div class="ae-bucket" style="--c:${COLORS[i]}"><input data-bn="${i}" maxlength="30" value="${esc(b.name)}" placeholder="שם קבוצה ${i + 1}"><textarea data-bi="${i}" rows="5" placeholder="פריט בכל שורה">${esc(b.items.join('\n'))}</textarea>${q.buckets.length > 2 ? `<button class="btn ghost sm" data-x="${i}">הסרת הקבוצה</button>` : ''}</div>`).join('')}</div>
        ${q.buckets.length < 3 ? '<button class="btn ghost sm" id="addBucket">+ קבוצה</button>' : ''}`;
      box.oninput = (e) => {
        if (e.target.dataset.bn !== undefined) q.buckets[e.target.dataset.bn].name = e.target.value;
        if (e.target.dataset.bi !== undefined) q.buckets[e.target.dataset.bi].items = e.target.value.split('\n');
        soft();
      };
      box.onclick = (e) => {
        const x = e.target.closest('[data-x]');
        if (x) { q.buckets.splice(Number(x.dataset.x), 1); rerender(); }
        if (e.target.id === 'addBucket') { q.buckets.push({ name: '', items: [] }); rerender(); }
      };
      return;
    }

    if (q.type === 'rate') {
      const S = q.scale;
      box.innerHTML = `<div class="ae-slider"><label>סולם<select id="scMax">${[[5, '5 כוכבים'], [7, 'סולם 1–7'], [10, 'סולם 1–10']].map(([v, l]) => `<option value="${v}" ${v === S.max ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>תווית לקצה הנמוך<input id="scLow" maxlength="30" value="${esc(S.low)}" placeholder="למשל: בכלל לא"></label>
        <label>תווית לקצה הגבוה<input id="scHigh" maxlength="30" value="${esc(S.high)}" placeholder="למשל: מאוד"></label></div>
        <div class="muted ae-tip">כל שחקן נותן דירוג אחד. במסך הגדול רואים את ההתפלגות ואת הממוצע. אין תשובה נכונה ואין ניקוד.</div>`;
      box.onchange = (e) => { if (e.target.id === 'scMax') { S.max = Number(e.target.value); dirty(); } };
      box.oninput = (e) => { if (e.target.id === 'scLow') { S.low = e.target.value; dirty(); } if (e.target.id === 'scHigh') { S.high = e.target.value; dirty(); } };
      return;
    }

    if (q.type === 'order' || q.type === 'rank') {
      box.innerHTML = `<div class="muted ae-tip">${q.type === 'rank' ? 'כתבו את הפריטים (אין סדר נכון). כל שחקן מסדר אותם לפי ההעדפה שלו, ובמסך הגדול רואים את הדירוג המשותף של הכיתה.' : 'כתבו את הפריטים בסדר הנכון. השחקנים יקבלו אותם מעורבבים.'}</div>
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
      const NAMES = { circle: '⭕ עיגול', rect: '▭ מלבן', ellipse: '⬭ אליפסה', polygon: '⬠ מצולע' };
      const SUB = { circle: 'נקודה במקום מסוים', rect: 'שורה, עמודה, אזור או קו שלם', ellipse: 'איבר או אזור עגול', polygon: 'צורה חופשית, למשל מדינה במפה' };
      const TIP = {
        circle: 'לחצו על התמונה כדי לסמן את המקום הנכון. העיגול הוא האזור שנחשב לתשובה נכונה.',
        rect: 'גררו על התמונה כדי לצייר את המלבן (לחיצה אחת מזיזה אותו). המלבן הוא האזור שנחשב לתשובה נכונה.',
        ellipse: 'גררו על התמונה כדי לצייר את האליפסה (לחיצה אחת מזיזה אותה). האליפסה היא האזור שנחשב לתשובה נכונה.',
        polygon: 'לחצו על התמונה כדי להוסיף פינות לצורה, לפי הסדר סביב האזור (לפחות 3). הצורה היא האזור שנחשב לתשובה נכונה.',
      };
      const P = q.pin;
      const shape = P.shape;
      const drag = shape === 'rect' || shape === 'ellipse';
      const extras = P.extra || [];
      // the zone itself, without the picture's proportions or the extra zones
      const zoneOf = (z) => { const { ar, extra, ...rest } = z; return JSON.parse(JSON.stringify(rest)); };
      const fresh = (sh) => (sh === 'rect' || sh === 'ellipse' ? { shape: sh, x: 50, y: 50, w: 30, h: 12 } : sh === 'polygon' ? { shape: 'polygon', points: [] } : { shape: 'circle', x: 50, y: 50, r: 10 });
      // same area, other shape
      const reshape = (z, to) => {
        const ar = z.ar || 1;
        let b;
        if (z.shape === 'polygon') {
          const xs = z.points.map((p) => p[0]);
          const ys = z.points.map((p) => p[1]);
          b = xs.length ? { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, w: Math.max(1, Math.max(...xs) - Math.min(...xs)), h: Math.max(1, Math.max(...ys) - Math.min(...ys)) } : { x: 50, y: 50, w: 30, h: 12 };
        } else if (z.shape === 'circle') b = { x: z.x, y: z.y, w: z.r * 2, h: Math.min(100, (z.r * 2) / ar) };
        else b = { x: z.x, y: z.y, w: z.w, h: z.h };
        const out = { ar: z.ar, extra: z.extra };
        if (to === 'circle') return { ...out, shape: 'circle', x: b.x, y: b.y, r: Math.max(2, Math.min(40, Math.round(b.w / 2))) };
        if (to === 'polygon') {
          const c = (v) => Math.max(0, Math.min(100, Math.round(v * 10) / 10));
          return { ...out, shape: 'polygon', points: [[c(b.x - b.w / 2), c(b.y - b.h / 2)], [c(b.x + b.w / 2), c(b.y - b.h / 2)], [c(b.x + b.w / 2), c(b.y + b.h / 2)], [c(b.x - b.w / 2), c(b.y + b.h / 2)]] };
        }
        return { ...out, shape: to, x: b.x, y: b.y, w: b.w, h: b.h };
      };
      box.innerHTML = q.image
        ? `<div class="pin-shapes">${Object.keys(NAMES).map((k) => `<button data-shape="${k}" class="${k === shape ? 'on' : ''}">${NAMES[k]}<small>${SUB[k]}</small></button>`).join('')}</div>
           <div class="muted ae-tip">${TIP[shape]}</div>
           <div class="pin-box"><div class="pin-ed" id="pinEd"><img src="${mediaUrl(q.image)}" alt="" draggable="false">${extras.map((z) => QMedia.zone1(z, 'pin-zone dim')).join('')}${QMedia.zone1(P, 'pin-zone pin-main')}${shape === 'polygon' ? P.points.map(([x, y]) => `<i class="pin-dot" style="left:${x}%;top:${y}%"></i>`).join('') : ''}</div></div>
           ${drag
             ? `<div class="pin-sizes"><label class="ae-rad">רוחב <input type="range" dir="ltr" id="pinW" min="1" max="100" value="${P.w}"></label><label class="ae-rad">גובה <input type="range" dir="ltr" id="pinH" min="1" max="100" value="${P.h}"></label></div>`
             : shape === 'polygon'
               ? `<div class="row"><button class="btn ghost sm" id="polyUndo">↩ מחיקת הנקודה האחרונה</button><button class="btn ghost sm" id="polyClear">🗑 התחלה מחדש</button><span class="muted">${P.points.length} נקודות</span></div>`
               : `<label class="ae-rad">גודל האזור <input type="range" dir="ltr" id="pinR" min="2" max="40" value="${P.r}"></label>`}
           <div class="pin-zones">${extras.map((z, i) => `<button class="chip" data-sw="${i}" title="עריכת האזור הזה">${NAMES[z.shape]} ${i + 1}<i data-rm="${i}" title="הסרה">✕</i></button>`).join('')}<button class="btn ghost sm" id="addZone" ${extras.length >= 5 || (shape === 'polygon' && P.points.length < 3) ? 'disabled' : ''}>➕ אזור נוסף</button>${extras.length ? '<span class="muted">כל האזורים נחשבים תשובה נכונה</span>' : ''}</div>
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
      box.querySelector('.pin-shapes').onclick = (e) => {
        const b = e.target.closest('[data-shape]');
        if (!b || b.dataset.shape === shape) return;
        q.pin = reshape(P, b.dataset.shape);
        rerender();
      };
      box.querySelector('.pin-zones').onclick = (e) => {
        const rm = e.target.closest('[data-rm]');
        const sw = e.target.closest('[data-sw]');
        if (rm) {
          P.extra.splice(Number(rm.dataset.rm), 1);
          if (!P.extra.length) delete P.extra;
        } else if (sw) {
          // edit that zone: it swaps places with the one being edited
          const i = Number(sw.dataset.sw);
          const list = P.extra.slice();
          const z = list[i];
          list[i] = zoneOf(P);
          q.pin = { ...z, ar: P.ar, extra: list };
        } else if (e.target.closest('#addZone')) {
          q.pin = { ...fresh(shape), ar: P.ar, extra: [...extras, zoneOf(P)] };
        } else return;
        rerender();
      };
      const ed = document.getElementById('pinEd');
      const img = ed.querySelector('img');
      U.fitImage(ed, img);
      // remember the picture's proportions: the server keeps the circle round with it
      const keepAr = () => {
        if (!img.naturalWidth) return;
        const ar = Math.round((img.naturalWidth / img.naturalHeight) * 1000) / 1000;
        if (q.pin.ar !== ar) { q.pin.ar = ar; dirty(); }
      };
      if (img.complete) keepAr();
      img.addEventListener('load', keepAr);
      const zone = () => { ed.querySelector('.pin-main').outerHTML = QMedia.zone1(q.pin, 'pin-zone pin-main'); soft(); };
      const at = (e) => {
        const r = ed.getBoundingClientRect();
        return { x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)), y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)) };
      };
      if (drag) {
        // drag = draw a new rectangle / ellipse; a click without dragging moves it
        let start = null;
        ed.onpointerdown = (e) => { e.preventDefault(); start = at(e); ed.setPointerCapture(e.pointerId); };
        ed.onpointermove = (e) => {
          if (!start) return;
          const p = at(e);
          if (Math.abs(p.x - start.x) < 1 && Math.abs(p.y - start.y) < 1) return;
          q.pin.x = (start.x + p.x) / 2;
          q.pin.y = (start.y + p.y) / 2;
          q.pin.w = Math.max(1, Math.abs(p.x - start.x));
          q.pin.h = Math.max(1, Math.abs(p.y - start.y));
          start.moved = true;
          zone();
        };
        ed.onpointerup = (e) => {
          if (start && !start.moved) {
            const p = at(e);
            q.pin.x = Math.max(q.pin.w / 2, Math.min(100 - q.pin.w / 2, p.x));
            q.pin.y = Math.max(q.pin.h / 2, Math.min(100 - q.pin.h / 2, p.y));
          }
          start = null;
          rerender();
        };
        document.getElementById('pinW').oninput = (e) => { q.pin.w = Number(e.target.value); zone(); };
        document.getElementById('pinH').oninput = (e) => { q.pin.h = Number(e.target.value); zone(); };
      } else if (shape === 'polygon') {
        ed.onclick = (e) => {
          const p = at(e);
          q.pin.points.push([Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
          rerender();
        };
        document.getElementById('polyUndo').onclick = () => { q.pin.points.pop(); rerender(); };
        document.getElementById('polyClear').onclick = () => { q.pin.points = []; rerender(); };
      } else {
        ed.onclick = (e) => {
          Object.assign(q.pin, at(e));
          rerender();
        };
        document.getElementById('pinR').oninput = (e) => { q.pin.r = Number(e.target.value); zone(); };
      }
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

    if (q.type === 'cloud' || q.type === 'open' || q.type === 'brain' || q.type === 'qna') {
      const what = { cloud: 'מילים', open: 'תשובות', brain: 'רעיונות', qna: 'שאלות' }[q.type];
      const tip = {
        cloud: 'כל שחקן שולח מילה או ביטוי קצר. במסך הגדול המילים שחוזרות הרבה מופיעות גדולות יותר. המורה יכול ללחוץ על מילה כדי להסתיר אותה.',
        open: 'כל שחקן כותב תשובה חופשית, והתשובות מופיעות כפתקים על המסך הגדול (אפשר להסתיר פתק בלחיצה). אין תשובה נכונה ואין ניקוד.',
        brain: 'כל שחקן שולח רעיונות, ואז כולם מצביעים (עד 3 רעיונות, לא על הרעיון של עצמם). בסוף מוצג דירוג הרעיונות.',
        qna: 'כל שחקן שולח שאלות לכיתה, ואז כולם מצביעים על השאלות שהכי חשוב לענות עליהן (עד 3, לא על השאלה של עצמם). בסוף מוצג דירוג השאלות, מהחשובה ביותר.',
      }[q.type];
      box.innerHTML = `<div class="ae-slider"><label>כמה ${what} כל שחקן יכול לשלוח<select id="limSel">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${n === q.limit ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div><div class="muted ae-tip">${tip}</div>`;
      box.onchange = (e) => { if (e.target.id === 'limSel') { q.limit = Number(e.target.value); dirty(); } };
      return;
    }

    if (q.type === 'drop') {
      box.innerHTML = '<div class="muted ae-tip">העלו תמונה. כל שחקן מניח עליה סיכה במקום שהוא בוחר, ובמסך הגדול רואים את כל הסיכות יחד. אין תשובה נכונה ואין ניקוד.</div>';
      return;
    }

    if (q.type === 'tap') {
      box.innerHTML = '<div class="muted ae-tip">כולם מקישים על כפתור גדול בטלפון כמה שיותר מהר, במשך הזמן שנקבע. במסך הגדול מופיע דירוג המקישים. כיף וקצר, בלי תשובה נכונה ובלי ניקוד. אפשר להקיש עד 14 פעמים בשנייה.</div>';
      return;
    }

    if (q.type === 'pdf') return pdfEditor(q, box, rerender);

    // a slide: layout, text, bullet points, a countdown, notes (a picture or video goes in the area above)
    const LAY = [['', 'אוטומטי'], ['title', 'כותרת'], ['bullets', 'כותרת ונקודות'], ['image-right', 'טקסט ותמונה (תמונה משמאל)'], ['image-left', 'טקסט ותמונה (תמונה מימין)'], ['full-image', 'תמונה מלאה עם טקסט'], ['quote', 'ציטוט'], ['fun', 'הפסקה / כיף']];
    const TIM = [[0, 'בלי'], [30, '30 שניות'], [60, 'דקה'], [120, '2 דקות'], [300, '5 דקות'], [600, '10 דקות']];
    box.innerHTML = `<div class="ae-slide">
        <label>🎨 עיצוב השקופית<select id="slLay">${LAY.map(([v, l]) => `<option value="${v}" ${(q.layout || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>טקסט נוסף מתחת לכותרת<textarea id="slBody" maxlength="600" rows="3" placeholder="לא חובה">${esc(q.body || '')}</textarea></label>
        <label>נקודות (שורה לכל נקודה, עד 8)<textarea id="slBul" maxlength="900" rows="5" placeholder="נקודה ראשונה&#10;נקודה שנייה">${esc((q.bullets || []).join('\n'))}</textarea></label>
        <label>⏱ ספירה לאחור על המסך<select id="slTim">${TIM.map(([v, l]) => `<option value="${v}" ${(q.timer || 0) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>📝 הערות למורה<textarea id="slNot" maxlength="800" rows="2" placeholder="נשמרות כאן בלבד, לא מוצגות לכיתה">${esc(q.notes || '')}</textarea></label>
      </div>
      <div class="muted ae-tip">שקופית: מוצגת על המסך הגדול. בשיעור התלמידים מגיבים בטלפון (👍 הבנתי · 🤔 לא בטוח · 🙋 שאלה). תמונה או סרטון מוסיפים באזור שמעל.</div>`;
    box.oninput = (e) => {
      const id = e.target.id;
      if (id === 'slBody') { if (e.target.value.trim()) q.body = e.target.value; else delete q.body; }
      else if (id === 'slBul') { const b = e.target.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 8); if (b.length) q.bullets = b; else delete q.bullets; }
      else if (id === 'slNot') { if (e.target.value.trim()) q.notes = e.target.value; else delete q.notes; }
      else return;
      soft();
    };
    box.onchange = (e) => {
      if (e.target.id === 'slLay') { if (e.target.value) q.layout = e.target.value; else delete q.layout; dirty(); }
      if (e.target.id === 'slTim') { const v = Number(e.target.value); if (v) q.timer = v; else delete q.timer; dirty(); }
    };
  }

  // ---------- a PDF page as a step ----------
  function pdfEditor(q, box, rerender) {
    const f = q.pdf && q.pdf.file;
    if (!f) {
      box.innerHTML = '<div class="drop" id="pdfDrop"><div class="drop-hint">📄 העלו קובץ PDF (מצגת שיצאה מפאוורפוינט או גוגל סליידס, מסמך, דף עבודה…)<small>כל עמוד נהיה שקופית, ואפשר להכניס ביניהם סקרים ושאלות</small></div><input type="file" id="pdfFile" accept="application/pdf" hidden></div>';
      const d = document.getElementById('pdfDrop');
      d.onclick = () => document.getElementById('pdfFile').click();
      document.getElementById('pdfFile').onchange = (e) => e.target.files[0] && upload(e.target.files[0]);
      d.ondragover = (e) => { e.preventDefault(); d.classList.add('over'); };
      d.ondragleave = () => d.classList.remove('over');
      d.ondrop = (e) => { e.preventDefault(); d.classList.remove('over'); if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]); };
      return;
    }
    const url = mediaUrl(f);
    box.innerHTML = `<div class="pdf-ed">
        <div class="pdf-prev" id="pdfPrev"><canvas id="pdfCv"></canvas></div>
        <div class="pdf-ctl"><button class="btn ghost sm" data-pg="-1">▶ הקודם</button><label>עמוד <input type="number" id="pdfPg" min="1" value="${q.pdf.page}"></label><span class="muted" id="pdfTot"></span><button class="btn ghost sm" data-pg="1">הבא ◀</button></div>
        <div class="row"><button class="btn ghost sm" id="pdfAll">➕ הוספת שאר העמודים כשקופיות אחרי זו</button><label class="btn ghost sm">🔄 החלפת קובץ<input type="file" id="pdfFile" accept="application/pdf" hidden></label></div>
        <div class="muted ae-tip">הכותרת למעלה היא כיתוב קטן מתחת לעמוד (לא חובה). אפשר להכניס סקר או שאלה בין העמודים: הוסיפו שאלה והעבירו אותה למקום.</div></div>`;
    let total = 0;
    const draw = () => {
      const cv = document.getElementById('pdfCv');
      if (cv) Slides.draw(url, q.pdf.page, cv, 520, 330).catch(() => (document.getElementById('pdfPrev').innerHTML = '<div class="muted">לא הצלחנו להציג את העמוד</div>'));
    };
    Slides.pages(url).then((n) => {
      total = n;
      const t = document.getElementById('pdfTot');
      if (t) t.textContent = `מתוך ${n}`;
      const inp = document.getElementById('pdfPg');
      if (inp) inp.max = n;
    }).catch(() => {});
    draw();
    const go = (p) => { p = Math.max(1, Math.min(total || 999, p)); if (p === q.pdf.page) return; q.pdf.page = p; document.getElementById('pdfPg').value = p; dirty(); draw(); };
    box.onclick = (e) => {
      const b = e.target.closest('[data-pg]');
      if (b) go(q.pdf.page + Number(b.dataset.pg));
      if (e.target.id === 'pdfAll') {
        if (!total || q.pdf.page >= total) return toast('אין עוד עמודים אחרי העמוד הזה');
        const rest = [];
        for (let p = q.pdf.page + 1; p <= total; p++) rest.push({ type: 'pdf', text: '', time: 20, points: 0, pdf: { file: f, page: p } });
        quiz.questions.splice(cur + 1, 0, ...rest);
        dirty();
        toast(`נוספו ${rest.length} עמודים כשקופיות`);
        drawAll();
      }
    };
    box.onchange = (e) => {
      if (e.target.id === 'pdfPg') go(Number(e.target.value) || 1);
      if (e.target.id === 'pdfFile' && e.target.files[0]) upload(e.target.files[0]);
    };
  }

  function drawSide() {
    const q = quiz.questions[cur];
    const side = document.getElementById('side');
    side.innerHTML = `
      <label>סוג השאלה<select id="sType">${TYPES.map(([k, l, , ic]) => `<option value="${k}" ${k === q.type ? 'selected' : ''}>${ic} ${l}</option>`).join('')}</select></label>
      <label>⏱ זמן לשאלה<select id="sTime">${TIMES.map((t) => `<option value="${t}" ${t === q.time ? 'selected' : ''}>${t < 60 ? t + ' שניות' : t / 60 + ' דק׳'}</option>`).join('')}</select></label>
      ${UNSCORED.includes(q.type) ? '' : `<label>⭐ ניקוד<select id="sPts">${POINTS.map(([v, l]) => `<option value="${v}" ${v === q.points ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`}
      ${q.image && q.type !== 'pin' && q.type !== 'puzzle' && q.type !== 'drop' ? `<label>🌫️ חשיפת התמונה<select id="sReveal">${[['', 'מיד'], ['blur', 'טשטוש שמתבהר'], ['tiles', 'אריחים שנעלמים']].map(([v, l]) => `<option value="${v}" ${(q.reveal || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        ${q.reveal ? `<label>⏳ משך החשיפה<select id="sRevealSec">${[[0, 'לאורך כל הזמן'], [5, '5 שניות'], [10, '10 שניות'], [15, '15 שניות'], [20, '20 שניות'], [30, '30 שניות'], [45, '45 שניות'], [60, 'דקה']].map(([v, l]) => `<option value="${v}" ${(q.revealSec || 0) === v ? 'selected' : ''}>${l}</option>`).join('')}</select><small class="muted">מי שעונה מהר, לפני שרואים הכל, מקבל יותר נקודות</small></label>` : ''}` : ''}
      ${q.image && q.type !== 'pin' && q.type !== 'puzzle' && q.type !== 'drop' && q.type !== 'slide' ? `<label>👁️ מתי להציג את התמונה<select id="sWhen"><option value="">בזמן השאלה</option><option value="after" ${q.imageWhen === 'after' ? 'selected' : ''}>רק אחרי התשובה (להסבר)</option></select></label>` : ''}
      ${q.type === 'slide' || q.type === 'pdf' ? '' : `<label>💡 הסבר אחרי התשובה<textarea id="sExplain" maxlength="200" rows="3" placeholder="למה זו התשובה? (לא חובה)">${esc(q.explain || '')}</textarea></label>
      <div class="ex-img"><span>🖼️ תמונה להסבר <small>(מוצגת אחרי התשובה)</small></span>${q.explainImage ? `<div class="ex-thumb"><img src="${mediaUrl(q.explainImage)}" alt=""><button id="exImgX" title="הסרה">✕</button></div>` : `<label class="btn ghost sm">⬆ העלאת תמונה<input type="file" id="exImgFile" accept="image/*" hidden></label>`}</div>`}
      ${q.type === 'slide' || q.type === 'pdf' ? '' : `<div class="ex-img"><span>📄 עמוד PDF שמוצג עם הפעילות <small>(השאלה על העמוד)</small></span>
        <select id="sPdf"><option value="">בלי</option>${pdfFiles().map((f, i) => `<option value="${esc(f)}" ${q.pdf && q.pdf.file === f ? 'selected' : ''}>PDF ${i + 1}</option>`).join('')}<option value="__new">⬆ העלאת PDF חדש…</option></select>
        ${q.pdf ? `<label>עמוד <input type="number" id="sPdfPg" min="1" max="999" value="${q.pdf.page}" style="width:70px"></label>` : ''}
        <input type="file" id="sPdfFile" accept="application/pdf" hidden></div>
        <div class="ex-img"><span>📖 מקור התשובה <small>(מוצג אחרי התשובה)</small></span>
        <input class="input sm" id="sSrcDoc" maxlength="80" placeholder="מסמך / ספר" value="${esc((q.source && q.source.doc) || '')}">
        <input class="input sm" id="sSrcLoc" maxlength="60" placeholder="עמוד / פרק" value="${esc((q.source && q.source.loc) || '')}">
        <input class="input sm" id="sSrcQuote" maxlength="240" placeholder="ציטוט קצר (לא חובה)" value="${esc((q.source && q.source.quote) || '')}"></div>`}
      <div class="side-note">במשחקים (לא בחידון הקלאסי) אין הגבלת זמן, וניקוד כפול = מתקדמים מהר יותר לתור הבא.</div>
      <div class="probs" id="probs">${probsHtml(q)}</div>
      <div class="side-stats">${quiz.questions.length} שאלות · ${quiz.questions.filter((x) => !problems(x).length).length} מוכנות</div>`;
    side.onchange = (e) => {
      if (e.target.id === 'sType') { quiz.questions[cur] = convert(q, e.target.value); dirty(); drawAll(); }
      if (e.target.id === 'sTime') { q.time = Number(e.target.value); dirty(); }
      if (e.target.id === 'sPdf') {
        if (e.target.value === '__new') return document.getElementById('sPdfFile').click();
        if (e.target.value) q.pdf = { file: e.target.value, page: (q.pdf && q.pdf.page) || 1 }; else delete q.pdf;
        dirty(); drawSide();
      }
      if (e.target.id === 'sPdfPg') { q.pdf.page = Math.max(1, Math.min(999, Number(e.target.value) || 1)); dirty(); }
      if (e.target.id === 'sPdfFile' && e.target.files[0]) upload(e.target.files[0]);
      if (e.target.id === 'sPts') { q.points = Number(e.target.value); dirty(); }
      if (e.target.id === 'sReveal') { if (e.target.value) q.reveal = e.target.value; else { delete q.reveal; delete q.revealSec; } dirty(); drawSide(); }
      if (e.target.id === 'sWhen') { if (e.target.value) q.imageWhen = e.target.value; else delete q.imageWhen; dirty(); }
      if (e.target.id === 'exImgFile' && e.target.files[0]) upload(e.target.files[0], 'explain');
      if (e.target.id === 'sRevealSec') { const v = Number(e.target.value); if (v) q.revealSec = v; else delete q.revealSec; dirty(); }
    };
    side.oninput = (e) => {
      if (e.target.id === 'sExplain') { q.explain = e.target.value; dirty(); }
      if (['sSrcDoc', 'sSrcLoc', 'sSrcQuote'].includes(e.target.id)) {
        const v = (id) => document.getElementById(id).value;
        const src = { doc: v('sSrcDoc'), loc: v('sSrcLoc'), quote: v('sSrcQuote') };
        if (src.doc.trim() || src.loc.trim() || src.quote.trim()) q.source = src; else delete q.source;
        dirty();
      }
    };
    side.onclick = (e) => {
      if (e.target.id === 'exImgX') { delete q.explainImage; dirty(); drawSide(); }
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
