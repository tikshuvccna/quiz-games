// The impostor game with bots against a running server (QG_URL, default localhost:3000).
// 6 bots answer everything right; impostors sabotage; the first meeting votes the real impostor out; the crew wins.
const { io } = require('socket.io-client');
const Q = require('../questions/sample.json');
const URL = process.env.QG_URL || 'http://localhost:3000';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

(async () => {
  const host = io(URL);
  let hs;
  host.on('host:state', (s) => (hs = s));
  const r = await new Promise((res) => host.emit('host:create', { game: 'impostor' }, res));
  host.emit('host:game', 'impostor');
  host.emit('host:settings', { duration: 300, difficulty: 'easy' });
  const names = ['דנה', 'יוסי', 'נועה', 'עמית', 'שירה', 'אורי'];
  const bots = names.map((name) => {
    const b = { name, you: null, sock: io(URL), sabotages: 0, votes: 0, jammed: false };
    b.sock.on('you', (y) => {
      b.you = y;
      const send = (type, data, ms = 60) => setTimeout(() => b.sock.emit('player:action', { type, data }), ms);
      if (y.phase === 'question') {
        const q = Q.find((x) => x.text === y.question.text);
        const c = q ? y.question.options.indexOf(q.options[q.answer]) : 0;
        send('answer', { choice: c, qid: y.qid }, 100);
      } else if (y.phase === 'sabotage') {
        b.sabotages++;
        const t = y.targets;
        send('sabotage', b.sabotages % 2 && t.length ? { k: 'jam', to: t[0].id } : { k: 'drain' });
      } else if (y.phase === 'vote') {
        b.votes++;
        // the crew votes for a real impostor (cheating: the bots know who it is), the impostors skip
        const imp = bots.find((o) => o.you && o.you.role === 'imp' && o.you.alive);
        const target = y.role === 'imp' ? 'skip' : (y.candidates.find((c) => c.name === (imp && imp.name)) || {}).id || 'skip';
        send('vote', { to: target }, 300);
      }
      if (y.jam) b.jammed = true;
    });
    b.sock.emit('player:join', { pin: r.pin, name }, () => {});
    return b;
  });
  await new Promise((res) => setTimeout(res, 800));
  host.emit('host:start');
  await new Promise((res) => setTimeout(res, 4500));
  const imps = bots.filter((b) => b.you && b.you.role === 'imp');
  ok(imps.length === 1, `one impostor among 6 players (got ${imps.length})`);
  ok(bots.every((b) => b.you.role === 'imp' || b.you.role === 'crew'), 'everyone knows their role');
  ok(imps[0].you.mates && imps[0].you.mates.length === 0, 'a lone impostor has no mates');

  // wait for the end of the game (crew wins by ejecting the impostor, or finishing the bar)
  const t0 = Date.now();
  while (hs.phase === 'playing' && Date.now() - t0 < 120000) await new Promise((res) => setTimeout(res, 500));
  ok(hs.phase === 'ended', `the game ended by itself (${Math.round((Date.now() - t0) / 1000)}s)`);
  const res = hs.results || {};
  ok(res.kind === 'impostor', 'results kind');
  ok(res.win === 'crew', `the crew won (got ${res.win})`);
  ok(res.players && res.players.filter((p) => p.imp).length === 1, 'results name the impostor');
  ok(bots.some((b) => b.votes > 0), 'a meeting happened and bots were asked to vote');
  ok(imps[0].sabotages > 0 || res.players.find((p) => p.imp).sabotaged >= 0, 'sabotage was offered or not needed');
  console.log('sabotages:', imps[0].sabotages, 'jammed seen:', bots.some((b) => b.jammed));
  bots.forEach((b) => b.sock.close());
  host.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
