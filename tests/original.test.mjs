// Original mode (default): mirrored Webflow pages + OFF+BRAND front-end served locally.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PAGES = path.join(ROOT, 'original/pages');
const hasMirror = existsSync(path.join(PAGES, 'home.html'));

let server;
let base;
before(async () => {
  if (!hasMirror) return;
  delete process.env.RENDER;
  const { start } = await import(`../server.mjs?original=${Date.now()}`);
  server = await start(0);
  base = `http://localhost:${server.address().port}`;
});
after(() => server?.close());

const skip = !hasMirror && 'run `npm run mirror:original` first';

test('routes answer like the original (200 pages, 404 for /partnerships and unknown paths)', { skip }, async () => {
  const expected = { '/': 200, '/on-track': 200, '/off-track': 200, '/calendar': 200, '/legal/terms-conditions': 200, '/legal/privacy-policy': 200, '/partnerships': 404, '/x': 404 };
  for (const [p, status] of Object.entries(expected)) {
    const res = await fetch(base + p);
    assert.equal(res.status, status, p);
    const html = await res.text();
    assert.match(html, /data-wf-site="67b5a02dc5d338960b17a7e9"/, `${p} is the Webflow page`);
  }
});

test('pages load nothing from the original CDNs and carry no analytics', { skip }, () => {
  for (const f of readdirSync(PAGES)) {
    const html = readFileSync(path.join(PAGES, f), 'utf8');
    const live = html.replace(/<!--[\s\S]*?-->/g, '');
    assert.doesNotMatch(live, /(src|href)="(https?:)?\/\/(cdn\.prod\.website-files\.com|lando\.itsoffbrand\.io|assets\.itsoffbrand\.io|d3e54v103j8qbb\.cloudfront\.net)/, f);
    assert.doesNotMatch(live, /google_tags_first_party|gtag\(|src="\/[A-Za-z0-9]{20,}\//, `${f} analytics`);
  }
});

test('every local asset referenced by the pages exists', { skip }, () => {
  const missing = new Set();
  for (const f of readdirSync(PAGES)) {
    const html = readFileSync(path.join(PAGES, f), 'utf8');
    for (const m of html.matchAll(/\/original\/[^\s"'<>,]+/g)) {
      let raw = m[0].split('?')[0];
      while (raw.endsWith(')') && (raw.match(/\(/g) || []).length < (raw.match(/\)/g) || []).length) raw = raw.slice(0, -1);
      const p = decodeURIComponent(raw);
      if (!existsSync(path.join(ROOT, 'public', p))) missing.add(p);
    }
  }
  // Webflow's empty-CMS placeholder is not downloadable (403) and is hidden on the site.
  [...missing].forEach((p) => { if (p.includes('/plugins/Basic/assets/placeholder')) missing.delete(p); });
  assert.deepEqual([...missing], []);
});

test('the OFF+BRAND bundle loads Rive, WebGL and WASM from the local mirror', { skip }, () => {
  const bundle = readFileSync(path.join(ROOT, 'public/original/lando.itsoffbrand.io/dev-js/lando-by-OFF+BRAND.05.js'), 'utf8');
  for (const s of ['"/original/lando.itsoffbrand.io/gl"', '"/original/lando.itsoffbrand.io/rive/"', '"/original/unpkg.com/"']) assert.ok(bundle.includes(s), s);
  for (const f of ['rive/page-transition.riv', 'rive/reef.riv', 'gl/models/helmet-21.glb', 'gl/models/tracks/tracks-06-test.glb', 'gl/draco/draco_decoder.wasm', 'gl/basis/basis_transcoder.wasm', 'gl/textures/head/ktx2/diffuse.ktx2']) {
    assert.ok(existsSync(path.join(ROOT, 'public/original/lando.itsoffbrand.io', f)), f);
  }
  assert.ok(existsSync(path.join(ROOT, 'public/original/unpkg.com/@rive-app/canvas-lite@2.26.4/rive.wasm')));
});

test('mirrored files are served with the right types', { skip }, async () => {
  for (const [p, type] of [
    ['/original/lando.itsoffbrand.io/dev-js/lando-by-OFF+BRAND.05.js', 'text/javascript'],
    ['/original/unpkg.com/@rive-app/canvas-lite@2.26.4/rive.wasm', 'application/wasm'],
    ['/original/lando.itsoffbrand.io/gl/models/helmet-21.glb', 'model/gltf-binary'],
    ['/original/cdn.prod.website-files.com/67b5a02dc5d338960b17a7e9/67bc6274c5b4108b123aa4d5_MonaSans-VariableFont_wdth%2Cwght.woff2', 'font/woff2'],
  ]) {
    const res = await fetch(base + p);
    assert.equal(res.status, 200, p);
    assert.match(res.headers.get('content-type'), new RegExp(type), p);
  }
});

test('the JSON API still serves the CMS data in original mode', { skip }, async () => {
  const s = await (await fetch(`${base}/api/season`)).json();
  assert.equal(s.round, 19);
  assert.equal((await (await fetch(`${base}/api/races`)).json()).length, 24);
});
