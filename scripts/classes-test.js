// Class rosters and progress, and the no-score learning style. node scripts/classes-test.js (server running)
// Start the server with REPORTS_DIR pointing at a temporary folder so the reports it writes stay out of the real ones.
const { io } = require('socket.io-client');
const Q = require('../questions/sample.json');
const URL = process.env.QG_URL || 'http://localhost:3000';
let failed = 0;
const ok = (c, m, extra) => {
  if (!c) failed++;
  console.log(c ? '  ✔' : '  ✘ FAIL', m, c || extra === undefined ? '' : JSON.stringify(extra));
};
const api = async (p, method = 'GET', body) => {
  const r = await fetch(URL + '/api/q' + p, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// one game of 5 sample questions with the class chosen: right[name] = how many of the 5 the bot answers correctly
async function play(classId, names, right, extra = {}) {
  const host = io(URL);
  let hs = null;
  let last = '';
  host.on('host:state', (s) => {
    hs = s;
    const b = s.board;
    if (s.phase !== 'playing' || !b) return;
    const key = b.stage + b.index;
    if (key === last) return;
    last = key;
    if (b.stage !== 'question') setTimeout(() => host.emit('host:next'), 150);
  });
  const room = await new Promise((res) => host.emit('host:create', { game: 'classic' }, res));
  host.emit('host:setup', { classId });
  host.emit('host:settings', { count: 5, advance: 'manual', ...extra });
  await wait(300);
  const checked = await new Promise((res) => { const s = io(URL); s.emit('player:check', { pin: room.pin }, (r) => { s.close(); res(r); }); });
  const bots = names.map((name) => {
    const s = io(URL);
    let n = 0;
    s.on('you', (y) => {
      s.last = y;
      if (y.phase !== 'c_question') return;
      const q = Q.find((x) => x.text === y.question.text);
      const rightIdx = y.question.options.indexOf(q.options[q.answer]);
      const wrong = (rightIdx + 1) % y.question.options.length;
      const c = n++ < right[name] ? rightIdx : wrong;
      setTimeout(() => s.emit('player:action', { type: 'answer', data: { choice: c, qid: y.qid } }), 100);
    });
    return s;
  });
  for (const [i, s] of bots.entries()) await new Promise((res) => s.emit('player:join', { pin: room.pin, name: names[i] }, res));
  await wait(400);
  host.emit('host:start');
  const t0 = Date.now();
  while (Date.now() - t0 < 90000 && (!hs || hs.phase !== 'ended')) await wait(300);
  await wait(500); // the report is written when the game ends
  const out = { checked, state: hs, bots, host };
  return out;
}

(async () => {
  // ---------- class API ----------
  let r = await api('/classes', 'POST', { name: 'כיתה ז1', students: 'דנה\nיוסי, נועה\n  דנה  \n\nמיה' });
  ok(r.status === 200 && r.body.id && r.body.students.join() === 'דנה,יוסי,נועה,מיה', 'a class is saved, names cleaned and deduplicated', r.body);
  const id = r.body.id;
  r = await api('/classes', 'POST', { name: '   ', students: 'x' });
  ok(r.status >= 400 && r.body.error, 'a class needs a name', r);
  r = await api('/classes');
  ok(r.body.some((c) => c.id === id && c.count === 4), 'the class is listed with its size');
  r = await api(`/classes/${id}/progress`);
  ok(r.body.students.length === 4 && r.body.students.every((s) => s.sessions === 0) && r.body.accuracy === null && r.body.sessions.length === 0, 'progress of a new class is empty', r.body);

  // ---------- the join screen offers the class names ----------
  const g1 = await play(id, ['דנה', 'יוסי', 'אורח'], { 'דנה': 5, 'יוסי': 2, 'אורח': 0 });
  ok(g1.checked.roster && g1.checked.roster.name === 'כיתה ז1' && g1.checked.roster.students.length === 4 && g1.checked.roster.students.every((s) => !s.taken), 'the join check returns the class list', g1.checked.roster);
  ok(g1.state.phase === 'ended', 'game ended');
  [g1.host, ...g1.bots].forEach((s) => s.close());

  // a second game with another group: one more session for the class
  const g2 = await play(id, ['דנה', 'נועה'], { 'דנה': 4, 'נועה': 5 });
  [g2.host, ...g2.bots].forEach((s) => s.close());

  r = await api(`/classes/${id}/progress`);
  const P = r.body;
  const by = Object.fromEntries(P.students.map((s) => [s.name, s]));
  ok(P.sessions.length === 2, 'two games are counted for the class', P.sessions.length);
  ok(by['דנה'].sessions === 2 && by['דנה'].answered === 10 && by['דנה'].correct === 9 && by['דנה'].accuracy === 90, 'דנה: 2 games, 9 of 10 right', by['דנה']);
  ok(by['דנה'].trend.join() === '100,80', 'דנה: the trend shows accuracy per game', by['דנה'].trend);
  ok(by['יוסי'].sessions === 1 && by['יוסי'].accuracy === 40, 'יוסי: 2 of 5 right in one game', by['יוסי']);
  ok(by['נועה'].accuracy === 100 && by['נועה'].sessions === 1, 'נועה: 5 of 5', by['נועה']);
  ok(by['מיה'].sessions === 0 && by['מיה'].accuracy === null, 'מיה is on the list but did not play', by['מיה']);
  ok(by['אורח'] && by['אורח'].inClass === false && by['אורח'].accuracy === 0, 'a guest who is not on the list is shown as a guest', by['אורח']);
  ok(P.accuracy === Math.round((9 + 2 + 5 + 0) / 25 * 100) && P.answered === 25, 'the class accuracy covers every answer', P.accuracy);
  ok(P.sessions[0].players >= 2 && P.sessions[0].quiz, 'each game shows its quiz and players', P.sessions[0]);

  // a game without the class is not counted
  const g3 = await play('', ['דנה'], { 'דנה': 5 });
  [g3.host, ...g3.bots].forEach((s) => s.close());
  r = await api(`/classes/${id}/progress`);
  ok(r.body.sessions.length === 2, 'a game played without the class is not counted');

  // ---------- the gradebook ----------
  r = await api(`/classes/${id}/progress`);
  const gr = r.body.grades;
  const gd = gr.rows.find((x) => x.name === 'דנה');
  ok(gr.columns.length === 2 && gr.rows.length === r.body.students.length, 'gradebook: a column per game, a row per student', [gr.columns.length, gr.rows.length]);
  ok(gd && gd.values.join() === '100,80', 'gradebook: דנה 100% then 80%, oldest game first', gd);
  const gm = gr.rows.find((x) => x.name === 'מיה');
  ok(gm && gm.values.every((v) => v === null), 'gradebook: a student who did not play has empty cells', gm);

  // ---------- teacher notes ----------
  r = await api(`/classes/${id}/notes`, 'PUT', { name: 'דנה', text: '  חזקה בחשבון  ' });
  ok(r.body.note === 'חזקה בחשבון', 'a note is saved (trimmed)', r.body);
  r = await api(`/classes/${id}/progress`);
  ok(r.body.students.find((x) => x.name === 'דנה').note === 'חזקה בחשבון' && r.body.students.find((x) => x.name === 'יוסי').note === '', 'the progress shows the note, others have none');
  await api(`/classes/${id}/notes`, 'PUT', { name: 'דנה', text: '' });
  r = await api(`/classes/${id}/progress`);
  ok(r.body.students.find((x) => x.name === 'דנה').note === '', 'an empty note removes it');
  r = await api(`/classes/nope/notes`, 'PUT', { name: 'דנה', text: 'x' });
  ok(r.status >= 400, 'a note for an unknown class is refused');

  // ---------- a class list from a file ----------
  const parse = async (name, body) => (await fetch(URL + '/api/q/classes/parse?name=' + encodeURIComponent(name), { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body })).json();
  let pr = await parse('people.csv', 'First Name,Last Name,Email\nDana,Cohen,a@x\nYossi,Levi,b@x\nDana,Levi,c@x\n');
  ok(pr.students.join() === 'Dana C,Yossi,Dana L', 'CSV with First / Last name columns: first names, last initial only for duplicates', pr);
  pr = await parse('names.txt', '﻿דנה כהן\nיוסי לוי\n\nנועה בר-אילן ארוכה מאוד\n');
  ok(pr.students[0] === 'דנה כהן' && pr.students[1] === 'יוסי לוי' && pr.students[2].length <= 14, 'plain text lines (with a BOM); a too-long name is shortened', pr.students);
  pr = await parse('list.csv', 'שם,כיתה\n"דנה, כהן",ז1\nיוסי,ז1\n');
  ok(pr.students.length === 2 && pr.students[0] === 'דנה, כהן', 'a CSV with a "שם" column and a quoted comma', pr.students);
  const wbx = new (require('exceljs').Workbook)();
  const wsx = wbx.addWorksheet('Class');
  wsx.addRow(['#', 'שם התלמיד']);
  wsx.addRow([1, 'אורי']);
  wsx.addRow([2, 'שירה']);
  pr = await parse('class.xlsx', Buffer.from(await wbx.xlsx.writeBuffer()));
  ok(pr.students.join() === 'אורי,שירה', 'an Excel file with a header row', pr);
  pr = await parse('empty.csv', '');
  ok(pr.students.length === 0, 'an empty file gives no names');

  // ---------- flashcards as CSV ----------
  const cq = await api('/quizzes', 'POST', { title: 'cards test' });
  await api('/quizzes/' + cq.body.id, 'PUT', { title: 'cards test', questions: [
    { type: 'quiz', text: 'Capital of France?', time: 20, explain: 'On the Seine', answers: [{ text: 'Paris', correct: true }, { text: 'Rome' }] },
    { type: 'slide', text: 'A slide' },
    { type: 'match', text: 'Match them', time: 30, pairs: [{ a: 'cat', b: 'meow' }, { a: 'dog', b: 'woof' }] },
    { type: 'poll', text: 'A poll', answers: [{ text: 'x' }, { text: 'y' }] },
  ] });
  const csvRes = await fetch(`${URL}/api/q/quizzes/${cq.body.id}/cards.csv`);
  const csv = Buffer.from(await csvRes.arrayBuffer()).toString('utf8'); // .text() would drop the BOM
  ok(csvRes.status === 200 && csv.startsWith('﻿"Front","Back","Explanation"'), 'the cards CSV has a BOM and a header');
  ok(csv.includes('"Capital of France?","Paris","On the Seine"') && csv.includes('"Match them","cat = meow') && csv.includes('dog = woof",""'), 'a card per scored question', csv);
  ok(!csv.includes('A slide') && !csv.includes('A poll'), 'slides and polls are not cards');
  await api('/quizzes/' + cq.body.id, 'DELETE');
  const pg = await fetch(URL + '/print.html?quiz=x');
  ok(pg.status === 200 && /print\.js/.test(await pg.text()), 'the print page is served');

  // ---------- taken names ----------
  const host = io(URL);
  const room = await new Promise((res) => host.emit('host:create', { game: 'classic' }, res));
  host.emit('host:setup', { classId: id });
  await wait(200);
  const p1 = io(URL);
  await new Promise((res) => p1.emit('player:join', { pin: room.pin, name: 'נועה' }, res));
  const chk = await new Promise((res) => { const s = io(URL); s.emit('player:check', { pin: room.pin }, (x) => { s.close(); res(x); }); });
  ok(chk.roster.students.find((s) => s.name === 'נועה').taken === true && chk.roster.students.find((s) => s.name === 'דנה').taken === false, 'a name that is in use is marked taken', chk.roster);
  const dup = await new Promise((res) => { const s = io(URL); s.emit('player:join', { pin: room.pin, name: 'נועה' }, (x) => { s.close(); res(x); }); });
  ok(dup.ok === false, 'two phones cannot take the same name', dup);
  host.emit('host:setup', { classId: 'does-not-exist' });
  await wait(200);
  const none = await new Promise((res) => { const s = io(URL); s.emit('player:check', { pin: room.pin }, (x) => { s.close(); res(x); }); });
  ok(none.roster === null, 'an unknown class id is ignored', none.roster);
  [host, p1].forEach((s) => s.close());

  // ---------- edit and delete ----------
  r = await api(`/classes/${id}`, 'PUT', { name: 'כיתה ז1 (חדש)', students: ['דנה', 'יוסי'] });
  ok(r.body.name === 'כיתה ז1 (חדש)' && r.body.students.length === 2, 'a class can be renamed and shortened');
  r = await api(`/classes/${id}/progress`);
  ok(r.body.students.some((s) => s.name === 'נועה' && !s.inClass && s.sessions === 1), 'a student removed from the list stays in the history as a guest', r.body.students.map((s) => [s.name, s.inClass]));
  await api(`/classes/${id}`, 'DELETE');
  r = await api('/classes');
  ok(!r.body.some((c) => c.id === id), 'a class can be deleted');
  r = await api(`/classes/${id}/progress`);
  ok(r.status >= 400, 'progress of a deleted class is an error');

  // ---------- the learning style ----------
  const g4 = await play('', ['דנה', 'יוסי'], { 'דנה': 5, 'יוסי': 2 }, { style: 'learn' });
  const res = g4.state.results;
  ok(res.style === 'learn' && res.scored === 5, 'learning style: results say so', res);
  ok(res.players.every((p) => p.score === 0), 'learning style: nobody earns points', res.players.map((p) => p.score));
  ok(res.players.find((p) => p.name === 'דנה').correct === 5 && res.players.find((p) => p.name === 'יוסי').correct === 2, 'learning style: right answers are still counted', res.players.map((p) => [p.name, p.correct]));
  [g4.host, ...g4.bots].forEach((s) => s.close());

  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
