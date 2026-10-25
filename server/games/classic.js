// "חידון קלאסי" - the classic Kahoot quiz: everyone answers the same question from the big screen,
// faster correct answers score more, answer streaks add a bonus, and a leaderboard with fun lines
// shows between questions. Teams = average of the members. Optional second-chance round for the
// bottom 5 at the end (double points).
const QuizGame = require('./base');
const qt = require('../qtypes');
const { shuffle } = require('../shuffle');

const READY_MS = 3500; // question text alone before the answers open
const MULT_MS = 2200; // the ×2 / ×3 / ×4 splash before it
const AUTO_REVEAL_MS = 5500;
const AUTO_BOARD_MS = 6500;
const BONUS_PLAYERS = 5;
const BONUS_QUESTIONS = 2;

class ClassicGame extends QuizGame {
  static id = 'classic';
  static order = 1;
  static title = 'חידון קלאסי';
  static emoji = '🎯';
  static mode = 'ffa';
  static classic = true; // uses every question type, incl. polls and slides
  static noReward = true;
  static untimed = true; // ends when the questions run out, not on a clock
  static teamAvg = true; // team score = average of its members (like Kahoot)
  static blurb = 'החידון הקלאסי: כולם עונים על אותה שאלה מהמסך הגדול. תשובה נכונה ומהירה = יותר נקודות, רצפים נותנים בונוס, ובין השאלות יש לוח מובילים. אפשר גם בקבוצות.';
  static tickMs = 500;
  static defaults = { duration: 600, count: 0, order: 'original', advance: 'manual', bonus: 'off', style: 'speed', timer: 'question' };
  static options = [
    { key: 'style', label: 'סגנון ניקוד', choices: [['speed', 'קלאסי: מהירות + דיוק'], ['accuracy', 'דיוק בלבד (נקודה לכל נכונה)'], ['confidence', 'ביטחון: בוסט או בטוח']] },
    { key: 'timer', label: 'זמן לשאלה', choices: [['question', 'לפי השאלה'], ['unlimited', 'ללא הגבלה']] },
    { key: 'count', label: 'מספר שאלות', choices: [[0, 'כל השאלות'], [5, '5'], [10, '10'], [15, '15'], [20, '20']] },
    { key: 'order', label: 'סדר השאלות', choices: [['original', 'לפי החידון'], ['shuffle', 'מעורבב']] },
    { key: 'advance', label: 'מעבר בין שלבים', choices: [['manual', 'ידני (לחיצה)'], ['auto', 'אוטומטי']] },
    { key: 'bonus', label: 'הזדמנות שנייה ל־5 האחרונים', choices: [['off', 'לא'], ['on', 'כן']] },
  ];

  start() {
    const S = this.room.settings;
    let qs = this.room.quizData.questions.slice();
    if (S.order === 'shuffle') qs = shuffle(qs);
    const count = Number(S.count) || 0;
    const main = count ? qs.slice(0, count) : qs;
    // second chance: extra scored questions not used in the main round (or any scored ones)
    const scored = (q) => qt.SCORED.has(q.type);
    let extra = qs.slice(main.length).filter(scored);
    if (extra.length < BONUS_QUESTIONS) extra = extra.concat(shuffle(main.filter(scored)));
    this.main = main;
    this.bonusQs = S.bonus === 'on' && this.room.players.size > BONUS_PLAYERS ? extra.slice(0, BONUS_QUESTIONS) : [];
    this.list = main;
    this.inBonus = false;
    this.i = -1;
    this.stage = 'ready';
    this.cur = null;
    this.lines = [];
    this.timer = null;
    this.eligible = null; // Set of player ids (bonus round), null = everyone
    for (const p of this.players()) p.g = this.freshG();
    this.next();
  }

  freshG() {
    return { score: 0, streak: 0, bestStreak: 0, correct: 0, wrong: 0, rank: 0, prevRank: 0, res: null, fastest: null, conf: 1, boosts: 0 };
  }

  // joins in the middle: answers from the next question on
  lateInit(p) {
    p.g = this.freshG();
    p.g.rank = this.players().filter((o) => o.g).length;
    return true;
  }

