/* ═══════════════════════════════════════════════════════════
   VENT LINE — интерфейс: Lenis, reveal-анимации, шапка, меню
   ═══════════════════════════════════════════════════════════ */

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js'); // reveal-скрытие включается только при живом JS

/* ── preloader ─────────────────────────────────────────── */
const preloader = document.getElementById('preloader');
let preloaderHidden = false;
function hidePreloader() {
  if (preloaderHidden || !preloader) return;
  preloaderHidden = true;
  preloader.classList.add('is-done');
  initReveals(); // reveal-анимации стартуют, когда прелоадер ушёл
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
const headerProgress = document.getElementById('header-progress');
let lastY = 0;
function onScroll() {
  const y = window.scrollY || document.documentElement.scrollTop;
  header.classList.toggle('is-scrolled', y > 30);
  // прячем шапку при скролле вниз внутри сцены монтажа, показываем при скролле вверх
  header.classList.toggle('is-hidden', y > window.innerHeight && y > lastY);
  if (headerProgress) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    headerProgress.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
  }
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

/* ── построчные заголовки ──────────────────────────────── */
document.querySelectorAll('.hero__title, .section__title').forEach(el => {
  const parts = el.innerHTML.split(/<br\s*\/?>/i);
  el.innerHTML = parts.map(p => `<span class="line"><span class="line-in">${p}</span></span>`).join('');
});

/* ── reveal-анимации (стартуют после прелоадера) ───────── */
let revealsInited = false;
function initReveals() {
  if (revealsInited) return;
  revealsInited = true;
  const revealEls = document.querySelectorAll('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window)) {
    revealEls.forEach(el => el.classList.add('is-in'));
    return;
  }
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
setTimeout(initReveals, 7000); // страховка

/* ── магнитные кнопки ──────────────────────────────────── */
if (!reduced && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.btn').forEach(b => {
    b.addEventListener('mousemove', e => {
      const r = b.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / r.width;
      const y = (e.clientY - r.top - r.height / 2) / r.height;
      b.style.transform = `translate(${x * 7}px, ${y * 5}px)`;
    });
    b.addEventListener('mouseleave', () => { b.style.transform = ''; });
  });
}

/* ── параллакс фото в галерее работ ────────────────────── */
if (!reduced && window.gsap && window.ScrollTrigger) {
  gsap.utils.toArray('.works__item img').forEach(img => {
    gsap.fromTo(img,
      { yPercent: -7, scale: 1.16 },
      {
        yPercent: 7, scale: 1.16, ease: 'none',
        scrollTrigger: {
          trigger: img.closest('.works__item'),
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.4
        }
      });
  });
}

/* ── квиз-подбор: 4 вопроса → готовое письмо ───────────── */
(function initQuiz() {
  const card = document.querySelector('.quiz__card');
  if (!card) return;
  const QUIZ = [
    { k: 'Система', q: 'Какая система в проекте?', a: ['Приточная', 'Вытяжная', 'Приточно-вытяжная', 'Пока не определено'] },
    { k: 'Поверхность', q: 'Куда встраиваем решётку?', a: ['Потолок', 'Стена', 'Пол'] },
    { k: 'Отделка', q: 'Какая отделка вокруг?', a: ['Покраска', 'Шпон', 'Плитка', 'Штукатурка'] },
    { k: 'Этап', q: 'На каком этапе объект?', a: ['Черновой', 'Чистовой', 'Проектирование'] }
  ];
  const label = document.getElementById('quiz-label');
  const bar = document.getElementById('quiz-bar');
  const body = document.getElementById('quiz-body');
  const qEl = document.getElementById('quiz-q');
  const optionsEl = document.getElementById('quiz-options');
  const finalEl = document.getElementById('quiz-final');
  const summaryEl = document.getElementById('quiz-summary');
  const sendEl = document.getElementById('quiz-send');
  const backEl = document.getElementById('quiz-back');
  const answers = [];

  function render() {
    const step = answers.length;
    backEl.hidden = step === 0 || step >= QUIZ.length;
    if (step >= QUIZ.length) {
      body.hidden = true;
      finalEl.hidden = false;
      label.textContent = 'Готово';
      bar.style.transform = 'scaleX(1)';
      summaryEl.innerHTML = QUIZ.map((s, i) => `${s.k}: <b>${answers[i]}</b>`).join('<br>');
      const bodyText = QUIZ.map((s, i) => `${s.k}: ${answers[i]}`).join('\n')
        + '\n\nКомментарий и размеры:\n';
      sendEl.href = 'mailto:info+322987870@vent-line.ru?subject='
        + encodeURIComponent('Заявка на подбор решётки')
        + '&body=' + encodeURIComponent(bodyText);
      return;
    }
    body.hidden = false;
    finalEl.hidden = true;
    label.textContent = `Шаг ${step + 1} из ${QUIZ.length}`;
    bar.style.transform = `scaleX(${(step + 1) / QUIZ.length * 0.9})`;
    qEl.textContent = QUIZ[step].q;
    optionsEl.innerHTML = '';
    QUIZ[step].a.forEach((text, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = text;
      btn.style.setProperty('--i', i);
      btn.addEventListener('click', () => { answers.push(text); render(); });
      optionsEl.appendChild(btn);
    });
  }
  backEl.addEventListener('click', () => { answers.pop(); render(); });
  document.getElementById('quiz-reset').addEventListener('click', () => { answers.length = 0; render(); });
  render();
})();

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
