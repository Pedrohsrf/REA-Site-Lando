// Rive animations with the original .riv files and runtime (@rive-app/canvas-lite 2.26.4).
// Mirrors the original loaders: kI (preload), B4 reef, E4 signature, I4 circuits, C4 btn-ui,
// iR hamburger, K4 phrases, nR LN4 logo, aR landscape, CH (play on enter), oR (scroll input 0..1000),
// o0 (hero containers play after load) and the page-transition state machine.

const FILES = {
  signature: 'signature.riv', 'btn-ui': 'btn-ui.riv', circuits: 'circuits.riv', reef: 'reef.riv',
  phrases: 'phrases.riv', logo: 'ln4.riv', 'mob-landscape': 'mob-landscape.riv',
};
const BASE = '/assets/rive/';
const loaded = {};
const instances = new Set();
let rt = null;
let ready = null;
let gsap = null;
let ScrollTrigger = null;

export function setLibs(libs) { ({ gsap, ScrollTrigger } = libs); }

function runtime() {
  if (rt) return Promise.resolve(rt);
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const wait = () => {
      if (window.rive) {
        rt = window.rive;
        rt.RuntimeLoader.setWasmUrl('/vendor/rive/rive.wasm');
        resolve(rt);
      } else if (Date.now() - start > 10000) reject(new Error('Rive runtime not loaded'));
      else setTimeout(wait, 30);
    };
    wait();
  });
}

/** Preload every .riv once (original kI + riveAllLoaded). */
export function preload() {
  if (ready) return ready;
  ready = runtime().then((r) => Promise.all(Object.entries(FILES).map(([key, file]) => new Promise((res) => {
    const f = new r.RiveFile({ src: BASE + file, onLoad: () => { loaded[key] = f; res(); }, onLoadError: (e) => { console.error('Rive file failed', file, e); res(); } });
    f.init().catch((e) => { console.error(e); res(); });
  })))).then(() => { window.dispatchEvent(new Event('riveAllLoaded')); return loaded; });
  window.addEventListener('resize', () => instances.forEach((i) => i.resizeDrawingSurfaceToCanvas()));
  return ready;
}

const fit = (canvas) => {
  const v = (canvas.getAttribute('data-rive-fit') || 'contain').toLowerCase();
  return ({ contain: rt.Fit.Contain, cover: rt.Fit.Cover, fill: rt.Fit.Fill, fitwidth: rt.Fit.FitWidth, fitheight: rt.Fit.FitHeight, none: rt.Fit.None, scaledown: rt.Fit.ScaleDown })[v] ?? rt.Fit.Contain;
};

function make(canvas, file, artboard, sm, autoplay, onLoad) {
  if (!loaded[file]) return null;
  const inst = new rt.Rive({
    riveFile: loaded[file], canvas, artboard, stateMachines: sm, autoplay,
    layout: new rt.Layout({ fit: fit(canvas), alignment: rt.Alignment.Center }),
    onLoad: () => {
      inst.resizeDrawingSurfaceToCanvas();
      canvas.classList.add('is-rive-ready');
      canvas.closest('.sig-rive, .arrow-rive, .nav-logo-w, .nav-ham')?.classList.add('is-rive-ready');
      onLoad?.(inst, inst.stateMachineInputs(sm) || []);
    },
  });
  canvas.riveInstance = inst;
  instances.add(inst);
  return inst;
}

const inHero = (el) => Boolean(el.closest('[data-hero-animation-container]'));
const setBool = (inputs, name, v = true) => {
  const i = inputs.find((x) => x.name === name);
  if (i && i.type === rt.StateMachineInputType.Boolean) i.value = v;
  return i;
};
const targetOf = (canvas) => {
  const sel = canvas.getAttribute('data-rive-scrolltrigger-target');
  return (sel && document.querySelector(sel)) || canvas;
};

/** CH: hide, play one frame, pause; then reveal + play when the trigger enters. */
function playOnEnter(canvas, inst, trigger, start = 'top 80%', cleanups) {
  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity .1s ease-in-out';
  inst.play();
  setTimeout(() => inst.pause(), 50);
  const st = ScrollTrigger.create({ trigger, start, once: true, onEnter: () => { canvas.style.opacity = '1'; inst.play(); } });
  cleanups.push(() => st.kill());
}

