// Client runtime. Each module mirrors one behaviour observed in the original bundle;
// comments name the original function/attribute contract it reproduces.
import {
  parseCountdownTarget, countdownParts, parseRaceDay, startOfToday, stepIndex,
  splitPosition, sessionLabels, sessionCell, scheduleHeader, hoverImageIndex,
} from './lib/rules.mjs';
import * as rive from './rive.mjs';
import { createAnims } from './anims.mjs';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const isDesktop = () => window.innerWidth >= 992;
// The original site animates regardless of the OS "reduce motion" setting; so does this rebuild.
// Set REDUCE_MOTION = true to honour prefers-reduced-motion instead.
const REDUCE_MOTION = false;
const reduced = () => REDUCE_MOTION && matchMedia('(prefers-reduced-motion: reduce)').matches;

document.documentElement.classList.add('js');

let gsap = null;
let ScrollTrigger = null;
let SplitText = null;
let lenis = null;
let anims = null;
let globalAnims = null;
let hero = null;

async function loadLibs() {
  try {
    ({ gsap } = await import('gsap'));
    ({ ScrollTrigger } = await import('gsap/ScrollTrigger.js'));
    ({ SplitText } = await import('gsap/SplitText.js'));
    gsap.registerPlugin(ScrollTrigger, SplitText);
    document.documentElement.classList.add('js-anim');
    rive.setLibs({ gsap, ScrollTrigger });
  } catch (e) { console.warn('GSAP unavailable, using CSS fallbacks', e); }
  try {
    if (isDesktop()) {
      const { default: Lenis } = await import('lenis');
      lenis = new Lenis({ lerp: 0.1 });
      window.lenis = lenis;
      if (ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
      if (gsap) { gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); } else {
        const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
        requestAnimationFrame(raf);
      }
    }
  } catch (e) { console.warn('Lenis unavailable, native scrolling', e); }
}

function scrollToY(y) {
  if (lenis) lenis.scrollTo(y, { duration: 1.2, easing: (v) => (v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2) });
  else window.scrollTo({ top: y, behavior: reduced() ? 'auto' : 'smooth' });
}

// ---------------------------------------------------------------- page lifecycle
let cleanups = [];
const onCleanup = (fn) => cleanups.push(fn);
function listen(target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  onCleanup(() => target.removeEventListener(type, fn, opts));
}

function destroyPage() {
  cleanups.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  cleanups = [];
  if (ScrollTrigger) ScrollTrigger.getAll().forEach((t) => t.kill());
}

const PAGE_MODULES = [
  countdown, calendarSync, calendarHistory, mouseFollow, podiumHover,
  helmetGrid, horizontalGallery, marquees, otot, swipeLock, videoStreams,
  heroCycle, notFoundSwitcher, anchorLinks, navTheme, riveModule, animModule, heroGLModule,
];

function initPage() {
  const view = $('[data-taxi-view]');
  if (!view) return;
  for (const mod of PAGE_MODULES) {
    try { mod(view); } catch (e) { console.error(`module ${mod.name} failed`, e); }
  }
  if (ScrollTrigger) requestAnimationFrame(() => ScrollTrigger.refresh());
}

/** Rive canvases of the page (reef, signature, circuits, btn-ui, phrases). */
function riveModule(view) {
  let dispose = null;
  let dead = false;
  rive.initRive(view).then((d) => { if (dead) d(); else dispose = d; });
  onCleanup(() => { dead = true; dispose?.(); });
}

/** GSAP + SplitText text/list/image animations. */
function animModule(view) {
  if (!gsap || !SplitText) {
    view.querySelectorAll('[data-anim-high], [data-oval-scroll]').forEach((e) => { e.style.visibility = 'visible'; });
    return;
  }
  const a = createAnims({ gsap, ScrollTrigger, SplitText });
  anims = a;
  a.init(view).then(() => { if (pageShown && anims === a) a.playHero(); });
  onCleanup(() => a.destroy());
}

