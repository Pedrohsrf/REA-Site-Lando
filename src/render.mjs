// HTML templates for every route. Markup keeps the original data-* contracts
// (data-cal-*, data-countdown-*, data-text-format, data-rive-*, data-anim-high, ...) so the
// client modules in public/js/ apply the same rules and animations as the original.
import { content, season } from './data.mjs';
import { ordinal, splitPosition, formatRound, sessionLabels, sessionCell, scheduleHeader, trophyKind } from '../public/js/lib/rules.mjs';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const attr = (name, v) => (v === undefined || v === null || v === false ? '' : ` ${name}="${esc(v)}"`);
const img = (src, alt = '', cls = '', extra = '') =>
  src ? `<img src="${esc(src)}" alt="${esc(alt)}"${attr('class', cls || null)} loading="lazy" decoding="async"${extra}>` : '';

/** Rich run: [[text, highlighted], ...] -> spans. */
const runs = (parts, cls = 'hl') =>
  parts.map(([t, on]) => (on ? `<span class="${cls}">${esc(t)}</span>` : esc(t))).join('');

/** Position with superscript suffix (lime when 1st), the same output as format "position". */
export function position(text, extraCls = '') {
  const p = splitPosition(text);
  if (!p.num) return `<span class="pos ${extraCls}" data-text-format="position">${esc(p.raw || '-')}</span>`;
  return `<span class="pos ${extraCls}" data-text-format="position">${esc(p.num)}<sup class="${p.winner ? 'c-lime' : 'c-grey'}">${esc(p.suffix)}</sup></span>`;
}

const round = (n) => `<span class="round" data-text-format="round">${esc(formatRound(n))}</span>`;

// ------------------------------------------------------------------ Rive canvases (original .riv files)
/** <canvas data-rive-object ...> as in the original markup. Keys become data-rive-<key>. */
function rive(file, artboard, stateMachine, extra = {}, cls = '') {
  const a = Object.entries({ file, artboard, 'state-machine': stateMachine, fit: 'contain', ...extra })
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => ` data-rive-${k}="${esc(v)}"`).join('');
  return `<canvas class="rive ${cls}" data-rive-object${a} aria-hidden="true"></canvas>`;
}

/** Helmet icon from reef.riv. kind: play | scroll | instant | off-icons | off-icons-reef | reef | 3d */
function helmet(cls = '', { kind = 'play', color = 'color_green-off-white-2', target, start, end } = {}) {
  const map = {
    play: ['helmet-reef', 'helmet-reef_play'],
    instant: ['helmet-reef', 'helmet-reef_play'],
    scroll: ['helmet-reef', 'helmet-reef_scroll'],
    'off-icons': ['off-icons', 'off-icons'],
    'off-icons-reef': ['off-icons-reef', 'off-icons-reef_play'],
    reef: ['reef', 'reef_play'],
    '3d': ['3d-helmet-reef', '3d-helmet-reef_scroll'],
  };
  const [ab, sm] = map[kind];
  return `<span class="helmet-rive ${cls}">${rive('reef', ab, sm, {
    input: color,
    'instant-play': kind === 'instant' ? 'true' : undefined,
    'scrolltrigger-target': target, 'scrolltrigger-start': start, 'scrolltrigger-end': end,
  })}</span>`;
}

/** Hand-drawn signature: signature.riv, with the static image as placeholder until Rive draws. */
function signature(placeholder, cls = '', { mode = 'play', color = 'color_lime', target, start, end } = {}) {
  return `<span class="sig-rive ${cls}">${img(placeholder, '', 'rive-placeholder')}${rive('signature', 'signature', `signature_${mode}`, {
    input: color, 'scrolltrigger-target': target, 'scrolltrigger-start': start, 'scrolltrigger-end': end,
  })}</span>`;
}

/** Circuit outline from circuits.riv; the "track" input is the CMS circuit-id. */
function circuit(trackId, cls = '', { color = '', weight = '', hover = false } = {}) {
  return `<span class="circuit-rive ${cls}">${rive('circuits', 'circuits', 'circuits', {
    'input-track': trackId, 'input-color': color, 'input-weight': weight, 'circuit-hover': hover ? 'true' : undefined,
  })}</span>`;
}

/** Animated phrase from phrases.riv (phrase_on, phrase_p1, race-day, collabs). */
function phrase(artboard, sm, cls = '', { scroll = true, start } = {}) {
  return `<span class="phrase-rive ${cls}">${rive('phrases', artboard, sm, { scrolltrigger: scroll ? 'true' : undefined, 'scrolltrigger-start': start })}</span>`;
}

function arrowSvg(dir = 'right') {
  const rot = { right: 0, left: 180, down: 90, up: -90 }[dir];
  return `<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${rot}deg)"><path d="M4 12h14M12 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/></svg>`;
}
/** btn-ui.riv arrow; the hover input follows the closest [data-btn-rive-hover]. SVG stays as fallback. */
const arrowIcon = (dir = 'right') =>
  `<span class="arrow-rive is-${dir}">${arrowSvg(dir)}${rive('btn-ui', 'arrow', 'arrow', { hover: 'false' })}</span>`;

function button(href, label, { theme = 'lime', variant = '', rotate = false, external = false } = {}) {
  return `<a href="${esc(href)}" class="btn btn-${theme} ${variant}" data-anim="text-hover" data-btn-rive-hover data-btn-rive-rotate="${rotate}"${external ? ' target="_blank" rel="noopener"' : ''}>
    <span class="btn-text" split-text="chars">${esc(label)}</span><span class="btn-icon">${arrowIcon(rotate ? 'left' : 'right')}</span></a>`;
}

const iconButton = (href, label, dir = 'right', cls = '') =>
  `<a href="${esc(href)}" class="btn-icon-only ${cls}" aria-label="${esc(label)}" data-btn-rive-hover>${arrowIcon(dir)}</a>`;

/** data-anim-high="direction, colour, delayMs": lines revealed behind a coloured bar (original AE). */
const high = (dir = 'right', color = 'lime', delay) => ` data-anim-high="${dir}, ${color}${delay ? `, ${delay}` : ''}"`;

function eyebrow(text, cls = '', h = high()) {
  return `<div class="eyebrow ${cls}"${h}>${esc(text)}</div>`;
}

