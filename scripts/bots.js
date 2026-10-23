// Fill a room with bots for demos: node scripts/bots.js <pin> [count]
const { io } = require('socket.io-client');
const Q = require('../questions/sample.json');
const pin = process.argv[2];
const count = Number(process.argv[3] || 5);
const NAMES = ['נועם', 'מיכל', 'עידו', 'שירה', 'אורי', 'תמר', 'איתי', 'רוני', 'גיל', 'ליאור'];

NAMES.slice(0, count).forEach((name, i) => {
  const s = io(process.env.QG_URL || 'http://localhost:3000');
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
      else if (qq.puzzle) {
        const n = qq.puzzle.rows * qq.puzzle.cols;
        const order = Array.from({ length: n }, (_, k) => k);
        if (Math.random() < 0.4) [order[0], order[1]] = [order[1], order[0]];
        data = { order };
      } else if (qq.items) data = { order: qq.items.map((_, i) => i) };
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
    } else if (y.phase === 'sprint') {
      send('sprint', { heat: 0.4 + Math.random() * 0.75 }, 1800);
    } else if (y.phase === 'paint') {
      const k = Math.random() < 0.8 ? y.patch.cells.length : Math.floor(y.patch.cells.length / 2);
      send('paint', { cells: y.patch.cells.slice(0, k).map((c, j) => [c, y.patch.px[j]]) }, 5000);
    } else if (y.phase === 'spin') {
      send('spin', undefined, 1200);
    } else if (y.phase === 'flip') {
      const h = y.cards.map((c, j) => [c, j]).filter(([c]) => c.s === 'hidden').map(([, j]) => j);
      if (h.length) send('flip', { card: h[Math.floor(Math.random() * h.length)] }, 1200);
    } else if (y.phase === 'aim') {
      const free = y.sea.map((v, j) => [v, j]).filter(([v]) => v === 0).map(([, j]) => j);
      if (free.length) send('fire', { cell: free[Math.floor(Math.random() * free.length)] }, 1500);
    }
  });
  s.emit('player:join', { pin, name }, (r) => console.log(name, r.ok ? 'joined' : r.error));
});
