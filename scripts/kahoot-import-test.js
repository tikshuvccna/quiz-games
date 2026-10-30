// Kahoot import and the question types it needs: node scripts/kahoot-import-test.js (no server needed).
// Runs in a temporary quiz folder and restores config.json afterwards.
// The fixtures are small made-up quizzes in the shape of Kahoot's own JSON (create.kahoot.it/rest/kahoots/<uuid>).
const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const Q = require('../server/quizzes');
const Library = require('../server/library');
const qt = require('../server/qtypes');
const Kahoot = require('../server/importers/kahoot');
const Filter = require('../server/filter');

const CONFIG = path.join(__dirname, '..', 'config.json');
const hadConfig = fs.existsSync(CONFIG);
const oldConfig = hadConfig ? fs.readFileSync(CONFIG) : null;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qg-kahoot-'));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

let failed = 0;
const check = (name, ok, extra) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || extra === undefined ? '' : '  → ' + JSON.stringify(extra)}`);
};

// ---------- fixtures ----------
const ch = (answer, correct, image) => ({ answer, correct, ...(image ? { image: { id: image, width: 10, height: 10 } } : {}) });
const meta = { video: { startTime: 0, endTime: 0, service: 'youtube', fullUrl: '' }, media: [] };
const kahootQuiz = (uuid, title, questions) => ({ uuid, slug: title.toLowerCase().replace(/\W+/g, '-'), title, description: '<b>About</b> &amp; more', creator_username: 'teacher1', language: 'English', tags: 'math,fun', questions });
const QUESTIONS = [
  { ...meta, type: 'quiz', question: 'Capital of <b>France</b>?', time: 20000, pointsMultiplier: 1, layout: 'CLASSIC', choices: [ch('Paris', true), ch('Rome', false), ch('Oslo', false), ch('Bern', false)] },
  { ...meta, type: 'quiz', question: 'The sun is a star', time: 10000, pointsMultiplier: 2, layout: 'TRUE_FALSE', choices: [ch('True', true), ch('False', false)] },
  { ...meta, type: 'multiple_select_quiz', question: 'Pick the primes', time: 45000, choices: [ch('2', true), ch('3', true), ch('4', false), ch('9', false)] },
  { ...meta, type: 'quiz', question: 'Which flag?', time: 15000, choices: [ch('', true, 'imgA'), ch('', false, 'imgB'), ch('Blue', false)] },
  { ...meta, type: 'open_ended', question: 'Largest planet?', time: 30000, choices: [ch('Jupiter', true), ch('jupiter planet', true)] },
  { ...meta, type: 'jumble', question: 'Order small to big', time: 60000, choices: [ch('ant', true), ch('cat', true), ch('cow', true), ch('whale', true)] },
  { ...meta, type: 'slider', question: 'Month of Halloween', time: 20000, choiceRange: { start: 1, end: 12, step: 1, correct: 10, tolerance: 0.1, unit: 'month' } },
  { ...meta, type: 'pin_it', question: 'Pin the lake', time: 20000, image: 'https://media.kahoot.it/imgMap', imageMetadata: { id: 'imgMap', width: 200, height: 100, effects: [{ type: 'GRIDREVEAL', params: { gridSize: '8x8' } }] }, choiceShapes: [
    { type: 'rect', x: 20, y: 10, width: 40, height: 20 },
    { type: 'ellipse', x: 100, y: 50, radiusX: 20, radiusY: 10 },
    { type: 'polygon', points: [{ x: 150, y: 20 }, { x: 190, y: 20 }, { x: 170, y: 90 }] },
  ] },
  { ...meta, type: 'drop_pin', question: 'Where would you live?', time: 30000, image: 'https://media.kahoot.it/imgMap', imageMetadata: { id: 'imgMap', width: 200, height: 100 } },
  { ...meta, type: 'survey', question: 'Favorite season?', time: 20000, choices: [ch('Summer', true), ch('Winter', true)] },
  { ...meta, type: 'multiple_select_poll', question: 'Which snacks?', time: 20000, choices: [ch('Chips', true), ch('Fruit', true), ch('Nuts', true)] },
  { ...meta, type: 'word_cloud', question: 'One word for school', time: 30000 },
  { ...meta, type: 'feedback', question: 'What helped you most?', time: 30000 },
  { ...meta, type: 'brainstorming', question: 'Ideas for the trip', time: 90000, numberOfAnswersAllowed: 2 },
  { ...meta, type: 'content', title: 'Welcome', description: '<ul><li>First</li><li>Second &amp; third</li></ul>', time: 0, video: { startTime: 3, endTime: 20, service: 'youtube', fullUrl: 'https://www.youtubeeducation.com/watch?v=gCfzeONu3Mo' }, media: [] },
  { ...meta, type: 'quiz', question: 'With a missing picture', time: 20000, image: 'https://media.kahoot.it/gone', imageMetadata: { id: 'gone' }, choices: [ch('a', true), ch('b', false)] },
  { ...meta, type: 'quiz', question: 'Uploaded video', time: 20000, video: { service: 'kahoot', fullUrl: 'https://stream.example/abc', startTime: 0, endTime: 0 }, choices: [ch('a', true), ch('b', false)] },
  { ...meta, type: 'matching_future', question: 'A type from the future', time: 20000, choices: [] },
  { ...meta, type: 'quiz', question: 'Only one answer', time: 20000, choices: [ch('lonely', true)] },
];

(async () => {
  try {
    Q.setFolder(tmp);

    // ---------- the converter on its own ----------
    const images = new Map([['imga', { buffer: PNG, mime: 'image/png' }], ['imgb', { buffer: PNG, mime: 'image/png' }], ['imgmap', { buffer: PNG, mime: 'image/png' }]]);
    const c = Kahoot.convert(kahootQuiz('u1', 'Mixed Bag', QUESTIONS), images);
    const by = (text) => c.questions.find((q) => q.text === text);
    check('convert: title, description (markup removed), source', c.title === 'Mixed Bag' && c.description === 'About & more' && c.source.site === 'kahoot' && c.source.author === 'teacher1' && c.source.url.endsWith('/u1') && c.source.tags.length === 2, c.source);
    check('convert: 17 of 19 kept, 2 skipped (unknown type, one answer)', c.questions.length === 17 && c.total === 19, [c.questions.length, c.total]);
    check('convert: html removed from the question', !!by('Capital of France?'));
    check('convert: true/false layout becomes tf, ×2 kept', by('The sun is a star').type === 'tf' && by('The sun is a star').points === 2);
    check('convert: multi-select quiz has two correct answers', by('Pick the primes').answers.filter((a) => a.correct).length === 2 && by('Pick the primes').time === 45);
    const flag = by('Which flag?');
    check('convert: answers can be pictures', flag.answers[0].image === 'imga' && flag.answers[0].text === '' && flag.answers[0].correct && flag.answers[2].text === 'Blue', flag.answers);
    check('convert: 15 seconds becomes the nearest allowed time', flag.time === 10 || flag.time === 20, flag.time);
    check('convert: open_ended becomes a typed answer with every spelling', by('Largest planet?').type === 'type' && by('Largest planet?').accept.length === 2);
    check('convert: jumble becomes order, in the listed order', by('Order small to big').type === 'order' && by('Order small to big').items.join() === 'ant,cat,cow,whale');
    const sl = c.questions.find((q) => q.type === 'slider');
    check('convert: slider tolerance is a share of the range, unit added', sl.slider.tol === 1.1 && sl.slider.answer === 10 && sl.text.endsWith('(month)'), sl);
    const pin = c.questions.find((q) => q.type === 'pin');
    check('convert: pin keeps rect + ellipse + polygon zones in percent', pin.pin.shape === 'rect' && pin.pin.x === 20 && pin.pin.y === 20 && pin.pin.w === 20 && pin.pin.h === 20 && pin.pin.extra.length === 2 && pin.pin.extra[0].shape === 'ellipse' && pin.pin.extra[1].shape === 'polygon' && pin.pin.extra[1].points.length === 3, pin.pin);
    check('convert: pin picture proportions kept (ar 2)', pin.pin.ar === 2 && pin.reveal === 'tiles', [pin.pin.ar, pin.reveal]);
    check('convert: drop pin', c.questions.some((q) => q.type === 'drop' && q.image === 'imgmap'));
    check('convert: poll and multi-choice poll', by('Favorite season?').type === 'poll' && !by('Favorite season?').multi && by('Which snacks?').multi === true && by('Which snacks?').answers.length === 3);
    check('convert: word cloud, free text and brainstorm', by('One word for school').type === 'cloud' && by('What helped you most?').type === 'open' && by('Ideas for the trip').type === 'brain' && by('Ideas for the trip').limit === 2);
    const slide = c.questions.find((q) => q.type === 'slide');
    check('convert: slide keeps title, bulleted body and the YouTube video', slide.text === 'Welcome' && slide.body === '• First\n• Second & third' && slide.video.id === 'gCfzeONu3Mo' && slide.video.start === 3 && slide.video.end === 20, slide);
    check('convert: a missing picture is reported once, the question stays', by('With a missing picture') && c.notes.some((n) => /1 תמונות לא צורפו/.test(n.reason)), c.notes);
    check('convert: an uploaded Kahoot video is reported, not imported', by('Uploaded video') && !by('Uploaded video').video && c.notes.some((n) => /סרטון שהועלה/.test(n.reason)));
    check('convert: unknown type and one-answer quiz are skipped with a reason', c.notes.filter((n) => n.level === 'skip').length === 2, c.notes.filter((n) => n.level === 'skip'));

    // ---------- every converted question is valid for the game ----------
    check('all converted questions are shown by the classic quiz', c.questions.every((q) => qt.shown(q)));
    const scored = c.questions.filter((q) => qt.SCORED.has(q.type));
    check('scored ones are playable by every game', scored.every((q) => qt.playable(q)), scored.filter((q) => !qt.playable(q)).map((q) => q.type));

    // ---------- import: raw JSON, one quiz ----------
    let r = await Library.importAny(Buffer.from(JSON.stringify(kahootQuiz('u2', 'Raw JSON', QUESTIONS.slice(0, 3)))), 'raw');
    check('json: one quiz imported as a quiz', r.kind === 'quiz' && r.count === 3 && Q.load(r.id).source.id === 'u2', r);
    check('json: the editor save keeps the source', (() => { const q = Q.load(r.id); Q.save(r.id, { title: q.title, description: q.description, background: '', questions: q.questions }); return Q.load(r.id).source.site === 'kahoot'; })());

    // ---------- import: the extension's zip, two quizzes + pictures ----------
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ app: 'kahoot-export', version: 1 }));
    zip.file('quizzes/a.json', JSON.stringify(kahootQuiz('u3', 'Zip One', QUESTIONS)));
    zip.file('quizzes/b.json', JSON.stringify(kahootQuiz('u4', 'Zip Two', QUESTIONS.slice(0, 2))));
    zip.file('images/imgA.png', PNG);
    zip.file('images/imgB.png', PNG);
    zip.file('images/imgMap.png', PNG);
    r = await Library.importAny(await zip.generateAsync({ type: 'nodebuffer' }), 'zip');
    check('zip: two quizzes go into a "Kahoot" folder', r.kind === 'folder' && r.folder === 'Kahoot' && r.count === 2 && r.questions === 17 + 2, r);
    check('zip: 3 pictures stored (the map is shared by the pin and the drop pin)', r.images === 3, r.images);
    const one = Q.list().find((x) => x.title === 'Zip One');
    const loaded = Q.load(one.id);
    const flag2 = loaded.questions.find((q) => q.text === 'Which flag?');
    check('zip: answer pictures exist on disk', flag2.answers.slice(0, 2).every((a) => a.image && Q.mediaPath(one.id, a.image)), flag2.answers);
    check('zip: the pin picture exists on disk', loaded.questions.filter((q) => q.image).every((q) => Q.mediaPath(one.id, q.image)));
    check('zip: quiz sits in the folder', loaded.folder === 'Kahoot');
    const again = await Library.importAny(await zip.generateAsync({ type: 'nodebuffer' }), 'zip');
    check('zip: importing again makes a second folder, nothing overwritten', again.folder === 'Kahoot (2)', again.folder);

    // ---------- package round trip carries the answer pictures ----------
    const pkg = await Library.packageQuiz(one.id);
    const pz = await JSZip.loadAsync(pkg.buffer);
    const need = new Set();
    for (const q of loaded.questions) { if (q.image) need.add(q.image); (q.answers || []).forEach((a) => a.image && need.add(a.image)); }
    check('package: every picture (also the answers\') is inside', Object.values(pz.files).filter((f) => !f.dir && f.name.startsWith('media/')).length === need.size && need.size >= 3, [Object.keys(pz.files), [...need]]);
    const back = await Library.importAny(pkg.buffer, 'back');
    const copy = Q.load(back.id);
    check('package: imported copy keeps pin zones, answer pictures and the source', copy.questions.find((q) => q.type === 'pin').pin.extra.length === 2 && copy.questions.find((q) => q.text === 'Which flag?').answers[0].image && copy.source.site === 'kahoot');

    // ---------- junk ----------
    let err = null;
    try { await Library.importAny(Buffer.from('{"hello":1}'), 'x'); } catch (e) { err = e; }
    check('json that is not a Kahoot quiz is rejected', !!err, err && err.message);
    err = null;
    try { await Library.importAny(Buffer.from(JSON.stringify(kahootQuiz('u5', 'All bad', [QUESTIONS[17], QUESTIONS[18]]))), 'x'); } catch (e) { err = e; }
    check('a quiz with nothing importable says why', !!err && err.issues && err.issues.length >= 2, err && err.message);

    // ---------- question types ----------
    const pol = qt.normalize({ type: 'pin', text: 't', image: 'a.png', pin: { shape: 'polygon', points: [[10, 10], [60, 10], [60, 60], [10, 60]], extra: [{ shape: 'ellipse', x: 80, y: 80, w: 20, h: 20 }, { shape: 'circle', x: 30, y: 85, r: 5 }], ar: 2 } });
    check('pin: inside the polygon / outside', qt.inPin(pol.pin, 30, 30) && !qt.inPin(pol.pin, 70, 30));
    check('pin: an extra ellipse counts, its corner does not', qt.inPin(pol.pin, 80, 80) && !qt.inPin(pol.pin, 89, 89));
    check('pin: an extra circle counts', qt.inPin(pol.pin, 30, 85));
    check('pin: a polygon with two points falls back to a circle', qt.normalize({ type: 'pin', text: 't', image: 'a.png', pin: { shape: 'polygon', points: [[1, 1], [2, 2]] } }).pin.shape === 'circle');
    const cloud = qt.normalize({ type: 'cloud', text: 'x', limit: 3 });
    check('cloud: words are cleaned, deduplicated and limited', JSON.stringify(qt.check(cloud, {}, { words: ['  a ', 'A', 'b', 'c', 'd', ''] }).words) === '["a","b","c"]');
    check('cloud: nothing to send is invalid', !qt.check(cloud, {}, { words: [' ', ''] }).valid && !qt.check(cloud, {}, {}).valid);
    check('open text keeps long answers, cloud cuts at 30', qt.check(qt.normalize({ type: 'open', text: 'x' }), {}, { words: ['x'.repeat(150)] }).words[0].length === 150 && qt.check(cloud, {}, { words: ['x'.repeat(100)] }).words[0].length === 30);
    const poll = qt.normalize({ type: 'poll', multi: true, text: 'p', answers: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] });
    const pp = qt.present(poll, '/m/');
    check('poll: multi-select is offered, several choices accepted, no right answer', pp.payload.multi === true && qt.check(poll, pp.state, { choices: [0, 2] }).valid && qt.check(poll, pp.state, { choices: [0, 2] }).ok === null);
    const single = qt.normalize({ type: 'poll', text: 'p', answers: [{ text: 'a' }, { text: 'b' }] });
    check('poll: a single-choice poll refuses several choices', !qt.check(single, qt.present(single, '/m/').state, { choices: [0, 1] }).valid);
    const drop = qt.normalize({ type: 'drop', text: 'd', image: 'a.png' });
    check('drop: a pin anywhere in the picture, nothing outside', qt.check(drop, {}, { x: 10, y: 99 }).valid && !qt.check(drop, {}, { x: 101, y: 5 }).valid && qt.check(drop, {}, { x: 10, y: 99 }).ok === null);
    check('drop needs a picture to be shown', !qt.shown(qt.normalize({ type: 'drop', text: 'd' })));
    const picQ = qt.normalize({ type: 'quiz', text: 'q', answers: [{ text: '', image: 'a.png', correct: true }, { text: '', image: 'b.png' }] });
    const pq = qt.present(picQ, '/m/');
    check('picture answers: playable, urls sent, graded', qt.playable(picQ) && pq.payload.optionImages.length === 2 && pq.payload.optionImages[0].startsWith('/m/') && qt.check(picQ, pq.state, { choice: pq.state.order.indexOf(0) }).ok === true);

    // ---------- matching and sorting ----------
    const mq = qt.normalize({ type: 'match', text: 'm', pairs: [{ a: '1', b: 'one' }, { a: '2', b: 'two' }, { a: '3', b: 'three' }, { a: '', b: 'x' }] });
    const mp = qt.present(mq, '/m/');
    const rightAll = mp.payload.left.map((_, i) => mp.payload.right.indexOf(mq.pairs[i].b));
    check('match: empty pairs dropped, right column shuffled, left kept', mq.pairs.length === 3 && mp.payload.left.join() === '1,2,3' && mp.payload.right.slice().sort().join() === 'one,three,two');
    check('match: all right is ok, a swap gives partial credit', qt.check(mq, mp.state, { match: rightAll }).ok === true && Math.abs(qt.check(mq, mp.state, { match: [rightAll[1], rightAll[0], rightAll[2]] }).ratio - 1 / 3) < 1e-9);
    check('match: junk answers are refused', !qt.check(mq, mp.state, { match: [0, 0, 1] }).valid && !qt.check(mq, mp.state, { match: [0, 1] }).valid && !qt.check(mq, mp.state, {}).valid);
    const sq2 = qt.normalize({ type: 'sort', text: 's', buckets: [{ name: 'Fruit', items: ['apple', 'pear'] }, { name: 'Veg', items: ['carrot'] }] });
    const sp = qt.present(sq2, '/m/');
    const sAll = sp.payload.items.map((t) => (['apple', 'pear'].includes(t) ? 0 : 1));
    check('sort: all right is ok, all in one group is partial', qt.check(sq2, sp.state, { sort: sAll }).ok === true && Math.abs(qt.check(sq2, sp.state, { sort: sAll.map(() => 0) }).ratio - 2 / 3) < 1e-9);
    const nine = Array.from({ length: 9 }, (_, i) => 'i' + i);
    check('sort: needs two named groups with items, at most 8 items', qt.playable(sq2) && !qt.playable(qt.normalize({ type: 'sort', text: 's', buckets: [{ name: 'A', items: ['x'] }] })) && qt.normalize({ type: 'sort', text: 's', buckets: [{ name: 'A', items: nine }, { name: 'B', items: ['y'] }] }).buckets[0].items.length === 8);
    check('sort: a bad bucket index is refused', !qt.check(sq2, sp.state, { sort: [0, 1, 5] }).valid && !qt.check(sq2, sp.state, { sort: [0, 1] }).valid);

    // ---------- word filter ----------
    check('filter: rude words and the usual tricks are caught', ['fuck', 'FUUUCK', 'f.u.c.k', 'f u c k', 'sh1t', 'בן זונה', 'ז ו נ ה', 'כוסאמק', 'מזדיין'].every((w) => Filter.bad(w)), ['fuck', 'FUUUCK', 'f.u.c.k', 'f u c k', 'sh1t', 'בן זונה', 'ז ו נ ה', 'כוסאמק', 'מזדיין'].filter((w) => !Filter.bad(w)));
    check('filter: ordinary words are not', ['שלום', 'כוס מים', 'תחת השמיים', 'חרות', 'pass hit', 'assignment', 'Scunthorpe', 'cocktail party', 'Hitler בהיסטוריה'].every((w) => !Filter.bad(w)), ['שלום', 'כוס מים', 'תחת השמיים', 'חרות', 'pass hit', 'assignment', 'Scunthorpe', 'cocktail party', 'Hitler בהיסטוריה'].filter((w) => Filter.bad(w)));

    // ---------- spreadsheet: the new types and columns ----------
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Quiz');
    ws.addRow(['#', 'Question', 'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Time limit (sec)', 'Correct answer(s)', 'Type', 'Points', 'Image', 'Video', 'Reveal', 'Accept', 'Slider', 'Items', 'Pin', 'Puzzle', 'Explanation', 'AfterImage', 'AnsImages', 'Limit', 'Body', 'Scale']);
    ws.addRow([1, 'Word cloud', 'a', 'b', 'c', 'd', 30, '1', 'cloud', '', '', '', '', '', '', '', '', '', '', '', '', 2]);
    ws.addRow([2, 'Free text', 'a', 'b', 'c', 'd', 30, '1', 'open']);
    ws.addRow([3, 'Ideas', 'a', 'b', 'c', 'd', 60, '1', 'brain', '', '', '', '', '', '', '', '', '', '', '', '', 4]);
    ws.addRow([4, 'Drop a pin', 'a', 'b', 'c', 'd', 30, '1', 'drop', '', 'map.png']);
    ws.addRow([5, 'Drop without a picture', 'a', 'b', 'c', 'd', 30, '1', 'drop']);
    ws.addRow([6, 'Many allowed', 'x', 'y', 'z', 'w', 20, '1', 'multipoll']);
    ws.addRow([7, 'Flags', 'x', 'y', 'z', 'w', 20, '2', 'quiz', 1, '', '', '', '', '', '', '', '', '', '', 'f1.png||f3.png']);
    ws.addRow([8, 'Slide', 'x', 'y', 'z', 'w', 10, '1', 'slide', '', '', '', '', '', '', '', '', '', '', '', '', '', 'The slide text']);
    ws.addRow([9, 'Polygon + ellipse', 'a', 'b', 'c', 'd', 30, '1', 'pin', 1, 'map.png', '', '', '', '', '', 'poly:10,10;50,10;50,50+ellipse:80|80|20|10+30|85|5']);
    ws.addRow([11, 'Rate it', 'a', 'b', 'c', 'd', 20, '1', 'rate', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '7|never|always']);
    ws.addRow([12, 'Rank them', 'a', 'b', 'c', 'd', 30, '1', 'rank', '', '', '', '', '', '', 'cats|dogs|birds']);
    ws.addRow([13, 'Class questions', 'a', 'b', 'c', 'd', 30, '1', 'qna', '', '', '', '', '', '', '', '', '', '', '', '', 1]);
    ws.addRow([14, 'Rank with one item', 'a', 'b', 'c', 'd', 30, '1', 'rank', '', '', '', '', '', '', 'only']);
    ws.addRow([15, 'Match them', 'a', 'b', 'c', 'd', 20, '1', 'match', '', '', '', '', '', '', 'cat=meow|dog=woof|cow=moo']);
    ws.addRow([16, 'Sort them', 'a', 'b', 'c', 'd', 20, '1', 'sort', '', '', '', '', '', '', 'Fruit:apple,pear|Veg:carrot,onion']);
    ws.addRow([17, 'Bad match', 'a', 'b', 'c', 'd', 20, '1', 'match', '', '', '', '', '', '', 'cat=meow']);
    ws.addRow([18, 'Bad sort', 'a', 'b', 'c', 'd', 20, '1', 'sort', '', '', '', '', '', '', 'OnlyOne:a,b']);
    ws.addRow([10, 'Bad polygon', 'a', 'b', 'c', 'd', 30, '1', 'pin', 1, 'map.png', '', '', '', '', '', 'poly:10,10;50,10']);
    const imgs = new Map([['map.png', { buffer: PNG, mime: 'image/png' }], ['f1.png', { buffer: PNG, mime: 'image/png' }], ['f3.png', { buffer: PNG, mime: 'image/png' }]]);
    const rr = await Q.importXlsx(Buffer.from(await wb.xlsx.writeBuffer()), 'new types', imgs);
    const sq = Q.load(rr.id);
    const g = (t) => sq.questions.find((q) => q.text === t);
    check('xlsx: cloud with Limit', g('Word cloud').type === 'cloud' && g('Word cloud').limit === 2 && g('Word cloud').points === 0);
    check('xlsx: open and brain', g('Free text').type === 'open' && g('Free text').limit === 1 && g('Ideas').type === 'brain' && g('Ideas').limit === 4);
    check('xlsx: drop with a picture; without one it becomes multiple choice', g('Drop a pin').type === 'drop' && g('Drop without a picture').type === 'quiz');
    check('xlsx: multipoll', g('Many allowed').type === 'poll' && g('Many allowed').multi === true);
    check('xlsx: AnsImages put pictures on the right answers', g('Flags').answers[0].image && !g('Flags').answers[1].image && g('Flags').answers[2].image && Q.mediaPath(rr.id, g('Flags').answers[0].image), g('Flags').answers);
    check('xlsx: slide Body', g('Slide').type === 'slide' && g('Slide').body === 'The slide text');
    const px = g('Polygon + ellipse').pin;
    check('xlsx: pin polygon + ellipse + circle zones', px.shape === 'polygon' && px.points.length === 3 && px.extra.length === 2 && px.extra[0].shape === 'ellipse' && px.extra[1].shape === 'circle', px);
    check('xlsx: rate with Scale (max, low, high)', g('Rate it').type === 'rate' && g('Rate it').scale.max === 7 && g('Rate it').scale.low === 'never' && g('Rate it').scale.high === 'always', g('Rate it'));
    check('xlsx: rank with Items; one item falls back to multiple choice', g('Rank them').type === 'rank' && g('Rank them').items.length === 3 && g('Rank with one item').type === 'quiz');
    check('xlsx: match pairs a=b, and sort groups with items', g('Match them').type === 'match' && g('Match them').pairs.length === 3 && g('Match them').time === 30 && g('Sort them').type === 'sort' && g('Sort them').buckets[1].items.join() === 'carrot,onion', [g('Match them'), g('Sort them')]);
    check('xlsx: a one-pair match and a one-group sort become multiple choice', g('Bad match').type === 'quiz' && g('Bad sort').type === 'quiz');
    check('xlsx: qna with Limit', g('Class questions').type === 'qna' && g('Class questions').limit === 1);
    check('xlsx: a polygon with two points becomes multiple choice', g('Bad polygon').type === 'quiz' && rr.issues.some((i) => /poly:/.test(i.reason)));
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
