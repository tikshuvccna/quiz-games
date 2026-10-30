// Class rosters (a named list of student names, kept in <library>/.library/classes.json) and the progress of a class
// across games, worked out from the game reports (reports/*.json, one per finished room that had the class chosen).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
  for (const r of mine) {
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
  const rows = [...people.values()].map((s) => ({ ...s, accuracy: s.answered ? Math.round((s.correct / s.answered) * 100) : null, trend: s.trend.slice(-8) }));
  rows.sort((a, b) => Number(b.inClass) - Number(a.inClass) || a.name.localeCompare(b.name, 'he'));
  const hardest = [...questions.values()]
    .filter((e) => e.n >= 3)
    .map((e) => ({ ...e, accuracy: Math.round((e.ok / e.n) * 100) }))
    .sort((a, b) => a.accuracy - b.accuracy || b.n - a.n)
    .slice(0, 10);
  const answered = rows.reduce((n, s) => n + s.answered, 0);
  const correct = rows.reduce((n, s) => n + s.correct, 0);
  return { class: { id: cls.id, name: cls.name, students: cls.students }, sessions: sessions.reverse(), students: rows, hardest, accuracy: answered ? Math.round((correct / answered) * 100) : null, answered };
}

module.exports = { list, get, save, remove, progress, students, roster: (c) => (c ? c.students : []) };
