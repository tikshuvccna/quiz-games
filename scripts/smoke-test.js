// Bots play a short round of every game against a running server: node scripts/smoke-test.js [territory|gems|asteroids]
const { io } = require('socket.io-client');
const Q = require('../questions/sample.json');
const URL = 'http://localhost:3000';

function run(game) {
  return new Promise((resolve) => {
    const host = io(URL);
    let hs;
    host.on('host:state', (s) => (hs = s));
    host.emit('host:create', { game }, (r) => {
      host.emit('host:game', game);
      host.emit('host:settings', { duration: 120, advance: 'auto', count: 3 });
      const bots = ['דנה', 'יוסי', 'נועה'].map((name) => {
        const s = io(URL);
        let board = null;
        s.on('board', (d) => (board = d.board));
        s.on('you', (y) => {
          if (y.phase === 'c_question') {
            const q = Q.find((x) => x.text === y.question.text);
            const c = q ? y.question.options.indexOf(q.options[q.answer]) : 0;
            setTimeout(() => s.emit('player:action', { type: 'answer', data: { choice: c, qid: y.qid, conf: y.conf ? y.conf[0].v : undefined } }), 300 + Math.random() * 1500);
          } else if (y.phase === 'question') {
            const q = Q.find((x) => x.text === y.question.text);
            const c = y.question.options.indexOf(q.options[q.answer]);
            setTimeout(() => s.emit('player:action', { type: 'answer', data: { choice: c } }), 40);
          } else if (y.phase === 'place' && y.valid.length) {
            setTimeout(() => s.emit('player:action', { type: 'place', data: { tile: y.valid[0][0] } }), 40);
          } else if (y.phase === 'catch') {
            setTimeout(() => s.emit('player:action', { type: 'catch', data: { ids: y.catch.items.map((i) => i.id) } }), 100);
          } else if (y.phase === 'pull') {
            setTimeout(() => s.emit('player:action', { type: 'pull', data: { taps: 12 } }), 100);
          } else if (y.phase === 'dodge') {
            setTimeout(() => s.emit('player:action', { type: 'dodge', data: { lane: y.dodge.safe } }), 100);
          } else if (y.phase === 'strike') {
            setTimeout(() => s.emit('player:action', { type: 'strike', data: { acc: 0.8 } }), 100);
          } else if (y.phase === 'drop') {
            setTimeout(() => s.emit('player:action', { type: 'drop', data: { acc: 0.8 } }), 100);
          } else if (y.phase === 'move') {
            const path = ['r', 'r', 'r', 'd', 'd', 'l', 'l', 'l', 'u', 'u', 'r'];
            s.step = (s.step || 0);
            for (let i = 0; i < y.steps; i++) setTimeout(() => s.emit('player:action', { type: 'move', data: { dir: path[s.step++ % path.length] } }), 40 * i);
            setTimeout(() => s.emit('player:action', { type: 'done' }), 40 * y.steps + 50);
          } else if (y.phase === 'kick') {
            setTimeout(() => s.emit('player:action', { type: 'kick', data: { zone: 0 } }), 60);
          } else if (y.phase === 'throw') {
            setTimeout(() => s.emit('player:action', { type: 'throw', data: { angle: 40, power: 0.8 } }), 60);
          } else if (y.phase === 'reel') {
            setTimeout(() => s.emit('player:action', { type: 'reel', data: { ok: true } }), 60);
          } else if (y.phase === 'pass') {
            setTimeout(() => s.emit('player:action', { type: 'pass', data: { to: y.targets[0].id } }), 60);
          } else if (y.phase === 'memory') {
            setTimeout(() => s.emit('player:action', { type: 'memory', data: { seq: y.seq } }), 60);
          } else if (y.phase === 'shoot') {
            const a = board && board.ast[0];
            setTimeout(() => s.emit('player:action', a ? { type: 'shoot', data: { id: a.id } } : { type: 'skip' }), 60);
          }
        });
        s.emit('player:join', { pin: r.pin, name }, () => {});
        return s;
      });
      setTimeout(() => host.emit('host:start'), 500);
      setTimeout(() => {
        const b = hs.board;
        console.log(game, 'playing:', JSON.stringify(b).slice(0, 220));
        host.emit('host:end');
      }, 10000);
      setTimeout(() => {
        console.log(game, 'ended:', hs.phase, JSON.stringify(hs.results).slice(0, 260));
        [host, ...bots].forEach((s) => s.close());
        resolve();
      }, 10600);
    });
  });
}

(async () => {
  for (const g of process.argv[2] ? [process.argv[2]] : ['classic', 'pyramid', 'territory', 'tug', 'penalty', 'snowball', 'gems', 'race', 'closer', 'tower', 'fishing', 'bomb', 'asteroids', 'dragon', 'rocket']) await run(g);
  process.exit(0);
})();