// ------------------------------------------------------------------ layout
function nav(c, page) {
  const s = c.site;
  const navLinks = s.pages.filter((p) => !p.hidden);
  const current = (href) => (href === '/' ? page === 'home' : `/${page}` === href);
  return `
<header class="nav" data-nav-wrap data-nav-theme="light">
  <a href="/" class="nav-brand" data-nav-group="brand" aria-label="Go to home">
    <span class="nav-logo-w"><img src="${esc(s.images.lnLogo)}" alt="" class="nav-logo rive-placeholder"><canvas class="rive nav-logo-rive" data-rive-ln4 data-rive-fit="contain" aria-hidden="true"></canvas></span>
    <span class="nav-wordmark">LANDO<b>NORRIS</b></span>
  </a>
  <div class="nav-btns" data-nav-group="btns">
    <a href="${esc(s.links.store)}" class="btn btn-lime is-nav" data-anim="text-hover" target="_blank" rel="noopener">
      <svg viewBox="0 0 16 16" class="bag" aria-hidden="true"><path d="M3 5h10l-1 9H4L3 5Zm3 0V4a2 2 0 0 1 4 0v1" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
      <span class="btn-text" split-text="chars">Store</span></a>
    <button class="nav-ham" data-nav-ham aria-label="Open menu" aria-expanded="false" aria-controls="nav-menu">
      <span class="ham-fallback"><span></span><span></span></span>
      <canvas class="rive" data-rive-nav-hamburger data-rive-artboard="hamburger" data-rive-state-machine="hamburger" data-rive-fit="contain" aria-hidden="true"></canvas>
    </button>
  </div>
</header>
<div class="nav-menu" id="nav-menu" data-nav-m aria-hidden="true">
  <div class="nav-menu-inner">
    <div class="nav-menu-imgs" aria-hidden="true">
      ${c.navImages.map((n) => `<div class="nav-menu-img" data-nav-img="${n.index}">${img(n.img, n.alt)}</div>`).join('')}
    </div>
    <nav class="nav-menu-links" aria-label="Main">
      ${navLinks.map((p, i) => `<a href="${esc(p.href)}" class="nav-menu-link${current(p.href) ? ' is-current' : ''}" data-anim="text-hover" data-nav-link="${i + 1}"${current(p.href) ? ' aria-current="page"' : ''}><span split-text="chars">${esc(p.label)}</span></a>`).join('')}
    </nav>
    <div class="nav-menu-side">
      <span class="helmet-rive nav-helmet"><canvas class="rive" data-rive-nav-object data-rive-file="reef" data-rive-artboard="helmet-reef" data-rive-state-machine="helmet-reef_scroll" data-rive-color-input="color_green-off-white-2" data-rive-fit="contain" aria-hidden="true"></canvas></span>
      <div class="eyebrow" data-nav-link-highlight>${esc(s.driver.team)}</div>
      <a href="${esc(s.links.business)}" class="text-link" data-nav-link-highlight>business enquiries</a>
      <div class="nav-menu-socials">
        ${s.links.socials.map((x) => `<a href="${esc(x.menuUrl || x.url)}" class="text-link" data-nav-link-highlight target="_blank" rel="noopener">${esc(x.name)}</a>`).join('')}
      </div>
    </div>
  </div>
</div>`;
}

function footer(c) {
  const s = c.site;
  return `
<footer class="s footer" data-nav-theme-target="dark">
  <div class="footer-card">
    <div class="footer-cols">
      <div class="footer-col">
        <div class="eyebrow">pages</div>
        ${s.pages.map((p) => `<a href="${esc(p.href)}" class="footer-link${p.hidden ? ' is-hidden' : ''}" data-anim="text-hover"><span split-text="chars">${esc(p.label)}</span></a>`).join('')}
        <a href="${esc(s.links.store)}" class="footer-link c-lime" data-anim="text-hover" target="_blank" rel="noopener"><span split-text="chars">Store</span></a>
      </div>
      <div class="footer-col">
        <div class="eyebrow">Follow On</div>
        ${s.links.socials.map((x) => `<a href="${esc(x.url)}" class="footer-link" data-anim="text-hover" target="_blank" rel="noopener"><span split-text="chars">${esc(x.name[0].toUpperCase() + x.name.slice(1))}</span></a>`).join('')}
        <a href="#" class="footer-link c-lime is-hidden" data-signup-trigger>Sign Up</a>
      </div>
    </div>
    <div class="footer-main">
      ${signature(s.images.signature, 'footer-signature', { mode: 'play' })}
      <h2 class="impact-sm"${high('right', 'lime-off')}>${runs(s.footer.claim)}</h2>
      ${img(s.images.footerBg, '', 'footer-bg')}
      ${button(s.links.business, 'business enquiries')}
    </div>
    <div class="marquee" data-marquee data-marquee-direction="left" data-marquee-speed="30" data-marquee-duplicate="3">
      <div class="marquee-track">${c.partners.footerLogos.map((l) => img(l, '', 'marquee-logo')).join('')}</div>
    </div>
  </div>
  <div class="footer-bottom">
    ${img(s.images.footerBlobs, '', 'footer-blobs')}
    <span>${esc(s.footer.copyright)}</span><span>${esc(s.footer.rights)}</span>
    <a href="/legal/privacy-policy" class="text-link">Privacy Policy</a>
    <a href="/legal/terms-conditions" class="text-link">Terms</a>
  </div>
</footer>`;
}

function socialsSection(c, list) {
  const s = c.site;
  return `
<section class="s socials" data-nav-theme-target="dark">
  ${helmet('socials-icon', { kind: 'off-icons' })}
  <h2 class="title-lg center" data-oval-scroll><span>what’s up</span> <span class="hl">On Socials</span></h2>
  <div class="socials-cards" data-social-callout="wrap">
    ${list.map((v, i) => `<div class="social-card" data-video-stream-wrap style="--i:${i}">
      <div class="video-stream" data-video-stream data-stream-url="${esc(v.vimeo)}" data-stream-hover="true" data-stream-muted="true" data-stream-loop="true">
        ${img(v.poster, '', 'social-poster', ' data-video-stream-placeholder')}
      </div></div>`).join('')}
  </div>
  <div class="socials-follow">
    <div class="cta-intro font-brier"${high('right', 'dark-green-tint-1')}>Follow Lando on social media</div>
    <div class="socials-links">${s.links.socials.map((x) => `<a href="${esc(x.url)}" class="text-link big" data-anim="text-hover" target="_blank" rel="noopener"><span split-text="chars">${esc(x.name)}</span></a>`).join('')}</div>
  </div>
</section>`;
}

