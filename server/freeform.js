// Free-form import: questions and answers in whatever shape the teacher has them (pasted text, a Word file,
// a plain list, a two-column vocabulary table) → quiz questions. Fills in what is missing: the question type,
// the correct answer (from marks like *, ✓, (נכון), bold text or an answer key), the time, and wrong answers
// when only the right one was given (numbers get close numbers; words get other questions' answers).
const JSZip = require('jszip');
const ExcelJS = require('exceljs');
const qt = require('./qtypes');

const HEB_LETTERS = 'אבגדהו';
const LAT_LETTERS = 'abcdef';

// ---------- reading files ----------
async function docxText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const f = zip.file('word/document.xml');
  if (!f) throw new Error('קובץ Word לא תקין');
  const xml = await f.async('string');
  const out = [];
  for (const p of xml.split(/<\/w:p>/)) {
    let line = '';
    for (const r of p.split(/<\/w:r>/)) {
      const t = [...r.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
      if (!t) continue;
      // bold / highlighted / underlined runs often mark the right answer
      const marked = /<w:b\/>|<w:b w:val="(1|true)"\/>|<w:highlight |<w:u w:val="single"/.test(r);
      line += marked && t.trim() ? `**${t}**` : t;
    }
    // numbered lists in Word: keep a marker so the parser sees separate items
    if (/<w:numPr>/.test(p) && line.trim()) line = '• ' + line;
    out.push(unxml(line.replace(/\*\*\s*\*\*/g, '')));
  }
  return out.join('\n');
}
const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// spreadsheet without the Kahoot header: each row = question, answer, (more answers…)
async function sheetText(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const rows = [];
  wb.worksheets[0].eachRow((row) => {
    const cells = [];
    row.eachCell({ includeEmpty: true }, (c) => {
      const v = c.value && typeof c.value === 'object' ? c.value.richText ? c.value.richText.map((x) => x.text).join('') : c.value.text ?? c.value.result ?? '' : c.value;
      cells.push(String(v ?? '').trim());
    });
    while (cells.length && !cells[cells.length - 1]) cells.pop();
    if (cells.some(Boolean)) rows.push(cells.join('\t'));
  });
  return rows.join('\n');
}

async function toText(buffer, name = '') {
  const n = name.toLowerCase();
  if (n.endsWith('.docx')) return docxText(buffer);
  if (n.endsWith('.xlsx')) return sheetText(buffer);
  let s = buffer.toString('utf8');
  if (s.includes('�')) s = new TextDecoder('windows-1255').decode(buffer); // old Hebrew text files
  return s.replace(/^﻿/, '');
}

// ---------- parsing ----------
const NUM_PREFIX = /^\s*(?:(?:שאלה|question|q)\s*)?(\d{1,3})\s*[.):\-–]\s*/i;
const Q_PREFIX = /^\s*(?:שאלה|question|ש|q)\s*\d*\s*[.:)\-–]\s*/i;
const ANS_PREFIX = new RegExp(`^\\s*(?:[•\\-–*·○●▪➢>]|\\(?[${HEB_LETTERS}]['׳]?\\s*[.)\\-]|\\(?[${LAT_LETTERS}]\\s*[.)]|\\(?[A-F]\\s*[.)]|\\(?[1-6]\\s*\\))\\s+`, 'i');
const CORRECT_MARK = /(\*\s*$|^\s*\*|✓|✔|✅|☑|\[\s*x\s*\]|\((?:נכון|נכונה|correct|right|v)\)|\s+[-–]\s*(?:נכון|נכונה)\s*$|←\s*$|<-+\s*$|^\s*\+\s)/i;
const KEY_LINE = /^\s*(?:תשובה(?:\s*נכונה)?|התשובה|answer|correct(?:\s*answer)?|ת)\s*[:\-–]\s*(.+)$/i;
const TF_TAIL = /[(\[]\s*(נכון|לא נכון|true|false|T|F|כן|לא)\s*[)\]]\s*$|\s+[-–]\s*(נכון|לא נכון|true|false)\s*$/i;
const PAIR = /^(.{2,160}?)\s*(?:\t+|\s[-–=]\s|:\s+|\s{3,})(.{1,120})$/;
const isNum = (s) => /^-?\d+(?:[.,]\d+)?$/.test(String(s).trim());

