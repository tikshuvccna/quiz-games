// HTML activities (simulations, animations) as lesson steps: node scripts/html-test.js (server running). One summary line.
const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { io } = require('socket.io-client');
const URL = process.env.QG_URL || 'http://localhost:3000';
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const api = async (p, method = 'GET', body) => (await fetch(URL + '/api/q' + p, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const EX = path.join(__dirname, '..', 'examples', 'html');

(async () => {
  const made = [];
  // ---- upload to a quiz and serve it back
  const quiz = await api('/quizzes', 'POST', { title: 'html test' });
  made.push(quiz.id);
  const html = fs.readFileSync(path.join(EX, 'pendulum.html'));
  const up = await (await fetch(`${URL}/api/q/quizzes/${quiz.id}/media`, { method: 'POST', headers: { 'Content-Type': 'text/html' }, body: html })).json();
  ok(up.name && up.name.endsWith('.html'), 'an HTML file can be uploaded to a quiz');
  const served = await fetch(`${URL}/media/${quiz.id}/${up.name}`);
  const csp = served.headers.get('content-security-policy') || '';
  ok(served.status === 200 && /text\/html/.test(served.headers.get('content-type')), 'it is served as HTML');
  ok(/sandbox/.test(csp) && !/allow-same-origin/.test(csp) && /connect-src 'none'/.test(csp), 'with a sandbox policy: no same-origin access, no network from the page');
  ok(served.headers.get('x-content-type-options') === 'nosniff', 'and nosniff');
  const big = await fetch(`${URL}/api/q/quizzes/${quiz.id}/media`, { method: 'POST', headers: { 'Content-Type': 'text/html' }, body: Buffer.alloc(3.2 * 1024 * 1024, 'a') });
  ok(big.status === 400, 'a file over 3MB is refused');
  const bad = await fetch(`${URL}/api/q/quizzes/${quiz.id}/media`, { method: 'POST', headers: { 'Content-Type': 'application/x-msdownload' }, body: Buffer.from('MZ') });
  ok(bad.status !== 200, 'other file types are still refused');

  // ---- the step is saved with its fields
  await api('/quizzes/' + quiz.id, 'PUT', { title: 'html test', questions: [
    { type: 'slide', text: 'פתיחה', layout: 'title' },
    { type: 'html', text: 'מטוטלת', html: { file: up.name, phones: true }, notes: 'תנו להם לשחק' },
    { type: 'html', text: 'בלי קובץ', html: { file: '../../etc/passwd' } },
    { type: 'quiz', text: 'מה משפיע?', time: 20, answers: [{ text: 'אורך החוט', correct: true }, { text: 'צבע' }] },
  ] });
  const saved = await api('/quizzes/' + quiz.id);
  const st = saved.questions.find((q) => q.type === 'html' && q.html);
  ok(st && st.html.file === up.name && st.html.phones === true && st.notes === 'תנו להם לשחק', 'the step keeps its file, the phones flag and its notes');
  ok(saved.questions.filter((q) => q.type === 'html').every((q) => !q.html || !/[\\/]/.test(q.html.file)), 'a file name with a path is cleaned');

  // ---- the lesson shows it
  const host = io(URL);
  let hs = null;
  host.on('host:state', (s) => (hs = s));
  const room = await new Promise((res) => host.emit('host:create', { game: 'lesson' }, res));
  host.emit('host:setup', { quiz: quiz.id });
  host.emit('host:settings', { scoring: 'none' });
  await wait(300);
  const kid = io(URL);
  let you = null;
  kid.on('you', (y) => (you = y));
  await new Promise((res) => kid.emit('player:join', { pin: room.pin, name: 'Ann' }, res));
  host.emit('host:start');
  await wait(5200);
  host.emit('host:next');
  await wait(900);
  ok(hs.board && hs.board.q && hs.board.q.type === 'html' && /\/media\/.+\.html$/.test(hs.board.q.html.url), 'the big screen gets the activity and its address');
  ok(you && you.phase === 'c_slide' && you.q && you.q.html && you.q.html.phones === true, 'the phones get it too when the teacher asked');
  ok(hs.board.lesson.outline[1].startsWith('🧪'), 'the outline shows it with its own icon');
  host.emit('host:end');
  kid.close();
  host.close();

  // ---- a sheet + a zip with an html folder
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Lesson');
  ws.addRow(['Question', 'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Time limit (sec)', 'Correct answer(s)', 'Type', 'Points', 'Image', 'Video', 'Reveal', 'Accept', 'Slider', 'Items', 'Pin', 'Puzzle', 'Explanation', 'AfterImage', 'AnsImages', 'Limit', 'Body', 'Scale', 'Layout', 'Bullets', 'Pdf', 'Timer', 'Notes', 'Source', 'Privacy', 'Html']);
  const row = (o) => { const r = new Array(31).fill(''); Object.entries(o).forEach(([k, v]) => (r[k] = v)); return r; };
  ws.addRow(row({ 0: 'שברים על פיצה', 7: 'html', 27: 'שאלו: כמה פרוסות?', 30: 'fractions.html' }));
  ws.addRow(row({ 0: 'מחזור המים', 7: 'html', 30: 'water-cycle.html|phones' }));
  ws.addRow(row({ 0: 'חסר', 7: 'html', 30: 'nope.html' }));
  ws.addRow(['מהו החלק של פיצה שאכלנו?', '3/8', '3/4', '1/2', '', 20, '1']);
  const zip = new JSZip();
  zip.file('lesson.xlsx', await wb.xlsx.writeBuffer());
  zip.file('html/fractions.html', fs.readFileSync(path.join(EX, 'fractions.html')));
  zip.file('html/water-cycle.html', fs.readFileSync(path.join(EX, 'water-cycle.html')));
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  const r = await (await fetch(`${URL}/api/q/import?title=${encodeURIComponent('html import')}`, { method: 'POST', body: buf })).json();
  made.push(r.id);
  const imp = await api('/quizzes/' + r.id);
  const hq = imp.questions.filter((q) => q.type === 'html');
  ok(hq.length === 2, 'two html steps import, the one without its file is dropped', imp.questions.map((q) => q.type));
  ok(hq[0] && hq[0].html.phones === false && hq[0].notes === 'שאלו: כמה פרוסות?' && /^[\w.-]+\.html$/.test(hq[0].html.file), 'the Html column and Notes are read');
  ok(hq[1] && hq[1].html.phones === true, '"|phones" puts it on the phones');
  const m = await fetch(`${URL}/media/${r.id}/${hq[0].html.file}`);
  ok(m.status === 200 && (await m.text()).includes('שברים'), 'the file from the zip is stored and served');
  ok((r.issues || []).some((i) => /nope\.html/.test(i.reason)), 'the missing file is reported with its name', r.issues);

  // ---- the package carries the html along
  const pkg = await fetch(`${URL}/api/q/quizzes/${r.id}/package`);
  const pz = await JSZip.loadAsync(Buffer.from(await pkg.arrayBuffer()));
  ok(Object.keys(pz.files).some((n) => /media\/.*\.html$/.test(n)), 'a quiz package includes the HTML files');
  const copy = await (await fetch(`${URL}/api/q/import?title=copy`, { method: 'POST', body: Buffer.from(await pz.generateAsync({ type: 'nodebuffer' })) })).json();
  made.push(copy.id);
  const cq = (await api('/quizzes/' + copy.id)).questions.find((q) => q.type === 'html');
  const cm = cq && (await fetch(`${URL}/media/${copy.id}/${cq.html.file}`));
  ok(cm && cm.status === 200, 'an imported package still plays the activity');

  for (const id of made) await api('/quizzes/' + id, 'DELETE');
  console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(' | ')}` : 'html-test: all passed');
  process.exit(fails.length ? 1 : 0);
})();