function helmetsSection(c, { onTrack = false } = {}) {
  return `
<section class="s helmets bg-black" data-nav-theme-target="light">
  <div class="helmets-head">
    <h2 class="title-lg"${high()}>Helmets <span class="hl">Hall of Fame</span></h2>
    <p class="body-reg"${high('right', 'lime', 200)}>${esc(c.site.home.helmetsIntro)}</p>
  </div>
  <div class="helmet-grid" data-helmet-grid>
    ${c.helmets.map((h) => `<div class="helmet-item-w"><div class="helmet-item" data-helmet-item tabindex="0">
      <div class="helmet-frame"></div>
      <div class="helmet-img">${img(h.img, `${h.name} ${h.year} helmet`, 'helmet-base')}${img(h.revealImg, '', 'helmet-reveal')}</div>
      <h3 class="helmet-label"><span>${esc(h.name)}</span><span class="c-lime">${esc(h.year)}</span></h3>
    </div></div>`).join('')}
  </div>
  ${onTrack ? '' : `<div class="callout c is-callout">
    ${helmet('callout-icon', { kind: 'scroll', color: 'color_lime', target: '.c.is-callout', start: 'top bottom', end: 'bottom center' })}
    <div class="cta-intro font-brier"${high()}>${esc(c.site.home.helmetsCta)}</div>
    ${button('/on-track', 'view on track')}
  </div>`}
</section>`;
}

function horizontalGallery(cards) {
  const card = (cd) => {
    const v = (cd.variant || []).join(' ');
    if (cd.kind === 'quote') {
      return `<div class="h-item h-quote ${esc(v)}"><p class="h-quote-text">${esc(cd.text)}</p>${img(cd.img, '', 'h-sig')}</div>`;
    }
    if (cd.kind === 'title') {
      return `<div class="h-item h-title ${esc(v)}">${helmet('h-title-icon', { kind: 'off-icons' })}<h3 class="font-brier">${esc(cd.title)}</h3>${cd.subtitle ? `<div class="eyebrow">${esc(cd.subtitle)}</div>` : ''}</div>`;
    }
    return `<figure class="h-item h-photo ${esc(v)}">
      ${cd.heading ? `<h2 class="title-lg h-photo-heading">${esc(cd.heading)}</h2>` : ''}
      ${cd.caption ? `<figcaption class="eyebrow">${esc(cd.caption)}</figcaption>` : ''}
      <div class="h-img">${img(cd.img, cd.alt)}</div>
      ${cd.pill ? `<div class="h-pill"><span>${esc(cd.pill.text)}</span>${img(cd.pill.icon, '')}</div>` : ''}
    </figure>`;
  };
  return `
<section class="s horizontal" data-horizontal-section data-h-color-from="dark-green" data-h-color-to="white">
  <div class="horizontal-pin"><div class="horizontal-track" data-horizontal-track>${cards.map(card).join('')}</div></div>
</section>`;
}

/** Race row in a list; `kind` = previous (finish/fastest lap) or upcoming (laps/distance). */
function raceRow(r, kind, { withDash = true } = {}) {
  const trophy = r.trophy || (trophyKind(r.finish) ? { kind: trophyKind(r.finish) } : null);
  const finish = r.finish ? position(r.finish) : `<span class="pos">${esc(r.finishNote || '-')}</span>`;
  const cols = kind === 'previous'
    ? `<div class="cell hide-m">${esc(r.listDate || r.raceDate)} <span class="c-grey">${esc((r.dateActual || '').split('/')[2]?.slice(2, 4) || '')}</span></div>
       <div class="cell">${finish}${trophy?.img ? `<span class="trophy is-${trophy.kind}">${img(trophy.img, '')}</span>` : ''}</div>
       <div class="cell hide-m">${esc(r.fastestLap || '-')}${r.fastestLap ? '<span class="c-grey unit">s</span>' : ''}</div>`
    : `<div class="cell hide-m">${esc(r.dateFromToNum)} <span class="c-grey">${esc(r.dateFromToMonth)}</span></div>
       <div class="cell">${esc(r.circuitLapAmount)}</div>
       <div class="cell hide-m">${esc(r.circuitDistance)}<span class="c-grey unit">km</span></div>`;
  return `<div class="race-row is-${kind}${r.past ? ' is-in-past' : ''}" data-cal-item data-stat-item data-rive-circuit-hover-target="${esc(r.circuitId)}" data-circuit="${esc(r.circuitId)}" tabindex="0" role="button" aria-label="${esc(r.name)}">
    ${r.hoverImg ? img(r.hoverImg, '', 'row-hover-img', ' data-stat-hover-img hidden') : ''}
    <div class="cell">${round(r.round)}</div>
    <div class="cell loc">${esc(r.location)} ${img(r.flag, '', 'flag')}</div>
    ${cols}
    ${withDash ? raceData(r) : ''}
  </div>`;
}

/** Hidden per-race dataset (the original "Track Stats" dash, data-nosnippet). */
function raceData(r) {
  const f = ['circuit-id', 'circuit-name', 'circuit-lap-amount', 'circuit-lap-length', 'circuit-distance', 'first-competed-date', 'date-actual',
    'date-from-to-num', 'date-from-to-month', 'prac1-date', 'prac1-time', 'prac2-date', 'prac2-time', 'prac3-date', 'prac3-time', 'qual-date', 'qual-time',
    'race-date', 'race-time', 'prac1-time-result', 'prac1-time-pos', 'prac2-time-result', 'prac2-time-pos', 'prac3-time-result', 'prac3-time-pos',
    'qual-time-result', 'qual-time-pos', 'race-time-result', 'race-time-pos'];
  const camel = (k) => k.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());
  return `<div class="race-data" data-nosnippet hidden>
    <span data-cal-list="name">${esc(r.name)}</span>
    ${f.map((k) => `<span data-cal-list="${k}">${esc(r[camel(k)])}</span>`).join('')}
    <div data-cal-list="circuit-about">${r.circuitAbout || ''}</div>
    ${r.flag ? `<img data-cal-list="circuit-flag" src="${esc(r.flag)}" alt="">` : ''}
    ${r.sprint ? '<span data-cal-sprint="true"></span>' : ''}
  </div>`;
}

