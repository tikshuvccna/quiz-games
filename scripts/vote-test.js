// Choosing the game by lottery or by a class vote: node scripts/vote-test.js (server running). Prints one summary line.
const { io } = require('socket.io-client');
const URL = process.env.QG_URL || 'http://localhost:3000';
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const host = io(URL);
  let hs = null;
  host.on('host:state', (s) => (hs = s));
  const room = await new Promise((res) => host.emit('host:create', { game: 'territory' }, res));
  const mk = async (name) => {
    const s = io(URL);
    s.on('you', (y) => (s.me = y));
    await new Promise((res) => s.emit('player:join', { pin: room.pin, name }, res));
    return s;
  };
  const a = await mk('Ann');
  const b = await mk('Bob');
  const c = await mk('Cy');
  await wait(400);

  // the teacher's lottery
  const before = hs.gameId;
  host.emit('host:lottery', { mode: 'all' });
  await wait(300);
  ok(hs.gameId !== before && hs.lastLottery && hs.lastLottery.id === hs.gameId, 'the lottery picks a different game and says which');
  ok(!['lesson', 'study'].includes(hs.gameId), 'the lottery never draws a lesson or a study set');
  for (let i = 0; i < 12; i++) { host.emit('host:lottery', { mode: 'coop' }); await wait(60); }
  ok(hs.games.find((g) => g.id === hs.gameId).mode === 'coop', 'a lottery inside a tab draws only from that tab');

  // a student cannot run the lottery or start a vote
  const g0 = hs.gameId;
  a.emit('host:lottery', { mode: 'all' });
  a.emit('host:vote', { mode: 'all', n: 4, secs: 30 });
  await wait(300);
  ok(hs.gameId === g0 && !hs.vote, 'a student cannot run the lottery or start a vote');

  // the vote
  host.emit('host:vote', { mode: 'ffa', n: 4, secs: 30 });
  await wait(400);
  ok(hs.vote && !hs.vote.done && hs.vote.cands.length === 4, 'the vote opens with 4 candidates');
  ok(a.me.vote && a.me.vote.cands.length === 4 && b.me.vote && c.me.vote, 'every phone gets the candidates');
  ok(hs.vote.cands.every((x) => hs.games.find((g) => g.id === x.id).mode === 'ffa'), 'only games of the chosen tab are offered');
  const pick = hs.vote.cands[0].id;
  const other = hs.vote.cands[1].id;
  a.emit('player:vote', { id: 'not-a-game' });
  await wait(150);
  ok(hs.vote.voters === 0, 'a vote for a game that is not offered is ignored');
  a.emit('player:vote', { id: pick });
  b.emit('player:vote', { id: pick });
  await wait(250);
  ok(hs.vote.voters === 2 && hs.vote.cands.find((x) => x.id === pick).n === 2, 'the teacher sees the live count');
  b.emit('player:vote', { id: other });
  await wait(200);
  ok(hs.vote.cands.find((x) => x.id === pick).n === 1 && hs.vote.cands.find((x) => x.id === other).n === 1, 'a student can change their vote');
  b.emit('player:vote', { id: pick });
  c.emit('player:vote', { id: 'rand' });
  await wait(250);
  ok(hs.vote.rand === 1, 'a "surprise me" vote is counted separately');
  // everyone has voted: it closes by itself shortly
  await wait(2200);
  ok(hs.vote && hs.vote.done && hs.vote.winner, 'when everyone has voted it closes by itself');
  ok(hs.gameId === hs.vote.winner, 'the winner becomes the game');
  ok(a.me.vote && a.me.vote.done && a.me.vote.winner === hs.vote.winner, 'the phones are told the winner');
  const tally = hs.vote.tally;
  ok(Object.values(tally).reduce((s, n) => s + n, 0) === 3, 'every vote was counted once (the surprise went to a random candidate)');
  ok(tally[pick] >= 2, 'the game with two votes got at least those two');

  // ending early and cancelling
  host.emit('host:vote', { mode: 'all', n: 5, secs: 60 });
  await wait(300);
  ok(hs.vote && !hs.vote.done && hs.vote.cands.length === 5, 'a new vote can open again');
  a.emit('player:vote', { id: 'rand' });
  host.emit('host:vote-end');
  await wait(400);
  ok(hs.vote && hs.vote.done, 'the teacher can end the vote early');
  host.emit('host:vote', { mode: 'all', n: 3, secs: 60 });
  await wait(200);
  host.emit('host:vote-cancel');
  await wait(200);
  ok(!hs.vote, 'the teacher can cancel a vote');

  // starting the game clears the vote
  host.emit('host:vote', { mode: 'all', n: 3, secs: 60 });
  await wait(200);
  host.emit('host:start');
  await wait(400);
  ok(!hs.vote, 'starting the game clears the vote');

  host.emit('host:end');
  [a, b, c, host].forEach((s) => s.close());
  console.log(fails.length ? `FAILED (${fails.length}): ${fails.join(' | ')}` : 'vote-test: all passed');
  process.exit(fails.length ? 1 : 0);
})();
