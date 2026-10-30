// Teacher sign-in for the online mode, and the settings that tell the two modes apart.
//
//   MODE=lan (default)  The host computer is the teacher: the editor and the class pages answer only to localhost.
//   MODE=online         The server sits on the internet (usually behind a reverse proxy that does HTTPS, so every
//                       request looks local). Teachers sign in with TEACHER_PASSWORD; a signed cookie keeps them in.
//
// Other environment variables: PORT, HOST (bind address, default all), PUBLIC_URL (the address students open,
// for example https://quiz.example.com), TRUST_PROXY (set when behind a proxy), SESSION_SECRET (keeps sign-ins
// valid across restarts), DATA_DIR (see paths.js), QUIZ_DIR and REPORTS_DIR.
const crypto = require('crypto');

const MODE = process.env.MODE === 'online' ? 'online' : 'lan';
const PASSWORD = process.env.TEACHER_PASSWORD || '';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE = 'qg_teacher';
const TTL_MS = 12 * 60 * 60 * 1000;
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');

const online = () => MODE === 'online';

const mac = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const same = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function makeToken() {
  const exp = String(Date.now() + TTL_MS);
  return `${exp}.${mac(exp)}`;
}

function validToken(tok) {
  const [exp, sig] = String(tok || '').split('.');
  return !!exp && !!sig && Number(exp) > Date.now() && same(sig, mac(exp));
}

function cookieOf(header, name = COOKIE) {
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

const isLoopback = (addr) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(addr);

// a teacher request: online = a valid cookie; LAN = it comes from the host computer itself
function isTeacher(req) {
  if (online()) return validToken(cookieOf(req.headers.cookie));
  return isLoopback(req.socket.remoteAddress);
}

// the same for a socket.io connection (only the online mode checks: in the LAN anyone could always open a room)
function isTeacherSocket(socket) {
  if (!online()) return true;
  return validToken(cookieOf(socket.handshake.headers.cookie));
}

// wrong passwords: 5 tries a minute per address
const tries = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (tries.get(ip) || []).filter((t) => now - t < 60000);
  tries.set(ip, list);
  return list.length >= 5;
}

function login(ip, password) {
  if (!online()) return { ok: true, token: null };
  if (tooMany(ip)) return { ok: false, error: 'יותר מדי ניסיונות, נסו שוב בעוד דקה' };
  if (!PASSWORD || !same(mac(String(password || '')), mac(PASSWORD))) {
    tries.get(ip).push(Date.now());
    return { ok: false, error: 'סיסמה שגויה' };
  }
  return { ok: true, token: makeToken() };
}

const cookieHeader = (tok, secure) => `${COOKIE}=${encodeURIComponent(tok)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL_MS / 1000}${secure ? '; Secure' : ''}`;
const clearHeader = `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

// refuse to start an online server nobody can sign in to, or one anybody can
function check() {
  if (!online()) return null;
  if (!PASSWORD) return 'MODE=online needs TEACHER_PASSWORD (the teachers\' password).';
  if (PASSWORD.length < 8) return 'TEACHER_PASSWORD is too short: use at least 8 characters.';
  return null;
}

module.exports = { MODE, PUBLIC_URL, online, isTeacher, isTeacherSocket, login, cookieHeader, clearHeader, check, makeToken, validToken, cookieOf };