/** oR: scrubbed "scroll" input 0..1000 across the trigger. */
function scrubScroll(canvas, inst, inputs, trigger, cleanups) {
  const input = inputs.find((i) => i.name === 'scroll');
  if (!input) return;
  const st = ScrollTrigger.create({
    trigger,
    start: canvas.getAttribute('data-rive-scrolltrigger-start') || 'top bottom',
    end: canvas.getAttribute('data-rive-scrolltrigger-end') || 'bottom top',
    scrub: 0.5,
    onUpdate: (s) => { input.value = s.progress * 1000; if (!inst.isPlaying) inst.play(); },
    onEnter: () => inst.play(),
    onLeave: () => { input.value = 1000; setTimeout(() => inst.pause(), 50); },
    onEnterBack: () => inst.play(),
    onLeaveBack: () => { input.value = 0; setTimeout(() => inst.pause(), 50); },
  });
  cleanups.push(() => st.kill());
}

/** Initialise every Rive canvas inside `root`. Returns a cleanup function. */
export async function initRive(root) {
  const cleanups = [];
  try { await preload(); } catch (e) { console.warn(e); return () => {}; }

  root.querySelectorAll('canvas[data-rive-object]').forEach((canvas) => {
    if (canvas.riveInstance) return;
    const file = canvas.dataset.riveFile;
    const ab = canvas.dataset.riveArtboard;
    const sm = canvas.dataset.riveStateMachine;
    const hero = inHero(canvas);

    if (file === 'reef' || file === 'signature') {
      const instant = canvas.dataset.riveInstantPlay === 'true';
      make(canvas, file, ab || (file === 'signature' ? 'signature' : 'helmet-reef'), sm, instant && !hero, (inst, inputs) => {
        if (canvas.dataset.riveInput) setBool(inputs, canvas.dataset.riveInput);
        canvas.riveInputs = inputs;
        if (hero) { canvas.dataset.heroAnimation = 'true'; if (inst.isPlaying) inst.pause(); }
        else if (sm.includes('_play')) { if (!instant) playOnEnter(canvas, inst, targetOf(canvas), 'top 80%', cleanups); }
        else if (sm.includes('_scroll')) scrubScroll(canvas, inst, inputs, targetOf(canvas), cleanups);
        else if (sm === 'off-icons') inst.play();
      });
    } else if (file === 'circuits') {
      make(canvas, 'circuits', 'circuits', sm, true, (inst, inputs) => {
        canvas.riveInputs = inputs;
        if (canvas.dataset.riveInputColor) setBool(inputs, canvas.dataset.riveInputColor);
        if (canvas.dataset.riveInputWeight) setBool(inputs, canvas.dataset.riveInputWeight);
        setTrack(canvas, canvas.dataset.riveInputTrack);
        if (canvas.dataset.riveCircuitHover === 'true') {
          const scope = canvas.closest('[data-taxi-view]') || document;
          scope.querySelectorAll('[data-rive-circuit-hover-target]').forEach((row) => {
            const enter = () => setTrack(canvas, row.getAttribute('data-rive-circuit-hover-target'));
            const leave = () => setTrack(canvas, canvas.dataset.riveInputTrack);
            row.addEventListener('mouseenter', enter);
            row.addEventListener('mouseleave', leave);
            cleanups.push(() => { row.removeEventListener('mouseenter', enter); row.removeEventListener('mouseleave', leave); });
          });
        }
      });
    } else if (file === 'btn-ui') {
      let host = canvas;
      while (host && !host.hasAttribute?.('data-btn-rive-hover')) host = host.parentElement;
      host ||= canvas;
      make(canvas, 'btn-ui', ab || 'arrow', sm || 'arrow', true, (inst, inputs) => {
        const hover = inputs.find((i) => i.name === 'hover');
        if (!hover) return;
        hover.value = false;
        const on = () => { hover.value = true; };
        const off = () => { hover.value = false; };
        host.addEventListener('mouseenter', on); host.addEventListener('mouseleave', off);
        host.addEventListener('touchstart', on, { passive: true }); host.addEventListener('touchend', off);
        cleanups.push(() => { host.removeEventListener('mouseenter', on); host.removeEventListener('mouseleave', off); });
      });
    } else if (file === 'phrases') {
      const scroll = canvas.dataset.riveScrolltrigger === 'true';
      make(canvas, 'phrases', ab, sm, !scroll && !hero, (inst) => {
        if (hero) { canvas.dataset.heroAnimation = 'true'; if (inst.isPlaying) inst.pause(); }
        else if (scroll) playOnEnter(canvas, inst, targetOf(canvas), canvas.dataset.riveScrolltriggerStart || 'top 80%', cleanups);
      });
    }
  });

  return () => cleanups.forEach((fn) => fn());
}

