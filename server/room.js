// Generic room: PIN, host, players, lobby, countdown, timer, rematch and stats.
// Games plug in via server/games/*.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { shuffle } = require('./shuffle');
const Filter = require('./filter');
const Classes = require('./classes');
const Quizzes = require('./quizzes');
const TEAMS = require('./teams');
const { randomName } = require('./names');
const GAMES = require('./games');
const DURATIONS = [120, 180, 300, 480, 600];
const COUNTDOWN_MS = 3800; // 3 · 2 · 1 · GO
const LOBBY_GRACE_MS = 20000; // a phone that drops in the lobby keeps its seat this long
const NAME_MODES = ['custom', 'spin', 'auto'];
const SCENES = ['classic', 'space', 'ocean', 'forest', 'candy', 'sunset', 'aurora', 'starfield', 'underwater', 'balloons', 'neon', 'snow', 'fireflies', 'party', 'sakura', 'rain', 'embers', 'lanterns', 'clouds', 'lavalamp', 'city', 'desert', 'beach', 'hexgrid'];
const Media = require('./media');
// a built-in scene, or one of the teacher's pictures / videos in the backgrounds folder
const THEMES = ['default', 'candy', 'ocean', 'forest', 'sunset', 'mono', 'neon', 'space']; // question themes (themes.css)
const validScene = (sc) => typeof sc === 'string' && (SCENES.includes(sc) || (sc.startsWith('file:') && Media.isBackground(sc)));
const MAX_REROLLS = 3;
const REPORTS_DIR = process.env.REPORTS_DIR || path.join(__dirname, '..', 'reports');

const rooms = new Map();
const id = () => crypto.randomBytes(8).toString('hex');

function makePin() {
  let pin;
  do pin = String(Math.floor(100000 + Math.random() * 900000));
  while (rooms.has(pin));
  return pin;
}

// settings every game gets on top of its own options
function defaultsFor(G) {
  return { teams: G.mode === 'teams' ? G.defaultTeams || (G.teamCounts || [2])[0] : 0, need: 1, amount: 1, ...G.defaults };
}

function optionsFor(G) {
  const opts = [];
  if (G.mode === 'teams' && (G.teamCounts || [2]).length > 1) {
    opts.push({ key: 'teams', label: 'מספר קבוצות', choices: G.teamCounts.map((n) => [n, `${n} קבוצות`]) });
  } else if (G.mode === 'ffa' && G.teamPlay !== false) {
    opts.push({ key: 'teams', label: 'צורת משחק', choices: [[0, 'כל אחד לעצמו'], [2, '2 קבוצות'], [3, '3 קבוצות'], [4, '4 קבוצות']] });
  }
  if (!G.noReward) {
    const r = G.reward || ['תור', 'תורות'];
    opts.push({ key: 'need', label: `תשובות נכונות ל${r[0]}`, choices: [[1, '1'], [2, '2'], [3, '3'], [5, '5']] });
    opts.push({ key: 'amount', label: `${r[1]} בכל פעם`, choices: [[1, '1'], [2, '2'], [3, '3']] });
  }
  return [...opts, ...G.options];
}

class Room {
  constructor(io, gameId, hostSocketId) {
    this.io = io;
    this.pin = makePin();
    this.hostToken = id();
    this.hostSocketId = hostSocketId;
    this.hostGoneAt = 0;
    this.players = new Map();
    this.phase = 'lobby';
    this.game = null;
    this.presenters = new Set();
    this.results = null;
    this.endAt = 0;
    this.startAt = 0;
    this.timer = null;
    this.countdownTimer = null;
    this.hostPushTimer = null;
    this.touched = Date.now();
    this.destroyed = false;
    this.createdAt = new Date();
    // room-wide options that survive game changes and rematches
    this.setup = { nameMode: 'custom', scene: 'classic', video: '', winText: '', quiz: Quizzes.SAMPLE_ID, photos: true, filter: true, silly: false, qtheme: 'default', classId: '' };
    this.quizData = null;
    this.quizCache = null;
    this.round = 0;
    this.rounds = [];
    this.stats = new Map(); // player id -> { name, rounds: [], answers: [] }
    this.setGame(gameId);
    rooms.set(this.pin, this);
  }

