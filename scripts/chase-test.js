// The co-op chase games (robot, sub, lava, zombie): bots race to the goal, the checkpoint mini-games start, everyone
// is parked and comes back to their questions afterwards, and nobody gets stuck. node scripts/chase-test.js [game]
const { io } = require('socket.io-client');
const Q = require('../questions/sample.json');
const URL = process.env.QG_URL || 'http://localhost:3000';
let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${msg}`);
  if (!ok) fails++;
};

// bad packets: out-of-range numbers, wrong types, made-up indexes
function junk(y) {
  if (y.phase === 'sprint') return ['sprint', { heat: 999 }];
  if (y.phase === 'dive') return ['dive', { hits: -50, pearls: [99, 'x', 0, 0, 0, -1] }];
  if (y.phase === 'climb') return ['climb', { picks: [7, null, 'a'] }];
  if (y.phase === 'dash') return ['dash', { moves: 'up up up' }];
  return null;
}

function move(y, bad) {
  if (bad) return junk(y);
  const a = y.act;
  if (y.phase === 'sprint') return ['sprint', { heat: 0.9 }];
  if (y.phase === 'dive') return ['dive', { hits: 0, pearls: a.pearls.map((_, k) => k) }];
  if (y.phase === 'climb') return ['climb', { picks: a.rows.map((r) => r.indexOf(0)) }];
  if (y.phase === 'dash') return ['dash', { moves: a.obs }];
  return null;
}

function run(game, opts = {}, bad = false) {
  return new Promise((resolve) => {
    const host = io(URL);
    let hs;
    const kinds = new Set();
    const results = [];
    let parked = 0;
    host.on('host:state', (s) => {
      hs = s;
      const m = s.board && s.board.mini;
      if (m) kinds.add(m.kind);
      if (m && m.stage === 'result' && m.result && !results.find((r) => r.id === m.id)) results.push({ id: m.id, ...m.result });
    });
    host.emit('host:create', { game }, (r) => {
      host.emit('host:game', game);
      host.emit('host:settings', { duration: 300, difficulty: 'easy', ...opts });
      const last = new Map();
      const bots = ['דנה', 'יוסי', 'נועה', 'עמית'].map((name) => {
        const s = io(URL);
        let board = null;
        s.on('board', (d) => (board = d.board));
        s.on('you', (y) => {
          const send = (type, data, ms = 60) => setTimeout(() => s.emit('player:action', { type, data }), ms);
          last.set(name, { key: y.phase + ':' + y.qid + ':' + y.turn, at: Date.now(), phase: y.phase });
          if (y.phase === 'question') {
            const q = Q.find((x) => x.text === y.question.text);
            send('answer', { choice: y.question.options.indexOf(q.options[q.answer]), qid: y.qid }, 1500 + Math.random() * 1500);
          } else if (y.phase === 'mini') {
            parked++;
            const m = y.mini;
            if (m.stage !== 'play' || m.done || s.sent === m.id) return;
            s.sent = m.id;
            // the board (with the code) arrives just after the phone's own update
            setTimeout(() => {
              const code = board && board.mini && board.mini.code;
              const data = bad ? { taps: 9999, seq: 'nope', hits: [1, 1, 1, 99] } : m.kind === 'mash' ? { taps: 50 } : m.kind === 'code' ? { seq: code } : { hits: m.pops.map((_, k) => k) };
              s.emit('player:action', { type: 'mini', data });
            }, 500);
          } else {
            const mv = move(y, bad);
            if (mv) send(mv[0], mv[1], 120);
          }
        });
        s.emit('player:join', { pin: r.pin, name }, () => {});
        return s;
      });
      setTimeout(() => host.emit('host:start'), 400);
      // play until the class wins (or 150s), watching for stuck phones
      const t0 = Date.now();
      let stuck = '';
      const iv = setInterval(() => {
        if (!hs) return;
        for (const [n, l] of last) if (hs.phase === 'playing' && !(hs.board && hs.board.mini) && Date.now() - l.at > 12000) stuck = `${n} stuck in ${l.phase}`;
        if (hs.phase === 'ended' || Date.now() - t0 > (bad ? 45000 : 150000) || stuck) {
          clearInterval(iv);
          if (hs.phase !== 'ended') host.emit('host:end');
          setTimeout(() => {
            const res = hs.results || {};
            console.log(`${game}: ended=${hs.phase} victory=${res.victory} pct=${res.pct} minis=${[...kinds].join(',')} in ${Math.round((Date.now() - t0) / 1000)}s`);
            check(!stuck, `nobody stuck ${stuck}`);
            if (bad) {
              // junk is worth the minimum: no huge gains, and junk mini packets score nothing
              const most = Math.max(...res.players.map((p) => p.dist));
              check(most < 400, `junk packets stay small (best player ${most} m)`);
              check(results.every((x) => x.stars === 0 && x.jump === 0), `junk mini packets score nothing (${results.map((x) => x.stars + '★').join(' ') || 'no mini'})`);
            } else if (opts.minis === 'off') {
              check(kinds.size === 0 && parked === 0, 'no checkpoint games when they are switched off');
              check(res.victory === true, 'the class reached the goal');
            } else {
              check(kinds.size >= 2, `checkpoint mini-games ran (${[...kinds].join(', ')})`);
              check(results.length >= 2 && results.every((x) => x.stars >= 2), `mini results scored (${results.map((x) => x.stars + '★ +' + x.jump).join(' ')})`);
              check(parked > 0, 'phones were parked for the mini-game');
              check(res.victory === true, 'the class reached the goal');
              check(Array.isArray(res.players) && res.players.every((p) => p.dist > 0), 'everyone moved the class forward');
              if (game === 'sub') check(res.dives > 0, `the sub went into diving mode (${res.dives})`);
            }
            [host, ...bots].forEach((x) => x.close());
            resolve();
          }, 700);
        }
      }, 500);
    });
  });
}

(async () => {
  const only = process.argv[2];
  for (const g of only ? [only] : ['robot', 'sub', 'lava', 'zombie']) await run(g);
  console.log('-- checkpoint games off --');
  await run(only || 'lava', { minis: 'off' });
  console.log('-- junk packets --');
  for (const g of only ? [only] : ['robot', 'sub', 'lava', 'zombie']) await run(g, {}, true);
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
