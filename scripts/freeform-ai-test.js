// Pasted text written by an AI (NotebookLM, ChatGPT...): the shapes the free-text import must read. node scripts/freeform-ai-test.js
const F = require('../server/freeform');
let failed = 0;
const check = (name, ok, extra) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || extra === undefined ? '' : '  → ' + JSON.stringify(extra)}`);
};
const right = (q) => (q.answers || []).filter((a) => a.correct).map((a) => a.text);

let r = F.parse('1. What is the capital of France?\nA. Paris\nB. Rome\nC. Oslo\nD. Bern\nAnswer: A\n\n2. 2+2?\nA) 3\nB) 4\nC) 5\nCorrect answer: B');
check('lettered options with an "Answer:" line', r.length === 2 && right(r[0])[0] === 'Paris' && right(r[1])[0] === '4' && r[0].answers.length === 4, r);

r = F.parse('**Question 1:** What is DNS?\n- A) A protocol\n- B) A cable\n- C) A switch\n**Correct answer: A**');
check('markdown: bullets before the options are removed from the answer text', r.length === 1 && right(r[0])[0] === 'A protocol' && r[0].answers.every((a) => !/^[A-C]\)/.test(a.text)), r);

r = F.parse('1. מהי בירת צרפת?\nא. פריז\nב. רומא\nג. אוסלו\nתשובה נכונה: א');
check('Hebrew letters and "תשובה נכונה"', r.length === 1 && right(r[0])[0] === 'פריז', r);

r = F.parse('Q: What is a router?\nA: A device that forwards packets\n\nQ: What is a switch?\nA: A device that connects devices in a LAN');
check('Q: / A: cards: one question per pair, no "A:" in the answer', r.length === 2 && right(r[0])[0] === 'A device that forwards packets' && r[0].text.includes('router') && !/^(A:|-)/.test(right(r[1])[0]), r.map((q) => [q.text, right(q)]));

r = F.parse('Front: Mitochondria\nBack: The powerhouse of the cell\n\nFront: Nucleus\nBack: Holds the DNA');
check('Front: / Back: cards: two questions, not four', r.length === 2 && right(r[1])[0] === 'Holds the DNA', r.map((q) => [q.text, right(q)]));

r = F.parse('1. The sun is a star. (True/False)\nAnswer: True\n\n2. The moon is a planet. (True/False)\nAnswer: False');
check('"(True/False)" with an answer line becomes true/false questions', r.length === 2 && r.every((q) => q.type === 'tf') && right(r[0])[0] === 'נכון' && right(r[1])[0] === 'לא נכון', r);

r = F.parse('1. Which layer routes packets?\n   a) Layer 2\n   b) Layer 3 *\n   c) Layer 4');
check('a * marks the right option', r.length === 1 && right(r[0])[0] === 'Layer 3', r);

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
