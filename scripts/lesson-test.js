// The lesson game: slides, PDF pages, activities in between, reactions, back / jump. node scripts/lesson-test.js (server running)
const { io } = require('socket.io-client');
const { makePdf } = require('./make-pdf');
const URL = process.env.QG_URL || 'http://localhost:3000';
let failed = 0;
const ok = (c, m, extra) => {
  if (!c) failed++;
  console.log(c ? '  ✔' : '  ✘ FAIL', m, c || extra === undefined ? '' : JSON.stringify(extra));
};
const api = async (p, method = 'GET', body) => (await fetch(URL + '/api/q' + p, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const quiz = await api('/quizzes', 'POST', { title: 'lesson test' });
  const up = await (await fetch(`${URL}/api/q/quizzes/${quiz.id}/media`, { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: makePdf(['Intro', 'Cells', 'Energy']) })).json();
  ok(up.name && up.name.endsWith('.pdf'), 'a PDF can be uploaded to a quiz', up);
  const res = await fetch(`${URL}/media/${quiz.id}/${up.name}`);
  ok(res.status === 200 && /pdf/.test(res.headers.get('content-type')) && (await res.arrayBuffer()).byteLength > 500, 'the PDF is served back');
  const pdfjs = await fetch(URL + '/vendor/pdfjs/pdf.min.mjs');
  ok(pdfjs.status === 200 && /javascript/.test(pdfjs.headers.get('content-type')), 'PDF.js is served by the program (works offline)', pdfjs.headers.get('content-type'));

  const steps = [
    { type: 'slide', text: 'Welcome', layout: 'bullets', bullets: ['What cells are', 'What they do'], body: 'Biology 101', notes: 'say hi' }, // 0
    { type: 'pdf', text: 'Cells', pdf: { file: up.name, page: 2 } }, // 1
    { type: 'pdf', pdf: { file: up.name, page: 3 } }, // 2
    { type: 'poll', text: 'Did you understand?', time: 20, answers: [{ text: 'Yes' }, { text: 'Kind of' }, { text: 'No' }] }, // 3
    { type: 'quiz', text: 'What does the page show?', time: 20, pdf: { file: up.name, page: 3 }, source: { doc: 'Biology book', loc: 'p. 12', quote: 'Energy comes from food' }, answers: [{ text: 'Energy', correct: true }, { text: 'Cells' }], explain: 'Look at the title.' }, // 4
    { type: 'tap', text: 'Tap race!', time: 5 }, // 5
    { type: 'slide', text: 'Break time', layout: 'fun', timer: 30 }, // 6
  ];
  await api('/quizzes/' + quiz.id, 'PUT', { title: 'lesson test', questions: steps });
  const saved = await api('/quizzes/' + quiz.id);
  ok(saved.questions.length === 7 && saved.questions[1].pdf.page === 2 && saved.questions[0].bullets.length === 2 && saved.questions[4].source.doc === 'Biology book' && saved.questions[6].timer === 30, 'the lesson is saved with every field', saved.questions.map((q) => q.type));

  const host = io(URL);
  let hs = null;
  host.on('host:state', (s) => (hs = s));
  const room = await new Promise((res) => host.emit('host:create', { game: 'lesson' }, res));
  host.emit('host:setup', { quiz: quiz.id });
  host.emit('host:settings', { scoring: 'none' });
  await wait(300);
  const phases = [];
  const names = ['דנה', 'יוסי', 'נועה'];
  const bots = names.map((name, k) => {
    const s = io(URL);
    s.on('you', (y) => {
      s.me = y;
      if (k === 0) phases.push(y.phase);
      if (y.phase === 'c_question') {
        const q = y.question;
        if (q.type === 'poll') setTimeout(() => s.emit('player:action', { type: 'answer', data: { choice: k % 2, qid: y.qid } }), 60);
        else if (q.type === 'quiz') setTimeout(() => s.emit('player:action', { type: 'answer', data: { choice: q.options.indexOf('Energy'), qid: y.qid } }), 60);
        else if (q.type === 'tap') {
          s.question = q;
          // dana taps 20, yossi 35, noa claims an impossible 99999 (must be capped)
          const n = k === 0 ? 20 : k === 1 ? 35 : 99999;
          setTimeout(() => s.emit('player:action', { type: 'answer', data: { taps: Math.round(n / 2), qid: y.qid } }), 100);
          setTimeout(() => s.emit('player:action', { type: 'answer', data: { taps: n, qid: y.qid } }), 300);
          setTimeout(() => s.emit('player:action', { type: 'answer', data: { taps: 1, qid: y.qid } }), 500); // a late smaller count is ignored
        }
      }
    });
    s.emit('player:join', { pin: room.pin, name }, () => {});
    return s;
  });
  await wait(500);
  const until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (hs && hs.board && fn(hs.board)) return true; await wait(80); } return false; };
  const next = () => host.emit('host:next');
  host.emit('host:start');

  // 0: a slide opens at once (no "get ready" stage) and the phones get the reaction screen
  ok(await until((b) => b.stage === 'slide' && b.index === 0), 'the first slide opens straight away (no get-ready stage)');
  ok(hs.board.q.layout === 'bullets' && hs.board.q.bullets.length === 2 && !hs.board.q.notes, 'the big screen gets the layout and bullets, not the teacher notes', hs.board.q);
  ok(hs.board.lesson.outline.length === 7 && /Welcome/.test(hs.board.lesson.outline[0]) && /📄/.test(hs.board.lesson.outline[1]), 'the outline lists every step', hs.board.lesson.outline);
  await wait(300);
  ok(bots[0].me.phase === 'c_slide', 'the phones show the slide screen');
  const react = (k, v) => bots[k].emit('player:action', { type: 'react', data: { value: v, qid: bots[k].me.qid } });
  react(0, 'got'); react(1, 'unsure'); react(2, 'ask');
  await wait(500);
  ok(JSON.stringify(hs.board.lesson.reacts) === JSON.stringify({ got: 1, unsure: 1, ask: 1, n: 3 }), 'the teacher sees every reaction live', hs.board.lesson.reacts);
  react(1, 'got');
  await wait(300);
  ok(hs.board.lesson.reacts.got === 2 && hs.board.lesson.reacts.unsure === 0 && bots[1].me.react === 'got', 'a student can change their reaction');
  bots[0].emit('player:action', { type: 'react', data: { value: 'bogus', qid: bots[0].me.qid } });
  await wait(200);
  ok(hs.board.lesson.reacts.n === 3, 'an invalid reaction is ignored');

  // 1, 2: PDF pages, then back and forward
  next();
  ok(await until((b) => b.stage === 'slide' && b.index === 1), 'a PDF page is a step');
  ok(hs.board.q.type === 'pdf' && hs.board.q.pdf.page === 2 && /\/media\/.*\.pdf$/.test(hs.board.q.pdf.url), 'its payload points at the PDF and the page', hs.board.q);
  next();
  ok(await until((b) => b.index === 2), 'next page');
  host.emit('host:cmd', { cmd: 'prev' });
  ok(await until((b) => b.index === 1 && b.stage === 'slide'), 'back one step');
  host.emit('host:cmd', { cmd: 'goto', arg: 3 });
  ok(await until((b) => b.index === 3 && (b.stage === 'ready' || b.stage === 'question')), 'jump to any step');
  host.emit('host:cmd', { cmd: 'goto', arg: 99 });
  host.emit('host:cmd', { cmd: 'bogus' });
  await wait(300);
  ok(hs.board.index === 3, 'a jump outside the lesson is ignored');

  // 3: the poll (activities have a short get-ready)
  ok(await until((b) => b.stage === 'question' && b.index === 3), 'the poll opens after a short get-ready');
  await wait(600);
  next(); // close the poll
  ok(await until((b) => b.stage === 'reveal'), 'reveal');
  ok(hs.board.reveal.dist.join() === '2,1,0' || hs.board.reveal.dist.reduce((a, b) => a + b, 0) === 3, 'the poll counted everyone', hs.board.reveal.dist);

  // 4: a question about a PDF page, with a citation
  next();
  ok(await until((b) => b.stage === 'question' && b.index === 4, 12000), 'next step: a question on top of a PDF page');
  ok(hs.board.q.pdf && hs.board.q.pdf.page === 3, 'the question carries its PDF page for the big screen', hs.board.q.pdf);
  await wait(500);
  next();
  ok(await until((b) => b.stage === 'reveal' && b.index === 4), 'reveal of the question');
  ok(hs.board.reveal.source && hs.board.reveal.source.doc === 'Biology book' && hs.board.reveal.source.loc === 'p. 12', 'the citation comes with the answer', hs.board.reveal.source);
  await wait(300);
  ok(bots[0].me.source && bots[0].me.source.quote === 'Energy comes from food', 'and reaches the phone');
  ok(hs.board.reveal.right === 3, 'all 3 answered right (without points)');

  // 5: tap race
  next();
  ok(await until((b) => b.stage === 'question' && b.index === 5, 12000), 'the tap race opens');
  await wait(900);
  ok(bots[0].me.phase === 'c_question', 'phones stay on the tap button while the race runs');
  next();
  ok(await until((b) => b.stage === 'reveal' && b.index === 5), 'the race ends');
  const taps = hs.board.reveal.taps;
  ok(taps && taps[0].name === 'נועה' && taps[0].taps === 70 && taps[1].taps === 35 && taps[2].taps === 20, 'taps are ranked, the impossible count is capped (5s x 14), a late smaller count is ignored', taps);

  // 6: a fun slide with a countdown, then the end
  next();
  ok(await until((b) => b.stage === 'slide' && b.index === 6), 'a fun slide');
  ok(hs.board.q.layout === 'fun' && hs.board.q.timer === 30, 'with its countdown', hs.board.q);
  next();
  const t0 = Date.now();
  while (Date.now() - t0 < 8000 && hs.phase !== 'ended') await wait(100);
  ok(hs.phase === 'ended', 'the lesson ends after the last step');
  const r = hs.results;
  ok(r.style === 'learn' && r.players.every((p) => p.score === 0), 'nothing was scored (the default)', r.players.map((p) => p.score));
  const L = r.lesson.steps;
  const s0 = L.find((s) => s.kind === 'slide' && s.i === 0);
  ok(s0 && s0.got === 2 && s0.ask === 1 && s0.title === 'Welcome', 'the summary knows how the class reacted to each slide', s0);
  ok(L.some((s) => s.kind === 'activity' && s.type === 'poll' && s.answered === 3) && L.some((s) => s.kind === 'activity' && s.type === 'quiz' && s.pct === 100), 'and how each activity went', L.filter((s) => s.kind === 'activity'));

  [host, ...bots].forEach((s) => s.close());
  await api('/quizzes/' + quiz.id, 'DELETE');
  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
