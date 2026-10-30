// Library organisation and sharing: folders, quiz/folder packages (.qgz = zip with the quiz JSON and its
// pictures/videos), and share links that let another teacher view or copy a quiz or a whole folder.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');
const Q = require('./quizzes');
const Kahoot = require('./importers/kahoot');

const APP = 'quiz-games';
const PKG_VERSION = 1;

// ---------- folders ----------
// Folders exist when a quiz is in them or when they were created empty (kept in folders.json).
// library bookkeeping lives in <library>/.library/ so it is never mistaken for a quiz
const metaFile = (name) => {
  const dir = path.join(Q.folder(), '.library');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, name);
};
const registryFile = () => metaFile('folders.json');
function readRegistry() {
  try {
    const r = JSON.parse(fs.readFileSync(registryFile(), 'utf8'));
    return Array.isArray(r.folders) ? r.folders.map(Q.cleanFolder).filter(Boolean) : [];
  } catch {
    return [];
  }
}
function writeRegistry(list) {
  fs.writeFileSync(registryFile(), JSON.stringify({ folders: [...new Set(list)].sort((a, b) => a.localeCompare(b, 'he')) }, null, 2));
}
// every folder and its parents
const withParents = (p) => p.split('/').map((_, i, a) => a.slice(0, i + 1).join('/'));

function folders() {
  const set = new Set();
  for (const f of readRegistry()) withParents(f).forEach((x) => set.add(x));
  for (const q of Q.list()) if (q.folder) withParents(q.folder).forEach((x) => set.add(x));
  const counts = {};
  for (const q of Q.list()) if (!q.builtin) counts[q.folder || ''] = (counts[q.folder || ''] || 0) + 1;
  return [...set].sort((a, b) => a.localeCompare(b, 'he')).map((p) => ({ path: p, name: p.split('/').pop(), depth: p.split('/').length - 1, count: counts[p] || 0 }));
}

function createFolder(p) {
  const f = Q.cleanFolder(p);
  if (!f) throw new Error('שם תיקייה לא תקין');
  writeRegistry([...readRegistry(), f]);
  return { path: f };
}

const inside = (p, root) => p === root || p.startsWith(root + '/');

// rename / move a folder: every quiz and sub folder under it follows
function renameFolder(from, to) {
  const a = Q.cleanFolder(from);
  const b = Q.cleanFolder(to);
  if (!a || !b) throw new Error('שם תיקייה לא תקין');
  if (inside(b, a) && a !== b) throw new Error('אי אפשר להעביר תיקייה לתוך עצמה');
  const move = (p) => (inside(p, a) ? b + p.slice(a.length) : p);
  for (const q of Q.list()) if (!q.builtin && q.folder && inside(q.folder, a)) setQuizFolder(q.id, move(q.folder));
  writeRegistry(readRegistry().map(move));
  return { path: b };
}

// delete a folder: its quizzes move up to the parent folder (or to the trash with withQuizzes)
function deleteFolder(p, withQuizzes) {
  const a = Q.cleanFolder(p);
  if (!a) throw new Error('תיקייה לא תקינה');
  const parent = a.split('/').slice(0, -1).join('/');
  let moved = 0;
  for (const q of Q.list()) {
    if (q.builtin || !q.folder || !inside(q.folder, a)) continue;
    if (withQuizzes) Q.remove(q.id);
    else setQuizFolder(q.id, parent);
    moved++;
  }
  writeRegistry(readRegistry().filter((f) => !inside(f, a)));
  return { moved, parent };
}

function setQuizFolder(id, folderPath) {
  const q = Q.load(id);
  if (q.builtin) throw new Error('אי אפשר להעביר את החידון המובנה');
  const f = Q.cleanFolder(folderPath);
  Q.save(id, { ...q, folder: f });
  if (f) writeRegistry([...readRegistry(), f]);
  return { id, folder: f };
}

// ---------- packages ----------
async function addQuiz(zip, prefix, id) {
  const q = Q.load(id);
  const { id: _id, updated, builtin, ...data } = q;
  zip.file(prefix + 'quiz.json', JSON.stringify(data, null, 2));
  const dir = Q.mediaDir(id, false);
  if (dir && fs.existsSync(dir)) {
    const used = new Set();
    for (const x of q.questions) {
      if (x.image) used.add(x.image);
      if (x.video && x.video.file) used.add(x.video.file);
      if (x.explainImage) used.add(x.explainImage);
      for (const a of x.answers || []) if (a.image) used.add(a.image);
      if (x.pdf && x.pdf.file) used.add(x.pdf.file);
    }
    for (const f of fs.readdirSync(dir)) if (used.has(f)) zip.file(prefix + 'media/' + f, fs.readFileSync(path.join(dir, f)));
  }
  return q;
}

