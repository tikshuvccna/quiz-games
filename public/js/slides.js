// Slides: draws a slide step on the big screen (and as a thumbnail in the editor) - a title, bullets, a picture beside
// text, a quote, a fun interlude with a countdown, or a page of an uploaded PDF (drawn by PDF.js, offline).
//   Slides.html(payload)  → the slide's markup;  Slides.mount(box) → draws the PDF pages and starts the countdowns in it.
window.Slides = (function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nl = (s) => esc(s).replace(/\n/g, '<br>');

  // ---------- PDF.js ----------
  let lib = null;
  const docs = new Map();
  async function pdfjs() {
    if (!lib) {
      lib = await import('/vendor/pdfjs/pdf.min.mjs');
      lib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
    }
    return lib;
  }
  // one document per file, kept for the whole lesson
  function doc(url) {
    if (!docs.has(url)) docs.set(url, pdfjs().then((l) => l.getDocument({ url }).promise));
    return docs.get(url);
  }
  async function pages(url) {
    return (await doc(url)).numPages;
  }
  // draw page n into a canvas so that it fits maxW x maxH (css pixels), sharp on any screen
  async function draw(url, n, canvas, maxW, maxH) {
    const d = await doc(url);
    const page = await d.getPage(Math.min(Math.max(1, n), d.numPages));
    const v1 = page.getViewport({ scale: 1 });
    const fit = Math.min(maxW / v1.width, maxH / v1.height);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const vp = page.getViewport({ scale: fit * ratio });
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    canvas.style.width = Math.floor(vp.width / ratio) + 'px';
    canvas.style.height = Math.floor(vp.height / ratio) + 'px';
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  }

  // ---------- markup ----------
  const pdfBox = (p, cls = '') => `<div class="sl-pdf ${cls}"><canvas data-pdf="${esc(p.url)}" data-page="${p.page}"></canvas><i class="sl-pdf-load">⏳</i></div>`;
  const timerBox = (s) => `<div class="sl-timer" data-timer="${s}"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="trk"/><circle cx="50" cy="50" r="44" class="ring"/></svg><b>${fmt(s)}</b></div>`;
  const fmt = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s));

  // payload: what server/qtypes.js present() sends for a slide or pdf step
  function html(q) {
    const title = q.text ? `<h1 class="sl-title">${nl(q.text)}</h1>` : '';
    const body = q.body ? `<div class="sl-body">${nl(q.body)}</div>` : '';
    const bullets = q.bullets && q.bullets.length ? `<ul class="sl-bullets">${q.bullets.map((b, i) => `<li style="--i:${i}">${esc(b)}</li>`).join('')}</ul>` : '';
    const img = q.image ? `<img class="sl-img" src="${esc(q.image)}" alt="">` : '';
    const vid = q.video ? window.QMedia.video(q.video, { autoplay: true, cls: 'sl-video' }) : '';
    const timer = q.timer ? timerBox(q.timer) : '';
    if (q.type === 'pdf' || (q.pdf && !q.text && !q.bullets && !q.body)) {
      return `<div class="sl sl-l-pdf">${q.pdf ? pdfBox(q.pdf) : ''}${q.text ? `<div class="sl-cap">${esc(q.text)}</div>` : ''}${timer}</div>`;
    }
    const layout = q.layout || (q.bullets ? 'bullets' : q.image ? 'image-right' : 'title');
    if (layout === 'full-image') return `<div class="sl sl-l-full">${img}<div class="sl-over">${title}${body}${bullets}</div>${timer}</div>`;
    if (layout === 'image-right' || layout === 'image-left') return `<div class="sl sl-l-split ${layout === 'image-left' ? 'rev' : ''}"><div class="sl-text">${title}${body}${bullets}</div><div class="sl-side">${q.pdf ? pdfBox(q.pdf, 'sm') : img}${vid}</div>${timer}</div>`;
    if (layout === 'quote') return `<div class="sl sl-l-quote"><div class="sl-qm">“</div><div class="sl-qt">${nl(q.text || q.body || '')}</div>${q.text && q.body ? `<div class="sl-qa">${nl(q.body)}</div>` : ''}${timer}</div>`;
    if (layout === 'fun') return `<div class="sl sl-l-fun"><div class="sl-fun-bg" aria-hidden="true"><i>🎉</i><i>⭐</i><i>🎈</i><i>✨</i><i>🎵</i><i>🌈</i></div>${title}${body}${bullets}${img}${timer}</div>`;
    // title / bullets
    return `<div class="sl sl-l-${layout}">${title}${body}${bullets}${img}${vid}${timer}</div>`;
  }

  // draw the PDF pages and start the countdowns inside a box (call after setting its innerHTML)
  function mount(box) {
    // measure after the layout has settled, so the page fits the room it was given
    box.querySelectorAll('canvas[data-pdf]').forEach((c) => {
      const wrap = c.parentElement;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!c.isConnected) return;
        const r = wrap.getBoundingClientRect();
        const small = wrap.classList.contains('sm');
        const maxW = Math.max(200, r.width || (small ? 520 : 1100));
        const maxH = Math.max(150, r.height || (small ? 420 : 640));
        draw(c.dataset.pdf, Number(c.dataset.page), c, maxW, maxH)
          .then(() => wrap.classList.add('ready'))
          .catch(() => (wrap.innerHTML = '<div class="sl-pdf-err">לא הצלחנו להציג את עמוד ה־PDF</div>'));
      }));
    });
    box.querySelectorAll('[data-timer]').forEach((t) => {
      const total = Number(t.dataset.timer);
      const end = performance.now() + total * 1000;
      const ring = t.querySelector('.ring');
      const num = t.querySelector('b');
      const step = (now) => {
        if (!t.isConnected) return;
        const left = Math.max(0, end - now);
        num.textContent = fmt(Math.ceil(left / 1000));
        if (ring) ring.style.strokeDashoffset = String(276 * (1 - left / (total * 1000)));
        t.classList.toggle('low', left < 10000);
        t.classList.toggle('done', left === 0);
        if (left > 0) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  return { html, mount, draw, pages, doc, pdfBox };
})();
