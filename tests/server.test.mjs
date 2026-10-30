import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NOW = '2026-10-29T12:00:00';
process.env.NODE_ENV = 'production';
process.env.RENDER = 'rebuild';
const { start } = await import('../server.mjs');

let server;
let base;
before(async () => { server = await start(0); base = `http://localhost:${server.address().port}`; });
after(() => server.close());

const get = (p, opts) => fetch(base + p, opts);

test('every route of the original answers with the same status', async () => {
  const expected = {
    '/': 200, '/on-track': 200, '/off-track': 200, '/calendar': 200,
    '/legal/terms-conditions': 200, '/legal/privacy-policy': 200,
    '/partnerships': 404, '/does-not-exist': 404,
  };
  for (const [p, status] of Object.entries(expected)) {
    const res = await get(p);
    assert.equal(res.status, status, p);
    assert.match(res.headers.get('content-type'), /text\/html/);
  }
});

test('404 page offers the way home and the four helmet styles', async () => {
  const html = await (await get('/partnerships')).text();
  assert.match(html, /Page Not Found/);
  assert.match(html, /Veered off track/);
  assert.equal((html.match(/data-gl-switcher=/g) || []).length, 4);
});

test('trailing slash is accepted', async () => {
  assert.equal((await get('/calendar/')).status, 200);
});

test('static, vendor and font assets are served with types', async () => {
  for (const [p, type] of [['/css/site.css', 'text/css'], ['/js/app.mjs', 'text/javascript'], ['/vendor/gsap/index.js', 'text/javascript'],
    ['/vendor/lenis/lenis.mjs', 'text/javascript'], ['/assets/fonts/67b6113a220f85ad6497495a_Brier-Bold.woff2', 'font/woff2']]) {
    const res = await get(p);
    assert.equal(res.status, 200, p);
    assert.match(res.headers.get('content-type'), new RegExp(type));
  }
});

test('path traversal is refused', async () => {
  for (const p of ['/vendor/gsap/..%2F..%2Fpackage.json', '/..%2Fserver.mjs', '/assets/..%2F..%2Fserver.mjs']) {
    const res = await get(p);
    assert.notEqual(res.status, 200, p);
  }
});

test('only GET and HEAD are allowed', async () => {
  assert.equal((await get('/', { method: 'POST' })).status, 405);
  const head = await get('/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('season API matches the original on 2026-10-29', async () => {
  const s = await (await get('/api/season')).json();
  assert.equal(s.round, 19);
  assert.equal(s.standing, 6);
  assert.equal(s.age, 26);
  assert.equal(s.previous.name, '2026 United States Grand Prix');
  assert.equal(s.previous.finish, '5th');
  assert.equal(s.next.circuitId, 'mexico-city');
});

test('home shows the next race and on-track shows previous/next blocks', async () => {
  const home = await (await get('/')).text();
  assert.match(home, /Next Race[\s\S]*Mexico gp/);
  const ot = await (await get('/on-track')).text();
  assert.match(ot, /previous[\s\S]*United States gp/);
  assert.match(ot, /Rnd\. 19/);
  assert.match(ot, /data-countdown-date-target>1\/11\/2026 20:00</);
  assert.match(ot, /26 y\.o/);
});

test('on-track upcoming list holds only future races (5 on 2026-10-29)', async () => {
  const ot = await (await get('/on-track')).text();
  const list = ot.slice(ot.indexOf('data-mouse-area="schedule"'));
  assert.equal((list.match(/class="race-row is-upcoming/g) || []).length, 5);
});

test('calendar splits past and upcoming rows and marks the past ones', async () => {
  const html = await (await get('/calendar')).text();
  assert.equal((html.match(/class="race-row is-previous is-in-past"/g) || []).length, 19);
  assert.equal((html.match(/class="race-row is-upcoming"/g) || []).length, 5);
  assert.equal((html.match(/data-calendar-history="item"/g) || []).length, 7);
});

test('visualiser starts on the current race with sprint labels when needed', async () => {
  const html = await (await get('/calendar')).text();
  const vis = html.slice(html.indexOf('id="track-vis"'), html.indexOf('id="calendar-upcoming"'));
  assert.match(vis, /data-cal-target="circuit-lap-length">4\.304</);
  assert.match(vis, /data-cal-target-label="practice2">Practice 2</);
  assert.match(vis, /20 \/ 24/);
});

test('a date after the season shows the last race as past with results', async () => {
  const { renderPage } = await import('../src/render.mjs');
  const html = renderPage({ page: 'calendar' }, new Date(2027, 0, 10));
  assert.equal((html.match(/class="race-row is-upcoming"/g) || []).length, 0);
  const vis = html.slice(html.indexOf('id="track-vis"'), html.indexOf('id="calendar-upcoming"'));
  assert.match(vis, /24 \/ 24/);
  assert.doesNotMatch(vis, /data-cal-target="past-reveal" hidden/);
});

test('JSON API endpoints', async () => {
  assert.equal((await (await get('/api/races')).json()).length, 24);
  assert.equal((await (await get('/api/history')).json()).length, 7);
  assert.equal((await (await get('/api/helmets')).json()).length, 16);
  assert.equal((await (await get('/api/highlights')).json()).length, 7);
  assert.equal((await get('/api/nope')).status, 404);
});
