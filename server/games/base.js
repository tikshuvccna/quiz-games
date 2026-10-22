// Shared question loop for all games. A game plugin extends this and decides
// what a correct answer is worth (onAnswer) and what happens next (afterFeedback / action).
const { shuffle } = require('../shuffle');
const qt = require('../qtypes');

const FEEDBACK_MS = 1000;

class QuizGame {
  constructor(room) {
    this.room = room;
    this.over = false;
    this.feed = [];
    this.fid = 1;
    this.timers = new Set();
  }

  players() {
    return [...this.room.players.values()];
  }

  initPlayer(p, extra = {}) {
    p.g = { order: [], ptr: 0, qid: 0, phase: 'question', current: null, last: null, correct: 0, wrong: 0, streak: 0, bestStreak: 0, charge: 0, turns: 0, turn: 0, askedAt: 0, ...extra };
    this.nextQuestion(p);
  }

  // setTimeout that never fires after the game is over (and is cleared on stop)
  later(fn, ms) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      if (this.over) return;
      try {
        fn();
      } catch (e) {
        console.error('[game timer]', e);
      }
    }, ms);
    this.timers.add(t);
    return t;
  }

  stop() {
    this.over = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  addFeed(text, team = -1) {
    this.feed.push({ id: this.fid++, text, team });
    if (this.feed.length > 6) this.feed.shift();
  }

  nextQuestion(p) {
    const g = p.g;
    const QS = this.room.quizData.questions;
    if (g.ptr >= g.order.length) {
      const prev = g.order[g.order.length - 1];
      g.order = shuffle(QS.map((_, i) => i));
      // don't ask the same question twice in a row across a reshuffle
      if (g.order.length > 1 && g.order[0] === prev) g.order.push(g.order.shift());
      g.ptr = 0;
    }
    const q = QS[g.order[g.ptr++]];
    const { payload, state } = qt.present(q, this.room.quizData.mediaBase);
    g.current = { q, state, payload };
    g.phase = 'question';
    g.qid++;
    g.last = null;
    g.askedAt = Date.now();
  }

  handle(p, type, data) {
    if (this.over || !p.g) return;
    const g = p.g;
    if (type !== 'answer') return this.action(p, type, data || {});
    if (g.phase !== 'question') return;
    // a stale click from a previous question is ignored
    if (data && data.qid !== undefined && data.qid !== g.qid) return;
    const { q, state } = g.current;
    const res = qt.check(q, state, data);
    if (!res.valid) return;
    const correct = res.ok;
    if (correct) {
      g.correct++;
      g.streak++;
      g.bestStreak = Math.max(g.bestStreak, g.streak);
    } else {
      g.wrong++;
      g.streak = 0;
    }
    // every `need` correct answers earn a reward (the game's action phase); wrong answers keep the progress
    // the question's points multiplier (0-4) is how much it charges: 0 = practice, 2 = double…
    let rewarded = false;
    if (correct && q.points > 0) {
      g.charge += q.points;
      if (g.charge >= this.need) {
        g.charge = 0;
        rewarded = true;
      }
    }
    const correctText = qt.correctText(q);
    this.room.logAnswer(p, { q: q.text, type: q.type, chosen: res.chosen, answer: correctText, ok: correct, ms: Date.now() - g.askedAt });
    const extra = this.onAnswer(p, correct, rewarded) || {};
    if (correct && !rewarded && q.points > 0) {
      const left = this.need - g.charge;
      const r = this.constructor.reward || ['תור', 'תורות'];
      extra.note = `${extra.note ? extra.note + ' · ' : ''}עוד ${left} ${left > 1 ? 'תשובות נכונות' : 'תשובה נכונה'} ל${r[0]}`;
    }
    g.last = { correct, rewarded, correctText, streak: g.streak, explain: q.explain || '', ...extra };
    g.phase = 'feedback';
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    const qid = g.qid;
    this.later(() => {
      if (g.phase !== 'feedback' || g.qid !== qid) return;
      if (g.last.correct && g.last.rewarded) {
        // stacking games turn `amount` into more of their resource; the others repeat the action
        g.turns = this.constructor.stacks ? 1 : this.amount;
        g.turn++;
        this.afterFeedback(p);
      } else this.nextQuestion(p);
      this.room.pushPlayer(p);
    }, FEEDBACK_MS);
  }

  // reward settings chosen by the host
  get need() {
    return this.constructor.noReward ? 1 : Math.max(1, Number(this.room.settings.need) || 1);
  }

  get amount() {
    return this.constructor.noReward ? 1 : Math.max(1, Number(this.room.settings.amount) || 1);
  }

  // the end of one action turn: play another if the reward gave several, else back to questions
  turnDone(p) {
    const g = p.g;
    if (--g.turns > 0 && !this.over) {
      g.turn++;
      this.afterFeedback(p);
    } else this.nextQuestion(p);
  }

  // a player's score for stats, rankings and team totals (games override)
  score(p) {
    return p.g ? p.g.correct : 0;
  }

  // ---- hooks ----
  onAnswer() {}
  afterFeedback(p) {
    this.nextQuestion(p);
  }
  action() {}

  baseView(p) {
    const g = p.g;
    const out = { phase: g.phase, qid: g.qid, turn: g.turn, turnsLeft: g.turns, charge: g.charge, need: this.need, last: g.last, streak: g.streak, stats: { correct: g.correct, wrong: g.wrong } };
    if (g.phase === 'question') out.question = g.current.payload;
    return out;
  }

  rank(list) {
    return list;
  }
}

module.exports = QuizGame;
