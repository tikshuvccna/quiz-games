// "תרגול ולמידה" - everyone studies the quiz on their own phone at their own pace. Three modes:
//   mastery    - practice until you know it: a question comes back until it was answered right twice; a wrong answer
//                brings it back soon. Explanations after every answer.
//   flashcards - the question on the front, the answer (and the explanation) on the back; "I knew it" or "again".
//   test       - every question once, no feedback until the end, then a personal summary with the mistakes.
// The teacher watches everyone's progress (and who is stuck) on the big screen. No points, no ranking.
const QuizGame = require('./base');
const qt = require('../qtypes');
const { shuffle } = require('../shuffle');

const NEED_RIGHT = 2; // mastery: correct answers needed per question
const COMEBACK_WRONG = 2; // a wrong answer comes back after this many other questions
const COMEBACK_RIGHT = 4; // a right answer (not yet mastered) comes back after this many
const STUCK_AFTER = 3; // wrong answers in a row = the teacher sees "stuck"
const CLOSE_MS = 4000; // when everybody is done the game closes by itself

class StudyGame extends QuizGame {
  static id = 'study';
  static order = 2;
  static title = 'תרגול ולמידה';
  static emoji = '📚';
  static mode = 'ffa';
  static classic = false; // only questions with a right answer
  static noReward = true;
  static untimed = true; // ends when everybody is done (or the teacher ends it)
  static blurb = 'כל תלמיד לומד בטלפון שלו, בקצב שלו: תרגול עד שליטה (שאלה חוזרת עד שעונים נכון פעמיים), כרטיסיות לשינון, או מבחן עם סיכום אישי בסוף. המורה רואה את ההתקדמות של כולם ומי תקוע. בלי ניקוד ובלי תחרות.';
  static tickMs = 1000;
  static defaults = { duration: 600, kind: 'mastery', order: 'shuffle' };
  static options = [
    { key: 'kind', label: 'מצב למידה', choices: [['mastery', 'תרגול עד שליטה'], ['flashcards', 'כרטיסיות'], ['test', 'מבחן עם סיכום']] },
    { key: 'order', label: 'סדר השאלות', choices: [['shuffle', 'מעורבב'], ['original', 'לפי החידון']] },
  ];

  get kind() {
    return ['mastery', 'flashcards', 'test'].includes(this.room.settings.kind) ? this.room.settings.kind : 'mastery';
  }

  start() {
    this.closing = null;
    for (const p of this.players()) this.begin(p);
  }

  // a player joining in the middle starts from the beginning
  lateInit(p) {
    this.begin(p);
    return true;
  }

  begin(p) {
    const n = this.room.quizData.questions.length;
    const idx = Array.from({ length: n }, (_, i) => i);
    p.g = {
      kind: this.kind,
      queue: this.room.settings.order === 'original' ? idx : shuffle(idx),
      total: n,
      cur: null,
      phase: 'card',
      qid: 0,
      done: 0, // questions mastered / known / answered (test)
      correct: 0,
      wrong: 0,
      again: 0,
      row: 0, // wrong answers in a row (the teacher sees "stuck")
      right: new Map(), // mastery: question -> right answers so far
      review: [], // test: what was answered
      last: null,
      score: 0,
    };
    this.next(p);
  }

  score(p) {
    return p.g ? p.g.done : 0;
  }

  // the next question / card for this player, or the end
  next(p) {
    const g = p.g;
    if (!g.queue.length) {
      g.cur = null;
      g.phase = 'done';
      g.qid++;
      this.checkAllDone();
      return;
    }
    const qi = g.queue.shift();
    const q = this.room.quizData.questions[qi];
    g.qid++;
    g.last = null;
    if (g.kind === 'flashcards') {
      g.phase = 'card';
      g.cur = { qi, q, card: this.card(q) };
    } else {
      const { payload, state } = qt.present(q, this.room.quizData.mediaBase);
      g.phase = 'question';
      g.cur = { qi, q, state, payload };
    }
  }

  // both sides of a flashcard (it is study material, so the back can travel with the front)
  card(q) {
    const mediaBase = this.room.quizData.mediaBase;
    const { payload } = qt.present(q, mediaBase);
    return { text: q.text, image: payload.image || '', back: qt.correctText(q), explain: q.explain || '', afterImage: qt.afterImage(q, mediaBase) };
  }

  // put a question back into the player's queue after `gap` others
  requeue(g, qi, gap) {
    g.queue.splice(Math.min(gap, g.queue.length), 0, qi);
  }