/** Circuits: switch all track booleans off, then the selected circuit-id on (original H()). */
export function setTrack(canvas, id) {
  const inputs = canvas?.riveInputs;
  if (!inputs || !id) return;
  inputs.filter((i) => i.type === rt.StateMachineInputType.Boolean && !i.name.startsWith('color_') && !i.name.startsWith('weight_'))
    .forEach((i) => { i.value = false; });
  setBool(inputs, id);
}

/** o0: play hero-contained canvases (and their "play" input) once everything has loaded. */
export function playHero(root) {
  root.querySelectorAll('[data-hero-animation-container] canvas[data-rive-object]').forEach((canvas) => {
    const tryPlay = (n = 0) => {
      const inst = canvas.riveInstance;
      if (!inst) { if (n < 25) setTimeout(() => tryPlay(n + 1), 200); return; }
      if ((canvas.dataset.riveStateMachine || '').includes('_scroll')) return;
      if (!inst.isPlaying) inst.play();
      if (canvas.riveInputs) setBool(canvas.riveInputs, 'play');
    };
    tryPlay();
  });
}

// ---------------------------------------------------------------- global (persistent) canvases
let hamInputs = null;
let logoInputs = null;

/** iR: hamburger with hover / close / colour inputs. */
export async function initHamburger(onToggle) {
  await preload();
  const btn = document.querySelector('[data-nav-ham]');
  const canvas = btn?.querySelector('canvas[data-rive-nav-hamburger]');
  if (!canvas) return;
  make(canvas, 'btn-ui', canvas.dataset.riveArtboard || 'hamburger', canvas.dataset.riveStateMachine || 'hamburger', true, (inst, inputs) => {
    hamInputs = inputs;
    const hover = inputs.find((i) => i.name === 'hover');
    btn.addEventListener('mouseenter', () => { if (hover) hover.value = true; });
    btn.addEventListener('mouseleave', () => { if (hover) hover.value = false; });
    setNavColor(document.querySelector('[data-nav-wrap]')?.dataset.navTheme === 'light' ? 'white' : 'transparent');
    onToggle?.();
  });
}

/** g8: hamburger "close" state. */
export function setHamClosed(open) {
  const close = hamInputs?.find((i) => i.name === 'close');
  if (close) close.value = open;
}

/** HE: hamburger background (transparent on dark sections, white on light ones). */
export function setNavColor(mode) {
  if (!hamInputs) return;
  const t = hamInputs.find((i) => i.name === 'color-transparent');
  const w = hamInputs.find((i) => i.name === 'color-white');
  if (t && w) { t.value = mode === 'transparent'; w.value = mode === 'white'; }
}

/** nR: LN4 logo with logo-active / hover / colour inputs. */
export async function initLogo() {
  await preload();
  document.querySelectorAll('canvas[data-rive-ln4]').forEach((canvas) => {
    make(canvas, 'logo', 'logo', 'logo', true, (inst, inputs) => {
      logoInputs = inputs;
      setBool(inputs, 'logo-active');
      const hover = inputs.find((i) => i.name === 'hover');
      const host = canvas.closest('a') || canvas;
      host.addEventListener('mouseenter', () => { if (hover) hover.value = true; });
      host.addEventListener('mouseleave', () => { if (hover) hover.value = false; });
      setLogoColor(document.querySelector('[data-nav-wrap]')?.dataset.navTheme === 'dark' ? 'white' : 'black');
    });
  });
}

