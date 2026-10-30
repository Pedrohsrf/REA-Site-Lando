// Runs the same interaction scenarios on the original site and on the rebuild through a
// Chrome started with --remote-debugging-port=9222, and prints a side-by-side report.
// Usage: node scripts/e2e-compare.mjs [rebuildBase] [originalBase]
// Only read-only interactions are performed (clicks on UI controls, no forms, no purchases).
const [REBUILD = 'http://localhost:3100', ORIGINAL = 'https://landonorris.com'] = process.argv.slice(2);
const CDP = process.env.CDP || 'http://127.0.0.1:9222';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openTab() {
  const t = await (await fetch(`${CDP}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  return {
    async go(url, wait = 7000) { await send('Page.navigate', { url }); await sleep(wait); },
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true });
      if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.exception?.description?.split('\n')[0] };
      return r.result?.result?.value;
    },
    async close() { await fetch(`${CDP}/json/close/${t.id}`); ws.close(); },
  };
}

// Scenarios use only the data-* contracts both implementations share.
const VIS = `
  const w = document.querySelector('[data-cal-track-wrap]');
  const g = (k) => w.querySelector('[data-cal-target="' + k + '"]')?.textContent.trim();
  const lab = (k) => w.querySelector('[data-cal-target-label="' + k + '"]')?.textContent.trim();
  const state = () => ({ circuit: g('circuit-name'), when: g('date-from-to-num') + ' ' + g('date-from-to-month'), laps: g('circuit-lap-amount'),
    p2: lab('practice2'), p3: lab('practice3'), raceDate: g('race-date'), raceTime: g('race-time'), header: g('results'),
    pastReveal: [...w.querySelectorAll('[data-cal-target="past-reveal"]')].some((e) => e.offsetParent !== null || getComputedStyle(e).display === 'block' && !e.hidden),
    active: document.querySelector('[data-cal-item].is-active [data-cal-list="circuit-id"]')?.textContent.trim() });
  const click = async (dir) => { const c = w.querySelector('[data-cal-control="' + dir + '"]'); (c.querySelector('a,button') || c).click(); await new Promise((r) => setTimeout(r, 1800)); };
`;

const scenarios = {
  'calendar: visualiser initial race': ['/calendar', `${VIS} return state();`],
  'calendar: previous x1 (past race shows results)': ['/calendar', `${VIS} await click('previous-item'); return state();`],
  'calendar: sprint weekend relabels sessions (previous x2)': ['/calendar', `${VIS} await click('previous-item'); await click('previous-item'); return state();`],
  'calendar: next from last loops to first': ['/calendar', `${VIS} const n = document.querySelectorAll('[data-cal-wrap] [data-cal-item]').length; for (let i = 0; i < 5; i++) await click('next-item'); return state();`],
  'calendar: past/upcoming item counts': ['/calendar', `return { past: document.querySelectorAll('[data-cal-wrap] [data-cal-item].is-in-past').length, total: document.querySelectorAll('[data-cal-wrap] [data-cal-item]').length };`],
  'calendar: history accordion single-open': ['/calendar', `
    const t = [...document.querySelectorAll('[data-calendar-history="trigger"]')];
    t[0].click(); await new Promise((r) => setTimeout(r, 400)); t[1].click(); await new Promise((r) => setTimeout(r, 400));
    return { expanded: t.map((x) => x.getAttribute('aria-expanded')).slice(0, 3), open: document.querySelectorAll('[data-calendar-history="item"].is-open').length };`],
  'on-track: countdown target and ticking': ['/on-track', `
    const w = document.querySelector('[data-countdown-wrap]'); const d = () => [...w.querySelectorAll('[data-countdown-digit]')].map((x) => x.textContent.trim()).join(':');
    const a = d(); await new Promise((r) => setTimeout(r, 2100)); return { target: w.querySelector('[data-countdown-date-target]').textContent.trim(), ticks: a !== d(), digits: d().split(':').length };`],
  'on-track: position/round formatting': ['/on-track', `
    const p = [...document.querySelectorAll('[data-text-format="position"]')].map((x) => x.innerHTML.replace(/\\s+/g, ' ').replace(/ class="[^"]*"/g, '')).slice(0, 3);
    const r = [...document.querySelectorAll('[data-text-format="round"]')].map((x) => x.textContent.trim()).slice(0, 3);
    return { positionsHaveSuffixMarkup: p.every((h) => /<(span|sup)>/.test(h)), rounds: r };`],
  'on-track: upcoming schedule rows': ['/on-track', `return [...document.querySelectorAll('[data-cal-wrap] [data-cal-item] [data-cal-list="circuit-id"]')].map((x) => x.textContent.trim());`],
  'home: helmets and nav links': ['/', `return { helmets: document.querySelectorAll('[data-helmet-item]').length,
    menu: [...document.querySelectorAll('[data-nav-m] a[href^="/"]')].map((a) => a.getAttribute('href')).filter((h, i, a) => a.indexOf(h) === i) };`],
  'home: menu toggles aria-expanded': ['/', `const b = document.querySelector('[data-nav-ham]'); b.click(); await new Promise((r) => setTimeout(r, 900)); const open = b.getAttribute('aria-expanded'); b.click(); await new Promise((r) => setTimeout(r, 900)); return { open, closed: b.getAttribute('aria-expanded'), label: b.getAttribute('aria-label') };`],
  'navigation: SPA link to /off-track keeps document': ['/', `window.__marker = 1; document.querySelector('a[href="/off-track"]').click(); await new Promise((r) => setTimeout(r, 4500));
    return { path: location.pathname, sameDocument: window.__marker === 1, page: document.querySelector('[data-page]')?.dataset.page };`],
  '404: switcher variants': ['/partnerships', `const b = [...document.querySelectorAll('[data-gl-switcher]')]; b[2]?.click(); await new Promise((r) => setTimeout(r, 300));
    return { count: b.length, active: document.querySelector('[data-gl-switcher].is-active')?.dataset.glSwitcher, title: document.querySelector('h2')?.textContent.trim() };`],
};

const tab = await openTab();
const rows = [];
for (const [name, [path, expr]] of Object.entries(scenarios)) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) continue;
  const out = {};
  for (const [label, base] of [['original', ORIGINAL], ['rebuild', REBUILD]]) {
    await tab.go(base + path, label === 'original' ? 9000 : 5000);
    out[label] = await tab.eval(expr);
  }
  const same = JSON.stringify(out.original) === JSON.stringify(out.rebuild);
  rows.push({ name, same, ...out });
  console.log(`\n### ${name} — ${same ? 'EQUAL' : 'DIFFERENT'}`);
  console.log('original:', JSON.stringify(out.original));
  console.log('rebuild :', JSON.stringify(out.rebuild));
}
await tab.close();
if (process.env.OUT) {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(process.env.OUT, JSON.stringify(rows, null, 2));
}
process.exit(0);
