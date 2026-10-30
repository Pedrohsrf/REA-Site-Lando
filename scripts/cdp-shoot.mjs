// Drives a Chrome started with --remote-debugging-port to screenshot pages at scroll positions
// and report console errors. Used for the equivalence checks in docs/TESTES.md.
// Usage: node scripts/cdp-shoot.mjs <url> <outPrefix> [width] [height] [scrollFractions] [jsBeforeShot]
import { writeFile } from 'node:fs/promises';

const [url, out, width = '1440', height = '900', fractions = '0', pre = ''] = process.argv.slice(2);
const endpoint = process.env.CDP || 'http://127.0.0.1:9222';
const target = await (await fetch(`${endpoint}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
const errors = [];
const external = new Set();
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push(`${msg.params.entry.text} ${msg.params.entry.url || ''}`);
  if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) errors.push(`HTTP ${msg.params.response.status} ${msg.params.response.url}`);
  if (msg.method === 'Network.loadingFailed' && !msg.params.canceled) errors.push(`FAILED ${msg.params.errorText} ${msg.params.requestId}`);
  if (msg.method === 'Network.requestWillBeSent') { const u = msg.params.request.url; if (!/^(http:\/\/localhost|data:|blob:)/.test(u)) external.add(new URL(u).host); }
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable'); await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +width, height: +height, deviceScaleFactor: 1, mobile: +width < 768 });
await send('Page.navigate', { url });
await sleep(6000);
if (pre) { console.log('pre:', JSON.stringify(await evaluate(pre))); await sleep(1500); }
const total = await evaluate('document.documentElement.scrollHeight');
for (const f of fractions.split(',').map(Number)) {
  const y = Math.round((total - +height) * f);
  await evaluate(`(window.lenis ? window.lenis.scrollTo(${y}, {immediate:true}) : window.scrollTo(0, ${y}), true)`);
  await sleep(1600);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const file = `${out}-${String(f).replace('.', '_')}.png`;
  await writeFile(file, Buffer.from(shot.result.data, 'base64'));
  console.log('saved', file, 'y=', y, '/', total);
}
console.log('errors:', JSON.stringify(errors, null, 1));
console.log('external hosts:', JSON.stringify([...external]));
await fetch(`${endpoint}/json/close/${target.id}`);
ws.close();
process.exit(0);
