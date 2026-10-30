// "מרוץ גולות" - like Kahoot's Marble Race. Every correct answer earns marbles (a streak earns more). When the time is up
// all the marbles race: the more marbles you have the better your chance, but anyone can win. The server draws the finishing order.
const QuizGame = require('./base');

class MarbleGame extends QuizGame {
  static id = 'marble';
  static order = 23;
  static title = 'מרוץ גולות';
  static emoji = '🔮';
  static mode = 'ffa';
  static noReward = true;
  static blurb = 'כל אחד לעצמו. כל תשובה נכונה מוסיפה גולה (ורצף נכונות מוסיף עוד). כשהזמן נגמר כל הגולות יוצאות למירוץ: ככל שיש לכם יותר גולות, יש יותר סיכוי לנצח, אבל כל אחד יכול לזכות!';
  static tickMs = 1000;
  static defaults = { duration: 240 };
  static options = [];

  start() {
    for (const p of this.players()) this.initPlayer(p, { marbles: 0 });
  }

  score(p) {
    return p.g ? p.g.marbles : 0;
  }

  onAnswer(p, correct) {
    const g = p.g;
    if (!correct) return {};
    const add = g.streak >= 3 ? 2 : 1;
    g.marbles += add;
    return { note: `🔮 +${add} ${add > 1 ? 'גולות' : 'גולה'}` };
  }

  ranking() {
    return this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, pts: p.g.marbles, rounds: p.g.correct, acc: p.g.correct + p.g.wrong ? Math.round((p.g.correct / (p.g.correct + p.g.wrong)) * 100) : 0, best: p.g.bestStreak, playing: false }))
      .sort((a, b) => b.pts - a.pts);
  }

  // the finishing order: the next place goes to someone drawn with a chance in proportion to their marbles (plus a little for all)
  draw(list) {
    const pool = list.map((p) => ({ p, w: p.pts + 0.6 }));
    const order = [];
    while (pool.length) {
      let r = Math.random() * pool.reduce((s, x) => s + x.w, 0);
      let i = 0;
      while (i < pool.length - 1 && r >= pool[i].w) r -= pool[i++].w;
      order.push(pool.splice(i, 1)[0].p);
    }
    return order;
  }

  publicState() {
    const r = this.ranking();
    return { kind: 'marble', players: r.slice(0, 16), total: r.length, feed: this.feed };
  }

  personal(p) {
    return { ...this.baseView(p), marbles: p.g.marbles, rank: 1 + this.players().filter((o) => o.g && o.g.marbles > p.g.marbles).length };
  }

  results() {
    const r = this.ranking();
    const order = this.draw(r);
    const place = new Map(order.map((p, i) => [p.name, i + 1]));
    return {
      kind: 'marble',
      players: r.map((p) => ({ ...p, place: place.get(p.name) })),
      race: order.map((p) => ({ name: p.name, marbles: p.pts })),
    };
  }
}

module.exports = MarbleGame;
