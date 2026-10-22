// Quiz editor: library of quizzes in the admin's folder + a question-by-question editor (autosaves).
(function () {
  const { esc } = U;
  const app = document.getElementById('app');
  const TYPES = [
    ['quiz', 'חידון', 'תשובה אחת או יותר נכונות (2–6)', '🔷'],
    ['tf', 'נכון / לא נכון', 'שתי תשובות', '⚖️'],
    ['type', 'הקלדת תשובה', 'השחקן מקליד, כמה איותים מותרים', '⌨️'],
    ['slider', 'סרגל מספרים', 'בוחרים מספר בטווח', '🎚️'],
    ['order', 'סידור (פאזל)', 'מסדרים פריטים בסדר הנכון', '🧩'],
    ['pin', 'סימון על תמונה', 'לוחצים על המקום הנכון', '📍'],
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
    if (!res.ok) throw new Error(data.error || 'שגיאה');
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

  // ---------- library ----------
  async function library() {
    quiz = null;
    let list = [];
    let folder = '';
    try {
      [list, { folder }] = await Promise.all([api('/quizzes'), api('/folder')]);
    } catch (e) {
      app.innerHTML = `<div class="screen center wait"><h2>${esc(e.message)}</h2><div class="muted">פתחו את העורך מהמחשב שמריץ את השרת (localhost:3000/editor.html)</div></div>`;
      return;
    }
    app.innerHTML = `
      <header class="ed-head">
        <div class="logo"><div class="logo-mark">${Art.star()}</div><div class="logo-text">ספריית החידונים</div></div>
        <button class="folder-chip" id="folderBtn" title="שינוי תיקייה">📁 <span dir="ltr">${esc(folder)}</span> · שינוי</button>
        <a class="btn ghost sm" href="host.html">🎮 למסך המשחק</a>
      </header>
      <div class="lib-tools">
        <button class="btn green sm" id="newQuiz">+ חידון חדש</button>
        <label class="btn blue sm">⬆ ייבוא מאקסל / zip עם תמונות<input type="file" id="importFile" accept=".xlsx,.zip" hidden></label>
        <a class="btn ghost sm" href="/api/q/template.xlsx">⬇ תבנית ריקה</a>
        <input class="input sm search" id="search" placeholder="🔍 חיפוש" value="${esc(filter)}">
      </div>
      <div class="lib-grid" id="grid"></div>`;
    const draw = () => {
      const f = filter.trim();
      document.getElementById('grid').innerHTML = list
        .filter((q) => !f || q.title.includes(f))
        .map((q, i) => `<div class="qcard" style="--i:${i}">
          <div class="qc-cover" data-open="${esc(q.id)}">${q.cover ? `<img src="/media/${encodeURIComponent(q.id)}/${encodeURIComponent(q.cover)}" alt="">` : `<span>${['🧠', '🌍', '🔬', '📚', '🎨', '🧮'][i % 6]}</span>`}<b class="qc-count">${q.count} שאלות</b></div>
          <div class="qc-body"><div class="qc-title">${esc(q.title)}</div>
            <div class="qc-sub">${q.builtin ? 'מובנה · שכפלו כדי לערוך' : q.updated ? 'עודכן ' + new Date(q.updated).toLocaleDateString('he-IL') : ''}${q.playable < q.count ? ` · <span class="bad-t">${q.count - q.playable} לא מוכנות</span>` : ''}</div>
            <div class="qc-actions">${q.builtin ? '' : `<button data-open="${esc(q.id)}">✏️ עריכה</button>`}<button data-dup="${esc(q.id)}">⧉ שכפול</button>${q.builtin ? '' : `<a href="/api/q/quizzes/${encodeURIComponent(q.id)}/export.xlsx">⬇ אקסל</a><button data-del="${esc(q.id)}" class="del">🗑</button>`}</div>
          </div></div>`)
        .join('') || '<div class="muted">אין חידונים בתיקייה עדיין</div>';
    };
    draw();
    document.getElementById('search').oninput = (e) => { filter = e.target.value; draw(); };
    document.getElementById('folderBtn').onclick = () => folderPicker(folder);
    document.getElementById('newQuiz').onclick = async () => {
      const q = await api('/quizzes', { method: 'POST', body: JSON.stringify({ title: 'חידון חדש' }) });
      open(q.id, true);
    };
    document.getElementById('importFile').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const r = await api('/import?title=' + encodeURIComponent(file.name.replace(/\.(xlsx|zip)$/i, '')), { method: 'POST', body: await file.arrayBuffer(), headers: { 'Content-Type': 'application/octet-stream' } });
        const notes = [r.special ? `${r.special} מיוחדות` : '', r.images ? `${r.images} תמונות` : '', r.skipped ? `${r.skipped} דולגו` : '', r.downgraded ? `${r.downgraded} יובאו כרב-ברירה` : '', r.missingImages ? `${r.missingImages} תמונות חסרות` : ''].filter(Boolean);
        toast(`יובאו ${r.count} שאלות${notes.length ? ` (${notes.join(', ')})` : ''}`);
        open(r.id);
      } catch (err) {
        toast(err.message, true);
      }
    };
    document.getElementById('grid').onclick = async (e) => {
      const o = e.target.closest('[data-open]');
      const d = e.target.closest('[data-dup]');
      const x = e.target.closest('[data-del]');
      if (o) open(o.dataset.open);
      if (d) { const q = await api(`/quizzes/${encodeURIComponent(d.dataset.dup)}/duplicate`, { method: 'POST' }); toast('נוצר עותק'); open(q.id); }
      if (x && confirm('למחוק את החידון? (הוא יעבור לתיקיית .trash)')) { await api('/quizzes/' + encodeURIComponent(x.dataset.del), { method: 'DELETE' }); library(); }
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

  function drawStage() {
    const q = quiz.questions[cur];
    const st = document.getElementById('stage');
    const media = q.type === 'pin' ? '' : `<div class="drop ${q.image ? 'has' : ''}" id="drop">${q.image ? `<img src="${mediaUrl(q.image)}" alt=""><button class="img-x" id="imgX" title="הסרת תמונה">✕</button>` : '<div class="drop-hint">🖼️ גררו תמונה לכאן, הדביקו (Ctrl+V) או לחצו להעלאה</div>'}<input type="file" id="imgFile" accept="image/*" hidden></div>`;
    st.innerHTML = `
      <textarea class="q-text-in" id="qtext" maxlength="300" placeholder="הקלידו את השאלה…">${esc(q.text)}</textarea>
      ${media}
      <div class="ans-ed" id="ansEd"></div>`;
    const ta = document.getElementById('qtext');
    ta.oninput = () => { q.text = ta.value; soft(); };
    if (!q.text) setTimeout(() => ta.focus(), 50);
    const drop = document.getElementById('drop');
    if (drop) {
      drop.onclick = (e) => {
        if (e.target.id === 'imgX') { delete q.image; delete q.reveal; dirty(); drawAll(); return; }
        document.getElementById('imgFile').click();
      };
      document.getElementById('imgFile').onchange = (e) => e.target.files[0] && upload(e.target.files[0]);
      drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
      drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) upload(f); };
    }
    drawAnswers();
  }

  async function upload(file) {
    if (!file.type.startsWith('image/')) return toast('רק תמונות', true);
    if (file.size > 12 * 1024 * 1024) return toast('התמונה גדולה מדי (עד 12MB)', true);
    try {
      const r = await api(`/quizzes/${encodeURIComponent(quiz.id)}/media`, { method: 'POST', body: file, headers: { 'Content-Type': file.type } });
      quiz.questions[cur].image = r.name;
      dirty();
      drawAll();
    } catch (e) {
      toast(e.message, true);
    }
  }

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

    box.innerHTML = '<div class="muted ae-tip">שקופית מידע: מוצגת לכולם בחידון הקלאסי, בלי תשובות.</div>';
  }

  function drawSide() {
    const q = quiz.questions[cur];
    const side = document.getElementById('side');
    side.innerHTML = `
      <label>סוג השאלה<select id="sType">${TYPES.map(([k, l, , ic]) => `<option value="${k}" ${k === q.type ? 'selected' : ''}>${ic} ${l}</option>`).join('')}</select></label>
      <label>⏱ זמן לשאלה<select id="sTime">${TIMES.map((t) => `<option value="${t}" ${t === q.time ? 'selected' : ''}>${t < 60 ? t + ' שניות' : t / 60 + ' דק׳'}</option>`).join('')}</select></label>
      ${q.type === 'slide' ? '' : `<label>⭐ ניקוד<select id="sPts">${POINTS.map(([v, l]) => `<option value="${v}" ${v === q.points ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`}
      ${q.image && q.type !== 'pin' ? `<label class="tog"><input type="checkbox" id="sReveal" ${q.reveal ? 'checked' : ''}> חשיפת תמונה הדרגתית<small>התמונה מטושטשת ומתבהרת במהלך הזמן</small></label>` : ''}
      <div class="side-note">במשחקים (לא בחידון הקלאסי) אין הגבלת זמן, וניקוד כפול = מתקדמים מהר יותר לתור הבא.</div>
      <div class="probs" id="probs">${probsHtml(q)}</div>
      <div class="side-stats">${quiz.questions.length} שאלות · ${quiz.questions.filter((x) => !problems(x).length).length} מוכנות</div>`;
    side.onchange = (e) => {
      if (e.target.id === 'sType') { quiz.questions[cur] = convert(q, e.target.value); dirty(); drawAll(); }
      if (e.target.id === 'sTime') { q.time = Number(e.target.value); dirty(); }
      if (e.target.id === 'sPts') { q.points = Number(e.target.value); dirty(); }
      if (e.target.id === 'sReveal') { q.reveal = e.target.checked; dirty(); }
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