async function packageQuiz(id) {
  const zip = new JSZip();
  const q = await addQuiz(zip, '', id);
  zip.file('manifest.json', JSON.stringify({ app: APP, version: PKG_VERSION, kind: 'quiz', title: q.title, created: new Date().toISOString() }, null, 2));
  return { name: q.title, buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) };
}

async function packageFolder(p) {
  const root = Q.cleanFolder(p);
  if (!root) throw new Error('תיקייה לא תקינה');
  const zip = new JSZip();
  const items = [];
  let n = 0;
  for (const q of Q.list()) {
    if (q.builtin || !q.folder || !inside(q.folder, root)) continue;
    const prefix = `quizzes/${++n}/`;
    await addQuiz(zip, prefix, q.id);
    // the folder inside the package is relative to the shared folder
    items.push({ dir: prefix, folder: q.folder.slice(root.length).replace(/^\//, '') });
  }
  const sub = readRegistry().filter((f) => inside(f, root) && f !== root).map((f) => f.slice(root.length + 1));
  const name = root.split('/').pop();
  zip.file('manifest.json', JSON.stringify({ app: APP, version: PKG_VERSION, kind: 'folder', title: name, items, folders: sub, created: new Date().toISOString() }, null, 2));
  return { name, buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }), count: items.length };
}

// a quiz from inside a package: new id, the same media file names (the questions keep pointing at them)
async function unpackQuiz(zip, prefix, folderPath) {
  const f = zip.file(prefix + 'quiz.json');
  if (!f) return null;
  const data = JSON.parse(await f.async('string'));
  const q = Q.create(data.title, [], folderPath);
  const dir = Q.mediaDir(q.id);
  for (const m of Object.values(zip.files)) {
    if (m.dir || !m.name.startsWith(prefix + 'media/')) continue;
    const base = path.basename(m.name);
    if (!/^[\w.-]+\.(png|jpe?g|gif|webp|svg|mp4|webm|m4v|mov|ogv|pdf)$/i.test(base)) continue;
    fs.writeFileSync(path.join(dir, base), await m.async('nodebuffer'));
  }
  Q.save(q.id, { ...data, folder: folderPath });
  return Q.load(q.id);
}

// .qgz / .zip made by packageQuiz / packageFolder; target = the library folder to put it in
async function importPackage(zip, target = '') {
  const man = JSON.parse(await zip.file('manifest.json').async('string'));
  if (man.app !== APP) throw new Error('זה לא קובץ של פיצוץ מוחות');
  const base = Q.cleanFolder(target);
  if (man.kind === 'quiz') {
    const q = await unpackQuiz(zip, '', base);
    return { kind: 'quiz', id: q.id, title: q.title, count: q.questions.length, folder: base };
  }
  if (man.kind === 'folder') {
    // a folder with the same name gets a number, so nothing is overwritten
    const names = new Set(folders().map((f) => f.path));
    let root = Q.cleanFolder((base ? base + '/' : '') + (man.title || 'תיקייה משותפת'));
    for (let i = 2; names.has(root); i++) root = Q.cleanFolder((base ? base + '/' : '') + `${man.title} (${i})`);
    createFolder(root);
    for (const sub of man.folders || []) createFolder(root + '/' + sub);
    let count = 0;
    let first = null;
    for (const it of man.items || []) {
      const q = await unpackQuiz(zip, it.dir, Q.cleanFolder(root + (it.folder ? '/' + it.folder : '')));
      if (q) {
        count++;
        first = first || q.id;
      }
    }
    return { kind: 'folder', folder: root, count, id: first };
  }
  throw new Error('סוג חבילה לא מוכר');
}

// ---------- Kahoot quizzes (from the browser extension, or the raw JSON of one quiz) ----------
const jsonOf = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};
// → the Kahoot quizzes inside whatever JSON this is (one quiz, a list, or { quizzes: [...] })
function kahootList(j) {
  const list = Array.isArray(j) ? j : j && Array.isArray(j.quizzes) ? j.quizzes : j && Array.isArray(j.questions) ? [j] : [];
  return list.filter((k) => k && Array.isArray(k.questions));
}

