// Free-form import (editor): paste text or pick a Word / text / Excel file in any layout, review what the
// system understood, fix it, and save it as a quiz.
window.FreeImport = (function () {
  const { esc } = U;
  const COLORS = ['#e9334f', '#1f73e0', '#e6a400', '#23a14a', '#8b5cf6', '#0fa3b8'];
  const EXAMPLE = `1. מהי בירת ישראל?
א. תל אביב
ב. ירושלים *
ג. חיפה

2. השמש היא כוכב (נכון)

3. באיזו שנה קמה המדינה? 1948

כלב - dog
חתול - cat
בית - house`;

  function open({ folder = '', api, toast, onDone }) {
    const m = document.createElement('div');
    m.className = 'modal ff-modal';
    document.body.appendChild(m);
    let text = '';
    let qs = [];
    let title = 'חידון חדש';
    const close = () => m.remove();

    function inputView() {
      m.innerHTML = `<div class="modal-card ff-card">
        <div class="modal-head"><h2>📝 ייבוא חופשי</h2><span class="muted">הדביקו שאלות ותשובות בכל צורה, והמערכת תשלים את השאר</span><div class="modal-actions"><button class="btn sm ghost" id="ffClose">✕</button></div></div>
        <div class="ff-in">
          <textarea id="ffText" placeholder="${esc(EXAMPLE)}">${esc(text)}</textarea>
          <aside class="ff-help">
            <label class="btn blue sm">📄 בחירת קובץ<input type="file" id="ffFile" accept=".docx,.txt,.csv,.xlsx,.md" hidden></label>
            <small class="muted">Word, טקסט או אקסל (בלי תבנית)</small>
            <h4>מה המערכת מבינה?</h4>
            <ul>
              <li>שאלה בשורה, ותשובות בשורות מתחתיה (א. ב. / 1) 2) / - •)</li>
              <li>תשובה נכונה מסומנת ב־<b>*</b> <b>✓</b> <b>(נכון)</b>, בטקסט <b>מודגש</b> ב־Word, או בשורה <b>"תשובה: ב"</b></li>
              <li>מפתח תשובות בסוף: <b>"תשובות: 1-ב, 2-א"</b></li>
              <li>משפט עם <b>(נכון)</b> / <b>(לא נכון)</b> ← שאלת נכון/לא נכון</li>
              <li>"שאלה? תשובה" או רשימת מילים "מילה - פירוש" ← המערכת מוסיפה תשובות שגויות</li>
            </ul>
            <button class="btn ghost sm" id="ffExample">הדביקו דוגמה</button>
          </aside>
        </div>
        <div class="ff-foot"><span class="muted" id="ffCount"></span><button class="btn green" id="ffGo">המשך: בדיקה ועריכה ▶</button></div>
      </div>`;
      const ta = m.querySelector('#ffText');
      ta.focus();
      ta.oninput = () => { text = ta.value; };
      m.querySelector('#ffExample').onclick = () => { ta.value = text = EXAMPLE; };
      m.querySelector('#ffFile').onchange = (e) => {
        const f = e.target.files[0];
        if (f) run(f, f.name);
      };
      m.querySelector('#ffGo').onclick = () => {
        if (!ta.value.trim()) return toast('הדביקו טקסט או בחרו קובץ', true);
        run(new Blob([ta.value], { type: 'text/plain' }), 'text.txt');
      };
    }

    async function run(body, name) {
      const btn = m.querySelector('#ffGo');
      if (btn) { btn.disabled = true; btn.textContent = 'קורא…'; }
      try {
        const r = await api('/freeform?name=' + encodeURIComponent(name), { method: 'POST', body: await body.arrayBuffer(), headers: { 'Content-Type': 'application/octet-stream' } });
        qs = r.questions;
        if (name !== 'text.txt') title = name.replace(/\.\w+$/, '');
        reviewView();
      } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = 'המשך: בדיקה ועריכה ▶'; }
        toast(e.message, true);
      }
    }

    const ready = (q) => q.text.trim() && (q.type === 'type' ? q.accept && q.accept.some((x) => x.trim()) : q.answers.filter((a) => a.text.trim()).length >= 2 && q.answers.some((a) => a.correct && a.text.trim()));

    function reviewView() {
      const bad = qs.filter((q) => !ready(q)).length;
      const flagged = qs.filter((q) => q.notes && q.notes.length).length;
      m.innerHTML = `<div class="modal-card ff-card">
        <div class="modal-head"><h2>✅ בדיקה ועריכה</h2><span class="muted">${qs.length} שאלות${flagged ? ` · ${flagged} עם הערות` : ''}${bad ? ` · <span class="bad-t">${bad} לא מוכנות</span>` : ''}</span><div class="modal-actions"><button class="btn sm ghost" id="ffClose">✕</button></div></div>
        <div class="ff-title"><label>שם החידון<input class="input sm" id="ffTitle" maxlength="80" value="${esc(title)}"></label>${folder ? `<span class="muted">📁 ${esc(folder)}</span>` : ''}</div>
        <div class="ff-list" id="ffList">${qs.map(card).join('')}</div>
        <div class="ff-foot"><button class="btn ghost" id="ffBack">◀ חזרה לטקסט</button><button class="btn green" id="ffSave">💾 שמירה כחידון (${qs.length} שאלות)</button></div>
      </div>`;
      m.querySelector('#ffTitle').oninput = (e) => { title = e.target.value; };
      m.querySelector('#ffBack').onclick = inputView;
      m.querySelector('#ffSave').onclick = save;
      const list = m.querySelector('#ffList');
      list.oninput = (e) => {
        const c = e.target.closest('[data-q]');
        if (!c) return;
        const q = qs[c.dataset.q];
        if (e.target.dataset.f === 'text') q.text = e.target.value;
        if (e.target.dataset.a !== undefined) q.answers[e.target.dataset.a].text = e.target.value;
        if (e.target.dataset.acc !== undefined) q.accept[e.target.dataset.acc] = e.target.value;
        c.classList.toggle('bad', !ready(q));
      };
      list.onchange = (e) => {
        const c = e.target.closest('[data-q]');
        if (!c || e.target.dataset.f !== 'type') return;
        const q = qs[c.dataset.q];
        const to = e.target.value;
        const rightText = q.type === 'type' ? (q.accept || [''])[0] : ((q.answers || []).find((a) => a.correct) || {}).text || '';
        if (to === 'tf') q.answers = [{ text: 'נכון', correct: true }, { text: 'לא נכון', correct: false }];
        else if (to === 'type') q.accept = [rightText];
        else if (q.type !== 'quiz') q.answers = [{ text: rightText, correct: true }, { text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }];
        if (to !== 'type') delete q.accept;
        if (to === 'type') delete q.answers;
        q.type = to;
        redraw(c.dataset.q);
      };
      list.onclick = (e) => {
        const c = e.target.closest('[data-q]');
        if (!c) return;
        const i = Number(c.dataset.q);
        const q = qs[i];
        const ok = e.target.closest('[data-ok]');
        if (ok) {
          const k = Number(ok.dataset.ok);
          if (q.type === 'tf') q.answers.forEach((a, j) => (a.correct = j === k));
          else q.answers[k].correct = !q.answers[k].correct;
          return redraw(i);
        }
        const x = e.target.closest('[data-x]');
        if (x) { q.answers.splice(Number(x.dataset.x), 1); return redraw(i); }
        if (e.target.closest('[data-add]')) { q.answers.push({ text: '', correct: false }); return redraw(i, true); }
        if (e.target.closest('[data-del]')) { qs.splice(i, 1); return reviewView(); }
      };
    }

    function redraw(i, focusLast) {
      const c = m.querySelector(`[data-q="${i}"]`);
      c.outerHTML = card(qs[i], Number(i));
      if (focusLast) {
        const ins = m.querySelectorAll(`[data-q="${i}"] [data-a]`);
        ins[ins.length - 1]?.focus();
      }
    }

    function card(q, i) {
      const notes = (q.notes || []).map((n) => `<span class="ff-note">⚠️ ${esc(n)}</span>`).join('');
      let body = '';
      if (q.type === 'type') {
        body = `<div class="ff-acc">✓ <input data-acc="0" value="${esc((q.accept || [''])[0])}" placeholder="התשובה הנכונה"> <small class="muted">השחקנים מקלידים</small></div>`;
      } else {
        body = `<div class="ff-ans">${q.answers.map((a, k) => `<div class="ff-a ${a.correct ? 'ok' : ''}" style="--a:${q.type === 'tf' ? ['#1f73e0', '#e9334f'][k] : COLORS[k % 6]}">
          <button class="ff-ok" data-ok="${k}" title="תשובה נכונה">${a.correct ? '✓' : ''}</button>
          <input data-a="${k}" value="${esc(a.text)}" placeholder="תשובה ${k + 1}" ${q.type === 'tf' ? 'readonly' : ''}>
          ${q.type === 'quiz' && q.answers.length > 2 ? `<button class="ff-x" data-x="${k}">✕</button>` : ''}</div>`).join('')}
          ${q.type === 'quiz' && q.answers.length < 6 ? '<button class="ff-addans" data-add="1">+ תשובה</button>' : ''}</div>`;
      }
      return `<div class="ff-q ${ready(q) ? '' : 'bad'}" data-q="${i}">
        <div class="ff-qh"><span class="ff-n">${i + 1}</span>
          <select data-f="type">${[['quiz', '🔷 חידון'], ['tf', '⚖️ נכון / לא נכון'], ['type', '⌨️ הקלדה']].map(([v, l]) => `<option value="${v}" ${q.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <span class="muted">⏱ ${q.time} שנ׳</span><button class="ff-del" data-del="1" title="מחיקת השאלה">🗑</button></div>
        <input class="ff-text" data-f="text" value="${esc(q.text)}" placeholder="טקסט השאלה">
        ${body}${notes ? `<div class="ff-notes">${notes}</div>` : ''}
      </div>`;
    }

    async function save() {
      const keep = qs.filter(ready);
      if (!keep.length) return toast('אין שאלות מוכנות לשמירה', true);
      if (keep.length < qs.length && !confirm(`${qs.length - keep.length} שאלות עוד לא מוכנות ולא יישמרו. לשמור את ${keep.length} השאר?`)) return;
      const btn = m.querySelector('#ffSave');
      btn.disabled = true;
      try {
        const q = await api('/quizzes', { method: 'POST', body: JSON.stringify({ title: title || 'חידון חדש', folder }) });
        const questions = keep.map(({ notes, ...x }) => ({ ...x, text: x.text.trim(), answers: x.answers && x.answers.filter((a) => a.text.trim()) }));
        await api('/quizzes/' + encodeURIComponent(q.id), { method: 'PUT', body: JSON.stringify({ title: title || 'חידון חדש', questions }) });
        close();
        toast(`החידון נשמר עם ${keep.length} שאלות`);
        onDone(q.id);
      } catch (e) {
        btn.disabled = false;
        toast(e.message, true);
      }
    }

    m.addEventListener('click', (e) => { if (e.target.id === 'ffClose' || e.target === m) { if (!qs.length || confirm('לסגור בלי לשמור?')) close(); } });
    inputView();
  }

  return { open };
})();
