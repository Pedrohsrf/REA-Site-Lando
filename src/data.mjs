// Content repository: loads the CMS export (data/*.json), rewrites CDN image URLs to the
// local mirror and derives the season state with the shared business rules.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { raceContext, isPast, ageOn, formatRound } from '../public/js/lib/rules.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'data');
const IMG_DIR = path.join(ROOT, 'public/assets/img');

const read = (name) => JSON.parse(readFileSync(path.join(DATA, name), 'utf8'));

let assetMap = {};
let localById = {};
function loadAssets() {
  assetMap = existsSync(path.join(DATA, 'asset-map.json')) ? read('asset-map.json') : {};
  localById = {};
  if (existsSync(IMG_DIR)) {
    for (const f of readdirSync(IMG_DIR)) {
      const id = f.match(/^([0-9a-f]{24})_/);
      if (id) localById[id[1]] = `/assets/img/${f}`;
    }
  }
}

/** Original CDN URL -> local mirror path. Falls back to the original URL when not mirrored. */
export function asset(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return url || '';
  if (assetMap[url]) return assetMap[url];
  const id = url.match(/\/([0-9a-f]{24})_/);
  if (id && localById[id[1]]) return localById[id[1]];
  return url;
}

function mapImages(value) {
  if (Array.isArray(value)) return value.map(mapImages);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = mapImages(v);
    return out;
  }
  if (typeof value === 'string' && value.startsWith('https://cdn.prod.website-files.com/')) return asset(value);
  return value;
}

let cache = null;

/** Load all content. Call reload() after editing data files (the dev server does it per request). */
export function load() {
  loadAssets();
  cache = mapImages({
    site: read('site.json'),
    races: read('races.json'),
    history: read('history.json'),
    highlights: read('highlights.json'),
    helmets: read('helmets.json'),
    galleries: {
      home: read('gallery-home.json'),
      onTrack: read('gallery-on-track.json'),
      offTrack: read('gallery-off-track.json'),
    },
    navImages: read('nav-images.json'),
    partners: read('partners.json'),
    socials: read('socials.json'),
    offTrack: read('off-track.json'),
    podiumMedia: read('podium-media.json'),
    storePromo: read('store-promo.json'),
    legal: read('legal.json'),
  });
  return cache;
}

export function content() {
  return cache || load();
}

/** Season state for a given day: previous/next race, current round, standing, age. */
export function season(now = new Date()) {
  const c = content();
  const ctx = raceContext(c.races, now);
  const races = ctx.sorted.map((r) => ({ ...r, past: isPast(r, now) }));
  return {
    ...ctx,
    races,
    upcoming: races.filter((r) => !r.past),
    past: races.filter((r) => r.past),
    round: ctx.next ? ctx.next.round : ctx.previous?.round ?? 0,
    roundLabel: formatRound(ctx.next ? ctx.next.round : ctx.previous?.round ?? 0),
    standing: c.site.driver.standing,
    age: ageOn(c.site.driver.birthDate, now),
  };
}
