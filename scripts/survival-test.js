// Classic quiz survival (lives) and "the last question counts double": node scripts/survival-test.js (server running)
const { io } = require('socket.io-client');
const URL = process.env.QG_URL || 'http://localhost:3000';
let failed = 0;
const ok = (c, m, extra) => {
  if (!c) failed++;
  console.log(c ? '  ✔' : '  ✘ FAIL', m, c || extra === undefined ? '' : JSON.stringify(extra));
};
const api = async (p, method = 'GET', body) => (await fetch(URL + '/api/q' + p, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const qs = [1, 2, 3, 4].map((n) => ({ type: 'quiz', text: 'Question ' + n, time: 10, answers: [{ text: 'right', correct: true }, { text: 'wrong' }] }));
  const quiz = await api('/quizzes', 'POST', { title: 'survival test' });
  await api('/quizzes/' + quiz.id, 'PUT', { title: 'survival test', questions: qs });

  const host = io(URL);
  let hs = null;
  host.on('host:state', (s) => (hs = s));
  const room = await new Promise((res) => host.emit('host:create', { game: 'classic' }, res));
  host.emit('host:setup', { quiz: quiz.id });
  host.emit('host:settings', { lives: 1, final: 'double', advance: 'auto', style: 'speed', surprise: 'off' });
  await wait(300);
  const seen = { lastPoints: null, qs: [] };
  // the bots always pick the first answer unless told to pick the other: "Wally" always picks wrong
  const make = (name, wrong) => {
    const s = io(URL);
    s.me = null;
    s.on('you', (y) => {
      s.me = y;
      if (y.phase === 'c_question') {
        const opts = y.question.options;
        const right = opts.indexOf('right');
        const pick = wrong ? opts.indexOf('wrong') : right;
        if (name === 'Ann') { seen.qs.push(y.question.text); seen.lastPoints = y.question.points; }
        setTimeout(() => s.emit('player:action', { type: 'answer', data: { choice: pick, qid: y.qid } }), 200);
      }
    });
    s.emit('player:join', { pin: room.pin, name }, () => {});
    return s;
  };
  const ann = make('Ann', false);
  const bob = make('Bob', false);
  const wally = make('Wally', true);
  await wait(600);
  host.emit('host:start');
  await wait(15000);

  ok(wally.me && wally.me.lives === 0, 'one wrong answer costs the only life', wally.me && wally.me.lives);
  ok(ann.me && ann.me.lives === 1, 'the others keep their life', ann.me && ann.me.lives);
  ok(wally.me && wally.me.phase !== 'c_question', 'a player who is out only watches');
  // wait until the end (auto advance)
  const t0 = Date.now();
  while (hs.phase === 'playing' && Date.now() - t0 < 110000) await wait(500);
  ok(hs.phase === 'ended', 'the game ends', hs.phase);
  ok(seen.qs.length === 4, 'the survivors play every question', seen.qs);
  const res = hs.results;
  const top = res && res.players && res.players[0];
  ok(top && top.name !== 'Wally', 'the knocked-out player is not the winner', res && res.players.map((p) => p.name));
  ok(seen.lastPoints === 2, 'the last question is shown as ×2', seen.lastPoints);

  host.emit('host:end');
  await api('/quizzes/' + quiz.id, 'DELETE');
  [host, ann, bob, wally].forEach((s) => s.close());
  console.log(failed ? `${failed} FAILED` : 'all passed');
  process.exit(failed ? 1 : 0);
})();
