/* ═══════════════════════════════════════════════════════════
   VENT LINE — 3D-сцена (Three.js, matcap, без источников света)
   Одна fixed-canvas на hero и сцену монтажа:
   появление модели → падение с кувырком → посадка в бетон
   (пыль, контактная тень) → отделка → чистовой финиш →
   светящаяся щель раскрывает фотографию готового объекта.
   ═══════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('scene-canvas');

if (reduced || !canvas || !window.WebGLRenderingContext) {
  // асинхронно: main.js (следующий module-скрипт) должен успеть повесить слушатель
  window.__sceneReady = true;
  setTimeout(() => document.dispatchEvent(new CustomEvent('scene-ready')), 0);
} else {
  init();
}

function init() {
  // сцена жива — включаем сценарный режим секции монтажа (иначе CSS-фолбэк)
  document.documentElement.classList.add('has-scene');

  const montageEl = document.getElementById('montage');
  const photoEl = document.getElementById('montage-photo');
  const beamEl = document.getElementById('montage-beam');
  const finalEl = document.getElementById('montage-final');
  const stepEls = Array.from(document.querySelectorAll('#montage-steps li'));

  /* ── renderer / scene / camera ───────────────────────── */
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.localClippingEnabled = true; // для «прокатки» краски клип-плоскостью

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 0, 120);

  /* ── matcap «чёрная порошковая окраска по металлу» ───── */
  // матовая краска: мягкий широкий свет, сатиновый отлив, никаких хромовых полос
  function makeMatcap() {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');

    const base = g.createRadialGradient(S * 0.42, S * 0.36, S * 0.04, S * 0.5, S * 0.5, S * 0.64);
    base.addColorStop(0, '#48494d');
    base.addColorStop(0.38, '#2e2f32');
    base.addColorStop(0.72, '#1c1d1f');
    base.addColorStop(1, '#0e0e0f');
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);

    // широкий мягкий ключевой свет — как на матовой краске
    const key = g.createRadialGradient(S * 0.35, S * 0.24, S * 0.03, S * 0.35, S * 0.24, S * 0.5);
    key.addColorStop(0, 'rgba(255,255,255,0.34)');
    key.addColorStop(0.4, 'rgba(255,255,255,0.14)');
    key.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = key;
    g.fillRect(0, 0, S, S);

    // едва заметный сатиновый отлив сверху
    const sheen = g.createLinearGradient(0, 0, 0, S * 0.55);
    sheen.addColorStop(0, 'rgba(255,255,255,0.08)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, S, S * 0.55);

    // тёплый отражённый свет снизу, очень слабый
    const bounce = g.createRadialGradient(S * 0.6, S * 0.88, 8, S * 0.6, S * 0.88, S * 0.36);
    bounce.addColorStop(0, 'rgba(205,196,182,0.10)');
    bounce.addColorStop(1, 'rgba(205,196,182,0)');
    g.fillStyle = bounce;
    g.fillRect(0, 0, S, S);

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

  // многооктавный value-noise — основа фактуры бетона
  function makeNoiseCanvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    const octs = [
      { n: 7, amp: 0.42 },
      { n: 18, amp: 0.28 },
      { n: 52, amp: 0.18 },
      { n: 140, amp: 0.12 }
    ].map(o => {
      const a = new Float32Array((o.n + 2) * (o.n + 2));
      for (let i = 0; i < a.length; i++) a[i] = Math.random();
      return { n: o.n, amp: o.amp, a };
    });
    const sm = t => t * t * (3 - 2 * t);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let v = 0;
        for (const o of octs) {
          const gx = x / size * o.n, gy = y / size * o.n;
          const x0 = gx | 0, y0 = gy | 0;
          const fx = sm(gx - x0), fy = sm(gy - y0);
          const w = o.n + 2;
          const a = o.a[y0 * w + x0], b = o.a[y0 * w + x0 + 1];
          const d = o.a[(y0 + 1) * w + x0], e = o.a[(y0 + 1) * w + x0 + 1];
          const top = a + (b - a) * fx;
          const bot = d + (e - d) * fx;
          v += (top + (bot - top) * fy) * o.amp;
        }
        // бетонная гамма с лёгким холодным подтоном
        const tone = 150 + v * 42;
        const i4 = (y * size + x) * 4;
        img.data[i4] = tone;
        img.data[i4 + 1] = tone;
        img.data[i4 + 2] = tone - 3;
        img.data[i4 + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // ЭТАП 0: бетон — монолит с опалубочными щитами, стяжками, подтёками
  function makeConcrete() {
    const c = document.createElement('canvas');
    c.width = c.height = TEX;
    const g = c.getContext('2d');

    // фактура: noise 512 растягиваем до 1024 — мягкое сглаживание бесплатно
    g.drawImage(makeNoiseCanvas(512), 0, 0, TEX, TEX);

    const seamsX = [212, 512, 812];
    const seamsY = [340, 680];

    // лёгкая разнотонность опалубочных щитов
    const panelsX = [0, ...seamsX, TEX];
    const panelsY = [0, ...seamsY, TEX];
    for (let i = 0; i < panelsX.length - 1; i++) {
      for (let j = 0; j < panelsY.length - 1; j++) {
        const shade = (Math.random() - 0.5) * 0.09;
        g.fillStyle = shade > 0
          ? `rgba(255,255,252,${shade})`
          : `rgba(38,38,36,${-shade})`;
        g.fillRect(panelsX[i], panelsY[j], panelsX[i + 1] - panelsX[i], panelsY[j + 1] - panelsY[j]);
      }
    }

    // вертикальные подтёки — в основном от швов
    for (let i = 0; i < 14; i++) {
      const x = Math.random() > 0.5
        ? seamsX[(Math.random() * 3) | 0] + (Math.random() - 0.5) * 30
        : Math.random() * TEX;
      const y = Math.random() * TEX * 0.6;
      const len = 90 + Math.random() * 280, w = 7 + Math.random() * 22;
      const grad = g.createLinearGradient(0, y, 0, y + len);
      grad.addColorStop(0, `rgba(112,110,104,${0.06 + Math.random() * 0.08})`);
      grad.addColorStop(1, 'rgba(112,110,104,0)');
      g.fillStyle = grad;
      g.fillRect(x, y, w, len);
    }

    // швы опалубки: тёмная линия + светлая фаска
    seamsX.forEach(x => {
      g.fillStyle = 'rgba(56,56,52,0.5)';
      g.fillRect(x - 1, 0, 2.5, TEX);
      g.fillStyle = 'rgba(255,255,252,0.16)';
      g.fillRect(x + 1.5, 0, 1.5, TEX);
    });
    seamsY.forEach(y => {
      g.fillStyle = 'rgba(56,56,52,0.4)';
      g.fillRect(0, y - 1, TEX, 2.5);
      g.fillStyle = 'rgba(255,255,252,0.14)';
      g.fillRect(0, y + 1.5, TEX, 1.5);
    });

    // отверстия стяжек: заглублённый конус + блик по нижней кромке
    seamsX.forEach(x => seamsY.forEach(y => {
      const hole = g.createRadialGradient(x, y - 1.5, 1, x, y, 13);
      hole.addColorStop(0, 'rgba(30,30,28,0.9)');
      hole.addColorStop(0.45, 'rgba(52,52,48,0.55)');
      hole.addColorStop(1, 'rgba(52,52,48,0)');
      g.fillStyle = hole;
      g.beginPath(); g.arc(x, y, 13, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,252,0.28)';
      g.lineWidth = 1.6;
      g.beginPath(); g.arc(x, y + 1, 7.5, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
    }));

    // поры и мелкие раковины
    noiseSpeckle(g, 2400, 0.16, true);
    noiseSpeckle(g, 700, 0.1, false);

    // волосяные трещины
    g.strokeStyle = 'rgba(72,72,68,0.28)';
    g.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      let x = Math.random() * TEX, y = Math.random() * TEX;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 7; s++) {
        x += (Math.random() - 0.5) * 70;
        y += Math.random() * 55;
        g.lineTo(x, y);
      }
      g.stroke();
    }

    // лёгкое затемнение к краям — глубина кадра
    const vig = g.createRadialGradient(TEX / 2, TEX / 2, TEX * 0.35, TEX / 2, TEX / 2, TEX * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(28,28,26,0.14)');
    g.fillStyle = vig;
    g.fillRect(0, 0, TEX, TEX);

    // тонкая монтажная разметка проёма — только линии, без подписей
    const rx = u(SEAT.x - GR_W / 2 - 3), ry = v(SEAT.y + GR_H / 2 + 3);
    const rw = uw(GR_W + 6), rh = vh(GR_H + 6);
    g.strokeStyle = 'rgba(250,250,247,0.55)';
    g.lineWidth = 2;
    g.setLineDash([14, 11]);
    g.strokeRect(rx, ry, rw, rh);
    g.setLineDash([]);

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ЭТАП 1a: чистый лист ГКЛ — стыки и кромка выреза, без шпаклёвки
  function makeDrywallBoard() {
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

    // стыки листов + утоненная кромка (заводская фаска)
    [256, 512, 768].forEach(x => {
      g.strokeStyle = 'rgba(110,110,106,0.55)';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, TEX); g.stroke();
      const bevel = g.createLinearGradient(x - 22, 0, x + 22, 0);
      bevel.addColorStop(0, 'rgba(120,120,116,0)');
      bevel.addColorStop(0.5, 'rgba(120,120,116,0.18)');
      bevel.addColorStop(1, 'rgba(120,120,116,0)');
      g.fillStyle = bevel;
      g.fillRect(x - 22, 0, 44, TEX);
    });

    // вырез под профиль: тёмная кромка реза
    const rx = u(SEAT.x - GR_W / 2 - 1.2), ry = v(SEAT.y + GR_H / 2 + 1.2);
    const rw = uw(GR_W + 2.4), rh = vh(GR_H + 2.4);
    g.strokeStyle = 'rgba(96,96,92,0.7)';
    g.lineWidth = 2.5;
    g.strokeRect(rx, ry, rw, rh);

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ЭТАП 1b: шпаклёвка — светлые полосы по швам, саморезы, обход проёма
  function makeFinishOverlay() {
    const c = document.createElement('canvas');
    c.width = c.height = TEX;
    const g = c.getContext('2d');

    const seams = [256, 512, 768];
    seams.forEach(x => {
      const band = g.createLinearGradient(x - 36, 0, x + 36, 0);
      band.addColorStop(0, 'rgba(233,231,224,0)');
      band.addColorStop(0.5, 'rgba(233,231,224,0.92)');
      band.addColorStop(1, 'rgba(233,231,224,0)');
      g.fillStyle = band;
      g.fillRect(x - 36, 0, 72, TEX);
    });
    // саморезы — зашпаклёванные точки
    const screw = (x, y) => {
      const grad = g.createRadialGradient(x, y, 0.5, x, y, 7);
      grad.addColorStop(0, 'rgba(228,226,219,0.95)');
      grad.addColorStop(0.55, 'rgba(180,178,172,0.5)');
      grad.addColorStop(1, 'rgba(180,178,172,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
    };
    seams.forEach(x => { for (let y = 60; y < TEX; y += 128) screw(x + (Math.random() - 0.5) * 6, y); });
    [128, 384, 640, 896].forEach(x => { for (let y = 96; y < TEX; y += 190) screw(x + (Math.random() - 0.5) * 10, y); });

    // обход проёма шпаклёвкой
    const rx = u(SEAT.x - GR_W / 2 - 1.2), ry = v(SEAT.y + GR_H / 2 + 1.2);
    const rw = uw(GR_W + 2.4), rh = vh(GR_H + 2.4);
    const skim = g.createRadialGradient(rx + rw / 2, ry + rh / 2, Math.min(rw, rh) * 0.3, rx + rw / 2, ry + rh / 2, rw * 0.75);
    skim.addColorStop(0, 'rgba(233,231,224,0.85)');
    skim.addColorStop(1, 'rgba(233,231,224,0)');
    g.fillStyle = skim;
    g.fillRect(rx - rw * 0.3, ry - rh * 1.2, rw * 1.6, rh * 3.4);

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
  let NARROW_K = 1;
  const stage = new THREE.Group();
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
  const drywall = makeLayer(makeDrywallBoard(), PLANE_Z - 0.012);
  const finish = makeLayer(makeFinishOverlay(), PLANE_Z - 0.006);
  const paint = makeLayer(makePaint(), PLANE_Z);

  // краска «прокатывается» слева направо клип-плоскостью (world-space)
  paint.material.opacity = 1;
  const paintClip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), -400);
  paint.material.clippingPlanes = [paintClip];
  // «мокрая кромка» валика на границе прокраски
  const wetEdge = new THREE.Mesh(
    new THREE.PlaneGeometry(8, PLANE_H),
    new THREE.MeshBasicMaterial({ color: 0xfff8ec, transparent: true, opacity: 0, depthWrite: false })
  );
  wetEdge.position.z = PLANE_Z + 0.05;
  stage.add(wetEdge);

  // тёмная полость, видимая сквозь щели севшей решётки
  function makeCavityTex() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 160;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, '#060606');
    grad.addColorStop(0.5, '#141414');
    grad.addColorStop(1, '#070707');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 160);
    // внутренние тени по периметру — глубина проёма
    const edge = (x0, y0, x1, y1) => {
      const e = g.createLinearGradient(x0, y0, x1, y1);
      e.addColorStop(0, 'rgba(0,0,0,0.85)');
      e.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = e;
      g.fillRect(0, 0, 512, 160);
    };
    edge(0, 0, 26, 0); edge(512, 0, 486, 0);
    edge(0, 0, 0, 20); edge(0, 160, 0, 140);
    // едва заметный отсвет комнаты на нижней стенке проёма
    const glow = g.createLinearGradient(0, 160, 0, 130);
    glow.addColorStop(0, 'rgba(120,116,106,0.18)');
    glow.addColorStop(1, 'rgba(120,116,106,0)');
    g.fillStyle = glow;
    g.fillRect(0, 130, 512, 30);
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

  /* ── облачко пыли при посадке в проём ────────────────── */
  function makeDustSprite() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(232,229,222,0.9)');
    grad.addColorStop(0.5, 'rgba(214,211,203,0.35)');
    grad.addColorStop(1, 'rgba(214,211,203,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  const DUST_N = 130;
  const dustSeed = [];
  const dustPos = new Float32Array(DUST_N * 3);
  for (let i = 0; i < DUST_N; i++) {
    // источники: нижняя кромка решётки и её торцы
    const x0 = Math.random() < 0.7
      ? (Math.random() - 0.5) * GR_W
      : (Math.random() > 0.5 ? 1 : -1) * GR_W / 2;
    const y0 = SEAT.y - GR_H / 2 + Math.random() * 3;
    dustSeed.push({
      x0, y0,
      vx: (Math.random() - 0.5) * 26 + Math.sign(x0) * 4,
      vy: -(3 + Math.random() * 15),
      vz: Math.random() * 5
    });
    dustPos[i * 3] = x0;
    dustPos[i * 3 + 1] = y0;
    dustPos[i * 3 + 2] = PLANE_Z + 1;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    map: makeDustSprite(),
    size: 3.2,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    color: 0xdedbd3
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.visible = false;
  stage.add(dust);

  // p — общий прогресс сцены; пыль живёт в окне удара 0.175…0.28
  function applyDust(p) {
    const t = THREE.MathUtils.clamp((p - 0.168) / 0.1, 0, 1);
    if (t <= 0 || t >= 1) {
      dust.visible = false;
      dustMat.opacity = 0;
      return;
    }
    dust.visible = true;
    const e = 1 - (1 - t) * (1 - t);
    const attr = dustGeo.attributes.position;
    for (let i = 0; i < DUST_N; i++) {
      const s = dustSeed[i];
      attr.array[i * 3] = s.x0 + s.vx * e;
      attr.array[i * 3 + 1] = s.y0 + s.vy * e - 7 * t * t;
      attr.array[i * 3 + 2] = PLANE_Z + 1 + s.vz * e;
    }
    attr.needsUpdate = true;
    dustMat.opacity = Math.sin(Math.PI * t) * 0.75;
  }

  /* ── потоки воздуха из щелей (финишный этап) ─────────── */
  function makeStreakSprite() {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.save();
    g.translate(16, 0);
    g.scale(0.12, 1); // узкая вертикальная струйка
    g.translate(-16, 0);
    g.fillRect(0, 0, 32, 64);
    g.restore();
    return new THREE.CanvasTexture(c);
  }
  // координаты — в системе floatGroup (миллиметры модели): щели на ±35 мм
  const AIR_N = 140;
  const airSeed = [];
  const airPos = new Float32Array(AIR_N * 3);
  for (let i = 0; i < AIR_N; i++) {
    airSeed.push({
      x: (Math.random() - 0.5) * 470,
      row: i % 2 ? 35 : -35,
      phase: Math.random(),
      speed: 0.32 + Math.random() * 0.4,
      drift: (Math.random() - 0.5) * 34
    });
    airPos[i * 3 + 2] = 34;
  }
  const airGeo = new THREE.BufferGeometry();
  airGeo.setAttribute('position', new THREE.BufferAttribute(airPos, 3));
  const airMat = new THREE.PointsMaterial({
    map: makeStreakSprite(),
    size: 7,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    color: 0xf2f4f6
  });
  const air = new THREE.Points(airGeo, airMat);
  air.visible = false; // добавляется в floatGroup ниже, после его создания

  let lastP = 0; // текущий прогресс сцены монтажа (обновляет setStep)
  function updateAir(timeSec) {
    const inWin = hasMesh && lastP > 0.555 && lastP < 0.68;
    const ramp = inWin
      ? Math.min((lastP - 0.555) / 0.04, 1) * Math.min((0.68 - lastP) / 0.05, 1)
      : 0;
    if (ramp <= 0) {
      air.visible = false;
      airMat.opacity = 0;
      return;
    }
    air.visible = true;
    airMat.opacity = 0.3 * ramp;
    const a = airGeo.attributes.position.array;
    for (let i = 0; i < AIR_N; i++) {
      const s = airSeed[i];
      const life = (timeSec * s.speed + s.phase) % 1;
      a[i * 3] = s.x + s.drift * life;
      a[i * 3 + 1] = s.row - 12 - life * 100;
      a[i * 3 + 2] = 34 + life * 30;
    }
    airGeo.attributes.position.needsUpdate = true;
  }

  /* ── решётка (STL) ───────────────────────────────────── */
  const material = new THREE.MeshMatcapMaterial({ matcap: makeMatcap(), color: 0xffffff });

  const scrollGroup = new THREE.Group(); // управляется скроллом
  const floatGroup = new THREE.Group();  // лёгкое парение + параллакс мыши
  scrollGroup.add(floatGroup);
  scene.add(scrollGroup);
  floatGroup.add(air);

  // мягкая тень под моделью в hero — «заземляет» продукт
  const heroShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(72, 26),
    new THREE.MeshBasicMaterial({ map: makeShadowTex(), transparent: true, opacity: 0, depthWrite: false })
  );
  scene.add(heroShadow);

  let modelReady = false;
  let hasMesh = false; // модель реально в сцене (не сработал фолбэк без решётки)

  /* ── позы ─────────────────────────────────────────────── */
  function isNarrow() { return camera.aspect < 0.95; }
  function heroPose() {
    return isNarrow()
      ? { px: 0, py: -13, pz: 16, rx: 0.2, ry: -0.5, rz: -0.08, s: 0.06 }
      : { px: 12, py: -2, pz: 18, rx: 0.2, ry: -0.52, rz: -0.14, s: 0.115 };
  }
  const seatPose = { px: SEAT.x, py: SEAT.y, pz: -1.4, rx: 0.02, ry: 0, rz: 0, s: 0.155 };
  function applyNarrow() {
    NARROW_K = isNarrow() ? 0.42 : 1;
    stage.scale.setScalar(NARROW_K);
    seatPose.px = SEAT.x * NARROW_K;
    seatPose.py = SEAT.y * NARROW_K;
    seatPose.s = 0.155 * NARROW_K;
    dustMat.size = 3.2 * NARROW_K;
    airMat.size = 7 * NARROW_K;
  }
  applyNarrow();
  const entryPose = { px: 52, py: -46, pz: -4, rx: -0.6, ry: -1.5, rz: 0.4, s: 0.1 };

  function applyPose(p) {
    scrollGroup.position.set(p.px, p.py, p.pz);
    scrollGroup.rotation.set(p.rx, p.ry, p.rz);
    scrollGroup.scale.setScalar(p.s);
  }

  /* ── загрузка STL (сжатая копия + фолбэк) ────────────── */
  let entryTweens = [];

  async function loadGeometry() {
    const loader = new STLLoader();
    // rm30.stl.gz втрое меньше; распаковка — нативным DecompressionStream
    if (typeof DecompressionStream === 'function') {
      try {
        const res = await fetch('assets/rm30.stl.gz');
        if (res.ok) {
          const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
          const buf = await new Response(stream).arrayBuffer();
          return loader.parse(buf);
        }
      } catch (e) { /* переходим к несжатому файлу */ }
    }
    return new Promise((resolve, reject) =>
      loader.load('assets/rm30.stl', resolve, undefined, reject));
  }

  function sceneReady() {
    window.__sceneReady = true;
    document.dispatchEvent(new CustomEvent('scene-ready'));
  }

  loadGeometry().then(geometry => {
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
    hasMesh = true;

    const atTop = (window.scrollY || 0) < window.innerHeight * 0.4;
    applyPose(heroPose());
    if (atTop && window.gsap) {
      const h = heroPose();
      entryTweens = [
        gsap.fromTo(scrollGroup.position,
          { x: entryPose.px, y: entryPose.py, z: entryPose.pz },
          { x: h.px, y: h.py, z: h.pz, duration: 1.8, ease: 'power3.out', delay: 0.2 }),
        gsap.fromTo(scrollGroup.rotation,
          { x: entryPose.rx, y: entryPose.ry, z: entryPose.rz },
          { x: h.rx, y: h.ry, z: h.rz, duration: 1.8, ease: 'power3.out', delay: 0.2 }),
        gsap.fromTo(scrollGroup.scale,
          { x: entryPose.s, y: entryPose.s, z: entryPose.s },
          { x: h.s, y: h.s, z: h.s, duration: 1.8, ease: 'power3.out', delay: 0.2 })
      ];
    }
    sceneReady();
    buildScroll();
  }).catch(() => {
    // модель не загрузилась — сцена работает без решётки, сайт не блокируем
    modelReady = true;
    sceneReady();
    buildScroll();
  });

  /* ── параллакс мыши + drag-вращение (только в hero) ──── */
  let mx = 0, my = 0, heroBlend = 1;
  let dragging = false, dragY = 0, dragLastX = 0;
  window.addEventListener('pointermove', e => {
    mx = (e.clientX / window.innerWidth - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
    if (dragging) {
      dragY = THREE.MathUtils.clamp(dragY + (e.clientX - dragLastX) * 0.005, -0.9, 0.9);
      dragLastX = e.clientX;
    }
  }, { passive: true });
  window.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if ((window.scrollY || 0) > window.innerHeight * 0.7) return; // только в hero
    if (e.target.closest('a, button, input, select, textarea')) return;
    dragging = true;
    dragLastX = e.clientX;
    document.documentElement.classList.add('is-dragging');
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
    window.addEventListener(ev, () => {
      if (!dragging) return;
      dragging = false;
      document.documentElement.classList.remove('is-dragging');
    }));

  /* ── scroll-хореография ──────────────────────────────── */
  const merge = { canvas: 1, beam: 0, reveal: 0, photoScale: 1.12, dim: 0 };
  const stagesFx = { paint: 0, drift: 0 }; // прокатка краски и dolly-наезд камеры
  const dimEl = document.getElementById('montage-dim');
  const railEl = document.getElementById('montage-rail');
  let scrollTl = null;
  const TWO_PI = Math.PI * 2;

  function buildScroll() {
    if (!window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: montageEl,
        start: 'top bottom',
        end: 'bottom bottom',
        scrub: 0.65,
        onUpdate: self => {
          // первый же скролл сцены глушит entry-анимацию, чтобы не спорить со scrub
          if (entryTweens.length && self.progress > 0.001) {
            entryTweens.forEach(t => t.kill());
            entryTweens = [];
          }
          setStep(self.progress);
        },
        invalidateOnRefresh: true
      },
      defaults: { ease: 'none' }
    });

    // 0–0.12 — падение с кувырком: профиль делает оборот и подлетает к проёму
    // fromTo с функциональными значениями: старты всегда — поза hero, не «подлётная»
    tl.fromTo(scrollGroup.position,
      { x: () => heroPose().px, y: () => heroPose().py, z: () => heroPose().pz },
      { x: () => seatPose.px, y: () => seatPose.py + 16 * NARROW_K, z: seatPose.pz + 14, duration: 12, immediateRender: false }, 0);
    tl.fromTo(scrollGroup.rotation,
      { x: () => heroPose().rx, y: () => heroPose().ry, z: () => heroPose().rz },
      { x: TWO_PI + 0.34, y: 0.12, z: 0.05, duration: 12, ease: 'power1.in', immediateRender: false }, 0);
    tl.fromTo(scrollGroup.scale,
      { x: () => heroPose().s, y: () => heroPose().s, z: () => heroPose().s },
      { x: () => 0.148 * NARROW_K, y: () => 0.148 * NARROW_K, z: () => 0.148 * NARROW_K, duration: 12, immediateRender: false }, 0);
    tl.to(concrete.material, { opacity: 1, duration: 10 }, 2);
    tl.to(cavity.material, { opacity: 0.95, duration: 6 }, 5);

    // 0.12–0.18 — ускоряющаяся посадка в проём
    tl.to(scrollGroup.position, { y: () => seatPose.py, z: seatPose.pz, duration: 6, ease: 'power2.in' }, 12);
    tl.to(scrollGroup.rotation, { x: TWO_PI + seatPose.rx, y: 0, z: 0, duration: 6, ease: 'power2.in' }, 12);
    tl.to(scrollGroup.scale, { x: () => seatPose.s, y: () => seatPose.s, z: () => seatPose.s, duration: 6 }, 12);

    // тень «предчувствует» падение: широкая и бледная → сжимается при приближении
    tl.fromTo(contactShadow.scale,
      { x: 1.45, y: 1.45, z: 1 },
      { x: 1, y: 1, duration: 12, immediateRender: false }, 6);
    tl.fromTo(contactShadow.material,
      { opacity: 0 },
      { opacity: 0.42, duration: 12, immediateRender: false }, 6);
    // удар: вспышка контактной тени + сплющивание; облачко пыли ведёт setStep
    tl.to(contactShadow.material, { opacity: 0.85, duration: 1.6 }, 18);
    tl.to(contactShadow.material, { opacity: 0.55, duration: 4 }, 20);
    // медленный dolly-наезд камеры от посадки до финиша
    tl.to(stagesFx, { drift: 1, duration: 42, ease: 'power1.inOut' }, 14);
    tl.to(scrollGroup.scale, { y: () => seatPose.s * 0.93, duration: 1.4, ease: 'power1.out' }, 18);
    tl.to(scrollGroup.scale, { y: () => seatPose.s, duration: 3.2, ease: 'power2.out' }, 19.4);

    // 0.24–0.41 — отделка в две фазы: лист ГКЛ прижимается к потолку,
    // затем шпаклюются швы и появляются зашпаклёванные саморезы
    drywall.position.y = -12;
    tl.to(drywall.material, { opacity: 1, duration: 7 }, 24);
    tl.to(drywall.position, { y: 0, duration: 13, ease: 'back.out(1.2)' }, 24);
    tl.to(finish.material, { opacity: 1, duration: 8 }, 34);

    // 0.46–0.60 — чистовой финиш: краска «прокатывается» слева направо
    tl.to(stagesFx, { paint: 1, duration: 14, ease: 'power1.inOut' }, 46);
    tl.to(contactShadow.material, { opacity: 0.32, duration: 14 }, 46);

    // 0.57–0.74 — сцена притемняется, светящаяся щель раскрывает фотографию
    tl.to(merge, { dim: 0.16, duration: 4 }, 57);
    tl.to(merge, { dim: 0, duration: 6 }, 65);
    tl.to(merge, { beam: 1, duration: 3, ease: 'power2.out' }, 58);
    tl.to(merge, { reveal: 1, duration: 12, ease: 'power2.inOut' }, 62);
    tl.to(merge, { canvas: 0, duration: 4 }, 67);
    tl.to(merge, { photoScale: 1.02, duration: 16 }, 62);

    // 0.78–1 — фото плавно «доезжает», финальный оверлей
    tl.to(merge, { photoScale: 1, duration: 22 }, 78);

    scrollTl = tl;
  }

  let lastStep = 0;
  function setStep(p) {
    lastP = p;
    const idx = p < 0.22 ? 0 : p < 0.44 ? 1 : p < 0.58 ? 2 : 3;
    if (idx !== lastStep) {
      stepEls.forEach((el, i) => {
        el.classList.toggle('is-active', i === idx);
        el.classList.toggle('is-done', i < idx);
      });
      lastStep = idx;
    }
    heroBlend = THREE.MathUtils.clamp(1 - p * 6, 0, 1);
    montageEl.classList.toggle('is-merged', p > 0.66);
    applyDust(p);
    // прогресс-рейка панели шагов
    if (railEl) railEl.style.height = `${THREE.MathUtils.clamp(p / 0.6, 0, 1) * 100}%`;
    // dolly-наезд камеры
    camera.position.z = 120 - 7 * stagesFx.drift;
    // прокатка краски: клип-плоскость + «мокрая кромка» валика
    const wc = (-140 + 285 * stagesFx.paint) * NARROW_K;
    paintClip.constant = wc;
    wetEdge.position.x = wc / NARROW_K;
    wetEdge.material.opacity = Math.sin(Math.PI * stagesFx.paint) * 0.55;
    if (finalEl) {
      const t = THREE.MathUtils.clamp((p - 0.8) / 0.12, 0, 1);
      finalEl.style.opacity = t;
      finalEl.style.visibility = t > 0.01 ? 'visible' : 'hidden';
    }
  }

  function applyMergeStyles() {
    canvas.style.opacity = merge.canvas;
    if (photoEl) {
      const r = merge.reveal;
      photoEl.style.opacity = r > 0.001 ? 1 : 0;
      photoEl.style.clipPath = `inset(${(1 - r) * 50}% 0 ${(1 - r) * 50}% 0)`;
      photoEl.style.transform = `scale(${merge.photoScale})`;
    }
    if (beamEl) {
      // луч гаснет по мере раскрытия щели
      beamEl.style.opacity = merge.beam * Math.max(0, 1 - merge.reveal * 2.5);
      beamEl.style.transform = `translateY(-50%) scaleX(${merge.beam})`;
    }
    if (dimEl) dimEl.style.opacity = merge.dim;
  }

  /* ── рендер-цикл ─────────────────────────────────────── */
  // прозрачные полноэкранные слои выключаем — иначе лишний overdraw на слабом GPU
  const cullable = [concrete, drywall, finish, paint, cavity, contactShadow, heroShadow, wetEdge];
  function cullLayers() {
    for (const m of cullable) m.visible = m.material.opacity > 0.004;
  }

  const clock = new THREE.Clock();
  function tick() {
    requestAnimationFrame(tick);
    if (document.hidden || !modelReady) return;

    applyMergeStyles();
    if (merge.canvas <= 0.01) return; // сцена невидима — не рендерим
    cullLayers();

    const t = clock.getElapsedTime();
    // лёгкое парение + параллакс мыши + drag-вращение, гаснущие в сцене монтажа
    if (!dragging) dragY *= 0.95; // плавный возврат после отпускания
    floatGroup.position.y = Math.sin(t * 0.8) * 1.1 * heroBlend;
    floatGroup.rotation.x += ((my * 0.05 * heroBlend) - floatGroup.rotation.x) * 0.06;
    floatGroup.rotation.y += (((mx * 0.09 + dragY) * heroBlend) - floatGroup.rotation.y) * 0.08;
    floatGroup.rotation.z = Math.sin(t * 0.5) * 0.012 * heroBlend;

    // тень под моделью в hero: следует за ней, дышит вместе с парением
    heroShadow.material.opacity = hasMesh ? heroBlend * 0.3 : 0;
    if (hasMesh && heroBlend > 0.02) {
      heroShadow.position.set(
        scrollGroup.position.x - 2,
        scrollGroup.position.y - 12 + floatGroup.position.y * 0.3,
        scrollGroup.position.z - 8
      );
      const k = scrollGroup.scale.x / 0.115;
      heroShadow.scale.setScalar(k * (1 - floatGroup.position.y * 0.03));
    }

    updateAir(t);
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
      applyNarrow(); // ScrollTrigger сам сделает refresh → функциональные значения перечитаются
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
      cullLayers();
      heroShadow.material.opacity = 0; // в снапшотах тень hero не участвует
      updateAir(3.7); // детерминированный кадр потоков воздуха
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
