// "מי המתחזה?" - co-op with a secret traitor (Among Us style). Everyone answers questions. Right answers from the crew
// fill a shared task bar. Impostors answer too, and a right answer lets them sabotage (drain the bar or jam a crew
// member's phone). At 1/3 and 2/3 of the bar the class holds a meeting and votes someone out.
const QuizGame = require('./base');

const PER_CREW = { easy: 5, normal: 7, hard: 9 };
const MEETING_MS = 40000;
const RESULT_MS = 6500;
const SABOTAGE_PICK_MS = 8000;
const SABOTAGE_GAP_MS = 12000;
const JAM_MS = 7000;
const MARKS = [1 / 3, 2 / 3];

class ImpostorGame extends QuizGame {
  static id = 'impostor';
  static order = 14;
  static title = 'מי המתחזה?';
  static emoji = '🕵️';
  static mode = 'coop';
  static noReward = true;
  static blurb = 'כולם עונים על שאלות, אבל בין החברים מסתתר מתחזה סודי. תשובות נכונות של הצוות ממלאות את הסרגל המשותף, והמתחזה מנסה להפריע. בפגישות הכיתה מצביעה ומדיחה את החשוד. מצאו אותו לפני שהוא מחבל בכול!';
  static tickMs = 1000;
  static defaults = { duration: 420, difficulty: 'normal' };
  static options = [{ key: 'difficulty', label: 'קושי', choices: [['easy', 'קל'], ['normal', 'רגיל'], ['hard', 'קשה']] }];

  start() {
    const all = this.players();
    const k = all.length >= 9 ? 2 : 1;
    const imps = new Set([...all].sort(() => Math.random() - 0.5).slice(0, k).map((p) => p.id));
    this.progress = 0;
    this.stage = 'play'; // play | meeting | result
    this.meetingNo = 0;
    this.marksDone = 0;
    this.winner = null;
    this.ev = [];
    this.eid = 1;
    this.lastSab = 0;
    this.meeting = null;
    this.result = null;
    this.crewCount = all.length - k;
    this.goal = Math.max(10, Math.round(this.crewCount * (PER_CREW[this.room.settings.difficulty] || 7)));
    for (const p of all) this.initPlayer(p, { imp: imps.has(p.id), alive: true, jamUntil: 0, hint: null, timer: null, vote: null, sabotaged: 0 });
    this.addFeed('🕵️ בין החברים מסתתר מתחזה… היזהרו!');
  }

  // a player who joins mid-game is always crew
  lateInit(p) {
    this.initPlayer(p, { imp: false, alive: true, jamUntil: 0, hint: null, timer: null, vote: null, sabotaged: 0 });
    this.crewCount++;
    return true;
  }

  event(e) {
    this.ev.push({ id: this.eid++, ...e });
    if (this.ev.length > 20) this.ev.shift();
  }

  alive() {
    return this.players().filter((p) => p.g && p.g.alive);
  }

  score(p) {
    return p.g ? p.g.correct : 0;
  }

  tick() {
    if (this.over || this.winner) return;
    this.check();
  }

  // the end of the game, or null while it goes on
  check() {
    if (this.winner) return;
    const live = this.alive();
    const imps = live.filter((p) => p.g.imp).length;
    const crew = live.length - imps;
    const anyImp = this.players().some((p) => p.g && p.g.imp);
    if (anyImp && imps === 0) this.finish('crew', '🎉 כל המתחזים נתפסו!');
    else if (this.progress >= this.goal) this.finish('crew', '✅ כל המשימות הושלמו!');
    else if (imps > 0 && crew <= imps) this.finish('imp', '😈 המתחזים השתלטו על הצוות!');
  }

  finish(who, text) {
    this.winner = who;
    this.addFeed(text);
    this.event({ k: 'end', who });
    this.room.scheduleHostPush();
    this.later(() => this.room.end(), 3500);
  }