/** Track visualiser: shows one race at a time; populated server-side with the current race. */
function trackVisualiser(races, initial, { id = '' } = {}) {
  const r = initial || {};
  const labels = sessionLabels(r.sprint);
  const past = Boolean(r.past);
  const sess = [['practice1', 'prac1'], ['practice2', 'prac2'], ['practice3', 'prac3'], ['qualifying', 'qual'], ['race', 'race']];
  const t = (name, val, cls = '') => `<span class="cal-target ${cls}" data-cal-target="${name}">${esc(val)}</span>`;
  return `
<div class="track-vis" data-cal-track-wrap${attr('id', id || null)}>
  <div class="tv-info">
    <div class="tv-when">${eyebrow('When')}<div class="tv-big">${t('date-from-to-num', r.dateFromToNum, 'c-lime')} ${t('date-from-to-month', r.dateFromToMonth)}</div></div>
    <div class="tv-stats" data-cal-target-group>
      <div>${eyebrow('Length')}<div class="tv-stat">${t('circuit-lap-length', r.circuitLapLength, 'c-lime')}<span class="unit">km</span></div></div>
      <div>${eyebrow('First Competed')}<div class="tv-stat">${t('first-competed-date', r.firstCompetedDate, 'c-lime')}</div></div>
      <div>${eyebrow('Distance')}<div class="tv-stat">${t('circuit-distance', r.circuitDistance, 'c-lime')}<span class="unit">km</span></div></div>
      <div>${eyebrow('Laps')}<div class="tv-stat">${t('circuit-lap-amount', r.circuitLapAmount, 'c-lime')}</div></div>
    </div>
    <div class="tv-about">
      <div class="eyebrow">lando at <span data-cal-target="circuit-name">${esc(r.circuitName)}</span></div>
      <div class="rich" data-cal-target="circuit-about">${r.circuitAbout || ''}</div>
    </div>
    <div class="tv-schedule">
      <div class="tv-sched-head"><span class="eyebrow" data-cal-target="results">${esc(scheduleHeader(past))}</span>
        <span class="eyebrow" data-cal-target="past-reveal"${past ? '' : ' hidden'}>Result</span>
        <span class="eyebrow" data-cal-target="past-reveal"${past ? '' : ' hidden'}>Time/Gap</span></div>
      ${sess.map(([label, key]) => `<div class="tv-row${key === 'race' ? ' is-race' : ''}">
        <span class="tv-label" data-cal-target-label="${label}">${esc(labels[label])}</span>
        ${t(`${key}-date`, sessionCell(r, `${key}Date`, past))}
        ${t(`${key}-time`, sessionCell(r, `${key}Time`, past))}</div>`).join('')}
      <div class="eyebrow c-grey" data-cal-target="past-hide"${past ? ' hidden' : ''}>*uk time</div>
    </div>
  </div>
  <div class="tv-visual">
    <div class="tv-circuit" data-track-canvas data-circuit="${esc(r.circuitId)}">
      ${circuit(r.circuitId, 'tv-circuit-rive', { color: 'color_lime', weight: 'weight_bold' })}
      <span class="tv-circuit-id" data-cal-target="circuit-id">${esc(r.circuitId)}</span>
    </div>
    <div class="tv-name title-lg" data-cal-target="circuit-name">${esc(r.circuitName)}</div>
    <img class="tv-flag" data-cal-target="circuit-flag" src="${esc(r.flag || '')}" alt="">
    <div class="tv-controls">
      <div data-cal-control="previous-item"><button class="btn-icon-only" data-btn-rive-hover aria-label="previous item">${arrowIcon('left')}</button></div>
      <span class="tv-counter" data-cal-counter aria-live="polite">${races.indexOf(initial) + 1} / ${races.length}</span>
      <div data-cal-control="next-item"><button class="btn-icon-only" data-btn-rive-hover aria-label="next item">${arrowIcon('right')}</button></div>
    </div>
  </div>
</div>`;
}

function countdown(race) {
  if (!race) return '';
  return `
<section class="s countdown" data-countdown-wrap>
  <div class="countdown-head">
    <div class="countdown-race">${circuit(race.circuitId, 'countdown-circuit', { color: 'color_lime' })}${img(race.flag, '', 'flag')}<span class="eyebrow">${esc(race.location)} gp</span></div>
    <div class="eyebrow">next race begins in...</div>
    <div class="eyebrow c-grey" data-countdown-date-target>${esc(race.dateActual)}</div>
  </div>
  ${phrase('race-day', 'race-day', 'countdown-phrase')}
  <div class="countdown-digits">
    ${[['day', 'D'], ['hour', 'h'], ['min', 'm'], ['sec', 's']].map(([k, u]) => `<div class="cd-cell"><span class="cd-num" data-countdown-digit="${k}">00</span><span class="cd-unit">${u}</span></div>`).join('')}
  </div>
</section>`;
}

function standingBlock(st) {
  return `<div class="standing">
    <div><div class="eyebrow">Standing</div><div class="stat-major">${position(ordinal(st.standing))}</div></div>
    <div><div class="eyebrow">Round</div><div class="stat-major">${esc(st.round)}</div></div>
  </div>`;
}

function listHead(cols) {
  return `<div class="race-head">${cols.map(([t, cls]) => `<div class="eyebrow ${cls || ''}">${t}</div>`).join('')}</div>`;
}

/** Floating circuit preview that follows the schedule rows (original "is-circuits" mouse-over). */
const circuitPreview = (id) => `<div class="mouse-preview is-circuits" data-mouse-track aria-hidden="true">
  <div class="eyebrow">circuit</div>${circuit(id, 'preview-circuit', { color: 'color_lime', hover: true })}<img alt=""></div>`;

