// Classes and progress: make a class list (the names students pick when they join), and see how the class and each
// student are doing over all the games played with that class chosen.
(function () {
  const { esc } = U;
  const app = document.getElementById('app');
  let classes = [];
  let curId = '';
  let data = null; // progress of the selected class

  async function api(path, opts = {}) {
    const json = typeof opts.body === 'string';
    const res = await fetch('/api/q' + path, { ...opts, headers: json ? { 'Content-Type': 'application/json' } : undefined });
    const d = await res.json().catch(() => ({}));
    if (res.status === 401 && d.login) location.href = '/login.html?next=' + encodeURIComponent(location.pathname);
    if (!res.ok) throw new Error(d.error || 'שגיאה');
    return d;
  }
  const toast = (text, bad) => {
    const t = document.createElement('div');
    t.className = 'ed-toast' + (bad ? ' bad' : '');
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  };

  // a tiny line chart of accuracy over the games (0-100)
  function spark(trend) {
    if (!trend.length) return '<span class="muted">—</span>';
    const W = 90;
    const H = 26;
    const pts = trend.map((v, i) => [trend.length === 1 ? W / 2 : (i / (trend.length - 1)) * W, H - 3 - (v / 100) * (H - 6)]);
    const last = trend[trend.length - 1];
    const up = trend.length > 1 && last > trend[0];
    const down = trend.length > 1 && last < trend[0];
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><polyline points="${pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${up ? '#2ee59d' : down ? '#ff8aa0' : '#ffd23f'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6" fill="#fff"/>`).join('')}</svg>`;
  }
  const bar = (pct) => (pct === null ? '<span class="muted">—</span>' : `<span class="pbar"><i style="width:${pct}%" class="${pct >= 80 ? 'hi' : pct >= 50 ? 'mid' : 'lo'}"></i></span><b>${pct}%</b>`);
  const when = (iso) => (iso ? new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: '2-digit' }) : '—');

  async function load() {
    classes = await api('/classes');
    if (!curId || !classes.some((c) => c.id === curId)) curId = (classes[0] || {}).id || '';
    data = curId ? await api(`/classes/${encodeURIComponent(curId)}/progress`) : null;
    draw();
  }

  function draw() {
    const c = data && data.class;
    app.innerHTML = `
      <header class="pg-top">
        <a class="btn ghost sm" href="host.html">→ למסך המורה</a>
        <h1>📊 כיתות והתקדמות</h1>
        <div class="pg-pick">
          <select class="input sm" id="clsSel">${classes.map((x) => `<option value="${esc(x.id)}" ${x.id === curId ? 'selected' : ''}>${esc(x.name)} (${x.count})</option>`).join('') || '<option value="">אין כיתות עדיין</option>'}</select>
          <button class="btn sm blue" id="newCls">+ כיתה חדשה</button>
        </div>
      </header>
      <main class="pg-main">
        ${c ? dash() : empty()}
      </main>`;
    wire();
  }

  const empty = () => `<div class="card pg-empty"><div class="big">👥</div><h2>עוד אין כיתות</h2>
    <p>כיתה היא רשימת שמות של התלמידים. כשבוחרים כיתה בחדר המשחק, כל תלמיד בוחר את השם שלו מהרשימה, וככה ההתקדמות של כל אחד נשמרת בין משחקים ובין שיעורים.</p>
    <button class="btn big" id="newCls2">+ יצירת הכיתה הראשונה</button></div>`;

  function dash() {
    const d = data;
    const done = d.sessions.length;
    return `
      <section class="card pg-sum">
        <div class="pg-stat"><b>${done}</b><span>משחקים</span></div>
        <div class="pg-stat"><b>${d.students.filter((s) => s.sessions).length}/${d.class.students.length}</b><span>תלמידים שהשתתפו</span></div>
        <div class="pg-stat"><b>${d.accuracy === null ? '—' : d.accuracy + '%'}</b><span>דיוק הכיתה</span></div>
        <div class="pg-stat"><b>${d.answered}</b><span>תשובות</span></div>
        <div class="pg-act"><button class="btn sm ghost" id="editCls">✏️ עריכת הרשימה</button><button class="btn sm ghost" id="csv">⬇ הורדה לאקסל</button><button class="btn sm ghost" id="grades" title="שורה לכל תלמיד ועמודה לכל משחק, להדבקה בגיליון הציונים">⬇ ציונים לגיליון</button></div>
      </section>
      ${done ? '' : '<div class="card pg-note">עוד לא שוחקו משחקים עם הכיתה הזו. בחדר המשחק בחרו את הכיתה תחת "👥 כיתה", ושחקו חידון: ההתקדמות תופיע כאן.</div>'}
      <section class="card">
        <h2>תלמידים</h2>
        <div class="tbl-wrap"><table class="rep pg-table"><thead><tr><th>שם</th><th>משחקים</th><th>תשובות</th><th>דיוק</th><th>מגמה</th><th>אחרון</th><th>הערה</th></tr></thead><tbody>
          ${d.students.map((s) => `<tr class="${s.sessions ? '' : 'off'}"><td><span class="nm">${U.avatar(s.name)}${esc(s.name)}</span>${s.inClass ? '' : ' <small class="muted">(אורח/ת)</small>'}</td><td>${s.sessions}</td><td>${s.answered}</td><td class="acc">${bar(s.accuracy)}</td><td>${spark(s.trend)}</td><td>${when(s.last)}</td><td><button class="pg-note-b ${s.note ? 'has' : ''}" data-note="${esc(s.name)}" title="${esc(s.note || 'הערה פרטית על התלמיד')}">${s.note ? '📝' : '＋'}</button></td></tr>`).join('')}
        </tbody></table></div>
      </section>
      <div class="pg-two">
        <section class="card"><h2>🧗 השאלות הקשות ביותר</h2>
          ${d.hardest.length ? `<ol class="pg-hard">${d.hardest.map((q) => `<li><span class="q">${esc(q.q)}</span><span class="a">${bar(q.accuracy)}<small>${q.n} תשובות</small></span></li>`).join('')}</ol>` : '<div class="muted">מופיעות כאן שאלות שענו עליהן לפחות 3 פעמים.</div>'}
        </section>
        <section class="card"><h2>🗓 משחקים אחרונים</h2>
          ${done ? `<ul class="pg-sess">${d.sessions.slice(0, 12).map((s) => `<li><b>${when(s.at)}</b><span>${esc(s.quiz || '—')}</span><small>${esc(s.game)} · ${s.players} שחקנים</small><span class="pcell">${bar(s.accuracy)}</span></li>`).join('')}</ul>` : '<div class="muted">אין משחקים עדיין.</div>'}
        </section>
      </div>`;
  }

  // ---------- class editor ----------
  function editor(cls) {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="modal-card pg-edit"><div class="modal-head"><h2>${cls ? '✏️ עריכת כיתה' : '+ כיתה חדשה'}</h2><div class="modal-actions"><button class="btn sm ghost" id="eClose">✕</button></div></div>
      <label class="pg-f">שם הכיתה<input class="input" id="eName" maxlength="30" placeholder="למשל: ז׳1" value="${cls ? esc(cls.name) : ''}"></label>
      <label class="pg-f">התלמידים: שם בכל שורה (אפשר להדביק מאקסל או מוורד)<textarea class="input" id="eList" rows="12" placeholder="דנה כהן&#10;יוסי לוי&#10;נועה…">${cls ? esc(cls.students.join('\n')) : ''}</textarea></label>
      <div class="row"><label class="btn ghost sm">📥 הוספה מקובץ (Excel, CSV, טקסט)<input type="file" id="eFile" accept=".xlsx,.csv,.txt,text/plain,text/csv" hidden></label><span class="muted" id="eCount"></span></div>
      <small class="muted">עד 60 תלמידים, שם עד 14 תווים. כינוי קצר (שם פרטי) נוח יותר לבחירה בטלפון. אם יש שני תלמידים עם אותו שם, הוסיפו אות: "דנה כ", "דנה ל".</small>
      <div class="row">${cls ? '<button class="btn sm ghost" id="eDel">🗑 מחיקת הכיתה</button>' : ''}<button class="btn green" id="eSave">שמירה ✓</button></div></div>`;
    document.body.appendChild(m);
    const list = m.querySelector('#eList');
    const count = () => (m.querySelector('#eCount').textContent = `${list.value.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean).length} שמות`);
    list.oninput = count;
    count();
    // names from a file (Classroom's people list, a school export, a plain list): added to the box, nothing is lost
    m.querySelector('#eFile').onchange = async (ev) => {
      const f = ev.target.files[0];
      if (!f) return;
      try {
        const r = await api('/classes/parse?name=' + encodeURIComponent(f.name), { method: 'POST', body: await f.arrayBuffer(), headers: { 'Content-Type': 'application/octet-stream' } });
        if (!r.students.length) return toast('לא נמצאו שמות בקובץ', true);
        const have = new Set(list.value.split(/[\n,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean));
        const add = r.students.filter((n) => !have.has(n.toLowerCase()));
        list.value = (list.value.trim() ? list.value.trim() + '\n' : '') + add.join('\n');
        count();
        toast(`נוספו ${add.length} שמות${r.note ? ' · ' + r.note : ''}`);
      } catch (err) { toast(err.message, true); }
      ev.target.value = '';
    };
    m.onclick = async (e) => {
      if (e.target === m || e.target.id === 'eClose') return m.remove();
      if (e.target.id === 'eSave') {
        try {
          const saved = await api(cls ? '/classes/' + encodeURIComponent(cls.id) : '/classes', { method: cls ? 'PUT' : 'POST', body: JSON.stringify({ name: m.querySelector('#eName').value, students: list.value }) });
          curId = saved.id;
          m.remove();
          toast('הכיתה נשמרה');
          load();
        } catch (err) { toast(err.message, true); }
      }
      if (e.target.id === 'eDel' && cls) {
        if (!confirm(`למחוק את הכיתה "${cls.name}"? ההתקדמות שנשמרה בדוחות לא תוצג יותר.`)) return;
        await api('/classes/' + encodeURIComponent(cls.id), { method: 'DELETE' });
        curId = '';
        m.remove();
        load();
      }
    };
    setTimeout(() => m.querySelector(cls ? '#eList' : '#eName').focus(), 50);
  }

  function csv() {
    const d = data;
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['שם', 'משחקים', 'תשובות', 'נכונות', 'דיוק %', 'מגמה (דיוק בכל משחק)', 'משחק אחרון'], ...d.students.map((s) => [s.name, s.sessions, s.answered, s.correct, s.accuracy ?? '', s.trend.join(' '), s.last ? new Date(s.last).toLocaleDateString('he-IL') : ''])];
    const blob = new Blob(['﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `progress-${d.class.name.replace(/[\\/:*?"<>|]/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // a gradebook: a row per student, a column per game, and the average (accuracy %)
  function gradebook() {
    const gr = data.grades;
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['שם', ...gr.columns.map((c) => `${new Date(c.at).toLocaleDateString('he-IL')} ${c.label}`.trim()), 'ממוצע'];
    const rows = gr.rows.map((r) => {
      const vals = r.values.filter((v) => v !== null);
      return [r.name, ...r.values.map((v) => (v === null ? '' : v)), vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : ''];
    });
    const blob = new Blob(['\ufeff' + [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `grades-${data.class.name.replace(/[\\/:*?"<>|]/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // a private note about a student
  function noteEditor(name) {
    const s = data.students.find((x) => x.name === name);
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="modal-card pg-edit"><div class="modal-head"><h2>📝 ${esc(name)}</h2><div class="modal-actions"><button class="btn sm ghost" id="nClose">✕</button></div></div>
      <label class="pg-f">הערה פרטית (רק אתם רואים)<textarea class="input" id="nText" rows="6" maxlength="500" placeholder="למשל: צריך עידוד, חזק בחשבון, יושב רחוק מהלוח…">${esc((s && s.note) || '')}</textarea></label>
      <div class="row"><button class="btn green" id="nSave">שמירה ✓</button></div></div>`;
    document.body.appendChild(m);
    m.onclick = async (e) => {
      if (e.target === m || e.target.id === 'nClose') return m.remove();
      if (e.target.id === 'nSave') {
        try {
          await api(`/classes/${encodeURIComponent(curId)}/notes`, { method: 'PUT', body: JSON.stringify({ name, text: m.querySelector('#nText').value }) });
          m.remove();
          toast('ההערה נשמרה');
          load();
        } catch (err) { toast(err.message, true); }
      }
    };
    setTimeout(() => m.querySelector('#nText').focus(), 50);
  }

  function wire() {
    const sel = document.getElementById('clsSel');
    if (sel) sel.onchange = () => { curId = sel.value; load(); };
    for (const id of ['newCls', 'newCls2']) { const b = document.getElementById(id); if (b) b.onclick = () => editor(null); }
    const e = document.getElementById('editCls');
    if (e) e.onclick = () => editor(data.class);
    const c = document.getElementById('csv');
    if (c) c.onclick = csv;
    const g = document.getElementById('grades');
    if (g) g.onclick = gradebook;
    document.querySelectorAll('[data-note]').forEach((b) => (b.onclick = () => noteEditor(b.dataset.note)));
  }

  load().catch((e) => (app.innerHTML = `<div class="card pg-empty"><h2>${esc(e.message)}</h2></div>`));
})();
