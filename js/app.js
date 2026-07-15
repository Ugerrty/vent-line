/* ═══════════════════════════════════════════════
   VENT LINE — interactions & motion
   GSAP + ScrollTrigger + Lenis (CDN)
   ═══════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof gsap !== 'undefined';
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ── Lenis smooth scroll ── */
  var lenis = null;
  if (!reduceMotion && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); } });
    window.__lenis = lenis;
    lenis.on('scroll', function () { if (hasGsap) ScrollTrigger.update(); });
    if (hasGsap) {
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(time) { lenis.raf(time); requestAnimationFrame(raf); })(0);
    }
  }

  function scrollToEl(el) {
    if (lenis) lenis.scrollTo(el, { offset: -70 });
    else el.scrollIntoView({ behavior: 'smooth' });
  }

  /* anchor links */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); scrollToEl(target); }
    });
  });

  /* ── Preloader ── */
  var preloader = document.getElementById('preloader');
  var heroIntroPlayed = false;
  function hidePreloader() {
    if (!preloader || preloader.classList.contains('is-done')) return;
    preloader.classList.add('is-done');
    playHeroIntro();
  }
  window.addEventListener('load', hidePreloader);
  setTimeout(hidePreloader, 2200); // fail-safe

  /* ── Hero intro timeline ── */
  function playHeroIntro() {
    if (heroIntroPlayed) return;
    heroIntroPlayed = true;
    if (!hasGsap || reduceMotion) {
      document.querySelectorAll('.line-mask > span, .hero [data-reveal], .hero__figure, .hero__chip').forEach(function (el) {
        el.style.transform = 'none'; el.style.opacity = '1'; el.style.clipPath = 'none';
      });
      return;
    }
    var tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.to('.hero .line-mask > span', { y: 0, duration: 1.1, stagger: 0.09 }, 0.1)
      .to('.hero__slits span', { scaleX: 1, duration: 1.6, stagger: 0.12, ease: 'power3.inOut' }, 0)
      .fromTo('.hero__figure', { clipPath: 'inset(6% 10% 6% 10% round 22px)', opacity: 0 },
        { clipPath: 'inset(0% 0% 0% 0% round 22px)', opacity: 1, duration: 1.3, ease: 'power3.inOut' }, 0.25)
      .fromTo('.hero__figure img', { scale: 1.18 }, { scale: 1.04, duration: 1.6, ease: 'power3.out' }, 0.25)
      .fromTo('.hero [data-reveal]', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.07 }, 0.5)
      .fromTo('.hero__chip', { y: 22, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: 0.8, stagger: 0.12, ease: 'back.out(1.6)' }, 0.9);
  }

  /* ── Header behavior ── */
  var header = document.getElementById('header');
  var lastY = 0;
  function onScroll() {
    var y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 40);
    if (y > 320 && y > lastY + 6) header.classList.add('is-hidden');
    else if (y < lastY - 6 || y < 320) header.classList.remove('is-hidden');
    lastY = y;
    fab.classList.toggle('is-visible', y > 560);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ── Mobile menu ── */
  var burger = document.getElementById('burger');
  var menu = document.getElementById('menu');
  burger.addEventListener('click', function () {
    var open = !menu.classList.contains('is-open');
    menu.classList.toggle('is-open', open);
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open);
    menu.setAttribute('aria-hidden', !open);
    document.body.classList.toggle('is-locked', open);
    if (lenis) open ? lenis.stop() : lenis.start();
  });
  menu.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { burger.click(); });
  });

  /* ── FAB ── */
  var fab = document.getElementById('fab');

  /* ── Split section titles into words ── */
  function splitWords(el) {
    var nodes = Array.prototype.slice.call(el.childNodes);
    el.innerHTML = '';
    nodes.forEach(function (node) {
      if (node.nodeType === 3) {
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span'); w.className = 'w';
          var i = document.createElement('i'); i.textContent = part;
          w.appendChild(i); el.appendChild(w);
        });
      } else if (node.nodeType === 1) {
        var wrap = node.cloneNode(false); wrap.innerHTML = '';
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { wrap.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span'); w.className = 'w';
          var i = document.createElement('i'); i.textContent = part;
          w.appendChild(i); wrap.appendChild(w);
        });
        el.appendChild(wrap);
      }
    });
  }

  if (hasGsap && !reduceMotion) {
    /* split-word reveals */
    document.querySelectorAll('[data-split]').forEach(function (el) {
      splitWords(el);
      gsap.to(el.querySelectorAll('.w > i'), {
        y: 0, duration: 0.9, ease: 'power4.out', stagger: 0.045,
        scrollTrigger: { trigger: el, start: 'top 86%' }
      });
    });

    /* generic reveals (outside hero — hero handled by intro) */
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      if (el.closest('.hero')) return;
      gsap.fromTo(el, { y: 30, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.95, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%' }
      });
    });

    /* cards */
    var cardGroups = {};
    document.querySelectorAll('[data-card]').forEach(function (el) {
      var key = el.parentElement.className;
      (cardGroups[key] = cardGroups[key] || []).push(el);
    });
    Object.keys(cardGroups).forEach(function (key) {
      var els = cardGroups[key];
      gsap.fromTo(els, { y: 44, opacity: 0 }, {
        y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: 0.09,
        scrollTrigger: { trigger: els[0], start: 'top 88%' }
      });
    });

    /* category figures: clip reveal + parallax */
    document.querySelectorAll('.cat__figure').forEach(function (fig) {
      gsap.fromTo(fig, { clipPath: 'inset(8% 6% 8% 6% round 22px)', opacity: 0.001 }, {
        clipPath: 'inset(0% 0% 0% 0% round 22px)', opacity: 1, duration: 1.2, ease: 'power3.inOut',
        scrollTrigger: { trigger: fig, start: 'top 85%' }
      });
      var img = fig.querySelector('.cat__img');
      gsap.fromTo(img, { yPercent: -6, scale: 1.12 }, {
        yPercent: 6, scale: 1.12, ease: 'none',
        scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: 0.6 }
      });
    });

    /* hero figure parallax on scroll */
    gsap.to('.hero__figure img', {
      yPercent: 9, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.5 }
    });

    /* floating chips */
    document.querySelectorAll('[data-float]').forEach(function (el, idx) {
      gsap.to(el, { y: idx % 2 ? 12 : -12, duration: 2.6 + idx * 0.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: idx * 0.3 });
    });
    document.querySelectorAll('[data-float-slow]').forEach(function (el) {
      gsap.to(el, { y: -16, duration: 3.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    });

    /* series render subtle parallax */
    document.querySelectorAll('.series__render').forEach(function (img) {
      gsap.fromTo(img, { y: 24 }, {
        y: -24, ease: 'none',
        scrollTrigger: { trigger: img, start: 'top bottom', end: 'bottom top', scrub: 0.7 }
      });
    });

    /* steps progress line */
    var stepsProgress = document.getElementById('stepsProgress');
    if (stepsProgress) {
      gsap.to(stepsProgress, {
        width: '100%', ease: 'none',
        scrollTrigger: { trigger: '.steps__grid', start: 'top 78%', end: 'bottom 55%', scrub: 0.4 }
      });
    }

    /* counters */
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var end = parseFloat(el.getAttribute('data-count'));
      var start = parseFloat(el.getAttribute('data-count-start') || '0');
      var obj = { v: start };
      gsap.to(obj, {
        v: end, duration: 1.8, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%' },
        onUpdate: function () {
          var v = Math.round(obj.v);
          el.textContent = el.getAttribute('data-count') === '1500' && start === 25
            ? '25–' + v.toLocaleString('ru-RU')
            : v.toLocaleString('ru-RU');
        }
      });
    });
  } else {
    // без GSAP: просто показываем всё
    document.querySelectorAll('[data-split], [data-reveal], [data-card]').forEach(function (el) { el.style.opacity = '1'; });
  }

  /* ── Marquee: duplicate track for seamless loop ── */
  document.querySelectorAll('[data-marquee] .clients__track').forEach(function (track) {
    track.innerHTML += track.innerHTML;
  });

  /* ── Category galleries ── */
  document.querySelectorAll('[data-cat]').forEach(function (cat) {
    var img = cat.querySelector('.cat__img');
    cat.querySelectorAll('.cat__thumb').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.classList.contains('is-active')) return;
        cat.querySelector('.cat__thumb.is-active').classList.remove('is-active');
        btn.classList.add('is-active');
        var src = btn.getAttribute('data-src');
        if (hasGsap && !reduceMotion) {
          gsap.timeline()
            .to(img, { opacity: 0, scale: 1.16, duration: 0.28, ease: 'power2.in' })
            .add(function () { img.src = src; })
            .to(img, { opacity: 1, scale: 1.12, duration: 0.55, ease: 'power3.out' });
        } else {
          img.src = src;
        }
      });
    });
  });

  /* ── Series tabs ── */
  var seriesTabs = document.querySelectorAll('.series__tab');
  seriesTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      if (tab.classList.contains('is-active')) return;
      seriesTabs.forEach(function (t) { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
      var key = tab.getAttribute('data-series');
      document.querySelectorAll('.series__panel').forEach(function (panel) {
        var active = panel.getAttribute('data-panel') === key;
        if (active) {
          panel.hidden = false;
          panel.classList.add('is-active');
          if (hasGsap && !reduceMotion) {
            gsap.fromTo(panel.querySelector('.series__visual'), { x: -34, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: 'power3.out' });
            gsap.fromTo(panel.querySelector('.series__info'), { x: 34, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: 'power3.out' });
          }
        } else {
          panel.hidden = true;
          panel.classList.remove('is-active');
        }
      });
    });
  });

  /* ── Quiz ── */
  var quizSteps = [
    { q: 'Какая система используется в проекте?', multi: false, options: ['Приточная', 'Вытяжная', 'Приточно-вытяжная', 'Пока не определено'] },
    { q: 'Где планируется монтаж решётки?', multi: true, options: ['Потолок', 'Стена', 'Пол'] },
    { q: 'Какая будет отделка в зоне установки?', multi: true, options: ['Покраска', 'Обои', 'Декоративная штукатурка', 'Плитка', 'Шпон / дерево', 'Пока не решено'] },
    { q: 'Нужна ли вам особая конфигурация?', multi: true, options: ['Прямая', 'Угловая', 'Радиусная', 'Сложная геометрия / индивидуально', 'Нет, стандартная'] },
    { q: 'Что для вас важнее всего?', multi: true, options: ['Эстетика', 'Сроки изготовления', 'Простота монтажа', 'Бесшумность', 'Документация и расчёт', 'Цена', 'Свой вариант'] },
    { q: 'Это последний шаг', contact: true }
  ];
  var quizState = { step: 0, answers: {} };
  var viewport = document.getElementById('quizViewport');
  var quizBar = document.getElementById('quizBar');
  var quizStepNow = document.getElementById('quizStepNow');
  var quizBack = document.getElementById('quizBack');
  var quizNext = document.getElementById('quizNext');
  var quizForm = document.getElementById('quizForm');
  var quizSuccess = document.getElementById('quizSuccess');

  function renderQuiz(dir) {
    var s = quizSteps[quizState.step];
    var html = '';
    if (s.contact) {
      html += '<p class="quiz__q">' + s.q + '</p>' +
        '<p class="quiz__hint">Оставьте контакты — мы сделаем подбор, КП и документацию за 1 день.</p>' +
        '<div class="quiz__fields">' +
        fieldHtml('qName', 'text', 'Ваше имя', 'name') +
        fieldHtml('qPhone', 'tel', 'Телефон *', 'tel') +
        '<div class="field field--wide">' +
        '<input class="field__input" id="qEmail" type="email" placeholder=" " autocomplete="email">' +
        '<label class="field__label" for="qEmail">Email</label></div>' +
        '</div>';
    } else {
      html += '<p class="quiz__q">' + s.q + '</p>' +
        '<p class="quiz__hint">' + (s.multi ? 'Можно выбрать несколько вариантов' : 'Выберите один вариант') + '</p>' +
        '<div class="quiz__options">';
      var chosen = quizState.answers[quizState.step] || [];
      s.options.forEach(function (opt) {
        html += '<button type="button" class="quiz__opt' + (chosen.indexOf(opt) > -1 ? ' is-selected' : '') + '" data-opt="' + opt + '">' + opt + '</button>';
      });
      html += '</div>';
    }
    viewport.innerHTML = html;

    viewport.querySelectorAll('.quiz__opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var opt = btn.getAttribute('data-opt');
        var cur = quizState.answers[quizState.step] || [];
        if (s.multi) {
          var i = cur.indexOf(opt);
          i > -1 ? cur.splice(i, 1) : cur.push(opt);
          btn.classList.toggle('is-selected');
        } else {
          cur = [opt];
          viewport.querySelectorAll('.quiz__opt').forEach(function (b) { b.classList.remove('is-selected'); });
          btn.classList.add('is-selected');
        }
        quizState.answers[quizState.step] = cur;
        if (!s.multi) setTimeout(nextStep, 320);
      });
    });

    quizStepNow.textContent = quizState.step + 1;
    quizBar.style.width = ((quizState.step + 1) / quizSteps.length * 100) + '%';
    quizBack.disabled = quizState.step === 0;
    quizNext.textContent = s.contact ? 'Получить предложение' : 'Далее';

    if (hasGsap && !reduceMotion) {
      gsap.fromTo(viewport, { x: dir === 'back' ? -34 : 34, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
    }
  }

  function fieldHtml(id, type, label, ac) {
    return '<div class="field"><input class="field__input" id="' + id + '" type="' + type + '" placeholder=" " autocomplete="' + ac + '"' + (label.indexOf('*') > -1 ? ' required' : '') + '>' +
      '<label class="field__label" for="' + id + '">' + label + '</label></div>';
  }

  function nextStep() {
    var s = quizSteps[quizState.step];
    if (s.contact) { submitQuiz(); return; }
    if (quizState.step < quizSteps.length - 1) {
      quizState.step++;
      renderQuiz('next');
    }
  }
  function submitQuiz() {
    var phone = document.getElementById('qPhone');
    if (!phone.value.trim() || phone.value.replace(/\D/g, '').length < 10) {
      phone.classList.add('is-error');
      phone.focus();
      return;
    }
    quizForm.hidden = true;
    document.querySelector('.quiz__head .quiz__progress').style.visibility = 'hidden';
    quizSuccess.hidden = false;
    if (hasGsap && !reduceMotion) gsap.fromTo(quizSuccess, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' });
  }
  quizNext.addEventListener('click', nextStep);
  quizBack.addEventListener('click', function () {
    if (quizState.step > 0) { quizState.step--; renderQuiz('back'); }
  });
  viewport.addEventListener('input', function (e) { e.target.classList.remove('is-error'); });
  renderQuiz();

  /* ── Modal ── */
  var modal = document.getElementById('modal');
  var modalForm = document.getElementById('modalForm');
  var modalBody = document.getElementById('modalBody');
  var modalSuccess = document.getElementById('modalSuccess');
  var lastFocus = null;

  function openModal() {
    lastFocus = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    if (lenis) lenis.stop();
    var first = modal.querySelector('input');
    if (first) setTimeout(function () { first.focus(); }, 350);
  }
  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
    if (lenis) lenis.start();
    if (lastFocus) lastFocus.focus();
  }
  document.querySelectorAll('[data-open-modal]').forEach(function (btn) {
    btn.addEventListener('click', openModal);
  });
  document.querySelectorAll('[data-close-modal]').forEach(function (btn) {
    btn.addEventListener('click', closeModal);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });
  modalForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var phone = document.getElementById('mPhone');
    if (!phone.value.trim() || phone.value.replace(/\D/g, '').length < 10) {
      phone.classList.add('is-error'); phone.focus(); return;
    }
    modalBody.hidden = true;
    modalSuccess.hidden = false;
  });
  modalForm.addEventListener('input', function (e) { e.target.classList.remove('is-error'); });

  /* ── Callback form ── */
  var callbackForm = document.getElementById('callbackForm');
  callbackForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var phone = document.getElementById('cbPhone');
    if (!phone.value.trim() || phone.value.replace(/\D/g, '').length < 10) {
      phone.classList.add('is-error'); phone.focus(); return;
    }
    callbackForm.hidden = true;
    document.getElementById('callbackOk').hidden = false;
  });
  callbackForm.addEventListener('input', function (e) { e.target.classList.remove('is-error'); });

  /* ── Cookie ── */
  var cookie = document.getElementById('cookie');
  try {
    if (!localStorage.getItem('vl_cookie_ok')) cookie.hidden = false;
  } catch (err) { cookie.hidden = false; }
  document.getElementById('cookieOk').addEventListener('click', function () {
    try { localStorage.setItem('vl_cookie_ok', '1'); } catch (err) {}
    cookie.hidden = true;
  });

  onScroll();
})();