function stripAnswer(line) {
  let t = line.replace(ANS_PREFIX, '');
  const marked = CORRECT_MARK.test(t) || /\*\*.+\*\*/.test(line);
  t = t.replace(CORRECT_MARK, '').replace(/\*\*/g, '').replace(/\s+$/, '').trim();
  return { text: t, marked };
}

// "1-ב, 2-א, 3: ג" or "1. b" lines → { 1: 'ב', 2: 'א' }
function answerKey(lines) {
  const key = {};
  for (const l of lines) for (const m of l.matchAll(/(\d{1,3})\s*[.)\-:–]\s*([א-ו]|[a-fA-F]|[1-6]|[^,;\n]{1,40}?)(?=\s*(?:[,;]|\s\d{1,3}\s*[.)\-:–]|$))/g)) key[Number(m[1])] = m[2].trim();
  return key;
}

// which answer a key / "תשובה: ..." line points at
function pick(answers, ref) {
  ref = String(ref || '').replace(/[()]/g, '').trim();
  if (!ref) return -1;
  const h = HEB_LETTERS.indexOf(ref);
  if (ref.length === 1 && h >= 0 && h < answers.length) return h;
  const l = LAT_LETTERS.indexOf(ref.toLowerCase());
  if (ref.length === 1 && l >= 0 && l < answers.length) return l;
  if (/^[1-6]$/.test(ref) && Number(ref) <= answers.length && !answers.some((a) => a.text === ref)) return Number(ref) - 1;
  const norm = qt.norm(ref);
  return answers.findIndex((a) => qt.norm(a.text) === norm);
}

function splitBlocks(text) {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+$/, ''));
  // an answer key at the end ("תשובות:" / "answer key") is read separately
  let keyStart = lines.findIndex((l) => /^\s*(?:תשובות|מפתח(?:\s*תשובות)?|answers?\s*key|answers)\s*:?\s*$/i.test(l));
  const keyLines = keyStart >= 0 ? lines.slice(keyStart + 1) : [];
  const body = keyStart >= 0 ? lines.slice(0, keyStart) : lines;
  const blocks = [];
  let cur = [];
  const flush = () => { if (cur.some((l) => l.trim())) blocks.push(cur.filter((l) => l.trim())); cur = []; };
  for (let l of body) {
    if (!l.trim()) { flush(); continue; }
    // bold (from Word) on an answer line marks it as the right one; elsewhere it is just style
    if (l.includes('**')) {
      const plain = l.replace(/\*\*/g, '');
      l = ANS_PREFIX.test(plain) && /\*\*\s*\S/.test(l) ? plain + ' ✓' : plain;
    }
    // a numbered line that is not an answer starts a new question
    if (NUM_PREFIX.test(l) && !ANS_PREFIX.test(l) && cur.length && cur.some((x) => ANS_PREFIX.test(x) || KEY_LINE.test(x))) flush();
    cur.push(l);
  }
  flush();
  return { blocks, key: answerKey(keyLines) };
}

// Text written by an AI (NotebookLM, ChatGPT...) comes in a few shapes the plain parser trips on; straighten them first:
//   "- A) option" (a bullet in front of a lettered option) · "Q: ... / A: ..." and "Front: ... / Back: ..." cards (one question
//   per pair) · "statement (True/False)" followed by "Answer: True"
function aiNormalize(text) {
  let t = String(text || '').replace(/\r\n?/g, '\n');
  // a bullet in front of a lettered option: "- A) text" -> "A) text"
  t = t.replace(new RegExp('^[ \\t]*[-*\u2022]\\s+(?=\\(?[A-Fa-f' + HEB_LETTERS + "]['\u05f3]?\\s*[.)]\\s)", 'gm'), '');
  // cards: a question label, then an answer label on the next line -> "question - answer" (one line = one question)
  const QL = '(?:q|question|front|\u05e9\u05d0\u05dc\u05d4|\u05e6\u05d3 \u05e7\u05d3\u05de\u05d9|\u05de\u05d5\u05e9\u05d2)';
  const AL = '(?:a|answer|back|\u05ea\u05e9\u05d5\u05d1\u05d4|\u05e6\u05d3 \u05d0\u05d7\u05d5\u05e8\u05d9|\u05d4\u05d2\u05d3\u05e8\u05d4)';
  const cards = new RegExp('^[ \\t]*(?:\\d+[.)]\\s*)?\\**' + QL + '\\**\\s*\\d*\\s*[:\uff1a]\\s*\\**\\s*(.+?)\\s*\\n[ \\t]*\\**' + AL + '\\**\\s*[:\uff1a]\\s*\\**\\s*(.+)$', 'gim');
  t = t.replace(cards, (m, q, a) => q.replace(/\*+$/, '').trim() + ' - ' + a.replace(/\*+$/, '').trim());
  // a true/false statement with its answer on the next line
  t = t.replace(/^(.*?\S)\s*\((?:true\s*\/\s*false|\u05e0\u05db\u05d5\u05df\s*\/\s*\u05dc\u05d0 \u05e0\u05db\u05d5\u05df)\)\s*\n[ \t]*\**(?:answer|correct answer|\u05ea\u05e9\u05d5\u05d1\u05d4(?: \u05e0\u05db\u05d5\u05e0\u05d4)?)\**\s*[:\uff1a]\s*\**\s*(true|false|\u05e0\u05db\u05d5\u05df|\u05dc\u05d0 \u05e0\u05db\u05d5\u05df)[ \t]*\**[ \t]*$/gim, (m, st, v) => st + ' (' + v + ')');
  return t;
}

