// Fun Hebrew nicknames for "auto names" mode (animal + adjective, both masculine so they agree).
const ANIMALS = ['נמר', 'דולפין', 'פינגווין', 'קוף', 'ינשוף', 'דוב', 'שועל', 'זאב', 'תוכי', 'צב', 'פיל', 'ג׳ירפה', 'סנאי', 'קנגורו', 'לוויתן', 'תמנון', 'דרקון', 'חד־קרן', 'נשר', 'צפרדע', 'כריש', 'פנדה', 'קואלה', 'גמל', 'ארנב', 'חתול', 'כלב', 'סוס', 'לטאה', 'זיקית'];
const ADJ = ['זריז', 'שמח', 'אמיץ', 'חכם', 'מהיר', 'מצחיק', 'נועז', 'סקרן', 'חמוד', 'רגוע', 'נוצץ', 'עליז', 'ענק', 'קטנטן', 'שובב', 'חזק', 'מתוק', 'אלוף', 'מעופף', 'קסום'];

function randomName(taken) {
  for (let i = 0; i < 200; i++) {
    const a = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const b = ADJ[Math.floor(Math.random() * ADJ.length)];
    const n = `${a} ${b}`;
    if (!taken.has(n)) return n;
  }
  let k = 2;
  while (taken.has(`שחקן ${k}`)) k++;
  return `שחקן ${k}`;
}

module.exports = { randomName };
