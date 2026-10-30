// Static export: renders every route to dist/ (for hosting without Node).
// Note: date rules (past/upcoming, next race) are evaluated at build time on the server
// side and again at runtime in the browser, so rebuild the export when the season moves on.
// Usage: node scripts/build-static.mjs   (NOW=... pins the build date)
import { mkdir, writeFile, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { renderPage } from '../src/render.mjs';
import { load } from '../src/data.mjs';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
load();

await rm(dist, { recursive: true, force: true });
await cp(path.join(root, 'public'), dist, { recursive: true });
await cp(path.join(root, 'node_modules/gsap'), path.join(dist, 'vendor/gsap'), { recursive: true });
await mkdir(path.join(dist, 'vendor/lenis'), { recursive: true });
await cp(path.join(root, 'node_modules/lenis/dist/lenis.mjs'), path.join(dist, 'vendor/lenis/lenis.mjs'));
await cp(path.join(root, 'node_modules/@rive-app/canvas-lite'), path.join(dist, 'vendor/rive'), { recursive: true });
for (const sub of ['build', 'examples/jsm/loaders', 'examples/jsm/libs/draco', 'examples/jsm/utils']) {
  await cp(path.join(root, 'node_modules/three', sub), path.join(dist, 'vendor/three', sub), { recursive: true });
}

const routes = [
  ['index.html', { page: 'home' }],
  ['on-track/index.html', { page: 'on-track' }],
  ['off-track/index.html', { page: 'off-track' }],
  ['calendar/index.html', { page: 'calendar' }],
  ['legal/terms-conditions/index.html', { page: 'legal', slug: 'terms-conditions' }],
  ['legal/privacy-policy/index.html', { page: 'legal', slug: 'privacy-policy' }],
  ['404.html', { page: 'not-found' }],
];
// RENDER=rebuild exports the rewritten pages; otherwise the mirrored original pages (default).
const ORIGINAL = process.env.RENDER !== 'rebuild';
const { readFile } = await import('node:fs/promises');
for (const [file, route] of routes) {
  const out = path.join(dist, file);
  await mkdir(path.dirname(out), { recursive: true });
  const key = route.page === 'legal' ? `legal-${route.slug}` : route.page;
  const html = ORIGINAL ? await readFile(path.join(root, 'original/pages', `${key}.html`)) : renderPage(route, now);
  await writeFile(out, html);
}
console.log(`static site written to ${dist} (${routes.length} pages, date ${now.toISOString().slice(0, 10)})`);
