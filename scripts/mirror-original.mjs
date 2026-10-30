// Mirrors the original front-end (Webflow HTML/CSS, OFF+BRAND bundle, Rive, WebGL assets) into
// public/original/<host>/<path> and rewrites every reference to the local copy.
// Output pages: original/pages/<route>.html (served by server.mjs in RENDER=original mode, the default).
//
// Usage: node scripts/mirror-original.mjs            (uses scripts/source-snapshot/*.html)
//        node scripts/mirror-original.mjs --refresh  (downloads the pages again from landonorris.com first)
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const SNAP = path.join(root, 'scripts/source-snapshot');
const OUT_PAGES = path.join(root, 'original/pages');
const OUT_ASSETS = path.join(root, 'public/original');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/156 Safari/537.36';
const ORIGIN = 'https://landonorris.com';

// Hosts mirrored locally. Everything else (Vimeo, social links, store) stays external.
const HOSTS = ['cdn.prod.website-files.com', 'd3e54v103j8qbb.cloudfront.net', 'lando.itsoffbrand.io', 'assets.itsoffbrand.io', 'unpkg.com', 'cdn.jsdelivr.net'];
const HOST_RE = new RegExp(`(?:https?:)?//(${HOSTS.map((h) => h.replace(/\./g, '\\.')).join('|')})(/[^\\s"'\`<>,]*)`, 'g');
/** Paths may contain "(1)"; a trailing ")" without a matching "(" belongs to CSS url(...). */
const trimPath = (p) => {
  let out = p;
  while (out.endsWith(')') && (out.match(/\(/g) || []).length < (out.match(/\)/g) || []).length) out = out.slice(0, -1);
  return out;
};

const PAGES = {
  home: '/', 'on-track': '/on-track', 'off-track': '/off-track', calendar: '/calendar',
  'legal-terms-conditions': '/legal/terms-conditions', 'legal-privacy-policy': '/legal/privacy-policy', 'not-found': '/partnerships',
};
const SNAP_FILES = {
  home: 'home.html', 'on-track': 'on-track.html', 'off-track': 'off-track.html', calendar: 'calendar.html',
  'legal-terms-conditions': 'legal_terms-conditions.html', 'legal-privacy-policy': 'legal_privacy-policy.html', 'not-found': 'partnerships.html',
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const localPath = (host, p) => path.join(OUT_ASSETS, host, ...decodeURIComponent(p.split('?')[0]).split('/').filter(Boolean));
const localUrl = (host, p) => `/original/${host}${p.split('?')[0]}`;

const failed = [];
let fetched = 0;
async function download(host, p) {
  const dest = localPath(host, p);
  if (await exists(dest)) return true;
  const res = await fetch(`https://${host}${p}`, { headers: { 'User-Agent': UA } }).catch((e) => ({ ok: false, status: String(e) }));
  if (!res.ok) { failed.push([`https://${host}${p}`, res.status]); return false; }
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  fetched += 1;
  return true;
}

async function pool(items, n, fn) {
  const q = [...items];
  await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()); }));
}

const collect = (text, set) => {
  for (const m of text.matchAll(HOST_RE)) {
    const p = trimPath(m[2]);
    // skip bases ("https://unpkg.com/"), directories and template fragments built at runtime
    if (p.endsWith('/') || p.includes('${') || p.includes('"+') || !/\.[a-z0-9]{2,5}(\?|$)/i.test(p.split('?')[0]) && !p.includes('/dev-js/')) continue;
    set.add(`${m[1]}${p}`);
  }
};
const rewrite = (text) => text.replace(HOST_RE, (all, host, raw) => {
  const p = trimPath(raw);
  return localUrl(host, p) + raw.slice(p.length);
});

// ------------------------------------------------------------------ 1. pages
if (process.argv.includes('--refresh')) {
  for (const [key, route] of Object.entries(PAGES)) {
    const res = await fetch(ORIGIN + route, { headers: { 'User-Agent': UA } });
    await writeFile(path.join(SNAP, SNAP_FILES[key]), await res.text());
    console.log('refreshed', route, res.status);
  }
}
const pages = {};
for (const [key, file] of Object.entries(SNAP_FILES)) pages[key] = await readFile(path.join(SNAP, file), 'utf8');

const urls = new Set();
Object.values(pages).forEach((html) => collect(html, urls));

// ------------------------------------------------------------------ 2. text assets referenced by pages (CSS / JS): fetch, scan, rewrite
const isText = (p) => /\.(css|js|mjs|json)(\?|$)/i.test(p) || p.includes('/dev-js/');
const textAssets = [...urls].filter((u) => isText(u.slice(u.indexOf('/'))));
const textBodies = {};
for (const u of textAssets) {
  const host = u.slice(0, u.indexOf('/')); const p = u.slice(u.indexOf('/'));
  const res = await fetch(`https://${host}${p}`, { headers: { 'User-Agent': UA } }).catch(() => null);
  if (!res?.ok) { failed.push([u, res?.status]); continue; }
  textBodies[u] = await res.text();
  collect(textBodies[u], urls);
}

