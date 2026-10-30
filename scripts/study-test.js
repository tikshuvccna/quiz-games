// "תרגול ולמידה": mastery, flashcards and the test, with bots. node scripts/study-test.js (server running)
const { io } = require('socket.io-client');
const URL = process.env.QG_URL || 'http://localhost:3000';
let failed = 0;
const ok = (c, m, extra) => {
  if (!c) failed++;
  console.log(c ? '  ✔' : '  ✘ FAIL', m, c || extra === undefined ? '' : JSON.stringify(extra));
};
const api = async (p, method = 'GET', body) => (await fetch(URL + '/api/q' + p, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const QUESTIONS = [
  { type: 'quiz', text: 'Capital of France?', time: 20, explain: 'Paris is on the Seine.', answers: [{ text: 'Paris', correct: true }, { text: 'Rome' }, { text: 'Oslo' }, { text: 'Bern' }] },
  { type: 'quiz', text: '2 + 2 ?', time: 20, answers: [{ text: '4', correct: true }, { text: '3' }, { text: '5' }] },
  { type: 'tf', text: 'The sun is a star', time: 10, answers: [{ text: 'נכון', correct: true }, { text: 'לא נכון' }] },
  { type: 'type', text: 'Largest planet?', time: 20, accept: ['Jupiter'] },
];
const RIGHT = { 'Capital of France?': 'Paris', '2 + 2 ?': '4', 'The sun is a star': 'נכון' };

// plays one game; behave(name, y, emit) decides what each bot does on its phone
async function play(kind, names, behave) {
  const host = io(URL);
  let hs = null;
  const hostSeen = { stuck: false, kinds: new Set() };
  host.on('host:state', (s) => {
    hs = s;
    if (s.phase === 'playing' && s.board && s.board.kind === 'study') {
      hostSeen.kinds.add(s.board.mode);
      if (s.board.players.some((p) => p.stuck)) hostSeen.stuck = true;
      hostSeen.last = s.board;
    }
  });
  const room = await new Promise((res) => host.emit('host:create', { game: 'study' }, res));
  host.emit('host:setup', { quiz: play.quiz });
  host.emit('host:settings', { kind, order: 'original' });
  await wait(300);
  const phases = {};
  const bots = names.map((name) => {
    const s = io(URL);
    phases[name] = new Set();
    s.on('you', (y) => {
      s.me = y;
      phases[name].add(y.phase);
      behave(name, y, (type, data) => setTimeout(() => s.emit('player:action', { type, data: { ...data, qid: y.qid } }), 40));
    });
    return s;
  });
  for (const [i, s] of bots.entries()) await new Promise((res) => s.emit('player:join', { pin: room.pin, name: names[i] }, res));
  await wait(400);
  host.emit('host:start');
  const t0 = Date.now();
  while (Date.now() - t0 < 60000 && (!hs || hs.phase !== 'ended')) await wait(250);
  return { hs, bots, host, phases, hostSeen };
}
const close = (g) => [g.host, ...g.bots].forEach((s) => s.close());

(async () => {
  const quiz = await api('/quizzes', 'POST', { title: 'study test' });
  await api('/quizzes/' + quiz.id, 'PUT', { title: 'study test', questions: QUESTIONS });
  play.quiz = quiz.id;

  // ---------- mastery ----------
  console.log('mastery');
  const seen = new Map(); // name+question -> how many times it was shown
  const answers = { A: 0, B: 0, C: 0 };
  let sawMastered = false;
  let g = await play('mastery', ['A', 'B', 'C'], (name, y, emit) => {
    if (y.phase === 'st_question') {
      const q = y.question;
      const key = name + q.text;
      const n = (seen.get(key) || 0) + 1;
      seen.set(key, n);
      answers[name]++;
      const good = q.type === 'type' ? { text: 'jupiter' } : { choice: q.options.indexOf(RIGHT[q.text]) };
      const bad = q.type === 'type' ? { text: 'saturn' } : { choice: (q.options.indexOf(RIGHT[q.text]) + 1) % q.options.length };
      // A is always right; B is wrong the first time it sees each question; C is wrong 3 times in a row at the start
      const wrong = name === 'B' ? n === 1 : name === 'C' ? answers.C <= 3 : false;
      emit('answer', wrong ? bad : good);
    } else if (y.phase === 'st_feedback') {
      if (y.last.mastered) sawMastered = true;
      emit('next', {});
    }
  });
  let res = g.hs.results;
  const by = Object.fromEntries(res.players.map((p) => [p.name, p]));
  ok(g.hs.phase === 'ended' && res.mode === 'mastery', 'the game closes by itself when everybody is done');
  ok(by.A.pct === 100 && by.A.correct === 8 && by.A.wrong === 0, 'A: 4 questions x 2 right answers each = 8 answers, 100%', by.A);
  ok(by.B.pct === 100 && by.B.wrong === 4 && by.B.correct === 8, 'B: wrong once on every question, still reaches 100% (questions came back)', by.B);
  ok(by.C.wrong === 3 && by.C.pct === 100, 'C: 3 wrong in a row, then recovers', by.C);
  ok(g.hostSeen.stuck, 'the teacher\'s board flags a student with 3 wrong in a row as stuck');
  ok(sawMastered && g.phases.A.has('st_feedback') && g.phases.A.has('st_done'), 'feedback with "mastered" and the done screen were shown');
  close(g);

  // ---------- flashcards ----------
  console.log('flashcards');
  let cardOk = true;
  const againSeen = new Set();
  g = await play('flashcards', ['A', 'B'], (name, y, emit) => {
    if (y.phase !== 'st_card') return;
    const c = y.card;
    if (RIGHT[c.text] !== undefined && c.back !== RIGHT[c.text]) cardOk = false;
    if (c.text === 'Capital of France?' && !c.explain) cardOk = false;
    emit('card', { known: name === 'A' ? true : againSeen.has(name + c.text) || (againSeen.add(name + c.text), false) });
  });
  res = g.hs.results;
  const fc = Object.fromEntries(res.players.map((p) => [p.name, p]));
  ok(g.hs.phase === 'ended' && res.mode === 'flashcards', 'flashcards: the game closes when everybody is done');
  ok(fc.A.pct === 100 && fc.A.again === 0 && fc.B.pct === 100 && fc.B.again === 4, 'A knew all 4; B pressed "again" once on every card and then knew them', [fc.A, fc.B]);
  ok(cardOk, 'the back of each card shows the right answer and the explanation');
  ok(!g.phases.A.has('st_question') && !g.phases.A.has('st_feedback'), 'flashcards show cards only');
  close(g);

  // ---------- test ----------
  console.log('test');
  let review = null;
  g = await play('test', ['A', 'B'], (name, y, emit) => {
    if (y.phase === 'st_question') {
      const q = y.question;
      const good = q.type === 'type' ? { text: 'Jupiter' } : { choice: q.options.indexOf(RIGHT[q.text]) };
      const bad = q.type === 'type' ? { text: 'Mars' } : { choice: (q.options.indexOf(RIGHT[q.text]) + 1) % q.options.length };
      emit('answer', name === 'A' ? good : bad);
    } else if (y.phase === 'st_done' && name === 'B') review = y.review;
  });
  res = g.hs.results;
  const tp = Object.fromEntries(res.players.map((p) => [p.name, p]));
  ok(g.hs.phase === 'ended' && res.mode === 'test', 'test: the game closes when everybody is done');
  ok(tp.A.correct === 4 && tp.A.wrong === 0 && tp.B.correct === 0 && tp.B.wrong === 4, 'A: 4 of 4, B: 0 of 4', [tp.A, tp.B]);
  ok(!g.phases.A.has('st_feedback') && !g.phases.B.has('st_feedback'), 'no feedback during the test');
  ok(review && review.length === 4 && review.every((r) => !r.ok && r.answer) && review.some((r) => r.explain), 'B gets a summary with every mistake, the right answer and the explanation', review && review.length);
  close(g);

  // ---------- the report ----------
  await api('/quizzes/' + quiz.id, 'DELETE');
  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
