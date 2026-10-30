// Home hero in WebGL, rebuilt from the original head scene (classes W9 head, F9 helmet, f9 noise,
// O9 composition) with the same parameters, colours and assets:
// - head: 1x1 plane, 128x128 segments, depth displacement 0.25, alpha map, mouse tilt 0.075
// - shadow texture where the cursor passes; 3D helmet (helmet-21.glb, scale 6.9/6.9/7.1, y 0.05)
// - background: animated simplex-noise bands drawn as outlines (#CBCBB9 on #F8F8F3)
// - camera: PerspectiveCamera(15) at z=3 (3.75 under 768px); scroll pushes it to z=-1
// The original fluid simulation for the cursor is approximated by a decaying 2D brush texture.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const P = {
  COLOR_OUTLINE: '#CBCBB9', COLOR_FOREGROUND: '#D2FF00', COLOR_BACKGROUND: '#F8F8F3',
  COLOR_CURSOR_FOREGROUND: '#CFD2C5', COLOR_CURSOR_BACKGROUND: '#E8E8DF', COLOR_CURSOR_OUTLINE: '#E8E8DF', COLOR_FILTER: '#50593F',
  SCALE: 1, SPEED: 0.1, THICKNESS: 0.0012, DISTORT_SCALE: 1, DISTORT_INTENSITY: 0.5, NOISE_DETAIL: 3,
  CURSOR_INTENSITY: 0.15, CURSOR_SCALE: 3, CURSOR_BOUNCE: -0.75, REVEAL_SIZE: 25, REVEAL_DURATION: 1.1,
};

const SIMPLEX = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const color = (hex) => new THREE.Color(hex).convertLinearToSRGB(); // same conversion as the original uniforms

/** Damped value like the original jB.damp (exponential smoothing). */
const damp = (a, b, lambda, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * 60 * dt));