// ------------------------------------------------------------------ pages
function home(c, st) {
  const s = c.site;
  const next = st.next;
  return `
<div class="page-home" data-page="home" data-taxi-view>
  <h1 class="sr-only">${esc(s.driver.name)}</h1>
  <h2 class="sr-only">${esc(s.driver.subtitle)}</h2>
  <section class="s hero" data-hero data-hero-animation-container data-nav-theme-target="dark">
    <canvas class="hero-canvas" data-hero-canvas data-face="${esc(s.images.heroFace)}" data-shadow="/assets/gl/textures_head_webp_shadow-softer-edit.webp" data-alpha="${esc(s.images.heroFaceAlpha)}" data-depth="/assets/gl/textures_head_webp_depth.webp" data-helmet-model="/assets/gl/helmet-21.glb" data-helmet-texture="/assets/gl/textures_helmet_gold_basecolor.webp" data-glass-texture="/assets/gl/textures_glass_webp_Norris_Glass_mat_BaseColor.webp" data-plastic-matcap="/assets/gl/textures_plastic_plastic__matcap-02.webp" data-helmet="${esc(c.helmets[0]?.img)}" aria-hidden="true"></canvas>
    <img src="${esc(s.images.heroFace)}" alt="" class="hero-fallback" data-hero-fallback>
    <div class="hero-name" aria-hidden="true"><img src="${esc(s.images.nameTextMobile)}" alt="Lando Norris Text"></div>
    <div class="hero-ui">
      ${next ? `<a href="/calendar" class="hero-next">
        <div class="eyebrow"${high()}>Next Race</div>
        <div class="hero-next-circuit">${circuit(next.circuitId, 'hero-circuit', { hover: true })}</div>
        <div class="eyebrow"${high()}>${esc(next.location)} gp</div></a>` : ''}
      <div class="hero-since" data-gl-helmet="hover">${helmet('', { kind: 'instant' })}<span class="eyebrow"${high()}>${esc(s.driver.team)}</span></div>
    </div>
    <div class="hero-touch" data-home-swipe-wrap>
      <span class="eyebrow" data-home-swipe-desc="unlocked">tap to lock</span>
      <span class="eyebrow" data-home-swipe-desc="locked" hidden>Back to scroll</span>
      <button class="btn-touch" data-home-swipe-toggle aria-pressed="false" aria-label="Enable helmet reveal by touch">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V5a1.5 1.5 0 0 1 3 0v5m0-1a1.5 1.5 0 0 1 3 0v2m0-1a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3.5 14a1.5 1.5 0 0 1 2.4-1.8L9 15" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>
    </div>
  </section>
  <section class="s marquee-hero hero-rive-tracker">
    <div class="hero-sig">${signature(s.images.signature, 'sig', { mode: 'scroll', target: '.hero-rive-tracker', start: 'top center', end: 'bottom 80%' })}<div class="eyebrow">Message from lando</div></div>
  </section>
  <section class="s manifesto">
    <div class="manifesto-eyebrow">${helmet()}${eyebrow(s.driver.team)}</div>
    <p class="impact-lg"${high('right', 'lime-off')}>${runs(s.home.manifesto)}</p>
  </section>
  ${horizontalGallery(c.galleries.home)}
  <section class="s otot" data-otot-section data-nav-theme-target="dark">
    <div class="otot-col">
      <h2 class="otot-title"><span class="font-brier"${high('right', 'dark-green-tint-1')}>ON</span> <span${high('right', 'dark-green-tint-1')}>TRACK</span></h2>
      ${phrase('phrase_on', 'phrase_on', 'otot-phrase', { start: 'top center' })}
      <p class="body-reg"${high('right', 'dark-green-tint-1', 200)}>${esc(s.home.onTrack.lead)} <span class="hl">${esc(s.home.onTrack.em)}</span>${esc(s.home.onTrack.rest)}</p>
      ${iconButton('/on-track', 'On Track', 'left')}
    </div>
    <div class="otot-media" data-otot-media>${img(s.images.ototHelmet, 'Lando Norris wearing a lime helmet, side profile', 'otot-img is-helmet')}${img(s.images.ototHead, 'Lando Norris wearing a fleece side profile', 'otot-img is-head')}</div>
    <div class="otot-col right">
      <h2 class="otot-title"><span class="font-brier"${high('left', 'dark-green-tint-1')}>OFF</span> <span${high('left', 'dark-green-tint-1')}>TRACK</span></h2>
      <p class="body-reg"${high('left', 'dark-green-tint-1', 200)}><span class="hl">${esc(s.home.offTrack.em)}</span>${esc(s.home.offTrack.rest)}</p>
      ${iconButton('/off-track', 'Off Track')}
    </div>
  </section>
  <section class="s otot-end">${img(s.images.ototEnd, 'Lando lifting helmet up', 'otot-end-img', ' data-img-highlight="top, lime"')}</section>
  ${helmetsSection(c)}
  <section class="s store" data-exe-section data-nav-theme-target="dark">
    <div class="store-copy">
      ${eyebrow(s.home.store.eyebrow, 'large', high('right', 'dark-green-tint-1'))}
      <h2 class="impact-md"${high('right', 'dark-green-tint-1')}>${esc(s.home.store.title[0])} <span class="hl">${esc(s.home.store.title[1])}</span></h2>
      <p class="body-reg"${high('right', 'dark-green-tint-1', 200)}>${esc(s.home.store.text)}</p>
      ${button(s.links.storePromo, s.home.store.cta, { external: true })}
    </div>
    <div class="store-media" data-store-media>${c.storePromo.map((u, i) => img(u, '', `store-img i${i}`)).join('')}</div>
  </section>
  <section class="s partners" data-nav-theme-target="dark">
    <div class="partners-copy">
      <h2 class="title-lg"${high('right', 'dark-green-tint-1')}>partners <span class="hl">&amp;campaigns</span></h2>
      <p class="body-reg"${high('right', 'dark-green-tint-1')}>${esc(s.home.partners.text)}</p>
      ${button(s.links.partnerships, s.home.partners.cta)}
    </div>
    ${phrase('collabs', 'page_home', 'partners-phrase', { start: 'top center' })}
    <div class="marquee" data-marquee data-marquee-direction="right" data-marquee-speed="40" data-marquee-duplicate="4">
      <div class="marquee-track">${c.partners.marqueeLogos.map((l) => img(l, '', 'marquee-logo')).join('')}</div>
    </div>
    <div class="marquee" data-marquee data-marquee-direction="left" data-marquee-speed="30" data-marquee-duplicate="4">
      <div class="marquee-track">${c.partners.cssMarqueeLogos.map((l) => img(l, '', 'marquee-logo')).join('')}</div>
    </div>
  </section>
  ${socialsSection(c, c.socials.home)}
  ${footer(c)}
</div>`;
}