  static get(pin) {
    return rooms.get(String(pin));
  }

  static all() {
    return rooms;
  }

  setGame(gameId) {
    if (this.phase !== 'lobby') return;
    this.Game = Object.prototype.hasOwnProperty.call(GAMES, gameId) ? GAMES[gameId] : this.Game || GAMES.territory || Object.values(GAMES)[0];
    const keep = this.settings ? { duration: this.settings.duration, need: this.settings.need, amount: this.settings.amount } : {};
    this.settings = defaultsFor(this.Game);
    if (keep.duration) this.settings.duration = keep.duration;
    if (!this.Game.noReward && keep.need) Object.assign(this.settings, { need: keep.need, amount: keep.amount });
    this.touched = Date.now();
  }

  setSettings(s) {
    if (this.phase !== 'lobby' || !s) return;
    if (DURATIONS.includes(Number(s.duration))) this.settings.duration = Number(s.duration);
    for (const o of optionsFor(this.Game)) {
      if (s[o.key] === undefined) continue;
      const c = o.choices.find(([v]) => String(v) === String(s[o.key]));
      if (c) this.settings[o.key] = c[0];
    }
  }

  setSetup(s) {
    if (!s) return;
    if (NAME_MODES.includes(s.nameMode)) this.setup.nameMode = s.nameMode;
    if (validScene(s.scene)) this.setup.scene = s.scene;
    if (typeof s.photos === 'boolean') this.setup.photos = s.photos;
    if (typeof s.filter === 'boolean') this.setup.filter = s.filter;
    if (typeof s.silly === 'boolean') this.setup.silly = s.silly;
    if (THEMES.includes(s.qtheme)) this.setup.qtheme = s.qtheme;
    if (typeof s.classId === 'string') this.setup.classId = Classes.get(s.classId) ? s.classId : '';
    if (typeof s.video === 'string') this.setup.video = s.video.trim().slice(0, 300);
    if (typeof s.winText === 'string') this.setup.winText = s.winText.replace(/[\u0000-\u001f]/g, ' ').slice(0, 140);
    if (typeof s.quiz === 'string' && s.quiz !== this.setup.quiz) {
      const q = this.quizList(true).find((x) => x.id === s.quiz);
      if (q) {
        this.setup.quiz = s.quiz;
        // a quiz can bring its own background
        if (q.background && validScene(q.background) && !s.scene) this.setup.scene = q.background;
        if (THEMES.includes(q.theme) && !s.qtheme) this.setup.qtheme = q.theme;
      }
    }
  }

  // the quiz library (re-read from disk at most every few seconds)
  quizList(fresh) {
    if (fresh || !this.quizCache || Date.now() - this.quizCache.at > 4000) {
      this.quizCache = { at: Date.now(), list: Quizzes.list().map(({ id, title, count, playable, builtin, folder, background, theme }) => ({ id, title, count, playable, builtin: !!builtin, folder: folder || '', theme: theme || '', background: background || '' })) };
    }
    return this.quizCache.list;
  }

  // how many teams this game is played with (0 = everyone for themselves / co-op)
  teamCount() {
    const G = this.Game;
    const n = Number(this.settings.teams) || 0;
    if (G.mode === 'coop') return 0;
    if (G.mode === 'teams') return (G.teamCounts || [2]).includes(n) ? n : G.defaultTeams || (G.teamCounts || [2])[0];
    return G.teamPlay !== false && n >= 2 && n <= 4 ? n : 0;
  }

  teams() {
    return TEAMS.slice(0, this.teamCount());
  }

  left() {
    return this.phase === 'playing' ? Math.max(0, Math.ceil((this.endAt - Date.now()) / 1000)) : 0;
  }

  // ---- host ----
  attachHost(socketId) {
    const old = this.hostSocketId;
    if (old && old !== socketId) {
      // the room was opened in another tab: tell the old tab it lost control
      const s = this.io.sockets.sockets.get(old);
      if (s) {
        s.emit('host:replaced');
        s.data.room = null;
        s.data.isHost = false;
      }
    }
    this.hostSocketId = socketId;
    this.hostGoneAt = 0;
    this.touched = Date.now();
  }

