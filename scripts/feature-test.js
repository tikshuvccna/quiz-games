// Checks room-level features against a running server: node scripts/feature-test.js
const { io } = require('socket.io-client');
const Q = require('../questions/sample.json');
const URL = process.env.QG_URL || 'http://localhost:3000';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (cond, msg) => console.log(cond ? '  ✔' : '  ✘ FAIL', msg);

function bot(pin, name, onYou) {
  const s = io(URL);
  s.me = null;
  s.on('you', (y) => {
    s.me = y;
    if (y.phase === 'question') {
      const q = Q.find((x) => x.text === y.question.text);
      setTimeout(() => s.emit('player:action', { type: 'answer', data: { choice: y.question.options.indexOf(q.options[q.answer]), qid: y.qid } }), 30);
    }
    if (onYou) onYou(s, y);
  });
  s.emit('player:join', { pin, name }, (r) => (s.joined = r));
  return s;
}

(async () => {
  const host = io(URL);
  let hs = null;
  host.on('host:state', (s) => (hs = s));
  const r = await new Promise((res) => host.emit('host:create', { game: 'territory' }, res));
  const pin = r.pin;

  console.log('auto names + reroll');
  host.emit('host:setup', { nameMode: 'spin', winText: 'כל הכבוד אלופים!' });
  await wait(150);
  const chk = await new Promise((res) => io(URL).emit('player:check', { pin }, res));
  ok(chk.ok && chk.nameMode === 'spin', 'player:check reports the name mode');
  const places = [];
  const bots = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'].map((n) => bot(pin, n, (s, y) => {
    if (y.phase === 'place' && y.valid.length) { places.push(y.flags); setTimeout(() => s.emit('player:action', { type: 'place', data: { tile: y.valid[0][0] } }), 30); }
  }));
  await wait(400);
  const first = bots[0].me.name;
  ok(first !== 'א', `typed name ignored, got "${first}"`);
  bots[0].emit('player:reroll');
  await wait(200);
  ok(bots[0].me.name !== first, `reroll changed the name to "${bots[0].me.name}"`);

  console.log('3 teams, 2 answers per reward, 2 flags each');
  host.emit('host:settings', { teams: 3, need: 2, amount: 2, duration: 120 });
  await wait(150);
  ok(hs.teamCount === 3, 'team count is 3');
  host.emit('host:start');
  await wait(9000);
  ok(hs.board.teams.length === 3 && hs.board.scores.length === 3, 'board has 3 teams');
  ok(new Set(bots.map((b) => b.me.team)).size === 3, 'players split into 3 teams');
  ok(places.length > 0 && places[0] >= 2, `flags arrive in pairs (first counts seen: ${places.slice(0, 4)})`);
  host.emit('host:end');
  await wait(400);
  ok(hs.phase === 'ended' && hs.results.winText === 'כל הכבוד אלופים!', 'winner text in results');

  console.log('rematch + report');
  const rm = await new Promise((res) => host.emit('host:rematch', {}, res));
  await wait(300);
  ok(rm.ok && hs.phase === 'lobby' && hs.players.length === 6 && hs.pin === pin, 'back in the lobby, same PIN and players');
  ok(bots.every((b) => b.me.phase === 'lobby'), 'phones moved to the lobby');
  const rep = await new Promise((res) => host.emit('host:report', {}, res));
  ok(rep.ok && rep.report.players.length === 6 && rep.report.players[0].answers.length > 0, `report has ${rep.report.players[0].answers.length} answers for the top player`);

  console.log('everyone-for-themselves game played in 2 teams');
  host.emit('host:game', 'gems');
  host.emit('host:settings', { teams: 2 });
  bots.forEach((b) => b.on('you', (y) => { if (y.phase === 'catch') b.emit('player:action', { type: 'catch', data: { ids: y.catch.items.filter((i) => i.k === 'gem').map((i) => i.id) } }); }));
  await wait(150);
  host.emit('host:start');
  await wait(9000);
  ok(Array.isArray(hs.teamScores) && hs.teamScores.length === 2, `live team scores: ${hs.teamScores && hs.teamScores.map((t) => t.score)}`);
  host.emit('host:end');
  await wait(400);
  ok(hs.results.teamScores && hs.results.winnerTeam !== undefined, 'results include team totals');
  ok(hs.round === 2, 'round counter is 2');
  process.exit(0);
})();
