// Accessibility: a small ♿ settings panel on every phone and on the big screen. Each device remembers its own choices.
//   text size (normal / large / extra large) · high contrast · calm (no animations) · read aloud (questions and answers)
// Reading aloud uses the browser's own speech: it works offline when the device has a Hebrew voice.
window.A11y = (function () {
  const KEY = 'a11y';
  const DEFAULTS = { size: 0, contrast: false, calm: false, read: false };
  let prefs = { ...DEFAULTS };
  try {
    prefs = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {} };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- look ----------
  function apply() {
    const h = document.documentElement;
    h.classList.toggle('a11y-big', prefs.size === 1);
    h.classList.toggle('a11y-huge', prefs.size === 2);
    h.classList.toggle('a11y-contrast', !!prefs.contrast);
    h.classList.toggle('a11y-calm', !!prefs.calm);
  }

  // ---------- speech ----------
  const synth = window.speechSynthesis;
  let voice = null;
  const pick = () => {
    if (!synth) return;
    const vs = synth.getVoices();
    voice = vs.find((v) => /^he/i.test(v.lang)) || null;
  };
  if (synth) {
    pick();
    synth.onvoiceschanged = pick;
  }
  // a Hebrew voice is needed (other voices would mangle the text)
  const canSpeak = () => !!(synth && (voice || (pick(), voice)));
  function speak(text) {
    if (!canSpeak() || !text) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/\s+/g, ' '));
    u.lang = voice.lang || 'he-IL';
    u.voice = voice;
    u.rate = 0.95;
    synth.speak(u);
  }
  // a question and its answers as one spoken text
  function questionText(q) {
    const parts = [q.text];
    if (q.options && q.options.length) q.options.forEach((o, i) => parts.push(`אפשרות ${i + 1}: ${o || 'תמונה'}`));
    if (q.items && q.items.length && q.type !== 'puzzle') parts.push('הפריטים: ' + q.items.join(', '));
    return parts.filter(Boolean).join('. ');
  }
  // on a phone: read the question when it appears (if chosen) and put a 🔊 on it
  function decorate(box, q) {
    if (!canSpeak() || !box || !q || !q.text) return;
    const meta = box.querySelector('.q-meta');
    if (meta && !meta.querySelector('.a11y-say')) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'a11y-say';
      b.title = 'הקראה';
      b.textContent = '🔊';
      b.onclick = () => speak(questionText(q));
      meta.appendChild(b);
    }
    if (prefs.read) speak(questionText(q));
  }
  // on the big screen: read the question aloud when it opens
  function readHost(q) {
    if (prefs.read && q) speak(questionText(q));
  }

  // ---------- the panel ----------
  function panel() {
    let p = document.getElementById('a11yPanel');
    if (p) return p.remove();
    p = document.createElement('div');
    p.id = 'a11yPanel';
    p.className = 'a11y-panel';
    const can = canSpeak();
    p.innerHTML = `<div class="a11y-h"><b>♿ נגישות</b><button data-x aria-label="סגירה">✕</button></div>
      <div class="a11y-row"><span>גודל טקסט</span><div class="a11y-seg" data-k="size">${['רגיל', 'גדול', 'גדול מאוד'].map((l, i) => `<button data-v="${i}" class="${prefs.size === i ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <label class="a11y-row"><span>ניגודיות גבוהה</span><input type="checkbox" data-k="contrast" ${prefs.contrast ? 'checked' : ''}></label>
      <label class="a11y-row"><span>רגוע: בלי אנימציות ורעידות</span><input type="checkbox" data-k="calm" ${prefs.calm ? 'checked' : ''}></label>
      <label class="a11y-row ${can ? '' : 'off'}"><span>הקראה בקול של השאלה והתשובות</span><input type="checkbox" data-k="read" ${prefs.read && can ? 'checked' : ''} ${can ? '' : 'disabled'}></label>
      ${can ? '<button class="a11y-test" data-test>🔊 בדיקת קול</button>' : '<small class="a11y-note">אין במכשיר הזה קול בעברית להקראה. אפשר להתקין אחד בהגדרות המכשיר.</small>'}`;
    document.body.appendChild(p);
    p.onclick = (e) => {
      if (e.target.closest('[data-x]')) return p.remove();
      if (e.target.closest('[data-test]')) return speak('שלום! כך נשמעת ההקראה');
      const b = e.target.closest('.a11y-seg button');
      if (b) {
        prefs.size = Number(b.dataset.v);
        p.querySelectorAll('.a11y-seg button').forEach((x) => x.classList.toggle('on', x === b));
        save(); apply();
      }
    };
    p.onchange = (e) => {
      const k = e.target.dataset.k;
      if (!k || e.target.type !== 'checkbox') return;
      prefs[k] = e.target.checked;
      save(); apply();
      if (k === 'read' && e.target.checked) speak('הקראה פועלת');
    };
    return p;
  }

  function init() {
    apply();
    if (document.getElementById('a11yFab')) return;
    const f = document.createElement('button');
    f.id = 'a11yFab';
    f.className = 'a11y-fab';
    f.type = 'button';
    f.title = 'נגישות';
    f.setAttribute('aria-label', 'נגישות');
    f.textContent = '♿';
    f.onclick = panel;
    document.body.appendChild(f);
  }
  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { speak, questionText, decorate, readHost, canSpeak, prefs: () => ({ ...prefs }), esc };
})();
