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
const IMAGE_TYPES = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg' };

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

function folder() {
  const f = readConfig().folder || DEFAULT_FOLDER;
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

function clean(data) {
  return {
    title: String((data && data.title) || 'חידון ללא שם').slice(0, 80),
    description: String((data && data.description) || '').slice(0, 300),
    updated: new Date().toISOString(),
    questions: (Array.isArray(data && data.questions) ? data.questions : []).slice(0, 200).map(qt.normalize).filter(Boolean),
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
      out.push({ id, title: q.title, count: q.questions.length, playable: q.questions.filter(qt.playable).length, updated: q.updated, cover: (q.questions.find((x) => x.image) || {}).image || null });
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
  const q = clean(data);
  const tmp = fileOf(id) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(q, null, 2));
  fs.renameSync(tmp, fileOf(id));
  return { id, ...q };
}

function create(title, questions = []) {
  const id = newId(title);
  return save(id, { title: title || 'חידון חדש', questions });
}

function duplicate(id) {
  const q = load(id);
  const copy = create(`${q.title} (עותק)`, q.questions);
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
  const ext = IMAGE_TYPES[mime];
  if (!ext) throw new Error('סוג קובץ לא נתמך (PNG, JPG, GIF, WEBP, SVG)');
  if (!buffer || !buffer.length) throw new Error('קובץ ריק');
  const name = `${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(mediaDir(id), name), buffer);
  return name;
}

function mediaPath(id, file) {
  const name = path.basename(String(file || ''));
  if (!validId(id) || !/^[\w.-]+\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return null;
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
  const ok = (x) => qt.playable(x) || (opts.all && ((x.type === 'poll' && x.answers.filter((a) => a.text).length >= 2) || (x.type === 'slide' && (x.text || x.image))));
  let qs = q.questions.filter(ok);
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

// Reads Kahoot's "quiz template" (and our own copy of it): finds the header row
// (Question / Answer 1-4 / Time limit / Correct answer(s)) and reads the rows under it.
async function importXlsx(buffer, title) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const questions = [];
  let skipped = 0;
  for (const ws of wb.worksheets) {
    let head = null;
    ws.eachRow((row, rn) => {
      const cells = [];
      row.eachCell({ includeEmpty: true }, (c, cn) => (cells[cn] = cellText(c).trim()));
      if (!head) {
        const cols = {};
        cells.forEach((t, cn) => {
          if (!t) return;
          const a = t.match(/answer\s*(\d)|תשובה\s*(\d)/i);
          if (a) cols['a' + (a[1] || a[2])] = cn;
          else if (/^(question|שאלה)/i.test(t)) cols.q = cn;
          else if (/time|זמן/i.test(t)) cols.time = cn;
          else if (/correct|נכונ/i.test(t)) cols.correct = cn;
        });
        if (cols.q && cols.a1 && cols.a2) head = { ...cols, row: rn };
        return;
      }
      const text = cells[head.q];
      if (!text) return;
      const answers = [1, 2, 3, 4, 5, 6].filter((k) => head['a' + k]).map((k) => cells[head['a' + k]] || '');
      const correct = String(cells[head.correct] || '').split(/[^\d]+/).map(Number).filter((n) => n >= 1 && n <= answers.length);
      const q = qt.normalize({
        type: 'quiz',
        text,
        time: NEAREST_TIME(Number(cells[head.time]) || 20),
        answers: answers.map((t, i) => ({ text: t, correct: correct.includes(i + 1) })),
      });
      if (qt.playable(q)) questions.push(q);
      else skipped++;
    });
    if (head) break;
  }
  if (!questions.length) throw new Error('לא נמצאו שאלות בקובץ. ודאו שזו תבנית Kahoot (עמודות Question, Answer 1-4, Time limit, Correct answer)');
  const quiz = create(title || 'חידון מיובא', questions);
  return { id: quiz.id, count: questions.length, skipped };
}

// a blank template (or a quiz exported) in the same layout as Kahoot's
async function templateXlsx(id) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Quiz', { views: [{ rightToLeft: true }] });
  ws.columns = [{ width: 6 }, { width: 50 }, { width: 26 }, { width: 26 }, { width: 26 }, { width: 26 }, { width: 16 }, { width: 20 }];
  ws.addRow(['', 'תבנית חידון (תואמת לתבנית של Kahoot)']).font = { bold: true, size: 16 };
  ws.addRow(['', 'מלאו שאלה בכל שורה. זמן: 5/10/20/30/60/90/120/240 שניות. תשובה נכונה: מספר התשובה (למשל 2, או 1,3 לכמה תשובות).']);
  ws.addRow([]);
  const head = ws.addRow(['#', 'Question - שאלה', 'Answer 1 - תשובה 1', 'Answer 2 - תשובה 2', 'Answer 3 - תשובה 3', 'Answer 4 - תשובה 4', 'Time limit (sec) - זמן', 'Correct answer(s) - נכונות']);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF46178F' } }));
  let rows = [['מהי בירת ישראל?', 'תל אביב', 'ירושלים', 'חיפה', 'אילת', 20, '2']];
  if (id) {
    const q = load(id);
    rows = q.questions.filter((x) => x.type === 'quiz' || x.type === 'tf').map((x) => {
      const ans = x.answers.slice(0, 4).map((a) => a.text);
      while (ans.length < 4) ans.push('');
      return [x.text, ...ans, x.time, x.answers.slice(0, 4).map((a, i) => (a.correct ? i + 1 : 0)).filter(Boolean).join(',')];
    });
  }
  rows.forEach((r, i) => ws.addRow([i + 1, ...r]));
  return wb.xlsx.writeBuffer();
}

module.exports = { SAMPLE_ID, folder, setFolder, list, load, save, create, duplicate, remove, mediaDir, saveMedia, mediaPath, questionsFor, importXlsx, templateXlsx, validId };