  handle(p, type, data) {
    if (this.over || !p.g) return;
    const g = p.g;
    data = data || {};
    if (data.qid !== undefined && data.qid !== g.qid) return; // a stale tap from an earlier card
    const { cur } = g;

    if (g.kind === 'flashcards') {
      if (type !== 'card' || g.phase !== 'card' || !cur) return;
      if (data.known === true) {
        g.done++;
        g.row = 0;
      } else {
        g.again++;
        g.row++;
        this.requeue(g, cur.qi, COMEBACK_WRONG + 1);
      }
      this.next(p);
      return this.push(p);
    }

    if (type === 'next' && g.phase === 'feedback') {
      this.next(p);
      return this.push(p);
    }
    if (type !== 'answer' || g.phase !== 'question' || !cur) return;
    const res = qt.check(cur.q, cur.state, data);
    if (!res.valid) return;
    const ok = !!res.ok;
    g.answered = (g.answered || 0) + 1;
    if (ok) {
      g.correct++;
      g.row = 0;
    } else {
      g.wrong++;
      g.row++;
    }
    this.room.logAnswer(p, { q: cur.q.text, type: cur.q.type, chosen: res.chosen, answer: qt.correctText(cur.q), ok, ms: 0 });

    if (g.kind === 'test') {
      g.review.push({ q: cur.q.text, ok, chosen: res.chosen, answer: qt.correctText(cur.q), explain: cur.q.explain || '', afterImage: qt.afterImage(cur.q, this.room.quizData.mediaBase) });
      g.done++;
      this.next(p); // no feedback until the end
      return this.push(p);
    }

    // mastery: a question counts as known after NEED_RIGHT right answers; a wrong one resets and comes back soon
    const had = g.right.get(cur.qi) || 0;
    if (ok) {
      g.right.set(cur.qi, had + 1);
      if (had + 1 >= NEED_RIGHT) g.done++;
      else this.requeue(g, cur.qi, COMEBACK_RIGHT);
    } else {
      g.right.set(cur.qi, 0);
      this.requeue(g, cur.qi, COMEBACK_WRONG);
    }
    g.phase = 'feedback';
    g.last = { ok, correctText: qt.correctText(cur.q), explain: cur.q.explain || '', afterImage: qt.afterImage(cur.q, this.room.quizData.mediaBase), mastered: ok && had + 1 >= NEED_RIGHT, needed: ok ? Math.max(0, NEED_RIGHT - (had + 1)) : NEED_RIGHT };
    this.push(p);
  }

  push(p) {
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
  }

  // everybody finished: close the game by itself after a moment
  checkAllDone() {
    const ps = this.players().filter((p) => p.g && p.connected);
    if (!ps.length || ps.some((p) => p.g.phase !== 'done') || this.closing) return;
    this.closing = this.later(() => this.room.end(), CLOSE_MS);
  }

  // ---------- state ----------
  progress(p) {
    const g = p.g;
    return g.total ? Math.round((g.done / g.total) * 100) : 0;
  }

  publicState() {
    const list = this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, pct: this.progress(p), done: p.g.done, correct: p.g.correct, wrong: p.g.wrong, again: p.g.again, finished: p.g.phase === 'done', stuck: p.g.row >= STUCK_AFTER && p.g.phase !== 'done', connected: p.connected }))
      .sort((a, b) => Number(a.finished) - Number(b.finished) || b.stuck - a.stuck || a.pct - b.pct || a.name.localeCompare(b.name, 'he'));
    const n = list.length || 1;
    return {
      kind: 'study',
      mode: this.kind,
      total: this.room.quizData.questions.length,
      players: list,
      avg: Math.round(list.reduce((s, x) => s + x.pct, 0) / n),
      finished: list.filter((x) => x.finished).length,
      stuck: list.filter((x) => x.stuck).length,
      feed: this.feed,
    };
  }

  personal(p) {
    const g = p.g;
    const base = { mode: g.kind, phase: 'st_' + g.phase, qid: g.qid, done: g.done, total: g.total, pct: this.progress(p), correct: g.correct, wrong: g.wrong, again: g.again };
    if (g.phase === 'card') return { ...base, card: g.cur.card };
    if (g.phase === 'question') return { ...base, question: g.cur.payload };
    if (g.phase === 'feedback') return { ...base, last: g.last, text: g.cur.q.text };
    if (g.phase === 'done') return { ...base, review: g.kind === 'test' ? g.review : undefined };
    return base;
  }

  results() {
    const players = this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, pct: this.progress(p), done: p.g.done, correct: p.g.correct, wrong: p.g.wrong, again: p.g.again, finished: p.g.phase === 'done' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'he'));
    return { kind: 'study', mode: this.kind, total: this.room.quizData.questions.length, players };
  }
}

module.exports = StudyGame;
