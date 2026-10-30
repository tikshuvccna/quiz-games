// "חידון קלאסי" - the classic Kahoot quiz: everyone answers the same question from the big screen,
// faster correct answers score more, answer streaks add a bonus, and a leaderboard with fun lines
// shows between questions. Teams = average of the members. Optional second-chance round for the
// bottom 5 at the end (double points).
const QuizGame = require('./base');
const qt = require('../qtypes');
const { shuffle } = require('../shuffle');
const Filter = require('../filter');

const READY_MS = 3500; // question text alone before the answers open
const MULT_MS = 2200; // the ×2 / ×3 / ×4 splash before it
const AUTO_REVEAL_MS = 5500;
const AUTO_BOARD_MS = 6500;
const VOTE_MS = 30000; // brainstorm: time to vote for the ideas
const VOTES_EACH = 3;
const BONUS_PLAYERS = 5;
const BONUS_QUESTIONS = 2;

class ClassicGame extends QuizGame {
  static id = 'classic';
  static order = 1;
  static title = 'חידון קלאסי';
  static emoji = '🎯';
  static mode = 'ffa';
  static classic = true; // uses every question type, incl. polls, word clouds, free text, brainstorms, drop-pins and slides
  static noReward = true;
  static untimed = true; // ends when the questions run out, not on a clock
  static teamAvg = true; // team score = average of its members (like Kahoot)
  static blurb = 'החידון הקלאסי: כולם עונים על אותה שאלה מהמסך הגדול. תשובה נכונה ומהירה = יותר נקודות, רצפים נותנים בונוס, ובין השאלות יש לוח מובילים. אפשר גם בקבוצות.';
  static tickMs = 500;
  static defaults = { duration: 600, count: 0, order: 'original', advance: 'manual', bonus: 'off', style: 'speed', timer: 'question', surprise: 'off', final: 'normal', lives: 'off' };
  static options = [
    { key: 'style', label: 'סגנון ניקוד', choices: [['speed', 'קלאסי: מהירות + דיוק'], ['accuracy', 'דיוק בלבד (נקודה לכל נכונה)'], ['confidence', 'ביטחון: בוסט או בטוח'], ['learn', 'למידה: בלי ניקוד ובלי לוח מובילים']] },
    { key: 'timer', label: 'זמן לשאלה', choices: [['question', 'לפי השאלה'], ['unlimited', 'ללא הגבלה']] },
    { key: 'count', label: 'מספר שאלות', choices: [[0, 'כל השאלות'], [5, '5'], [10, '10'], [15, '15'], [20, '20']] },
    { key: 'order', label: 'סדר השאלות', choices: [['original', 'לפי החידון'], ['shuffle', 'מעורבב']] },
    { key: 'advance', label: 'מעבר בין שלבים', choices: [['manual', 'ידני (לחיצה)'], ['auto', 'אוטומטי']] },
    { key: 'bonus', label: 'הזדמנות שנייה ל־5 האחרונים', choices: [['off', 'לא'], ['on', 'כן']] },
    { key: 'final', label: 'השאלה האחרונה', choices: [['normal', 'רגילה'], ['double', 'שווה כפול']] },
    { key: 'lives', label: 'הישרדות', choices: [['off', 'ללא'], [3, '3 חיים'], [1, 'חיים אחד: טעות אחת וזהו']] },
    { key: 'surprise', label: '🎁 הפתעות בלוח המובילים', choices: [['off', 'ללא'], ['sometimes', 'לפעמים'], ['often', 'הרבה']] },
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
    // the learning style has no points, so no second-chance round either
    this.bonusQs = S.bonus === 'on' && S.style !== 'learn' && this.room.players.size > BONUS_PLAYERS ? extra.slice(0, BONUS_QUESTIONS) : [];
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
    return { score: 0, streak: 0, bestStreak: 0, correct: 0, wrong: 0, rank: 0, prevRank: 0, res: null, fastest: null, conf: 1, boosts: 0, lives: this.livesStart() };
  }