export async function createHeroGL(canvas, { gsap, ScrollTrigger, isLocked = () => false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    console.warn('WebGL unavailable, using fallback image', e);
    document.documentElement.classList.add('gl-fallback');
    return null;
  }
  if (!renderer.capabilities.isWebGL2) { document.documentElement.classList.add('gl-fallback'); renderer.dispose(); return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const d = canvas.dataset;
  const tl = new THREE.TextureLoader();
  const tex = (url, srgb = false) => new Promise((res) => tl.load(url, (t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, () => res(null)));
  const draco = new DRACOLoader().setDecoderPath('/vendor/three/examples/jsm/libs/draco/');
  const gltfLoader = new GLTFLoader().setDRACOLoader(draco);

  const [diffuse, shadow, alpha, depth, helmetTex, glassTex, matcap, noiseTex, hNormal, gNormal, gRough, hMetal, gltf, hdr] = await Promise.all([
    tex(d.face, true), tex(d.shadow, true), tex(d.alpha), tex(d.depth), tex(d.helmetTexture, true), tex(d.glassTexture, true), tex(d.plasticMatcap, true),
    tex('/assets/gl/textures_noise_noise-03.webp'), tex('/assets/gl/textures_helmet_webp_Norris_Helmet_mat_Normal.webp'),
    tex('/assets/gl/textures_glass_webp_Norris_Glass_mat_Normal.webp'), tex('/assets/gl/textures_glass_webp_Norris_Glass_mat_Roughness.webp'),
    tex('/assets/gl/textures_helmet_webp_Norris_Helmet_mat_Metallic.webp'),
    new Promise((res) => gltfLoader.load(d.helmetModel, res, undefined, () => res(null))),
    new Promise((res) => new RGBELoader().load('/assets/gl/hdri_studio_small_08_1k--light.hdr', res, undefined, () => res(null))),
  ]);
  if (!diffuse || !alpha) { document.documentElement.classList.add('gl-fallback'); return null; }
  [helmetTex, glassTex, hNormal, gNormal, gRough, hMetal].forEach((t) => { if (t) t.flipY = false; }); // glTF UV convention
  if (noiseTex) noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
  let envMap = null;
  if (hdr) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    envMap = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose(); pmrem.dispose();
  }

  const size = { w: 1, h: 1, dpr: renderer.getPixelRatio() };
  const rtOpts = { samples: 4 };
  const headRT = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  const helmetRT = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  const noiseRT = new THREE.WebGLRenderTarget(1, 1, { samples: 1 });

  // ---------------------------------------------------------------- cursor brush (fluid approximation)
  const brush = document.createElement('canvas');
  brush.width = brush.height = 256;
  const bctx = brush.getContext('2d');
  bctx.fillStyle = '#000'; bctx.fillRect(0, 0, 256, 256);
  const cursorTex = new THREE.CanvasTexture(brush);

  // ---------------------------------------------------------------- shared camera
  const cameraGroup = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(15, 1, 0.1, 1000);
  cameraGroup.add(camera);

  // ---------------------------------------------------------------- head (W9)
  const headScene = new THREE.Scene();
  headScene.add(cameraGroup);
  const headUniforms = {
    tDiffuse: { value: diffuse }, tShadow: { value: shadow || diffuse }, tAlpha: { value: alpha }, tDepth: { value: depth },
    tCursor: { value: cursorTex }, uHelmetHover: { value: 0 }, uDisplacement: { value: 0.25 },
  };
  const head = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 128, 128), new THREE.ShaderMaterial({
    uniforms: headUniforms, transparent: true,
    vertexShader: /* glsl */`
      uniform sampler2D tDepth; uniform float uDisplacement;
      varying vec2 vUv; varying vec4 vClip;
      void main(){
        vUv = uv;
        vec3 p = position;
        p.z += texture2D(tDepth, uv).r * uDisplacement;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vClip = gl_Position;
      }`,
    fragmentShader: /* glsl */`
      #define PI 3.141592
      uniform sampler2D tDiffuse; uniform sampler2D tShadow; uniform sampler2D tAlpha; uniform sampler2D tCursor; uniform float uHelmetHover;
      varying vec2 vUv; varying vec4 vClip;
      void main(){
        vec2 cameraUv = vClip.xy / vClip.w * 0.5 + 0.5;
        float hoverTransition = cameraUv.y + sin(cameraUv.x * PI) * sin(uHelmetHover * PI) * 0.2;
        float cursorEffect = step(0.1, texture2D(tCursor, vec2(cameraUv.x, 0.025 + cameraUv.y * 0.95)).r);
        vec3 c = mix(texture2D(tDiffuse, vUv).rgb, texture2D(tShadow, vUv).rgb, min(cursorEffect + step(1.0 - hoverTransition, uHelmetHover), 1.0));
        gl_FragColor = vec4(c, texture2D(tAlpha, vUv).r);
      }`,
  }));
  head.material.toneMapped = false;
  headScene.add(head);

  // ---------------------------------------------------------------- helmet (F9)
  const helmetScene = new THREE.Scene();
  helmetScene.environment = envMap;
  helmetScene.add(new THREE.HemisphereLight(0xffffff, 0x000000, 2.5));
  const point = new THREE.PointLight(0xffffff, 2.5);
  point.position.set(-0.75, 0.2, 0.4);
  helmetScene.add(point);
  let helmet = null;
  let wire = null;
  if (gltf) {
    helmet = gltf.scene;
    helmet.scale.set(6.9, 6.9, 7.1);
    helmet.traverse((o) => {
      if (!o.isMesh) return;
      if (o.name === 'helmet') o.material = new THREE.MeshStandardMaterial({ map: helmetTex, normalMap: hNormal, metalness: 1, roughness: 0.05, envMap, envMapIntensity: 3 });
      else if (o.name === 'glass') o.material = new THREE.MeshStandardMaterial({ map: glassTex, normalMap: gNormal, roughnessMap: gRough, metalnessMap: hMetal, envMap, envMapIntensity: 1.5 });
      else if (o.name === 'plastic') o.material = new THREE.MeshMatcapMaterial({ matcap, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    });
    helmetScene.add(helmet);
    // Faint wireframe of the helmet over the head (original wireframeMesh).
    const helmetMesh = helmet.getObjectByName('helmet');
    if (helmetMesh) {
      wire = new THREE.Mesh(helmetMesh.geometry, new THREE.MeshBasicMaterial({ color: color(P.COLOR_OUTLINE), wireframe: true, transparent: true, opacity: 0.07, depthWrite: false }));
      wire.scale.copy(helmet.scale);
      headScene.add(wire);
    }
  }

  // ---------------------------------------------------------------- background noise (f9)
  const easedMouse = new THREE.Vector2();
  const mouse = new THREE.Vector2();
  let pace = 0; let easedPace = 0;
  const noiseUniforms = {
    uAspect: { value: 1 }, uTime: { value: 0 }, uMouseCoords: { value: easedMouse }, uMousePace: { value: 0 }, uReveal: { value: 0 },
    SCALE: { value: P.SCALE }, SPEED: { value: P.SPEED }, DISTORT_SCALE: { value: P.DISTORT_SCALE }, DISTORT_INTENSITY: { value: P.DISTORT_INTENSITY },
    NOISE_DETAIL: { value: P.NOISE_DETAIL }, CURSOR_INTENSITY: { value: P.CURSOR_INTENSITY }, CURSOR_SCALE: { value: P.CURSOR_SCALE },
    CURSOR_BOUNCE: { value: P.CURSOR_BOUNCE }, REVEAL_SIZE: { value: P.REVEAL_SIZE },
  };
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const noiseScene = new THREE.Scene();
  noiseScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: noiseUniforms,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      ${SIMPLEX}
      varying vec2 vUv;
      uniform float uAspect, uTime, uMousePace, uReveal, SCALE, SPEED, DISTORT_SCALE, DISTORT_INTENSITY, NOISE_DETAIL, CURSOR_INTENSITY, CURSOR_SCALE, CURSOR_BOUNCE, REVEAL_SIZE;
      uniform vec2 uMouseCoords;
      void main(){
        vec2 uv = vUv; uv.x *= uAspect;
        uv.y += (REVEAL_SIZE + REVEAL_SIZE / 3.) * (1.0 - uReveal);
        uv.y /= 1.0 + (REVEAL_SIZE) * (1.0 - uReveal);
        vec2 mouse = uMouseCoords * vec2(0.5) + vec2(0.5); mouse.x *= uAspect;
        float cursor = 1.0 - distance(mouse, uv) * CURSOR_SCALE;
        cursor *= uMousePace; cursor = clamp(cursor, CURSOR_BOUNCE, 1.0);
        float noiseDistort = 0.5 + snoise(vec3(uv.x * DISTORT_SCALE, uv.y * DISTORT_SCALE, uTime * SPEED * 0.1)) * 0.5;
        float noiseFinal = 0.5 + snoise(vec3(
          (uv.x + cursor * CURSOR_INTENSITY + noiseDistort * DISTORT_INTENSITY) * SCALE,
          (uv.y + cursor * CURSOR_INTENSITY + noiseDistort * DISTORT_INTENSITY) * SCALE,
          uTime * SPEED)) * 0.5;
        noiseFinal *= NOISE_DETAIL; noiseFinal = fract(noiseFinal);
        gl_FragColor = vec4(vec3(step(0.5, noiseFinal), noiseFinal, 0.0), 1.0);
      }`,
  })));

  // ---------------------------------------------------------------- composition (O9 render plane)
  const comp = {
    uReveal: { value: 0 }, uHelmetHover: { value: 0 }, uFilter: { value: 0 }, uCursorIntensity: { value: 1 }, uHover: { value: 0 }, uColorHover: { value: new THREE.Color(0) },
    tDefaultDiffuse: { value: headRT.texture }, tHelmet: { value: helmetRT.texture }, tCursorEffect: { value: cursorTex }, tBackgroundNoise: { value: noiseRT.texture },
    THICKNESS: { value: P.THICKNESS }, TEXEL: { value: new THREE.Vector2(1, 1) },
    COLOR_OUTLINE: { value: color(P.COLOR_OUTLINE) }, COLOR_FOREGROUND: { value: color(P.COLOR_FOREGROUND) }, COLOR_BACKGROUND: { value: color(P.COLOR_BACKGROUND) },
    COLOR_CURSOR_FOREGROUND: { value: color(P.COLOR_CURSOR_FOREGROUND) }, COLOR_CURSOR_BACKGROUND: { value: color(P.COLOR_CURSOR_BACKGROUND) },
    COLOR_CURSOR_OUTLINE: { value: color(P.COLOR_CURSOR_OUTLINE) }, COLOR_FILTER: { value: color(P.COLOR_FILTER) },
  };
  const compScene = new THREE.Scene();
  compScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: comp, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      #define PI 3.141592
      varying vec2 vUv;
      uniform float uReveal, uHelmetHover, uFilter, uCursorIntensity, uHover;
      uniform vec3 uColorHover, COLOR_OUTLINE, COLOR_FOREGROUND, COLOR_BACKGROUND, COLOR_CURSOR_FOREGROUND, COLOR_CURSOR_BACKGROUND, COLOR_CURSOR_OUTLINE, COLOR_FILTER;
      uniform sampler2D tDefaultDiffuse, tHelmet, tCursorEffect, tBackgroundNoise;
      uniform vec2 TEXEL;
      vec3 toGrayscale(vec3 c){ return vec3(dot(c, vec3(0.299, 0.587, 0.114))); }
      vec3 adjustContrast(vec3 c, float k){ return (c - 0.5) * k + 0.5; }
      float blendOverlay(float b, float s){ return b < 0.5 ? (2.0*b*s) : (1.0 - 2.0*(1.0-b)*(1.0-s)); }
      vec3 blendOverlay(vec3 b, vec3 s){ return vec3(blendOverlay(b.r,s.r), blendOverlay(b.g,s.g), blendOverlay(b.b,s.b)); }
      vec3 blendHardLight(vec3 b, vec3 s){ return blendOverlay(s, b); }
      void main(){
        vec4 bg = texture2D(tBackgroundNoise, vUv);
        float cursorEffect = step(0.1, texture2D(tCursorEffect, vec2(0.025 + vUv.x * 0.95, 0.025 + vUv.y * 0.95)).r);
        float noiseBase = bg.r;
        vec3 cursorBackground = mix(COLOR_CURSOR_BACKGROUND, COLOR_CURSOR_FOREGROUND, noiseBase);
        float edge = 0.0;
        if (texture2D(tBackgroundNoise, vUv + vec2(TEXEL.x, 0.0)).r != noiseBase || texture2D(tBackgroundNoise, vUv - vec2(TEXEL.x, 0.0)).r != noiseBase ||
            texture2D(tBackgroundNoise, vUv + vec2(0.0, TEXEL.y)).r != noiseBase || texture2D(tBackgroundNoise, vUv - vec2(0.0, TEXEL.y)).r != noiseBase) edge = 1.0;
        vec3 background = mix(COLOR_BACKGROUND, mix(COLOR_BACKGROUND, COLOR_OUTLINE, uReveal), edge);
        cursorBackground = mix(cursorBackground, COLOR_CURSOR_OUTLINE, edge);
        background = mix(background, uColorHover, step(bg.g, -0.1 + uHover * 1.1));
        background = mix(background, cursorBackground, cursorEffect * uCursorIntensity);
        vec4 headC = texture2D(tDefaultDiffuse, vUv);
        vec4 helmetC = texture2D(tHelmet, vUv);
        float hoverTransition = vUv.y + sin(vUv.x * PI) * sin(uHelmetHover * PI) * 0.2;
        cursorEffect += step(1.0 - hoverTransition, uHelmetHover);
        cursorEffect = clamp(cursorEffect * uCursorIntensity, 0.0, 1.0);
        background = mix(background, cursorBackground, step(1.0 - hoverTransition, uHelmetHover));
        vec3 base = mix(background, headC.rgb, headC.a);
        vec3 finalC = mix(base, helmetC.rgb, cursorEffect * helmetC.a);
        vec3 endC = mix(headC.rgb, vec3(0.05), 1.0 - headC.a);
        endC = toGrayscale(endC); endC = adjustContrast(endC, 0.8); endC *= 0.75; endC = blendHardLight(endC, COLOR_FILTER);
        gl_FragColor = vec4(mix(finalC, endC, uFilter), 1.0);
      }`,
  })));

  // ---------------------------------------------------------------- layout / input
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    size.w = w; size.h = h;
    renderer.setSize(w, h, false);
    const pw = Math.round(w * size.dpr); const ph = Math.round(h * size.dpr);
    headRT.setSize(pw, ph); helmetRT.setSize(pw, ph); noiseRT.setSize(Math.round(w), Math.round(h));
    comp.TEXEL.value.set(1 / w, 1 / h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    noiseUniforms.uAspect.value = w / h;
    const desktop = w > 768;
    camera.position.z = desktop ? 3 : 3.75;
    head.position.y = desktop ? 0 : -0.05;
    if (helmet) helmet.position.y = desktop ? 0.05 : 0;
    if (wire) wire.position.y = desktop ? 0.05 : 0;
  }
  resize();
  const onResize = () => resize();
  window.addEventListener('resize', onResize);

  let last = null;
  const onMove = (e) => {
    const p = e.touches ? e.touches[0] : e;
    if (e.touches && !isLocked()) return;
    const r = canvas.getBoundingClientRect();
    const x = (p.clientX - r.left) / r.width; const y = (p.clientY - r.top) / r.height;
    mouse.set(x * 2 - 1, -(y * 2 - 1));
    if (last) pace = Math.min(1, pace + Math.hypot(x - last.x, y - last.y) * 6);
    last = { x, y };
    // Brush stroke into the cursor texture (screen space, y up).
    const bx = x * 256; const by = y * 256;
    const rad = 18 + Math.min(40, pace * 40);
    const g = bctx.createRadialGradient(bx, by, 0, bx, by, rad);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    bctx.fillStyle = g; bctx.beginPath(); bctx.arc(bx, by, rad, 0, Math.PI * 2); bctx.fill();
  };
  const host = canvas.parentElement;
  host.addEventListener('mousemove', onMove);
  host.addEventListener('touchmove', onMove, { passive: true });

  // Hover on [data-gl-helmet="hover"]: whole helmet wipes in (hoverAnimation).
  let helmetReveal = 1;
  const hoverEls = [...document.querySelectorAll('[data-gl-helmet="hover"]')];
  const onHelmetEnter = () => { gsap?.to(comp.uHelmetHover, { value: 1, duration: 1.5, ease: 'expo.inOut', overwrite: true, onUpdate: () => { headUniforms.uHelmetHover.value = comp.uHelmetHover.value; } }); gsap?.to({ v: helmetReveal }, { v: 0, duration: 1.5, onUpdate() { helmetReveal = this.targets()[0].v; } }); };
  const onHelmetLeave = () => { gsap?.to(comp.uHelmetHover, { value: 0, duration: 1, ease: 'expo.inOut', overwrite: true, onUpdate: () => { headUniforms.uHelmetHover.value = comp.uHelmetHover.value; } }); gsap?.to({ v: helmetReveal }, { v: 1, duration: 1, onUpdate() { helmetReveal = this.targets()[0].v; } }); };
  hoverEls.forEach((el) => { el.addEventListener('mouseenter', onHelmetEnter); el.addEventListener('mouseleave', onHelmetLeave); });

  // Scroll: camera pushes in and the image turns into the green filter (transition()).
  const triggers = [];
  let scrollProgress = 0;
  if (gsap && ScrollTrigger) {
    const section = canvas.closest('section') || canvas;
    triggers.push(ScrollTrigger.create({
      trigger: section, start: 'top top', end: 'bottom top', scrub: true,
      onUpdate: (st) => { scrollProgress = st.progress; cameraGroup.position.z = -st.progress; comp.uFilter.value = st.progress; },
    }));
  }

  // Intro reveal (window.landoGL.reveal 0 -> 1, REVEAL_DURATION 1.1s).
  const reveal = { v: 0 };
  const playReveal = () => gsap ? gsap.to(reveal, { v: 1, duration: P.REVEAL_DURATION, ease: 'power2.inOut' }) : (reveal.v = 1);

  // ---------------------------------------------------------------- loop
  let visible = true;
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0 });
  io.observe(canvas);
  const clock = new THREE.Clock();
  let raf;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible) return;
    const t = clock.elapsedTime;
    easedMouse.x = damp(easedMouse.x, mouse.x, 0.025, dt);
    easedMouse.y = damp(easedMouse.y, mouse.y, 0.025, dt);
    pace *= 0.95; easedPace = damp(easedPace, pace, 0.01 * 6, dt);

    // fade the cursor brush (fluid dissipation)
    bctx.fillStyle = 'rgba(0,0,0,0.045)'; bctx.fillRect(0, 0, 256, 256);
    cursorTex.needsUpdate = true;

    head.rotation.y = easedMouse.x * 0.075;
    if (size.w > 768) head.rotation.x = -easedMouse.y * 0.075 * (1 - scrollProgress);
    if (helmet) {
      helmet.rotation.y = head.rotation.y + easedMouse.x * 0.02 * helmetReveal * (1 - scrollProgress);
      helmet.rotation.x = head.rotation.x - easedMouse.y * 0.02 * helmetReveal * (1 - scrollProgress);
      if (wire) wire.rotation.copy(helmet.rotation);
    }

    noiseUniforms.uTime.value = t; noiseUniforms.uMousePace.value = easedPace * 4; noiseUniforms.uReveal.value = reveal.v;
    comp.uReveal.value = reveal.v;

    renderer.setRenderTarget(noiseRT); renderer.render(noiseScene, quadCam);
    renderer.setRenderTarget(headRT); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(headScene, camera);
    renderer.setRenderTarget(helmetRT); renderer.clear(); if (helmet) renderer.render(helmetScene, camera);
    renderer.setRenderTarget(null); renderer.render(compScene, quadCam);
  };
  raf = requestAnimationFrame(frame);
  canvas.classList.add('is-gl-ready');

  return {
    playReveal,
    destroy() {
      cancelAnimationFrame(raf);
      io.disconnect();
      triggers.forEach((t) => t.kill());
      window.removeEventListener('resize', onResize);
      host.removeEventListener('mousemove', onMove);
      host.removeEventListener('touchmove', onMove);
      hoverEls.forEach((el) => { el.removeEventListener('mouseenter', onHelmetEnter); el.removeEventListener('mouseleave', onHelmetLeave); });
      renderer.dispose(); headRT.dispose(); helmetRT.dispose(); noiseRT.dispose(); draco.dispose();
    },
  };
}