// list = Kahoot quiz JSONs; images = Map(lowercase picture id → { buffer, mime })
function importKahoot(list, images, target = '', title = '') {
  if (!list.length) throw new Error('לא נמצאו חידוני Kahoot בקובץ');
  const base = Q.cleanFolder(target);
  let folder = base;
  if (list.length > 1) {
    // several quizzes go into their own folder, so nothing is mixed with the rest of the library
    const names = new Set(folders().map((f) => f.path));
    const name = 'Kahoot';
    folder = Q.cleanFolder((base ? base + '/' : '') + name);
    for (let i = 2; names.has(folder); i++) folder = Q.cleanFolder((base ? base + '/' : '') + `${name} (${i})`);
    createFolder(folder);
  }
  const done = [];
  const issues = [];
  let imageCount = 0;
  let skipped = 0;
  for (const k of list) {
    const c = Kahoot.convert(k, images);
    issues.push(...c.notes);
    skipped += c.total - c.questions.length;
    if (!c.questions.length) {
      issues.push({ row: 0, col: c.title.slice(0, 24), reason: 'אף שאלה לא יובאה, החידון לא נוצר', level: 'skip' });
      continue;
    }
    const q = Q.create(c.title || title, [], folder);
    // each picture is copied into the quiz's media folder once
    const stored = new Map();
    const keep = (o) => {
      if (!o.image) return;
      if (!stored.has(o.image)) {
        const img = images.get(o.image);
        stored.set(o.image, img ? Q.saveMedia(q.id, img.buffer, img.mime) : null);
      }
      if (stored.get(o.image)) o.image = stored.get(o.image);
      else delete o.image;
    };
    for (const x of c.questions) {
      keep(x);
      for (const a of x.answers || []) keep(a);
    }
    imageCount += [...stored.values()].filter(Boolean).length;
    Q.save(q.id, { title: c.title, description: c.description, folder, source: c.source, questions: c.questions });
    if (folder && list.length === 1) setQuizFolder(q.id, folder);
    done.push({ id: q.id, title: c.title, count: c.questions.length });
  }
  if (!done.length) {
    const e = new Error(`אף חידון לא יובא. ${issues.slice(0, 3).map((x) => x.reason).join(' · ')}`);
    e.issues = issues;
    throw e;
  }
  const count = done.reduce((n, x) => n + x.count, 0);
  const common = { count, images: imageCount, skipped, issues: issues.slice(0, 300) };
  if (done.length === 1 && list.length === 1) return { kind: 'quiz', id: done[0].id, title: done[0].title, folder, ...common };
  return { kind: 'folder', folder, id: done[0].id, quizzes: done.length, ...common, count: done.length, questions: count };
}

// a zip: the quizzes as .json files (manifest.json from the extension lists them) + their pictures
async function importKahootZip(zip, target, title) {
  const entries = Object.values(zip.files).filter((f) => !f.dir && !/(^|\/)(__MACOSX\/|\.)/.test(f.name));
  const list = [];
  for (const f of entries.filter((f) => /\.json$/i.test(f.name) && !/(^|\/)manifest\.json$/i.test(f.name)).slice(0, 300)) {
    list.push(...kahootList(jsonOf(await f.async('string'))));
  }
  const images = new Map();
  for (const f of entries.filter((f) => Q.IMG_EXT[path.extname(f.name).toLowerCase()]).slice(0, 3000)) {
    const buf = await f.async('nodebuffer');
    if (buf.length && buf.length <= 12 * 1024 * 1024) images.set(path.basename(f.name, path.extname(f.name)).toLowerCase(), { buffer: buf, mime: Q.IMG_EXT[path.extname(f.name).toLowerCase()] });
  }
  return importKahoot(list, images, target, title);
}

