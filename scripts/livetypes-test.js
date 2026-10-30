// Classic quiz with the live question types (poll with several choices, word cloud, free text, brainstorm with
// its vote, drop a pin, picture answers, a slide with text). node scripts/livetypes-test.js
// Needs a running server (QG_URL, default http://localhost:3000). It saves one quiz and deletes it at the end.
const { io } = require('socket.io-client');
const URL = process.env.QG_URL || 'http://localhost:3000';
let failed = 0;
const ok = (c, m, extra) => {
  if (!c) failed++;
  console.log(c ? '  ✔' : '  ✘ FAIL', m, c || extra === undefined ? '' : JSON.stringify(extra));
};
const api = async (path, method = 'GET', body) => {
  const r = await fetch(URL + '/api/q' + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return r.json();
};
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

(async () => {
  const quiz = await api('/quizzes', 'POST', { title: 'live types test' });
  const media = await (await fetch(`${URL}/api/q/quizzes/${quiz.id}/media`, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: PNG })).json();
  await api('/quizzes/' + quiz.id, 'PUT', {
    title: 'live types test',
    questions: [
      { type: 'slide', text: 'Welcome', body: 'Line one\nLine two', time: 5, points: 0 },
      { type: 'poll', text: 'Pick snacks', multi: true, time: 10, answers: [{ text: 'chips' }, { text: 'fruit' }, { text: '', image: media.name }] },
      { type: 'cloud', text: 'One word', time: 10, limit: 2 },
      { type: 'open', text: 'Say anything', time: 10, limit: 2 },
      { type: 'brain', text: 'Ideas', time: 10, limit: 2 },
      { type: 'drop', text: 'Drop a pin', time: 10, image: media.name },
      { type: 'rate', text: 'How was it?', time: 10, scale: { max: 5, low: 'bad', high: 'great' } },
      { type: 'rank', text: 'Rank these', time: 10, items: ['red', 'green', 'blue'] },
      { type: 'qna', text: 'Ask the class', time: 10, limit: 1 },
      { type: 'quiz', text: 'Which picture?', time: 10, answers: [{ text: '', image: media.name, correct: true }, { text: 'nope' }] },
    ],
  });

  const host = io(URL);
  let hs = null;
  const seen = { stages: new Set(), reveals: {} };
  let last = '';
  host.on('host:state', (s) => {
    hs = s;
    const b = s.board;
    if (s.phase !== 'playing' || !b) return;
    const key = b.stage + b.index;
    if (key === last) return;
    last = key;
    seen.stages.add(b.stage);
    if (b.reveal && b.q) seen.reveals[b.q.type] = b.reveal;
    if (b.stage === 'vote') seen['vote_' + b.q.type] = b;
    // the host moves on at every stage except while players answer or vote (those end when everyone answered)
    if (b.stage !== 'question' && b.stage !== 'vote') setTimeout(() => host.emit('host:next'), 200);
  });
  const r = await new Promise((res) => host.emit('host:create', { game: 'classic' }, res));
  host.emit('host:setup', { quiz: quiz.id });
  // nicknames: a rude one is refused, a normal one is fine
  const probe = io(URL);
  const bad = await new Promise((res) => probe.emit('player:join', { pin: r.pin, name: 'f u c k' }, res));
  ok(bad && bad.ok === false && /לא מתאים/.test(bad.error), 'a rude nickname is refused', bad);
  probe.close();
  host.emit('host:settings', { advance: 'manual' });
  await new Promise((res) => setTimeout(res, 300));

  const phones = ['נועה', 'דני', 'מיה', 'יובל'].map((name, k) => {
    const s = io(URL);
    s.id2 = name;
    s.seenPhases = new Set();
    s.on('you', (y) => {
      s.me = y;
      s.seenPhases.add(y.phase);
      const act = (type, data) => setTimeout(() => s.emit('player:action', { type, data: { ...data, qid: y.qid } }), 80 + k * 40);
      if (y.phase === 'c_question') {
        const q = y.question;
        if (q.type === 'poll') act('answer', { choices: k % 2 ? [0, 1] : [2] });
        else if (q.type === 'cloud') act('answer', { words: k < 3 ? ['שלום', 'כיף'] : ['שלום'] });
        else if (q.type === 'rate') act('answer', { value: k + 2 });
        else if (q.type === 'rank') act('answer', { order: (k === 3 ? ['blue', 'green', 'red'] : ['red', 'green', 'blue']).map((n) => y.question.items.indexOf(n)) });
        else if (q.type === 'qna') act('answer', { words: [`question ${k}`] });
        else if (q.type === 'open') act('answer', { words: k === 0 ? ['כוס אמק', 'תשובה נורמלית'] : [`תשובה ${k}`] });
        else if (q.type === 'brain') act('answer', { words: [`רעיון ${k}`, `רעיון ${k}ב`] });
        else if (q.type === 'drop') act('answer', { x: 10 + k * 20, y: 40 });
        else if (q.type === 'quiz') act('answer', { choice: q.options.indexOf('') });
      }
      if (y.phase === 'c_vote') {
        s.sawVote = y;
        s.votes = (s.votes || 0) + 1;
        // vote for the first idea that is not mine (the list never contains my own)
        act('vote', { ideas: y.ideas.slice(0, 2).map((x) => x.i) });
      }
    });
    s.emit('player:join', { pin: r.pin, name }, () => {});
    return s;
  });
  await new Promise((res) => setTimeout(res, 500));
  host.emit('host:start');
  const t0 = Date.now();
  while (Date.now() - t0 < 120000 && (!hs || hs.phase !== 'ended')) await new Promise((res) => setTimeout(res, 300));
  ok(hs && hs.phase === 'ended', `game ended (${Math.round((Date.now() - t0) / 1000)}s)`);
  ok(seen.stages.has('slide') && seen.stages.has('vote') && seen.stages.has('reveal'), `stages seen: ${[...seen.stages]}`);

  const P = seen.reveals.poll;
  ok(P && P.dist && P.dist[0] === 2 && P.dist[1] === 2 && P.dist[2] === 2 || (P && P.dist.reduce((a, b) => a + b, 0) === 6), 'multi poll counts every choice', P && P.dist);
  const C = seen.reveals.cloud;
  ok(C && C.words[0].text === 'שלום' && C.words[0].n === 4 && C.words.find((w) => w.text === 'כיף').n === 3, 'word cloud counts words across players', C && C.words);
  const O = seen.reveals.open;
  ok(O && O.texts.length === 4 && O.texts.every((t) => t.by) && !O.texts.some((t) => t.text === 'כוס אמק') && O.hidden === 1, 'free text lists every answer with its author, the rude one is hidden and counted', O && [O.texts, O.hidden]);
  const R = seen.reveals.rate;
  ok(R && R.rate.max === 5 && R.rate.avg === 3.5 && R.rate.dist.join() === '0,1,1,1,1', 'rating: distribution and average', R && R.rate);
  const K = seen.reveals.rank;
  ok(K && K.rank.length === 3 && K.rank[0].text === 'red' && K.rank[0].score === 10 && K.rank[2].score === 6, 'ranking: the class favorite comes first (3 first-places + 1 last)', K && K.rank);
  const QA = seen.reveals.qna;
  ok(QA && QA.ideas.length === 4 && QA.voters === 4 && QA.ideas.reduce((s, x) => s + x.votes, 0) === 8, 'Q&A: 4 questions went to the vote and were ranked', QA && QA.ideas);
  const B = seen.reveals.brain;
  ok(seen.vote_brain && seen.vote_brain.ideas.length === 8, 'brainstorm: 8 ideas went to the vote', seen.vote_brain && seen.vote_brain.ideas);
  ok(B && B.ideas.length === 8 && B.voters === 4 && B.ideas.reduce((s, x) => s + x.votes, 0) === 8, 'brainstorm: 4 voters, 2 votes each, ranked', B && B.ideas);
  ok(phones.every((p) => p.votes >= 2), 'every phone got both vote screens (ideas and questions)', phones.map((p) => p.votes));
  const D = seen.reveals.drop;
  ok(D && D.pins.length === 4 && D.pins[0].length === 2, 'drop pin: 4 pins, no right/wrong', D && D.pins);
  ok(seen.reveals.quiz && seen.reveals.quiz.correct.length === 1 && seen.reveals.quiz.dist.reduce((a, b) => a + b, 0) === 4, 'picture answers are graded', seen.reveals.quiz);
  const res = hs.results;
  ok(res && res.players.every((p) => p.correct === 1 && p.wrong === 0), 'only the real quiz question was scored', res && res.players);
  ok(seen.reveals.rank && seen.reveals.rate && seen.reveals.qna, 'rating, ranking and Q&A all reached a reveal');
  ok(phones.every((p) => p.seenPhases.has('c_result')), 'phones got a result screen after live questions');

  await api('/quizzes/' + quiz.id, 'DELETE');
  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