  // time ran out: the impostors survived
  results() {
    const who = this.winner || (this.progress >= this.goal ? 'crew' : 'imp');
    return {
      kind: 'impostor',
      win: who,
      progress: Math.min(100, Math.round((this.progress / this.goal) * 100)),
      players: this.players()
        .filter((p) => p.g)
        .map((p) => ({ name: p.name, imp: p.g.imp, alive: p.g.alive, correct: p.g.correct, wrong: p.g.wrong, sabotaged: p.g.sabotaged }))
        .sort((a, b) => Number(b.imp) - Number(a.imp) || b.correct - a.correct),
    };
  }

  onAnswer(p, correct) {
    const g = p.g;
    if (!correct) return {};
    if (g.imp) return { note: '🎭 מעולה, נראה כמו חבר צוות' };
    this.progress++;
    const before = this.marksDone;
    while (this.marksDone < MARKS.length && this.progress >= this.goal * MARKS[this.marksDone]) this.marksDone++;
    if (this.marksDone > before) this.later(() => this.startMeeting(), 1500);
    return { note: '🔧 משימה בוצעה!' };
  }

  afterFeedback(p) {
    const g = p.g;
    if (this.stage !== 'play') return;
    if (g.imp && g.last && g.last.correct && Date.now() - this.lastSab > SABOTAGE_GAP_MS) {
      g.phase = 'sabotage';
      clearTimeout(g.timer);
      g.timer = this.later(() => {
        if (p.g.phase === 'sabotage') this.sabotage(p, 'drain');
      }, SABOTAGE_PICK_MS + 1000);
      return;
    }
    this.nextQuestion(p);
  }

  handle(p, type, data) {
    // a jammed phone cannot answer for a few seconds
    if (type === 'answer' && p.g && p.g.jamUntil > Date.now()) return;
    if (type === 'answer' && this.stage !== 'play') return;
    super.handle(p, type, data);
  }

  action(p, type, data) {
    const g = p.g;
    if (type === 'sabotage' && g.imp && g.phase === 'sabotage') {
      if (data.k === 'drain') this.sabotage(p, 'drain');
      else if (data.k === 'jam' && typeof data.to === 'string') this.sabotage(p, 'jam', data.to);
    } else if (type === 'vote' && g.alive && g.phase === 'vote' && this.stage === 'meeting') {
      if (data.to === 'skip' || this.alive().some((o) => o.id === data.to && o.id !== p.id)) {
        g.vote = data.to;
        this.room.pushPlayer(p);
        this.room.scheduleHostPush();
        if (this.alive().every((o) => o.g.vote !== null)) this.endMeeting();
      }
    }
  }

  sabotage(p, kind, toId) {
    const g = p.g;
    if (this.over || g.phase !== 'sabotage' || this.stage !== 'play') return;
    clearTimeout(g.timer);
    this.lastSab = Date.now();
    g.sabotaged++;
    if (kind === 'jam') {
      const t = this.alive().find((o) => o.id === toId && !o.g.imp);
      if (!t) return this.sabotage(p, 'drain');
      t.g.jamUntil = Date.now() + JAM_MS;
      // the victim "saw something": the first letter of the impostor's name, or (a third of the time) of someone else
      const others = this.alive().filter((o) => o.id !== p.id && o.id !== t.id);
      const who = Math.random() < 0.65 || !others.length ? p : others[Math.floor(Math.random() * others.length)];
      t.g.hint = { letter: [...who.name][0], at: Date.now() };
      this.addFeed(`📡 מישהו הפריע לתקשורת של ${t.name}!`);
      this.event({ k: 'jam', to: t.name });
      this.room.pushPlayer(t);
    } else {
      this.progress = Math.max(0, this.progress - Math.max(3, Math.round(this.goal * 0.06)));
      this.addFeed('⚠️ חבלה! הסרגל המשותף ירד');
      this.event({ k: 'drain' });
    }
    this.nextQuestion(p);
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
  }

  // ---- meetings ----
  startMeeting() {
    if (this.over || this.winner || this.stage !== 'play') return;
    this.stage = 'meeting';
    this.meetingNo++;
    this.meeting = { until: Date.now() + MEETING_MS };
    this.addFeed('🚨 פגישה דחופה! מי המתחזה?');
    this.event({ k: 'meeting' });
    for (const p of this.alive()) {
      clearTimeout(p.g.timer);
      p.g.phase = 'vote';
      p.g.vote = null;
      p.g.jamUntil = 0;
      p.g.turn++;
      this.room.pushPlayer(p);
    }
    this.meetingTimer = this.later(() => this.endMeeting(), MEETING_MS);
    this.room.scheduleHostPush();
  }

