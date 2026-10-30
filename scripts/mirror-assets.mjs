// Downloads every image and font referenced by the extracted CMS data into public/assets,
// then writes data/asset-map.json (original URL -> local path).
// Usage: node scripts/mirror-assets.mjs
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const urls = JSON.parse(await readFile(path.join(root, 'data/_image-urls.json'), 'utf8'));
const fonts = [
  'https://cdn.prod.website-files.com/67b5a02dc5d338960b17a7e9/67b6113a220f85ad6497495a_Brier-Bold.woff2',
  'https://cdn.prod.website-files.com/67b5a02dc5d338960b17a7e9/67bc6274c5b4108b123aa4d5_MonaSans-VariableFont_wdth%2Cwght.woff2',
];

function localName(url) {
  const base = decodeURIComponent(url.split('/').pop().split('?')[0]);
  return base.replace(/[^\w.\-]+/g, '-');
}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

const map = {};
const failed = [];
async function get(url, dir) {
  const name = localName(url);
  const dest = path.join(root, 'public/assets', dir, name);
  map[url] = `/assets/${dir}/${name}`;
  if (await exists(dest)) return;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 asset-mirror' } });
  if (!res.ok) { failed.push([url, res.status]); return; }
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

await mkdir(path.join(root, 'public/assets/img'), { recursive: true });
await mkdir(path.join(root, 'public/assets/fonts'), { recursive: true });

const queue = [...urls.map((u) => [u, 'img']), ...fonts.map((u) => [u, 'fonts'])];
const workers = Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const [u, d] = queue.shift();
    try { await get(u, d); } catch (e) { failed.push([u, String(e)]); }
  }
});
await Promise.all(workers);
await writeFile(path.join(root, 'data/asset-map.json'), JSON.stringify(map, null, 2));
console.log(`mirrored ${Object.keys(map).length - failed.length}/${Object.keys(map).length} assets`);
if (failed.length) console.log('failed:', failed);
