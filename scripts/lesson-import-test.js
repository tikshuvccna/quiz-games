// The lesson file: an Excel sheet (one row per step) + a zip with the PDFs and pictures. node scripts/lesson-import-test.js (no server)
const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const Q = require('../server/quizzes');
const Library = require('../server/library');
const { makePdf } = require('./make-pdf');

const CONFIG = path.join(__dirname, '..', 'config.json');
const hadConfig = fs.existsSync(CONFIG);
const oldConfig = hadConfig ? fs.readFileSync(CONFIG) : null;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qg-lesson-'));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

let failed = 0;
const check = (name, ok, extra) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || extra === undefined ? '' : '  → ' + JSON.stringify(extra)}`);
};

const HEAD = ['#', 'Question', 'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Time limit (sec)', 'Correct answer(s)', 'Type', 'Points', 'Image', 'Video', 'Reveal', 'Accept', 'Slider', 'Items', 'Pin', 'Puzzle', 'Explanation', 'AfterImage', 'AnsImages', 'Limit', 'Body', 'Scale', 'Layout', 'Bullets', 'Pdf', 'Timer', 'Notes', 'Source'];
const col = (name) => HEAD.indexOf(name);
function row(n, fields) {
  const r = Array(HEAD.length).fill('');
  r[0] = n;
  for (const [k, v] of Object.entries(fields)) r[col(k)] = v;
  return r;
}

async function sheet() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Lesson');
  ws.addRow(HEAD);
  ws.addRow(row(1, { Question: 'Welcome to biology', Type: 'slide', Layout: 'bullets', Bullets: 'What cells are|What they do|Why we care', Body: 'Lesson 1', Timer: 30, Notes: 'greet the class', Image: 'cover.png' })); // 1
  ws.addRow(row(2, { Question: 'The deck', Type: 'pdf', Pdf: 'Deck.pdf:2-3', Notes: 'walk through the pages' })); // 2,3
  ws.addRow(row(3, { Type: 'check' })); // 4: a "did you understand?" with no text
  ws.addRow(row(4, { Question: 'What does page 3 show?', 'Answer 1': 'Energy', 'Answer 2': 'Cells', 'Correct answer(s)': '1', 'Time limit (sec)': 20, Pdf: 'deck.pdf:3', Explanation: 'Read the title', Source: 'Biology book|p. 12|Energy comes from food' })); // 5
  ws.addRow(row(5, { Question: 'Tap race!', Type: 'tap', 'Time limit (sec)': 10 })); // 6
  ws.addRow(row(6, { Question: 'Pick a word', Type: 'cloud', Limit: 2 })); // 7
  ws.addRow(row(7, { Type: 'pdf', Pdf: 'deck.pdf:4' })); // 8: a page with no caption
  ws.addRow(row(8, { Question: 'Missing deck', Type: 'pdf', Pdf: 'gone.pdf' })); // skipped
  ws.addRow(row(9, { Question: 'Page too far', Type: 'pdf', Pdf: 'deck.pdf:9' })); // 9: clamps to the last page
  ws.addRow(row(10, { Question: 'Odd layout', Type: 'slide', Layout: 'hologram', Body: 'text' })); // 10: layout ignored with a note
  ws.addRow(row(11, { Question: 'Break', Type: 'slide', Layout: 'fun', Body: 'Stand up and stretch', Timer: 120 })); // 11
  return Buffer.from(await wb.xlsx.writeBuffer());
}

(async () => {
  try {
    Q.setFolder(tmp);
    const xlsx = await sheet();
    const zip = new JSZip();
    zip.file('lesson.xlsx', xlsx);
    zip.file('images/cover.png', PNG);
    zip.file('pdf/Deck.pdf', makePdf(['Intro', 'Cells', 'Energy', 'Summary']));
    const r = await Library.importAny(await zip.generateAsync({ type: 'nodebuffer' }), 'lesson');
    const q = Q.load(r.id);
    const T = q.questions.map((x) => x.type);

    check('the lesson imports: steps in order', T.join() === 'slide,pdf,pdf,poll,quiz,tap,cloud,pdf,pdf,slide,slide', T);
    check('counts: PDF stored once, slides counted', r.pdfs === 1 && r.slides === 7 && r.count === 11, [r.pdfs, r.slides, r.count]);
    const s = q.questions[0];
    check('slide: title, layout, bullets, body, timer, notes, picture', s.text === 'Welcome to biology' && s.layout === 'bullets' && s.bullets.join() === 'What cells are,What they do,Why we care' && s.body === 'Lesson 1' && s.timer === 30 && s.notes === 'greet the class' && s.image && Q.mediaPath(r.id, s.image), s);
    check('pdf row "Deck.pdf:2-3" becomes two steps, one per page (case-insensitive name)', q.questions[1].pdf.page === 2 && q.questions[2].pdf.page === 3 && q.questions[1].text === 'The deck' && q.questions[2].text === '');
    check('the PDF is stored in the quiz and the steps point at it', q.questions[1].pdf.file === q.questions[2].pdf.file && Q.mediaPath(r.id, q.questions[1].pdf.file) && /\.pdf$/.test(q.questions[1].pdf.file));
    check('notes only on the first page of a range', q.questions[1].notes === 'walk through the pages' && !q.questions[2].notes);
    const c = q.questions[3];
    check('"check" is a poll with the three answers, text filled in', c.type === 'poll' && c.text === 'הבנתם?' && c.answers.map((a) => a.text).join() === 'הבנתי ✔,בערך,לא הבנתי' && c.points === 0, c);
    const qz = q.questions[4];
    check('a question can sit on a PDF page, with its citation', qz.type === 'quiz' && qz.pdf.page === 3 && qz.pdf.file === q.questions[1].pdf.file && qz.source.doc === 'Biology book' && qz.source.loc === 'p. 12' && qz.source.quote === 'Energy comes from food' && qz.explain === 'Read the title', qz);
    check('tap race and word cloud', q.questions[5].type === 'tap' && q.questions[5].time === 10 && q.questions[6].type === 'cloud' && q.questions[6].limit === 2);
    check('a PDF page with no caption is a step', q.questions[7].type === 'pdf' && q.questions[7].pdf.page === 4 && q.questions[7].text === '');
    check('a PDF row without its file is skipped and reported', r.issues.some((i) => i.level === 'skip' && /PDF/.test(i.reason)) && !q.questions.some((x) => x.text === 'Missing deck'), r.issues.map((i) => i.reason));
    check('a page that does not exist is moved to the last page, with a note', q.questions[8].pdf.page === 4 && r.issues.some((i) => /לא קיים ב־PDF/.test(i.reason)));
    check('an unknown layout is ignored with a note', q.questions[9].layout === undefined && r.issues.some((i) => /hologram/.test(i.reason)));
    check('a fun slide with a countdown', q.questions[10].layout === 'fun' && q.questions[10].timer === 120);

    // the package carries the PDF, and a copy of it works
    const pkg = await Library.packageQuiz(r.id);
    const pz = await JSZip.loadAsync(pkg.buffer);
    check('the package includes the PDF', Object.keys(pz.files).some((n) => /^media\/.*\.pdf$/.test(n)));
    const back = await Library.importAny(pkg.buffer, 'copy');
    const copy = Q.load(back.id);
    check('an imported package keeps the lesson', copy.questions.length === 11 && copy.questions[1].pdf && Q.mediaPath(back.id, copy.questions[1].pdf.file) && copy.questions[4].source.doc === 'Biology book');

    // without the zip: the PDF cannot come along
    const plain = await Q.importXlsx(xlsx, 'plain');
    const pq = Q.load(plain.id);
    check('a sheet alone (no zip) imports what it can and says the PDF is missing', pq.questions.some((x) => x.type === 'slide') && plain.issues.some((i) => /לא צורף/.test(i.reason)) && !pq.questions.some((x) => x.pdf));

    // a normal Kahoot-style quiz sheet is unchanged
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Quiz');
    ws.addRow(['Question', 'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Time limit (sec)', 'Correct answer(s)']);
    ws.addRow(['Plain question', 'a', 'b', 'c', 'd', 20, '2']);
    const norm = await Q.importXlsx(Buffer.from(await wb.xlsx.writeBuffer()), 'norm');
    // the Privacy column: what the class sees of one step's results
    const wp = new ExcelJS.Workbook();
    const wsp = wp.addWorksheet('Quiz');
    wsp.addRow(['Question', 'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Time limit (sec)', 'Correct answer(s)', 'Privacy']);
    wsp.addRow(['Anonymous one', 'a', 'b', 'c', 'd', 20, '1', 'anon']);
    wsp.addRow(['Open one', 'a', 'b', 'c', 'd', 20, '1', '']);
    wsp.addRow(['Bad value', 'a', 'b', 'c', 'd', 20, '1', 'secret']);
    const prv = Q.load((await Q.importXlsx(Buffer.from(await wp.xlsx.writeBuffer()), 'priv')).id);
    check('a Privacy column sets what the class sees for that step (and ignores bad values)', prv.questions[0].privacy === 'anon' && prv.questions[1].privacy === undefined && prv.questions[2].privacy === undefined, prv.questions.map((x) => x.privacy));

    check('a normal quiz sheet still imports as before', norm.count === 1 && Q.load(norm.id).questions[0].answers[1].correct === true);

    // the blank template has the new columns
    const tpl = new ExcelJS.Workbook();
    await tpl.xlsx.load(await Q.templateXlsx());
    const hdr = tpl.worksheets[0].getRow(4).values.map((v) => String(v || ''));
    check('the template has the lesson columns', ['Layout', 'Bullets', 'Pdf', 'Timer', 'Notes', 'Source'].every((h) => hdr.includes(h)), hdr.slice(-8));
  } finally {
    if (hadConfig) fs.writeFileSync(CONFIG, oldConfig);
    else fs.rmSync(CONFIG, { force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
