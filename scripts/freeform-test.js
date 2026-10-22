// Free-form import parser: many ways teachers write questions. node scripts/freeform-test.js
const JSZip = require('jszip');
const F = require('../server/freeform');

let failed = 0;
const check = (name, ok, extra) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || extra === undefined ? '' : '\n     → ' + JSON.stringify(extra)}`);
};
const right = (q) => (q.answers || []).filter((a) => a.correct).map((a) => a.text);

(async () => {
  // 1. numbered questions, lettered answers, star on the right one
  let r = F.parse(`1. מהי בירת ישראל?
א. תל אביב
ב. ירושלים *
ג. חיפה
ד. אילת

2. כמה רגליים יש לעכביש?
a) 6
b) 8 ✓
c) 10`);
  check('numbered + lettered, * and ✓ mark the right answer', r.length === 2 && right(r[0])[0] === 'ירושלים' && right(r[1])[0] === '8' && r[0].answers.length === 4, r);
  check('the number is removed from the question text', r[0].text === 'מהי בירת ישראל?', r[0].text);

  // 2. "answer:" line
  r = F.parse(`מה צבע השמיים?
- אדום
- כחול
- ירוק
תשובה: ב`);
  check('"תשובה: ב" picks the second answer', right(r[0])[0] === 'כחול', r);

  // 3. answer key at the end
  r = F.parse(`1) 2+2=?
א) 3
ב) 4
ג) 5

2) 3+3=?
א) 6
ב) 7

תשובות:
1-ב, 2-א`);
  check('answer key at the end', right(r[0])[0] === '4' && right(r[1])[0] === '6', r.map(right));

  // 4. true / false statements
  r = F.parse(`השמש היא כוכב (נכון)

הירח עשוי מגבינה (לא נכון)`);
  check('statements with (נכון)/(לא נכון) become true/false', r.length === 2 && r.every((q) => q.type === 'tf') && right(r[0])[0] === 'נכון' && right(r[1])[0] === 'לא נכון', r);

  // 5. vocabulary list: term - meaning
  r = F.parse(`dog - כלב
cat - חתול
house - בית
book - ספר
sun - שמש`);
  check('vocabulary list: every line is a question with 4 answers', r.length === 5 && r.every((q) => q.answers.length === 4 && right(q).length === 1), r.map((q) => q.answers && q.answers.length));
  check('the right meaning is kept', right(r[0])[0] === 'כלב');

  // 6. only the answer, a number → close numbers as distractors
  r = F.parse(`באיזו שנה קמה מדינת ישראל? 1948`);
  check('a year answer gets nearby years', r[0].answers.length === 4 && right(r[0])[0] === '1948' && r[0].answers.every((a) => /^\d{4}$/.test(a.text)), r[0].answers);

  // 7. a single word answer with nothing to borrow from → typed answer
  r = F.parse(`מה שם הכוכב הקרוב אלינו? השמש`);
  check('one question with a word answer becomes a typed-answer question', r[0].type === 'type' && r[0].accept[0] === 'השמש', r[0]);

  // 8. no correct mark → flagged
  r = F.parse(`מה גדול יותר?
- פיל
- נמלה`);
  check('no correct answer is flagged for the teacher', r[0].notes.some((n) => n.includes('לא סומנה')), r[0].notes);

  // 9. a Word file with the right answer in bold
  const zip = new JSZip();
  const p = (t, bold) => `<w:p><w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t>${t}</w:t></w:r></w:p>`;
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document><w:body>${p('מי כתב את התנ"ך?')}${p('א. משה', false)}${p('ב. רבים', true)}${p('ג. שייקספיר')}</w:body></w:document>`);
  const text = await F.toText(await zip.generateAsync({ type: 'nodebuffer' }), 'q.docx');
  r = F.parse(text);
  check('Word: bold answer is the right one', right(r[0])[0] === 'רבים', { text, r });

  // 10. times are set by length
  check('every question has a time and points', F.parse('א? ב\n\nג? ד').every((q) => q.time >= 20 && q.points === 1));

  // 11. English
  r = F.parse(`Q1: What is H2O?
A. Salt
B. Water (correct)
C. Air`);
  check('English with (correct)', right(r[0])[0] === 'Water' && r[0].text === 'What is H2O?', r);

  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
  process.exit(failed ? 1 : 0);
})();
