// Equivalence: content rendered by the rebuild vs. the saved HTML of the original
// (scripts/source-snapshot, captured 2026-10-29).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPage } from '../src/render.mjs';
import { content } from '../src/data.mjs';

const NOW = new Date(2026, 9, 29, 12);
const snap = (f) => readFileSync(new URL(`../scripts/source-snapshot/${f}`, import.meta.url), 'utf8');
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').toLowerCase();

const pages = {
  home: ['home.html', { page: 'home' }],
  'on-track': ['on-track.html', { page: 'on-track' }],
  'off-track': ['off-track.html', { page: 'off-track' }],
  calendar: ['calendar.html', { page: 'calendar' }],
};

test('internal routes linked by the original exist in the rebuild', () => {
  const links = new Set();
  for (const f of ['home.html', 'on-track.html', 'off-track.html', 'calendar.html']) {
    for (const m of snap(f).matchAll(/href="(\/[^"#]*)"/g)) links.add(m[1]);
  }
  const html = Object.values(pages).map(([, r]) => renderPage(r, NOW)).join('');
  for (const l of links) assert.ok(html.includes(`href="${l}"`), `missing link ${l}`);
});

test('external links (store, socials, business) are preserved', () => {
  const ext = new Set();
  for (const m of snap('home.html').matchAll(/href="((?:https?:|mailto:)[^"]+)"/g)) {
    if (!m[1].includes('website-files.com')) ext.add(m[1]);
  }
  const html = renderPage({ page: 'home' }, NOW);
  for (const l of ext) assert.ok(html.includes(l), `missing external link ${l}`);
});

test('every race in the original calendar is rendered with its CMS fields', () => {
  const html = renderPage({ page: 'calendar' }, NOW);
  for (const r of content().races) {
    assert.ok(html.includes(`>${r.name}<`), r.name);
    assert.ok(html.includes(`data-cal-list="date-actual">${r.dateActual}<`), `${r.name} date`);
    if (r.raceTimeResult) assert.ok(html.includes(`>${r.raceTimeResult}<`), `${r.name} result`);
  }
});

const KEY_PHRASES = {
  home: ['redefining', 'message from lando', 'helmets', 'hall of fame', 'partners', '&campaigns', "world drivers'", 'visit the store', 'follow lando on social media', 'business enquiries', 'always', 'privacy policy', 'qatar, 2024', 'it doesn’t matter where you start'],
  'on-track': ['last lap lando', 'bristol, uk', 'podiums', 'formula 1 wins', 'pole positions', 'average finish', 'fastest laps', 'f1 result highlights', 'pre-f1 career', 'cik-fia karting world champion', 'next race begins in...', 'see full schedule'],
  'off-track': ['bringing the fight', 'padel tennis', 'photography & film', 'lego: art of the brick', 'mastering the green', 'hilton hotels'],
  calendar: ['upcoming', '2026 calendar', 'track visualiser', 'calendar list', 'formula 1', 'all results', '*uk time'],
};

for (const [key, [file, route]] of Object.entries(pages)) {
  test(`${key}: key copy of the original is present`, () => {
    const orig = text(snap(file));
    const mine = text(renderPage(route, NOW));
    for (const p of KEY_PHRASES[key]) {
      assert.ok(orig.includes(p), `phrase not in original: ${p}`);
      assert.ok(mine.includes(p), `phrase missing in rebuild: ${p}`);
    }
  });
}

test('collections have the same item counts as the original', () => {
  const home = snap('home.html');
  const c = content();
  assert.equal(c.helmets.length, (home.match(/data-helmet-item=""/g) || []).length);
  assert.equal(c.races.length, (snap('calendar.html').match(/data-cal-item=""/g) || []).length - 0);
  assert.equal(c.history.length, (snap('calendar.html').match(/data-calendar-history="item"/g) || []).length);
  assert.equal(c.navImages.length, (home.match(/data-nav-img="/g) || []).length);
});

test('terms are reproduced verbatim; privacy keeps the same iubenda embed', () => {
  const orig = text(snap('legal_terms-conditions.html'));
  const body = text(content().legal['terms-conditions'].html);
  assert.ok(body.length > 2000);
  assert.ok(orig.includes(body.slice(0, 600)), 'terms differ from original');
  assert.ok(text(renderPage({ page: 'legal', slug: 'terms-conditions' }, NOW)).includes(body.slice(-300)), 'terms not rendered');
  const policy = /iubenda\.com\/privacy-policy\/76795150/;
  assert.match(snap('legal_privacy-policy.html'), policy);
  assert.match(renderPage({ page: 'legal', slug: 'privacy-policy' }, NOW), policy);
});

test('images resolve to the local mirror', () => {
  const html = Object.values(pages).map(([, r]) => renderPage(r, NOW)).join('');
  const remote = [...html.matchAll(/src="(https:\/\/cdn\.prod\.website-files\.com[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(remote, [], 'every CMS image should be served locally');
});
