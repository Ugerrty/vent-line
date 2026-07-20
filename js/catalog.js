/* Каталог: серии, латунная капля-переключатель, поиск, клавиатура */
(function () {
  'use strict';
  const tabs = document.getElementById('cat-tabs');
  if (!tabs) return;
  const drop = document.getElementById('cat-drop');
  const bar = document.getElementById('cat-bar');
  const btns = Array.from(tabs.querySelectorAll('button'));
  const secs = Array.from(document.querySelectorAll('.cat-sec'));
  const cards = Array.from(document.querySelectorAll('.cat-card'));
  const result = document.getElementById('cat-result');
  const search = document.getElementById('cat-search');
  const empty = document.getElementById('cat-empty');
  const emptyQ = document.getElementById('cat-empty-q');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NBSP = ' ';
  let cur = 'all';
  let searchT;

  function plural(n) {
    const d = n % 10, h = n % 100;
    const w = (h >= 11 && h <= 14) ? 'моделей' : d === 1 ? 'модель' : (d >= 2 && d <= 4) ? 'модели' : 'моделей';
    return n + NBSP + w;
  }

  /* ── латунная капля: тянется между позициями, затем стягивается ── */
  function moveDrop(btn) {
    const x = btn.offsetLeft, w = btn.offsetWidth;
    const liquid = tabs.classList.contains('is-ready') && !reduced && drop.dataset.x !== undefined;
    if (liquid && Math.abs(x - +drop.dataset.x) > 1) {
      const x0 = +drop.dataset.x, w0 = +drop.dataset.w;
      const lo = Math.min(x0, x);
      const span = Math.max(x0 + w0, x + w) - lo;
      drop.style.width = span + 'px';
      drop.style.transform = 'translateX(' + lo + 'px)';
      clearTimeout(moveDrop._t);
      moveDrop._t = setTimeout(() => {
        drop.style.width = w + 'px';
        drop.style.transform = 'translateX(' + x + 'px)';
      }, 180);
    } else {
      drop.style.width = w + 'px';
      drop.style.transform = 'translateX(' + x + 'px)';
    }
    drop.dataset.x = x;
    drop.dataset.w = w;
    tabs.scrollTo({
      left: Math.max(0, x - tabs.clientWidth / 2 + w / 2),
      behavior: reduced ? 'auto' : 'smooth'
    });
  }

  function markActive(btn) {
    btns.forEach(b => {
      const on = b === btn;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    moveDrop(btn);
  }

  /* ── каскадное появление видимых карточек ── */
  function pop() {
    if (reduced) return;
    cards.forEach(c => c.classList.remove('pop'));
    void document.body.offsetWidth;
    let i = 0;
    cards.forEach(c => {
      if (c.classList.contains('is-hidden')) return;
      if (c.closest('.cat-sec').classList.contains('is-off')) return;
      c.style.setProperty('--i', Math.min(i++, 14));
      c.classList.add('pop');
    });
  }

  /* ── выбор серии ── */
  function setSeries(key, silentUrl) {
    clearTimeout(searchT);
    cur = key;
    const btn = btns.find(b => b.dataset.s === key) || btns[0];
    if (key !== 'all') btns.forEach(b => b.classList.remove('is-near'));
    markActive(btn);
    if (search.value) search.value = '';
    empty.hidden = true;
    cards.forEach(c => c.classList.remove('is-hidden'));
    let shown = 0;
    secs.forEach(sec => {
      const off = key !== 'all' && sec.dataset.series !== key;
      sec.classList.toggle('is-off', off);
      if (!off) shown += sec.querySelectorAll('.cat-card').length;
    });
    pop();
    if (key === 'all') {
      result.textContent = '29' + NBSP + 'моделей · 9' + NBSP + 'серий';
    } else {
      const title = document.querySelector('#seriya-' + key + ' .cat-sec__title h2');
      const label = key === 'pfv' ? 'PFV' : 'Серия ' + (title ? title.textContent : key.toUpperCase());
      result.textContent = label + ' — ' + plural(shown);
    }
    if (!silentUrl) {
      history.replaceState(null, '', key === 'all' ? location.pathname + location.search : '#seriya-' + key);
    }
  }

  btns.forEach(btn => btn.addEventListener('click', () => setSeries(btn.dataset.s)));

  /* ── поиск по моделям ── */
  function norm(s) {
    return s.toLowerCase().replace(/ё/g, 'е').replace(/^vent\s*line\s*/, '');
  }
  search.addEventListener('input', () => {
    clearTimeout(searchT);
    searchT = setTimeout(applySearch, 200);
  });
  function applySearch() {
    const q = norm(search.value.trim());
    if (!q) { setSeries('all'); return; }
    if (cur !== 'all') {
      cur = 'all';
      markActive(btns[0]);
      history.replaceState(null, '', location.pathname + location.search);
    }
    const tokens = q.split(/\s+/);
    let shown = 0;
    secs.forEach(sec => {
      let inSec = 0;
      sec.querySelectorAll('.cat-card').forEach(c => {
        const name = norm(c.dataset.name || '') + ' vent line';
        const hit = tokens.every(t => name.includes(t));
        c.classList.toggle('is-hidden', !hit);
        if (hit) inSec++;
      });
      sec.classList.toggle('is-off', !inSec);
      shown += inSec;
    });
    empty.hidden = shown > 0;
    emptyQ.textContent = '«' + search.value.trim() + '»';
    result.textContent = shown
      ? 'Найдено: ' + plural(shown)
      : 'Ничего не найдено по запросу «' + search.value.trim() + '»';
  }
  search.addEventListener('keydown', e => {
    if (e.key === 'Escape' && search.value) {
      search.value = '';
      setSeries('all');
    }
  });

  /* ── клавиатура: ←/→ листают серии (когда фокус не занят полем/ссылкой) ── */
  addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const a = document.activeElement;
    const free = !a || a === document.body || a === document.documentElement || bar.contains(a);
    if (!free || (a && a.tagName === 'INPUT')) return;
    const i = btns.findIndex(b => b.classList.contains('is-on'));
    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length;
    setSeries(btns[n].dataset.s);
  });

  /* ── тень панели, когда прилипла ── */
  let stickTop = 90;
  function readStickTop() { stickTop = parseFloat(getComputedStyle(bar).top) || 90; }
  let stTick = false;
  addEventListener('scroll', () => {
    if (stTick) return;
    stTick = true;
    requestAnimationFrame(() => {
      stTick = false;
      bar.classList.toggle('is-stuck', scrollY > 40 && bar.getBoundingClientRect().top <= stickTop + 2);
    });
  }, { passive: true });

  /* ── пересчёт капли: ресайз и загрузка шрифтов ── */
  function relayout() {
    const b = btns.find(x => x.classList.contains('is-on'));
    if (!b) return;
    readStickTop();
    if (drop.dataset.x !== undefined &&
        Math.abs(+drop.dataset.x - b.offsetLeft) < 1 &&
        Math.abs(+drop.dataset.w - b.offsetWidth) < 1 &&
        tabs.classList.contains('is-ready')) return;
    clearTimeout(moveDrop._t);
    tabs.classList.remove('is-ready');
    drop.style.width = b.offsetWidth + 'px';
    drop.style.transform = 'translateX(' + b.offsetLeft + 'px)';
    drop.dataset.x = b.offsetLeft;
    drop.dataset.w = b.offsetWidth;
    void drop.offsetWidth;
    tabs.classList.add('is-ready');
  }
  let rzT;
  addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(relayout, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);

  /* ── диплинки #seriya-x ── */
  function fromHash(scroll) {
    const m = location.hash.match(/^#seriya-([a-z]+)$/);
    const key = m && btns.some(b => b.dataset.s === m[1]) ? m[1] : 'all';
    setSeries(key, true);
    if (key !== 'all' && scroll) {
      setTimeout(() => bar.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' }), 80);
    }
  }
  addEventListener('hashchange', () => fromHash(true));

  /* ── «/» фокусирует поиск ── */
  addEventListener('keydown', e => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return;
    e.preventDefault();
    search.focus();
  });

  /* ── колесо мыши листает табы горизонтально ── */
  tabs.addEventListener('wheel', e => {
    if (tabs.scrollWidth <= tabs.clientWidth) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    tabs.scrollLeft += e.deltaY;
  }, { passive: false });

  /* ── тост ── */
  const toast = document.getElementById('toast');
  let toastT;
  function showToast(text) {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove('is-on'), 1900);
  }

  /* ── копирование ссылки на серию ── */
  document.querySelectorAll('.cat-sec__link').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = location.origin + location.pathname + '#' + btn.dataset.link;
      const done = () => showToast('Ссылка на серию скопирована');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, () => showToast(url));
      } else {
        showToast(url);
      }
    });
  });

  /* ── повторная волна ламелей при наведении на заголовок серии ── */
  if (!reduced) {
    document.querySelectorAll('.cat-sec__head').forEach(head => {
      let waveLock = 0;
      head.addEventListener('mouseenter', () => {
        const now = Date.now();
        if (now - waveLock < 1600 || !head.classList.contains('is-in')) return;
        waveLock = now;
        head.classList.add('wave');
        void head.offsetWidth;
        head.classList.remove('wave');
      });
    });
  }

  /* ── латунная точка: серия, видимая на экране (в режиме «Все») ── */
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver(entries => {
      if (cur !== 'all' || search.value) return;
      entries.forEach(en => {
        const btn = btns.find(b => b.dataset.s === en.target.dataset.series);
        if (btn) btn.classList.toggle('is-near', en.isIntersecting);
      });
    }, { rootMargin: '-30% 0px -55% 0px' });
    secs.forEach(sec => spy.observe(sec));
  }

  /* ── подсказка «возможно, вы искали» в пустой выдаче ── */
  const NAMES = cards.map(c => {
    const h3 = c.querySelector('h3');
    return h3 ? h3.textContent.trim() : '';
  }).filter(Boolean);
  function editDist(a, b) {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 3) return 9;
    const row = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      let prev = row[0]; row[0] = i;
      for (let j = 1; j <= n; j++) {
        const t = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = t;
      }
    }
    return row[n];
  }
  function suggestFor(q) {
    let best = null, bestD = 3;
    NAMES.forEach(name => {
      const d = editDist(q.toLowerCase(), name.toLowerCase());
      if (d < bestD || (d === bestD && !best)) { bestD = d; best = name; }
    });
    return best;
  }
  const emptyBtn = document.getElementById('cat-suggest');
  function updateSuggest(q) {
    if (!emptyBtn) return;
    const s = suggestFor(q);
    emptyBtn.hidden = !s;
    if (s) {
      emptyBtn.textContent = 'Возможно, вы искали: ' + s;
      emptyBtn.dataset.q = s;
    }
  }
  if (emptyBtn) emptyBtn.addEventListener('click', () => {
    search.value = emptyBtn.dataset.q || '';
    applySearch();
  });
  const _applySearch = applySearch;
  applySearch = function () {
    _applySearch();
    if (!empty.hidden) updateSuggest(search.value.trim());
  };

  fromHash(true);
  requestAnimationFrame(relayout);
})();