/** AC: logo colour (lime | white | black=dark-green). */
export function setLogoColor(color) {
  if (!logoInputs) return;
  ['color_dark-green', 'color_white', 'color_lime'].forEach((n) => setBool(logoInputs, n, false));
  setBool(logoInputs, color === 'lime' ? 'color_lime' : color === 'white' ? 'color_white' : 'color_dark-green');
}

/** Nav menu helmet: helmet-reef_scroll driven 0..1000 by the menu timeline. */
export async function initNavHelmet() {
  await preload();
  const canvas = document.querySelector('canvas[data-rive-nav-object]');
  if (!canvas) return null;
  return new Promise((resolve) => {
    make(canvas, canvas.dataset.riveFile || 'reef', canvas.dataset.riveArtboard || 'helmet-reef', canvas.dataset.riveStateMachine || 'helmet-reef_scroll', true, (inst, inputs) => {
      const scroll = inputs.find((i) => i.name === 'scroll');
      if (scroll) scroll.value = 0;
      if (canvas.dataset.riveColorInput) setBool(inputs, canvas.dataset.riveColorInput);
      inst.pause();
      resolve({ inst, scroll });
    });
  });
}

/** aR: landscape-lock animation. */
export async function initLandscape() {
  await preload();
  const canvas = document.querySelector('canvas[data-rive-mob-landscape]');
  if (!canvas || !loaded['mob-landscape']) return null;
  const file = loaded['mob-landscape'];
  const inst = new rt.Rive({ riveFile: file, canvas, autoplay: true, layout: new rt.Layout({ fit: rt.Fit.Contain, alignment: rt.Alignment.Center }), onLoad: () => inst.resizeDrawingSurfaceToCanvas() });
  instances.add(inst);
  return inst;
}

// ---------------------------------------------------------------- page transition (page-transition.riv)
let transition = null;

/** BL: create the transition instance with inputs initial / transition-in / transition-out. */
export async function initTransition() {
  const wrap = document.querySelector('[data-loader]');
  const canvas = wrap?.querySelector('canvas[data-rive-primary]');
  if (!canvas) return null;
  const r = await runtime();
  return new Promise((resolve) => {
    const inst = new r.Rive({
      src: `${BASE}page-transition.riv`, canvas, artboard: 'page-transition', stateMachines: 'page-transition', autoplay: true,
      layout: new r.Layout({ fit: r.Fit.Cover, alignment: r.Alignment.Center }),
      onLoad: () => {
        inst.resizeDrawingSurfaceToCanvas();
        const inputs = inst.stateMachineInputs('page-transition') || [];
        const get = (n) => inputs.find((i) => i.name === n);
        transition = { inst, initial: get('initial'), tin: get('transition-in'), tout: get('transition-out'), wrap };
        if (transition.initial) transition.initial.value = true;
        wrap.classList.add('is-rive');
        resolve(transition);
      },
      onLoadError: () => resolve(null),
    });
    instances.add(inst);
    window.addEventListener('resize', () => inst.resizeDrawingSurfaceToCanvas());
  });
}

/** EL: cover the screen (transition-out). */
export function transitionOut() {
  if (!transition) return false;
  const { wrap, initial, tin, tout } = transition;
  wrap.style.visibility = 'visible';
  wrap.style.pointerEvents = 'auto';
  initial.value = false; tin.value = false; tout.value = true;
  return true;
}

/** H$: reveal the page (transition-in) and fade the "Load Norris" button. */
export function transitionIn() {
  const wrap = document.querySelector('[data-loader]');
  const btn = wrap?.querySelector('[data-loader-btn]');
  if (transition) {
    const { initial, tin, tout } = transition;
    initial.value = false; tout.value = false; tin.value = true;
  } else wrap?.classList.add('is-done');
  setTimeout(() => { if (btn) btn.style.opacity = '0'; }, 100);
  setTimeout(() => {
    if (!wrap) return;
    wrap.style.visibility = 'hidden';
    wrap.style.pointerEvents = 'none';
    if (btn) btn.style.display = 'none';
  }, 500);
}

export const riveReady = () => Boolean(transition);
