// Screen sharing: the server's part (the handshake relay and the rules). node scripts/share-test.js (server running)
// The real picture goes browser to browser; that part was checked in a browser with canvas streams.
const { io } = require('socket.io-client');
const URL = process.env.QG_URL || 'http://localhost:3000';
let failed = 0;
const ok = (c, m, extra) => {
  if (!c) failed++;
  console.log(c ? '  ✔' : '  ✘ FAIL', m, c || extra === undefined ? '' : JSON.stringify(extra));
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const once = (s, ev, ms = 800) => new Promise((res) => { const t = setTimeout(() => res(null), ms); s.once(ev, (d) => { clearTimeout(t); res(d === undefined ? true : d); }); });

// did the event arrive at all (even with an empty payload)?
const fired = (s, ev, ms = 800) => new Promise((res) => { const t = setTimeout(() => res(false), ms); s.once(ev, () => { clearTimeout(t); res(true); }); });

(async () => {
  const host = io(URL);
  const room = await new Promise((res) => host.emit('host:create', { game: 'classic' }, res));
  const mk = async (name) => {
    const s = io(URL);
    s.me = null;
    s.on('you', (y) => (s.me = y));
    const r = await new Promise((res) => s.emit('player:join', { pin: room.pin, name }, res));
    s.pid = r.playerId || (s.me && s.me.id);
    return s;
  };
  const a = await mk('Ann');
  const b = await mk('Bob');
  await wait(300);
  let hs = null;
  host.on('host:state', (s) => (hs = s));
  host.emit('host:rejoin', { pin: room.pin, hostToken: room.hostToken }, () => {});
  await wait(300);
  const pidA = hs.players.find((p) => p.name === 'Ann').id;
  const pidB = hs.players.find((p) => p.name === 'Bob').id;

  // a student cannot start a share
  a.emit('share:start', { source: 'host' });
  ok((await once(b, 'share:state', 500)) === null, 'a student cannot start a share');

  // the teacher starts: everyone is told
  const sa = once(a, 'share:state');
  const sb = once(b, 'share:state');
  host.emit('share:start', { source: 'host' });
  const [ra, rb] = [await sa, await sb];
  ok(ra && ra.source === 'host' && rb && rb.source === 'host', 'every phone is told the teacher is sharing', ra);

  // a phone that wants to watch makes the teacher's page send it the stream
  const v = once(host, 'share:viewer');
  a.emit('share:watch');
  const viewer = await v;
  ok(viewer && viewer.pid === pidA, 'the teacher is told who is watching', viewer);

  // the handshake goes teacher -> that student only
  const ga = once(a, 'share:signal');
  const gb = once(b, 'share:signal', 500);
  host.emit('share:signal', { to: pidA, data: { role: 'view', sdp: { type: 'offer', sdp: 'x' } } });
  const sig = await ga;
  ok(sig && sig.data.role === 'view' && sig.data.sdp.type === 'offer', 'an offer reaches the student it was meant for', sig);
  ok((await gb) === null, 'and nobody else');

  // and student -> teacher, with the sender named
  const gh = once(host, 'share:signal');
  a.emit('share:signal', { data: { role: 'view', sdp: { type: 'answer', sdp: 'y' } } });
  const back = await gh;
  ok(back && back.from === pidA && back.name === 'Ann', 'the answer reaches the teacher, with who sent it', back);

  // a student cannot send a signal to another student (there is no "to" for them), and a huge one is dropped
  const ghuge = once(host, 'share:signal', 500);
  a.emit('share:signal', { data: { role: 'view', sdp: { sdp: 'z'.repeat(40000) } } });
  ok((await ghuge) === null, 'an oversized signal is dropped');
  const gx = once(b, 'share:signal', 500);
  a.emit('share:signal', { to: pidB, data: { role: 'view', cand: { c: 1 } } });
  ok((await gx) === null, 'a student cannot push a signal to another student');

  // a late joiner learns about the running share
  const c = await mk('Cy');
  await wait(400);
  ok(c.me && c.me.share && c.me.share.source === 'host', 'a student who joins late sees that a share is running', c.me && c.me.share);

  // the teacher asks one student to share, and the answer comes back
  const ask = once(a, 'share:ask');
  const none = once(b, 'share:ask', 500);
  host.emit('share:ask', { pid: pidA });
  ok(!!(await ask) && (await none) === null, 'only the asked student gets the request');
  const rep = once(host, 'share:reply');
  a.emit('share:reply', { accept: false, reason: 'insecure' });
  const rr = await rep;
  ok(rr && rr.pid === pidA && rr.accept === false && rr.reason === 'insecure', 'the teacher learns the answer and the reason', rr);
  const ask2 = once(b, 'share:ask', 500);
  a.emit('share:ask', { pid: pidB });
  ok((await ask2) === null, 'a student cannot ask another student to share');

  // stopping tells everyone (the state arrives, empty)
  const st1 = fired(a, 'share:state');
  host.emit('share:stop');
  ok(await st1, 'stopping is announced to the class');

  // the teacher's page closing ends a running share
  host.emit('share:start', { source: 'host' });
  await wait(300);
  const st2 = fired(b, 'share:state');
  host.close();
  ok(await st2, "when the teacher's page goes away the share ends for the class");

  [a, b, c].forEach((s) => s.close());
  console.log(failed ? `${failed} FAILED` : 'all passed');
  process.exit(failed ? 1 : 0);
})();
