// Text / list / image animations ported from the original bundle (GSAP 3.13 + SplitText):
// AE  data-anim-high      lines revealed behind a coloured bar
// e0  data-oval-scroll    lines open with an elliptical clip, chars rise from the centre
// UZ  data-stat-list      list items revealed behind a lime bar, staggered
// QE  data-anim="text-hover"  chars roll up on hover
// fJ  data-img-highlight  image opens with an elliptical clip behind a lime layer
// NL  data-car-counter    zero-padded number counters
// L_  podium              "podiums" label and the big number move on scroll
// k0  hero containers play immediately instead of on scroll

const COLORS = {
  lime: 'var(--color--lime, #d2ff00)', 'lime-off': 'var(--color--lime-off, #b2c73a)', 'dark-green': 'var(--color--dark-green, #282c20)',
  'dark-green-tint-1': 'var(--color--dark-green-tint-1, #3b3c38)', black: 'var(--color--black, #111112)', white: 'var(--color--white, #f4f4ed)',
};
const colorOf = (name) => COLORS[name] || COLORS.lime;
const inHero = (el) => Boolean(el.closest('[data-hero-animation-container]'));

export function createAnims({ gsap, ScrollTrigger, SplitText }) {
  const m = gsap;
  const splits = [];
  const triggers = [];
  const timelines = [];
  const heroTimelines = [];
  const listeners = [];

  const split = (el, type) => {
    if (el._split) return el._split;
    const s = SplitText.create(el, { type, linesClass: 'line', wordsClass: 'word', charsClass: 'char', aria: 'auto' });
    el._split = s;
    splits.push(s);
    return s;
  };

  /** AE */
  function highLines(root) {
    root.querySelectorAll('[data-anim-high]').forEach((el) => {
      const [dir, colour, delay] = (el.getAttribute('data-anim-high') || 'right, lime, 0').split(',').map((x) => x.trim());
      const right = dir !== 'left';
      const lines = split(el, 'lines').lines;
      el.style.visibility = 'visible';
      const tl = m.timeline({ paused: true, delay: parseFloat(delay || '0') / 1000 });
      lines.forEach((line, i) => {
        line.style.position = 'relative';
        m.set(line, { clipPath: right ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)', autoAlpha: 1 });
        const bar = document.createElement('div');
        bar.className = 'high-line-reveal';
        Object.assign(bar.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', backgroundColor: colorOf(colour), transformOrigin: right ? 'right center' : 'left center', zIndex: '5' });
        line.appendChild(bar);
        m.set(bar, { scaleX: 1 });
        const at = i * 0.15;
        tl.to(line, { clipPath: 'inset(0 0% 0 0%)', duration: 0.6, ease: 'power2.out' }, at);
        tl.to(bar, { scaleX: 0, duration: 0.6, ease: 'power2.inOut' }, at + 0.3);
      });
      timelines.push(tl);
      if (inHero(el)) heroTimelines.push(tl);
      else triggers.push(ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => tl.play() }));
    });
  }

  /** e0 */
  function ovalScroll(root) {
    root.querySelectorAll('[data-oval-scroll]').forEach((el) => {
      const from = el.getAttribute('data-oval-scroll') || 'top';
      const top = from !== 'bottom';
      const s = split(el, 'lines,chars');
      el.style.visibility = 'visible';
      const outer = document.createElement('div');
      outer.className = 'oval-outer-wrapper';
      outer.style.overflow = 'clip';
      const wraps = s.lines.map((line) => {
        const w = document.createElement('div');
        w.className = 'oval-line-clip-wrap';
        line.parentNode.insertBefore(w, line);
        w.appendChild(line);
        return w;
      });
      wraps[0]?.parentNode.insertBefore(outer, wraps[0]);
      wraps.forEach((w) => outer.appendChild(w));
      wraps.forEach((w) => {
        const line = w.querySelector('.line');
        const chars = line.querySelectorAll('.char');
        m.set(w, { clipPath: top ? 'ellipse(20% 0% at 50% 0%)' : 'ellipse(20% 0% at 50% 100%)' });
        m.set(line, { y: top ? '-40%' : '40%' });
        if (chars.length) m.set(chars, { y: top ? '-40%' : '40%' });
      });
      const tl = m.timeline({ paused: true });
      tl.to(wraps, { clipPath: top ? 'ellipse(100% 120% at 50% 0%)' : 'ellipse(100% 120% at 50% 100%)', duration: 1.5, ease: 'power2.inOut', stagger: 0.15 }, 0);
      wraps.forEach((w, i) => {
        const line = w.querySelector('.line');
        const chars = line.querySelectorAll('.char');
        tl.to(line, { y: '0%', duration: 1.5, ease: 'power2.inOut' }, 0.15 + 0.1 * i);
        if (chars.length) tl.to(chars, { y: '0%', duration: 1.5, ease: 'power2.inOut', stagger: { amount: 0.015 * chars.length, from: 'center' } }, 0.15 * i);
      });
      timelines.push(tl);
      if (inHero(el)) heroTimelines.push(tl);
      else triggers.push(ScrollTrigger.create({ trigger: el, start: 'top 95%', once: true, onEnter: () => tl.play() }));
    });
  }

  /** UZ */
  function statLists(root) {
    root.querySelectorAll('[data-stat-list]').forEach((list) => {
      const items = list.querySelectorAll(':scope [data-stat-item]');
      if (!items.length) return;
      const right = (list.getAttribute('data-reveal-direction') || 'right') === 'right';
      const tl = m.timeline({ paused: true, delay: parseFloat(list.getAttribute('data-reveal-delay') || '0') / 1000 });
      items.forEach((item, i) => {
        item.style.position = item.style.position || 'relative';
        m.set(item, { clipPath: right ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)', autoAlpha: 1 });
        const bar = document.createElement('div');
        bar.className = 'item-reveal';
        Object.assign(bar.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', backgroundColor: colorOf(list.getAttribute('data-reveal-color') || 'lime'), transformOrigin: right ? 'right center' : 'left center', zIndex: '5', pointerEvents: 'none' });
        item.appendChild(bar);
        tl.to(item, { clipPath: 'inset(0 0% 0 0%)', duration: 0.6, ease: 'power2.out' }, i * 0.05);
        tl.to(bar, { scaleX: 0, duration: 0.6, ease: 'power2.inOut' }, i * 0.05 + 0.3);
      });
      timelines.push(tl);
      triggers.push(ScrollTrigger.create({ trigger: list, start: 'top 90%', once: true, onEnter: () => tl.play() }));
    });
  }

  /** QE */
  function textHover(root) {
    root.querySelectorAll('[data-anim="text-hover"]').forEach((el) => {
      const target = el.querySelector('[split-text]') || el.querySelector('.btn-text');
      if (!target || target._split) return;
      const chars = split(target, 'chars').chars;
      target.classList.add('is-split');
      const isMenu = el.classList.contains('nav-menu-link');
      const y = () => (isMenu ? '-100%' : '-100%');
      const enter = () => m.to(chars, { y: y(), duration: 0.6, stagger: 0.02, ease: 'power3.out', overwrite: true });
      const leave = () => m.to(chars, { y: 0, duration: 0.6, stagger: 0.02, ease: 'power3.out', overwrite: true });
      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseleave', leave);
      listeners.push(() => { el.removeEventListener('mouseenter', enter); el.removeEventListener('mouseleave', leave); });
    });
  }

  /** fJ */
  function imgHighlight(root) {
    root.querySelectorAll('[data-img-highlight]').forEach((img) => {
      if (img._hl) return;
      img._hl = true;
      const [pos, colour, delay] = (img.getAttribute('data-img-highlight') || 'top, lime, 0').split(',').map((x) => x.trim());
      const wrap = document.createElement('div');
      Object.assign(wrap.style, { position: 'relative', overflow: 'hidden', width: '100%', height: '100%' });
      wrap.className = 'img-highlight-w';
      img.parentNode.insertBefore(wrap, img);
      wrap.appendChild(img);
      const layer = document.createElement('div');
      layer.className = 'img-highlight-reveal';
      Object.assign(layer.style, { position: 'absolute', inset: '0', backgroundColor: colorOf(colour), zIndex: '5', pointerEvents: 'none' });
      wrap.appendChild(layer);
      const top = pos !== 'bottom';
      m.set(wrap, { clipPath: top ? 'ellipse(120% 0% at 50% 0%)' : 'ellipse(120% 0% at 50% 100%)' });
      m.set(layer, { clipPath: top ? 'ellipse(120% 120% at 50% 100%)' : 'ellipse(120% 120% at 50% 0%)' });
      const tl = m.timeline({ scrollTrigger: { trigger: wrap, start: 'top 80%', once: true }, delay: parseFloat(delay || '0') / 1000 });
      tl.to(wrap, { clipPath: 'ellipse(120% 120% at 50% 0%)', duration: 0.8, ease: 'power2.out' });
      tl.to(layer, { clipPath: top ? 'ellipse(120% 0% at 50% 100%)' : 'ellipse(120% 0% at 50% 0%)', duration: 0.6, ease: 'power2.out' }, '-=0.4');
      timelines.push(tl);
    });
  }

  /** NL */
  function counters(root) {
    root.querySelectorAll('[data-car-counter]').forEach((el) => {
      const raw = el.textContent.trim();
      const end = parseInt(raw.replace(/,/g, ''), 10);
      if (Number.isNaN(end)) return;
      const digits = raw.replace(/[^0-9]/g, '').length;
      const comma = raw.includes(',');
      el.textContent = digits > 1 ? '0'.repeat(digits) : '0';
      triggers.push(ScrollTrigger.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: () => m.to({ v: 0 }, {
          v: end, duration: 1, ease: 'power1.out',
          onUpdate() { const n = Math.round(this.targets()[0].v); el.textContent = comma ? n.toLocaleString() : String(n).padStart(digits, '0'); },
        }),
      }));
    });
  }

  /** L_ */
  function podium(root) {
    const wrap = root.querySelector('[data-podium="wrap"]');
    if (!wrap) return;
    const label = wrap.querySelector('[data-podium="text"]');
    const num = wrap.querySelector('[data-podium-num]');
    const chars = num ? split(num, 'chars').chars : [];
    m.set(label, { y: window.innerWidth >= 992 ? '17.5rem' : '4rem' });
    timelines.push(m.to(label, { y: 0, ease: 'power1.in', scrollTrigger: { trigger: wrap, start: 'top bottom', end: 'bottom center', scrub: true } }));
    if (chars[1]) timelines.push(m.fromTo(chars[1], { y: 0 }, { y: window.innerWidth >= 480 ? '-17.5rem' : '-6rem', ease: 'power1.in', scrollTrigger: { trigger: wrap, start: 'top bottom', end: 'bottom center', scrub: true } }));
  }

  /** Nav menu link highlight bars (part of the menu timeline). */
  function menuHighlights(menu) {
    return [...menu.querySelectorAll('[data-nav-link-highlight]')].map((el) => {
      el.style.position = 'relative';
      const bar = document.createElement('div');
      bar.className = 'high-line-reveal';
      Object.assign(bar.style, { position: 'absolute', inset: '0', backgroundColor: COLORS.lime, transformOrigin: 'right center', zIndex: '5' });
      el.appendChild(bar);
      return { el, bar };
    });
  }

  return {
    init(root) {
      // Fonts must be ready for SplitText to measure lines.
      return (document.fonts?.ready || Promise.resolve()).then(() => {
        highLines(root); ovalScroll(root); statLists(root); textHover(root); imgHighlight(root); counters(root); podium(root);
        ScrollTrigger.refresh();
      });
    },
    /** k0: play hero-contained text timelines now. */
    playHero() { heroTimelines.forEach((tl) => tl.play()); },
    menuHighlights,
    textHover,
    destroy() {
      listeners.forEach((fn) => fn());
      triggers.forEach((t) => t.kill());
      timelines.forEach((t) => t.kill());
      splits.forEach((s) => s.revert());
      splits.length = triggers.length = timelines.length = heroTimelines.length = listeners.length = 0;
    },
  };
}
