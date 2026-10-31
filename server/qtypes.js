// Question types: normalizing stored questions, what the phone sees, and checking answers on the server.
//
// Stored question (quiz files):
//   { type, text, time, points, explain?,
//     image?, reveal?: 'blur' | 'tiles', revealSec?,   picture (PNG/JPG/GIF/WebP, animated too) and how it appears
//     video?: { id, start, end } (YouTube) | { file, start, end } (uploaded mp4/webm)
//     answers?: [{ text, correct, image? }] quiz / tf / poll (an answer can be a picture, with or without text)
//     multi?:   true                       poll: pick several options
//     accept?:  [string]                   type answer (any of these spellings)
//     slider?:  { min, max, step, answer, tol }
//     items?:   [string]                   order (listed in the correct order)
//     pin?:     { shape, ..., extra? }     zone on the image (percent of width/height): circle {x,y,r} · rect {x,y,w,h} ·
//                                          ellipse {x,y,w,h} · polygon {points:[[x,y],...]}; extra = more zones that also count
//     limit?:   1-5                        cloud / open / brain / qna: how many words, ideas or questions each player can send
//     pairs?:   [{ a, b }]                 match: 2-6 pairs, the player connects each a to its b
//     buckets?: [{ name, items: [string] }] sort: 2-3 categories, the player puts every item in its category (8 items at most)
//     layout?, bullets?, body?, timer?, notes?   slide / pdf: how a slide looks (see LAYOUTS), its bullet points, a countdown in seconds
//     pdf?:     { file, page }             a page of an uploaded PDF: the slide itself (type 'pdf') or the picture behind any activity
//     source?:  { doc, loc, quote }        where the answer comes from (shown after the answer)
//     scale?:   { max, low, high }         rate: stars or a scale 1..max (5, 7 or 10) with labels for the two ends
//     items?:   [string]                   order: in the correct order · rank: the things to rank (no right order)
//     body?:    string                     slide: the text under the title
//     puzzle?:  { rows, cols }             jigsaw: the image cut into rows × cols real puzzle pieces
//   }
const { shuffle } = require('./shuffle');

const TYPES = ['quiz', 'tf', 'type', 'slider', 'order', 'match', 'sort', 'pin', 'puzzle', 'poll', 'cloud', 'open', 'brain', 'qna', 'drop', 'rate', 'rank', 'tap', 'slide', 'pdf'];
// types that have a right answer (the only ones the games use)
const SCORED = new Set(['quiz', 'tf', 'type', 'slider', 'order', 'match', 'sort', 'pin', 'puzzle']);
// everyone answers, nothing is graded (the classic quiz only): poll, word cloud, free text, brainstorm, drop a pin
const LIVE = new Set(['poll', 'cloud', 'open', 'brain', 'qna', 'drop', 'rate', 'rank', 'tap']);
const LAYOUTS = ['title', 'bullets', 'image-right', 'image-left', 'full-image', 'quote', 'fun'];
const PDF_FILE = /^[\w.-]+\.pdf$/i;
const MAX_TAPS_PER_SEC = 14; // a finger cannot do more; anything above is a cheat
const LIMIT_DEFAULT = { cloud: 3, open: 1, brain: 3, qna: 2 };
const WORD_MAX = { cloud: 30, open: 200, brain: 120, qna: 150 };
const SCALES = [5, 7, 10];
const REVEALS = ['blur', 'tiles'];
const REVEAL_SECS = [0, 5, 10, 15, 20, 30, 45, 60];
const VIDEO_FILE = /^[\w.-]+\.(mp4|webm|m4v|mov|ogv)$/i;
const TIMES = [5, 10, 20, 30, 45, 60, 90, 120, 180, 240];
const POINTS = [0, 1, 2, 3, 4];

