// Import test: an .xlsx with the extra columns, and a .zip with the same sheet plus pictures.
// Runs in a temporary quiz folder and restores config.json afterwards. No server needed.
const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const Q = require('../server/quizzes');

const CONFIG = path.join(__dirname, '..', 'config.json');
const hadConfig = fs.existsSync(CONFIG);
const oldConfig = hadConfig ? fs.readFileSync(CONFIG) : null;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qg-import-'));

// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

let failed = 0;
const check = (name, ok, extra) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || extra === undefined ? '' : '  → ' + JSON.stringify(extra)}`);
};

async function sheet() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Quiz');
  ws.addRow(['title row']);
  ws.addRow(['#', 'Question - max 95 characters', 'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Time limit (sec)', 'Correct answer(s)', 'Type', 'Points', 'Image', 'Video', 'Reveal', 'Accept', 'Slider', 'Items', 'Pin', 'Puzzle']);
  ws.addRow([1, 'Plain question', 'a', 'b', 'c', 'd', 20, '2']);
  ws.addRow([2, 'Type it', 'paris', 'lyon', 'nice', 'lille', 30, '1', 'type', 2, '', '', '', 'paris|Paris']);
  ws.addRow([3, 'What year', '1938', '1948', '1958', '1968', 30, '2', 'slider', 1, '', '', '', '', '1900|2000|1|1948|0']);
  ws.addRow([4, 'Which is first', 'mouse', 'cat', 'dog', 'horse', 30, '1', 'order', 1, '', '', '', '', '', 'mouse|cat|dog|horse']);
  ws.addRow([5, 'Point at the red dot', 'red', 'blue', 'green', 'pink', 30, '1', 'pin', 1, 'q05-dot.png', '', '', '', '', '', '40|60|12']);
  ws.addRow([6, 'Video question', 'a', 'b', 'c', 'd', 20, '3', 'quiz', 1, 'q06.png', 'https://youtu.be/dQw4w9WgXcQ?start=5&end=20', 'yes']);
  ws.addRow([7, 'Pin without a picture', 'a', 'b', 'c', 'd', 20, '1', 'pin', 1, 'missing.png', '', '', '', '', '', '10|10|10']);
  ws.addRow([8, 'Puzzle (not played yet)', 'a', 'b', 'c', 'd', 20, '4', 'puzzle', 1, '', '', '', '', '', '', '', '3x3']);
  ws.addRow([9, 'Poll', 'x', 'y', 'z', 'w', 20, '1', 'poll']);
  ws.getRow(2).getCell(19).value = 'AfterImage';
  ws.addRow([11, 'With an explanation picture', 'a', 'b', 'c', 'd', 20, '1', 'quiz', 1, '', '', '', '', '', '', '', '', 'q06.png']);
  ws.addRow([10, 'Which row?', 'top', 'middle', 'bottom', 'none', 30, '2', 'pin', 1, 'q05-dot.png', '', '', '', '', '', '50|45|100|10']);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

(async () => {
  try {
    Q.setFolder(tmp);
    const xlsx = await sheet();

    // plain .xlsx: no pictures available
    let r = await Q.importAny(xlsx, 'plain');
    let quiz = Q.load(r.id);
    const byText = (t) => quiz.questions.find((q) => q.text === t);
    check('xlsx: 11 questions imported', r.count === 11, r);
    check('xlsx: type question', byText('Type it').type === 'type' && byText('Type it').accept.includes('paris') && byText('Type it').points === 2);
    check('xlsx: slider question', byText('What year').type === 'slider' && byText('What year').slider.answer === 1948);
    check('xlsx: order question', byText('Which is first').type === 'order' && byText('Which is first').items.length === 4);
    check('xlsx: pin without a picture becomes multiple choice', byText('Point at the red dot').type === 'quiz');
    check('xlsx: puzzle becomes multiple choice', byText('Puzzle (not played yet)').type === 'quiz' && r.downgraded >= 2, r);
    check('xlsx: poll stays a poll', byText('Poll').type === 'poll' && byText('Poll').points === 0);
    check('xlsx: youtube id, start and end', JSON.stringify(byText('Video question').video) === '{"id":"dQw4w9WgXcQ","start":5,"end":20}');
    check('xlsx: reveal is dropped when the picture is missing', !byText('Video question').reveal && r.issues.some((x) => x.row === 8 && x.col === 'K'), r.issues);
    check('xlsx: plain question unchanged', byText('Plain question').type === 'quiz' && byText('Plain question').answers[1].correct);

    // .zip with pictures
    const zip = new JSZip();
    zip.file('quiz.xlsx', xlsx);
    zip.file('images/q05-dot.png', PNG);
    zip.file('images/Q06.PNG', PNG);
    zip.file('__MACOSX/images/junk.png', PNG);
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    r = await Q.importAny(buf, 'withzip');
    quiz = Q.load(r.id);
    const pin = quiz.questions.find((q) => q.text === 'Point at the red dot');
    check('zip: 11 questions and 2 pictures', r.count === 11 && r.images === 2, r);
    const ex = quiz.questions.find((q) => q.text === 'With an explanation picture');
    check('zip: AfterImage becomes the explanation picture', ex.explainImage && !!Q.mediaPath(r.id, ex.explainImage), ex);
    const row = quiz.questions.find((q) => q.text === 'Which row?');
    check('zip: 4 numbers make a rectangle pin with the picture proportions', row.type === 'pin' && row.pin.shape === 'rect' && row.pin.w === 100 && row.pin.ar === 1, row.pin);
    check('zip: pin question is a pin with a stored picture', pin.type === 'pin' && pin.pin.x === 40 && !!Q.mediaPath(r.id, pin.image));
    const vq = quiz.questions.find((q) => q.text === 'Video question');
    check('zip: picture names are case-insensitive', !!Q.mediaPath(r.id, vq.image));
    check('zip: reveal (blur) kept with the picture', vq.reveal === 'blur');
    check('zip: missing picture is counted and removed', r.missingImages === 1 && !quiz.questions.find((q) => q.text === 'Pin without a picture').image, r);

    // errors
    await Q.importAny(Buffer.from('not a file'), 'x').then(() => check('garbage file is rejected', false), () => check('garbage file is rejected', true));
    const empty = new JSZip();
    empty.file('readme.txt', 'hi');
    await Q.importAny(await empty.generateAsync({ type: 'nodebuffer' }), 'x').then(() => check('zip without xlsx is rejected', false), () => check('zip without xlsx is rejected', true));

    // the blank template reads back through the same import
    r = await Q.importAny(Buffer.from(await Q.templateXlsx()), 'template');
    check('blank template imports with its example rows', r.count === 5 && r.special >= 3, r);
  } catch (e) {
    failed++;
    console.log('FAIL exception', e);
  } finally {
    if (hadConfig) fs.writeFileSync(CONFIG, oldConfig);
    else if (fs.existsSync(CONFIG)) fs.unlinkSync(CONFIG);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
  process.exit(failed ? 1 : 0);
})();