  detachHost(socketId) {
    if (this.hostSocketId !== socketId) return;
    this.hostSocketId = null;
    this.hostGoneAt = Date.now();
  }

  // ---- players ----
  takenNames() {
    return new Set([...this.players.values()].map((p) => p.name));
  }

  // can a new player come in now? (the lobby, the countdown, or a running game that allows late joiners)
  joinable() {
    if (this.phase === 'lobby' || this.phase === 'countdown') return null;
    if (this.phase === 'playing') return this.Game.lateJoin === false ? 'המשחק הזה לא מאפשר הצטרפות באמצע. חכו לסיבוב הבא' : null;
    return 'המשחק בדיוק נגמר. חכו רגע לסיבוב הבא ונסו שוב';
  }

  addPlayer(rawName, socketId) {
    let name;
    if (this.setup.nameMode === 'custom') {
      name = String(rawName || '').replace(/[\u0000-\u001f​-‏‪-‮]/g, '').trim().slice(0, 14);
      if (!name) return { error: 'צריך לבחור שם' };
      if (this.setup.filter && Filter.bad(name)) return { error: 'השם הזה לא מתאים, נסו אחר' };
      for (const p of this.players.values()) {
        if (p.name.toLowerCase() !== name.toLowerCase()) continue;
        // the same name of someone who dropped out = it's them coming back: their progress is kept
        if (!p.connected && this.phase !== 'lobby') return { player: p, reclaimed: true };
        return { error: 'השם כבר תפוס' };
      }
    }
    const closed = this.joinable();
    if (closed) return { error: closed };
    if (this.players.size >= 200) return { error: 'החדר מלא' };
    if (this.setup.nameMode !== 'custom') name = randomName(this.takenNames());
    const p = { id: id(), token: id(), name, socketId, connected: true, team: -1, g: null, graceTimer: null, joinedAt: Date.now(), rerolls: 0 };
    this.players.set(p.id, p);
    if (this.phase === 'playing') this.lateJoin(p);
    this.touched = Date.now();
    this.scheduleHostPush();
    return { player: p };
  }

  // joining a running game: the smallest team, a fresh start in the game
  lateJoin(p) {
    const n = this.teamCount();
    if (n >= 2) {
      const sizes = Array.from({ length: n }, (_, t) => [...this.players.values()].filter((o) => o !== p && o.team === t).length);
      p.team = sizes.indexOf(Math.min(...sizes));
    }
    try {
      if (this.game && this.game.lateInit && this.game.lateInit(p)) this.game.addFeed(`👋 ${p.name} הצטרף/ה למשחק`, p.team);
    } catch (e) {
      console.error('[late join]', e);
      p.g = null;
    }
  }