function onTrack(c, st) {
  const s = c.site;
  const ot = s.onTrack;
  const prev = st.previous;
  const next = st.next;
  const upcoming = st.upcoming;
  const visInitial = upcoming[0] || st.races[st.races.length - 1];
  return `
<div class="page-on-track" data-page="on-track" data-taxi-view>
  <section class="s ot-hero" data-hero-animation-container data-nav-theme-target="light">
    <h1 class="ot-hero-title"><span class="font-brier">On</span> <span data-oval-scroll="top">TRACK</span></h1>
    ${phrase('phrase_on', 'phrase_on', 'ot-hero-phrase', { scroll: false })}
    <div class="ot-hero-meta">
      <div class="eyebrow hide-m"${high()}>last lap lando</div>
      <div class="stat-reg"${high()}>${esc(st.age)} y.o</div>
      <div class="stat-reg"${high()}>${esc(s.driver.hometown)} ${img(s.driver.hometownFlag, 'UK Flag', 'flag')}</div>
    </div>
    <div class="ot-hero-intro">
      ${eyebrow(s.driver.tagline)}
      <h2 class="body-lg"${high()}>${esc(ot.intro)} <span class="hl">${esc(ot.introEm)}</span>.</h2>
    </div>
    <div class="ot-hero-stats">
      ${prev ? `<div class="ot-stat-block hide-m" data-rive-circuit-hover-target="${esc(prev.circuitId)}">
        <div class="eyebrow"${high()}>previous</div>
        ${circuit(prev.circuitId, 'ot-stat-circuit')}
        <div class="ot-stat-row">${img(prev.flag, '', 'flag')}<span class="eyebrow">${esc(prev.location)} gp</span></div>
        <div class="stat-reg">${position(prev.finish || prev.finishNote)}</div>
      </div>` : ''}
      ${next ? `<div class="ot-stat-block">
        <div class="eyebrow"><span class="c-lime">Next</span> / Current</div>
        <div class="stat-reg">Rnd. ${esc(next.round)}</div>
        ${circuit(next.circuitId, 'ot-stat-circuit', { color: 'color_lime' })}
        <div class="ot-stat-row">${img(next.flag, '', 'flag')}<span class="eyebrow">${esc(next.location)}</span></div>
        <div class="eyebrow">${esc(next.dateFromToNum)} ${esc(next.dateFromToMonth)}</div>
      </div>` : ''}
      ${helmet('ot-hero-helmet', { kind: 'play', color: 'color_grey-on-track' })}
    </div>
  </section>
  <section class="s manifesto">
    ${signature(s.images.signature, 'manifesto-sig', { mode: 'play', color: 'color_grey-on-track' })}
    ${eyebrow(s.driver.team)}
    <p class="impact-lg" data-oval-scroll="top">${runs(ot.impact)}</p>
    ${helmet('ot-3d-helmet', { kind: '3d', color: 'color_lime' })}
  </section>
  <section class="s podiums" data-podium="wrap">
    <div class="podium-num text-on-t-stat-label-gigantic" data-podium-num>${ot.podiums}</div>
    <div class="podium-label" data-podium="text">podiums</div>
    <div class="podium-media" data-podium-media data-mouse-area>${c.podiumMedia.map((u, i) => img(u, '', 'podium-img', ` data-index="${i}"`)).join('')}
      <div class="mouse-preview" data-mouse-track aria-hidden="true"><img alt=""></div></div>
  </section>
  <section class="s career">
    <div class="career-intro">
      <h2 class="title-lg"${high()}>f1 career <span class="hl">since 2019</span></h2>
      ${img(s.images.careerCar, 'Lando in F1 car', 'career-img', ' data-img-highlight="top, lime"')}
    </div>
    <div class="career-grid">
      <div class="career-stat"><h3 class="descriptor"${high()}>formula 1 wins</h3>${phrase('phrase_p1', 'phrase_p1', 'career-phrase')}<div class="num-lg" data-car-counter="digit">${ot.career.wins}</div></div>
      <div class="career-stat"><h3 class="descriptor"${high()}>pole positions</h3><div class="num-lg" data-car-counter="digit">${ot.career.poles}</div></div>
      <div class="career-stat"><h3 class="descriptor"${high()}>average finish</h3><div class="num-lg"><span data-car-counter="digit">${esc(ot.career.averageFinish.split('.')[0])}</span><span class="c-grey">.<span data-car-counter="digit">${esc(ot.career.averageFinish.split('.')[1])}</span></span></div></div>
      <div class="career-stat"><h3 class="descriptor"${high()}>fastest laps</h3><div class="num-lg" data-car-counter="digit">${ot.career.fastestLaps}</div></div>
    </div>
    <div class="seasons" data-stat-list>
      <div class="seasons-head"><span class="eyebrow">F1 Seasons</span><span class="eyebrow">Year</span><span class="eyebrow">Finish</span><span class="eyebrow">Podiums</span></div>
      ${ot.seasons.map((x) => `<div class="season-row" data-stat-item><span></span><h3 class="stat-reg">${esc(x.year)}</h3><div class="stat-reg">${position(x.finish)}</div><div class="stat-reg">${esc(x.podiums)}</div></div>`).join('')}
      ${button('/calendar', 'full schedule & results')}
    </div>
  </section>
  <section class="s highlights">
    <div class="section-head">
      <h2 class="title-lg"${high()}>f1 result <span class="hl">highlights</span></h2>
      <p class="body-reg"${high('right', 'lime', 200)}>${esc(ot.highlightsIntro)}</p>
    </div>
    ${listHead([['series', 'hide-m'], ['Name'], ['When', 'hide-m'], ['Finish'], ['Time / Gap', 'hide-m']])}
    <div class="race-list" data-mouse-area="highlights" data-stat-list>
      ${c.highlights.map((h) => `<div class="race-row is-highlight" data-stat-item>
        ${img(h.hoverImg, '', 'row-hover-img', ' data-stat-hover-img hidden')}
        <div class="cell hide-m">${esc(h.series)}</div>
        <div class="cell loc">${esc(h.name)} ${img(h.flag, '', 'flag')}</div>
        <div class="cell hide-m">${esc(h.date)} <span class="c-grey">${esc(h.year)}</span></div>
        <div class="cell">${position(h.finish)}${h.trophy?.img ? `<span class="trophy is-${h.trophy.kind}">${img(h.trophy.img, '')}</span>` : ''}</div>
        <div class="cell hide-m">${esc(h.time)} <span class="c-grey">${esc(h.gap)}</span><span class="c-grey unit">s</span></div>
      </div>`).join('')}
      <div class="mouse-preview" data-mouse-track aria-hidden="true"><img alt=""></div>
    </div>
  </section>
  ${horizontalGallery(c.galleries.onTrack)}
  <section class="s pre-f1">
    ${img(s.images.preF1Car, 'Lando spraying champagne', 'pre-f1-img', ' data-img-highlight="top, lime"')}
    <div class="section-head">
      <h2 class="title-lg"${high()}>pre-f1 career <span class="hl">2007-2019</span></h2>
      <p class="body-reg"${high('right', 'lime', 200)}>${esc(ot.preF1Intro)}</p>
    </div>
    <div class="pre-f1-list" data-stat-list>
      ${img(s.images.preF1Win, 'Lando in celebrating win', 'pre-f1-win hide-m', ' data-img-highlight="top, lime"')}
      ${ot.preF1.map((t) => `<div class="pre-f1-item${t.major ? ' is-major' : ''}" data-stat-item>${helmet('pre-f1-icon', { kind: 'reef', color: t.major ? 'color_lime' : 'color_grey-on-track' })}<div class="stat-reg">${esc(t.title)}</div><div class="descriptor">${esc(t.year)}</div></div>`).join('')}
    </div>
  </section>
  ${countdown(next)}
  <section class="s on-t-calendar">
    ${trackVisualiser(upcoming.length ? upcoming : st.races, visInitial)}
    <div class="section-head with-side">
      <div>
        <h2 class="title-lg"${high()}>upcominG <span class="hl">${esc(c.site.calendar.season)} schedule</span></h2>
        <p class="body-reg"${high('right', 'dark-green-tint-1')}>${esc(ot.scheduleIntro)}</p>
      </div>
      ${standingBlock(st)}
      ${button('/calendar', 'see full schedule', { variant: 'hide-m' })}
    </div>
    ${listHead([['Rnd'], ['Location'], ['When', 'hide-m'], ['Laps'], ['Distance', 'hide-m']])}
    <div class="race-list" data-cal-wrap data-mouse-area="schedule" data-stat-list>
      ${upcoming.map((r) => raceRow(r, 'upcoming')).join('') || '<p class="empty">Season complete — no upcoming races.</p>'}
      ${circuitPreview(visInitial?.circuitId || 'monaco')}
    </div>
    ${button('/calendar', 'view full schedule', { variant: 'show-m' })}
  </section>
  <section class="s otot-end">${img(s.images.onTrackEnd, 'Lando Norris holding up a helmet with flight cases in the background', 'otot-end-img', ' data-img-highlight="top, lime"')}</section>
  ${helmetsSection(c, { onTrack: true })}
  ${footer(c)}
</div>`;
}

