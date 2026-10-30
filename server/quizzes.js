// Quiz library on disk. The admin chooses the folder (saved in config.json); every quiz is one
// <id>.json file in it, and its pictures live in <folder>/media/<id>/.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const qt = require('./qtypes');
const SAMPLE = require('../questions/sample.json');

const ROOT = path.join(__dirname, '..');
const CONFIG = path.join(ROOT, 'config.json');
const DEFAULT_FOLDER = path.join(ROOT, 'quizzes');
const SAMPLE_ID = '__sample';
const IMAGE_TYPES = { 'image/png': '.png', 'image/apng': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg' };
const PDF_TYPES = { 'application/pdf': '.pdf' };
const VIDEO_TYPES = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'video/x-m4v': '.m4v', 'video/ogg': '.ogv' };

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(c) {
  fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2));
}

// QUIZ_DIR (environment) wins: servers in the cloud and test servers keep their own library
function folder() {
  const f = process.env.QUIZ_DIR || readConfig().folder || DEFAULT_FOLDER;
  try {
    fs.mkdirSync(f, { recursive: true });
  } catch {}
  return f;
}

function setFolder(dir) {
  const abs = path.resolve(String(dir || ''));
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) throw new Error('התיקייה לא קיימת');
  const c = readConfig();
  c.folder = abs;
  writeConfig(c);
  return abs;
}

// ids are file names: letters (incl. Hebrew), digits, dash, underscore
const validId = (id) => typeof id === 'string' && id !== SAMPLE_ID && /^[\p{L}\p{N}_-]{1,60}$/u.test(id);
const fileOf = (id) => path.join(folder(), `${id}.json`);

function newId(title) {
  const base = String(title || 'quiz').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 30) || 'quiz';
  let id;
  do id = `${base}-${crypto.randomBytes(2).toString('hex')}`;
  while (fs.existsSync(fileOf(id)));
  return id;
}