// ------------------------------------------------------------------ 3. runtime assets requested by the OFF+BRAND bundle
const GL = '/gl';
const glPaths = ['/fonts/Brier-Bold-02.webp', '/fonts/Brier-Bold-msdf.json', '/fonts/MonaSans-Bold-02.webp', '/fonts/MonaSans-Bold-msdf.json',
  '/hdri/studio_small_08_1k--dark.hdr', '/hdri/studio_small_08_1k--faded.hdr', '/hdri/studio_small_08_1k--light.hdr',
  '/models/disco-02.glb', '/models/helmet-21.glb', '/models/sotd.glb', '/models/tracks/tracks-06-test.glb',
  '/textures/noise/noise-03.webp', '/textures/not-found/webp/not-found-alpha-6.webp', '/textures/plastic/plastic__matcap-02.webp', '/textures/tracks/lando__matcap-02.webp',
  '/textures/head/webp/normal.webp', '/textures/glass/webp/Norris_Glass_mat_Normal.webp', '/textures/helmet/webp/Norris_Helmet_mat_Normal.webp',
  '/textures/helmet/webp/disco/disco_matcap-01.webp', '/textures/helmet/webp/disco/disco_lens-flare-15.webp',
  '/draco/draco_decoder.js', '/draco/draco_decoder.wasm', '/draco/draco_wasm_wrapper.js', '/basis/basis_transcoder.js', '/basis/basis_transcoder.wasm'];
for (const ext of ['webp', 'ktx2']) {
  for (const t of ['alpha', 'depth', 'diffuse', 'roughness', 'shadow', 'shadow-softer-edit', 'shadow-to-zip-edit']) glPaths.push(`/textures/head/${ext}/${t}.${ext}`);
  for (const t of ['Norris_Glass_mat_BaseColor', 'Norris_Glass_mat_Metallic', 'Norris_Glass_mat_Roughness']) glPaths.push(`/textures/glass/${ext}/${t}.${ext}`);
  for (const t of ['Norris_Helmet_mat_Metallic', 'Norris_Helmet_mat_Roughness', 'gold/Norris_Helmet_mat_BaseColor', 'disco/Norris_Helmet_mat_BaseColor', 'disco/disco_mask-01']) glPaths.push(`/textures/helmet/${ext}/${t}.${ext}`);
}
glPaths.forEach((p) => urls.add(`lando.itsoffbrand.io${GL}${p}`));
for (const f of ['signature', 'btn-ui', 'circuits', 'reef', 'phrases', 'ln4', 'mob-landscape', 'page-transition']) {
  urls.add(`lando.itsoffbrand.io/rive/${f}.riv`);
  urls.add(`assets.itsoffbrand.io/lando/rive/${f}.riv`);
}
for (const f of ['rive.wasm', 'rive_fallback.wasm']) {
  urls.add(`unpkg.com/@rive-app/canvas-lite@2.26.4/${f}`);
  urls.add(`cdn.jsdelivr.net/npm/@rive-app/canvas-lite@2.26.4/${f}`);
}

// ------------------------------------------------------------------ 4. binary download
const binaries = [...urls].filter((u) => !textBodies[u]);
await pool(binaries, 10, (u) => download(u.slice(0, u.indexOf('/')), u.slice(u.indexOf('/'))));

// ------------------------------------------------------------------ 5. rewrite + write text assets
for (const [u, body] of Object.entries(textBodies)) {
  const host = u.slice(0, u.indexOf('/')); const p = u.slice(u.indexOf('/'));
  let out = rewrite(body);
  // The bundle builds GL/Rive URLs from string bases and loads the Rive WASM from unpkg.
  out = out.replaceAll('"https://lando.itsoffbrand.io/gl"', '"/original/lando.itsoffbrand.io/gl"')
    .replaceAll('"https://lando.itsoffbrand.io/rive/"', '"/original/lando.itsoffbrand.io/rive/"')
    .replaceAll('"https://assets.itsoffbrand.io/lando/rive/"', '"/original/assets.itsoffbrand.io/lando/rive/"')
    .replaceAll('"https://unpkg.com/"', '"/original/unpkg.com/"')
    .replaceAll('"https://cdn.jsdelivr.net/npm/"', '"/original/cdn.jsdelivr.net/npm/"');
  const dest = localPath(host, p);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, out);
}

// ------------------------------------------------------------------ 6. rewrite pages
// Google Tag first-party proxy scripts: "/<long id>/<id>" without extension.
const GTAG = /<script[^>]*src="\/[A-Za-z0-9]{20,}\/[A-Za-z0-9_-]+"[^>]*><\/script>/g;
await mkdir(OUT_PAGES, { recursive: true });
for (const [key, html] of Object.entries(pages)) {
  let out = rewrite(html)
    .replace(GTAG, '<!-- analytics (Google Tag proxy) removed in local copy -->')
    .replace(/<script[^>]*>(?:(?!<\/script>)[\s\S])*?(?:google_tags_first_party|window\.dataLayer)[\s\S]*?<\/script>/g, '<!-- analytics config removed in local copy -->')
    .replace(/\s(integrity|crossorigin)="[^"]*"/g, '') // rewritten CSS no longer matches the SRI hash
    .replace(/<link[^>]*rel="(preconnect|dns-prefetch)"[^>]*>/g, '') // hints to the original CDN
    .replace(/<link\s+rel="(preconnect|dns-prefetch)"[^>]*>/g, '')
    .replace(/href="https:\/\/landonorris\.com\//g, 'href="/');
  await writeFile(path.join(OUT_PAGES, `${key}.html`), out);
}

console.log(`assets: ${urls.size} referenced, ${fetched} downloaded now, ${failed.length} failed`);
if (failed.length) console.log(JSON.stringify(failed, null, 1));