function offTrack(c) {
  const s = c.site;
  return `
<div class="page-off-track" data-page="off-track" data-taxi-view>
  <section class="s offt-hero" data-hero-animation-container data-nav-theme-target="dark">
    <h1 class="ot-hero-title" data-oval-scroll="bottom"><span class="font-brier">OFF</span> <span>TRACK</span></h1>
    <div class="ot-hero-meta"><div class="quote"${high()}>${esc(s.driver.name)}</div><div class="quote"${high()}>${esc(c.__age)} y.o</div>${helmet('offt-hero-icon', { kind: 'off-icons' })}</div>
    <div class="ot-hero-intro">
      ${eyebrow(s.driver.tagline)}
      <h2 class="body-lg"${high()}>${esc(s.offTrack.intro)} <span class="hl">${esc(s.offTrack.introEm)}</span>.</h2>
      ${signature(s.images.signatureDark, 'offt-sig', { mode: 'play', color: 'color_dark-green-tint-2' })}
      <p class="body-sm"${high()}>${esc(s.offTrack.note)}</p>
    </div>
    <div class="offt-hero-media" data-hero-cycle>
      ${c.offTrack.heroMedia.map((u, i) => img(u, '', `offt-hero-img${i === 0 ? ' is-active' : ''}`, ` data-index="${i}"`)).join('')}
    </div>
    <div class="marquee hide-m" data-marquee data-marquee-direction="right" data-marquee-speed="40" data-marquee-duplicate="4">
      <div class="marquee-track">${c.partners.marqueeLogos.slice(0, 6).map((l) => img(l, '', 'marquee-logo')).join('')}</div>
    </div>
  </section>
  <section class="s manifesto">
    ${helmet('', { kind: 'off-icons-reef' })}
    ${eyebrow(s.driver.team)}
    <p class="impact-lg" data-oval-scroll="top">${runs(s.onTrack.impact)}</p>
    ${signature(s.images.signatureDark, 'offt-sig-scroll', { mode: 'scroll', color: 'color_dark-green-tint-2' })}
  </section>
  ${horizontalGallery(c.galleries.offTrack)}
  ${socialsSection(c, c.socials.offTrack)}
  ${footer(c)}
</div>`;
}

function calendar(c, st) {
  const s = c.site;
  const initial = st.races[st.currentIndex];
  return `
<div class="page-calendar" data-page="calendar" data-taxi-view>
  <section class="s cal-hero" data-hero-animation-container data-nav-theme-target="light">
    <h1 class="impact-lg" data-oval-scroll="top">Upcoming <span class="hl">${esc(s.calendar.season)} calendar</span></h1>
    ${signature(s.images.signature, 'cal-sig', { mode: 'play' })}
  </section>
  <section class="s on-t-calendar">
    <div class="section-head with-side">
      <h2 class="body-lg" data-oval-scroll>${esc(s.calendar.lead)}</h2>
      ${standingBlock(st)}
      <div class="btn-row">
        <a href="#track-vis" class="btn btn-tertiary" data-btn-rive-hover>track visualiser ${arrowIcon('down')}</a>
        <a href="#calendar-upcoming" class="btn btn-tertiary" data-btn-rive-hover>calendar list ${arrowIcon('down')}</a>
      </div>
    </div>
    ${trackVisualiser(st.races, initial, { id: 'track-vis' })}
    <div data-cal-wrap id="calendar-upcoming">
      ${st.past.length ? `${listHead([['Rnd'], ['Location'], ['When', 'hide-m'], ['Finish'], ['fastest lap', 'hide-m']])}
      <div class="race-list" data-mouse-area="highlights" data-stat-list>${st.past.map((r) => raceRow(r, 'previous')).join('')}
        <div class="mouse-preview" data-mouse-track aria-hidden="true"><img alt=""></div></div>` : ''}
      ${st.upcoming.length ? `${listHead([['Rnd'], ['Location'], ['When', 'hide-m'], ['Laps'], ['Distance', 'hide-m']])}
      <div class="race-list" data-mouse-area="schedule" data-stat-list>${st.upcoming.map((r) => raceRow(r, 'upcoming')).join('')}
        ${circuitPreview(st.next?.circuitId || 'monaco')}</div>` : ''}
    </div>
  </section>
  <section class="s history">
    <div class="section-head">
      <h2 class="title-lg" data-oval-scroll>Formula 1 <span class="hl">All Results</span></h2>
      <p class="body-reg c-grey"${high('right', 'dark-green-tint-1')}>${esc(s.calendar.historyIntro)}</p>
    </div>
    ${listHead([['Year'], ['Finish'], ['Podiums']])}
    <div class="history-list" data-calendar-history="wrap">
      ${c.history.map((h) => `<div class="history-item" data-calendar-history="item">
        <div class="history-trigger" data-calendar-history="trigger">
          <h3 class="stat-major">${esc(h.year)}</h3><div class="stat-major">${position(h.finish)} ${helmet('history-icon', { kind: 'reef', color: 'color_lime' })}</div><div class="stat-major">${esc(h.podiums)}</div>
          <span class="history-chevron">${arrowSvg('down')}</span>
        </div>
        <div class="history-content" data-calendar-history="content">
          ${listHead([['Rnd'], ['Location'], ['When', 'hide-m'], ['Finish'], ['fastest lap', 'hide-m']])}
          <div class="race-list" data-stat-list>
            ${h.races.map((r) => `<div class="race-row is-previous is-history" data-stat-item>
              ${img(r.hoverImg, '', 'row-hover-img', ' data-stat-hover-img hidden')}
              <div class="cell">${round(r.round)}</div>
              <div class="cell loc"><h4>${esc(r.location)}</h4> ${img(r.flag, '', 'flag')}</div>
              <div class="cell hide-m">${esc(r.date)} <span class="c-grey">${esc(r.year)}</span></div>
              <div class="cell">${position(r.finish || '-')}${r.trophy?.img ? `<span class="trophy is-${r.trophy.kind}">${img(r.trophy.img, '')}</span>` : ''}</div>
              <div class="cell hide-m">${esc(r.fastestLap || '-')}<span class="c-grey unit">s</span></div>
            </div>`).join('')}
            <div class="mouse-preview" data-mouse-track aria-hidden="true"><img alt=""></div>
          </div>
        </div>
      </div>`).join('')}
    </div>
  </section>
  ${footer(c)}
</div>`;
}