  endMeeting() {
    if (this.stage !== 'meeting') return;
    clearTimeout(this.meetingTimer);
    const tally = new Map();
    for (const p of this.alive()) {
      if (p.g.vote && p.g.vote !== 'skip') tally.set(p.g.vote, (tally.get(p.g.vote) || 0) + 1);
    }
    const skips = this.alive().filter((p) => !p.g.vote || p.g.vote === 'skip').length;
    let top = null;
    let best = 0;
    let tie = false;
    for (const [id, n] of tally) {
      if (n > best) { best = n; top = id; tie = false; } else if (n === best) tie = true;
    }
    let ejected = null;
    // someone leaves only with a clear lead, and more votes than the skips
    if (top && !tie && best > skips) ejected = this.room.players.get(top);
    this.result = { name: ejected ? ejected.name : '', imp: ejected ? ejected.g.imp : false, votes: best, skips, tie: !!tie };
    if (ejected) {
      ejected.g.alive = false;
      ejected.g.phase = 'out';
      this.addFeed(ejected.g.imp ? `✅ ${ejected.name} היה/הייתה המתחזה!` : `❌ ${ejected.name} לא היה/הייתה המתחזה…`);
    } else this.addFeed('🤷 לא הוחלט, אף אחד לא הודח');
    this.stage = 'result';
    this.event({ k: 'result' });
    for (const p of this.players()) if (p.g) this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    this.check();
    this.later(() => {
      if (this.winner) return;
      this.stage = 'play';
      this.meeting = null;
      this.result = null;
      for (const p of this.alive()) {
        p.g.vote = null;
        this.nextQuestion(p);
        this.room.pushPlayer(p);
      }
      this.room.scheduleHostPush();
    }, RESULT_MS);
  }

  publicState() {
    const live = this.alive().length;
    return {
      kind: 'impostor',
      stage: this.stage,
      pct: Math.min(100, Math.round((this.progress / this.goal) * 100)),
      marks: MARKS.map((m) => Math.round(m * 100)),
      players: this.players().filter((p) => p.g).map((p) => ({ name: p.name, alive: p.g.alive, correct: p.g.correct, wrong: p.g.wrong, voted: p.g.vote !== null && p.g.vote !== undefined })),
      alive: live,
      meetingNo: this.meetingNo,
      left: this.meeting ? Math.max(0, this.meeting.until - Date.now()) : 0,
      result: this.stage === 'result' ? this.result : null,
      winner: this.winner,
      ev: this.ev,
      feed: this.feed,
    };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), role: g.imp ? 'imp' : 'crew', alive: g.alive, pct: Math.min(100, Math.round((this.progress / this.goal) * 100)), stage: this.stage };
    if (g.imp) out.mates = this.players().filter((o) => o.g && o.g.imp && o.id !== p.id).map((o) => o.name);
    if (g.jamUntil > Date.now()) out.jam = g.jamUntil - Date.now();
    if (g.hint && Date.now() - g.hint.at < 12000) out.hint = g.hint.letter;
    if (g.phase === 'sabotage') {
      out.pickMs = SABOTAGE_PICK_MS;
      out.targets = this.alive().filter((o) => !o.g.imp).map((o) => ({ id: o.id, name: o.name }));
    }
    if (g.phase === 'vote' || this.stage !== 'play') {
      out.vote = g.vote;
      out.candidates = this.alive().filter((o) => o.id !== p.id).map((o) => ({ id: o.id, name: o.name, correct: o.g.correct, wrong: o.g.wrong }));
      out.meetLeft = this.meeting ? Math.max(0, this.meeting.until - Date.now()) : 0;
    }
    if (this.stage === 'result') out.result = this.result;
    if (this.winner) out.winner = this.winner;
    return out;
  }
}

module.exports = ImpostorGame;
