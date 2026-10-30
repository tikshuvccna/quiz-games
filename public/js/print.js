// Print pages made from a quiz or a lesson: /print.html?quiz=<id>&mode=guide|cards
//   guide: a study guide - slides as headings, every question with its answer, explanation and source (answers can be hidden)
//   cards: flashcards to cut out, 8 to a page: a page of fronts, then a page of backs lined up for double-sided printing
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const app = document.getElementById('app');
  const params = new URLSearchParams(location.search);
  const id = params.get('quiz');
  let mode = params.get('mode') === 'cards' ? 'cards' : 'guide';
  let quiz = null;
  let showAnswers = true;

  const SCORED = ['quiz', 'tf', 'type', 'slider', 'order', 'match', 'sort', 'pin', 'puzzle'];
  const mediaUrl = (f) => `/media/${encodeURIComponent(id)}/${encodeURIComponent(f)}`;

  // the right answer as text
  function answerText(q) {
    if (q.type === 'quiz' || q.type === 'tf') return q.answers.filter((a) => a.correct).map((a) => a.text || '(תמונה)').join(' · ');
    if (q.type === 'type') return q.accept.join(' / ');
    if (q.type === 'slider') return `${q.slider.answer}${q.slider.tol ? ` (±${q.slider.tol})` : ''}`;
    if (q.type === 'order') return q.items.join(' ← ');
    if (q.type === 'match') return q.pairs.map((p) => `${p.a} = ${p.b}`).join(' · ');
    if (q.type === 'sort') return q.buckets.map((b) => `${b.name}: ${b.items.join(', ')}`).join(' · ');
    if (q.type === 'pin') return 'המקום המסומן בתמונה';
    if (q.type === 'puzzle') return 'התמונה השלמה';
    return '';
  }
  const source = (q) => (q.source ? `<div class="p-src">📖 ${esc(q.source.doc)}${q.source.loc ? ' · ' + esc(q.source.loc) : ''}${q.source.quote ? `<q>${esc(q.source.quote)}</q>` : ''}</div>` : '');

  // ---------- the study guide ----------
  function guide() {
    let n = 0;
    const body = quiz.questions.map((q) => {
      if (q.type === 'slide') {
        const bl = q.bullets && q.bullets.length ? `<ul>${q.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : '';
        return `<section class="p-slide"><h2>${esc(q.text || (q.bullets && q.bullets[0]) || '')}</h2>${q.body ? `<p>${esc(q.body)}</p>` : ''}${bl}${q.image ? `<img src="${mediaUrl(q.image)}" alt="">` : ''}</section>`;
      }
      if (q.type === 'pdf') return `<section class="p-pdf">${q.text ? `<div class="p-cap">${esc(q.text)}</div>` : ''}<canvas data-pdf="${esc(mediaUrl(q.pdf.file))}" data-page="${q.pdf.page}"></canvas></section>`;
      n++;
      const ans = SCORED.includes(q.type) ? answerText(q) : '';
      const opts = (q.type === 'quiz' || q.type === 'poll' || q.type === 'tf') && q.answers.length
        ? `<ol class="p-opts">${q.answers.map((a) => `<li class="${showAnswers && a.correct ? 'ok' : ''}">${esc(a.text || '(תמונה)')}${showAnswers && a.correct ? ' ✓' : ''}</li>`).join('')}</ol>` : '';
      const kind = { cloud: 'ענן מילים', open: 'תשובה פתוחה', brain: 'סיעור מוחות', qna: 'שאלות מהכיתה', rate: 'דירוג', rank: 'דירוג פריטים', tap: 'מרוץ הקשות', drop: 'סיכה חופשית', poll: 'סקר' }[q.type];
      const items = q.type === 'rank' ? `<p class="p-line">${q.items.map(esc).join(' · ')}</p>` : '';
      return `<section class="p-q"><div class="p-qh"><b>${n}.</b> ${esc(q.text)}${kind ? ` <small>(${kind})</small>` : ''}</div>${q.image ? `<img src="${mediaUrl(q.image)}" alt="">` : ''}${q.pdf ? `<div class="p-line">📄 עמוד ${q.pdf.page} במצגת</div>` : ''}${opts}${items}
        ${showAnswers && ans && !opts ? `<div class="p-ans">✓ ${esc(ans)}</div>` : ''}${showAnswers && q.explain ? `<div class="p-ex">💡 ${esc(q.explain)}</div>` : ''}${showAnswers ? source(q) : ''}</section>`;
    }).join('');
    return `<article class="p-guide"><header><h1>${esc(quiz.title)}</h1>${quiz.description ? `<p>${esc(quiz.description)}</p>` : ''}<small>${n} שאלות</small></header>${body}</article>`;
  }

  // ---------- flashcards ----------
  function cards() {
    const list = quiz.questions.filter((q) => SCORED.includes(q.type) && q.text && answerText(q));
    if (!list.length) return '<div class="p-empty">אין שאלות עם תשובה נכונה שאפשר להפוך לכרטיסיות.</div>';
    const front = (q) => `<div class="p-card f">${q.image ? `<img src="${mediaUrl(q.image)}" alt="">` : ''}<div>${esc(q.text)}</div></div>`;
    const back = (q) => `<div class="p-card b"><b>${esc(answerText(q))}</b>${q.explain ? `<small>💡 ${esc(q.explain)}</small>` : ''}</div>`;
    const pages = [];
    for (let i = 0; i < list.length; i += 8) {
      const chunk = list.slice(i, i + 8);
      pages.push(`<div class="p-sheet">${chunk.map(front).join('')}</div>`);
      // the back of a card is behind its front: with the sheet flipped on its long edge each row is mirrored
      const rows = [];
      for (let r = 0; r < chunk.length; r += 2) rows.push(...chunk.slice(r, r + 2).reverse());
      pages.push(`<div class="p-sheet backs">${rows.map(back).join('')}</div>`);
    }
    return `<article class="p-cards">${pages.join('')}</article>`;
  }

  function draw() {
    app.innerHTML = `<div class="p-bar no-print"><b>${esc(quiz.title)}</b>
      <div class="p-tabs"><button data-m="guide" class="${mode === 'guide' ? 'on' : ''}">📖 דף לימוד</button><button data-m="cards" class="${mode === 'cards' ? 'on' : ''}">🃏 כרטיסיות</button></div>
      ${mode === 'guide' ? `<label><input type="checkbox" id="pAns" ${showAnswers ? 'checked' : ''}> הצגת תשובות</label>` : '<span class="p-tip">הדפיסו דו־צדדית, הפיכה על הצד הארוך</span>'}
      <a class="p-csv" href="/api/q/quizzes/${encodeURIComponent(id)}/cards.csv">⬇ CSV ל־Anki / Quizlet</a>
      <button class="p-print" id="pPrint">🖨️ הדפסה</button></div>${mode === 'guide' ? guide() : cards()}`;
    app.querySelectorAll('canvas[data-pdf]').forEach((c) => Slides.draw(c.dataset.pdf, Number(c.dataset.page), c, 640, 420).catch(() => c.replaceWith(document.createTextNode('(לא ניתן להציג את עמוד ה־PDF)'))));
    app.querySelector('.p-tabs')?.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) { mode = b.dataset.m; draw(); } });
    const a = document.getElementById('pAns');
    if (a) a.onchange = () => { showAnswers = a.checked; draw(); };
    document.getElementById('pPrint').onclick = () => print();
  }

  fetch('/api/q/quizzes/' + encodeURIComponent(id || ''))
    .then((r) => r.json())
    .then((q) => {
      if (!q || !q.questions) throw new Error('החידון לא נמצא');
      quiz = q;
      document.title = q.title;
      draw();
    })
    .catch((e) => (app.innerHTML = `<div class="p-empty">${esc(e.message)}</div>`));
})();