function legal(c, slug) {
  const doc = c.legal[slug];
  return `
<div class="page-legal" data-page="legal" data-taxi-view>
  <section class="s legal" data-nav-theme-target="light"><article class="rich legal-body">${doc.html}</article></section>
  ${footer(c)}
</div>`;
}

function notFound(c) {
  return `
<div class="page-not-found" data-page="not-found" data-taxi-view>
  <section class="s not-found" data-nav-theme-target="light">
    <div class="nf-visual" data-nf-visual data-variant="lime" style="--nf-mask:url('${esc(c.site.images.notFound)}')">
      ${helmet('nf-helmet', { kind: 'instant', color: 'color_lime' })}
    </div>
    <h2 class="title-reg">Page Not Found</h2>
    <p class="eyebrow">Veered off track</p>
    <div class="nf-switchers" role="group" aria-label="Helmet style">
      ${['lime', 'dark', 'grid', 'google'].map((v, i) => `<button class="nf-switch${i === 0 ? ' is-active' : ''}" data-gl-switcher="${v}" aria-pressed="${i === 0}">${i + 1}</button>`).join('')}
    </div>
    ${button('/', 'Go to Home', { rotate: true })}
  </section>
</div>`;
}

// ------------------------------------------------------------------ document
const META = {
  home: 'McLaren Formula 1 Driver — Lando Norris',
  'on-track': 'On Track — Lando Norris',
  'off-track': 'Off Track — Lando Norris',
  calendar: 'Calendar — Lando Norris',
  legal: 'Legal — Lando Norris',
  'not-found': 'Not Found',
};

export function renderPage(route, now = new Date()) {
  const c = content();
  const st = season(now);
  let body;
  let key = route.page;
  switch (route.page) {
    case 'home': body = home(c, st); break;
    case 'on-track': body = onTrack(c, st); break;
    case 'off-track': body = offTrack({ ...c, __age: st.age }); break;
    case 'calendar': body = calendar(c, st); break;
    case 'legal': body = legal(c, route.slug); break;
    default: key = 'not-found'; body = notFound(c);
  }
  const s = c.site;
  return `<!doctype html>
<html lang="en" data-page-key="${esc(key)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(META[key])}</title>
<meta name="description" content="${esc(s.driver.name)} — ${esc(s.driver.subtitle)}. Results, calendar, helmets and more.">
<meta property="og:title" content="${esc(META[key])}">
<link rel="icon" href="/assets/img/67b5a0969616f526f020ec0e_ln-favicon.png">
<link rel="apple-touch-icon" href="/assets/img/67b5a098cbef46b41e40dfd2_ln-webclip.png">
<link rel="preload" href="/assets/fonts/67bc6274c5b4108b123aa4d5_MonaSans-VariableFont_wdth-wght.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/67b6113a220f85ad6497495a_Brier-Bold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/site.css">
<script type="importmap">{"imports":{"gsap":"/vendor/gsap/index.js","gsap/":"/vendor/gsap/","lenis":"/vendor/lenis/lenis.mjs","three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script>
<script src="/vendor/rive/rive.js" defer></script>
<script type="module" src="/js/app.mjs"></script>
</head>
<body class="is-loading">
<div class="transition-w" data-loader role="status" aria-live="polite">
  <canvas class="transition-canvas" data-rive-primary aria-hidden="true"></canvas>
  <div class="loader-inner">
    <div class="loader-bar"><span data-loader-progress></span></div>
    <button class="btn btn-lime transition-btn" data-loader-btn data-anim="text-hover"><span class="btn-text" split-text="chars">Load Norris</span></button>
  </div>
</div>
<div class="mob-landscape" data-mob-landscape hidden>
  <div><canvas class="rive mob-landscape-rive" data-rive-mob-landscape aria-hidden="true"></canvas>
  <p>Please rotate your device,<br><span class="c-lime">This is a vertical drive.</span></p></div>
</div>
${nav(c, key)}
<main class="main" data-taxi>
${body}
</main>
</body>
</html>`;
}

/** Route table. `/partnerships` is linked by the original but answers 404 there too. */
export function resolveRoute(pathname) {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/' || p === '/index.html') return { page: 'home' };
  if (p === '/on-track') return { page: 'on-track' };
  if (p === '/off-track') return { page: 'off-track' };
  if (p === '/calendar') return { page: 'calendar' };
  const legalMatch = p.match(/^\/legal\/(terms-conditions|privacy-policy)$/);
  if (legalMatch) return { page: 'legal', slug: legalMatch[1] };
  return { page: 'not-found', status: 404 };
}
