// Classic quiz end to end: teams + second-chance round. node scripts/classic-test.js (server running)
const { io } = require('socket.io-client');
const Q = require('../questions/sample.json');
const URL = 'http://localhost:3000';
const ok = (c, m) => console.log(c ? '  ✔' : '  ✘ FAIL', m);

(async () => {
  const host = io(URL);
  let hs = null;
  let sawBonus = false;
  let bonusPlayers = 0;
  let lastStage = '';
  const stages = new Set();
  host.on('host:state', (s) => {
    hs = s;
    const b = s.board;
    if (s.phase !== 'playing' || !b) return;
    const key = b.stage + b.index + b.bonus;
    if (key === lastStage) return;
    lastStage = key;
    stages.add(b.stage);
    if (b.bonus) { sawBonus = true; bonusPlayers = b.players; }
    if (b.stage !== 'question') setTimeout(() => host.emit('host:next'), 250);
  });
  const r = await new Promise((res) => host.emit('host:create', { game: 'classic' }, res));
  host.emit('host:settings', { count: 5, advance: 'manual', bonus: 'on', teams: 2 });
  const names = ['א1', 'ב2', 'ג3', 'ד4', 'ה5', 'ו6', 'ז7'];
  const bots = names.map((name, k) => {
    const s = io(URL);
    s.on('you', (y) => {
      s.me = y;
      if (y.phase === 'c_question') {
        const q = Q.find((x) => x.text === y.question.text);
        const right = y.question.options.indexOf(q.options[q.answer]);
        const c = k < 3 ? right : (right + 1) % y.question.options.length; // 3 always right, 4 always wrong
        setTimeout(() => s.emit('player:action', { type: 'answer', data: { choice: c, qid: y.qid } }), 100 + k * 50);
      }
    });
    s.emit('player:join', { pin: r.pin, name }, () => {});
    return s;
  });
  await new Promise((res) => setTimeout(res, 500));
  host.emit('host:start');
  const t0 = Date.now();
  while (Date.now() - t0 < 90000 && (!hs || hs.phase !== 'ended')) await new Promise((res) => setTimeout(res, 300));
  ok(hs.phase === 'ended', `game ended (${Math.round((Date.now() - t0) / 1000)}s)`);
  ok(['ready', 'question', 'reveal', 'board'].every((x) => stages.has(x)), `stages seen: ${[...stages]}`);
  ok(sawBonus && bonusPlayers === 5, `second-chance round with ${bonusPlayers} players`);
  const res = hs.results;
  ok(res.players.length === 7 && res.players[0].score > 0, `top: ${res.players[0].name} ${res.players[0].score}`);
  ok(res.teamScores && res.teamScores.length === 2, `team averages: ${res.teamScores && res.teamScores.map((t) => `${t.name}=${t.score}(${t.size})`)}`);
  process.exit(0);
})();