  score(p) {
    return p.g ? p.g.score : 0;
  }

  get manual() {
    return this.room.settings.advance !== 'auto';
  }

  isLast() {
    return this.i >= this.list.length - 1 && (this.inBonus || !this.bonusQs.length);
  }

  // ---------- flow ----------
  schedule(fn, ms) {
    clearTimeout(this.timer);
    this.timer = this.later(fn, ms);
  }

  next() {
    clearTimeout(this.timer);
    if (this.i >= this.list.length - 1) {
      if (!this.inBonus && this.bonusQs.length) return this.startBonus();
      return this.room.end();
    }
    this.i++;
    const q = this.list[this.i];
    const { payload, state } = qt.present(q, this.room.quizData.mediaBase);
    this.cur = { q, payload, state, startAt: 0, deadline: 0, answers: new Map(), reveal: null };
    for (const p of this.players()) if (p.g) p.g.res = null;
    this.stage = 'ready';
    this.lines = [];
    this.pushEveryone();
    // a ×2 / ×3 / ×4 question gets an extra moment for its splash before the question text
    this.schedule(() => this.open(), READY_MS + (q.points >= 2 ? MULT_MS : 0));
  }

  startBonus() {
    this.inBonus = true;
    this.rank();
    const order = this.players().filter((p) => p.g).sort((a, b) => a.g.score - b.g.score);
    this.eligible = new Set(order.slice(0, BONUS_PLAYERS).map((p) => p.id));
    this.list = this.bonusQs;
    this.i = -1;
    this.addFeed('⭐ הזדמנות שנייה! 5 השחקנים האחרונים עונים על שאלות בניקוד כפול');
    this.next();
  }

  open() {
    const q = this.cur.q;
    if (q.type === 'slide') {
      this.stage = 'slide';
      this.pushEveryone();
      if (!this.manual) this.schedule(() => this.next(), q.time * 1000);
      return;
    }
    this.stage = 'question';
    this.cur.startAt = Date.now();
    const T = this.questionTime(q);
    this.cur.deadline = T ? this.cur.startAt + T * 1000 : 0;
    this.pushEveryone();
    if (T) this.schedule(() => this.reveal(), T * 1000 + 300);
    else clearTimeout(this.timer); // unlimited: reveal when everyone answered or the host moves on
  }

  // ---------- hooks (other quiz-style games override these) ----------
  get style() {
    return this.room.settings.style || 'speed';
  }

  // seconds to answer, or 0 for unlimited
  questionTime(q) {
    return this.room.settings.timer === 'unlimited' ? 0 : q.time;
  }

  // extra choice after the answer (confidence), or null
  confOptions() {
    if (this.style !== 'confidence') return null;
    return [{ v: 0, label: 'בטוח', emoji: '🛡️', desc: 'ניקוד רגיל, בלי סיכון' }, { v: 1, label: 'בוסט!', emoji: '🚀', desc: 'נכון = בונוס · טעות = מפסידים נקודות' }];
  }

  // is this answer counted as right? (accuracy also accepts partly-right answers)
  judge(q, a) {
    if (!a) return false;
    if (a.res.ok) return true;
    if (this.style !== 'accuracy') return false;
    if (q.type === 'quiz' && Array.isArray(a.data.choices)) {
      const picks = a.data.choices.map((c) => this.cur.state.order[c]);
      return picks.length > 0 && picks.every((i) => q.answers[i] && q.answers[i].correct);
    }
    if (q.type === 'slider') return Math.abs(Number(a.data.value) - q.slider.answer) <= q.slider.tol + (q.slider.max - q.slider.min) * 0.1;
    if (q.type === 'puzzle') return a.res.ratio >= 0.75;
    return false;
  }

