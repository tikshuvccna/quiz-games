// "הרצפה היא לבה" - co-op. The class climbs out of a volcano while the lava rises beneath it. A correct answer is a
// climb on the phone: rows of stones flash by, some of them glowing and about to crumble; tap a cool one on each
// row before time runs out. Step on a hot one and you slide back down. Reach the crater's rim before the lava!
const ChaseGame = require('./chase');

const ROWS = 5;
const STONES = 3;

class LavaGame extends ChaseGame {
  static id = 'lava';
  static order = 22;
  static title = 'הרצפה היא לבה';
  static emoji = '🌋';
  static reward = ['טיפוס', 'טיפוסים'];
  static blurb = 'הר געש מתעורר והלבה עולה! כל הכיתה מטפסת ביחד אל פי ההר. תשובה נכונה = טיפוס: קופצים מאבן לאבן, רק על האבנים הקרירות. אבן לוהטת מתפוררת! מגיעים למעלה לפני הלבה?';
  static phases = ['climb', 'climbed'];
  static actionType = 'climb';
  static fallbackMs = 12000;
  static milestones = ['🪨 עברנו את המערות!', '🔥 חצי הדרך! חם פה…', '☁️ רואים את השמיים!'];
  static caughtText = (back) => `🌋 הלבה השיגה אותנו! ${back} מטר למטה`;
  static wonText = '🎉 יצאנו מהר הגעש!';
  static startText = '🌋 הלבה מתחילה לעלות! מטפסים!';
  static rageNote = '🌋 הלבה מבעבעת!';
  static readyNote = '🧗 קדימה לטפס!';

  // 1 = a hot stone. The first rows have one hot stone, the higher ones two (one safe stone left).
  makeAction() {
    const rows = [];
    for (let r = 0; r < ROWS; r++) {
      const row = Array(STONES).fill(r >= 2 ? 1 : 0);
      const pick = Math.floor(Math.random() * STONES);
      if (r >= 2) row[pick] = 0;
      else row[pick] = 1;
      rows.push(row);
    }
    return { rows };
  }

  // steps count until the first hot stone (or a missed row)
  grade(p, data) {
    if (!data) return { gain: 3, steps: 0, fell: false };
    const picks = Array.isArray(data.picks) ? data.picks.slice(0, ROWS) : [];
    const rows = p.g.act.rows;
    let steps = 0;
    let fell = false;
    for (let r = 0; r < picks.length; r++) {
      const k = picks[r];
      if (!Number.isInteger(k) || k < 0 || k >= STONES) break;
      if (rows[r][k]) {
        fell = true;
        break;
      }
      steps++;
    }
    const perfect = steps === ROWS;
    return { gain: Math.max(2, 3 + 4 * steps + (perfect ? 6 : 0)), perfect, steps, fell };
  }
}

module.exports = LavaGame;
