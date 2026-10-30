// The teacher renames and removes players in the middle of a game. node scripts/players-test.js (server running)
const { io } = require('socket.io-client');
const URL = process.env.QG_URL || 'http://localhost:3000';
let failed = 0;
const ok = (c, m, extra) => {
  if (!c) failed++;
  console.log(c ? '  ✔' : '  ✘ FAIL', m, c || extra === undefined ? '' : JSON.stringify(extra));
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const host = io(URL);
  let hs = null;
  host.on('host:state', (s) => (hs = s));
  const room = await new Promise((res) => host.emit('host:create', { game: 'classic' }, res));
  host.emit('host:settings', { advance: 'manual' });
  const mine = {};
  let kicked = false;
  const phones = ['דנה', 'יוסי', 'נועה'].map((name) => {
    const s = io(URL);
    s.on('you', (y) => (mine[name] = y));
    s.on('kicked', () => { if (name === 'נועה') kicked = true; });
    s.emit('player:join', { pin: room.pin, name }, () => {});
    return s;
  });
  await wait(600);
  host.emit('host:start');
  await wait(5500);
  ok(hs.phase === 'playing', 'game is running');
  const byName = (n) => hs.players.find((p) => p.name === n);
  const rename = (id, name) => new Promise((res) => host.emit('host:rename', { id, name }, res));

  const dana = byName('דנה');
  let r = await rename(dana.id, 'שם חדש');
  await wait(300);
  ok(r.ok && byName('שם חדש') && !byName('דנה'), 'typed rename works in the middle of a game', r);
  ok(mine['דנה'] && mine['דנה'].name === 'שם חדש', 'the phone sees the new name', mine['דנה'] && mine['דנה'].name);

  r = await rename(byName('שם חדש').id);
  await wait(300);
  ok(r.ok && r.name && r.name !== 'שם חדש' && hs.players.some((p) => p.name === r.name), 'no name = a random one', r);

  r = await rename(byName('יוסי').id, 'f u c k');
  ok(r.error && /לא מתאים/.test(r.error), 'a rude name is refused', r);
  r = await rename(byName('יוסי').id, 'נועה');
  ok(r.error && /תפוס/.test(r.error), 'a taken name is refused', r);
  r = await rename(byName('יוסי').id, '   ');
  ok(r.error, 'an empty name is refused', r);
  r = await rename('nope', 'x');
  ok(r.error, 'an unknown player is refused', r);

  host.emit('host:kick', byName('נועה').id);
  await wait(500);
  ok(kicked, 'the removed phone is told');
  ok(hs.players.length === 2 && !byName('נועה'), 'the player is gone from the list', hs.players.map((p) => p.name));
  ok(hs.phase === 'playing', 'the game goes on with the others');

  host.emit('host:end');
  await wait(300);
  [host, ...phones].forEach((s) => s.close());
  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