function parse(text) {
  const { blocks, key } = splitBlocks(aiNormalize(text).slice(0, 400000));
  const out = [];
  // a block of one-line "term - definition" pairs is a vocabulary list: every line is a question
  const expand = [];
  for (const b of blocks) {
    const pairs = b.map((l) => l.replace(NUM_PREFIX, '').match(PAIR));
    const group = expand.length;
    if (b.length >= 2 && pairs.every(Boolean) && !b.some((l) => ANS_PREFIX.test(l) || KEY_LINE.test(l))) pairs.forEach((m) => expand.push({ pair: [m[1].trim(), m[2].trim()], group }));
    else expand.push({ lines: b });
  }
  let n = 0;
  for (const item of expand) {
    n++;
    const notes = [];
    let q;
    if (item.pair) {
      const [a, b] = item.pair;
      q = { type: 'quiz', text: a, answers: [{ text: b, correct: true }], _single: true, _group: item.group };
    } else {
      const lines = item.lines.slice();
      let qLines = [];
      const answers = [];
      let keyRef = null;
      for (const l of lines) {
        const k = l.match(KEY_LINE);
        if (k && answers.length) { keyRef = k[1]; continue; }
        if (k && !answers.length && qLines.length) { keyRef = k[1]; continue; }
        if (ANS_PREFIX.test(l) && qLines.length) {
          const a = stripAnswer(l);
          if (a.text) answers.push({ text: a.text.slice(0, 120), correct: a.marked });
        } else if (!answers.length) qLines.push(l);
        else answers.push({ text: stripAnswer(l).text.slice(0, 120), correct: stripAnswer(l).marked });
      }
      let qtext = qLines.join(' ').replace(NUM_PREFIX, '').replace(Q_PREFIX, '').replace(/\*\*/g, '').trim();
      // "the sun is a star (נכון)" → true / false
      const tf = qtext.match(TF_TAIL);
      if (!answers.length && tf) {
        const v = (tf[1] || tf[2]).toLowerCase();
        const yes = ['נכון', 'true', 't', 'כן'].includes(v);
        q = { type: 'tf', text: qtext.replace(TF_TAIL, '').trim(), answers: [{ text: 'נכון', correct: yes }, { text: 'לא נכון', correct: !yes }] };
      } else if (!answers.length && keyRef) {
        q = { type: 'quiz', text: qtext, answers: [{ text: keyRef.replace(/\*\*/g, '').trim(), correct: true }], _single: true };
      } else if (!answers.length) {
        // "question? answer" on one line
        const m = qtext.match(/^(.+?[?？])\s*(.{1,80})$/);
        if (m) q = { type: 'quiz', text: m[1].trim(), answers: [{ text: m[2].replace(/^[\s\-–=:]+/, '').trim(), correct: true }], _single: true };
        else {
          const pm = qtext.match(PAIR);
          if (pm) q = { type: 'quiz', text: pm[1].trim(), answers: [{ text: pm[2].trim(), correct: true }], _single: true };
          else q = { type: 'quiz', text: qtext, answers: [], _noAnswer: true };
        }
      } else {
        q = { type: 'quiz', text: qtext, answers };
        if (keyRef) {
          const i = pick(answers, keyRef);
          if (i >= 0) answers.forEach((a, k) => (a.correct = k === i));
          else notes.push(`התשובה "${keyRef}" לא נמצאה בין האפשרויות`);
        }
        if (key[n] && !answers.some((a) => a.correct)) {
          const i = pick(answers, key[n]);
          if (i >= 0) answers[i].correct = true;
        }
        // two answers that are true/false → a true/false question
        const tfNames = answers.map((a) => qt.norm(a.text));
        if (answers.length === 2 && tfNames.every((x) => ['נכון', 'לא נכון', 'true', 'false', 'כן', 'לא'].includes(x))) q.type = 'tf';
      }
    }
    if (!q.text) continue;
    q.text = q.text.slice(0, 300);
    if (q._noAnswer) notes.push('לא נמצאה תשובה: הוסיפו אותה');
    else if (q.answers.length > 1 && !q.answers.some((a) => a.correct)) notes.push('לא סומנה תשובה נכונה: לחצו על התשובה הנכונה');
    if (q.answers.filter((a) => a.correct).length > 1 && q.type === 'quiz') notes.push('כמה תשובות סומנו כנכונות');
    q.notes = notes;
    out.push(q);
  }
  fillIn(out);
  return out.map(({ _single, _noAnswer, _group, ...q }) => q);
}