  // survival: wrong answers cost lives, and a player with none left only watches (classic quiz only)
  livesStart() {
    const n = Number(this.room.settings.lives);
    return this.constructor.id === 'classic' && n > 0 ? n : 0;
  }

  get livesOn() {
    return this.livesStart() > 0;
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
    // a "double points" surprise from the last leaderboard: this question counts twice (shown as a bigger multiplier)
    const finalQ = this.constructor.id === 'classic' && this.room.settings.final === 'double' && !this.inBonus && this.i === this.list.length - 1;
    if (finalQ && q.points > 0 && qt.SCORED.has(q.type)) this.addFeed('🎁 השאלה האחרונה שווה כפול!');
    if ((this.dbl || finalQ) && q.points > 0 && qt.SCORED.has(q.type)) {
      this.cur.dbl = true;
      payload.points = Math.min(4, q.points * 2);
    }
    this.dbl = false;
    this.sur = null;
    for (const p of this.players()) if (p.g) p.g.res = null;
    this.lines = [];
    if (this.skipReady(q)) return this.open();
    this.stage = 'ready';
    this.pushEveryone();
    // a ×2 / ×3 / ×4 question gets an extra moment for its splash before the question text
    this.schedule(() => this.open(), this.readyDelay(q));
  }

  // how long the question text is shown alone before the answers open (a ×2 / ×3 / ×4 question gets its splash first)
  readyDelay(q) {
    return READY_MS + (q.points >= 2 || (this.cur && this.cur.dbl) ? MULT_MS : 0);
  }