// any import: a quiz-games package, a Kahoot export (.zip / .json), a Kahoot-style .xlsx, or a .zip with an .xlsx + pictures
async function importAny(buffer, title, target = '') {
  let zip = null;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {}
  if (zip) {
    const mf = zip.file('manifest.json');
    const man = mf ? jsonOf(await mf.async('string')) : null;
    if (man && man.app === 'kahoot-export') return importKahootZip(zip, target, title);
    if (mf) return importPackage(zip, target);
    // a zip of Kahoot quiz files (no spreadsheet inside)
    const names = Object.keys(zip.files);
    if (!zip.file('xl/workbook.xml') && !names.some((n) => /\.xlsx$/i.test(n)) && names.some((n) => /\.json$/i.test(n))) return importKahootZip(zip, target, title);
  } else if (/^\s*[\[{]/.test(buffer.slice(0, 64).toString('utf8'))) {
    const list = kahootList(jsonOf(buffer.toString('utf8')));
    if (list.length) return importKahoot(list, new Map(), target, title);
    throw new Error('קובץ ה־JSON אינו חידון Kahoot');
  }
  const r = await Q.importAny(buffer, title);
  const f = Q.cleanFolder(target);
  if (f) setQuizFolder(r.id, f);
  return { ...r, folder: f };
}

// ---------- share links ----------
const sharesFile = () => metaFile('shares.json');
function readShares() {
  try {
    return JSON.parse(fs.readFileSync(sharesFile(), 'utf8')).shares || [];
  } catch {
    return [];
  }
}
function writeShares(list) {
  fs.writeFileSync(sharesFile(), JSON.stringify({ shares: list }, null, 2));
}
const PERMS = ['view', 'copy'];

function createShare({ kind, id, folder: folderPath, perm }) {
  if (!PERMS.includes(perm)) perm = 'copy';
  let ref;
  let title;
  if (kind === 'quiz') {
    const q = Q.load(String(id || ''));
    if (q.builtin) throw new Error('אי אפשר לשתף את החידון המובנה');
    ref = q.id;
    title = q.title;
  } else if (kind === 'folder') {
    ref = Q.cleanFolder(folderPath);
    if (!ref) throw new Error('תיקייה לא תקינה');
    title = ref.split('/').pop();
  } else throw new Error('מה לשתף?');
  const list = readShares();
  // one link per item and permission: sharing again returns the same link
  let s = list.find((x) => x.kind === kind && x.ref === ref && x.perm === perm);
  if (!s) {
    s = { token: crypto.randomBytes(12).toString('base64url'), kind, ref, perm, title, created: new Date().toISOString(), opened: 0 };
    list.push(s);
    writeShares(list);
  }
  return s;
}

function listShares() {
  return readShares();
}

function revokeShare(token) {
  writeShares(readShares().filter((s) => s.token !== token));
  return { ok: true };
}

function getShare(token) {
  const s = readShares().find((x) => x.token === String(token || ''));
  if (!s) return null;
  // a renamed folder keeps its link working
  if (s.kind === 'quiz') {
    try {
      Q.load(s.ref);
    } catch {
      return null;
    }
  }
  return s;
}

function touchShare(token) {
  const list = readShares();
  const s = list.find((x) => x.token === token);
  if (s) {
    s.opened = (s.opened || 0) + 1;
    s.lastOpened = new Date().toISOString();
    writeShares(list);
  }
}

// what the share page shows: the quiz (or the folder's quizzes) with questions and answers
function shareView(s) {
  const view = (q) => ({ id: q.id, title: q.title, count: q.questions.length, questions: q.questions, mediaBase: `/media/${encodeURIComponent(q.id)}/` });
  if (s.kind === 'quiz') return { kind: 'quiz', perm: s.perm, title: s.title, quizzes: [view(Q.load(s.ref))] };
  const qs = Q.list().filter((q) => !q.builtin && q.folder && inside(q.folder, s.ref));
  return { kind: 'folder', perm: s.perm, title: s.title, quizzes: qs.map((q) => ({ ...view(Q.load(q.id)), folder: q.folder.slice(s.ref.length).replace(/^\//, '') })) };
}

async function sharePackage(s) {
  return s.kind === 'quiz' ? packageQuiz(s.ref) : packageFolder(s.ref);
}

// another teacher's share link → download its package and import it here
async function importFromLink(url, target = '') {
  let u;
  try {
    u = new URL(String(url || '').trim());
  } catch {
    throw new Error('הקישור לא תקין');
  }
  const m = u.pathname.match(/\/share\/([\w-]{8,40})/);
  if (!/^https?:$/.test(u.protocol) || !m) throw new Error('זה לא קישור שיתוף של פיצוץ מוחות');
  const res = await fetch(`${u.origin}/share/${m[1]}/package`, { signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!res) throw new Error('אין חיבור למחשב ששיתף (בדקו שהוא דולק ובאותה רשת)');
  if (res.status === 403) throw new Error('הקישור הזה מאפשר רק צפייה, לא העתקה');
  if (!res.ok) throw new Error('הקישור לא נמצא או בוטל');
  const zip = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()));
  return importPackage(zip, target);
}

module.exports = { folders, createFolder, renameFolder, deleteFolder, setQuizFolder, packageQuiz, packageFolder, importPackage, importAny, createShare, listShares, revokeShare, getShare, touchShare, shareView, sharePackage, importFromLink };
