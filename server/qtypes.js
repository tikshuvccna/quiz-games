// Question types: normalizing stored questions, what the phone sees, and checking answers on the server.
//
// Stored question (quiz files):
//   { type, text, time, points, explain?,
//     image?, reveal?: 'blur' | 'tiles', revealSec?,   picture (PNG/JPG/GIF/WebP, animated too) and how it appears
//     video?: { id, start, end } (YouTube) | { file, start, end } (uploaded mp4/webm)
//     answers?: [{ text, correct }]        quiz / tf / poll
//     accept?:  [string]                   type answer (any of these spellings)
//     slider?:  { min, max, step, answer, tol }
//     items?:   [string]                   order (listed in the correct order)
//     pin?:     { x, y, r }                pin on the image (percent of width/height)
//     puzzle?:  { rows, cols }             jigsaw: the image cut into rows × cols real puzzle pieces
//   }
const { shuffle } = require('./shuffle');

const TYPES = ['quiz', 'tf', 'type', 'slider', 'order', 'pin', 'puzzle', 'poll', 'slide'];
// types that have a right answer (the only ones the games use)
const SCORED = new Set(['quiz', 'tf', 'type', 'slider', 'order', 'pin', 'puzzle']);
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
  if (type === 'quiz' || type === 'poll') {
    q.answers = (Array.isArray(raw.answers) ? raw.answers : []).slice(0, 6).map((a) => ({ text: str(a && a.text, 120), correct: type === 'quiz' && !!(a && a.correct) }));
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
  } else if (type === 'order') {
    q.items = (Array.isArray(raw.items) ? raw.items : []).map((s) => str(s, 80).trim()).filter(Boolean).slice(0, 6);
  } else if (type === 'pin') {
    const p = raw.pin || {};
    q.pin = { x: clamp(num(p.x, 50), 0, 100), y: clamp(num(p.y, 50), 0, 100), r: clamp(num(p.r, 10), 2, 50) };
  } else if (type === 'puzzle') {
    const p = raw.puzzle || {};
    q.puzzle = { rows: clamp(Math.round(num(p.rows, 3)), 2, 5), cols: clamp(Math.round(num(p.cols, 3)), 2, 5) };
  }
  return q;
}

// is a scored question complete enough to be asked?
function playable(q) {
  if (!q || !SCORED.has(q.type) || !q.text) return false;
  if (q.type === 'quiz') return q.answers.filter((a) => a.text).length >= 2 && q.answers.some((a) => a.correct && a.text);
  if (q.type === 'tf') return true;
  if (q.type === 'type') return q.accept.length > 0;
  if (q.type === 'slider') return true;
  if (q.type === 'order') return q.items.length >= 2;
  if (q.type === 'pin' || q.type === 'puzzle') return !!q.image;
  return false;
}

// what the phone gets + the private state needed to check the answer
function present(q, mediaBase) {
  const out = { type: q.type, text: q.text, time: q.time, points: q.points };
  if (q.image) out.image = mediaBase + encodeURIComponent(q.image);
  if (q.reveal) {
    out.reveal = q.reveal;
    out.revealSec = Math.min(q.revealSec || q.time, q.time);
  }
  if (q.video) out.video = q.video.id ? { ...q.video } : { url: mediaBase + encodeURIComponent(q.video.file), start: q.video.start, end: q.video.end };
  const state = {};
  if (q.type === 'quiz' || q.type === 'tf' || q.type === 'poll') {
    const idx = q.answers.map((a, i) => i).filter((i) => q.answers[i].text);
    state.order = q.type === 'tf' ? idx : shuffle(idx);
    out.options = state.order.map((i) => q.answers[i].text);
    out.multi = q.type === 'quiz' && q.answers.filter((a) => a.correct && a.text).length > 1;
  } else if (q.type === 'slider') {
    const { min, max, step } = q.slider;
    out.slider = { min, max, step };
  } else if (q.type === 'order') {
    state.order = shuffle(q.items.map((_, i) => i));
    if (state.order.every((v, i) => v === i) && state.order.length > 1) state.order.reverse();
    out.items = state.order.map((i) => q.items[i]);
  } else if (q.type === 'puzzle') {
    // the seed draws the same knobs and holes on the big screen and on every phone
    out.puzzle = { rows: q.puzzle.rows, cols: q.puzzle.cols, seed: 1 + Math.floor(Math.random() * 1e9) };
  }
  return { payload: out, state };
}

function correctText(q) {
  if (q.type === 'quiz' || q.type === 'tf') return q.answers.filter((a) => a.correct && a.text).map((a) => a.text).join(' · ');
  if (q.type === 'type') return q.accept[0] || '';
  if (q.type === 'slider') return String(q.slider.answer);
  if (q.type === 'order') return q.items.join(' ← ');
  if (q.type === 'pin') return 'המקום המסומן בתמונה';
  if (q.type === 'puzzle') return 'התמונה השלמה';
  return '';
}

// → { valid, ok, chosen } ; valid=false means a malformed answer to ignore
function check(q, state, data) {
  data = data || {};
  if (q.type === 'quiz' || q.type === 'tf') {
    const correct = new Set(q.answers.map((a, i) => (a.correct ? i : -1)).filter((i) => i >= 0));
    let picks;
    if (Array.isArray(data.choices)) picks = data.choices;
    else if (Number.isInteger(data.choice)) picks = [data.choice];
    else return { valid: false };
    if (!picks.length || picks.length > state.order.length || picks.some((c) => !Number.isInteger(c) || c < 0 || c >= state.order.length)) return { valid: false };
    const chosen = [...new Set(picks)].map((c) => state.order[c]);
    const ok = chosen.length === correct.size && chosen.every((i) => correct.has(i));
    return { valid: true, ok, chosen: chosen.map((i) => q.answers[i].text).join(' · ') };
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
    const d = Math.hypot(x - q.pin.x, y - q.pin.y);
    return { valid: true, ok: d <= q.pin.r, chosen: `(${Math.round(x)}%, ${Math.round(y)}%)` };
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

module.exports = { TYPES, SCORED, TIMES, POINTS, REVEALS, REVEAL_SECS, VIDEO_FILE, normalize, playable, present, check, correctText, norm };
