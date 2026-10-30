const path = require('path');
// DATA_DIR keeps everything that must survive a redeploy in one folder (mount a disk or volume there)
if (process.env.DATA_DIR) {
  const d = path.resolve(process.env.DATA_DIR);
  process.env.QUIZ_DIR = process.env.QUIZ_DIR || path.join(d, 'quizzes');
  process.env.REPORTS_DIR = process.env.REPORTS_DIR || path.join(d, 'reports');
  process.env.BACKGROUNDS_DIR = process.env.BACKGROUNDS_DIR || path.join(d, 'backgrounds');
  process.env.VIDEOS_DIR = process.env.VIDEOS_DIR || path.join(d, 'videos');
}
const os = require('os');
const http = require('http');
const express = require('express');
const QRCode = require('qrcode');
const { Server } = require('socket.io');
const fs = require('fs');
const Room = require('./room');
const Quizzes = require('./quizzes');
const Net = require('./net');
const Classes = require('./classes');
const Library = require('./library');
const Freeform = require('./freeform');
const Media = require('./media');
const Auth = require('./auth');
const qtypes = require('./qtypes');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const authProblem = Auth.check();
if (authProblem) {
  console.error(authProblem);
  process.exit(1);
}
const app = express();
// behind a reverse proxy (nginx, Caddy, a hosting platform) the real address is in X-Forwarded-For
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 64 * 1024 });

// every game's client script / stylesheet in one file (classic first: other quiz modes build on it),
// so a new game needs no <script> tag
const PUBLIC = path.join(__dirname, '..', 'public');
const bundle = (dir, ext, first = []) => {
  let files = [];
  try {
    files = fs.readdirSync(path.join(PUBLIC, dir)).filter((f) => f.endsWith(ext)).sort();
  } catch {}
  files = [...first.filter((f) => files.includes(f)), ...files.filter((f) => !first.includes(f))];
  return files.map((f) => `/* ${dir}/${f} */\n` + fs.readFileSync(path.join(PUBLIC, dir, f), 'utf8')).join('\n');
};
app.get('/js/games-all.js', (req, res) => res.type('application/javascript').set('Cache-Control', 'no-cache').send(bundle('js/games', '.js', ['classic.js', 'chase.js', 'ffa.js'])));
app.get('/css/games-all.css', (req, res) => res.type('text/css').set('Cache-Control', 'no-cache').send(bundle('css/games', '.css')));

// online mode: the teacher pages need a sign-in (the students' pages stay open)
const TEACHER_PAGES = new Set(['/host.html', '/editor.html', '/progress.html', '/print.html', '/presenter.html']);
app.use((req, res, next) => {
  if (Auth.online() && TEACHER_PAGES.has(req.path) && !Auth.isTeacher(req)) return res.redirect('/login.html?next=' + encodeURIComponent(req.path));
  next();
});
app.post('/api/login', express.json({ limit: '2kb' }), (req, res) => {
  const r = Auth.login(req.ip, req.body && req.body.password);
  if (!r.ok) return res.status(401).json({ ok: false, error: r.error });
  if (r.token) res.setHeader('Set-Cookie', Auth.cookieHeader(r.token, req.secure));
  res.json({ ok: true });
});
app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', Auth.clearHeader);
  res.json({ ok: true });
});