  // an optional player photo: a small JPEG kept in memory only (never written to disk or reports)
  setPhoto(p, data) {
    if (data === '') {
      p.photo = null;
    } else {
      if (!this.setup.photos || typeof data !== 'string' || data.length > 60000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data)) return;
      p.photo = data;
    }
    p.photoV = (p.photoV || 0) + 1;
    this.pushPlayer(p);
    this.scheduleHostPush();
  }

  photoUrl(p) {
    return this.setup.photos && p.photo ? `/photo/${this.pin}/${p.id}?v=${p.photoV}` : '';
  }

  // the class list for the join screen: each name and whether somebody is already using it
  roster() {
    const cls = this.setup.classId && Classes.get(this.setup.classId);
    if (!cls) return null;
    const used = new Set([...this.players.values()].filter((p) => p.connected || this.phase === 'lobby').map((p) => p.name.toLowerCase()));
    return { name: cls.name, students: cls.students.map((n) => ({ name: n, taken: used.has(n.toLowerCase()) })) };
  }

  rerollName(p) {
    if (this.phase !== 'lobby' || this.setup.nameMode !== 'spin' || p.rerolls >= MAX_REROLLS) return;
    p.rerolls++;
    p.name = randomName(this.takenNames());
    this.pushPlayer(p);
    this.scheduleHostPush();
  }

  findByToken(token) {
    if (!token) return null;
    for (const p of this.players.values()) if (p.token === token) return p;
    return null;
  }

  attachPlayer(p, socketId) {
    clearTimeout(p.graceTimer);
    p.graceTimer = null;
    p.socketId = socketId;
    p.connected = true;
    this.touched = Date.now();
  }

  detachPlayer(p) {
    p.socketId = null;
    p.connected = false;
    if (this.phase === 'lobby') this.startGrace(p);
    this.scheduleHostPush();
  }

  startGrace(p) {
    clearTimeout(p.graceTimer);
    p.graceTimer = setTimeout(() => {
      p.graceTimer = null;
      if (!p.connected && this.phase === 'lobby' && this.players.get(p.id) === p) this.removePlayer(p.id, false);
    }, LOBBY_GRACE_MS);
  }

  // the teacher renames a player (any time, the score stays): no name = a new random one
  renamePlayer(pid, rawName) {
    const p = this.players.get(pid);
    if (!p) return { error: 'השחקן לא נמצא' };
    let name;
    if (rawName === undefined || rawName === null || rawName === '') name = randomName(this.takenNames());
    else {
      name = String(rawName).replace(/[\u0000-\u001f\u200b-\u200f\u202a-\u202e]/g, '').trim().slice(0, 14);
      if (!name) return { error: 'שם לא תקין' };
      if (this.setup.filter && Filter.bad(name)) return { error: 'השם הזה לא מתאים' };
      for (const o of this.players.values()) if (o !== p && o.name.toLowerCase() === name.toLowerCase()) return { error: 'השם כבר תפוס' };
    }
    p.name = name;
    this.touched = Date.now();
    this.pushPlayer(p);
    this.pushAll();
    return { ok: true, name };
  }

  removePlayer(pid, kicked) {
    const p = this.players.get(pid);
    if (!p) return;
    clearTimeout(p.graceTimer);
    this.players.delete(pid);
    // a game in progress lets go of the player (turns, teams, queues)
    if (this.phase === 'playing' && this.game) {
      try {
        if (this.game.onRemove) this.game.onRemove(p);
        this.game.addFeed && this.game.addFeed(`👋 ${p.name} הוסר/ה מהמשחק`, p.team);
      } catch (e) {
        console.error('onRemove failed:', e);
      }
      if (this.players.size === 0) this.end();
      else this.pushAll();
    }
    if (p.socketId) {
      const s = this.io.sockets.sockets.get(p.socketId);
      if (s && s.data.room === this) {
        s.data.room = null;
        s.data.playerId = null;
      }
      if (kicked) this.io.to(p.socketId).emit('kicked', {});
    }
    this.scheduleHostPush();
  }

  // ---- lifecycle ----
  start() {
    if (this.phase !== 'lobby' || this.players.size < 1) return false;
    const n = this.teamCount();
    if (n >= 2) shuffle([...this.players.values()]).forEach((p, i) => (p.team = i % n));
    else for (const p of this.players.values()) p.team = -1;
    this.phase = 'countdown';
    this.startAt = Date.now() + COUNTDOWN_MS;
    this.countdownTimer = setTimeout(() => {
      this.countdownTimer = null;
      this.begin();
    }, COUNTDOWN_MS);
    this.pushAll();
    return true;
  }

  begin() {
    if (this.phase !== 'countdown' || this.destroyed) return;
    this.round++;
    this.quizData = Quizzes.questionsFor(this.setup.quiz, { all: !!this.Game.classic });
    this.game = new this.Game(this);
    this.phase = 'playing';
    // untimed games (classic quiz) end when their questions run out
    this.endAt = Date.now() + (this.Game.untimed ? 6 * 3600 : this.settings.duration) * 1000;
    this.game.start();
    this.timer = setInterval(() => {
      try {
        if (this.game.tick) this.game.tick();
        if (this.phase !== 'playing') return;
        if (this.left() <= 0) return this.end();
        this.pushHost();
        this.pushBoard();
      } catch (e) {
        console.error('[tick]', e);
      }
    }, this.Game.tickMs || 1000);
    this.pushAll();
  }

  end() {
    if (this.phase === 'countdown') {
      // cancelled before it began: back to the lobby
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
      this.phase = 'lobby';
      this.pushAll();
      return;
    }
    if (this.phase !== 'playing') return;
    clearInterval(this.timer);
    this.timer = null;
    this.game.stop();
    this.phase = 'ended';
    try {
      this.results = this.game.results();
    } catch (e) {
      console.error('[results]', e);
      this.results = { kind: this.Game.id, players: [] };
    }
    // everyone-for-themselves games played in teams: add up each team's members
    if (this.Game.mode === 'ffa' && this.teamCount() >= 2) {
      const ts = this.teamScores();
      const best = Math.max(...ts.map((t) => t.score));
      this.results.teamScores = ts;
      this.results.winnerTeam = ts.filter((t) => t.score === best).length > 1 ? -1 : ts.findIndex((t) => t.score === best);
    }
    this.results.winText = this.setup.winText;
    try {
      this.recordRound();
    } catch (e) {
      console.error('[stats]', e);
    }
    this.touched = Date.now();
    this.pushAll();
  }

  // back to the lobby with the same PIN and the same players
  rematch() {
    if (this.phase !== 'ended') return false;
    this.phase = 'lobby';
    this.game = null;
    this.results = null;
    for (const p of [...this.players.values()]) {
      p.g = null;
      p.team = -1;
      p.rerolls = 0;
      if (!p.connected) this.startGrace(p);
    }
    this.touched = Date.now();
    this.pushAll();
    return true;
  }

  destroy() {
    this.destroyed = true;
    clearInterval(this.timer);
    clearTimeout(this.countdownTimer);
    clearTimeout(this.hostPushTimer);
    for (const p of this.players.values()) clearTimeout(p.graceTimer);
    if (this.game && !this.game.over) this.game.stop();
    if (this.phase === 'playing') this.phase = 'ended';
    rooms.delete(this.pin);
  }

  // ---- stats ----
  stat(p) {
    let s = this.stats.get(p.id);
    if (!s) this.stats.set(p.id, (s = { name: p.name, rounds: [], answers: [] }));
    s.name = p.name;
    return s;
  }

  logAnswer(p, entry) {
    this.stat(p).answers.push({ round: this.round, game: this.Game.title, ...entry });
  }

  teamScores() {
    const ts = this.teams().map((t) => ({ ...t, score: 0, size: 0 }));
    if (!this.game) return ts;
    for (const p of this.players.values()) {
      if (!p.g || p.team < 0 || !ts[p.team]) continue;
      ts[p.team].score += Math.round(this.game.score(p) || 0);
      ts[p.team].size++;
    }
    // classic quiz: a team's score is the average of its members (big teams don't win by size)
    if (this.Game.teamAvg) for (const t of ts) t.score = t.size ? Math.round(t.score / t.size) : 0;
    return ts;
  }

  recordRound() {
    const list = [...this.players.values()].filter((p) => p.g).map((p) => ({ p, score: Math.round(this.game.score(p) || 0) }));
    list.sort((a, b) => b.score - a.score);
    list.forEach(({ p, score }, i) => {
      this.stat(p).rounds.push({ round: this.round, game: this.Game.title, score, rank: i + 1, of: list.length, correct: p.g.correct, wrong: p.g.wrong, team: p.team });
    });
    this.rounds.push({ round: this.round, game: this.Game.title, at: new Date().toISOString(), players: list.length });
    // keep a copy on disk so the teacher has it after the server stops
    const stamp = this.createdAt.toISOString().slice(0, 16).replace(/[:T]/g, '-');
    fs.promises
      .mkdir(REPORTS_DIR, { recursive: true })
      .then(() => fs.promises.writeFile(path.join(REPORTS_DIR, `${stamp}_${this.pin}.json`), JSON.stringify(this.report(), null, 2)))
      .catch((e) => console.error('[report]', e.message));
  }

  report() {
    const players = [...this.stats.values()].map((s) => {
      const correct = s.answers.filter((a) => a.ok).length;
      return {
        name: s.name,
        points: s.rounds.reduce((t, r) => t + r.score, 0),
        correct,
        wrong: s.answers.length - correct,
        accuracy: s.answers.length ? Math.round((correct / s.answers.length) * 100) : 0,
        rounds: s.rounds,
        answers: s.answers,
      };
    });
    players.sort((a, b) => b.correct - a.correct || b.points - a.points);
    return { pin: this.pin, created: this.createdAt.toISOString(), classId: this.setup.classId || '', quiz: this.quizData ? this.quizData.title : '', rounds: this.rounds, players };
  }

  // ---- pushing state ----
  hostState() {
    return {
      pin: this.pin,
      phase: this.phase,
      gameId: this.Game.id,
      gameTitle: this.Game.title,
      mode: this.Game.mode,
      games: Object.values(GAMES).map((G) => ({ id: G.id, title: G.title, emoji: G.emoji, mode: G.mode, blurb: G.blurb, classic: !!G.classic })),
      untimed: !!this.Game.untimed,
      lateJoin: this.Game.lateJoin !== false,
      options: optionsFor(this.Game),
      settings: this.settings,
      setup: this.setup,
      quizzes: this.phase === 'lobby' ? this.quizList() : null,
      classes: this.phase === 'lobby' ? Classes.list() : null,
      quizTitle: this.quizData ? this.quizData.title : '',
      round: this.round,
      teamCount: this.teamCount(),
      left: this.left(),
      cd: this.phase === 'countdown' ? Math.max(0, this.startAt - Date.now()) : 0,
      players: [...this.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team, connected: p.connected, photo: this.photoUrl(p) })),
      board: this.phase === 'playing' ? this.game.publicState() : null,
      teamScores: this.phase === 'playing' && this.Game.mode === 'ffa' && this.teamCount() >= 2 ? this.teamScores() : null,
      results: this.results,
    };
  }

  scheduleHostPush() {
    if (this.hostPushTimer || this.destroyed) return;
    this.hostPushTimer = setTimeout(() => {
      this.hostPushTimer = null;
      if (this.destroyed) return;
      this.pushHost();
      if (this.phase === 'playing') this.pushBoard();
    }, 120);
  }

  pushHost() {
    if (this.hostSocketId) this.io.to(this.hostSocketId).emit('host:state', this.hostState());
    this.pushPresenters();
  }

  // the teacher's own phone or laptop (presenter.html): notes, what is next, the class's reactions, and the next / back buttons
  presenterState() {
    const base = { pin: this.pin, phase: this.phase, gameId: this.Game.id, title: this.quizData ? this.quizData.title : '' };
    if (this.phase !== 'playing' || !this.game || !this.game.presenterState) return base;
    return { ...base, ...this.game.presenterState() };
  }

  pushPresenters() {
    if (!this.presenters || !this.presenters.size) return;
    const st = this.presenterState();
    for (const id of this.presenters) this.io.to(id).emit('presenter:state', st);
  }

  pushBoard() {
    const data = { board: this.game.publicState(), left: this.left() };
    for (const p of this.players.values()) if (p.socketId) this.io.to(p.socketId).emit('board', data);
  }

  personal(p) {
    // `phase` is the room phase in lobby/countdown/ended, and the player's own game phase while playing
    const team = p.team >= 0 ? TEAMS[p.team] : null;
    const base = {
      name: p.name,
      team: p.team,
      teamName: team ? team.name : '',
      teamColor: team ? team.color : '',
      phase: this.phase,
      left: this.left(),
      duration: this.settings.duration,
      gameId: this.Game.id,
      gameTitle: this.Game.title,
      emoji: this.Game.emoji,
      mode: this.Game.mode,
      scene: this.setup.scene,
      qtheme: this.setup.qtheme,
      round: this.round,
      untimed: !!this.Game.untimed,
      photos: !!this.setup.photos,
      photo: this.photoUrl(p),
    };
    if (this.phase === 'lobby') return { ...base, canReroll: this.setup.nameMode === 'spin' && p.rerolls < MAX_REROLLS };
    if (this.phase === 'countdown') return { ...base, cd: Math.max(0, this.startAt - Date.now()) };
    if (this.phase === 'ended') return { ...base, results: this.results };
    if (!p.g) return { ...base, phase: 'spectate' };
    return { ...base, ...this.game.personal(p) };
  }

  pushPlayer(p) {
    if (p.socketId && !this.destroyed) this.io.to(p.socketId).emit('you', this.personal(p));
  }

  pushAll() {
    this.pushHost();
    for (const p of this.players.values()) this.pushPlayer(p);
    if (this.phase === 'playing') this.pushBoard();
  }
}

Room.NAME_MODES = NAME_MODES;
module.exports = Room;
