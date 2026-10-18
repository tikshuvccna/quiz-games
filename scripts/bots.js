// Fill a room with bots for demos: node scripts/bots.js <pin> [count]
const { io } = require('socket.io-client');
const Q = require('../questions/sample.json');
const pin = process.argv[2];
const count = Number(process.argv[3] || 5);
const NAMES = ['נועם', 'מיכל', 'עידו', 'שירה', 'אורי', 'תמר', 'איתי', 'רוני', 'גיל', 'ליאור'];

NAMES.slice(0, count).forEach((name, i) => {
  const s = io('http://localhost:3000');
  let board = null;
  const send = (type, data, ms) => setTimeout(() => s.emit('player:action', { type, data }), ms);
  s.on('board', (d) => (board = d.board));
  s.on('you', (y) => {
    const think = 800 + Math.random() * 1800;
    if (y.phase === 'question' || y.phase === 'c_question') {
      const qq = y.question;
      const q = Q.find((x) => x.text === qq.text);
      let data;
      if (qq.options && q) {
        const right = qq.options.indexOf(q.options[q.answer]);
        data = { choice: Math.random() < 0.75 ? right : (right + 1) % qq.options.length };
      } else if (qq.options) data = qq.multi ? { choices: [0] } : { choice: Math.floor(Math.random() * qq.options.length) };
      else if (qq.slider) data = { value: qq.slider.min + Math.round(Math.random() * (qq.slider.max - qq.slider.min)) };
      else if (qq.items) data = { order: qq.items.map((_, i) => i) };
      else if (qq.type === 'pin') data = { x: Math.random() * 100, y: Math.random() * 100 };
      else data = { text: 'תשובה' };
      if (y.conf) data.conf = y.conf[Math.floor(Math.random() * y.conf.length)].v; // confidence / pyramid
      send('answer', { ...data, qid: y.qid }, think);
    } else if (y.phase === 'place' && y.valid.length) {
      send('place', { tile: y.valid[Math.floor(Math.random() * y.valid.length)][0] }, 500);
    } else if (y.phase === 'catch') {
      const ids = y.catch.items.filter((it) => it.k !== 'rock' && it.k !== 'bomb' || Math.random() < 0.15).map((it) => it.id);
      send('catch', { ids }, 7000);
    } else if (y.phase === 'pull') {
      send('pull', { taps: 8 + Math.floor(Math.random() * 14) }, 3000);
    } else if (y.phase === 'dodge') {
      send('dodge', { lane: Math.random() < 0.8 ? y.dodge.safe : 0 }, 900);
    } else if (y.phase === 'strike') {
      send('strike', { acc: Math.random() }, 1200);
    } else if (y.phase === 'drop') {
      send('drop', { acc: Math.random() }, 1200);
    } else if (y.phase === 'move') {
      const path = ['r', 'r', 'r', 'd', 'd', 'd', 'l', 'l', 'l', 'u', 'u', 'u'];
      s.step = s.step || i * 3;
      for (let k = 0; k < y.steps; k++) setTimeout(() => s.emit('player:action', { type: 'move', data: { dir: path[s.step++ % path.length] } }), 150 * k);
      setTimeout(() => s.emit('player:action', { type: 'done' }), 150 * y.steps + 100);
    } else if (y.phase === 'kick') {
      send('kick', { zone: Math.floor(Math.random() * 6) }, 900);
    } else if (y.phase === 'throw') {
      send('throw', { angle: 35 + Math.random() * 20, power: 0.62 + Math.random() * 0.3 }, 1600);
    } else if (y.phase === 'reel') {
      send('reel', { ok: Math.random() < 0.65 }, 4000);
    } else if (y.phase === 'pass' && y.targets.length) {
      send('pass', { to: y.targets[Math.floor(Math.random() * y.targets.length)].id }, 1000);
    } else if (y.phase === 'memory') {
      send('memory', { seq: Math.random() < 0.6 ? y.seq : y.seq.slice(0, 1) }, 2600);
    } else if (y.phase === 'shoot') {
      const a = board && board.ast.sort((p, q) => q.y - p.y)[0];
      send(a ? 'shoot' : 'skip', a ? { id: a.id } : undefined, 500);
    }
  });
  s.emit('player:join', { pin, name }, (r) => console.log(name, r.ok ? 'joined' : r.error));
});
