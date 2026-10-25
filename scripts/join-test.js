// Joining a running game and coming back: node scripts/join-test.js (server running)
const { io } = require('socket.io-client');
const Q = require('../questions/sample.json');
const URL = process.env.QG_URL || 'http://localhost:3000';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (cond, msg, extra) => { if (!cond) failed++; console.log(cond ? '  ✔' : '  ✘ FAIL', msg, cond || extra === undefined ? '' : JSON.stringify(extra)); };

// a bot that answers right and plays the gems catch round
function bot(pin, name) {
  const s = io(URL, { forceNew: true });
  s.me = null;
  s.on('you', (y) => {
    s.me = y;
    if (y.phase === 'question') {
      const q = Q.find((x) => x.text === y.question.text);
      setTimeout(() => s.emit('player:action', { type: 'answer', data: { choice: y.question.options.indexOf(q.options[q.answer]), qid: y.qid } }), 30);
    } else if (y.phase === 'catch') setTimeout(() => s.emit('player:action', { type: 'catch', data: { ids: y.catch.items.filter((i) => i.k !== 'bomb' && i.k !== 'rock').map((i) => i.id) } }), 60);
  });
  s.join = () => new Promise((res) => s.emit('player:join', { pin, name }, (r) => res((s.joined = r))));
  return s;
}

(async () => {
  const host = io(URL, { forceNew: true });
  let hs = null;
  host.on('host:state', (s) => (hs = s));
  const r = await new Promise((res) => host.emit('host:create', { game: 'gems' }, res));
  const pin = r.pin;
  host.emit('host:game', 'gems');
  host.emit('host:settings', { duration: 120 });
  const a = bot(pin, 'דנה');
  await a.join();
  await wait(200);
  host.emit('host:start');
  await wait(4500);

  console.log('late join');
  const chk = await new Promise((res) => io(URL, { forceNew: true }).emit('player:check', { pin }, res));
  ok(chk.ok && chk.running, 'the code is accepted while the game runs', chk);
  const b = bot(pin, 'יוסי');
  const jr = await b.join();
  ok(jr.ok, 'a new player joins mid-game', jr);
  await wait(800);
  ok(b.me && b.me.phase !== 'spectate' && b.me.phase !== 'lobby', `the late player plays right away (phase ${b.me && b.me.phase})`);
  ok(hs.board.ranking.some((x) => x.name === 'יוסי'), 'the late player is on the big screen');

  console.log('coming back with the same name');
  await wait(3000);
  const before = a.me.stats.correct;
  a.close();
  await wait(600);
  ok(hs.players.find((p) => p.name === 'דנה').connected === false, 'the player who left shows as disconnected');
  const a2 = bot(pin, 'דנה');
  const back = await a2.join();
  await wait(600);
  ok(back.ok && back.back, 'the same name brings them back', back);
  ok(a2.me && a2.me.stats.correct >= before && before > 0, `their progress is kept (${before} → ${a2.me && a2.me.stats.correct} correct)`);
  ok(hs.players.filter((p) => p.name === 'דנה').length === 1, 'no duplicate player');

  console.log('a name that is in use by a connected player');
  const c = bot(pin, 'יוסי');
  const cr = await c.join();
  ok(!cr.ok && /תפוס/.test(cr.error), 'is refused', cr);

  console.log('the remembered seat (soft rejoin)');
  const s3 = io(URL, { forceNew: true });
  const soft = await new Promise((res) => s3.emit('player:rejoin', { pin, token: back.token, soft: true }, res));
  ok(!soft.ok, 'does not take over a player who is still connected in another tab');
  a2.close();
  await wait(400);
  const soft2 = await new Promise((res) => s3.emit('player:rejoin', { pin, token: back.token, soft: true }, res));
  ok(soft2.ok, 'takes the seat back when that tab is gone');

  host.emit('host:end');
  await wait(300);
  [host, a, b, c, s3].forEach((s) => s.close());
  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
  process.exit(failed ? 1 : 0);
})();