// a library folder path: "מדעים/כיתה ז" ('' = top level). Up to 4 levels, no dots or slashes in names.
function cleanFolder(p) {
  return String(p || '')
    .split(/[\\/]+/)
    .map((x) => x.replace(/[<>:"|?*\u0000-\u001f]/g, '').replace(/^\.+/, '').trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 4)
    .join('/');
}

// where an imported quiz came from (kept for attribution): { site, id, url, author, language, tags }
function cleanSource(s) {
  if (!s || typeof s !== 'object') return {};
  const t = (v, n) => String(v || '').replace(/[\u0000-\u001f]/g, '').slice(0, n);
  const out = { site: t(s.site, 30), id: t(s.id, 80), url: /^https?:\/\//.test(String(s.url || '')) ? t(s.url, 300) : '', author: t(s.author, 80), language: t(s.language, 20) };
  const tags = (Array.isArray(s.tags) ? s.tags : []).map((x) => t(x, 40)).filter(Boolean).slice(0, 12);
  if (tags.length) out.tags = tags;
  return out.site || out.url ? { source: out } : {};
}

function clean(data) {
  return {
    title: String((data && data.title) || 'חידון ללא שם').slice(0, 80),
    description: String((data && data.description) || '').slice(0, 300),
    folder: cleanFolder(data && data.folder),
    background: String((data && data.background) || '').replace(/[^\p{L}\p{N}:._ -]/gu, '').slice(0, 120),
    theme: ['candy', 'ocean', 'forest', 'sunset', 'mono', 'neon', 'space'].includes(data && data.theme) ? data.theme : '',
    ...cleanSource(data && data.source),
    updated: new Date().toISOString(),
    questions: (Array.isArray(data && data.questions) ? data.questions : []).slice(0, 400).map(qt.normalize).filter(Boolean),
  };
}

function sample() {
  return { id: SAMPLE_ID, builtin: true, title: 'חידון לדוגמה · ידע כללי', description: '20 שאלות ידע כללי', questions: SAMPLE.map(qt.normalize) };
}

function load(id) {
  if (id === SAMPLE_ID) return sample();
  if (!validId(id)) throw new Error('חידון לא קיים');
  const raw = JSON.parse(fs.readFileSync(fileOf(id), 'utf8'));
  return { id, ...clean(raw), updated: raw.updated || null };
}

function list() {
  const out = [];
  let files = [];
  try {
    files = fs.readdirSync(folder()).filter((f) => f.endsWith('.json'));
  } catch {}
  for (const f of files) {
    const id = f.slice(0, -5);
    if (!validId(id)) continue;
    try {
      const q = load(id);
      out.push({ id, title: q.title, folder: q.folder, background: q.background, theme: q.theme, count: q.questions.length, playable: q.questions.filter(qt.playable).length, updated: q.updated, cover: (q.questions.find((x) => x.image) || {}).image || null, types: [...new Set(q.questions.map((x) => x.type))] });
    } catch {
      // not a quiz file: skip it
    }
  }
  out.sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  const s = sample();
  return [{ id: SAMPLE_ID, builtin: true, title: s.title, count: s.questions.length, playable: s.questions.length }, ...out];
}

function save(id, data) {
  if (!validId(id)) throw new Error('מזהה לא תקין');
  // the editor doesn't send the folder: keep the one on disk
  if (data && (data.folder === undefined || data.source === undefined) && fs.existsSync(fileOf(id))) {
    try {
      const old = JSON.parse(fs.readFileSync(fileOf(id), 'utf8'));
      data = { ...data, folder: data.folder === undefined ? old.folder : data.folder, source: data.source === undefined ? old.source : data.source };
    } catch {}
  }
  const q = clean(data);
  const tmp = fileOf(id) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(q, null, 2));
  fs.renameSync(tmp, fileOf(id));
  return { id, ...q };
}

function create(title, questions = [], folderPath = '') {
  const id = newId(title);
  return save(id, { title: title || 'חידון חדש', questions, folder: folderPath });
}

function duplicate(id) {
  const q = load(id);
  const copy = create(`${q.title} (עותק)`, q.questions, q.folder);
  // copy the pictures too
  const src = mediaDir(id, false);
  if (src && fs.existsSync(src)) fs.cpSync(src, mediaDir(copy.id), { recursive: true });
  return copy;
}

// deleted quizzes go to a .trash folder instead of disappearing
function remove(id) {
  if (!validId(id)) throw new Error('מזהה לא תקין');
  const trash = path.join(folder(), '.trash');
  fs.mkdirSync(trash, { recursive: true });
  const stamp = Date.now();
  if (fs.existsSync(fileOf(id))) fs.renameSync(fileOf(id), path.join(trash, `${id}.${stamp}.json`));
  const m = mediaDir(id, false);
  if (m && fs.existsSync(m)) fs.renameSync(m, path.join(trash, `${id}.${stamp}.media`));
}

function mediaDir(id, create = true) {
  if (!validId(id)) return null;
  const d = path.join(folder(), 'media', id);
  if (create) fs.mkdirSync(d, { recursive: true });
  return d;
}

function saveMedia(id, buffer, mime) {
  const ext = IMAGE_TYPES[mime] || VIDEO_TYPES[mime] || PDF_TYPES[mime];
  if (!ext) throw new Error('סוג קובץ לא נתמך (תמונות: PNG, JPG, GIF, WEBP, SVG · סרטונים: MP4, WEBM, MOV · מסמכים: PDF)');
  if (!buffer || !buffer.length) throw new Error('קובץ ריק');
  const name = `${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(mediaDir(id), name), buffer);
  return name;
}

function mediaPath(id, file) {
  const name = path.basename(String(file || ''));
  if (!validId(id) || !/^[\w.-]+\.(png|jpe?g|gif|webp|svg|mp4|webm|m4v|mov|ogv|pdf)$/i.test(name)) return null;
  const p = path.join(folder(), 'media', id, name);
  return fs.existsSync(p) ? p : null;
}

// playable questions of a quiz, for a game, plus the URL prefix of its pictures
// opts.all: the classic quiz can also show polls and info slides
function questionsFor(id, opts = {}) {
  let q;
  try {
    q = load(id || SAMPLE_ID);
  } catch {
    q = sample();
  }
  let qs = q.questions.filter((x) => qt.playable(x) || (opts.all && qt.shown(x)));
  if (!qs.length) {
    q = sample();
    qs = q.questions;
  }
  return { id: q.id, title: q.title, questions: qs, mediaBase: `/media/${encodeURIComponent(q.id)}/` };
}

// ---------- Kahoot spreadsheet template ----------
const NEAREST_TIME = (t) => qt.TIMES.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a), 20);
const cellText = (c) => {
  const v = c && c.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return String(v.result);
  }
  return String(v);
};

// Extra columns after Kahoot's own (all optional; Kahoot ignores them):
//   Type, Points, Image, Video, Reveal, Accept, Slider, Items, Pin, Puzzle, Explanation, AfterImage, AnsImages, Limit, Body, Scale,
//   and for lessons: Layout, Bullets, Pdf, Timer, Notes, Source
const EXTRA_COLS = /^(afterimage|ansimages|type|points|image|video|reveal|accept|slider|items|pin|puzzle|explanation|limit|body|scale|layout|bullets|pdf|timer|notes|source)\b/i;
const IMG_EXT = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const parts = (s) => String(s || '').split('|').map((x) => x.trim()).filter(Boolean);

// width × height of a PNG / GIF / JPEG / WebP from its first bytes (no image library needed)
function imageSize(b) {
  try {
    if (!b || b.length < 30) return null;
    if (b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b.toString('ascii', 0, 3) === 'GIF') return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
    if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
      const kind = b.toString('ascii', 12, 16);
      if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
      if (kind === 'VP8L') { const v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) }; }
      if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    }
    if (b[0] === 0xff && b[1] === 0xd8) {
      for (let i = 2; i < b.length - 9;) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
  } catch {}
  return null;
}

function parseVideo(s) {
  s = String(s || '').trim();
  const m = s.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/)([\w-]{11})/) || s.match(/^([\w-]{11})$/);
  if (!m) return null;
  const st = s.match(/[?&](?:start|t)=(\d+)/);
  const en = s.match(/[?&]end=(\d+)/);
  return { id: m[1], start: st ? +st[1] : 0, end: en ? +en[1] : 0 };
}

// spreadsheet column number → letter (1 → A, 27 → AA)
const colLetter = (n) => {
  let s = '';
  for (n = Number(n) || 0; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
const TYPE_NAMES = { pdf: 'pdf', tap: 'tap', check: 'check', understood: 'check', 'עמוד pdf': 'pdf', 'מרוץ הקשות': 'tap', 'הבנתם': 'check', 'בדיקת הבנה': 'check', match: 'match', sort: 'sort', 'התאמה': 'match', 'מיון': 'sort', quiz: 'quiz', tf: 'tf', type: 'type', slider: 'slider', order: 'order', pin: 'pin', puzzle: 'puzzle', poll: 'poll', multipoll: 'multipoll', cloud: 'cloud', open: 'open', brain: 'brain', qna: 'qna', rate: 'rate', rank: 'rank', drop: 'drop', slide: 'slide', 'נכון/לא נכון': 'tf', 'הקלדה': 'type', 'סרגל': 'slider', 'סידור': 'order', 'סימון': 'pin', 'פאזל': 'puzzle', 'סקר': 'poll', 'סקר מרובה': 'multipoll', 'ענן מילים': 'cloud', 'תשובה פתוחה': 'open', 'סיעור מוחות': 'brain', 'שאלות מהכיתה': 'qna', 'דירוג': 'rate', 'דירוג פריטים': 'rank', 'סיכה חופשית': 'drop', 'שקופית': 'slide', 'חידון': 'quiz' };

// one pin zone from a spreadsheet cell, in percent of the picture:
//   x|y|radius = circle · x|y|width|height = rectangle · ellipse:x|y|width|height · poly:x,y;x,y;x,y = polygon
function parseZone(text, ar) {
  const t = String(text || '').trim();
  const poly = t.match(/^poly(?:gon)?\s*:(.+)$/i);
  if (poly) {
    const pts = poly[1].split(';').map((p) => p.split(',').map(Number));
    return pts.length >= 3 && pts.every((p) => p.length === 2 && p.every((v) => Number.isFinite(v) && v >= 0 && v <= 100)) ? { shape: 'polygon', points: pts } : null;
  }
  const ell = t.match(/^ellipse\s*:(.+)$/i);
  const n = parts(ell ? ell[1] : t).map(Number);
  if (n.length < 2 || !n.every(Number.isFinite) || n[0] < 0 || n[0] > 100 || n[1] < 0 || n[1] > 100) return null;
  if (ell) return n.length >= 4 ? { shape: 'ellipse', x: n[0], y: n[1], w: n[2], h: n[3] } : null;
  return n.length >= 4 ? { shape: 'rect', x: n[0], y: n[1], w: n[2], h: n[3] } : { shape: 'circle', x: n[0], y: n[1], r: n[2] || 10, ar };
}

// the Pdf cell: "deck.pdf" (every page), "deck.pdf:3" (one page) or "deck.pdf:3-7" (a range); → { alias, from, to } or null
function parsePdfRef(cell, ctx, note, col) {
  const m = String(cell).trim().match(/^(.*?)(?::\s*(\d+)(?:\s*-\s*(\d+))?)?$/);
  const name = path.basename(m[1].trim().replace(/\\/g, '/')).toLowerCase();
  const pdf = ctx.pdfs.get(name);
  if (!pdf) {
    note(col, ctx.pdfs.size ? `קובץ ה־PDF "${m[1].trim()}" לא נמצא ב־zip` : `קובץ ה־PDF "${m[1].trim()}" לא צורף (העלו zip עם התיקייה pdf)`, 'warn');
    return null;
  }
  const total = ctx.pdfPages.get(pdf.alias) || 0;
  let from = m[2] ? Number(m[2]) : 1;
  let to = m[3] ? Number(m[3]) : m[2] ? from : total || from;
  if (total && from > total) {
    note(col, `עמוד ${from} לא קיים ב־PDF (יש ${total} עמודים), נקבע העמוד האחרון`, 'info');
    from = total;
  }
  if (total) to = Math.min(to, total);
  if (to < from) to = from;
  if (to - from > 199) to = from + 199;
  return { alias: pdf.alias, from, to };
}

// one spreadsheet row → raw question (the Kahoot columns are always a valid multiple-choice version)
// note(col, reason, level): collects what the teacher should know about this row
function rowToRaw(cells, head, images, note, ctx = { pdfs: new Map(), pdfPages: new Map() }) {
  const get = (k) => (head[k] ? cells[head[k]] || '' : '');
  const text = cells[head.q];
  const answers = [1, 2, 3, 4, 5, 6].filter((k) => head['a' + k]).map((k) => cells[head['a' + k]] || '');
  const rawCorrect = String(cells[head.correct] || '');
  const correct = rawCorrect.split(/[^\d]+/).filter(Boolean).map(Number);
  const okCorrect = correct.filter((n) => n >= 1 && n <= answers.length && answers[n - 1]);
  if (correct.length > okCorrect.length) note(head.correct, `תשובה נכונה "${rawCorrect}" לא קיימת בשורה`, 'warn');
  const t = Number(cells[head.time]);
  const time = NEAREST_TIME(t || 20);
  if (cells[head.time] && t !== time) note(head.time, `זמן ${cells[head.time]} לא קיים, נקבע ${time} שניות`, 'info');
  const base = { type: 'quiz', text, time, answers: answers.map((x, i) => ({ text: x, correct: okCorrect.includes(i + 1) })) };
  const pts = get('x_points');
  if (pts !== '') {
    if (qt.POINTS.includes(Number(pts))) base.points = Number(pts);
    else note(head.x_points, `ניקוד "${pts}" לא תקין (0-4), נקבע 1`, 'info');
  }
  const ex = get('x_explanation');
  if (ex) base.explain = ex;
  // where the answer comes from: document | location | quote
  const srcRaw = get('x_source');
  if (srcRaw) {
    const sp = srcRaw.split('|').map((x) => x.trim());
    base.source = { doc: sp[0] || '', loc: sp[1] || '', quote: sp.slice(2).join(' | ') };
  }
  const pdfCell = get('x_pdf');
  const pdfRef = pdfCell ? parsePdfRef(pdfCell, ctx, note, head.x_pdf) : null;

  const imgRaw = get('x_image');
  if (imgRaw) {
    const imgName = path.basename(imgRaw.replace(/\\/g, '/')).toLowerCase();
    if (images.has(imgName)) base.image = imgName;
    else note(head.x_image, images.size ? `התמונה "${imgRaw}" לא נמצאה ב-zip` : `התמונה "${imgRaw}" לא צורפה (העלו zip עם תיקיית images)`, 'warn');
  }
  // a picture shown after the answer, to explain it
  const afRaw = get('x_afterimage');
  if (afRaw) {
    const afName = path.basename(afRaw.replace(/\\/g, '/')).toLowerCase();
    if (images.has(afName)) base.explainImage = afName;
    else note(head.x_afterimage, `התמונה "${afRaw}" לא נמצאה ב-zip`, 'warn');
  }
  const rv = get('x_reveal').toLowerCase();
  if (rv) {
    if (/^(yes|true|1|כן|blur|טשטוש)$/i.test(rv)) base.reveal = 'blur';
    else if (/^(tiles|אריחים|ריבועים)$/i.test(rv)) base.reveal = 'tiles';
    else if (!/^(no|false|0|לא)$/i.test(rv)) note(head.x_reveal, `ערך חשיפה "${rv}" לא מוכר (yes / tiles)`, 'info');
    if (base.reveal && !base.image) note(head.x_reveal, 'חשיפה הדרגתית צריכה תמונה', 'info');
  }
  const vRaw = get('x_video');
  if (vRaw) {
    const video = parseVideo(vRaw);
    if (video) base.video = video;
    else note(head.x_video, `"${vRaw}" לא נראה כמו קישור ליוטיוב`, 'warn');
  }

  const typeRaw = get('x_type').trim();
  const type = TYPE_NAMES[typeRaw.toLowerCase()] || (typeRaw ? null : 'quiz');
  if (type === null) note(head.x_type, `סוג שאלה "${typeRaw}" לא מוכר, יובא כרב-ברירה`, 'warn');
  if (pdfRef && type !== 'pdf') base.pdf = { file: pdfRef.alias, page: pdfRef.from }; // the page shown with the activity
  let special = null;
  const down = (col, why) => note(col, `${why}: יובא כרב-ברירה`, 'warn');
  // pictures for the answers, in the order of the answers (empty = no picture): a.png|b.png||d.png
  const ansImgRaw = get('x_ansimages');
  if (ansImgRaw) {
    ansImgRaw.split('|').forEach((f, i) => {
      const name = path.basename(f.trim().replace(/\\/g, '/')).toLowerCase();
      if (!name || !base.answers[i]) return;
      if (images.has(name)) base.answers[i].image = name;
      else note(head.x_ansimages, `תמונת תשובה "${f.trim()}" לא נמצאה ב-zip`, 'warn');
    });
  }
  const limit = Number(get('x_limit'));
  if (type === 'tf') {
    special = { ...base, type: 'tf', answers: base.answers.slice(0, 2) };
  } else if (type === 'poll' || type === 'multipoll') {
    special = { ...base, type: 'poll', multi: type === 'multipoll', points: 0, answers: base.answers.slice(0, 6).map((x) => ({ text: x.text, image: x.image })) };
  } else if (type === 'cloud' || type === 'open' || type === 'brain' || type === 'qna') {
    special = { ...base, type, points: 0, answers: undefined, limit: limit || undefined };
  } else if (type === 'match') {
    // Items: a=b|c=d|e=f (each item = its partner)
    const pairs = parts(get('x_items')).map((x) => x.split('=').map((y) => y.trim())).filter((x) => x.length === 2 && x[0] && x[1]).map(([a, b]) => ({ a, b }));
    if (pairs.length >= 2 && pairs.length <= 6) special = { ...base, type: 'match', pairs, time: Math.max(base.time, 30) };
    else down(head.x_items || head.x_type, `התאמה צריכה 2-6 זוגות בצורה א=ב מופרדים ב-| (קיבלנו ${pairs.length})`);
  } else if (type === 'sort') {
    // Items: Fruits:apple,banana|Vegetables:carrot,onion  (a category name, a colon, its items separated by commas)
    const buckets = parts(get('x_items')).map((x) => {
      const i = x.indexOf(':');
      return i > 0 ? { name: x.slice(0, i).trim(), items: x.slice(i + 1).split(',').map((y) => y.trim()).filter(Boolean) } : null;
    }).filter((b) => b && b.name && b.items.length);
    const total = buckets.reduce((n, b) => n + b.items.length, 0);
    if (buckets.length >= 2 && buckets.length <= 3 && total <= 8) special = { ...base, type: 'sort', buckets, time: Math.max(base.time, 30) };
    else down(head.x_items || head.x_type, `מיון צריך 2-3 קבוצות בצורה שם:פריט,פריט מופרדות ב-| ועד 8 פריטים (קיבלנו ${buckets.length} קבוצות, ${total} פריטים)`);
  } else if (type === 'rate') {
    // Scale: max|low label|high label, for example 5|not at all|very much
    const sc = get('x_scale').split('|').map((x) => x.trim());
    const max = Number(sc[0]) || 5;
    if (![5, 7, 10].includes(max)) note(head.x_scale || head.x_type, `סולם ${sc[0]} לא קיים (5, 7 או 10), נקבע 5`, 'info');
    special = { ...base, type: 'rate', points: 0, answers: undefined, scale: { max, low: sc[1] || '', high: sc[2] || '' } };
  } else if (type === 'rank') {
    const items = parts(get('x_items'));
    if (items.length >= 2 && items.length <= 6) special = { ...base, type: 'rank', points: 0, answers: undefined, items };
    else down(head.x_items || head.x_type, `דירוג פריטים צריך 2-6 פריטים מופרדים ב-| (קיבלנו ${items.length})`);
  } else if (type === 'drop') {
    if (!base.image) down(head.x_image || head.x_type, 'סיכה חופשית צריכה תמונה');
    else special = { ...base, type: 'drop', points: 0, answers: undefined };
  } else if (type === 'slide') {
    const layout = get('x_layout').toLowerCase();
    if (layout && !qt.LAYOUTS.includes(layout)) note(head.x_layout, `עיצוב שקופית "${layout}" לא מוכר (${qt.LAYOUTS.join(' / ')}), נקבע אוטומטית`, 'info');
    special = { ...base, type: 'slide', points: 0, body: get('x_body') || undefined, bullets: parts(get('x_bullets')), layout: qt.LAYOUTS.includes(layout) ? layout : undefined, timer: Number(get('x_timer')) || undefined, notes: get('x_notes') || undefined };
  } else if (type === 'pdf') {
    // one step per page, so activities can sit between the pages
    if (!pdfRef) note(head.x_pdf || head.x_type, 'שורת pdf בלי קובץ PDF תקין: השורה דולגה', 'skip');
    else special = Array.from({ length: pdfRef.to - pdfRef.from + 1 }, (_, k) => ({ type: 'pdf', text: k === 0 ? text || '' : '', time: base.time, points: 0, pdf: { file: pdfRef.alias, page: pdfRef.from + k }, notes: k === 0 ? get('x_notes') || undefined : undefined, timer: k === 0 ? Number(get('x_timer')) || undefined : undefined, source: base.source }));
  } else if (type === 'tap') {
    special = { ...base, type: 'tap', points: 0, answers: undefined };
  } else if (type === 'check') {
    // "did you understand?": a poll with three fixed answers
    special = { ...base, type: 'poll', points: 0, text: text || 'הבנתם?', answers: [{ text: 'הבנתי ✔' }, { text: 'בערך' }, { text: 'לא הבנתי' }] };
  } else if (type === 'type') {
    const accept = parts(get('x_accept'));
    if (!accept.length) base.answers.filter((x) => x.correct && x.text).forEach((x) => accept.push(x.text));
    if (accept.length) special = { ...base, type: 'type', accept, time: Math.max(base.time, 20) };
    else down(head.x_accept || head.x_type, 'לשאלת הקלדה חסרה תשובה (עמודת Accept)');
  } else if (type === 'slider') {
    const n = parts(get('x_slider')).map(Number);
    if (n.length >= 4 && n.every(Number.isFinite) && n[1] > n[0] && n[3] >= n[0] && n[3] <= n[1]) special = { ...base, type: 'slider', slider: { min: n[0], max: n[1], step: n[2] || 1, answer: n[3], tol: n[4] || 0 } };
    else down(head.x_slider || head.x_type, `סרגל צריך min|max|step|answer|tolerance (קיבלנו "${get('x_slider')}")`);
  } else if (type === 'order') {
    const items = parts(get('x_items'));
    if (items.length >= 2 && items.length <= 6) special = { ...base, type: 'order', items };
    else down(head.x_items || head.x_type, `סידור צריך 2-6 פריטים מופרדים ב-| (קיבלנו ${items.length})`);
  } else if (type === 'pin') {
    // several zones that all count: join them with +
    const zones = get('x_pin').split('+').map((z) => z.trim()).filter(Boolean);
    const dim = base.image && images.has(base.image) ? imageSize(images.get(base.image).buffer) : null;
    const ar = dim ? dim.w / dim.h : undefined;
    const list = zones.map((z) => parseZone(z, ar));
    if (!base.image) down(head.x_image || head.x_type, 'שאלת סימון צריכה תמונה');
    else if (list.length && list.every(Boolean)) special = { ...base, type: 'pin', pin: { ...list[0], ar, extra: list.slice(1) } };
    else down(head.x_pin || head.x_type, `סימון צריך x|y|radius (עיגול), x|y|width|height (מלבן), ellipse:x|y|width|height או poly:x,y;x,y;x,y באחוזים (קיבלנו "${get('x_pin')}")`);
  } else if (type === 'puzzle') {
    const m = get('x_puzzle').match(/^(\d)\s*[x×*]\s*(\d)$/i);
    if (!base.image) down(head.x_image || head.x_type, 'פאזל צריך תמונה');
    else special = { ...base, type: 'puzzle', puzzle: m ? { rows: +m[1], cols: +m[2] } : { rows: 3, cols: 3 }, time: Math.max(base.time, 30) };
    if (base.image && get('x_puzzle') && !m) note(head.x_puzzle, `גודל פאזל "${get('x_puzzle')}" לא תקין (למשל 3x3), נקבע 3x3`, 'info');
  }
  return special || base;
}

// Reads Kahoot's "quiz template" (and our own copy of it with the extra columns): finds the header row
// (Question / Answer 1-4 / Time limit / Correct answer(s)) and reads the rows under it.
// images: Map(lowercase file name → { buffer, mime }) from a zip, for the Image column.
// The result lists every problem by row and column, so the teacher can fix the file.
async function importXlsx(buffer, title, images = new Map(), pdfs = new Map()) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const questions = [];
  const issues = [];
  const stats = { skipped: 0, downgraded: 0, missingImages: 0, special: 0 };
  // PDF page counts first (reading rows is synchronous)
  const pdfPages = new Map();
  for (const p of pdfs.values()) pdfPages.set(p.alias, await require('./pdfinfo').pageCount(p.buffer));
  const ctx = { pdfs, pdfPages };
  for (const ws of wb.worksheets) {
    let head = null;
    ws.eachRow((row, rn) => {
      const cells = [];
      row.eachCell({ includeEmpty: true }, (c, cn) => (cells[cn] = cellText(c).trim()));
      if (!head) {
        const cols = {};
        cells.forEach((t, cn) => {
          if (!t) return;
          const x = t.match(EXTRA_COLS);
          const a = t.match(/answer\s*(\d)|תשובה\s*(\d)/i);
          if (x) cols['x_' + x[1].toLowerCase()] = cn;
          else if (a) cols['a' + (a[1] || a[2])] = cn;
          else if (/^(question|שאלה)/i.test(t)) cols.q = cn;
          else if (/time|זמן/i.test(t)) cols.time = cn;
          else if (/correct|נכונ/i.test(t)) cols.correct = cn;
        });
        if (cols.q && cols.a1 && cols.a2) head = { ...cols, row: rn };
        return;
      }
      const text = cells[head.q];
      // a row can be a slide or a PDF page with no question text at all
      const typeCell = head.x_type ? String(cells[head.x_type] || '').trim().toLowerCase() : '';
      const hasContent = text || ['x_pdf', 'x_image', 'x_bullets', 'x_body'].some((k) => head[k] && cells[head[k]]) || /^(check|understood|הבנתם|בדיקת הבנה)$/.test(typeCell);
      if (!hasContent) {
        if (cells.some(Boolean)) issues.push({ row: rn, col: colLetter(head.q), reason: 'שורה בלי טקסט שאלה: דולגה', level: 'skip' });
        return;
      }
      const rowIssues = [];
      const note = (col, reason, level) => rowIssues.push({ row: rn, col: colLetter(col), reason, level });
      const raws = [].concat(rowToRaw(cells, head, images, note, ctx));
      let rowOk = false;
      for (const raw of raws) {
        const q = qt.normalize(raw);
        if (q.text.length > 120 && q.type !== 'slide' && q.type !== 'pdf') note(head.q, `שאלה ארוכה (${q.text.length} תווים): קשה לקרוא בטלפון. Kahoot מגביל ל-120`, 'info');
        if (!qt.shown(q)) {
          if (q.type === 'pdf' || q.type === 'slide') continue;
          const filled = q.answers ? q.answers.filter((x) => x.text).length : 0;
          const why = q.type === 'quiz' && filled < 2 ? 'צריך לפחות 2 תשובות' : q.type === 'quiz' ? 'לא סומנה תשובה נכונה (עמודת Correct answer)' : 'השאלה לא שלמה';
          issues.push({ row: rn, col: colLetter(q.type === 'quiz' && filled >= 2 ? head.correct : head.a1), reason: `${why}: השורה דולגה`, level: 'skip' });
          continue;
        }
        rowOk = true;
        if (q.type !== 'quiz') stats.special++;
        questions.push(q);
      }
      issues.push(...rowIssues);
      if (!rowOk) {
        stats.skipped++;
        return;
      }
      if (rowIssues.some((x) => x.reason.includes('יובא כרב-ברירה'))) stats.downgraded++;
      if (rowIssues.some((x) => x.reason.startsWith('התמונה'))) stats.missingImages++;
    });
    if (head) break;
  }
  if (!questions.length) {
    const e = new Error(issues.length ? `אף שורה לא יובאה (${issues.length} בעיות). ${issues.slice(0, 3).map((x) => `שורה ${x.row}: ${x.reason}`).join(' · ')}` : 'לא נמצאו שאלות בקובץ. ודאו שזו תבנית Kahoot (עמודות Question, Answer 1-4, Time limit, Correct answer)');
    e.issues = issues;
    throw e;
  }
  const id = newId(title || 'חידון מיובא');
  // copy each used picture into the quiz's media folder once
  const stored = new Map();
  const keep = (o, key) => {
    if (!o[key]) return;
    if (!stored.has(o[key])) {
      const img = images.get(o[key]);
      stored.set(o[key], img ? saveMedia(id, img.buffer, img.mime) : null);
    }
    if (stored.get(o[key])) o[key] = stored.get(o[key]);
    else delete o[key];
  };
  // the PDFs: each stored once, the steps point at the stored name
  const storedPdf = new Map();
  for (const q of questions) {
    keep(q, 'image');
    keep(q, 'explainImage');
    for (const a of q.answers || []) keep(a, 'image');
    if (q.pdf) {
      if (!storedPdf.has(q.pdf.file)) {
        const p = [...pdfs.values()].find((x) => x.alias === q.pdf.file);
        storedPdf.set(q.pdf.file, p ? saveMedia(id, p.buffer, 'application/pdf') : null);
      }
      if (storedPdf.get(q.pdf.file)) q.pdf.file = storedPdf.get(q.pdf.file);
      else delete q.pdf;
    }
  }
  save(id, { title: title || 'חידון מיובא', questions });
  return { id, count: questions.length, images: [...stored.values()].filter(Boolean).length, pdfs: [...storedPdf.values()].filter(Boolean).length, slides: questions.filter((q) => q.type === 'slide' || q.type === 'pdf').length, issues: issues.slice(0, 300), ...stats };
}

// .xlsx, or a .zip with the .xlsx and the pictures its Image column names (any folder inside the zip)
async function importAny(buffer, title) {
  const JSZip = require('jszip');
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('הקובץ אינו xlsx או zip תקין');
  }
  if (zip.file('xl/workbook.xml')) return importXlsx(buffer, title);
  const entries = Object.values(zip.files).filter((f) => !f.dir && !/(^|\/)(__MACOSX\/|\.|~\$)/.test(f.name));
  const xlsx = entries.filter((f) => /\.xlsx$/i.test(f.name)).sort((a, b) => a.name.length - b.name.length)[0];
  if (!xlsx) throw new Error('בקובץ ה-zip לא נמצא קובץ xlsx');
  const images = new Map();
  for (const f of entries.filter((f) => IMG_EXT[path.extname(f.name).toLowerCase()]).slice(0, 300)) {
    const buf = await f.async('nodebuffer');
    if (buf.length && buf.length <= 12 * 1024 * 1024) images.set(path.basename(f.name).toLowerCase(), { buffer: buf, mime: IMG_EXT[path.extname(f.name).toLowerCase()] });
  }
  // PDFs next to the sheet (the Pdf column names them); each gets a safe name inside the program
  const pdfs = new Map();
  let nPdf = 0;
  for (const f of entries.filter((f) => /\.pdf$/i.test(f.name)).slice(0, 12)) {
    const buf = await f.async('nodebuffer');
    if (buf.length && buf.length <= 80 * 1024 * 1024 && buf.slice(0, 4).toString('latin1') === '%PDF') pdfs.set(path.basename(f.name).toLowerCase(), { buffer: buf, alias: `deck${++nPdf}.pdf` });
  }
  const t = title || path.basename(xlsx.name).replace(/\.xlsx$/i, '');
  return importXlsx(await xlsx.async('nodebuffer'), t, images, pdfs);
}

// flashcards as CSV for Anki / Quizlet style import: Front, Back, Explanation (UTF-8 with a BOM so Excel reads Hebrew)
function cardsCsv(id) {
  const q = load(id);
  const cell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  const rows = [['Front', 'Back', 'Explanation']];
  for (const x of q.questions) {
    if (!qt.SCORED.has(x.type) || !x.text) continue;
    const back = qt.correctText(x);
    if (back) rows.push([x.text, back, x.explain || '']);
  }
  return '\ufeff' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

// a blank template (or a quiz exported) in the same layout as Kahoot's
async function templateXlsx(id) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Quiz', { views: [{ rightToLeft: true }] });
  ws.columns = [{ width: 6 }, { width: 50 }, { width: 26 }, { width: 26 }, { width: 26 }, { width: 26 }, { width: 16 }, { width: 20 }, { width: 10 }, { width: 8 }, { width: 18 }, { width: 28 }, { width: 9 }, { width: 24 }, { width: 22 }, { width: 24 }, { width: 14 }, { width: 9 }, { width: 30 }, { width: 16 }, { width: 26 }, { width: 8 }, { width: 30 }, { width: 28 }, { width: 12 }, { width: 40 }, { width: 22 }, { width: 8 }, { width: 24 }, { width: 34 }];
  ws.addRow(['', 'תבנית חידון (תואמת לתבנית של Kahoot)']).font = { bold: true, size: 16 };
  ws.addRow(['', 'מלאו שאלה בכל שורה. זמן: 5/10/20/30/60/90/120/240 שניות. תשובה נכונה: מספר התשובה (למשל 2, או 1,3 לכמה תשובות). העמודות אחרי "Correct answer" (I ואילך) אופציונליות: Kahoot מתעלם מהן והתוכנית שלנו קוראת אותן.']);
  ws.addRow([]);
  const head = ws.addRow(['#', 'Question - שאלה', 'Answer 1 - תשובה 1', 'Answer 2 - תשובה 2', 'Answer 3 - תשובה 3', 'Answer 4 - תשובה 4', 'Time limit (sec) - זמן', 'Correct answer(s) - נכונות', 'Type', 'Points', 'Image', 'Video', 'Reveal', 'Accept', 'Slider', 'Items', 'Pin', 'Puzzle', 'Explanation', 'AfterImage', 'AnsImages', 'Limit', 'Body', 'Scale', 'Layout', 'Bullets', 'Pdf', 'Timer', 'Notes', 'Source']);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.eachCell((c, cn) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cn > 8 ? 'FF1E7B4F' : 'FF46178F' } }));
  // extras: Type, Points, Image, Video, Reveal, Accept, Slider, Items, Pin, Puzzle (type "puzzle" is not played yet)
  let rows = [
    ['מהי בירת ישראל?', 'תל אביב', 'ירושלים', 'חיפה', 'אילת', 20, '2', 'quiz', 1],
    ['מהי בירת צרפת? (הקלידו את התשובה)', 'פריז', 'ליון', 'מרסיי', 'ניס', 30, '1', 'type', 1, '', '', '', 'פריז|paris'],
    ['באיזו שנה קמה מדינת ישראל?', '1938', '1948', '1958', '1968', 30, '2', 'slider', 1, '', '', '', '', '1900|2000|1|1948|0'],
    ['סדרו מהקטן לגדול. מי הראשון?', 'עכבר', 'חתול', 'כלב', 'סוס', 30, '1', 'order', 1, '', '', '', '', '', '', 'עכבר|חתול|כלב|סוס'],
    ['הלב נמצא בחזה', 'נכון', 'לא נכון', '', '', 10, '1', 'tf'],
  ];
  if (id) {
    const q = load(id);
    rows = q.questions.filter((x) => x.type === 'quiz' || x.type === 'tf').map((x) => {
      const ans = x.answers.slice(0, 4).map((a) => a.text);
      while (ans.length < 4) ans.push('');
      return [x.text, ...ans, x.time, x.answers.slice(0, 4).map((a, i) => (a.correct ? i + 1 : 0)).filter(Boolean).join(','), x.type, x.points, '', x.video ? `https://youtu.be/${x.video.id}` : '', x.reveal ? 'yes' : ''];
    });
  }
  rows.forEach((r, i) => ws.addRow([i + 1, ...r]));
  return wb.xlsx.writeBuffer();
}

module.exports = { cardsCsv, cleanSource, SAMPLE_ID, folder, setFolder, list, load, save, create, duplicate, remove, mediaDir, saveMedia, mediaPath, questionsFor, importXlsx, importAny, templateXlsx, validId, newId, cleanFolder, fileOf, IMG_EXT, imageSize };
