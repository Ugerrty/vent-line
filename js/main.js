/* ═══════════════════════════════════════════════════════════
   VENT LINE — интерфейс: Lenis, reveal-анимации, шапка, меню
   ═══════════════════════════════════════════════════════════ */

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── preloader ─────────────────────────────────────────── */
const preloader = document.getElementById('preloader');
let preloaderHidden = false;
function hidePreloader() {
  if (preloaderHidden || !preloader) return;
  preloaderHidden = true;
  preloader.classList.add('is-done');
}
if (window.__sceneReady) setTimeout(hidePreloader, 250);
else document.addEventListener('scene-ready', () => setTimeout(hidePreloader, 250));
window.addEventListener('load', () => setTimeout(hidePreloader, 2600)); // страховка
setTimeout(hidePreloader, 6000); // вторая страховка (есть и инлайновая в index.html)

/* ── smooth scroll (Lenis + ScrollTrigger) ─────────────── */
let lenis = null;
if (!reduced && window.Lenis && window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  lenis = new Lenis({ duration: 1.15, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(time => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ── якорные ссылки ────────────────────────────────────── */
document.querySelectorAll('a[data-scroll]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (!id || !id.startsWith('#')) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    closeMenu();
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.6 });
    else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  });
});

/* ── шапка ─────────────────────────────────────────────── */
const header = document.getElementById('header');
let lastY = 0;
function onScroll() {
  const y = window.scrollY || document.documentElement.scrollTop;
  header.classList.toggle('is-scrolled', y > 30);
  // прячем шапку при скролле вниз внутри сцены монтажа, показываем при скролле вверх
  header.classList.toggle('is-hidden', y > window.innerHeight && y > lastY);
  lastY = y;
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ── мобильное меню ────────────────────────────────────── */
const burger = document.getElementById('burger');
const menu = document.getElementById('menu');
function closeMenu() {
  if (!menu.classList.contains('is-open')) return;
  menu.classList.remove('is-open');
  burger.classList.remove('is-open');
  burger.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (lenis) lenis.start();
}
burger?.addEventListener('click', () => {
  const open = !menu.classList.contains('is-open');
  menu.classList.toggle('is-open', open);
  burger.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-hidden', String(!open));
  document.body.style.overflow = open ? 'hidden' : '';
  if (lenis) open ? lenis.stop() : lenis.start();
});

/* ── reveal-анимации ───────────────────────────────────── */
const revealEls = document.querySelectorAll('[data-reveal]');
if (reduced || !('IntersectionObserver' in window)) {
  revealEls.forEach(el => el.classList.add('is-in'));
} else {
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const siblings = Array.from(el.parentElement.querySelectorAll(':scope > [data-reveal]'));
        const idx = Math.max(0, siblings.indexOf(el));
        setTimeout(() => el.classList.add('is-in'), Math.min(idx * 90, 450));
        io.unobserve(el);
      }
    });
  }, { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });
  revealEls.forEach(el => io.observe(el));
}

/* ── счётчики ──────────────────────────────────────────── */
if (!reduced && window.gsap) {
  document.querySelectorAll('[data-count]').forEach(el => {
    const end = parseInt(el.dataset.count, 10);
    const obj = { v: Math.max(0, end - Math.min(end, 140)) };
    const io = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      gsap.to(obj, {
        v: end, duration: 1.6, ease: 'power2.out',
        onUpdate: () => { el.textContent = Math.round(obj.v); }
      });
    }, { threshold: 0.6 });
    io.observe(el);
  });
}

/* ── текущий год ───────────────────────────────────────── */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();
