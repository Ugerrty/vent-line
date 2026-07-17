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

/* ── кастомный курсор: точка + латунное кольцо ─────────── */
(function initCursor() {
  const wrap = document.getElementById('cursor');
  if (!wrap || reduced || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const dot = wrap.querySelector('.cursor__dot');
  const ring = wrap.querySelector('.cursor__ring');
  let x = -100, y = -100, rx = -100, ry = -100, s = 1, started = false, rafOn = false;
  const INTERACTIVE = 'a, button, summary, input, select, textarea, .works__item';
  function loop() {
    rx += (x - rx) * 0.18;
    ry += (y - ry) * 0.18;
    const t = wrap.classList.contains('is-press') ? 0.72
      : wrap.classList.contains('is-active') ? 1.55 : 1;
    s += (t - s) * 0.2;
    dot.style.transform = `translate(${x}px, ${y}px)`;
    ring.style.transform = `translate(${rx}px, ${ry}px) scale(${s.toFixed(3)})`;
    // цикл засыпает, когда мышь неподвижна и lerp сошёлся — не жжём кадры
    if (Math.abs(x - rx) + Math.abs(y - ry) < 0.15 && Math.abs(t - s) < 0.004) {
      rafOn = false;
      return;
    }
    requestAnimationFrame(loop);
  }
  function kick() {
    if (!rafOn) { rafOn = true; requestAnimationFrame(loop); }
  }
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    if (!started) {
      started = true;
      rx = x; ry = y;
      document.documentElement.classList.add('has-cursor');
      wrap.classList.add('is-on');
    }
    wrap.classList.toggle('is-active', !!e.target.closest(INTERACTIVE));
    kick();
  }, { passive: true });
  document.addEventListener('pointerdown', () => { wrap.classList.add('is-press'); kick(); });
  document.addEventListener('pointerup', () => { wrap.classList.remove('is-press'); kick(); });
  document.addEventListener('mouseleave', () => wrap.classList.remove('is-on'));
  document.addEventListener('mouseenter', () => started && wrap.classList.add('is-on'));
})();

/* ── серии решёток — интерактивные чипы ────────────────── */
document.querySelectorAll('.solutions__series').forEach(el => {
  el.innerHTML = el.textContent.split('·').map(s => `<i>${s.trim()}</i>`).join('');
});

/* ── лента клиентов: пауза вне экрана ──────────────────── */
(function initMarqueePause() {
  const mq = document.querySelector('.trust__marquee');
  if (!mq || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(([e]) => {
    mq.classList.toggle('is-off', !e.isIntersecting);
  }, { rootMargin: '100px 0px' }).observe(mq);
})();

/* ── копирование e-mail в контактах ────────────────────── */
(function initCopyEmail() {
  const btn = document.getElementById('copy-email');
  if (!btn || !navigator.clipboard) { btn?.remove(); return; }
  const original = btn.textContent;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.email);
      btn.textContent = 'Скопировано ✓';
      btn.classList.add('is-copied');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('is-copied');
      }, 2200);
    } catch (e) { /* clipboard недоступен — кнопка просто молчит */ }
  });
})();

/* ── живое московское время в футере ───────────────────── */
(function initMskTime() {
  const el = document.getElementById('msk-time');
  if (!el) return;
  const fmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
  const tick = () => { el.textContent = fmt.format(new Date()); };
  tick();
  setInterval(tick, 30000);
})();

/* ── заголовок вкладки, когда пользователь уходит ──────── */
(function initTitleSwap() {
  const original = document.title;
  document.addEventListener('visibilitychange', () => {
    document.title = document.hidden
      ? 'Vent Line — вернуться к тишине'
      : original;
  });
})();

/* ── scrollspy: подсветка текущей секции в меню ────────── */
(function initScrollspy() {
  const links = [...document.querySelectorAll('.header__nav a[href^="#"]')];
  if (!links.length || !('IntersectionObserver' in window)) return;
  const map = new Map();
  links.forEach(a => {
    const sec = document.querySelector(a.getAttribute('href'));
    if (sec) map.set(sec, a);
  });
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(a => a.classList.remove('is-current'));
        map.get(e.target)?.classList.add('is-current');
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  map.forEach((a, sec) => spy.observe(sec));
})();