  // points for one player's answer (can be negative)
  scoreFor(p, q, a, ok) {
    if (this.style === 'accuracy') return ok && q.points > 0 ? 1 : 0;
    let pts = ok ? this.points(q, a.ms, p.g.streak) : 0;
    // a jigsaw that is mostly right still earns part of the points (no streak)
    if (!ok && a && q.type === 'puzzle' && a.res.ratio >= 0.5) pts = Math.round(this.points(q, a.ms, 0) * a.res.ratio * 0.5);
    if (this.style === 'confidence' && a && a.data.conf === 1) {
      p.g.boosts++;
      if (ok) {
        pts += 200 * p.g.conf;
        p.g.conf = Math.min(3, p.g.conf + 1);
      } else {
        pts = -200 * p.g.conf;
        p.g.conf = 1;
      }
    }
    return pts;
  }

  afterReveal() {}

  canAnswer(p) {
    return !!p.g && (!this.eligible || this.eligible.has(p.id));
  }

  handle(p, type, data) {
    if (this.over || !p.g || type !== 'answer' || this.stage !== 'question' || !this.canAnswer(p)) return;
    const cur = this.cur;
    if (cur.answers.has(p.id)) return;
    if (data.qid !== undefined && data.qid !== this.qid()) return;
    const q = cur.q;
    const T = this.questionTime(q);
    const ms = T ? Math.min(Date.now() - cur.startAt, T * 1000) : Date.now() - cur.startAt;
    const conf = this.confOptions(p);
    if (conf && !conf.some((o) => o.v === data.conf)) return;
    let res;
    if (q.type === 'poll') {
      if (!Number.isInteger(data.choice) || data.choice < 0 || data.choice >= cur.state.order.length) return;
      res = { valid: true, ok: null, chosen: q.answers[cur.state.order[data.choice]].text };
    } else {
      res = qt.check(q, cur.state, data);
      if (!res.valid) return;
    }
    cur.answers.set(p.id, { data, res, ms });
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    // everyone who can answer has answered: reveal now
    const waiting = this.players().filter((o) => this.canAnswer(o) && o.connected && !cur.answers.has(o.id));
    if (!waiting.length) this.schedule(() => this.reveal(), 600);
  }

  // Kahoot: up to 1000 × multiplier, losing up to half for slower answers; streaks add up to +500
  points(q, ms, streak) {
    const mult = (this.inBonus ? 2 : 1) * q.points;
    if (!mult) return 0;
    const T = (this.questionTime(q) || 30) * 1000; // unlimited time: speed counts over the first 30 seconds
    const base = Math.round((1 - Math.min(ms, T) / T / 2) * 1000 * mult);
    return base + Math.min(500, Math.max(0, streak - 1) * 100);
  }

