// Class rosters (a named list of student names, kept in <library>/.library/classes.json) and the progress of a class
// across games, worked out from the game reports (reports/*.json, one per finished room that had the class chosen).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const Q = require('./quizzes');

const REPORTS_DIR = () => process.env.REPORTS_DIR || path.join(__dirname, '..', 'reports');
const MAX_STUDENTS = 60;

const file = () => {
  const dir = path.join(Q.folder(), '.library');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'classes.json');
};
function read() {
  try {
    const d = JSON.parse(fs.readFileSync(file(), 'utf8'));
    return Array.isArray(d.classes) ? d.classes : [];
  } catch {
    return [];
  }
}
const write = (list) => fs.writeFileSync(file(), JSON.stringify({ classes: list }, null, 2));

const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f​-‏‪-‮]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);

// a student list from an array or from text with one name per line (or separated by commas)
function students(raw) {
  const list = Array.isArray(raw) ? raw : String(raw || '').split(/[\n,;]+/);
  const seen = new Set();
  const out = [];
  for (const x of list) {
    const n = cleanName(x);
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
  }
  return out.slice(0, MAX_STUDENTS);
}

const list = () => read().map((c) => ({ id: c.id, name: c.name, count: c.students.length }));
const get = (id) => read().find((c) => c.id === id) || null;

function save(data) {
  const name = String((data && data.name) || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 30);
  if (!name) throw new Error('צריך שם לכיתה');
  const all = read();
  let c = data.id ? all.find((x) => x.id === data.id) : null;
  if (!c) {
    c = { id: crypto.randomBytes(4).toString('hex') };
    all.push(c);
  }
  c.name = name;
  c.students = students(data.students);
  write(all);
  return c;
}

// a private note about a student (the teacher's, like Classroom's private comments); empty text removes it
function setNote(id, name, text) {
  const all = read();
  const c = all.find((x) => x.id === id);
  if (!c) throw new Error('הכיתה לא נמצאה');
  const n = cleanName(name);
  if (!n) throw new Error('שם לא תקין');
  c.notes = c.notes || {};
  const t = String(text || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, 500);
  if (t) c.notes[n] = t;
  else delete c.notes[n];
  write(all);
  return { name: n, note: t };
}

// ---------- a class list from a file: .xlsx, or .csv / .txt (also what Classroom and school systems export) ----------
const NAME_HEAD = /^(name|full name|student|student name|שם|שם מלא|שם התלמיד|שם התלמידה|תלמיד|תלמידה)$/i;
const FIRST_HEAD = /^(first name|first|given name|שם פרטי|פרטי)$/i;
const LAST_HEAD = /^(last name|last|surname|family name|שם משפחה|משפחה)$/i;

function splitCsv(line) {
  const out = [];
  let cur = '';
  let q = false;
  const sep = /\t/.test(line) ? '\t' : /;/.test(line) && !/,/.test(line) ? ';' : ',';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

async function parseNames(buffer, filename) {
  let rows = [];
  const isXlsx = /\.xlsx$/i.test(String(filename || '')) || (buffer[0] === 0x50 && buffer[1] === 0x4b);
  if (isXlsx) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (ws) ws.eachRow((row) => rows.push(row.values.slice(1).map((v) => (v && typeof v === 'object' ? (v.text || v.result || (v.richText ? v.richText.map((r) => r.text).join('') : '')) : v == null ? '' : v)).map((v) => String(v).trim())));
  } else {
    rows = buffer.toString('utf8').replace(/^\ufeff/, '').split(/\r?\n/).filter((l) => l.trim()).map(splitCsv);
  }
  rows = rows.filter((r) => r.some(Boolean));
  if (!rows.length) return { students: [], note: 'הקובץ ריק' };
  // a header row names the columns
  const head = rows.findIndex((r) => r.some((c) => NAME_HEAD.test(c) || FIRST_HEAD.test(c)));
  let list = [];
  let note = '';
  if (head >= 0) {
    const h = rows[head];
    const fi = h.findIndex((c) => FIRST_HEAD.test(c));
    const li = h.findIndex((c) => LAST_HEAD.test(c));
    const ni = h.findIndex((c) => NAME_HEAD.test(c));
    const body = rows.slice(head + 1);
    if (fi >= 0) {
      // first name; when two students share a first name, the last initial tells them apart
      const firsts = body.map((r) => r[fi]).filter(Boolean);
      const count = new Map();
      firsts.forEach((f) => count.set(f.toLowerCase(), (count.get(f.toLowerCase()) || 0) + 1));
      list = body.filter((r) => r[fi]).map((r) => (count.get(r[fi].toLowerCase()) > 1 && li >= 0 && r[li] ? `${r[fi]} ${r[li].slice(0, 1)}` : r[fi]));
      note = 'נלקחו שמות פרטיים (עם ראשי תיבות של שם המשפחה כשיש שמות זהים)';
    } else if (ni >= 0) list = body.map((r) => r[ni]).filter(Boolean);
  }
  if (!list.length) list = rows.map((r) => r.find(Boolean)).filter(Boolean);
  // a long full name ("דנה כהן לוי") is shortened to the first name and the last initial: it must fit on a phone button
  list = list.map((n) => {
    const t = String(n).replace(/\s+/g, ' ').trim();
    if (t.length <= 14) return t;
    const p = t.split(' ');
    return p.length > 1 ? `${p[0]} ${p[p.length - 1].slice(0, 1)}` : t;
  });
  return { students: students(list), note };
}