// no-cache = the browser revalidates (cheap ETag check), so updated files always show up
app.use(express.static(path.join(__dirname, '..', 'public'), { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

// join addresses for the QR code: Wi-Fi first, then wired LAN, then the PC's hotspot (virtual adapters left out)
app.get('/api/info', (req, res) => {
  const list = Net.addresses();
  // an online address (PUBLIC_URL) is offered next to the network ones, so the teacher chooses how students join
  if (Auth.PUBLIC_URL) {
    try {
      const u = new URL(Auth.PUBLIC_URL);
      const o = { ip: u.host, name: '', kind: 'online', label: 'אונליין', url: Auth.PUBLIC_URL };
      if (Auth.online()) list.unshift(o);
      else list.push(o);
    } catch {}
  }
  res.json({ port: PORT, mode: Auth.MODE, publicUrl: Auth.PUBLIC_URL, ips: list.map((a) => a.ip), addresses: list });
});

app.get('/qr', async (req, res) => {
  const text = String(req.query.text || '').slice(0, 300);
  if (!text) return res.status(400).end();
  try {
    res.type('image/svg+xml').send(await QRCode.toString(text, { type: 'svg', margin: 1 }));
  } catch {
    res.status(500).end();
  }
});

// ---------- quiz library API (editor) ----------
// Everything that reveals answers, edits files or browses folders only answers the host computer itself,
// so a student on the same Wi-Fi can't open the editor and read the answers.
// (online mode: a teacher is whoever has the sign-in cookie, see auth.js)
const local = (req, res, next) => (Auth.isTeacher(req) ? next() : res.status(Auth.online() ? 401 : 403).json({ error: Auth.online() ? 'צריך להתחבר כמורה' : 'העורך זמין רק במחשב המארח', login: Auth.online() }));
// browsing the server's folders is for the host computer only
const lanOnly = (req, res, next) => (Auth.online() ? res.status(403).json({ error: 'לא זמין במצב אונליין' }) : next());
const api = (fn) => async (req, res) => {
  try {
    const out = await fn(req, res);
    if (out !== undefined && !res.headersSent) res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message || 'שגיאה', issues: e.issues });
  }
};
app.use('/api/q', local, express.json({ limit: '2mb' }));

// the editor's preview: the exact payload a phone would get for this question
app.post('/api/q/preview', api((req) => {
  const b = req.body || {};
  const q = qtypes.normalize(b.q || {});
  return qtypes.present(q, `/media/${encodeURIComponent(String(b.quiz || ''))}/`).payload;
}));
app.get('/api/q/folder', api(() => ({ folder: Quizzes.folder() })));
app.post('/api/q/folder', lanOnly, api((req) => ({ folder: Quizzes.setFolder(req.body && req.body.path) })));
// folder browser: no path = drives / start points
app.get('/api/q/fs', lanOnly, api((req) => {
  const p = String(req.query.path || '');
  if (!p) {
    const roots = [];
    if (process.platform === 'win32') for (const d of 'CDEFGHIJKLMNOPQRSTUVWXYZ') if (fs.existsSync(d + ':' + path.sep)) roots.push(d + ':' + path.sep);
    return { path: '', parent: null, dirs: [...roots, os.homedir(), Quizzes.folder()].map((x) => ({ name: x, path: x })) };
  }
  const abs = path.resolve(p);
  const dirs = fs.readdirSync(abs, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('$'))
    .map((d) => ({ name: d.name, path: path.join(abs, d.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'he'));
  const quizzes = fs.readdirSync(abs).filter((f) => f.endsWith('.json')).length;
  const parent = path.dirname(abs) === abs ? '' : path.dirname(abs);
  return { path: abs, parent, dirs, quizzes };
}));
app.post('/api/q/fs/mkdir', lanOnly, api((req) => {
  const name = String((req.body && req.body.name) || '').replace(/[<>:"/\\|?*]/g, '').trim();
  if (!name) throw new Error('שם לא תקין');
  const dir = path.join(path.resolve(String(req.body.path || '')), name);
  fs.mkdirSync(dir, { recursive: true });
  return { path: dir };
}));
app.get('/api/q/quizzes', api(() => Quizzes.list()));
app.post('/api/q/quizzes', api((req) => Quizzes.create((req.body && req.body.title) || 'חידון חדש', [], (req.body && req.body.folder) || '')));
app.get('/api/q/quizzes/:id', api((req) => Quizzes.load(req.params.id)));
app.put('/api/q/quizzes/:id', api((req) => Quizzes.save(req.params.id, req.body)));
app.delete('/api/q/quizzes/:id', api((req) => (Quizzes.remove(req.params.id), { ok: true })));
app.get('/api/q/quizzes/:id/cards.csv', (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(req.params.id)}-cards.csv`);
    res.send(Quizzes.cardsCsv(req.params.id));
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});
app.post('/api/q/quizzes/:id/duplicate', api((req) => Quizzes.duplicate(req.params.id)));
// pictures (incl. animated GIF / APNG / WebP) and video files for questions
app.post('/api/q/quizzes/:id/media', express.raw({ type: ['image/*', 'video/*', 'application/pdf'], limit: '300mb' }), api((req) => {
  const name = Quizzes.saveMedia(req.params.id, req.body, String(req.headers['content-type'] || '').split(';')[0]);
  return { name, url: `/media/${encodeURIComponent(req.params.id)}/${name}` };
}));
// import: Kahoot-style .xlsx, .zip with an .xlsx + pictures, or a quiz-games package (.qgz), into a folder
app.post('/api/q/import', express.raw({ type: () => true, limit: '400mb' }), api((req) => Library.importAny(req.body, String(req.query.title || '').slice(0, 80), String(req.query.folder || ''))));
// free-form text / Word / plain spreadsheet → questions to review before saving
app.post('/api/q/freeform', express.raw({ type: () => true, limit: '30mb' }), api(async (req) => {
  const text = await Freeform.toText(Buffer.isBuffer(req.body) ? req.body : Buffer.from(''), String(req.query.name || ''));
  const questions = Freeform.parse(text);
  if (!questions.length) throw new Error('לא מצאנו שאלות בטקסט. כתבו כל שאלה בשורה, ואת התשובות בשורות מתחתיה');
  return { questions };
}));
app.post('/api/q/import-link',api((req) => Library.importFromLink(req.body && req.body.url, req.body && req.body.folder)));

// class rosters and how each class is doing over the games it played
app.get('/api/q/classes', api(() => Classes.list()));
app.get('/api/q/classes/:id', api((req) => {
  const c = Classes.get(req.params.id);
  if (!c) throw new Error('הכיתה לא נמצאה');
  return c;
}));
app.post('/api/q/classes', api((req) => Classes.save(req.body || {})));
app.put('/api/q/classes/:id', api((req) => Classes.save({ ...(req.body || {}), id: req.params.id })));
app.delete('/api/q/classes/:id', api((req) => (Classes.remove(req.params.id), { ok: true })));
app.post('/api/q/classes/parse', express.raw({ type: () => true, limit: '5mb' }), api((req) => Classes.parseNames(Buffer.isBuffer(req.body) ? req.body : Buffer.from(''), String(req.query.name || ''))));
app.put('/api/q/classes/:id/notes', api((req) => Classes.setNote(req.params.id, req.body && req.body.name, req.body && req.body.text)));
app.get('/api/q/classes/:id/progress', api((req) => Classes.progress(req.params.id)));

// folders
app.get('/api/q/folders', api(() => Library.folders()));
app.post('/api/q/folders', api((req) => Library.createFolder(req.body && req.body.path)));
app.put('/api/q/folders', api((req) => Library.renameFolder(req.body && req.body.from, req.body && req.body.to)));
app.delete('/api/q/folders', api((req) => Library.deleteFolder(String(req.query.path || ''), req.query.withQuizzes === '1')));
app.put('/api/q/quizzes/:id/folder', api((req) => Library.setQuizFolder(req.params.id, req.body && req.body.folder)));

// packages (one quiz or a whole folder, with its pictures and videos)
const sendPackage = (res, { name, buffer }) => {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name.replace(/[\\/:*?"<>|]/g, '-'))}.qgz`);
  res.send(buffer);
};
app.get('/api/q/quizzes/:id/package', api(async (req, res) => sendPackage(res, await Library.packageQuiz(req.params.id))));
app.get('/api/q/folder-package', api(async (req, res) => sendPackage(res, await Library.packageFolder(String(req.query.path || '')))));

// share links (made on the host computer, opened by anyone who has the link)
app.get('/api/q/shares', api(() => Library.listShares()));
app.post('/api/q/shares', api((req) => Library.createShare(req.body || {})));
app.delete('/api/q/shares/:token', api((req) => Library.revokeShare(req.params.token)));
app.get('/share/:token', (req, res) => {
  if (!Library.getShare(req.params.token)) return res.status(404).sendFile(path.join(PUBLIC, 'share.html'));
  res.sendFile(path.join(PUBLIC, 'share.html'));
});
app.get('/share/:token/data', (req, res) => {
  const s = Library.getShare(req.params.token);
  if (!s) return res.status(404).json({ error: 'הקישור לא נמצא או בוטל' });
  Library.touchShare(s.token);
  res.json(Library.shareView(s));
});
app.get('/share/:token/package', async (req, res) => {
  const s = Library.getShare(req.params.token);
  if (!s) return res.status(404).json({ error: 'הקישור לא נמצא או בוטל' });
  if (s.perm !== 'copy') return res.status(403).json({ error: 'הקישור מאפשר צפייה בלבד' });
  try {
    sendPackage(res, await Library.sharePackage(s));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
const sendXlsx = (res, buf, name) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.send(Buffer.from(buf));
};
app.get('/api/q/template.xlsx', api(async (req, res) => sendXlsx(res, await Quizzes.templateXlsx(), 'תבנית-חידון.xlsx')));
app.get('/api/q/quizzes/:id/export.xlsx', api(async (req, res) => sendXlsx(res, await Quizzes.templateXlsx(req.params.id), `${req.params.id}.xlsx`)));

// background music: every mp3 in the music folder (big screen only)
const MUSIC_DIR = path.join(__dirname, '..', 'music');
// PDF.js (Mozilla, Apache-2.0) draws PDF pages in the browser, offline
app.use('/vendor/pdfjs', express.static(path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build'), { maxAge: '1d' }));
app.use('/music', express.static(MUSIC_DIR, { maxAge: '1d' }));
app.get('/api/music', (req, res) => {
  let files = [];
  try {
    files = fs.readdirSync(MUSIC_DIR).filter((f) => /\.(mp3|m4a|ogg|wav)$/i.test(f)).sort();
  } catch {}
  res.json(files.map((f) => ({ file: f, url: '/music/' + encodeURIComponent(f), title: f.replace(/^M\d+(-\d+)+\s*/, '').replace(/\.\w+$/, '') })));
});

// the teacher's own backgrounds: every picture / video in the backgrounds folder becomes a scene
app.use('/backgrounds', express.static(Media.BG_DIR, { maxAge: '1d' }));
app.get('/api/backgrounds', (req, res) => res.json(Media.backgrounds()));
// the video library: local video files in the videos folder + YouTube links listed in videos/videos.json
app.use('/videos', express.static(Media.VIDEO_DIR, { maxAge: '1d' }));
app.get('/api/videos', (req, res) => res.json(Media.videos()));

// player photos (memory only, while the room lives)
app.get('/photo/:pin/:pid', (req, res) => {
  const room = Room.get(req.params.pin);
  const p = room && room.players.get(req.params.pid);
  if (!p || !p.photo || !room.setup.photos) return res.status(404).end();
  const m = p.photo.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!m) return res.status(404).end();
  res.set('Cache-Control', 'private, max-age=3600').type(m[1]).send(Buffer.from(m[2], 'base64'));
});

// question pictures (public: phones and the big screen load them)
app.get('/media/:id/:file', (req, res) => {
  const p = Quizzes.mediaPath(req.params.id, req.params.file);
  if (!p) return res.status(404).end();
  res.sendFile(p, { maxAge: '1h' });
});

const obj = (d) => (d && typeof d === 'object' && !Array.isArray(d) ? d : {});
const str = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');

io.on('connection', (socket) => {
  socket.data.room = null;
  socket.data.playerId = null;
  socket.data.isHost = false;

  // Every handler is wrapped: a malformed packet (null payload, missing ack, bad types)
  // must never throw out of the socket.io event loop and take the whole server down.
  const on = (ev, fn) =>
    socket.on(ev, (...args) => {
      const ack = typeof args[args.length - 1] === 'function' ? args.pop() : () => {};
      try {
        fn(args[0], ack);
      } catch (e) {
        console.error(`[${ev}]`, e);
      }
    });

  // ---- host ----
  on('host:create', (data, ack) => {
    if (!Auth.isTeacherSocket(socket)) return ack({ ok: false, error: 'auth' });
    const room = new Room(io, obj(data).game, socket.id);
    socket.data.room = room;
    socket.data.isHost = true;
    ack({ ok: true, pin: room.pin, hostToken: room.hostToken });
    room.pushHost();
  });

  // the presenter screen: the same teacher on a second device (needs the room's host token)
  on('presenter:join', (data, ack) => {
    const { pin, hostToken } = obj(data);
    const room = Room.get(str(pin));
    if (!Auth.isTeacherSocket(socket) || !room || room.hostToken !== hostToken) return ack({ ok: false });
    room.presenters.add(socket.id);
    socket.data.presenterRoom = room;
    ack({ ok: true, state: room.presenterState() });
  });

  on('presenter:cmd', (d) => {
    const room = socket.data.presenterRoom;
    const o = obj(d);
    if (room && room.presenters.has(socket.id) && room.phase === 'playing' && room.game && room.game.hostCommand && ['next', 'prev', 'goto'].includes(o.cmd)) room.game.hostCommand(o.cmd, o.arg);
  });

  on('host:rejoin', (data, ack) => {
    const { pin, hostToken } = obj(data);
    const room = Room.get(str(pin));
    if (!Auth.isTeacherSocket(socket) || !room || room.hostToken !== hostToken) return ack({ ok: false });
    room.attachHost(socket.id);
    socket.data.room = room;
    socket.data.isHost = true;
    ack({ ok: true, pin: room.pin });
    room.pushHost();
  });

  // only the socket currently attached as host may control the room
  const hostRoom = () => {
    const room = socket.data.isHost ? socket.data.room : null;
    return room && room.hostSocketId === socket.id && Room.get(room.pin) === room ? room : null;
  };

  on('host:game', (gameId) => {
    const room = hostRoom();
    if (!room) return;
    room.setGame(str(gameId));
    room.pushAll();
  });

  on('host:settings', (s) => {
    const room = hostRoom();
    if (!room) return;
    room.setSettings(obj(s));
    room.pushHost();
  });

  on('host:quizzes', () => {
    const room = hostRoom();
    if (!room) return;
    room.quizList(true);
    room.pushHost();
  });

  on('host:setup', (s) => {
    const room = hostRoom();
    if (!room) return;
    room.setSetup(obj(s));
    room.pushAll();
  });

  // play again: same PIN, same players, back to the lobby
  on('host:rematch', (_, ack) => {
    const room = hostRoom();
    ack({ ok: !!(room && room.rematch()) });
  });

  on('host:report', (_, ack) => {
    const room = hostRoom();
    ack(room ? { ok: true, report: room.report() } : { ok: false });
  });

  on('host:start', () => {
    const room = hostRoom();
    if (room) room.start();
  });

  // remove a player: in the lobby and, since 2026-10-30, also in the middle of a game
  on('host:kick', (pid) => {
    const room = hostRoom();
    if (room && room.phase !== 'ended' && room.phase !== 'countdown') room.removePlayer(str(pid), true);
  });

  // rename a player (no name = a random one); the score stays
  on('host:rename', (data, ack) => {
    const room = hostRoom();
    const d = obj(data);
    const r = room ? room.renamePlayer(str(d.id), typeof d.name === 'string' ? d.name : undefined) : { error: 'אין חדר' };
    if (typeof ack === 'function') ack(r);
  });

  // classic quiz: next stage (open answers / reveal / leaderboard / next question)
  on('host:next', () => {
    const room = hostRoom();
    if (room && room.phase === 'playing' && room.game.hostCommand) room.game.hostCommand('next');
  });

  // a lesson: back one step, or jump to any step
  on('host:cmd', (d) => {
    const room = hostRoom();
    const o = obj(d);
    if (room && room.phase === 'playing' && room.game.hostCommand && ['next', 'prev', 'goto'].includes(o.cmd)) room.game.hostCommand(o.cmd, o.arg);
  });

  on('host:end', () => {
    const room = hostRoom();
    if (room) room.end();
  });

  // host leaves for a new game: drop the finished room right away
  on('host:close', (_, ack) => {
    const room = hostRoom();
    if (room && room.phase !== 'playing') room.destroy();
    socket.data.room = null;
    socket.data.isHost = false;
    ack({ ok: true });
  });

  // ---- player ----
  // step 1 of joining: is the PIN valid, and does the room want a typed name?
  on('player:check', (data, ack) => {
    const room = Room.get(str(obj(data).pin).trim());
    if (!room) return ack({ ok: false, error: 'קוד המשחק לא נמצא' });
    // a typed name can also bring back someone who dropped out, so ask for it even mid-game
    const closed = room.joinable();
    if (closed && room.setup.nameMode !== 'custom') return ack({ ok: false, error: closed });
    ack({ ok: true, nameMode: room.setup.nameMode, scene: room.setup.scene, running: room.phase === 'playing', roster: room.setup.nameMode === 'custom' ? room.roster() : null });
  });

  on('player:photo', (data) => {
    const room = socket.data.room;
    const p = room && !socket.data.isHost && room.players.get(socket.data.playerId);
    if (p && p.socketId === socket.id) room.setPhoto(p, str(obj(data).photo));
  });

  on('host:unphoto', (pid) => {
    const room = hostRoom();
    const p = room && room.players.get(str(pid));
    if (p) room.setPhoto(p, '');
  });

  on('player:reroll', () => {
    const room = socket.data.room;
    const p = room && !socket.data.isHost && room.players.get(socket.data.playerId);
    if (p && p.socketId === socket.id) room.rerollName(p);
  });

  on('player:join', (data, ack) => {
    const { pin, name } = obj(data);
    const room = Room.get(str(pin).trim());
    if (!room) return ack({ ok: false, error: 'קוד המשחק לא נמצא' });
    const r = room.addPlayer(str(name), socket.id);
    if (r.error) return ack({ ok: false, error: r.error });
    // the same socket joining again (e.g. back to the join form): leave the previous lobby seat
    const prev = socket.data.room;
    if (prev && !socket.data.isHost && socket.data.playerId) {
      const old = prev.players.get(socket.data.playerId);
      if (old && old.socketId === socket.id) {
        if (prev.phase === 'lobby') prev.removePlayer(old.id, false);
        else prev.detachPlayer(old);
      }
    }
    socket.data.room = room;
    socket.data.playerId = r.player.id;
    socket.data.isHost = false;
    if (r.reclaimed) room.attachPlayer(r.player, socket.id);
    ack({ ok: true, token: r.player.token, pin: room.pin, back: !!r.reclaimed });
    room.pushPlayer(r.player);
    if (room.phase === 'playing') socket.emit('board', { board: room.game.publicState(), left: room.left() });
  });

  on('player:rejoin', (data, ack) => {
    const { pin, token, soft } = obj(data);
    const room = Room.get(str(pin));
    const p = room && room.findByToken(str(token));
    if (!p) return ack({ ok: false });
    // soft = a session remembered on this device: don't take over a player who is playing in another tab
    if (soft && p.connected && p.socketId && p.socketId !== socket.id && io.sockets.sockets.get(p.socketId)) return ack({ ok: false });
    // a second tab / stale socket of the same player stops controlling it
    if (p.socketId && p.socketId !== socket.id) {
      const old = io.sockets.sockets.get(p.socketId);
      if (old) {
        old.data.room = null;
        old.emit('kicked', { replaced: true });
      }
    }
    room.attachPlayer(p, socket.id);
    socket.data.room = room;
    socket.data.playerId = p.id;
    socket.data.isHost = false;
    ack({ ok: true, pin: room.pin });
    room.pushPlayer(p);
    if (room.phase === 'playing') socket.emit('board', { board: room.game.publicState(), left: room.left() });
    room.scheduleHostPush();
  });

  on('player:action', (data) => {
    const { type, data: payload } = obj(data);
    const room = socket.data.room;
    if (!room || socket.data.isHost || typeof type !== 'string') return;
    const p = room.players.get(socket.data.playerId);
    if (!p || p.socketId !== socket.id || room.phase !== 'playing') return;
    room.game.handle(p, type, obj(payload));
  });

  socket.on('disconnect', () => {
    try {
      if (socket.data.presenterRoom) socket.data.presenterRoom.presenters.delete(socket.id);
      const room = socket.data.room;
      if (!room) return;
      if (socket.data.isHost) return room.detachHost(socket.id);
      const p = room.players.get(socket.data.playerId);
      if (p && p.socketId === socket.id) room.detachPlayer(p);
    } catch (e) {
      console.error('[disconnect]', e);
    }
  });
});

// housekeeping: drop rooms whose host is gone, and very old rooms
setInterval(() => {
  const now = Date.now();
  for (const room of [...Room.all().values()]) {
    const hostGone = !room.hostSocketId && now - room.hostGoneAt > 30 * 60 * 1000;
    const stale = room.phase !== 'playing' && now - room.touched > 6 * 60 * 60 * 1000;
    if (hostGone || stale) room.destroy();
  }
}, 60 * 1000).unref();

// last line of defence: log and keep the classroom running
process.on('uncaughtException', (e) => console.error('[uncaught]', e));
process.on('unhandledRejection', (e) => console.error('[unhandled]', e));

server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is already in use - is the server already running?` : e);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  if (Auth.online()) {
    console.log(`Quiz games running ONLINE on port ${PORT}${Auth.PUBLIC_URL ? ` (${Auth.PUBLIC_URL})` : ''}. Teachers sign in at /login.html`);
    if (!Auth.PUBLIC_URL) console.log('  Tip: set PUBLIC_URL to the address students open, so the join link and QR code are right.');
    return;
  }
  console.log(`Quiz games running. Host screen: http://localhost:${PORT}/host.html`);
  const list = Net.addresses();
  if (!list.length) console.log('  This computer is not connected to a network: phones cannot join yet.');
  list.forEach((a, i) => console.log(`  ${i ? '   or' : 'phones join at'}: http://${a.ip}:${PORT}   (${a.label}: ${a.name})`));
});