/* ── lightbox галереи работ ────────────────────────────── */
(function initLightbox() {
  const box = document.getElementById('lightbox');
  if (!box) return;
  const items = [...document.querySelectorAll('.works__item')];
  const img = document.getElementById('lightbox-img');
  const cap = document.getElementById('lightbox-caption');
  const count = document.getElementById('lightbox-count');
  const closeBtn = document.getElementById('lightbox-close');
  let idx = 0;

  function show(i) {
    idx = (i + items.length) % items.length;
    const src = items[idx].querySelector('img');
    img.src = src.src;
    img.alt = src.alt;
    cap.textContent = items[idx].querySelector('figcaption')?.textContent || '';
    count.textContent = `${idx + 1} / ${items.length}`;
  }
  function open(i) {
    show(i);
    box.hidden = false;
    void box.offsetWidth; // reflow, чтобы transition сработал
    box.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    if (lenis) lenis.stop();
    closeBtn.focus();
    document.addEventListener('keydown', onKey);
  }
  function close() {
    box.classList.remove('is-open');
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = '';
    if (lenis) lenis.start();
    setTimeout(() => { box.hidden = true; }, 350);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  }
  items.forEach((item, i) => item.addEventListener('click', () => open(i)));
  closeBtn.addEventListener('click', close);
  document.getElementById('lightbox-prev').addEventListener('click', () => show(idx - 1));
  document.getElementById('lightbox-next').addEventListener('click', () => show(idx + 1));
  box.addEventListener('click', e => { if (e.target === box) close(); });
  // свайпы на таче (мультитач/pinch-zoom не считается свайпом)
  let touchX = null;
  box.addEventListener('touchstart', e => {
    touchX = e.touches.length === 1 ? e.touches[0].clientX : null;
  }, { passive: true });
  box.addEventListener('touchend', e => {
    if (touchX === null || e.touches.length > 0) { touchX = null; return; }
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 45) show(idx + (dx < 0 ? 1 : -1));
  }, { passive: true });
  box.addEventListener('touchcancel', () => { touchX = null; }, { passive: true });
})();

/* ── лёгкий tilt карточек каталога за курсором ─────────── */
if (!reduced && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.catalog__card').forEach(card => {
    const media = card.querySelector('.catalog__media');
    if (!media) return;
    card.addEventListener('mousemove', e => {
      const r = media.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      media.style.transform = `perspective(700px) rotateX(${-y * 5}deg) rotateY(${x * 6}deg)`;
    });
    card.addEventListener('mouseleave', () => { media.style.transform = ''; });
  });
}

/* ── кнопка «наверх» ───────────────────────────────────── */
const toTop = document.getElementById('to-top');
if (toTop) {
  window.addEventListener('scroll', () => {
    toTop.classList.toggle('is-visible', (window.scrollY || 0) > window.innerHeight * 1.5);
  }, { passive: true });
  toTop.addEventListener('click', () => {
    if (lenis) lenis.scrollTo(0, { duration: 1.4 });
    else window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });
}

/* ── FAQ: открытый вопрос закрывает остальные ──────────── */
const faqItems = document.querySelectorAll('.faq__item');
faqItems.forEach(item => {
  item.addEventListener('toggle', () => {
    if (item.open) faqItems.forEach(other => { if (other !== item) other.open = false; });
  });
});

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
  // чипы уже выбранных ответов — клик возвращает на тот шаг
  const chipsEl = document.createElement('div');
  chipsEl.className = 'quiz__chips';
  body.insertBefore(chipsEl, qEl);

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
    // короткий лок: защита от двойного клика по совпадающим координатам кнопок
    optionsEl.style.pointerEvents = 'none';
    setTimeout(() => { optionsEl.style.pointerEvents = ''; }, 380);
    chipsEl.innerHTML = '';
    answers.forEach((a, i) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = `${QUIZ[i].k}: ${a}`;
      chip.title = 'Изменить ответ';
      chip.addEventListener('click', () => { answers.length = i; render(); });
      chipsEl.appendChild(chip);
    });
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

  // выбор ответа клавишами 1–4, когда квиз на экране
  let quizVisible = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { quizVisible = e.isIntersecting; }, { threshold: 0.4 })
      .observe(card);
    document.addEventListener('keydown', e => {
      if (!quizVisible || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      if (body.hidden) return; // финальный экран — не кликать по скрытым кнопкам
      if (optionsEl.style.pointerEvents === 'none') return; // тот же 380-мс лок, что и для мыши
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) {
        const btn = document.querySelectorAll('#quiz-options button')[n - 1];
        if (btn) btn.click();
      }
    });
  }
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