const str = (v, max = 300) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, max);
const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// tolerant comparison for typed answers: case, spaces, punctuation and Hebrew vowel marks don't matter
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '')
    .replace(/[׳'"`״.,!?;:()\-–—_/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// one pin zone. circle: r = radius in % of the picture's width · rect / ellipse: w × h in % of the picture's
// width / height, x/y = the center (a row, a column, a whole line on a map...) · polygon: points in %
function zone(p) {
  p = p || {};
  const base = { x: clamp(num(p.x, 50), 0, 100), y: clamp(num(p.y, 50), 0, 100) };
  if (p.shape === 'polygon') {
    const pts = (Array.isArray(p.points) ? p.points : [])
      .filter((a) => Array.isArray(a) && a.length >= 2)
      .slice(0, 60)
      .map((a) => [Math.round(clamp(num(a[0], 0), 0, 100) * 100) / 100, Math.round(clamp(num(a[1], 0), 0, 100) * 100) / 100]);
    if (pts.length >= 3) return { shape: 'polygon', points: pts };
  }
  if (p.shape === 'rect') return { shape: 'rect', ...base, w: clamp(num(p.w, 20), 1, 100), h: clamp(num(p.h, 10), 1, 100) };
  if (p.shape === 'ellipse') return { shape: 'ellipse', ...base, w: clamp(num(p.w, 20), 1, 100), h: clamp(num(p.h, 10), 1, 100) };
  return { shape: 'circle', ...base, r: clamp(num(p.r, 10), 2, 50) };
}

// any stored/legacy/imported question → clean question, or null when unusable
function normalize(raw) {
  if (!raw || typeof raw !== 'object') return null;
  // legacy sample format { text, options, answer }
  if (!raw.type && Array.isArray(raw.options)) {
    raw = { type: 'quiz', text: raw.text, answers: raw.options.map((t, i) => ({ text: t, correct: i === raw.answer })) };
  }
  const type = TYPES.includes(raw.type) ? raw.type : 'quiz';
  const q = {
    type,
    text: str(raw.text, 300),
    time: TIMES.includes(num(raw.time, 20)) ? num(raw.time, 20) : 20,
    points: POINTS.includes(num(raw.points, 1)) ? num(raw.points, 1) : 1,
  };
  if (raw.image) q.image = str(raw.image, 200);
  // this one step shows the class something other than the room's setting: 'full', 'anon' or 'none' (classic quiz and lesson)
  if (['full', 'anon', 'none'].includes(raw.privacy)) q.privacy = raw.privacy;
  // older quizzes stored reveal: true (= the blur that clears)
  if (raw.reveal && q.image) {
    q.reveal = REVEALS.includes(raw.reveal) ? raw.reveal : 'blur';
    const rs = num(raw.revealSec, 0);
    if (REVEAL_SECS.includes(rs) && rs) q.revealSec = rs;
  }
  const v = raw.video;
  if (v && typeof v === 'object') {
    const times = { start: Math.max(0, Math.round(num(v.start, 0))), end: Math.max(0, Math.round(num(v.end, 0))) };
    if (times.end && times.end <= times.start) times.end = 0;
    if (typeof v.id === 'string' && /^[\w-]{11}$/.test(v.id)) q.video = { id: v.id, ...times };
    else if (typeof v.file === 'string' && VIDEO_FILE.test(v.file)) q.video = { file: v.file, ...times };
  }
  const ex = str(raw.explain, 200).trim();
  if (ex) q.explain = ex;
  // a page of an uploaded PDF: the slide itself, or the picture shown with an activity
  const pf = raw.pdf;
  if (pf && typeof pf === 'object' && PDF_FILE.test(String(pf.file || ''))) q.pdf = { file: String(pf.file), page: clamp(Math.round(num(pf.page, 1)), 1, 999) };
  // where the answer comes from (a citation shown after the answer)
  const sr = raw.source;
  if (sr && typeof sr === 'object') {
    const src = { doc: str(sr.doc, 80).trim(), loc: str(sr.loc, 60).trim(), quote: str(sr.quote, 240).trim() };
    if (src.doc || src.loc || src.quote) q.source = src;
  }
  // a picture for after the answer (to explain), and/or the question picture held back until the answer
  if (raw.explainImage) q.explainImage = str(raw.explainImage, 200);
  if (raw.imageWhen === 'after' && q.image) q.imageWhen = 'after';
  if (type === 'quiz' || type === 'poll') {
    q.answers = (Array.isArray(raw.answers) ? raw.answers : []).slice(0, 6).map((a) => {
      const x = { text: str(a && a.text, 120), correct: type === 'quiz' && !!(a && a.correct) };
      if (a && a.image) x.image = str(a.image, 200);
      return x;
    });
    if (type === 'poll' && raw.multi) q.multi = true;
  } else if (type === 'tf') {
    const a = Array.isArray(raw.answers) && raw.answers.length === 2 ? raw.answers : [{ text: 'נכון', correct: true }, { text: 'לא נכון', correct: false }];
    q.answers = a.map((x) => ({ text: str(x.text, 40) || '', correct: !!x.correct }));
    if (!q.answers.some((x) => x.correct)) q.answers[0].correct = true;
    if (q.answers.every((x) => x.correct)) q.answers[1].correct = false;
  } else if (type === 'type') {
    q.accept = (Array.isArray(raw.accept) ? raw.accept : [raw.accept]).map((s) => str(s, 60).trim()).filter(Boolean).slice(0, 8);
  } else if (type === 'slider') {
    const s = raw.slider || {};
    const min = num(s.min, 0);
    const max = Math.max(min + 1, num(s.max, 100));
    q.slider = { min, max, step: Math.max(0.01, num(s.step, 1)), answer: clamp(num(s.answer, min), min, max), tol: Math.max(0, num(s.tol, 0)) };
  } else if (type === 'match') {
    q.pairs = (Array.isArray(raw.pairs) ? raw.pairs : []).slice(0, 6).map((p) => ({ a: str(p && p.a, 60).trim(), b: str(p && p.b, 60).trim() })).filter((p) => p.a && p.b);
  } else if (type === 'sort') {
    let room = 8;
    q.buckets = (Array.isArray(raw.buckets) ? raw.buckets : []).slice(0, 3).map((b) => {
      const items = (Array.isArray(b && b.items) ? b.items : []).map((x) => str(x, 50).trim()).filter(Boolean).slice(0, Math.max(0, room));
      room -= items.length;
      return { name: str(b && b.name, 30).trim(), items };
    });
  } else if (type === 'rate') {
    const s = raw.scale || {};
    q.scale = { max: SCALES.includes(num(s.max, 5)) ? num(s.max, 5) : 5, low: str(s.low, 30).trim(), high: str(s.high, 30).trim() };
  } else if (type === 'order' || type === 'rank') {
    q.items = (Array.isArray(raw.items) ? raw.items : []).map((s) => str(s, 80).trim()).filter(Boolean).slice(0, 6);
  } else if (type === 'pin') {
    const p = raw.pin || {};
    q.pin = zone(p);
    const extra = (Array.isArray(p.extra) ? p.extra : []).slice(0, 5).map(zone);
    if (extra.length) q.pin.extra = extra;
    // ar = picture width / height: keeps a circle round on any picture
    const ar = num(p.ar, 0);
    if (ar >= 0.1 && ar <= 10) q.pin.ar = Math.round(ar * 1000) / 1000;
  } else if (type === 'cloud' || type === 'open' || type === 'brain' || type === 'qna') {
    q.limit = clamp(Math.round(num(raw.limit, LIMIT_DEFAULT[type])), 1, 5);
  } else if (type === 'slide' || type === 'pdf') {
    const b = str(raw.body, 600).trim();
    if (b) q.body = b;
    const bl = (Array.isArray(raw.bullets) ? raw.bullets : []).map((x) => str(x, 140).trim()).filter(Boolean).slice(0, 8);
    if (bl.length) q.bullets = bl;
    if (LAYOUTS.includes(raw.layout)) q.layout = raw.layout;
    const tm = Math.round(num(raw.timer, 0));
    if (tm > 0) q.timer = clamp(tm, 5, 3600);
    const nt = str(raw.notes, 800).trim();
    if (nt) q.notes = nt;
    q.points = 0;
  } else if (type === 'puzzle') {
    const p = raw.puzzle || {};
    q.puzzle = { rows: clamp(Math.round(num(p.rows, 3)), 2, 5), cols: clamp(Math.round(num(p.cols, 3)), 2, 5) };
  }
  return q;
}

// is a scored question complete enough to be asked?
function playable(q) {
  if (!q || !SCORED.has(q.type) || !q.text) return false;
  if (q.type === 'quiz') return q.answers.filter((a) => a.text || a.image).length >= 2 && q.answers.some((a) => a.correct && (a.text || a.image));
  if (q.type === 'tf') return true;
  if (q.type === 'type') return q.accept.length > 0;
  if (q.type === 'slider') return true;
  if (q.type === 'order') return q.items.length >= 2;
  if (q.type === 'match') return q.pairs.length >= 2;
  if (q.type === 'sort') return q.buckets.length >= 2 && q.buckets.every((b) => b.name && b.items.length);
  if (q.type === 'pin' || q.type === 'puzzle') return !!q.image;
  return false;
}

// can the classic quiz show it? scored questions that are complete, plus polls, clouds, free text, brainstorms, drop-pins and slides
function shown(q) {
  if (!q) return false;
  if (SCORED.has(q.type)) return playable(q);
  if (q.type === 'poll') return q.answers.filter((a) => a.text || a.image).length >= 2;
  if (q.type === 'cloud' || q.type === 'open' || q.type === 'brain' || q.type === 'qna' || q.type === 'rate') return !!q.text;
  if (q.type === 'rank') return !!q.text && q.items.length >= 2;
  if (q.type === 'drop') return !!q.text && !!q.image;
  if (q.type === 'slide') return !!(q.text || q.image || q.video || (q.bullets && q.bullets.length) || q.body);
  if (q.type === 'pdf') return !!q.pdf;
  if (q.type === 'tap') return !!q.text;
  return false;
}

// what the phone gets + the private state needed to check the answer
function present(q, mediaBase) {
  const out = { type: q.type, text: q.text, time: q.time, points: q.points };
  const held = q.imageWhen === 'after' && q.type !== 'pin' && q.type !== 'puzzle' && q.type !== 'drop';
  if (q.image && !held) out.image = mediaBase + encodeURIComponent(q.image);
  if (q.reveal && !held) {
    out.reveal = q.reveal;
    out.revealSec = Math.min(q.revealSec || q.time, q.time);
  }
  if (q.video) out.video = q.video.id ? { ...q.video } : { url: mediaBase + encodeURIComponent(q.video.file), start: q.video.start, end: q.video.end };
  if (q.pdf) out.pdf = { url: mediaBase + encodeURIComponent(q.pdf.file), page: q.pdf.page };
  const state = {};
  if (q.type === 'quiz' || q.type === 'tf' || q.type === 'poll') {
    const idx = q.answers.map((a, i) => i).filter((i) => q.answers[i].text || q.answers[i].image);
    state.order = q.type === 'tf' ? idx : shuffle(idx);
    out.options = state.order.map((i) => q.answers[i].text);
    if (state.order.some((i) => q.answers[i].image)) out.optionImages = state.order.map((i) => (q.answers[i].image ? mediaBase + encodeURIComponent(q.answers[i].image) : ''));
    out.multi = q.type === 'poll' ? !!q.multi : q.type === 'quiz' && q.answers.filter((a) => a.correct && (a.text || a.image)).length > 1;
  } else if (q.type === 'cloud' || q.type === 'open' || q.type === 'brain' || q.type === 'qna') {
    out.limit = q.limit;
  } else if (q.type === 'rate') {
    out.scale = q.scale;
  } else if (q.type === 'slide' || q.type === 'pdf') {
    if (q.body) out.body = q.body;
    if (q.bullets) out.bullets = q.bullets;
    if (q.layout) out.layout = q.layout;
    if (q.timer) out.timer = q.timer;
  } else if (q.type === 'tap') {
    out.maxTaps = Math.round(q.time * MAX_TAPS_PER_SEC);
  } else if (q.type === 'slider') {
    const { min, max, step } = q.slider;
    out.slider = { min, max, step };
  } else if (q.type === 'match') {
    // the left column stays as written, the right one is shuffled
    state.order = shuffle(q.pairs.map((_, i) => i));
    if (state.order.every((v, i) => v === i)) state.order.reverse();
    out.left = q.pairs.map((p) => p.a);
    out.right = state.order.map((i) => q.pairs[i].b);
  } else if (q.type === 'sort') {
    state.order = shuffle(flat(q).map((_, i) => i));
    out.buckets = q.buckets.map((b) => b.name);
    out.items = state.order.map((i) => flat(q)[i].t);
  } else if (q.type === 'order' || q.type === 'rank') {
    state.order = shuffle(q.items.map((_, i) => i));
    if (state.order.every((v, i) => v === i) && state.order.length > 1) state.order.reverse();
    out.items = state.order.map((i) => q.items[i]);
  } else if (q.type === 'puzzle') {
    // the seed draws the same knobs and holes on the big screen and on every phone
    out.puzzle = { rows: q.puzzle.rows, cols: q.puzzle.cols, seed: 1 + Math.floor(Math.random() * 1e9) };
  }
  return { payload: out, state };
}

const label = (a) => a.text || '🖼️ תמונה';
// every item of a sort question with the bucket it belongs to
const flat = (q) => q.buckets.flatMap((b, bi) => b.items.map((t) => ({ t, bi })));

function correctText(q) {
  if (q.type === 'quiz' || q.type === 'tf') return q.answers.filter((a) => a.correct && (a.text || a.image)).map(label).join(' · ');
  if (q.type === 'type') return q.accept[0] || '';
  if (q.type === 'slider') return String(q.slider.answer);
  if (q.type === 'order') return q.items.join(' ← ');
  if (q.type === 'match') return q.pairs.map((p) => `${p.a} = ${p.b}`).join(' · ');
  if (q.type === 'sort') return q.buckets.map((b) => `${b.name}: ${b.items.join(', ')}`).join(' · ');
  if (q.type === 'pin') return 'המקום המסומן בתמונה';
  if (q.type === 'puzzle') return 'התמונה השלמה';
  return '';
}

// the picture to show after the answer (explanation picture, or the question picture held back), or ''
function afterImage(q, mediaBase) {
  const f = q.explainImage || (q.imageWhen === 'after' && q.type !== 'pin' && q.type !== 'puzzle' && q.type !== 'drop' ? q.image : '');
  return f ? mediaBase + encodeURIComponent(f) : '';
}

// is (x, y) (percent of the picture) inside one zone?
function inZone(z, x, y, ar) {
  if (z.shape === 'polygon') {
    let inside = false;
    const p = z.points;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      if (p[i][1] > y !== p[j][1] > y && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) inside = !inside;
    }
    return inside;
  }
  const dx = x - z.x;
  const dy = y - z.y;
  if (z.shape === 'rect') return Math.abs(dx) <= z.w / 2 + 1e-9 && Math.abs(dy) <= z.h / 2 + 1e-9;
  if (z.shape === 'ellipse') return (dx / (z.w / 2)) ** 2 + (dy / (z.h / 2)) ** 2 <= 1 + 1e-9;
  // height-percent → width-percent, so the zone is the same round circle the teacher drew
  return Math.hypot(dx, dy / (ar || 1)) <= z.r + 1e-9;
}

// is (x, y) inside the pin's zone, or any of its extra zones?
function inPin(pin, x, y) {
  return inZone(pin, x, y, pin.ar) || (pin.extra || []).some((z) => inZone(z, x, y, pin.ar));
}

// → { valid, ok, chosen } ; valid=false means a malformed answer to ignore
function check(q, state, data) {
  data = data || {};
  if (q.type === 'quiz' || q.type === 'tf' || q.type === 'poll') {
    let picks;
    if (Array.isArray(data.choices) && (q.type === 'quiz' || q.multi)) picks = data.choices;
    else if (Number.isInteger(data.choice)) picks = [data.choice];
    else return { valid: false };
    if (!picks.length || picks.length > state.order.length || picks.some((c) => !Number.isInteger(c) || c < 0 || c >= state.order.length)) return { valid: false };
    const chosen = [...new Set(picks)].map((c) => state.order[c]);
    const text = chosen.map((i) => label(q.answers[i])).join(' · ');
    if (q.type === 'poll') return { valid: true, ok: null, chosen: text };
    const correct = new Set(q.answers.map((a, i) => (a.correct ? i : -1)).filter((i) => i >= 0));
    const ok = chosen.length === correct.size && chosen.every((i) => correct.has(i));
    return { valid: true, ok, chosen: text };
  }
  if (q.type === 'tap') {
    const n = Math.round(Number(data.taps));
    if (!Number.isFinite(n) || n < 0) return { valid: false };
    const cap = Math.round(q.time * MAX_TAPS_PER_SEC);
    return { valid: true, ok: null, taps: Math.min(n, cap), chosen: String(Math.min(n, cap)) };
  }
  if (q.type === 'rate') {
    const v = Number(data.value);
    if (!Number.isInteger(v) || v < 1 || v > q.scale.max) return { valid: false };
    return { valid: true, ok: null, value: v, chosen: String(v) };
  }
  if (q.type === 'rank') {
    const o = data.order;
    if (!Array.isArray(o) || o.length !== state.order.length || new Set(o).size !== o.length || o.some((v) => !Number.isInteger(v) || v < 0 || v >= o.length)) return { valid: false };
    const ranks = o.map((d) => state.order[d]);
    return { valid: true, ok: null, ranks, chosen: ranks.map((i) => q.items[i]).join(' ← ') };
  }
  if (q.type === 'cloud' || q.type === 'open' || q.type === 'brain' || q.type === 'qna') {
    const list = Array.isArray(data.words) ? data.words : typeof data.text === 'string' ? [data.text] : null;
    if (!list) return { valid: false };
    const seen = new Set();
    const words = [];
    for (const w of list.slice(0, q.limit * 2)) {
      const t = str(w, WORD_MAX[q.type]).replace(/\s+/g, ' ').trim();
      if (!t || seen.has(norm(t))) continue;
      seen.add(norm(t));
      words.push(t);
    }
    if (!words.length) return { valid: false };
    return { valid: true, ok: null, words: words.slice(0, q.limit), chosen: words.slice(0, q.limit).join(' · ') };
  }
  if (q.type === 'drop') {
    const x = Number(data.x);
    const y = Number(data.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 100 || y > 100) return { valid: false };
    return { valid: true, ok: null, chosen: `(${Math.round(x)}%, ${Math.round(y)}%)` };
  }
  if (q.type === 'type') {
    if (typeof data.text !== 'string') return { valid: false };
    const t = str(data.text, 60).trim();
    if (!t) return { valid: false };
    return { valid: true, ok: q.accept.some((a) => norm(a) === norm(t)), chosen: t };
  }
  if (q.type === 'slider') {
    const v = Number(data.value);
    if (!Number.isFinite(v)) return { valid: false };
    return { valid: true, ok: Math.abs(v - q.slider.answer) <= q.slider.tol + 1e-9, chosen: String(v) };
  }
  if (q.type === 'match') {
    const m = data.match;
    const n = q.pairs.length;
    if (!Array.isArray(m) || m.length !== n || new Set(m).size !== n || m.some((v) => !Number.isInteger(v) || v < 0 || v >= n)) return { valid: false };
    const right = m.filter((j, i) => state.order[j] === i).length;
    return { valid: true, ok: right === n, ratio: right / n, chosen: `${right}/${n} זוגות נכונים` };
  }
  if (q.type === 'sort') {
    const s = data.sort;
    const items = flat(q);
    if (!Array.isArray(s) || s.length !== items.length || s.some((v) => !Number.isInteger(v) || v < 0 || v >= q.buckets.length)) return { valid: false };
    const right = s.filter((k, d) => items[state.order[d]].bi === k).length;
    return { valid: true, ok: right === items.length, ratio: right / items.length, chosen: `${right}/${items.length} במקום הנכון` };
  }
  if (q.type === 'order') {
    const o = data.order;
    if (!Array.isArray(o) || o.length !== state.order.length || new Set(o).size !== o.length || o.some((v) => !Number.isInteger(v) || v < 0 || v >= o.length)) return { valid: false };
    const original = o.map((d) => state.order[d]);
    return { valid: true, ok: original.every((v, i) => v === i), chosen: original.map((i) => q.items[i]).join(' ← ') };
  }
  if (q.type === 'pin') {
    const x = Number(data.x);
    const y = Number(data.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { valid: false };
    return { valid: true, ok: inPin(q.pin, x, y), chosen: `(${Math.round(x)}%, ${Math.round(y)}%)` };
  }
  if (q.type === 'puzzle') {
    // order[cell] = the piece put in that cell; piece k belongs in cell k
    const n = q.puzzle.rows * q.puzzle.cols;
    const o = data.order;
    if (!Array.isArray(o) || o.length !== n || new Set(o).size !== n || o.some((v) => !Number.isInteger(v) || v < 0 || v >= n)) return { valid: false };
    const right = o.filter((v, i) => v === i).length;
    return { valid: true, ok: right === n, ratio: right / n, chosen: `${right}/${n} חלקים במקום` };
  }
  return { valid: false };
}

module.exports = { TYPES, SCORED, LIVE, LAYOUTS, PDF_FILE, WORD_MAX, shown, zone, TIMES, POINTS, REVEALS, REVEAL_SECS, VIDEO_FILE, normalize, playable, present, check, correctText, norm, inPin, afterImage };