  reveal() {
    if (this.stage !== 'question') return;
    clearTimeout(this.timer);
    const cur = this.cur;
    const q = cur.q;
    const scored = qt.SCORED.has(q.type);
    this.rankSnapshot();
    let right = 0;
    let fastest = null;
    for (const p of this.players()) {
      if (!this.canAnswer(p)) continue;
      const g = p.g;
      const a = cur.answers.get(p.id);
      const ok = this.judge(q, a);
      let pts = 0;
      if (scored) {
        if (ok) {
          g.streak++;
          g.bestStreak = Math.max(g.bestStreak, g.streak);
          g.correct++;
          right++;
          if (!fastest || a.ms < fastest.ms) fastest = { name: p.name, ms: a.ms };
        } else {
          g.streak = 0;
          g.wrong++;
        }
        pts = this.scoreFor(p, q, a, ok);
        g.score = Math.max(0, g.score + pts);
        this.room.logAnswer(p, { q: q.text, type: q.type, chosen: a ? a.res.chosen : '(לא ענה/תה)', answer: qt.correctText(q), ok, ms: a ? a.ms : (this.questionTime(q) || 0) * 1000 });
      }
      g.res = { answered: !!a, ok: scored ? ok : null, pts, streak: g.streak, conf: a ? a.data.conf : undefined };
    }
    this.rank();
    // what the class answered
    const rv = { correctText: qt.correctText(q), answered: cur.answers.size, right, explain: q.explain || '', afterImage: qt.afterImage(q, this.room.quizData.mediaBase) };
    if (q.type === 'quiz' || q.type === 'tf' || q.type === 'poll') {
      rv.dist = cur.state.order.map(() => 0);
      for (const a of cur.answers.values()) {
        const picks = Array.isArray(a.data.choices) ? a.data.choices : [a.data.choice];
        for (const c of picks) if (rv.dist[c] !== undefined) rv.dist[c]++;
      }
      rv.correct = q.type === 'poll' ? [] : cur.state.order.map((orig, d) => (q.answers[orig].correct ? d : -1)).filter((d) => d >= 0);
    } else if (q.type === 'slider') {
      const vals = [...cur.answers.values()].map((a) => Number(a.data.value)).filter(Number.isFinite);
      rv.avg = vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;
      rv.values = vals.slice(0, 200);
      rv.answer = q.slider.answer;
      rv.tol = q.slider.tol;
    } else if (q.type === 'type') {
      const counts = new Map();
      for (const a of cur.answers.values()) {
        const t = String(a.data.text || '').trim();
        const k = qt.norm(t);
        const e = counts.get(k) || { text: t, n: 0, ok: a.res.ok };
        e.n++;
        counts.set(k, e);
      }
      rv.top = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 6);
    } else if (q.type === 'pin') {
      rv.pins = [...cur.answers.values()].map((a) => [Math.round(a.data.x * 10) / 10, Math.round(a.data.y * 10) / 10, a.res.ok]).slice(0, 200);
      rv.target = q.pin;
    } else if (q.type === 'order') {
      rv.items = q.items;
    } else if (q.type === 'puzzle') {
      const ratios = [...cur.answers.values()].map((a) => a.res.ratio || 0);
      rv.avgPct = ratios.length ? Math.round((ratios.reduce((s, v) => s + v, 0) / ratios.length) * 100) : 0;
    }
    if (this.style === 'confidence') {
      const boosted = [...cur.answers.values()].filter((a) => a.data.conf === 1).length;
      rv.boostPct = cur.answers.size ? Math.round((boosted / cur.answers.size) * 100) : 0;
    }
    cur.reveal = rv;
    this.afterReveal(rv);
    this.lines = this.funLines(fastest, right);
    this.stage = 'reveal';
    this.pushEveryone();
    if (!this.manual) this.schedule(() => this.board(), AUTO_REVEAL_MS);
  }

  board() {
    if (this.stage !== 'reveal') return;
    // no leaderboard after the very last question: straight to the podium
    if (this.isLast()) return this.room.end();
    this.stage = 'board';
    this.pushEveryone();
    if (!this.manual) this.schedule(() => this.next(), AUTO_BOARD_MS);
  }

  // host "next" button: moves to the next stage right away
  hostCommand(cmd) {
    if (this.over || cmd !== 'next') return;
    if (this.stage === 'ready') this.open();
    else if (this.stage === 'question') this.reveal();
    else if (this.stage === 'reveal') this.board();
    else this.next(); // board, slide
  }

  rankSnapshot() {
    for (const p of this.players()) if (p.g) p.g.prevRank = p.g.rank;
  }

  rank() {
    const list = this.players().filter((p) => p.g).sort((a, b) => b.g.score - a.g.score);
    list.forEach((p, i) => (p.g.rank = i + 1));
    return list;
  }

  funLines(fastest, right) {
    const list = this.rank();
    const out = [];
    const take = this.eligible ? list.filter((p) => this.eligible.has(p.id)) : list;
    const asked = take.length || 1;
    if (this.cur.q.type !== 'poll' && this.cur.q.type !== 'slide') {
      const pct = Math.round((right / asked) * 100);
      if (pct >= 80) out.push(`👏 ${pct}% ענו נכון! איזו כיתה חכמה`);
      else if (pct <= 30) out.push(`🤔 שאלה קשה! רק ${pct}% צדקו`);
    }
    const climb = list.filter((p) => p.g.prevRank && p.g.prevRank - p.g.rank >= 2).sort((a, b) => b.g.prevRank - b.g.rank - (a.g.prevRank - a.g.rank))[0];
    if (climb) out.push(`🚀 ${climb.name} קפץ/ה ${climb.g.prevRank - climb.g.rank} מקומות!`);
    const hot = list.filter((p) => p.g.streak >= 3).sort((a, b) => b.g.streak - a.g.streak)[0];
    if (hot) out.push(`🔥 ${hot.name} ברצף של ${hot.g.streak} תשובות נכונות!`);
    if (list[1] && list[0].g.score - list[1].g.score < 300 && list[0].g.score > 0) out.push(`😱 רק ${list[0].g.score - list[1].g.score} נקודות בין ${list[0].name} ל־${list[1].name}!`);
    if (fastest) out.push(`⚡ ${fastest.name} הכי מהיר/ה: ${(fastest.ms / 1000).toFixed(1)} שניות`);
    if (list[0] && list[0].g.score > 0 && out.length < 2) out.push(`🥇 ${list[0].name} מוביל/ה עם ${list[0].g.score} נקודות`);
    if (this.i === this.list.length - 2 && !this.inBonus) out.push(this.bonusQs.length ? '⭐ עוד שאלה אחת, ואחריה הזדמנות שנייה!' : '⭐ השאלה הבאה היא האחרונה! הכל עוד פתוח');
    return out.slice(0, 3);
  }

  // ---------- state ----------
  qid() {
    return `${this.inBonus ? 'b' : 'm'}${this.i}`;
  }

  pushEveryone() {
    this.room.pushAll();
  }

  board5() {
    return this.rank()
      .slice(0, 5)
      .map((p) => ({ name: p.name, score: p.g.score, rank: p.g.rank, prev: p.g.prevRank, team: p.team, streak: p.g.streak }));
  }

  publicState() {
    const cur = this.cur;
    const out = {
      kind: 'classic',
      stage: this.stage,
      index: this.i,
      total: this.list.length,
      bonus: this.inBonus,
      manual: this.manual,
      style: this.style,
      last: this.isLast(),
      feed: this.feed,
      players: this.players().filter((p) => this.canAnswer(p)).length,
    };
    if (!cur) return out;
    out.q = cur.payload;
    out.answered = cur.answers.size;
    if (this.stage === 'question') {
      out.remain = cur.deadline ? Math.max(0, cur.deadline - Date.now()) : null;
      out.time = this.questionTime(cur.q);
    }
    if (this.stage === 'reveal' || this.stage === 'board') {
      out.reveal = cur.reveal;
      out.lines = this.lines;
      out.board = this.board5();
      const T = this.room.teams();
      if (T.length >= 2) out.teams = this.room.teamScores();
    }
    return out;
  }

  personal(p) {
    const g = p.g;
    const cur = this.cur;
    const base = { score: g.score, rank: g.rank, streak: g.streak, qid: this.qid(), qnum: this.i + 1, total: this.list.length, bonus: this.inBonus, stage: this.stage };
    const can = this.canAnswer(p);
    if (!cur) return { ...base, phase: 'c_ready' };
    if (this.stage === 'ready') return { ...base, phase: can ? 'c_ready' : 'c_watch', text: cur.q.text, points: cur.q.points };
    if (this.stage === 'slide') return { ...base, phase: 'c_slide', q: cur.payload };
    if (this.stage === 'question') {
      if (!can) return { ...base, phase: 'c_watch' };
      if (cur.answers.has(p.id)) return { ...base, phase: 'c_locked' };
      return { ...base, phase: 'c_question', question: cur.payload, remain: cur.deadline ? Math.max(0, cur.deadline - Date.now()) : null, conf: this.confOptions(p) };
    }
    // reveal / board: my own result + who is right above me
    const list = this.rank();
    const above = g.rank > 1 ? list[g.rank - 2] : null;
    return { ...base, phase: can ? 'c_result' : 'c_watch_res', res: g.res, correctText: cur.reveal ? cur.reveal.correctText : '', explain: cur.reveal ? cur.reveal.explain : '', afterImage: cur.reveal ? cur.reveal.afterImage : '', above: above ? { name: above.name, gap: above.g.score - g.score } : null };
  }

  results() {
    const players = this.rank().map((p) => ({ name: p.name, team: p.team, score: p.g.score, correct: p.g.correct, wrong: p.g.wrong, best: p.g.bestStreak }));
    return { kind: 'classic', players, total: this.main.length };
  }
}

module.exports = ClassicGame;
