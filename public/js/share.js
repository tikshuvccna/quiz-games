// The page another teacher opens from a share link: the shared quiz (or folder) with its questions and
// answers, a download of the package, and how to add it to their own library.
(function () {
  const { esc } = U;
  const app = document.getElementById('app');
  const token = (location.pathname.match(/\/share\/([\w-]+)/) || [])[1] || '';
  const TYPE = { quiz: '🔷 חידון', tf: '⚖️ נכון / לא נכון', type: '⌨️ הקלדה', slider: '🎚️ סרגל', order: '🔢 סידור', pin: '📍 סימון', puzzle: '🧩 פאזל', poll: '📊 סקר', slide: '🖼️ שקופית' };
  const COLORS = ['#e9334f', '#1f73e0', '#e6a400', '#23a14a', '#8b5cf6', '#0fa3b8'];

  function answers(q) {
    if (q.answers && q.type !== 'slide') {
      return `<div class="sh-ans">${q.answers.filter((a) => a.text).map((a, i) => `<span class="${a.correct ? 'ok' : ''}" style="--a:${q.type === 'tf' ? ['#1f73e0', '#e9334f'][i] : COLORS[i % 6]}">${Art.shape(q.type === 'tf' ? i * 3 : i)}${esc(a.text)}${a.correct ? ' ✓' : ''}</span>`).join('')}</div>`;
    }
    if (q.type === 'type') return `<div class="sh-line">✓ ${q.accept.map(esc).join(' · ')}</div>`;
    if (q.type === 'slider') return `<div class="sh-line">✓ ${q.slider.answer}${q.slider.tol ? ` (±${q.slider.tol})` : ''} · בטווח ${q.slider.min}–${q.slider.max}</div>`;
    if (q.type === 'order') return `<div class="sh-line">${q.items.map((t, i) => `<b>${i + 1}.</b> ${esc(t)}`).join('  ')}</div>`;
    if (q.type === 'puzzle') return `<div class="sh-line">${q.puzzle.rows}×${q.puzzle.cols} חלקים</div>`;
    return '';
  }

  function quizHtml(qz, open) {
    return `<details class="sh-quiz" ${open ? 'open' : ''}>
      <summary><span class="sh-qt">${esc(qz.title)}</span>${qz.folder ? `<span class="sh-qf">📁 ${esc(qz.folder)}</span>` : ''}<span class="pill">${qz.count} שאלות</span></summary>
      <ol class="sh-qs">${qz.questions.map((q) => `<li>
        <div class="sh-qhead"><span class="sh-type">${TYPE[q.type] || q.type}</span><span class="muted">${q.time} שנ׳${q.points !== 1 ? ` · ×${q.points}` : ''}</span></div>
        <div class="sh-text">${esc(q.text)}</div>
        ${q.image ? `<img class="sh-img" src="${qz.mediaBase}${encodeURIComponent(q.image)}" alt="" loading="lazy">` : ''}
        ${q.video && q.video.id ? `<div class="sh-line">🎬 סרטון יוטיוב</div>` : q.video ? '<div class="sh-line">🎬 סרטון</div>' : ''}
        ${answers(q)}
        ${q.explain ? `<div class="sh-explain">💡 ${esc(q.explain)}</div>` : ''}
      </li>`).join('')}</ol></details>`;
  }

  async function main() {
    let d;
    try {
      const r = await fetch(`/share/${token}/data`);
      d = await r.json();
      if (!r.ok) throw new Error(d.error || 'שגיאה');
    } catch (e) {
      app.innerHTML = `<div class="sh-gone"><div class="logo"><div class="logo-mark">${Art.star()}</div><div class="logo-text">משחקי חידון</div></div><h2>${esc(e.message || 'הקישור לא נמצא')}</h2><div class="muted">ייתכן שהקישור בוטל, או שהמחשב ששיתף כבוי.</div></div>`;
      return;
    }
    const copy = d.perm === 'copy';
    const total = d.quizzes.reduce((s, q) => s + q.count, 0);
    app.innerHTML = `
      <header class="sh-head">
        <div class="logo"><div class="logo-mark">${Art.star()}</div><div class="logo-text">משחקי חידון</div></div>
        <span class="sh-badge">${copy ? '📥 שותף איתך לצפייה ולהעתקה' : '👀 שותף איתך לצפייה'}</span>
      </header>
      <section class="sh-hero card">
        <div class="sh-hero-ic">${d.kind === 'folder' ? '📁' : '🧠'}</div>
        <div class="sh-hero-t"><h1>${esc(d.title)}</h1><div class="muted">${d.kind === 'folder' ? `${d.quizzes.length} חידונים · ` : ''}${total} שאלות</div></div>
        ${copy ? `<div class="sh-hero-act">
          <a class="btn green" href="/share/${token}/package">⬇ הורדה (חבילה עם התמונות)</a>
          <button class="btn ghost" id="copyLink">📋 העתקת הקישור לייבוא</button>
        </div>` : ''}
      </section>
      ${copy ? `<div class="sh-how"><b>איך מוסיפים לספרייה שלי?</b> פתחו את עורך החידונים במחשב שלכם, ולחצו <b>"🔗 ייבוא מקישור"</b> והדביקו את הקישור הזה. אפשר גם להוריד את החבילה ולבחור <b>"⬆ ייבוא קובץ"</b>.</div>` : ''}
      <main class="sh-list">${d.quizzes.map((q, i) => quizHtml(q, d.quizzes.length === 1 || i === 0)).join('') || '<div class="muted">אין חידונים בתיקייה</div>'}</main>`;
    const c = document.getElementById('copyLink');
    if (c) c.onclick = () => navigator.clipboard?.writeText(location.href).then(() => { c.textContent = '✓ הועתק'; setTimeout(() => (c.textContent = '📋 העתקת הקישור לייבוא'), 2000); });
  }
  main();
})();
