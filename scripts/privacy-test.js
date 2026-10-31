// What the class sees of the results (classic quiz option "privacy"): node scripts/privacy-test.js (server running)
// full = as always; anon = class statistics, no names / points / leaderboard; none = no statistics. The teacher can always peek.
const { io } = require('socket.io-client');
const URL = process.env.QG_URL || 'http://localhost:3000';
let failed = 0;
const ok = (c, m, extra) => {
  if (!c) failed++;
  console.log(c ? '  ✔' : '  ✘ FAIL', m, c || extra === undefined ? '' : JSON.stringify(extra));
};
const api = async (p, method = 'GET', body) => (await fetch(URL + '/api/q' + p, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(privacy, quizId) {
  const host = io(URL);
  let hs = null;
  host.on('host:state', (s) => (hs = s));
  const room = await new Promise((res) => host.emit('host:create', { game: 'classic' }, res));
  host.emit('host:setup', { quiz: quizId });
  host.emit('host:settings', { privacy, advance: 'auto', style: 'speed', surprise: 'off', count: 2 });
  await wait(300);
  const seen = { stages: new Set(), reveal: null, you: null, lines: [] };
  const make = (name, wrong) => {
    const s = io(URL);
    s.on('you', (y) => {
      if (name === 'Ann' && y.phase === 'c_result') seen.you = y; // the phone's result screen
      if (y.phase === 'c_question') {
        const o = y.question.options;
        setTimeout(() => s.emit('player:action', { type: 'answer', data: { choice: o.indexOf(wrong ? 'wrong' : 'right'), qid: y.qid } }), 150);
      }
    });
    s.emit('player:join', { pin: room.pin, name }, () => {});
    return s;
  };
  const kids = [make('Ann', false), make('Bob', true)];
  await wait(500);
  host.emit('host:start');
  const t0 = Date.now();
  let peek = null;
  while (hs.phase !== 'ended' && Date.now() - t0 < 60000) {
    await wait(150);
    if (hs.board) {
      seen.stages.add(hs.board.stage);
      if (hs.board.stage === 'reveal' && hs.board.reveal && !seen.reveal) {
        seen.reveal = hs.board.reveal;
        seen.lines = hs.board.lines || [];
        peek = await new Promise((res) => host.emit('host:peek', {}, res));
      }
    }
  }
  const res = hs.results;
  kids.forEach((k) => k.close());
  host.emit('host:end');
  host.close();
  return { seen, peek, res, privacy: hs.board && hs.board.privacy };
}

(async () => {
  const quiz = await api('/quizzes', 'POST', { title: 'privacy test' });
  const qs = [1, 2].map((n) => ({ type: 'quiz', text: 'Question ' + n, time: 10, answers: [{ text: 'right', correct: true }, { text: 'wrong' }] }));
  await api('/quizzes/' + quiz.id, 'PUT', { title: 'privacy test', questions: qs });

  console.log('full:');
  let r = await run('full', quiz.id);
  ok(r.seen.stages.has('board'), 'the leaderboard stage is shown');
  ok(r.seen.reveal && r.seen.reveal.dist.every((x) => typeof x === 'number'), 'the answer counts are shown');
  ok(r.seen.you && !r.seen.you.quiet, 'phones show points and rank');
  ok(r.res.players.length === 2 && r.res.style !== 'learn', 'the podium results have names');

  console.log('anon:');
  r = await run('anon', quiz.id);
  ok(!r.seen.stages.has('board'), 'no leaderboard stage', [...r.seen.stages]);
  ok(r.seen.reveal && r.seen.reveal.dist.some((x) => x > 0) && r.seen.reveal.right === 1, 'the class statistics are shown (1 right)', r.seen.reveal && r.seen.reveal.dist);
  ok(r.seen.you && r.seen.you.quiet === true, 'phones hide points and rank');
  ok(r.seen.lines.every((l) => !/Ann|Bob/.test(l)), 'no names in the lines', r.seen.lines);
  ok(r.res.players.length === 0 && r.res.style === 'learn', 'the end screen is a class summary with no names');
  ok(r.peek && r.peek.ok && r.peek.rows.length === 2 && r.peek.rows.some((x) => x.name === 'Ann' && x.ok === true) && r.peek.rows.some((x) => x.name === 'Bob' && x.ok === false), 'the teacher can still peek: who was right and who was wrong', r.peek);
  ok(r.peek && r.peek.rows.find((x) => x.name === 'Bob').chosen === 'wrong', 'and what each one answered');

  console.log('none:');
  r = await run('none', quiz.id);
  ok(!r.seen.stages.has('board'), 'no leaderboard stage');
  ok(r.seen.reveal && r.seen.reveal.hide === true && r.seen.reveal.dist.every((x) => x === null), 'no answer counts', r.seen.reveal && r.seen.reveal.dist);
  ok(r.seen.lines.length === 0, 'no lines about the class');
  ok(r.peek && r.peek.ok && r.peek.dist && r.peek.dist.some((x) => x > 0), 'the teacher still sees the counts when peeking', r.peek && r.peek.dist);

  await api('/quizzes/' + quiz.id, 'DELETE');
  console.log(failed ? `${failed} FAILED` : 'all passed');
  process.exit(failed ? 1 : 0);
})();
