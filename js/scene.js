/* ═══════════════════════════════════════════════════════════
   VENT LINE — 3D-сцена (Three.js, matcap, без источников света)
   Одна fixed-canvas на hero и сцену монтажа:
   появление модели → падение при скролле → посадка в бетон →
   отделка → чистовой финиш → «фотовспышка» и слияние
   с фотографией готового объекта.
   ═══════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('scene-canvas');

if (reduced || !canvas || !window.WebGLRenderingContext) {
  document.dispatchEvent(new CustomEvent('scene-ready'));
} else {
  init();
}

function init() {
  const montageEl = document.getElementById('montage');
  const photoEl = document.getElementById('montage-photo');
  const flashEl = document.getElementById('montage-flash');
  const noteEl = document.getElementById('montage-note');
  const finalEl = document.getElementById('montage-final');
  const stepEls = Array.from(document.querySelectorAll('#montage-steps li'));

  /* ── renderer / scene / camera ───────────────────────── */
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 0, 120);

  /* ── matcap «анодированный алюминий» ─────────────────── */
  function makeMatcap() {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');

    // тёмная металлическая база с холодным отливом
    const base = g.createRadialGradient(S * 0.42, S * 0.38, S * 0.05, S * 0.5, S * 0.5, S * 0.62);
    base.addColorStop(0, '#7b7e85');
    base.addColorStop(0.35, '#50535a');
    base.addColorStop(0.7, '#303236');
    base.addColorStop(1, '#131315');
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);

    // ключевой студийный блик (верх)
    const key = g.createRadialGradient(S * 0.36, S * 0.22, 4, S * 0.36, S * 0.22, S * 0.3);
    key.addColorStop(0, 'rgba(255,255,255,0.95)');
    key.addColorStop(0.18, 'rgba(255,255,255,0.55)');
    key.addColorStop(0.5, 'rgba(230,235,245,0.12)');
    key.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = key;
    g.fillRect(0, 0, S, S);

    // узкая горизонтальная «полоса софтбокса»
    const strip = g.createLinearGradient(0, S * 0.30, 0, S * 0.45);
    strip.addColorStop(0, 'rgba(255,255,255,0)');
    strip.addColorStop(0.5, 'rgba(240,244,250,0.38)');
    strip.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = strip;
    g.fillRect(0, S * 0.30, S, S * 0.15);

    // нижний тёплый отражённый свет
    const bounce = g.createRadialGradient(S * 0.62, S * 0.86, 6, S * 0.62, S * 0.86, S * 0.34);
    bounce.addColorStop(0, 'rgba(214,200,178,0.30)');
    bounce.addColorStop(1, 'rgba(214,200,178,0)');
    g.fillStyle = bounce;
    g.fillRect(0, 0, S, S);

    // резкая грань между светом и тенью (металличность)
    const edge = g.createLinearGradient(0, S * 0.52, 0, S * 0.60);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(0.5, 'rgba(0,0,0,0.35)');
    edge.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = edge;
    g.fillRect(0, S * 0.52, S, S * 0.08);

    // анизотропные вертикальные штрихи (брашированный профиль)
    g.globalAlpha = 0.05;
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * S;
      g.strokeStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
      g.lineWidth = 0.8 + Math.random() * 1.4;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + (Math.random() - 0.5) * 18, S);
      g.stroke();
    }
    g.globalAlpha = 1;

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* ── геометрия зоны решётки на «потолке» ─────────────── */
  const PLANE_W = 260, PLANE_H = 190, TEX = 1024;
  const PLANE_Z = -6;
  const SEAT = { x: 0, y: 7 };                 // мировая позиция посадки
  const GR_W = 82, GR_H = 25;                  // след решётки в мировых координатах

  // мировые координаты → пиксели текстуры
  const u = wx => (wx + PLANE_W / 2) / PLANE_W * TEX;
  const v = wy => (1 - (wy + PLANE_H / 2) / PLANE_H) * TEX;
  const uw = w => w / PLANE_W * TEX;
  const vh = h => h / PLANE_H * TEX;

  function noiseSpeckle(g, n, alpha, dark) {
    for (let i = 0; i < n; i++) {
      const x = Math.random() * TEX, y = Math.random() * TEX;
      const r = Math.random() * 2.0 + 0.4;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fillStyle = dark
        ? `rgba(40,40,38,${alpha * Math.random()})`
        : `rgba(255,255,254,${alpha * Math.random()})`;
      g.fill();
    }
  }

  // ЭТАП 0: бетон — опалубочные щиты, стяжки, подтёки, разметка проёма
  function makeConcrete() {
    const c = document.createElement('canvas');
    c.width = c.height = TEX;
    const g = c.getContext('2d');
    g.fillStyle = '#adaba6';
    g.fillRect(0, 0, TEX, TEX);

    // крупные неровности тона
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * TEX, y = Math.random() * TEX;
      const r = 80 + Math.random() * 230;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      const tone = Math.random() > 0.5 ? '158,156,150' : '184,182,176';
      grad.addColorStop(0, `rgba(${tone},${0.16 + Math.random() * 0.2})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // вертикальные подтёки
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * TEX, y = Math.random() * TEX * 0.7;
      const len = 60 + Math.random() * 240, w = 6 + Math.random() * 26;
      const grad = g.createLinearGradient(0, y, 0, y + len);
      grad.addColorStop(0, `rgba(120,118,112,${0.10 + Math.random() * 0.10})`);
      grad.addColorStop(1, 'rgba(120,118,112,0)');
      g.fillStyle = grad;
      g.fillRect(x, y, w, len);
    }

    noiseSpeckle(g, 3200, 0.20, true);
    noiseSpeckle(g, 1600, 0.14, false);

    // сетка опалубочных щитов
    g.strokeStyle = 'rgba(74,74,70,0.30)';
    g.lineWidth = 2.5;
    [212, 512, 812].forEach(x => { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, TEX); g.stroke(); });
    g.strokeStyle = 'rgba(74,74,70,0.22)';
    [340, 680].forEach(y => { g.beginPath(); g.moveTo(0, y); g.lineTo(TEX, y); g.stroke(); });

    // отверстия стяжек на пересечениях
    [212, 512, 812].forEach(x => [340, 680].forEach(y => {
      const grad = g.createRadialGradient(x, y, 1, x, y, 12);
      grad.addColorStop(0, 'rgba(52,52,48,0.85)');
      grad.addColorStop(0.6, 'rgba(52,52,48,0.35)');
      grad.addColorStop(1, 'rgba(52,52,48,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill();
    }));

    // тонкие трещины
    g.strokeStyle = 'rgba(80,80,76,0.35)';
    g.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      let x = Math.random() * TEX, y = Math.random() * TEX;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (Math.random() - 0.5) * 90;
        y += Math.random() * 60;
        g.lineTo(x, y);
      }
      g.stroke();
    }

    // меловая разметка проёма под решётку
    const rx = u(SEAT.x - GR_W / 2 - 3), ry = v(SEAT.y + GR_H / 2 + 3);
    const rw = uw(GR_W + 6), rh = vh(GR_H + 6);
    g.strokeStyle = 'rgba(250,250,247,0.75)';
    g.lineWidth = 2.5;
    g.setLineDash([16, 12]);
    g.strokeRect(rx, ry, rw, rh);
    g.setLineDash([]);
    // угловые метки
    g.lineWidth = 3.5;
    const L = 26;
    [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]].forEach(([px, py], i) => {
      const sx = i % 2 === 0 ? 1 : -1;
      const sy = i < 2 ? 1 : -1;
      g.beginPath();
      g.moveTo(px - sx * 8, py);
      g.lineTo(px + sx * L, py);
      g.moveTo(px, py - sy * 8);
      g.lineTo(px, py + sy * L);
      g.stroke();
    });
    // подпись оси
    g.fillStyle = 'rgba(250,250,247,0.65)';
    g.font = '26px monospace';
    g.fillText('ось В-2 · проём 2-RM-30', rx, ry - 18);

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ЭТАП 1: отделка — листы ГКЛ, швы с лентой, саморезы, вырез под профиль
  function makeDrywall() {
    const c = document.createElement('canvas');
    c.width = c.height = TEX;
    const g = c.getContext('2d');
    g.fillStyle = '#cbccc9';
    g.fillRect(0, 0, TEX, TEX);

    // лёгкая бумажная фактура
    for (let i = 0; i < 30; i++) {
      const y = Math.random() * TEX;
      g.fillStyle = `rgba(${Math.random() > 0.5 ? '196,197,194' : '210,211,208'},${0.14 + Math.random() * 0.14})`;
      g.fillRect(0, y, TEX, 20 + Math.random() * 70);
    }
    noiseSpeckle(g, 700, 0.07, true);

    const seams = [256, 512, 768];
    // стыки листов
    seams.forEach(x => {
      g.strokeStyle = 'rgba(110,110,106,0.5)';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, TEX); g.stroke();
    });
    // зашпаклёванные швы (светлые полосы поверх стыков)
    seams.forEach(x => {
      const band = g.createLinearGradient(x - 34, 0, x + 34, 0);
      band.addColorStop(0, 'rgba(233,231,224,0)');
      band.addColorStop(0.5, 'rgba(233,231,224,0.9)');
      band.addColorStop(1, 'rgba(233,231,224,0)');
      g.fillStyle = band;
      g.fillRect(x - 34, 0, 68, TEX);
    });
    // саморезы — точки с притемнением, рядами вдоль швов и по полю
    const screw = (x, y) => {
      const grad = g.createRadialGradient(x, y, 0.5, x, y, 6);
      grad.addColorStop(0, 'rgba(70,70,66,0.8)');
      grad.addColorStop(0.5, 'rgba(150,148,142,0.5)');
      grad.addColorStop(1, 'rgba(150,148,142,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
    };
    seams.forEach(x => { for (let y = 60; y < TEX; y += 128) screw(x + (Math.random() - 0.5) * 6, y); });
    [128, 384, 640, 896].forEach(x => { for (let y = 96; y < TEX; y += 190) screw(x + (Math.random() - 0.5) * 10, y); });

    // аккуратный вырез под профиль: кромка + шпаклёвка по периметру
    const rx = u(SEAT.x - GR_W / 2 - 1.2), ry = v(SEAT.y + GR_H / 2 + 1.2);
    const rw = uw(GR_W + 2.4), rh = vh(GR_H + 2.4);
    const skim = g.createRadialGradient(rx + rw / 2, ry + rh / 2, Math.min(rw, rh) * 0.3, rx + rw / 2, ry + rh / 2, rw * 0.75);
    skim.addColorStop(0, 'rgba(233,231,224,0.85)');
    skim.addColorStop(1, 'rgba(233,231,224,0)');
    g.fillStyle = skim;
    g.fillRect(rx - rw * 0.3, ry - rh * 1.2, rw * 1.6, rh * 3.4);
    g.strokeStyle = 'rgba(96,96,92,0.65)';
    g.lineWidth = 2;
    g.strokeRect(rx, ry, rw, rh);

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ЭТАП 2: чистовой финиш — окрашенный потолок
  function makePaint() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#f7f6f2';
    g.fillRect(0, 0, 512, 512);
    // мягкий свет из верхнего угла
    const lightGrad = g.createLinearGradient(0, 0, 512, 512);
    lightGrad.addColorStop(0, 'rgba(255,255,255,0.55)');
    lightGrad.addColorStop(0.55, 'rgba(255,255,255,0)');
    lightGrad.addColorStop(1, 'rgba(216,214,207,0.4)');
    g.fillStyle = lightGrad;
    g.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // контактная тень под решёткой
  function makeShadowTex() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 96;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 48, 6, 128, 48, 120);
    grad.addColorStop(0, 'rgba(20,20,18,0.55)');
    grad.addColorStop(0.5, 'rgba(20,20,18,0.22)');
    grad.addColorStop(1, 'rgba(20,20,18,0)');
    g.fillStyle = grad;
    g.save();
    g.translate(128, 48);
    g.scale(1, 0.38);
    g.translate(-128, -48);
    g.fillRect(0, -80, 256, 256);
    g.restore();
    return new THREE.CanvasTexture(c);
  }

  /* ── слои «потолка» ──────────────────────────────────── */
  // на узких экранах вся сцена монтажа уменьшается, чтобы решётка и проём помещались в кадр
  const NARROW_K = (window.innerWidth / window.innerHeight) < 0.95 ? 0.42 : 1;
  const stage = new THREE.Group();
  stage.scale.setScalar(NARROW_K);
  scene.add(stage);

  function makeLayer(tex, z) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(PLANE_W, PLANE_H),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false })
    );
    m.position.z = z;
    stage.add(m);
    return m;
  }
  const concrete = makeLayer(makeConcrete(), PLANE_Z - 0.02);
  const drywall = makeLayer(makeDrywall(), PLANE_Z - 0.01);
  const paint = makeLayer(makePaint(), PLANE_Z);

  // тёмная полость, видимая сквозь щели севшей решётки
  function makeCavityTex() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 160;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, '#050505');
    grad.addColorStop(0.5, '#101010');
    grad.addColorStop(1, '#060606');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 160);
    return new THREE.CanvasTexture(c);
  }
  const cavity = new THREE.Mesh(
    new THREE.PlaneGeometry(GR_W, GR_H),
    new THREE.MeshBasicMaterial({ map: makeCavityTex(), transparent: true, opacity: 0, depthWrite: false })
  );
  cavity.position.set(SEAT.x, SEAT.y, PLANE_Z + 0.3);
  stage.add(cavity);

  // контактная тень
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(GR_W + 26, GR_H + 22),
    new THREE.MeshBasicMaterial({ map: makeShadowTex(), transparent: true, opacity: 0, depthWrite: false })
  );
  contactShadow.position.set(SEAT.x, SEAT.y - 2, PLANE_Z + 0.35);
  stage.add(contactShadow);

  /* ── решётка (STL) ───────────────────────────────────── */
  const material = new THREE.MeshMatcapMaterial({ matcap: makeMatcap(), color: 0xffffff });

  const scrollGroup = new THREE.Group(); // управляется скроллом
  const floatGroup = new THREE.Group();  // лёгкое парение + параллакс мыши
  scrollGroup.add(floatGroup);
  scene.add(scrollGroup);

  let modelReady = false;

  /* ── позы ─────────────────────────────────────────────── */
  function isNarrow() { return camera.aspect < 0.95; }
  function heroPose() {
    return isNarrow()
      ? { px: 0, py: -13, pz: 16, rx: 0.18, ry: -0.45, rz: -0.08, s: 0.055 }
      : { px: 15, py: -2, pz: 16, rx: 0.15, ry: -0.45, rz: -0.1, s: 0.095 };
  }
  const seatPose = {
    px: SEAT.x * NARROW_K, py: SEAT.y * NARROW_K, pz: -1.4,
    rx: 0.02, ry: 0, rz: 0, s: 0.155 * NARROW_K
  };
  const entryPose = { px: 44, py: -34, pz: 2, rx: 0.9, ry: -1.15, rz: 0.22, s: 0.12 };

  function applyPose(p) {
    scrollGroup.position.set(p.px, p.py, p.pz);
    scrollGroup.rotation.set(p.rx, p.ry, p.rz);
    scrollGroup.scale.setScalar(p.s);
  }

  /* ── загрузка STL ────────────────────────────────────── */
  new STLLoader().load('assets/rm30.stl', geometry => {
    geometry.center();
    const mesh = new THREE.Mesh(geometry, material);
    // ориентация: длина (geo Z) → мировой X, лицевая сторона (geo −Y) → к камере (+Z)
    const m4 = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(1, 0, 0)
    );
    mesh.quaternion.setFromRotationMatrix(m4);
    floatGroup.add(mesh);
    modelReady = true;

    const atTop = (window.scrollY || 0) < window.innerHeight * 0.4;
    applyPose(heroPose());
    if (atTop && window.gsap) {
      const h = heroPose();
      gsap.fromTo(scrollGroup.position,
        { x: entryPose.px, y: entryPose.py, z: entryPose.pz },
        { x: h.px, y: h.py, z: h.pz, duration: 1.8, ease: 'power3.out', delay: 0.2 });
      gsap.fromTo(scrollGroup.rotation,
        { x: entryPose.rx, y: entryPose.ry, z: entryPose.rz },
        { x: h.rx, y: h.ry, z: h.rz, duration: 1.8, ease: 'power3.out', delay: 0.2 });
      gsap.fromTo(scrollGroup.scale,
        { x: entryPose.s, y: entryPose.s, z: entryPose.s },
        { x: h.s, y: h.s, z: h.s, duration: 1.8, ease: 'power3.out', delay: 0.2 });
    }
    document.dispatchEvent(new CustomEvent('scene-ready'));
    buildScroll();
  }, undefined, () => {
    // не загрузилось — не блокируем сайт
    document.dispatchEvent(new CustomEvent('scene-ready'));
  });

  /* ── параллакс мыши (только в hero) ──────────────────── */
  let mx = 0, my = 0, heroBlend = 1;
  window.addEventListener('pointermove', e => {
    mx = (e.clientX / window.innerWidth - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  /* ── scroll-хореография ──────────────────────────────── */
  const merge = { canvas: 1, flash: 0, photo: 0, photoScale: 1.08 };
  let scrollTl = null;

  function buildScroll() {
    if (!window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: montageEl,
        start: 'top bottom',
        end: 'bottom bottom',
        scrub: 0.65,
        onUpdate: self => setStep(self.progress),
        invalidateOnRefresh: true
      },
      defaults: { ease: 'none' }
    });

    // 0–0.12 — решётка «падает» из hero к центру, проявляется бетон с проёмом
    tl.to(scrollGroup.position, { x: seatPose.px, y: seatPose.py + 15 * NARROW_K, z: seatPose.pz + 11, duration: 12 }, 0);
    tl.to(scrollGroup.rotation, { x: seatPose.rx + 0.3, y: 0, z: 0, duration: 12 }, 0);
    tl.to(scrollGroup.scale, { x: 0.142 * NARROW_K, y: 0.142 * NARROW_K, z: 0.142 * NARROW_K, duration: 12 }, 0);
    tl.to(concrete.material, { opacity: 1, duration: 10 }, 2);
    tl.to(cavity.material, { opacity: 0.95, duration: 6 }, 5);

    // 0.12–0.20 — посадка в проём
    tl.to(scrollGroup.position, { y: seatPose.py, z: seatPose.pz, duration: 8, ease: 'power2.out' }, 12);
    tl.to(scrollGroup.rotation, { x: seatPose.rx, duration: 8, ease: 'power2.out' }, 12);
    tl.to(scrollGroup.scale, { x: seatPose.s, y: seatPose.s, z: seatPose.s, duration: 8 }, 12);
    tl.to(contactShadow.material, { opacity: 0.6, duration: 6 }, 14);

    // 0.24–0.40 — отделка: лист ГКЛ «поднимается» к потолку и закрывает бетон
    drywall.position.y = -12;
    tl.to(drywall.material, { opacity: 1, duration: 7 }, 24);
    tl.to(drywall.position, { y: 0, duration: 14, ease: 'power1.out' }, 24);

    // 0.46–0.60 — чистовой финиш: окрашенный потолок (профиль уже в RAL с завода)
    tl.to(paint.material, { opacity: 1, duration: 14 }, 46);
    tl.to(contactShadow.material, { opacity: 0.32, duration: 14 }, 46);

    // 0.62–0.78 — «фотовспышка»: срез на фотографию готового объекта
    tl.to(merge, { flash: 1, duration: 4, ease: 'power2.in' }, 62);
    tl.to(merge, { photo: 1, duration: 0.8 }, 65);
    tl.to(merge, { canvas: 0, duration: 1.2 }, 65.4);
    tl.to(merge, { flash: 0, duration: 10, ease: 'power2.out' }, 67);
    tl.to(merge, { photoScale: 1.015, duration: 18 }, 62);

    // 0.80–1 — фото плавно «доезжает», финальный оверлей
    tl.to(merge, { photoScale: 1, duration: 20 }, 80);

    scrollTl = tl;
  }

  let lastStep = 0;
  function setStep(p) {
    const idx = p < 0.22 ? 0 : p < 0.44 ? 1 : p < 0.62 ? 2 : 3;
    if (idx !== lastStep) {
      stepEls.forEach((el, i) => el.classList.toggle('is-active', i === idx));
      lastStep = idx;
    }
    heroBlend = THREE.MathUtils.clamp(1 - p * 6, 0, 1);
    montageEl.classList.toggle('is-merged', p > 0.63);
    if (finalEl) {
      const t = THREE.MathUtils.clamp((p - 0.8) / 0.12, 0, 1);
      finalEl.style.opacity = t;
      finalEl.style.visibility = t > 0.01 ? 'visible' : 'hidden';
    }
    if (noteEl) noteEl.style.opacity = p > 0.6 ? 0 : 1;
  }

  function applyMergeStyles() {
    canvas.style.opacity = merge.canvas;
    if (flashEl) flashEl.style.opacity = merge.flash;
    if (photoEl) {
      photoEl.style.opacity = merge.photo;
      photoEl.style.transform = `scale(${merge.photoScale})`;
    }
  }

  /* ── рендер-цикл ─────────────────────────────────────── */
  const clock = new THREE.Clock();
  function tick() {
    requestAnimationFrame(tick);
    if (document.hidden || !modelReady) return;

    applyMergeStyles();
    if (merge.canvas <= 0.01) return; // сцена невидима — не рендерим

    const t = clock.getElapsedTime();
    // лёгкое парение + параллакс мыши, гаснущие при входе в сцену монтажа
    floatGroup.position.y = Math.sin(t * 0.8) * 1.1 * heroBlend;
    floatGroup.rotation.x += ((my * 0.05 * heroBlend) - floatGroup.rotation.x) * 0.06;
    floatGroup.rotation.y += ((mx * 0.09 * heroBlend) - floatGroup.rotation.y) * 0.06;
    floatGroup.rotation.z = Math.sin(t * 0.5) * 0.012 * heroBlend;

    renderer.render(scene, camera);
  }
  tick();

  /* ── resize ──────────────────────────────────────────── */
  let wasNarrow = isNarrow();
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (isNarrow() !== wasNarrow) {
      wasNarrow = isNarrow();
      if ((window.scrollY || 0) < window.innerHeight * 0.4) applyPose(heroPose());
    }
  });

  /* отладочный хук: рендер кадра по запросу (работает и в скрытой вкладке) */
  window.__vent = {
    snap(progress, poseOverride) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (progress != null && scrollTl) {
        scrollTl.progress(progress);
        setStep(progress);
      }
      if (poseOverride) applyPose(poseOverride);
      applyMergeStyles();
      renderer.render(scene, camera);
      const w = 760;
      const h = Math.round(w * canvas.height / canvas.width);
      const c2 = document.createElement('canvas');
      c2.width = w; c2.height = h;
      const g = c2.getContext('2d');
      g.fillStyle = '#FAFAF7';
      g.fillRect(0, 0, w, h);
      g.drawImage(renderer.domElement, 0, 0, w, h);
      return c2.toDataURL('image/jpeg', 0.82);
    },
    ready: () => modelReady
  };
}
