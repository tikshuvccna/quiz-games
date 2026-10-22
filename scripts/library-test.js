// Library test: folders, moving quizzes, packages (quiz / folder) and share links. No server needed.
// Runs in a temporary library folder: node scripts/library-test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const JSZip = require('jszip');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qg-lib-'));
process.env.QUIZ_DIR = path.join(tmp, 'a');
const Q = require('../server/quizzes');
const L = require('../server/library');

let failed = 0;
const check = (name, ok, extra) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || extra === undefined ? '' : '  → ' + JSON.stringify(extra)}`);
};
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const quiz = (title, folder) => {
  const q = Q.create(title, [], folder);
  const img = Q.saveMedia(q.id, PNG, 'image/png');
  Q.save(q.id, { title, folder, questions: [{ type: 'quiz', text: 'שאלה ' + title, image: img, answers: [{ text: 'א', correct: true }, { text: 'ב' }] }] });
  return q.id;
};

(async () => {
  try {
    // folders
    L.createFolder('מדעים/כיתה ז');
    L.createFolder('היסטוריה');
    const a = quiz('צמחים', 'מדעים/כיתה ז');
    const b = quiz('חיות', 'מדעים');
    const c = quiz('מלכים', '');
    const f = L.folders().map((x) => x.path);
    check('folders and parents are listed', ['היסטוריה', 'מדעים', 'מדעים/כיתה ז'].every((x) => f.includes(x)), f);
    check('counts per folder', L.folders().find((x) => x.path === 'מדעים').count === 1);
    check('editor save keeps the folder', (Q.save(a, { title: 'צמחים 2', questions: Q.load(a).questions }), Q.load(a).folder === 'מדעים/כיתה ז'));

    L.setQuizFolder(c, 'היסטוריה');
    check('move a quiz to a folder', Q.load(c).folder === 'היסטוריה');
    L.renameFolder('מדעים', 'מדע');
    check('rename a folder moves its quizzes and sub folders', Q.load(a).folder === 'מדע/כיתה ז' && Q.load(b).folder === 'מדע' && L.folders().some((x) => x.path === 'מדע/כיתה ז'), L.folders());
    let threw = false;
    try { L.renameFolder('מדע', 'מדע/פנימה'); } catch { threw = true; }
    check('a folder can not move into itself', threw);
    check('folder names are cleaned', Q.cleanFolder('../a/b:c/./d') === 'a/bc/d', Q.cleanFolder('../a/b:c/./d'));

    // packages
    const pq = await L.packageQuiz(a);
    const zq = await JSZip.loadAsync(pq.buffer);
    check('quiz package has manifest, quiz and its picture', !!zq.file('manifest.json') && !!zq.file('quiz.json') && Object.keys(zq.files).some((n) => n.startsWith('media/')));
    const pf = await L.packageFolder('מדע');
    check('folder package has both quizzes', pf.count === 2, pf.count);

    // import into a second library (another teacher)
    process.env.QUIZ_DIR = path.join(tmp, 'b');
    const r1 = await L.importAny(pq.buffer, '', 'משותף');
    const qa = Q.load(r1.id);
    check('quiz package imports with a new id into the chosen folder', r1.kind === 'quiz' && qa.folder === 'משותף' && qa.questions.length === 1, r1);
    check('its picture came along', !!Q.mediaPath(r1.id, qa.questions[0].image));
    const r2 = await L.importAny(pf.buffer, '', '');
    check('folder package recreates the folder tree', r2.kind === 'folder' && r2.count === 2 && L.folders().some((x) => x.path === 'מדע/כיתה ז'), r2);
    const r3 = await L.importAny(pf.buffer, '', '');
    check('importing the same folder again does not overwrite (gets a number)', r3.folder === 'מדע (2)', r3.folder);

    // delete a folder: quizzes go up one level
    const d = L.deleteFolder('מדע (2)/כיתה ז');
    check('deleting a folder moves its quizzes to the parent', d.moved === 1 && Q.list().some((q) => q.folder === 'מדע (2)' && q.title.startsWith('צמחים')), d);

    // share links
    process.env.QUIZ_DIR = path.join(tmp, 'a');
    const s1 = L.createShare({ kind: 'quiz', id: a, perm: 'view' });
    const s2 = L.createShare({ kind: 'quiz', id: a, perm: 'view' });
    check('sharing twice returns the same link', s1.token === s2.token);
    const sf = L.createShare({ kind: 'folder', folder: 'מדע', perm: 'copy' });
    const v = L.shareView(L.getShare(sf.token));
    check('folder share view lists its quizzes with questions', v.kind === 'folder' && v.quizzes.length === 2 && v.quizzes.every((q) => q.questions.length), v.quizzes.length);
    check('share package for copy links', (await L.sharePackage(L.getShare(sf.token))).count === 2);
    check('bookkeeping files are not listed as quizzes', !Q.list().some((q) => q.id === 'folders' || q.id === 'shares'), Q.list().map((q) => q.id));
    L.revokeShare(s1.token);
    check('a revoked link is gone', !L.getShare(s1.token));
  } catch (e) {
    failed++;
    console.log('FAIL exception', e);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
  process.exit(failed ? 1 : 0);
})();
