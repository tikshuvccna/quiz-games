// "שיעור" - the teacher teaches with slides and PDF pages, and puts activities right in the flow: a poll, a quick question,
// a "did you understand?" check, a word cloud, a quiz, a fun interlude. One sequence, paced by the teacher.
// It is the classic quiz's engine with a presentation on top:
//   - slides and PDF pages open at once; every phone has 👍 got it / 🤔 not sure / 🙋 I have a question, and the teacher
//     sees the numbers live (and at the end: which slides lost people)
//   - the teacher can go back, jump to any step, and the activities in between are the normal question types
//   - by default nothing is scored (the point is involvement); "with points" turns the checks into a mini-quiz
const ClassicGame = require('./classic');
const qt = require('../qtypes');

const REACTS = ['got', 'unsure', 'ask'];
const SLIDEISH = (q) => q.type === 'slide' || q.type === 'pdf';

class LessonGame extends ClassicGame {
  static id = 'lesson';
  static order = 3;
  static title = 'שיעור: הצגה ופעילויות';
  static emoji = '🎓';
  static mode = 'ffa';
  static classic = true; // every step type, including slides, PDF pages and polls
  static noReward = true;
  static untimed = true;
  static blurb = 'מלמדים עם מצגת: שקופיות ועמודי PDF, ובתוך השיעור פעילויות: סקר, "הבנתם?", שאלה מהירה, ענן מילים, חידון, הפסקה מהנה. התלמידים מגיבים מהטלפון (👍 הבנתי · 🤔 לא בטוח · 🙋 שאלה) והמורה רואה בזמן אמת אם הכיתה איתו. אפשר לחזור אחורה ולקפוץ לכל שלב.';
  static defaults = { duration: 600, count: 0, order: 'original', advance: 'manual', bonus: 'off', style: 'learn', scoring: 'none', timer: 'question' };
  static options = [
    { key: 'scoring', label: 'ניקוד בפעילויות', choices: [['none', 'בלי ניקוד (מעורבות והבנה)'], ['speed', 'עם ניקוד (בדיקת הבנה)']] },
    { key: 'timer', label: 'זמן לפעילות', choices: [['question', 'לפי הפעילות'], ['unlimited', 'ללא הגבלה']] },
  ];

  get style() {
    return this.room.settings.scoring === 'speed' ? 'speed' : 'learn';
  }

  get manual() {
    return true; // the teacher decides when to move on
  }

  start() {
    // settings left over from another game must not shuffle or cut a lesson
    const S = this.room.settings;
    S.order = 'original';
    S.count = 0;
    S.bonus = 'off';
    S.advance = 'manual';
    this.stepLog = [];
    super.start();
  }

  skipReady(q) {
    return SLIDEISH(q);
  }

  readyDelay(q) {
    return q.points >= 2 ? super.readyDelay(q) : 1200;
  }

  // the leaderboard only at the end
  board() {
    if (this.stage !== 'reveal') return;
    if (this.isLast()) return this.room.end();
    this.next();
  }

  // ---------- reactions ----------
  get reacts() {
    if (!this.cur.reacts) this.cur.reacts = new Map();
    return this.cur.reacts;
  }

  reactCounts() {
    const c = { got: 0, unsure: 0, ask: 0 };
    if (this.cur && this.cur.reacts) for (const v of this.cur.reacts.values()) c[v]++;
    return { ...c, n: c.got + c.unsure + c.ask };
  }

  handle(p, type, data) {
    if (this.over || !p.g) return;
    if (type === 'react') {
      if (this.stage !== 'slide' || !this.cur) return;
      const v = data && data.value;
      if (!REACTS.includes(v)) return;
      this.reacts.set(p.id, v);
      this.room.pushPlayer(p);
      this.room.scheduleHostPush();
      return;
    }
    super.handle(p, type, data);
  }

  // what happened on the step the class is leaving
  logStep() {
    const cur = this.cur;
    if (!cur || cur.logged || !SLIDEISH(cur.q)) return;
    cur.logged = true;
    const c = this.reactCounts();
    const q = cur.q;
    this.stepLog.push({ i: this.i, kind: 'slide', title: q.text || (q.pdf ? `עמוד ${q.pdf.page}` : q.bullets ? q.bullets[0] : 'שקופית'), got: c.got, unsure: c.unsure, ask: c.ask });
  }

  afterReveal(rv) {
    const q = this.cur.q;
    const scored = qt.SCORED.has(q.type);
    const answered = rv.answered;
    this.stepLog.push({ i: this.i, kind: 'activity', type: q.type, title: q.text, answered, right: scored ? rv.right : null, pct: scored && answered ? Math.round((rv.right / answered) * 100) : null });
  }

  next() {
    this.logStep();
    super.next();
  }

  // ---------- going back and jumping ----------
  hostCommand(cmd, arg) {
    if (this.over) return;
    if (cmd === 'prev') return this.jump(this.i - 1);
    if (cmd === 'goto') return this.jump(Number(arg));
    super.hostCommand(cmd);
  }

  jump(to) {
    if (!Number.isInteger(to) || to < 0 || to >= this.list.length) return;
    clearTimeout(this.timer);
    this.logStep();
    this.i = to - 1;
    ClassicGame.prototype.next.call(this);
  }

  // ---------- state ----------
  outline() {
    return this.list.map((q) => {
      if (q.type === 'slide') return `🖼️ ${q.text || (q.bullets && q.bullets[0]) || 'שקופית'}`.slice(0, 46);
      if (q.type === 'pdf') return `📄 ${q.text || 'עמוד ' + q.pdf.page}`.slice(0, 46);
      const icon = { poll: '📊', cloud: '☁️', open: '✍️', brain: '💡', qna: '❓', drop: '📌', rate: '⭐', rank: '🏅', tap: '👆', quiz: '🔷', tf: '⚖️' }[q.type] || '🎯';
      return `${icon} ${q.text}`.slice(0, 46);
    });
  }

  publicState() {
    const out = super.publicState();
    out.lesson = { outline: this.outline(), reacts: this.stage === 'slide' ? this.reactCounts() : null, students: this.players().filter((p) => p.connected).length };
    return out;
  }

  personal(p) {
    const out = super.personal(p);
    if (this.stage === 'slide' && this.cur) out.react = this.reacts.get(p.id) || null;
    return out;
  }

  results() {
    const r = super.results();
    this.logStep();
    return { ...r, lesson: { steps: this.stepLog } };
  }
}

module.exports = LessonGame;