/** WebGL hero (home only). */
function heroGLModule(view) {
  const canvas = $('[data-hero-canvas]', view);
  if (!canvas) return;
  let dead = false;
  import('./hero-gl.mjs')
    .then(({ createHeroGL }) => createHeroGL(canvas, { gsap, ScrollTrigger, isLocked: () => heroLocked }))
    .then((h) => {
      if (dead) { h?.destroy(); return; }
      hero = h;
      if (!h) document.documentElement.classList.add('no-canvas');
      else if (pageShown) h.playReveal();
    })
    .catch((e) => { console.error('hero gl', e); document.documentElement.classList.add('no-canvas'); });
  onCleanup(() => { dead = true; hero?.destroy(); hero = null; });
}

let pageShown = false;
/** k0 + o0: hero containers animate once the page is revealed (750ms after transition-in). */
function playHeroAnimations() {
  pageShown = true;
  setTimeout(() => {
    anims?.playHero();
    rive.playHero(document);
    hero?.playReveal();
  }, 750);
}

// ---------------------------------------------------------------- loader ("Load Norris", page-transition.riv)
async function loader() {
  const el = $('[data-loader]');
  if (!el) return;
  const bar = $('[data-loader-progress]', el);
  // Only images in the first viewport: lazy images further down never load before scrolling.
  const imgs = $$('img', $('[data-taxi-view]')).filter((i) => i.getBoundingClientRect().top < window.innerHeight).slice(0, 12);
  imgs.forEach((i) => { i.loading = 'eager'; });
  let done = 0;
  const total = imgs.length + 2;
  const tick = () => { done += 1; bar.style.width = `${Math.round((done / total) * 100)}%`; };
  const waits = imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => {
    i.addEventListener('load', r, { once: true });
    i.addEventListener('error', r, { once: true });
  })).then(tick));
  const fonts = (document.fonts?.ready || Promise.resolve()).then(tick);
  const riveFiles = rive.preload().catch(() => {}).then(tick);
  const timeout = new Promise((r) => setTimeout(r, 4000));
  await Promise.race([Promise.all([...waits, fonts, riveFiles]), timeout]);
  bar.style.width = '100%';
  el.classList.add('is-ready');
  // Original: transition-in fires 1s after the basic initialisation.
  await new Promise((r) => setTimeout(r, 1000));
  document.body.classList.remove('is-loading');
  rive.transitionIn();
  playHeroAnimations();
}

