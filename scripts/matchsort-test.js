// Matching and sorting in the classic quiz: full, partial and wrong answers. node scripts/matchsort-test.js (server running)
const { io } = require('socket.io-client');
const URL = process.env.QG_URL || 'http://localhost:3000';
let failed = 0;
const ok = (c, m, extra) => {
  if (!c) failed++;
  console.log(c ? '  ✔' : '  ✘ FAIL', m, c || extra === undefined ? '' : JSON.stringify(extra));
};
const api = async (p, method = 'GET', body) => (await fetch(URL + '/api/q' + p, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json();

(async () => {
  const quiz = await api('/quizzes', 'POST', { title: 'match sort test' });
  await api('/quizzes/' + quiz.id, 'PUT', { title: 'match sort test', questions: [
    { type: 'match', text: 'Connect', time: 10, pairs: [{ a: 'cat', b: 'meow' }, { a: 'dog', b: 'woof' }, { a: 'cow', b: 'moo' }, { a: 'duck', b: 'quack' }] },
    { type: 'sort', text: 'Sort', time: 10, buckets: [{ name: 'Fruit', items: ['apple', 'pear'] }, { name: 'Veg', items: ['carrot', 'onion'] }] },
  ] });
  const host = io(URL);
  let hs = null;
  let last = '';
  const reveals = {};
  host.on('host:state', (s) => {
    hs = s;
    const b = s.board;
    if (s.phase !== 'playing' || !b) return;
    const key = b.stage + b.index;
    if (key === last) return;
    last = key;
    if (b.reveal && b.q) reveals[b.q.type] = b.reveal;
    if (b.stage !== 'question') setTimeout(() => host.emit('host:next'), 200);
  });
  const room = await new Promise((res) => host.emit('host:create', { game: 'classic' }, res));
  host.emit('host:setup', { quiz: quiz.id });
  host.emit('host:settings', { advance: 'manual' });
  await new Promise((r) => setTimeout(r, 300));
  const SOUND = { cat: 'meow', dog: 'woof', cow: 'moo', duck: 'quack' };
  const KIND = { apple: 0, pear: 0, carrot: 1, onion: 1 };
  // dana: all right, yossi: half right, noa: all wrong
  const bots = ['דנה', 'יוסי', 'נועה'].map((name, k) => {
    const s = io(URL);
    s.on('you', (y) => {
      if (y.phase !== 'c_question') return;
      const q = y.question;
      let data;
      if (q.type === 'match') {
        const right = q.left.map((l) => q.right.indexOf(SOUND[l]));
        if (k === 0) data = { match: right };
        else if (k === 1) data = { match: [right[1], right[0], right[2], right[3]] }; // 2 of 4 right
        else data = { match: right.map((_, i) => right[(i + 1) % 4]) }; // every pair shifted: all wrong
      } else {
        const good = q.items.map((t) => KIND[t]);
        data = { sort: k === 0 ? good : k === 1 ? good.map((v, i) => (i === 0 ? 1 - v : v)) : good.map((v) => 1 - v) };
      }
      setTimeout(() => s.emit('player:action', { type: 'answer', data: { ...data, qid: y.qid } }), 100 + k * 50);
    });
    s.emit('player:join', { pin: room.pin, name }, () => {});
    return s;
  });
  await new Promise((r) => setTimeout(r, 500));
  host.emit('host:start');
  const t0 = Date.now();
  while (Date.now() - t0 < 90000 && (!hs || hs.phase !== 'ended')) await new Promise((r) => setTimeout(r, 300));
  ok(hs.phase === 'ended', 'game ended');
  const M = reveals.match;
  ok(M && M.right === 1 && M.pairs.length === 4 && M.avgPct === Math.round(((1 + 0.5 + 0) / 3) * 100), 'match: one perfect answer, average 50%', M && [M.right, M.avgPct]);
  const S = reveals.sort;
  ok(S && S.right === 1 && S.buckets.length === 2 && S.avgPct === Math.round(((1 + 0.75 + 0) / 3) * 100), 'sort: one perfect answer, average 58%', S && [S.right, S.avgPct]);
  const p = Object.fromEntries(hs.results.players.map((x) => [x.name, x]));
  ok(p['דנה'].score > p['יוסי'].score && p['יוסי'].score > p['נועה'].score, 'scores: perfect > partial credit > wrong', hs.results.players.map((x) => [x.name, x.score]));
  ok(p['דנה'].correct === 2 && p['יוסי'].correct === 0 && p['נועה'].wrong === 2, 'only a fully right answer counts as correct', hs.results.players.map((x) => [x.name, x.correct, x.wrong]));
  await api('/quizzes/' + quiz.id, 'DELETE');
  [host, ...bots].forEach((s) => s.close());
  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