  // true = the step opens at once, without the "get ready" moment (a lesson's slides)
  skipReady() {
    return false;
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
    if (q.type === 'slide' || q.type === 'pdf') {
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
    if (q.type === 'puzzle' || q.type === 'match' || q.type === 'sort') return a.res.ratio >= 0.75;
    return false;
  }

  // points for one player's answer (can be negative)
  scoreFor(p, q, a, ok) {
    if (this.style === 'learn') return 0; // learning: the class sees right and wrong, nobody earns points
    if (this.style === 'accuracy') return ok && q.points > 0 ? 1 : 0;
    let pts = ok ? this.points(q, a.ms, p.g.streak) : 0;
    // a jigsaw that is mostly right still earns part of the points (no streak)
    if (!ok && a && (q.type === 'puzzle' || q.type === 'match' || q.type === 'sort') && a.res.ratio >= 0.5) pts = Math.round(this.points(q, a.ms, 0) * a.res.ratio * 0.5);
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
    return !!p.g && (!this.eligible || this.eligible.has(p.id)) && !(this.livesOn && p.g.lives <= 0);
  }

  handle(p, type, data) {
    if (this.over || !p.g || !this.canAnswer(p)) return;
    if (type === 'vote') return this.handleVote(p, data || {});
    if (type !== 'answer' || this.stage !== 'question') return;
    const cur = this.cur;
    // a tap race sends its running count again and again until the time is up; everything else answers once
    if (cur.answers.has(p.id) && cur.q.type !== 'tap') return;
    if (data.qid !== undefined && data.qid !== this.qid()) return;
    const q = cur.q;
    const T = this.questionTime(q);
    const ms = T ? Math.min(Date.now() - cur.startAt, T * 1000) : Date.now() - cur.startAt;
    const conf = this.confOptions(p);
    if (conf && !conf.some((o) => o.v === data.conf)) return;
    const res = qt.check(q, cur.state, data);
    if (!res.valid) return;
    // text that is shown on the big screen: words the filter blocks are dropped (the answer still counts as sent)
    if (res.words && this.room.setup.filter) {
      const kept = res.words.filter((w) => !Filter.bad(w));
      res.hidden = res.words.length - kept.length;
      res.words = kept;
      res.chosen = kept.join(' · ');
    }
    const before = cur.answers.get(p.id);
    if (q.type === 'tap' && before && res.taps < before.res.taps) return; // a late, smaller count
    cur.answers.set(p.id, { data, res, ms });
    if (q.type === 'tap' && before) return this.room.scheduleHostPush(); // the phone stays on its tap button
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    if (q.type === 'tap') return; // the race lasts the whole time
    // everyone who can answer has answered: reveal now
    const waiting = this.players().filter((o) => this.canAnswer(o) && o.connected && !cur.answers.has(o.id));
    if (!waiting.length) this.schedule(() => this.reveal(), 600);
  }

  // Kahoot: up to 1000 × multiplier, losing up to half for slower answers; streaks add up to +500
  points(q, ms, streak) {
    const mult = (this.inBonus ? 2 : 1) * q.points * (this.cur && this.cur.dbl ? 2 : 1);
    if (!mult) return 0;
    const T = (this.questionTime(q) || 30) * 1000; // unlimited time: speed counts over the first 30 seconds
    const base = Math.round((1 - Math.min(ms, T) / T / 2) * 1000 * mult);
    return base + Math.min(500, Math.max(0, streak - 1) * 100);
  }

  // brainstorm: after the ideas come in, everyone votes for the ones they like best
  startVote() {
    const cur = this.cur;
    const ideas = [];
    for (const [pid, a] of cur.answers) for (const text of a.res.words) ideas.push({ text, by: pid });
    cur.ideas = shuffle(ideas).slice(0, 60);
    cur.votes = new Map();
    cur.voteEnd = Date.now() + VOTE_MS;
    this.stage = 'vote';
    this.pushEveryone();
    this.schedule(() => this.reveal(), VOTE_MS + 300);
  }

  handleVote(p, data) {
    const cur = this.cur;
    if (this.stage !== 'vote' || cur.votes.has(p.id)) return;
    if (data.qid !== undefined && data.qid !== this.qid()) return;
    const picks = Array.isArray(data.ideas) ? data.ideas : [];
    if (!picks.length || picks.length > VOTES_EACH || new Set(picks).size !== picks.length) return;
    if (picks.some((i) => !Number.isInteger(i) || i < 0 || i >= cur.ideas.length || cur.ideas[i].by === p.id)) return;
    cur.votes.set(p.id, picks);
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    const waiting = this.players().filter((o) => this.canAnswer(o) && o.connected && !cur.votes.has(o.id));
    if (!waiting.length) this.schedule(() => this.reveal(), 600);
  }

  reveal() {
    if (this.stage !== 'question' && this.stage !== 'vote') return;
    clearTimeout(this.timer);
    const cur = this.cur;
    const q = cur.q;
    if ((q.type === 'brain' || q.type === 'qna') && this.stage === 'question') {
      const n = [...cur.answers.values()].reduce((s, a) => s + a.res.words.length, 0);
      if (n >= 2) return this.startVote();
    }
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
          if (this.livesOn && g.lives > 0) {
            g.lives--;
            if (g.lives === 0) this.addFeed(`💀 ${p.name} הודח/ה מההישרדות`);
          }
        }
        pts = this.scoreFor(p, q, a, ok);
        g.score = Math.max(0, g.score + pts);
        this.room.logAnswer(p, { q: q.text, type: q.type, chosen: a ? a.res.chosen : '(לא ענה/תה)', answer: qt.correctText(q), ok, ms: a ? a.ms : (this.questionTime(q) || 0) * 1000 });
      }
      g.res = { answered: !!a, ok: scored ? ok : null, pts, streak: g.streak, conf: a ? a.data.conf : undefined };
    }
    this.rank();
    // what the class answered
    const rv = { correctText: qt.correctText(q), answered: cur.answers.size, right, explain: q.explain || '', afterImage: qt.afterImage(q, this.room.quizData.mediaBase), source: q.source || null };
    const names = new Map(this.players().map((o) => [o.id, o.name]));
    if (q.type === 'quiz' || q.type === 'tf' || q.type === 'poll') {
      rv.dist = cur.state.order.map(() => 0);
      for (const a of cur.answers.values()) {
        const picks = Array.isArray(a.data.choices) ? a.data.choices : [a.data.choice];
        for (const c of picks) if (rv.dist[c] !== undefined) rv.dist[c]++;
      }
      rv.correct = q.type === 'poll' ? [] : cur.state.order.map((orig, d) => (q.answers[orig].correct ? d : -1)).filter((d) => d >= 0);
    } else if (q.type === 'tap') {
      rv.taps = [...cur.answers].map(([pid, a]) => ({ name: names.get(pid) || '', taps: a.res.taps })).sort((a, b) => b.taps - a.taps).slice(0, 8);
      rv.totalTaps = [...cur.answers.values()].reduce((s, a) => s + a.res.taps, 0);
    } else if (q.type === 'cloud') {
      const counts = new Map();
      for (const a of cur.answers.values()) {
        for (const w of a.res.words) {
          const k = qt.norm(w);
          const e = counts.get(k) || { text: w, n: 0 };
          e.n++;
          counts.set(k, e);
        }
      }
      rv.words = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 60);
    } else if (q.type === 'open') {
      rv.texts = [...cur.answers].flatMap(([pid, a]) => a.res.words.map((text) => ({ text, by: names.get(pid) || '' }))).slice(0, 80);
    } else if (q.type === 'rate') {
      const max = q.scale.max;
      const dist = Array.from({ length: max }, () => 0);
      let sum = 0;
      for (const a of cur.answers.values()) {
        dist[a.res.value - 1]++;
        sum += a.res.value;
      }
      rv.rate = { max, dist, avg: cur.answers.size ? Math.round((sum / cur.answers.size) * 10) / 10 : null };
    } else if (q.type === 'rank') {
      // every position gives points (first place = most); the item with the most points is the class's favorite
      const n = q.items.length;
      const pts = q.items.map(() => 0);
      for (const a of cur.answers.values()) a.res.ranks.forEach((item, pos) => (pts[item] += n - pos));
      rv.rank = q.items.map((text, i) => ({ text, score: pts[i] })).sort((a, b) => b.score - a.score);
    } else if (q.type === 'brain' || q.type === 'qna') {
      const votes = (cur.ideas || []).map(() => 0);
      for (const picks of (cur.votes || new Map()).values()) for (const i of picks) votes[i]++;
      const list = cur.ideas || [...cur.answers].flatMap(([pid, a]) => a.res.words.map((text) => ({ text, by: pid })));
      rv.ideas = list.map((x, i) => ({ text: x.text, by: names.get(x.by) || '', votes: votes[i] || 0 })).sort((a, b) => b.votes - a.votes).slice(0, 24);
      rv.voters = cur.votes ? cur.votes.size : 0;
    } else if (q.type === 'drop') {
      rv.pins = [...cur.answers.values()].map((a) => [Math.round(a.data.x * 10) / 10, Math.round(a.data.y * 10) / 10]).slice(0, 200);
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
      rv.top = [...counts.values()].filter((t) => !(this.room.setup.filter && Filter.bad(t.text))).sort((a, b) => b.n - a.n).slice(0, 6);
    } else if (q.type === 'pin') {
      rv.pins = [...cur.answers.values()].map((a) => [Math.round(a.data.x * 10) / 10, Math.round(a.data.y * 10) / 10, a.res.ok]).slice(0, 200);
      rv.target = q.pin;
    } else if (q.type === 'order') {
      rv.items = q.items;
    } else if (q.type === 'match' || q.type === 'sort') {
      if (q.type === 'match') rv.pairs = q.pairs;
      else rv.buckets = q.buckets;
      const ratios = [...cur.answers.values()].map((a) => a.res.ratio || 0);
      rv.avgPct = ratios.length ? Math.round((ratios.reduce((s, v) => s + v, 0) / ratios.length) * 100) : 0;
    } else if (q.type === 'puzzle') {
      const ratios = [...cur.answers.values()].map((a) => a.res.ratio || 0);
      rv.avgPct = ratios.length ? Math.round((ratios.reduce((s, v) => s + v, 0) / ratios.length) * 100) : 0;
    }
    if (this.style === 'confidence') {
      const boosted = [...cur.answers.values()].filter((a) => a.data.conf === 1).length;
      rv.boostPct = cur.answers.size ? Math.round((boosted / cur.answers.size) * 100) : 0;
    }
    rv.hidden = [...cur.answers.values()].reduce((n, a) => n + (a.res.hidden || 0), 0);
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
    // learning: no leaderboard at all, straight to the next question
    if (this.style === 'learn') return this.next();
    if (this.livesOn && this.players().filter((p) => p.g && p.g.lives > 0).length <= (this.players().length > 1 ? 1 : 0)) return this.room.end();
    this.sur = this.maybeSurprise();
    this.stage = 'board';
    this.pushEveryone();
    if (!this.manual) this.schedule(() => this.next(), AUTO_BOARD_MS);
  }

  // 🎁 a surprise at the leaderboard (room setting, classic quiz only): someone steals points from the leader,
  // two players swap scores, or the next question counts double. Returns { k, text, for: { playerId: text } } or null.
  maybeSurprise() {
    const S = this.room.settings.surprise;
    if (this.constructor.id !== 'classic' || (S !== 'sometimes' && S !== 'often') || this.inBonus || this.style === 'learn') return null;
    if (Math.random() > (S === 'often' ? 0.5 : 0.25)) return null;
    const list = this.rank().filter((p) => p.connected && p.g.score > 0);
    const nx = this.list[this.i + 1];
    const kinds = [];
    if (list.length >= 3) kinds.push('steal', 'swap');
    if (this.style !== 'accuracy' && nx && nx.points > 0 && qt.SCORED.has(nx.type)) kinds.push('double');
    if (!kinds.length) return null;
    const k = kinds[Math.floor(Math.random() * kinds.length)];
    const bottom = list.slice(Math.ceil(list.length / 2));
    const any = (a) => a[Math.floor(Math.random() * a.length)];
    if (k === 'double') {
      this.dbl = true;
      return { k, text: '🎁 הפתעה! השאלה הבאה שווה כפול!', for: {} };
    }
    if (k === 'steal') {
      const lead = list[0];
      const thief = any(bottom.filter((p) => p !== lead));
      if (!thief) return null;
      const amt = Math.min(lead.g.score, Math.max(100, Math.round((lead.g.score * 0.1) / 10) * 10));
      lead.g.score -= amt;
      thief.g.score += amt;
      this.rank();
      return { k, text: `🦹 הפתעה! ${thief.name} גנב/ה ${amt} נקודות מ${lead.name}!`, for: { [lead.id]: `🦹 ${thief.name} גנב/ה לכם ${amt} נקודות!`, [thief.id]: `🦹 גנבתם ${amt} נקודות מ${lead.name}!` } };
    }
    // swap: one of the top three with one of the bottom half (a real change of places)
    const a = any(list.slice(0, Math.min(3, list.length)));
    const b = any(bottom.filter((p) => p !== a && Math.abs(p.g.score - a.g.score) >= 100));
    if (!b) return null;
    [a.g.score, b.g.score] = [b.g.score, a.g.score];
    this.rank();
    return { k, text: `🔄 הפתעה! ${a.name} ו־${b.name} החליפו מקומות!`, for: { [a.id]: `🔄 החלפתם מקומות עם ${b.name}!`, [b.id]: `🔄 החלפתם מקומות עם ${a.name}!` } };
  }

  // host "next" button: moves to the next stage right away
  hostCommand(cmd) {
    if (this.over || cmd !== 'next') return;
    if (this.stage === 'ready') this.open();
    else if (this.stage === 'question' || this.stage === 'vote') this.reveal();
    else if (this.stage === 'reveal') this.board();
    else this.next(); // board, slide
  }

  rankSnapshot() {
    for (const p of this.players()) if (p.g) p.g.prevRank = p.g.rank;
  }

  rank() {
    // survival: those still in the game rank above those who were knocked out
    const out = (p) => (this.livesOn && p.g.lives <= 0 ? 1 : 0);
    const list = this.players().filter((p) => p.g).sort((a, b) => out(a) - out(b) || b.g.score - a.g.score);
    list.forEach((p, i) => (p.g.rank = i + 1));
    return list;
  }

  funLines(fastest, right) {
    const list = this.rank();
    const out = [];
    const take = this.eligible ? list.filter((p) => this.eligible.has(p.id)) : list;
    const asked = take.length || 1;
    if (qt.SCORED.has(this.cur.q.type)) {
      const pct = Math.round((right / asked) * 100);
      if (pct >= 80) out.push(`👏 ${pct}% ענו נכון! איזו כיתה חכמה`);
      else if (pct <= 30) out.push(`🤔 שאלה קשה! רק ${pct}% צדקו`);
    }
    if (this.style === 'learn') return out.slice(0, 1);
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
    if (this.stage === 'vote') {
      out.ideas = cur.ideas.map((x) => x.text);
      out.voted = cur.votes.size;
      out.remain = Math.max(0, cur.voteEnd - Date.now());
      out.time = VOTE_MS / 1000;
    }
    if (this.stage === 'reveal' || this.stage === 'board') {
      out.reveal = cur.reveal;
      out.lines = this.lines;
      out.surprise = this.stage === 'board' && this.sur ? { k: this.sur.k, text: this.sur.text } : null;
      out.board = this.board5();
      const T = this.room.teams();
      if (T.length >= 2) out.teams = this.room.teamScores();
    }
    return out;
  }

  personal(p) {
    const g = p.g;
    const cur = this.cur;
    const base = { score: g.score, rank: g.rank, streak: g.streak, qid: this.qid(), qnum: this.i + 1, total: this.list.length, bonus: this.inBonus, stage: this.stage, lives: this.livesOn ? g.lives : null, qtype: cur ? cur.q.type : '', style: this.style };
    const can = this.canAnswer(p);
    if (!cur) return { ...base, phase: 'c_ready' };
    if (this.stage === 'ready') return { ...base, phase: can ? 'c_ready' : 'c_watch', text: cur.q.text, points: cur.q.points };
    if (this.stage === 'slide') return { ...base, phase: 'c_slide', q: cur.payload };
    if (this.stage === 'vote') {
      if (!can) return { ...base, phase: 'c_watch' };
      if (cur.votes.has(p.id)) return { ...base, phase: 'c_locked' };
      // the ideas as the phone numbers them (own ideas can't be voted for, so they are left out)
      const ideas = cur.ideas.map((x, i) => ({ i, text: x.text })).filter((x) => cur.ideas[x.i].by !== p.id);
      if (!ideas.length) return { ...base, phase: 'c_watch' };
      return { ...base, phase: 'c_vote', text: cur.q.text, ideas, picks: VOTES_EACH, remain: Math.max(0, cur.voteEnd - Date.now()) };
    }
    if (this.stage === 'question') {
      if (!can) return { ...base, phase: 'c_watch' };
      if (cur.answers.has(p.id) && cur.q.type !== 'tap') return { ...base, phase: 'c_locked' };
      return { ...base, phase: 'c_question', question: cur.payload, remain: cur.deadline ? Math.max(0, cur.deadline - Date.now()) : null, conf: this.confOptions(p) };
    }
    // reveal / board: my own result + who is right above me
    const list = this.rank();
    base.sur = this.stage === 'board' && this.sur ? this.sur.for[p.id] || this.sur.text : null;
    const above = g.rank > 1 ? list[g.rank - 2] : null;
    return { ...base, phase: can ? 'c_result' : 'c_watch_res', res: g.res, correctText: cur.reveal ? cur.reveal.correctText : '', explain: cur.reveal ? cur.reveal.explain : '', afterImage: cur.reveal ? cur.reveal.afterImage : '', source: cur.reveal ? cur.reveal.source : null, above: above ? { name: above.name, gap: above.g.score - g.score } : null };
  }

  results() {
    const players = this.rank().map((p) => ({ name: p.name, team: p.team, score: p.g.score, correct: p.g.correct, wrong: p.g.wrong, best: p.g.bestStreak }));
    return { kind: 'classic', players, total: this.main.length, style: this.style, scored: this.main.filter((q) => qt.SCORED.has(q.type)).length };
  }
}

module.exports = ClassicGame;
