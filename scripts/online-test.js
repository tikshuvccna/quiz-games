// The online mode: node scripts/online-test.js (starts its own servers on ports 3201 and 3202, no setup needed).
// Teacher pages and the library need a sign-in; students join without one; a missing password stops the server.
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { io } = require('socket.io-client');

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOT = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qg-online-'));

function start(env, port) {
  const p = spawn('node', ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), ...env }, stdio: 'ignore' });
  return p;
}
const wait = async (url) => { for (let i = 0; i < 40; i++) { try { await fetch(url); return true; } catch { await sleep(250); } } return false; };

(async () => {
  // 1. online without a password does not start
  const bad = spawnSync('node', ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: '3202', MODE: 'online', TEACHER_PASSWORD: '' }, timeout: 8000 });
  ok(bad.status === 1, 'MODE=online without TEACHER_PASSWORD refuses to start');
  const weak = spawnSync('node', ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: '3202', MODE: 'online', TEACHER_PASSWORD: 'abc' }, timeout: 8000 });
  ok(weak.status === 1, 'a short password is refused');

  // 2. the online server
  const srv = start({ MODE: 'online', TEACHER_PASSWORD: 'correct-horse', PUBLIC_URL: 'https://quiz.example.com/', DATA_DIR: tmp, SESSION_SECRET: 'x'.repeat(32) }, 3201);
  const B = 'http://localhost:3201';
  try {
    ok(await wait(B + '/api/info'), 'the online server is up');

    // students' pages and the join flow are open
    let r = await fetch(B + '/index.html');
    ok(r.status === 200, 'the student page is open');

    // teacher pages redirect to the sign-in page
    r = await fetch(B + '/host.html', { redirect: 'manual' });
    ok(r.status === 302 && /login\.html/.test(r.headers.get('location')), 'host.html redirects to the sign-in');
    r = await fetch(B + '/editor.html', { redirect: 'manual' });
    ok(r.status === 302, 'editor.html redirects to the sign-in');

    // the library API refuses even though the request comes from localhost (a proxy would look the same)
    r = await fetch(B + '/api/q/quizzes');
    ok(r.status === 401, 'the library API needs a sign-in (401), localhost does not count');
    const body = await r.json();
    ok(body.login === true, 'the 401 tells the page to go to the sign-in');

    // the public address is offered first, and the mode is reported
    const info = await (await fetch(B + '/api/info')).json();
    ok(info.mode === 'online' && info.publicUrl === 'https://quiz.example.com', 'info reports the mode and the public address (trailing slash trimmed)');
    ok(info.addresses[0] && info.addresses[0].kind === 'online' && info.addresses[0].url === 'https://quiz.example.com', 'the online address comes first');

    // wrong password, then the rate limit
    const login = (pw) => fetch(B + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    r = await login('nope');
    ok(r.status === 401 && !r.headers.get('set-cookie'), 'a wrong password is refused, no cookie');
    for (let i = 0; i < 5; i++) await login('nope');
    r = await login('correct-horse');
    ok(r.status === 401, 'after 5 wrong tries even the right password waits a minute');
  } finally {
    srv.kill();
  }

  // 3. a fresh server (the limiter starts clean) for the signed-in checks
  const srv2 = start({ MODE: 'online', TEACHER_PASSWORD: 'correct-horse', PUBLIC_URL: 'https://quiz.example.com', DATA_DIR: tmp, SESSION_SECRET: 'x'.repeat(32) }, 3201);
  try {
    const B = 'http://localhost:3201';
    await wait(B + '/api/info');
    const r = await fetch(B + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'correct-horse' }) });
    ok(r.status === 200, 'the right password signs in');
    const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
    ok(/^qg_teacher=/.test(cookie), 'a cookie is set');
    ok(/HttpOnly/i.test(r.headers.get('set-cookie')), 'the cookie is HttpOnly');
    const H = { headers: { Cookie: cookie } };

    let x = await fetch(B + '/api/q/quizzes', H);
    ok(x.status === 200, 'the library answers with the cookie');
    x = await fetch(B + '/host.html', { ...H, redirect: 'manual' });
    ok(x.status === 200, 'host.html opens with the cookie');
    x = await fetch(B + '/api/q/fs', H);
    ok(x.status === 403, 'browsing the server folders is closed online');
    x = await fetch(B + '/api/q/quizzes', { headers: { Cookie: 'qg_teacher=1.deadbeef' } });
    ok(x.status === 401, 'a forged cookie is refused');
    x = await fetch(B + '/api/q/quizzes', { headers: { Cookie: 'qg_teacher=' + cookie.split('=')[1].replace(/.$/, (c) => (c === '0' ? '1' : '0')) } });
    ok(x.status === 401, 'a tampered cookie is refused');

    // sockets: a room needs the cookie, students do not
    const anon = io(B);
    const denied = await new Promise((res) => anon.emit('host:create', { game: 'classic' }, res));
    ok(denied && denied.ok === false, 'creating a room without the cookie is refused');
    anon.close();
    const teacher = io(B, { extraHeaders: { Cookie: cookie } });
    const made = await new Promise((res) => teacher.emit('host:create', { game: 'classic' }, res));
    ok(made && made.ok && made.pin, 'a signed-in teacher creates a room');
    const kid = io(B);
    const joined = await new Promise((res) => kid.emit('player:join', { pin: made.pin, name: 'דנה' }, res));
    ok(joined && !joined.error, 'a student joins without any sign-in');
    kid.close();
    teacher.close();

    x = await fetch(B + '/api/logout', { method: 'POST' });
    ok(/Max-Age=0/.test(x.headers.get('set-cookie') || ''), 'sign-out clears the cookie');
  } finally {
    srv2.kill();
  }

  // 4. the LAN mode is unchanged: localhost is the teacher, no sign-in
  const lan = start({ QUIZ_DIR: tmp }, 3201);
  try {
    const B = 'http://localhost:3201';
    await wait(B + '/api/info');
    const x = await fetch(B + '/api/q/quizzes');
    ok(x.status === 200, 'LAN mode: the host computer needs no sign-in');
    const h = await fetch(B + '/host.html', { redirect: 'manual' });
    ok(h.status === 200, 'LAN mode: host.html opens');
    const info = await (await fetch(B + '/api/info')).json();
    ok(info.mode === 'lan', 'LAN mode is reported');
  } finally {
    lan.kill();
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
