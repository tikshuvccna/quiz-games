// Kahoot quiz → our quiz. Input is the JSON Kahoot's own site uses for a quiz
// (create.kahoot.it/rest/kahoots/<uuid>) and a Map of its pictures; output is a quiz ready to save.
// Pure: no files, no network. library.js saves the quiz and copies the pictures.
//
// Kahoot type          → ours
//   quiz               → quiz (a 2-answer TRUE_FALSE layout → tf)
//   multiple_select_quiz → quiz with several correct answers
//   open_ended         → type (typed answer, the listed answers are the accepted spellings)
//   jumble             → order (the answers are listed in the correct order)
//   slider             → slider
//   pin_it             → pin (rectangle / ellipse / polygon zones, several zones allowed)
//   drop_pin           → drop (everyone drops a pin, nothing is graded)
//   survey             → poll · multiple_select_poll → poll with several choices
//   word_cloud         → cloud · feedback → open (free text) · brainstorming → brain
//   content            → slide
const qt = require('../qtypes');

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

// Kahoot keeps <b>, <i>, <br>, lists and entities in its texts: keep the words, drop the markup
function plain(html) {
  return String(html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h\d)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
      }
      return ENT[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const nearestTime = (sec) => qt.TIMES.reduce((a, b) => (Math.abs(b - sec) < Math.abs(a - sec) ? b : a), 20);
const pct = (v, of) => Math.round((v / of) * 10000) / 100;
const idOfUrl = (u) => String(u || '').split(/[?#]/)[0].split('/').filter(Boolean).pop() || '';

function convertQuestion(k, ctx, n) {
  const notes = [];
  const note = (reason, level = 'info') => notes.push({ row: n, col: ctx.label, reason, level });
  const type = k.type;
  const text = plain(k.question).slice(0, 300);
  const pm = Number(k.pointsMultiplier);
  const q = { text, time: nearestTime((Number(k.time) || 20000) / 1000), points: [0, 1, 2].includes(pm) ? pm : 1 };

  // ---- picture ----
  const ids = [];
  const main = (k.imageMetadata && k.imageMetadata.id) || idOfUrl(k.image);
  if (main) ids.push(main);
  for (const m of k.media || []) if (m && m.id && /^(background_image|giphy_gif|giphy_sticker|image)$/.test(m.type)) ids.push(m.id);
  const hit = ids.find((id) => ctx.images.has(id.toLowerCase()));
  if (hit) {
    q.image = hit.toLowerCase();
    const fx = ((k.imageMetadata && k.imageMetadata.effects) || []).map((e) => String(e.type || '')).join(' ');
    if (/GRIDREVEAL/i.test(fx)) q.reveal = 'tiles';
    else if (/BLUR/i.test(fx)) q.reveal = 'blur';
  } else if (ids.length) ctx.missing++;

  // ---- video: YouTube only (a video uploaded to Kahoot can't be downloaded) ----
  const v = k.video;
  if (v && v.fullUrl) {
    const id = (String(v.fullUrl).match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/)([\w-]{11})/) || [])[1];
    if (v.service && v.service !== 'youtube') note('סרטון שהועלה ל־Kahoot לא יובא (אי אפשר להוריד אותו)', 'warn');
    else if (id) q.video = { id, start: Math.round(v.startTime || 0), end: Math.round(v.endTime || 0) };
    else note('קישור הסרטון לא מוכר, הסרטון לא יובא', 'warn');
  }

  // ---- answers ----
  const choices = Array.isArray(k.choices) ? k.choices : [];
  const pic = (c) => {
    const id = c && c.image && c.image.id;
    if (!id) return undefined;
    if (ctx.images.has(String(id).toLowerCase())) return String(id).toLowerCase();
    ctx.missing++;
    return undefined;
  };
  const answers = () => choices.map((c) => ({ text: plain(c.answer).slice(0, 120), correct: !!c.correct, image: pic(c) })).filter((a) => a.text || a.image);
  const cap = (list, max, what) => {
    if (list.length > max) note(`${what}: יובאו ${max} מתוך ${list.length}`, 'info');
    return list.slice(0, max);
  };

  switch (type) {
    case 'quiz':
    case 'multiple_select_quiz': {
      const a = cap(answers(), 6, 'תשובות');
      q.type = k.layout === 'TRUE_FALSE' && a.length === 2 ? 'tf' : 'quiz';
      q.answers = a;
      break;
    }
    case 'open_ended': {
      const all = choices.map((c) => ({ t: plain(c.answer), ok: c.correct !== false })).filter((x) => x.t);
      const good = all.filter((x) => x.ok);
      q.type = 'type';
      q.accept = (good.length ? good : all).map((x) => x.t);
      q.time = Math.max(q.time, 20);
      break;
    }
    case 'jumble': {
      q.type = 'order';
      q.items = cap(choices.map((c) => plain(c.answer)).filter(Boolean), 6, 'פריטים');
      q.time = Math.max(q.time, 30);
      break;
    }
    case 'slider': {
      const r = k.choiceRange;
      if (!r) return skip('סרגל בלי טווח');
      const tol = Math.round(Number(r.tolerance || 0) * (r.end - r.start) * 100) / 100;
      q.type = 'slider';
      q.slider = { min: r.start, max: r.end, step: r.step || 1, answer: r.correct, tol };
      if (r.unit && !q.text.includes(r.unit)) q.text = `${q.text} (${r.unit})`.slice(0, 300);
      if (tol) note(`טווח הטעות של הסרגל חושב כאחוז מהטווח: ±${tol}`, 'info');
      break;
    }
    case 'pin_it': {
      const dim = k.imageMetadata || {};
      const W = dim.width;
      const H = dim.height;
      if (!q.image) return skip('שאלת סימון בלי התמונה');
      if (!W || !H) return skip('שאלת סימון בלי מידות התמונה');
      const zones = (k.choiceShapes || [])
        .map((s) => {
          if (s.type === 'rect') return { shape: 'rect', x: pct(s.x + s.width / 2, W), y: pct(s.y + s.height / 2, H), w: pct(s.width, W), h: pct(s.height, H) };
          if (s.type === 'ellipse') return { shape: 'ellipse', x: pct(s.x, W), y: pct(s.y, H), w: pct(s.radiusX * 2, W), h: pct(s.radiusY * 2, H) };
          if (s.type === 'polygon' && Array.isArray(s.points)) return { shape: 'polygon', points: s.points.map((p) => [pct(p.x, W), pct(p.y, H)]) };
          return null;
        })
        .filter(Boolean);
      if (!zones.length) return skip('שאלת סימון בלי אזור נכון');
      q.type = 'pin';
      q.pin = { ...zones[0], ar: W / H, extra: zones.slice(1) };
      break;
    }
    case 'drop_pin':
      if (!q.image) return skip('סיכה חופשית בלי התמונה');
      q.type = 'drop';
      q.points = 0;
      break;
    case 'survey':
    case 'multiple_select_poll':
      q.type = 'poll';
      q.multi = type === 'multiple_select_poll';
      q.points = 0;
      q.answers = cap(answers(), 6, 'אפשרויות').map((a) => ({ text: a.text, image: a.image }));
      break;
    case 'word_cloud':
      q.type = 'cloud';
      q.points = 0;
      break;
    case 'feedback':
      q.type = 'open';
      q.points = 0;
      break;
    case 'brainstorming':
      q.type = 'brain';
      q.points = 0;
      q.limit = Number(k.numberOfAnswersAllowed) || undefined;
      break;
    case 'content': {
      q.type = 'slide';
      q.points = 0;
      q.text = plain(k.title).slice(0, 300);
      q.body = plain(k.description).slice(0, 600);
      break;
    }
    default:
      return skip(`סוג שאלה לא מוכר ב־Kahoot (${type})`);
  }

  const clean = qt.normalize(q);
  if (!clean || !qt.shown(clean)) {
    const why = clean && clean.type === 'quiz' ? (clean.answers.filter((a) => a.text || a.image).length < 2 ? 'פחות משתי תשובות' : 'אין תשובה נכונה') : 'השאלה לא שלמה';
    return skip(why);
  }
  return { q: clean, notes };

  function skip(reason) {
    note(`${reason}: השאלה דולגה`, 'skip');
    return { q: null, notes };
  }
}

// one Kahoot quiz → { title, description, source, questions, notes, missing }
// images: Map(lowercase picture id → { buffer, mime }) of the pictures that came with it
function convert(k, images = new Map()) {
  const title = plain(k.title).slice(0, 80) || 'חידון מ־Kahoot';
  const ctx = { images, missing: 0, label: title.slice(0, 24) };
  const questions = [];
  const notes = [];
  (Array.isArray(k.questions) ? k.questions : []).forEach((kq, i) => {
    const r = convertQuestion(kq, ctx, i + 1);
    notes.push(...r.notes);
    if (r.q) questions.push(r.q);
  });
  if (ctx.missing) notes.push({ row: 0, col: ctx.label, reason: `${ctx.missing} תמונות לא צורפו לקובץ, והשאלות יובאו בלעדיהן`, level: 'warn' });
  const tags = Array.isArray(k.tags) ? k.tags : String(k.tags || '').split(/[,;#]/);
  return {
    title,
    description: plain(k.description).slice(0, 300),
    source: {
      site: 'kahoot',
      id: k.uuid || '',
      url: k.uuid ? `https://create.kahoot.it/details/${k.slug ? k.slug + '/' : ''}${k.uuid}` : '',
      author: k.creator_username || '',
      language: typeof k.language === 'string' ? k.language : '',
      tags: tags.map((t) => t.trim()).filter(Boolean),
    },
    questions,
    notes,
    total: (k.questions || []).length,
  };
}

module.exports = { convert, plain };
