// The presenter screen: node scripts/presenter-test.js (server running).
// A second socket with the host token sees the notes and the next step, can go next / back / jump, and the class never sees the notes.
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
  const quiz = await api('/quizzes', 'POST', { title: 'presenter test' });
  const steps = [
    { type: 'slide', text: 'Welcome', layout: 'title', body: 'Hi', notes: 'SECRET NOTE ONE' },
    { type: 'slide', text: 'Second', layout: 'bullets', bullets: ['a', 'b'], notes: 'SECRET NOTE TWO' },
    { type: 'quiz', text: 'Pick one', time: 20, answers: [{ text: 'A', correct: true }, { text: 'B' }] },
  ];
  await api('/quizzes/' + quiz.id, 'PUT', { title: 'presenter test', questions: steps });

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
  await new Promise((res) => kid.emit('player:join', { pin: room.pin, name: 'דנה' }, res));

  // a wrong token is refused
  const bad = io(URL);
  const r0 = await new Promise((res) => bad.emit('presenter:join', { pin: room.pin, hostToken: 'nope' }, res));
  ok(r0 && r0.ok === false, 'a wrong host token is refused');
  bad.emit('presenter:cmd', { cmd: 'next' });

  // before the start: nothing to show yet
  const pr = io(URL);
  let ps = null;
  pr.on('presenter:state', (s) => (ps = s));
  const r1 = await new Promise((res) => pr.emit('presenter:join', { pin: room.pin, hostToken: room.hostToken }, res));
  ok(r1.ok && r1.state.phase === 'lobby' && !r1.state.lesson, 'joins in the lobby with no lesson data yet', r1.state);

  host.emit('host:start');
  await wait(5200);
  ok(ps && ps.lesson && ps.i === 0 && ps.total === 3, 'the presenter sees step 1 of 3', ps);
  ok(ps && ps.notes === 'SECRET NOTE ONE' && ps.label === 'Welcome', 'with its notes and title', ps);
  ok(ps && ps.next && ps.next.label === 'Second' && ps.next.notes === 'SECRET NOTE TWO', 'and what comes next, with its notes', ps && ps.next);
  ok(ps && ps.outline.length === 3, 'and the outline');
  ok(!JSON.stringify(you).includes('SECRET') && !JSON.stringify(hs.board).includes('SECRET'), 'the notes are not sent to the students or to the big screen');

  pr.emit('presenter:cmd', { cmd: 'next' });
  await wait(700);
  ok(ps.i === 1 && ps.notes === 'SECRET NOTE TWO', 'next moves the lesson on', ps);
  pr.emit('presenter:cmd', { cmd: 'prev' });
  await wait(700);
  ok(ps.i === 0, 'back works', ps.i);
  pr.emit('presenter:cmd', { cmd: 'goto', arg: 2 });
  await wait(700);
  ok(ps.i === 2 && ps.type === 'quiz' && ps.notes === '' && ps.next === null && ps.last === true, 'jumping to the last step: a question, no notes, nothing next', ps);
  pr.emit('presenter:cmd', { cmd: 'goto', arg: 99 });
  pr.emit('presenter:cmd', { cmd: 'explode' });
  await wait(400);
  ok(ps.i === 2, 'a bad jump and an unknown command are ignored');
  ok(hs.board && hs.board.index === 2, 'the big screen followed the presenter');

  host.emit('host:end');
  await wait(600);
  ok(ps.phase === 'ended', 'the presenter is told the lesson ended', ps.phase);

  await fetch(`${URL}/api/q/quizzes/${quiz.id}`, { method: 'DELETE' });
  [host, kid, pr, bad].forEach((s) => s.close());
  console.log(failed ? `${failed} FAILED` : 'all passed');
  process.exit(failed ? 1 : 0);
})();
