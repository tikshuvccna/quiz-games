// Quiz-style modes end to end: Lost Pyramid + classic accuracy/confidence. node scripts/pyramid-test.js
const { io } = require('socket.io-client');
const Q = require('../questions/sample.json');
const URL = 'http://localhost:3000';
const ok = (c, m) => console.log(c ? '  ✔' : '  ✘ FAIL', m);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function play(game, settings, botFn) {
  const host = io(URL);
  let hs = null;
  let last = '';
  const seen = [];
  host.on('host:state', (s) => {
    hs = s;
    const b = s.board;
    if (s.phase !== 'playing' || !b) return;
    const key = b.stage + b.index;
    if (key === last) return;
    last = key;
    seen.push(b);
    if (b.stage !== 'question') setTimeout(() => host.emit('host:next'), 150);
  });
  const r = await new Promise((res) => host.emit('host:create', { game }, res));
  host.emit('host:settings', settings);
  const bots = Array.from({ length: 8 }, (_, k) => {
    const s = io(URL);
    s.on('you', (y) => {
      if (y.phase !== 'c_question') return;
      const q = Q.find((x) => x.text === y.question.text);
      const right = y.question.options.indexOf(q.options[q.answer]);
      const data = botFn(k, y, right);
      setTimeout(() => s.emit('player:action', { type: 'answer', data: { ...data, qid: y.qid } }), 80 + k * 30);
    });
    s.emit('player:join', { pin: r.pin, name: 'ב' + k }, () => {});
    return s;
  });
  await wait(400);
  host.emit('host:start');
  const t0 = Date.now();
  while (Date.now() - t0 < 120000 && (!hs || hs.phase !== 'ended')) await wait(250);
  [host, ...bots].forEach((s) => s.close());
  return { hs, seen };
}

(async () => {
  console.log('Lost Pyramid (4 teams)');
  // team of bot k is unknown up front, so: even bots answer right & sure, odd bots answer wrong
  let { hs, seen } = await play('pyramid', { teams: 4, advance: 'manual' }, (k, y, right) => ({ choice: k % 2 ? (right + 1) % y.question.options.length : right, conf: y.conf[y.conf.length - 1].v }));
  ok(hs.phase === 'ended', 'ended');
  const pyr = seen.filter((b) => b.pyramid).pop().pyramid;
  ok(pyr.teams.length === 4, `teams on the pyramid: ${pyr.teams.map((t, i) => t.name + '=' + pyr.pos[i]).join(', ')}`);
  ok(hs.results.kind === 'pyramid' && hs.results.pos.some((v) => v > 0), `results winner team: ${hs.results.winner}`);
  ok(seen.some((b) => b.stage === 'board'), 'pyramid shown between questions');

  console.log('Classic, accuracy style');
  ({ hs } = await play('classic', { style: 'accuracy', count: 5, advance: 'manual', bonus: 'off' }, (k, y, right) => ({ choice: k < 4 ? right : (right + 1) % y.question.options.length })));
  ok(hs.results.players[0].score === 5, `top score = 5 correct answers (${hs.results.players[0].score})`);

  console.log('Classic, confidence style');
  ({ hs } = await play('classic', { style: 'confidence', count: 5, advance: 'manual', bonus: 'off' }, (k, y, right) => ({ choice: k < 4 ? right : (right + 1) % y.question.options.length, conf: k % 2 })));
  const sc = Object.fromEntries(hs.results.players.map((p) => [p.name, p.score]));
  ok(sc['ב1'] > sc['ב0'], `boosted right (${sc['ב1']}) beats safe right (${sc['ב0']})`);
  ok(sc['ב5'] === 0 && sc['ב4'] === 0, `wrong answers end at 0 (boost ${sc['ב5']}, safe ${sc['ב4']})`);
  process.exit(0);
})();
