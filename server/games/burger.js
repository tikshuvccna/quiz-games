// "המבורגריה" - a correct answer is a burger order: memorize the layers (shown for a few seconds), then stack them in the right order.
const FfaAction = require('./ffa');

// 0 bun bottom, 1 lettuce, 2 tomato, 3 cheese, 4 patty, 5 onion, 6 pickle, 7 bun top
const FILLINGS = [1, 2, 3, 4, 5, 6];

class BurgerGame extends FfaAction {
  static id = 'burger';
  static kind = 'burger';
  static order = 21;
  static title = 'המבורגריה';
  static emoji = '🍔';
  static reward = ['הזמנה', 'הזמנות'];
  static blurb = 'כל אחד לעצמו. תשובה נכונה היא הזמנה של המבורגר: רואים את השכבות כמה שניות, ואז מרכיבים אותו בדיוק באותו הסדר. ככל שהרצף נכון יותר, יש יותר נקודות!';

  makeRound(g) {
    const n = 3 + Math.min(3, Math.floor(g.streak / 2));
    const mid = Array.from({ length: n }, () => FILLINGS[Math.floor(Math.random() * FILLINGS.length)]);
    const recipe = [0, ...mid, 7];
    return { pub: { recipe, showMs: 2200 + recipe.length * 450 }, secret: recipe, ms: 2200 + recipe.length * 450 + 9000 };
  }

  grade(g, data, recipe) {
    const seq = (Array.isArray(data.seq) ? data.seq : []).slice(0, 12).filter((x) => Number.isInteger(x) && x >= 0 && x <= 7);
    let ok = 0;
    while (ok < recipe.length && seq[ok] === recipe[ok]) ok++;
    const full = ok === recipe.length;
    const pts = ok * 3 + (full ? 8 : 0);
    return { pts, hits: ok, total: recipe.length, full, title: full ? 'הזמנה מושלמת!' : `${ok} מתוך ${recipe.length} שכבות`, sub: full ? 'הלקוח מרוצה 😋' : 'הסדר נשבר בשכבה ' + (ok + 1) };
  }
}

module.exports = BurgerGame;
