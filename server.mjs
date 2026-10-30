// HTTP server: server-rendered pages, static assets, vendor ESM modules and a read-only JSON API.
// Usage: node server.mjs  (PORT=3000 by default; NOW=2026-10-29 to pin "today" for testing)
import http from 'node:http';
import { createReadStream, statSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { renderPage, resolveRoute } from './src/render.mjs';
import { load, content, season } from './src/data.mjs';

const ROOT = import.meta.dirname;
const PUBLIC = path.join(ROOT, 'public');
const VENDOR = {
  '/vendor/gsap/': path.join(ROOT, 'node_modules/gsap/'),
  '/vendor/lenis/': path.join(ROOT, 'node_modules/lenis/dist/'),
  '/vendor/rive/': path.join(ROOT, 'node_modules/@rive-app/canvas-lite/'),
  '/vendor/three/': path.join(ROOT, 'node_modules/three/'),
};
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.avif': 'image/avif', '.wasm': 'application/wasm', '.riv': 'application/octet-stream', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon',
};
const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

/**
 * RENDER=original (default): the original Webflow pages + OFF+BRAND front-end mirrored locally
 * (scripts/mirror-original.mjs) — identical markup, CSS, Rive and WebGL animations.
 * RENDER=rebuild: the pages rendered by src/render.mjs from data/*.json with the rewritten front-end.
 */
const ORIGINAL_PAGES = path.join(ROOT, 'original/pages');
export const renderMode = () => (process.env.RENDER === 'rebuild' || process.argv.includes('--rebuild') ? 'rebuild' : 'original');

/** "Today" used for date rules. NOW env pins it (e.g. NOW=2026-10-29T12:00:00). */
export function now() {
  return process.env.NOW ? new Date(process.env.NOW) : new Date();
}

function send(res, status, body, type, extra = {}) {
  res.writeHead(status, { 'Content-Type': type, ...SECURITY, ...extra });
  res.end(res.req.method === 'HEAD' ? undefined : body);
}

function sendFile(res, file) {
  let st;
  try { st = statSync(file); } catch { return false; }
  if (!st.isFile()) return false;
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const immutable = file.includes(`${path.sep}assets${path.sep}`) || file.includes('node_modules');
  res.writeHead(200, {
    'Content-Type': type, 'Content-Length': st.size, ...SECURITY,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (res.req.method === 'HEAD') { res.end(); return true; }
  createReadStream(file).pipe(res);
  return true;
}

/** Resolve a URL path inside a base directory, refusing traversal. */
function safeJoin(base, rel) {
  const p = path.normalize(path.join(base, decodeURIComponent(rel)));
  return p.startsWith(base) ? p : null;
}

function api(pathname, res) {
  const st = season(now());
  const c = content();
  const json = (data) => send(res, 200, JSON.stringify(data, null, 2), TYPES['.json'], { 'Cache-Control': 'no-cache' });
  switch (pathname) {
    case '/api/season':
      return json({
        today: now().toISOString(), standing: st.standing, round: st.round, age: st.age,
        previous: st.previous && { round: st.previous.round, name: st.previous.name, finish: st.previous.finish || st.previous.finishNote },
        next: st.next && { round: st.next.round, name: st.next.name, dateActual: st.next.dateActual, circuitId: st.next.circuitId },
      });
    case '/api/races': return json(st.races);
    case '/api/history': return json(c.history);
    case '/api/highlights': return json(c.highlights);
    case '/api/helmets': return json(c.helmets);
    default: return send(res, 404, JSON.stringify({ error: 'not found' }), TYPES['.json']);
  }
}

export function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', 'text/plain; charset=utf-8', { Allow: 'GET, HEAD' });
  }
  const url = new URL(req.url, 'http://localhost');
  const { pathname } = url;
  if (process.env.NODE_ENV !== 'production') load(); // pick up data edits without restarting

  if (pathname.startsWith('/api/')) return api(pathname, res);

  for (const [prefix, dir] of Object.entries(VENDOR)) {
    if (pathname.startsWith(prefix)) {
      const f = safeJoin(dir, pathname.slice(prefix.length));
      if (f && sendFile(res, f)) return;
      return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    }
  }

  if (/\.[a-z0-9]+$/i.test(pathname)) {
    const f = safeJoin(PUBLIC, pathname);
    if (f && existsSync(f) && sendFile(res, f)) return;
    return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  }

  const route = resolveRoute(pathname);
  try {
    if (renderMode() === 'original') {
      const key = route.page === 'legal' ? `legal-${route.slug}` : route.page;
      const file = path.join(ORIGINAL_PAGES, `${key}.html`);
      if (existsSync(file)) {
        return send(res, route.status || 200, readFileSync(file), TYPES['.html'], { 'Cache-Control': 'no-cache' });
      }
    }
    const html = renderPage(route, now());
    return send(res, route.status || 200, html, TYPES['.html'], { 'Cache-Control': 'no-cache' });
  } catch (e) {
    console.error(e);
    return send(res, 500, 'Internal Server Error', 'text/plain; charset=utf-8');
  }
}

export function start(port = Number(process.env.PORT) || 3000) {
  load();
  const server = http.createServer(handler);
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const server = await start();
  console.log(`Lando Norris site (${renderMode()} mode) running on http://localhost:${server.address().port}`);
}