// ---------- filling in what is missing ----------
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// close but wrong numbers: years ±1..±30, small numbers ±1..3, big numbers ±10..30%
function numberDistractors(v) {
  const x = Number(String(v).replace(',', '.'));
  const dec = (String(v).split(/[.,]/)[1] || '').length;
  const set = new Set();
  const isYear = Number.isInteger(x) && x >= 1000 && x <= 2100;
  const steps = isYear ? [1, 2, 3, 5, 10, 15, 20, 30] : Math.abs(x) <= 12 ? [1, 2, 3, 4] : [0.1, 0.2, 0.25, 0.3, 0.5].map((f) => Math.max(1, Math.round(Math.abs(x) * f)));
  for (const s of shuffle(steps.slice())) {
    for (const sign of shuffle([1, -1])) {
      const y = +(x + sign * s).toFixed(dec);
      if (y !== x && (x < 0 || y >= 0)) set.add(String(y));
      if (set.size >= 3) break;
    }
    if (set.size >= 3) break;
  }
  return [...set].slice(0, 3);
}

function fillIn(list) {
  // wrong answers come from the same word list first, then from other questions (never true/false words)
  const rightOf = (q) => (q.answers.find((a) => a.correct) || q.answers[0]).text;
  const usable = list.filter((q) => q.answers.length && q.type === 'quiz');
  const pool = usable.map(rightOf).filter(Boolean);
  const groupPool = (g) => usable.filter((q) => q._group === g).map(rightOf);
  for (const q of list) {
    if (!q.answers.length) continue;
    // only the right answer was given: add wrong ones
    if (q.answers.length === 1 && q.type === 'quiz') {
      const right = q.answers[0].text;
      let wrong = [];
      if (isNum(right)) wrong = numberDistractors(right);
      else {
        const fit = (t) => t !== right && !isNum(t) && Math.abs(t.length - right.length) <= Math.max(8, right.length);
        const near = q._group !== undefined ? shuffle([...new Set(groupPool(q._group).filter(fit))]) : [];
        const far = shuffle([...new Set(pool.filter(fit))]).filter((t) => !near.includes(t));
        wrong = [...near, ...far].slice(0, 3);
      }
      if (wrong.length >= 1) {
        q.answers = shuffle([{ text: right, correct: true }, ...wrong.map((t) => ({ text: t, correct: false }))]);
        q.notes.push(isNum(right) ? 'נוספו מסיחים מספריים: בדקו אותם' : 'נוספו מסיחים מתשובות אחרות: בדקו שהם הגיוניים');
      } else {
        q.type = 'type';
        q.accept = [right];
        delete q.answers;
        q.notes.push('אין מספיק תשובות למסיחים: הפכנו לשאלת הקלדה');
      }
    }
    // longer text needs more time to read
    const len = (q.text || '').length + (q.answers ? q.answers.reduce((s, a) => s + a.text.length, 0) : 0);
    q.time = q.type === 'type' ? 30 : len > 160 ? 45 : len > 90 ? 30 : 20;
    q.points = 1;
  }
}

module.exports = { parse, toText, numberDistractors, aiNormalize };
