// Bad-word filter for nicknames and for text the players type (shown on the big screen).
// The word list is server/badwords.json (the teacher can edit it). Matching ignores case, spacing, symbols,
// repeated letters, Hebrew vowel marks and final letters, and undoes common tricks (f.u.c.k, sh1t, פפפאאקק).
const fs = require('fs');
const path = require('path');

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i', '|': 'i' };
const FINAL = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

// text → lowercase letters only (Hebrew / Latin), tricks undone, repeats collapsed
function squeeze(s) {
  return String(s || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[֑-ׇ̀-ͯ]/g, '')
    .replace(/[ךםןףץ]/g, (c) => FINAL[c])
    .replace(/[0134578@$!|]/g, (c) => LEET[c] || c)
    .replace(/[^a-zא-ת]/g, '')
    .replace(/(.)\1+/g, '$1');
}

// same, but keeps the word boundaries
function tokens(s) {
  return String(s || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[֑-ׇ̀-ͯ]/g, '')
    .replace(/[ךםןףץ]/g, (c) => FINAL[c])
    .split(/[^0-9a-zא-ת@$!|]+/)
    .map(squeeze)
    .filter(Boolean);
}

let words = { whole: new Set(), inside: [], allow: new Set() };

function load() {
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'badwords.json'), 'utf8'));
  } catch {}
  const list = [...(raw.he || []), ...(raw.en || [])].map(squeeze).filter(Boolean);
  words = { whole: new Set(list), inside: list.filter((w) => w.length >= 4), allow: new Set((raw.allow || []).map(squeeze)) };
}
load();

// is this text (a name, an answer) something we should not show?
function bad(text) {
  if (!text) return false;
  const toks = tokens(text);
  const hit = (t) => t && !words.allow.has(t) && (words.whole.has(t) || words.inside.some((w) => t.includes(w)));
  // a listed word, alone or glued to other letters
  if (toks.some(hit)) return true;
  // letters spaced out: "f u c k", "ז ו נ ה"
  let run = '';
  for (const t of toks) {
    if (t.length <= 2) run += t;
    else {
      if (hit(run)) return true;
      run = '';
    }
  }
  if (hit(run)) return true;
  // a listed phrase of 2-3 words ("בן זונה", "כוס אמק")
  for (let i = 0; i < toks.length; i++) for (let n = 2; n <= 3 && i + n <= toks.length; n++) if (words.whole.has(toks.slice(i, i + n).join(''))) return true;
  return false;
}

module.exports = { bad, reload: load, squeeze };