function remove(id) {
  write(read().filter((c) => c.id !== id));
}

// ---------- progress ----------
function reports() {
  const dir = REPORTS_DIR();
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  } catch {}
  const out = [];
  for (const f of files) {
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
    } catch {}
  }
  return out;
}

// how a class is doing over all the games it played: per student, per game and the hardest questions
function progress(id) {
  const cls = get(id);
  if (!cls) throw new Error('הכיתה לא נמצאה');
  // oldest first by the time the game was created (the file names only have minutes)
  const mine = reports().filter((r) => r.classId === id).sort((a, b) => String(a.created).localeCompare(String(b.created)));
  const roster = new Map(cls.students.map((n) => [n.toLowerCase(), n]));
  const people = new Map(cls.students.map((n) => [n.toLowerCase(), { name: n, inClass: true, sessions: 0, answered: 0, correct: 0, trend: [], last: null }]));
  const questions = new Map();
  const sessions = [];
  const perGame = []; // per game: student -> accuracy (for the gradebook)
  for (const r of mine) {
    const acc = new Map();
    perGame.push(acc);
    let ans = 0;
    let right = 0;
    for (const p of r.players || []) {
      const key = String(p.name).toLowerCase();
      let s = people.get(key);
      if (!s) people.set(key, (s = { name: p.name, inClass: false, sessions: 0, answered: 0, correct: 0, trend: [], last: null }));
      const a = (p.answers || []).filter((x) => typeof x.ok === 'boolean');
      s.sessions++;
      s.answered += a.length;
      const ok = a.filter((x) => x.ok).length;
      s.correct += ok;
      if (a.length) s.trend.push(Math.round((ok / a.length) * 100));
      s.last = r.created;
      acc.set(key, a.length ? Math.round((ok / a.length) * 100) : null);
      ans += a.length;
      right += ok;
      for (const x of a) {
        const k = String(x.q);
        const e = questions.get(k) || { q: k, type: x.type, n: 0, ok: 0 };
        e.n++;
        if (x.ok) e.ok++;
        questions.set(k, e);
      }
    }
    sessions.push({ at: r.created, game: (r.rounds && r.rounds[0] && r.rounds[0].game) || '', quiz: r.quiz || '', players: (r.players || []).length, accuracy: ans ? Math.round((right / ans) * 100) : null });
  }
  const notes = cls.notes || {};
  const rows = [...people.values()].map((s) => ({ ...s, note: notes[s.name] || '', accuracy: s.answered ? Math.round((s.correct / s.answered) * 100) : null, trend: s.trend.slice(-8) }));
  rows.sort((a, b) => Number(b.inClass) - Number(a.inClass) || a.name.localeCompare(b.name, 'he'));
  const hardest = [...questions.values()]
    .filter((e) => e.n >= 3)
    .map((e) => ({ ...e, accuracy: Math.round((e.ok / e.n) * 100) }))
    .sort((a, b) => a.accuracy - b.accuracy || b.n - a.n)
    .slice(0, 10);
  const answered = rows.reduce((n, s) => n + s.answered, 0);
  const correct = rows.reduce((n, s) => n + s.correct, 0);
  // the gradebook: one column per game (oldest first), one row per student
  const grades = { columns: sessions.map((s) => ({ at: s.at, label: s.quiz || s.game })), rows: rows.map((s) => ({ name: s.name, values: perGame.map((m) => (m.has(s.name.toLowerCase()) ? m.get(s.name.toLowerCase()) : null)) })) };
  return { class: { id: cls.id, name: cls.name, students: cls.students }, grades, sessions: sessions.reverse(), students: rows, hardest, accuracy: answered ? Math.round((correct / answered) * 100) : null, answered };
}

module.exports = { setNote, parseNames, list, get, save, remove, progress, students, roster: (c) => (c ? c.students : []) };