// ---------------------------------------------------------------- nav menu (original menu timeline X)
let navHelmet = null;
function navMenu() {
  const ham = $('[data-nav-ham]');
  const menu = $('[data-nav-m]');
  const nav = $('[data-nav-wrap]');
  if (!ham || !menu) return;
  const imgs = $$('[data-nav-img]', menu).sort((a, b) => a.dataset.navImg - b.dataset.navImg);
  const links = $$('[data-nav-link]', menu);
  const setImg = (i) => imgs.forEach((x) => x.classList.toggle('is-active', x.dataset.navImg === String(i)));
  let open = false;
  let tl = null;
  let prevTheme = null;

  function build() {
    if (!gsap) return null;
    if (tl) return tl;
    const hl = globalAnims ? globalAnims.menuHighlights(menu) : [];
    const helmet = { v: 0 };
    gsap.set(menu, { clipPath: 'ellipse(120% 0% at 50% 0%)' });
    gsap.set(imgs, { clipPath: 'ellipse(120% 0% at 50% 0%)', y: 25 });
    gsap.set(links, { clipPath: 'ellipse(30% 0% at 50% 0%)', y: 20 });
    hl.forEach(({ el, bar }) => { gsap.set(el, { clipPath: 'inset(0 100% 0 0)', y: 15 }); gsap.set(bar, { scaleX: 1 }); });
    tl = gsap.timeline({
      paused: true,
      onStart: () => {
        lenis?.stop();
        if (navHelmet?.scroll) { navHelmet.scroll.value = 0; navHelmet.inst.play(); }
      },
      onReverseComplete: () => {
        lenis?.start();
        navHelmet?.inst.pause();
        if (navHelmet?.scroll) navHelmet.scroll.value = 0;
      },
    });
    tl.to(menu, { clipPath: 'ellipse(120% 100% at 50% 20%)', duration: 0.8, ease: 'power3.out' }, 0);
    tl.to(imgs, { clipPath: 'ellipse(120% 100% at 50% 20%)', y: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out' }, 0.15);
    tl.to(links, { clipPath: 'ellipse(120% 100% at 50% 20%)', y: 0, duration: 0.6, stagger: 0.08, ease: 'back.out(1.2)' }, 0.35);
    tl.to(helmet, {
      v: 1000, duration: 1.7,
      onUpdate: () => {
        if (!navHelmet?.scroll) return;
        navHelmet.scroll.value = Math.round(helmet.v);
        if (!navHelmet.inst.isPlaying) navHelmet.inst.play();
      },
    }, 0.2);
    if (hl.length) {
      tl.to(hl.map((h) => h.el), { clipPath: 'inset(0 0% 0 0)', y: 0, duration: 0.7, stagger: 0.04, ease: 'back.out(1.1)' }, 0.5);
      tl.to(hl.map((h) => h.bar), { scaleX: 0, duration: 0.6, stagger: 0.05, ease: 'power2.inOut' }, 0.7);
    }
    return tl;
  }

  const set = (next) => {
    if (next === open) return;
    open = next;
    document.body.classList.toggle('menu-open', open);
    ham.setAttribute('aria-expanded', String(open));
    ham.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', String(!open));
    rive.setHamClosed(open);
    if (open) {
      setImg(($('.nav-menu-link.is-current', menu)?.dataset.navLink) || 1);
      prevTheme = nav.dataset.navTheme;
      nav.dataset.navTheme = 'dark';
      rive.setNavColor('transparent');
      rive.setLogoColor('white');
      if (build()) tl.timeScale(1).play(); else lenis?.stop();
    } else {
      if (prevTheme) nav.dataset.navTheme = prevTheme;
      rive.setNavColor(prevTheme === 'light' ? 'white' : 'transparent');
      rive.setLogoColor(prevTheme === 'dark' ? 'white' : 'black');
      if (tl) tl.timeScale(1.5).reverse(); else lenis?.start();
      setTimeout(() => window.dispatchEvent(new Event('nav:update')), 50);
    }
  };
  ham.addEventListener('click', () => set(!open));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  links.forEach((a) => {
    a.addEventListener('mouseenter', () => setImg(a.dataset.navLink));
    a.addEventListener('focus', () => setImg(a.dataset.navLink));
  });
  window.closeMenu = () => set(false);
}

/** Nav colour follows the background under it (original: data-nav-theme-target sections + Rive inputs). */
function navTheme() {
  const nav = $('[data-nav-wrap]');
  if (!nav) return;
  const lum = (rgb) => {
    const m = rgb.match(/\d+(\.\d+)?/g);
    if (!m || (m[3] !== undefined && Number(m[3]) === 0)) return null;
    const [r, g, b] = m.map(Number);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };
  const update = () => {
    const stack = document.elementsFromPoint(window.innerWidth / 2, 30);
    for (const el of stack) {
      if (nav.contains(el) || el.closest('[data-nav-m], [data-loader], .page-transition')) continue;
      const l = lum(getComputedStyle(el).backgroundColor);
      if (l !== null) {
        if (document.body.classList.contains('menu-open')) return;
        const theme = l < 0.5 ? 'dark' : 'light';
        if (nav.dataset.navTheme !== theme) {
          nav.dataset.navTheme = theme;
          rive.setNavColor(theme === 'light' ? 'white' : 'transparent');
          rive.setLogoColor(theme === 'dark' ? 'white' : 'black');
        }
        return;
      }
    }
  };
  update();
  listen(window, 'scroll', update, { passive: true });
  listen(window, 'nav:update', update);
}

// ---------------------------------------------------------------- countdown (original S$)
function countdown(view) {
  $$('[data-countdown-wrap]', view).forEach((wrap) => {
    const src = $('[data-countdown-date-target]', wrap);
    const digits = $$('[data-countdown-digit]', wrap);
    if (!src || digits.length !== 4) return;
    const target = parseCountdownTarget(src.textContent);
    if (!target) return;
    const paint = () => countdownParts(target, new Date()).forEach((v, i) => { digits[i].textContent = v; });
    paint();
    const id = setInterval(paint, 1000);
    onCleanup(() => clearInterval(id));
  });
}

// ---------------------------------------------------------------- calendar sync + track visualiser (original j$)
function calendarSync(view) {
  const wrap = $('[data-cal-wrap]', view);
  const track = $('[data-cal-track-wrap]', view);
  if (!wrap || !track) return;
  const today = startOfToday(new Date());
  const items = $$('[data-cal-item]', wrap).map((el) => {
    const date = parseRaceDay($('[data-cal-list="date-actual"]', el)?.textContent.trim());
    if (date && date < today) el.classList.add('is-in-past');
    return { el, date };
  });
  if (!items.length) return;
  items.sort((a, b) => { if (!a.date) return 1; if (!b.date) return -1; return a.date - b.date; });
  let index = items.findIndex((x) => x.date && x.date >= today);
  if (index === -1) index = items.length - 1;

  const field = (el, k) => $(`[data-cal-list="${k}"]`, el)?.textContent; // undefined when the source is missing
  const camel = (k) => k.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
  const raceOf = (el) => {
    const r = { sprint: Boolean($('[data-cal-sprint="true"]', el)) };
    $$('[data-cal-list]', el).forEach((n) => { r[camel(n.dataset.calList)] = n.tagName === 'IMG' ? n.getAttribute('src') : n.textContent; });
    return r;
  };
  const counter = $('[data-cal-counter]', track);

  function paint(i) {
    const { el } = items[i];
    const past = el.classList.contains('is-in-past');
    const r = raceOf(el);
    $$('[data-cal-target]', track).forEach((t) => {
      const key = t.dataset.calTarget;
      if (key === 'past-reveal') { t.hidden = !past; return; }
      if (key === 'past-hide') { t.hidden = past; return; }
      if (key === 'circuit-flag') { const s = $('[data-cal-list="circuit-flag"]', el)?.getAttribute('src'); if (s) t.src = s; return; }
      if (key === 'circuit-about') { t.innerHTML = $('[data-cal-list="circuit-about"]', el)?.innerHTML ?? ''; return; }
      if (key === 'results') { t.textContent = scheduleHeader(past); return; }
      const m = key.match(/^(prac1|prac2|prac3|qual|race)-(date|time)$/);
      if (m) { t.textContent = sessionCell(r, camel(key), past); return; }
      const v = field(el, key);
      if (v !== undefined) t.textContent = v;
    });
    const labels = sessionLabels(r.sprint);
    $$('[data-cal-target-label]', track).forEach((l) => { l.textContent = labels[l.dataset.calTargetLabel] ?? l.textContent; });
    $$('[data-track-canvas]', track).forEach((c) => {
      c.dataset.circuit = r.circuitId;
      const cv = c.querySelector('canvas[data-rive-file="circuits"]');
      if (cv) { cv.dataset.riveInputTrack = r.circuitId; rive.setTrack(cv, r.circuitId); }
    });
    items.forEach((x) => x.el.classList.remove('is-active'));
    el.classList.add('is-active');
    if (counter) counter.textContent = `${i + 1} / ${items.length}`;
  }

  function go(i) {
    index = i;
    if (reduced()) { paint(index); return; }
    track.classList.add('is-switching');
    setTimeout(() => { paint(index); track.classList.remove('is-switching'); }, 450);
  }

  paint(index);
  const next = $('[data-cal-control="next-item"]', track);
  const prev = $('[data-cal-control="previous-item"]', track);
  if (next) listen(next, 'click', (e) => { e.preventDefault(); go(stepIndex(index, items.length, 1)); });
  if (prev) listen(prev, 'click', (e) => { e.preventDefault(); go(stepIndex(index, items.length, -1)); });
  items.forEach((x, i) => {
    const pick = () => {
      go(i);
      const offset = 8 * parseFloat(getComputedStyle(document.documentElement).fontSize);
      scrollToY(window.scrollY + track.getBoundingClientRect().top - offset);
    };
    listen(x.el, 'click', pick);
    listen(x.el, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });
}

// ---------------------------------------------------------------- season history accordion (original S_)
function calendarHistory(view) {
  $$('[data-calendar-history="wrap"]', view).forEach((wrap) => {
    const items = $$('[data-calendar-history="item"]', wrap);
    const parts = items.map((item) => {
      const trigger = $('[data-calendar-history="trigger"]', item);
      const content = $('[data-calendar-history="content"]', item);
      content.id ||= `calendar-history-content-${Math.random().toString(36).slice(2, 10)}`;
      content.style.display = 'none';
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('tabindex', '0');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', content.id);
      if (!trigger.hasAttribute('aria-label')) trigger.setAttribute('aria-label', trigger.textContent.trim().replace(/\s+/g, ' ') || 'Toggle calendar history item');
      content.setAttribute('role', 'region');
      content.setAttribute('aria-hidden', 'true');
      return { item, trigger, content };
    });
    const setOpen = (p, open) => {
      p.item.classList.toggle('is-open', open);
      p.content.style.display = open ? 'block' : 'none';
      p.trigger.setAttribute('aria-expanded', String(open));
      p.content.setAttribute('aria-hidden', String(!open));
    };
    parts.forEach((p) => {
      const toggle = () => {
        const wasOpen = p.item.classList.contains('is-open');
        parts.forEach((o) => { if (o !== p && o.item.classList.contains('is-open')) setOpen(o, false); });
        setOpen(p, !wasOpen);
        if (!wasOpen) {
          setTimeout(() => {
            const top = p.item.getBoundingClientRect().top;
            if (top < 0 || top > window.innerHeight * 0.3) scrollToY(window.scrollY + top - 100);
          }, 10);
          ScrollTrigger?.refresh();
        }
      };
      listen(p.trigger, 'click', toggle);
      listen(p.trigger, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
  });
}

// ---------------------------------------------------------------- mouse-follow row previews (original T$)
function mouseFollow(view) {
  if (matchMedia('(hover: none)').matches) return;
  $$('[data-stat-list]', view).forEach((list) => {
    const preview = $(':scope > [data-mouse-track]', list);
    if (!preview) return;
    const pimg = $('img', preview);
    let shown = false;
    const move = (e) => {
      const row = e.target.closest('[data-stat-item]');
      const isCircuit = preview.classList.contains('is-circuits');
      const src = row && (isCircuit ? 'circuit' : $('[data-stat-hover-img]', row)?.getAttribute('src'));
      const rect = list.getBoundingClientRect();
      if (src) {
        if (!isCircuit && pimg.getAttribute('src') !== src) pimg.src = src;
        preview.style.transform = `translate(${e.clientX - rect.left + 20}px, ${e.clientY - rect.top - 20}px)`;
        if (!shown) { preview.classList.add('is-visible'); shown = true; }
      } else if (shown) { preview.classList.remove('is-visible'); shown = false; }
    };
    const leave = () => { preview.classList.remove('is-visible'); shown = false; };
    listen(list, 'mousemove', move);
    listen(list, 'mouseleave', leave);
  });
}

/** Podium media: one preview whose image follows cursor X across the strip (original W(N,X)). */
function podiumHover(view) {
  const area = $('[data-podium-media]', view);
  if (!area || matchMedia('(hover: none)').matches) return;
  const imgs = $$('.podium-img', area);
  const preview = $('[data-mouse-track]', area);
  const pimg = $('img', preview);
  listen(area, 'mousemove', (e) => {
    const r = area.getBoundingClientRect();
    const i = hoverImageIndex(e.clientX - r.left, r.width, imgs.length);
    const src = imgs[i]?.getAttribute('src');
    if (src && pimg.getAttribute('src') !== src) pimg.src = src;
    preview.style.transform = `translate(${e.clientX - r.left + 20}px, ${e.clientY - r.top - 20}px)`;
    preview.classList.add('is-visible');
  });
  listen(area, 'mouseleave', () => preview.classList.remove('is-visible'));
}

// ---------------------------------------------------------------- helmets (original ZZ: column parallax)
function helmetGrid(view) {
  const grid = $('[data-helmet-grid]', view);
  if (!grid) return;
  $$('[data-helmet-item]', grid).forEach((it) => listen(it, 'click', () => it.classList.toggle('is-revealed')));
  if (!gsap || !ScrollTrigger || window.innerWidth < 768) return;
  const cols = [[], [], [], []];
  $$('.helmet-item-w', grid).forEach((el, i) => cols[i % 4].push(el));
  cols.forEach((col, c) => {
    if (!c || !col.length) return;
    gsap.fromTo(col, { y: `${c * 5}rem` }, { y: 0, ease: 'none', scrollTrigger: { trigger: grid, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}

// ---------------------------------------------------------------- horizontal galleries
function horizontalGallery(view) {
  $$('[data-horizontal-section]', view).forEach((sec) => {
    const trackEl = $('[data-horizontal-track]', sec);
    const pin = $('.horizontal-pin', sec);
    if (!trackEl || window.innerWidth < 768) return;
    if (!gsap || !ScrollTrigger) {
      pin.style.overflowX = 'auto';
      return;
    }
    const dist = () => Math.max(0, trackEl.scrollWidth - window.innerWidth);
    const tween = gsap.to(trackEl, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: sec, start: 'top top', end: () => `+=${dist()}`, pin: pin, scrub: true, invalidateOnRefresh: true,
        onUpdate: (st) => {
          sec.classList.toggle('is-light', st.progress > 0.5); // data-h-color-from dark-green -> to white
          $$('.h-img img', trackEl).forEach((im, i) => { im.style.transform = `scale(1.12) translateX(${(st.progress - 0.5) * -6 * ((i % 3) + 1)}%)`; });
        },
      },
    });
    onCleanup(() => tween.kill());
  });
}

// ---------------------------------------------------------------- marquees (data-marquee-*)
function marquees(view) {
  const list = $$('[data-marquee]', view);
  if (!list.length) return;
  let lastY = window.scrollY;
  let velocity = 0;
  let dirSign = 1;
  const state = list.map((m) => {
    const tr = $('.marquee-track', m);
    const dup = Number(m.dataset.marqueeDuplicate || 2);
    const original = tr.innerHTML;
    tr.innerHTML = original.repeat(Math.max(2, dup));
    return { m, tr, x: 0, speed: Number(m.dataset.marqueeSpeed || 30), dir: m.dataset.marqueeDirection === 'right' ? 1 : -1, unit: 0 };
  });
  const measure = () => state.forEach((s) => { s.unit = s.tr.scrollWidth / Math.max(2, Number(s.m.dataset.marqueeDuplicate || 2)); });
  measure();
  listen(window, 'resize', measure);
  listen(window, 'scroll', () => {
    const y = window.scrollY;
    velocity = Math.min(Math.abs(y - lastY), 60);
    if (y !== lastY) dirSign = y > lastY ? 1 : -1; // scroll direction flips the marquee (data-marquee-scroll-direction-target)
    lastY = y;
  }, { passive: true });
  let raf;
  let prev = performance.now();
  const loop = (t) => {
    const dt = Math.min(0.05, (t - prev) / 1000);
    prev = t;
    velocity *= 0.92;
    state.forEach((s) => {
      if (!s.unit) return;
      s.x += s.dir * dirSign * (s.speed + velocity * 4) * dt;
      s.x = ((s.x % s.unit) + s.unit) % s.unit;
      s.tr.style.transform = `translate3d(${-s.x}px,0,0)`;
    });
    raf = requestAnimationFrame(loop);
  };
  if (!reduced()) raf = requestAnimationFrame(loop);
  onCleanup(() => cancelAnimationFrame(raf));
}

// ---------------------------------------------------------------- On/Off track split (data-otot-section)
function otot(view) {
  const sec = $('[data-otot-section]', view);
  if (!sec) return;
  const set = (off) => sec.classList.toggle('is-off', off);
  listen(sec, 'mousemove', (e) => { const r = sec.getBoundingClientRect(); set(e.clientX - r.left > r.width / 2); });
  if (matchMedia('(hover: none)').matches) {
    const io = new IntersectionObserver(([en]) => set(en.intersectionRatio > 0.6), { threshold: [0, 0.6, 1] });
    io.observe(sec);
    onCleanup(() => io.disconnect());
  }
}

// ---------------------------------------------------------------- home hero touch lock
let heroLocked = false;
/** Touch "tap to lock" toggle (original $_): locks page scroll so a finger drag paints the reveal. */
function swipeLock(view) {
  const btn = $('[data-home-swipe-toggle]', view);
  if (!btn) return;
  const unlocked = $('[data-home-swipe-desc="unlocked"]', view);
  const locked = $('[data-home-swipe-desc="locked"]', view);
  const hero = $('[data-hero]', view);
  const set = (on) => {
    heroLocked = on;
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Disable helmet reveal by touch' : 'Enable helmet reveal by touch');
    unlocked.hidden = on; locked.hidden = !on;
    hero.style.touchAction = on ? 'none' : '';
    if (on) lenis?.stop(); else lenis?.start();
  };
  set(false);
  listen(btn, 'click', () => set(!heroLocked));
  onCleanup(() => set(false));
}

// ---------------------------------------------------------------- social video cards (original z$ / Vimeo)
function videoStreams(view) {
  $$('[data-video-stream]', view).forEach((el) => {
    const id = el.dataset.streamUrl;
    if (!id) return;
    let frame = null;
    const play = () => {
      if (frame || document.hidden) return;
      frame = document.createElement('iframe');
      frame.src = `https://player.vimeo.com/video/${encodeURIComponent(id)}?background=1&muted=1&loop=1&autoplay=1`;
      frame.allow = 'autoplay; fullscreen';
      frame.title = 'Lando Norris social video';
      frame.loading = 'lazy';
      el.appendChild(frame);
    };
    const stop = () => { frame?.remove(); frame = null; };
    if (el.dataset.streamHover === 'true') {
      listen(el, 'mouseenter', play);
      listen(el, 'mouseleave', stop);
      listen(el, 'focusin', play);
    } else play();
    listen(document, 'visibilitychange', () => { if (document.hidden) stop(); });
    onCleanup(stop);
  });
}

// ---------------------------------------------------------------- off-track hero: image layer by scroll progress (original z_)
function heroCycle(view) {
  const box = $('[data-hero-cycle]', view);
  if (!box) return;
  const imgs = $$('img', box);
  const section = box.closest('section');
  const update = () => {
    const r = section.getBoundingClientRect();
    const p = Math.min(Math.max(-r.top / Math.max(1, r.height - window.innerHeight * 0.5), 0), 1);
    const i = Math.min(Math.floor(p * imgs.length), imgs.length - 1);
    imgs.forEach((im, k) => im.classList.toggle('is-active', k === i));
  };
  update();
  listen(window, 'scroll', update, { passive: true });
}

// ---------------------------------------------------------------- 404 helmet style switcher (original T_)
function notFoundSwitcher(view) {
  const vis = $('[data-nf-visual]', view);
  const btns = $$('[data-gl-switcher]', view);
  btns.forEach((b) => listen(b, 'click', () => {
    vis.dataset.variant = b.dataset.glSwitcher;
    btns.forEach((o) => { o.classList.toggle('is-active', o === b); o.setAttribute('aria-pressed', String(o === b)); });
  }));
}

function anchorLinks(view) {
  $$('a[href^="#"]', view).forEach((a) => listen(a, 'click', (e) => {
    const t = a.getAttribute('href').length > 1 && document.querySelector(a.getAttribute('href'));
    if (!t) return;
    e.preventDefault();
    scrollToY(window.scrollY + t.getBoundingClientRect().top - 80);
  }));
}

// ---------------------------------------------------------------- landscape block (original aR)
function landscapeBlock() {
  const el = $('[data-mob-landscape]');
  if (!el) return;
  const check = () => {
    const touch = matchMedia('(hover: none) and (pointer: coarse)').matches;
    const landscape = window.innerWidth > window.innerHeight;
    el.hidden = !(touch && landscape && window.innerHeight < 600);
    if (!el.hidden && !el.dataset.riveStarted) { el.dataset.riveStarted = '1'; rive.initLandscape(); }
  };
  check();
  (screen.orientation || window).addEventListener('change', check);
  window.addEventListener('resize', check);
}

// ---------------------------------------------------------------- page transitions (Taxi.js equivalent)
const transition = document.createElement('div');
transition.className = 'page-transition';
document.body.appendChild(transition);
const pageCache = new Map();

async function fetchPage(url) {
  if (pageCache.has(url)) return pageCache.get(url);
  const res = await fetch(url, { headers: { 'X-Requested-With': 'Taxi' }, credentials: 'same-origin' });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  const html = await res.text();
  pageCache.set(url, html);
  return html;
}

function wipe(cover) {
  if (reduced()) return Promise.resolve();
  return transition.animate(
    cover
      ? [{ clipPath: 'ellipse(120% 0% at 50% 100%)' }, { clipPath: 'ellipse(120% 120% at 50% 100%)' }]
      : [{ clipPath: 'ellipse(120% 120% at 50% 0%)' }, { clipPath: 'ellipse(120% 0% at 50% 0%)' }],
    { duration: 550, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' },
  ).finished;
}

async function navigate(url, { push = true } = {}) {
  window.closeMenu?.();
  let html;
  const cover = rive.transitionOut() ? new Promise((r) => setTimeout(r, 600)) : wipe(true);
  try { [html] = await Promise.all([fetchPage(url), cover]); } catch {
    window.location.href = url; // original: non-2xx -> full navigation
    return;
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const nextView = doc.querySelector('[data-taxi-view]');
  if (!nextView) { window.location.href = url; return; }
  destroyPage();
  $('[data-taxi]').replaceChildren(document.importNode(nextView, true));
  // Scripts flagged data-taxi-reload run again after a swap (imported <script> nodes are inert).
  $$('script[data-taxi-reload]', $('[data-taxi]')).forEach((old) => {
    const s = document.createElement('script');
    [...old.attributes].forEach((a) => s.setAttribute(a.name, a.value));
    s.textContent = old.textContent;
    old.replaceWith(s);
  });
  document.title = doc.title;
  document.documentElement.dataset.pageKey = doc.documentElement.dataset.pageKey;
  const path = new URL(url, location.href).pathname;
  $$('.nav-menu-link').forEach((a) => {
    const cur = a.getAttribute('href') === path;
    a.classList.toggle('is-current', cur);
    if (cur) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (push) history.pushState({}, '', url);
  const hash = new URL(url, location.href).hash;
  if (lenis) lenis.scrollTo(0, { immediate: true }); else window.scrollTo(0, 0);
  initPage();
  if (hash) document.querySelector(hash)?.scrollIntoView();
  if (rive.riveReady()) { setTimeout(() => rive.transitionIn(), 500); } else await wipe(false);
  window.dispatchEvent(new Event('nav:update'));
  playHeroAnimations();
}

function router() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
    if (url.pathname === location.pathname && url.hash) return; // in-page anchor
    if (a.getAttribute('href') === '#') { e.preventDefault(); return; }
    e.preventDefault();
    if (url.href === location.href) { window.closeMenu?.(); return; }
    navigate(url.href);
  });
  // Preload on hover, as Taxi does for same-host links.
  document.addEventListener('mouseover', (e) => {
    const a = e.target.closest('a[href^="/"]');
    if (a && !a.target) fetchPage(new URL(a.href).href).catch(() => {});
  });
  window.addEventListener('popstate', () => navigate(location.href, { push: false }));
}

// ---------------------------------------------------------------- boot
(async () => {
  router();
  await loadLibs();
  if (gsap && SplitText) {
    globalAnims = createAnims({ gsap, ScrollTrigger, SplitText });
    document.fonts?.ready.then(() => { globalAnims.textHover(document.querySelector('[data-nav-wrap]')); globalAnims.textHover(document.querySelector('[data-nav-m]')); globalAnims.textHover(document.querySelector('[data-loader]')); });
  }
  navMenu();
  landscapeBlock();
  rive.initTransition();
  rive.initHamburger();
  rive.initLogo();
  rive.initNavHelmet().then((h) => { navHelmet = h; });
  initPage();
  await loader();
  ScrollTrigger?.refresh();
  window.dispatchEvent(new Event('nav:update'));
})();

// Exposed for debugging/tests in the browser console.
window.__lando = { splitPosition, navigate };
