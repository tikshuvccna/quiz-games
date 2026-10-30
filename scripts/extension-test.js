// The Kahoot browser extension: node scripts/extension-test.js (no server needed)
//   - the manifest and the files it names
//   - the API library against a faked Kahoot (search, errors, missing pictures, rate limit)
//   - the zip it builds goes through the program's real importer
// LIVE=1 node scripts/extension-test.js also searches the real Kahoot and exports two real public quizzes.
const fs = require('fs');
const os = require('os');
const path = require('path');
const JSZip = require('jszip');
const Q = require('../server/quizzes');
const Library = require('../server/library');
const K = require('../extension/lib/kahoot-api');

const EXT = path.join(__dirname, '..', 'extension');
const CONFIG = path.join(__dirname, '..', 'config.json');
const hadConfig = fs.existsSync(CONFIG);
const oldConfig = hadConfig ? fs.readFileSync(CONFIG) : null;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qg-ext-'));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

let failed = 0;
const check = (name, ok, extra) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || extra === undefined ? '' : '  → ' + JSON.stringify(extra)}`);
};

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const U_PRIVATE = '33333333-3333-4333-8333-333333333333';
const U_GONE = '44444444-4444-4444-8444-444444444444';
const base = { video: { startTime: 0, endTime: 0, service: 'youtube', fullUrl: '' }, media: [] };
const quiz = (uuid, title, qs) => ({ uuid, title, creator_username: 'teacher', language: 'Hebrew', questions: qs });
const QUIZZES = {
  [U1]: quiz(U1, 'חידון בדיקה', [
    { ...base, type: 'quiz', question: 'שאלה עם תמונה', time: 20000, image: 'https://media.kahoot.it/picA', imageMetadata: { id: 'picA', width: 10, height: 10 }, choices: [{ answer: 'כן', correct: true }, { answer: 'לא', correct: false }] },
    { ...base, type: 'quiz', question: 'תשובות בתמונות', time: 20000, choices: [{ answer: '', correct: true, image: { id: 'picB' } }, { answer: '', correct: false, image: { id: 'picC' } }] },
    { ...base, type: 'word_cloud', question: 'מילה אחת', time: 20000 },
  ]),
  [U2]: quiz(U2, 'Second quiz', [{ ...base, type: 'quiz', question: 'Uses picA too', time: 20000, image: 'https://media.kahoot.it/picA', imageMetadata: { id: 'picA' }, choices: [{ answer: 'a', correct: true }, { answer: 'b', correct: false }] }]),
};

// a fake Kahoot: counts what was asked
function fakeKahoot() {
  const calls = { quiz: 0, image: 0, search: 0 };
  const res = (status, body, type) => ({ ok: status < 400, status, headers: { get: () => type || 'application/json' }, json: async () => body, arrayBuffer: async () => body });
  const f = async (url) => {
    url = String(url);
    if (url.startsWith('https://create.kahoot.it/rest/kahoots/?')) {
      calls.search++;
      const p = new URL(url).searchParams;
      const cursor = Number(p.get('cursor'));
      const all = Array.from({ length: 7 }, (_, i) => ({ card: { type: i === 3 ? 'course' : 'quiz', uuid: `aaaaaaa${i}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`, title: `result ${i}`, number_of_questions: 5 + i, creator_username: 'u' + i, cover: 'https://media.kahoot.it/c' + i } }));
      const page = all.slice(cursor, cursor + Number(p.get('limit')));
      return res(200, { entities: page, totalHits: 7, cursor: String(cursor + page.length) });
    }
    if (url.startsWith('https://create.kahoot.it/rest/kahoots/')) {
      calls.quiz++;
      const id = url.split('/').pop();
      if (id === U_PRIVATE) return res(403, {});
      if (id === U_GONE) return res(404, {});
      return QUIZZES[id] ? res(200, QUIZZES[id]) : res(500, {});
    }
    if (url.startsWith('https://media.kahoot.it/')) {
      calls.image++;
      const id = url.split('/').pop();
      if (id === 'picC') return res(404, null);
      return res(200, PNG.buffer.slice(PNG.byteOffset, PNG.byteOffset + PNG.length), 'image/png');
    }
    return res(404, {});
  };
  return { f, calls };
}

(async () => {
  try {
    Q.setFolder(tmp);

    // ---------- manifest ----------
    const mf = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
    check('manifest: version 3 with name, version and a background worker', mf.manifest_version === 3 && mf.name && mf.version && mf.background.service_worker === 'background.js');
    const files = [mf.background.service_worker, ...Object.values(mf.icons), ...Object.values(mf.action.default_icon), 'app.html', 'app.js', 'app.css', 'lib/jszip.min.js', 'lib/kahoot-api.js'];
    check('manifest: every file it (and the page) names exists', files.every((f) => fs.existsSync(path.join(EXT, f))), files.filter((f) => !fs.existsSync(path.join(EXT, f))));
    check('manifest: only the permissions it needs, Kahoot hosts, optional access for other addresses', mf.permissions.join() === 'scripting,storage' && mf.host_permissions.some((h) => h.includes('create.kahoot.it')) && mf.host_permissions.some((h) => h.includes('media.kahoot.it')) && mf.optional_host_permissions.length > 0, [mf.permissions, mf.host_permissions]);
    const html = fs.readFileSync(path.join(EXT, 'app.html'), 'utf8');
    check('page: loads only its own scripts (no remote code)', [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].every((m) => !/^https?:/.test(m[1])) && !/<script(?![^>]*src)/.test(html));
    for (const f of ['app.js', 'background.js', 'lib/kahoot-api.js']) { try { new Function(fs.readFileSync(path.join(EXT, f), 'utf8')); check(`syntax: ${f}`, true); } catch (e) { check(`syntax: ${f}`, false, e.message); } }

    // ---------- search ----------
    const { f, calls } = fakeKahoot();
    const s1 = await K.search('חידון', { fetch: f, limit: 5 });
    check('search: only quizzes are kept (a course is dropped), fields mapped', s1.items.length === 4 && !s1.items.some((x) => x.title === 'result 3') && s1.items[0].title === 'result 0' && s1.items[0].questions === 5 && s1.items[0].author === 'u0' && s1.items[0].cover.endsWith('/c0'), s1);
    check('search: paging says there is more, and where to continue', s1.more === true && s1.next === 5 && s1.total === 7);
    const s3 = await K.search('חידון', { fetch: f, limit: 3, cursor: 6 });
    check('search: the last page says there is no more', s3.more === false && s3.items.length === 1);

    // ---------- errors ----------
    const e = async (uuid) => { try { await K.getQuiz(uuid, { fetch: f }); } catch (x) { return x; } };
    check('errors: private quiz', (await e(U_PRIVATE)).code === 'private');
    check('errors: missing quiz', (await e(U_GONE)).code === 'missing');
    check('errors: not a uuid', (await e('hello')).code === 'bad');
    const rate = await e('55555555-5555-4555-8555-555555555555');
    check('errors: an unknown server error is reported', rate && rate.code === 'http');
    const offline = async () => { throw new TypeError('Failed to fetch'); };
    try { await K.search('x', { fetch: offline }); check('errors: no internet', false); } catch (x) { check('errors: no internet', x.code === 'network'); }

    // ---------- pictures ----------
    check('imageIds: question picture, answer pictures, once each', K.imageIds(QUIZZES[U1]).sort().join() === 'picA,picB,picC', K.imageIds(QUIZZES[U1]));

    // ---------- export ----------
    const steps = [];
    const before = { ...calls };
    const r = await K.buildExport([U1, U2, U1, U_PRIVATE, U_GONE], { fetch: f, JSZip, pause: 0, onProgress: (p) => steps.push(p.phase) });
    check('export: two quizzes, the duplicate asked once, two failures reported', r.quizzes === 2 && r.failed.length === 2 && calls.quiz - before.quiz === 4, [r.quizzes, r.failed.map((x) => x.code), calls.quiz - before.quiz]);
    check('export: each picture downloaded once (shared picA), one missing', calls.image - before.image >= 3 && r.images === 2 && r.missingImages === 1, [calls.image, r.images, r.missingImages]);
    check('export: progress reports quizzes, images and packing', ['quiz', 'image', 'pack'].every((p) => steps.includes(p)));
    const zip = await JSZip.loadAsync(r.data);
    const man = JSON.parse(await zip.file('manifest.json').async('string'));
    check('zip: manifest for the program', man.app === 'kahoot-export' && man.version === 1 && man.quizzes.length === 2 && man.quizzes[0].file === `quizzes/${U1}.json`, man);
    check('zip: the quiz JSON is untouched', JSON.parse(await zip.file(`quizzes/${U1}.json`).async('string')).questions[0].question === 'שאלה עם תמונה');
    check('zip: pictures are named by id', !!zip.file('images/picA.png') && !!zip.file('images/picB.png') && !zip.file('images/picC.png'));
    const rl = await K.buildExport(['66666666-6666-4666-8666-666666666666', U1], { fetch: async (u) => (String(u).includes('/rest/kahoots/66666666') ? { ok: false, status: 429, headers: { get: () => '' } } : f(u)), JSZip, pause: 0 });
    check('export: a rate-limit answer stops asking for more', rl.quizzes === 0 && rl.failed.length === 1 && rl.failed[0].code === 'rate', rl.failed);

    // ---------- the program imports it ----------
    const imp = await Library.importAny(Buffer.from(r.data), 'ext');
    check('import: the extension\'s zip imports as a folder of 2 quizzes', imp.kind === 'folder' && imp.quizzes === 2 && imp.images === 2, imp);
    const first = Q.list().find((x) => x.title === 'חידון בדיקה');
    const loaded = Q.load(first.id);
    check('import: the picture is stored, the cloud question kept', loaded.questions.length === 2 && loaded.questions[0].image && Q.mediaPath(first.id, loaded.questions[0].image) && loaded.questions[1].type === 'cloud', loaded.questions.map((x) => x.type));
    check('import: a picture-answer question that lost a picture is skipped and says why', imp.issues.some((i) => i.level === 'skip' && /פחות משתי תשובות/.test(i.reason)), imp.issues);
    check('import: the missing picture is reported', imp.issues.some((i) => /לא צורפו/.test(i.reason)));
    check('import: source kept', loaded.source && loaded.source.site === 'kahoot' && loaded.source.id === U1);

    // ---------- the real Kahoot (only with LIVE=1) ----------
    if (process.env.LIVE) {
      const live = await K.search('history', { limit: 40 });
      check('LIVE search: results with titles and covers', live.items.length > 0 && live.total > 100 && live.items.every((x) => x.title && x.uuid), live.items.length);
      const he = await K.search('מתמטיקה', { limit: 4 });
      check('LIVE Hebrew search works', he.items.length > 0, he);
      const pick = live.items.filter((x) => x.questions > 0 && x.questions <= 12).slice(0, 2).map((x) => x.uuid);
      check('LIVE: found two small quizzes to export', pick.length === 2, live.items.map((x) => x.questions));
      const lr = await K.buildExport(pick, { JSZip });
      check('LIVE export of 2 public quizzes', lr.quizzes === pick.length && lr.failed.length === 0, [lr.quizzes, lr.failed]);
      const li = await Library.importAny(Buffer.from(lr.data), 'live');
      check('LIVE import into the program', (li.kind === 'quiz' || li.kind === 'folder') && li.count > 0, li);
    }
  } finally {
    if (hadConfig) fs.writeFileSync(CONFIG, oldConfig);
    else fs.rmSync(CONFIG, { force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
