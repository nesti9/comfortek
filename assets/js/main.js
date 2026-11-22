(function () {
  'use strict';
  var doc = document, D = window.KF_DATA || {};
  doc.documentElement.classList.add('js');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };

  /* ---------- header ---------- */
  var hdr = $('#hdr'), burger = $('#burger'), mm = $('#mmenu');
  var darkHead = !!$('main > .dark');
  function hdrState() { hdr.classList.toggle('is-solid', !darkHead || window.scrollY > 40); }
  hdrState(); window.addEventListener('scroll', hdrState, { passive: true });
  function closeMenu() { burger.setAttribute('aria-expanded', 'false'); mm.hidden = true; hdr.classList.remove('is-open'); }
  burger.addEventListener('click', function () {
    var open = burger.getAttribute('aria-expanded') === 'true';
    if (open) closeMenu(); else { burger.setAttribute('aria-expanded', 'true'); mm.hidden = false; hdr.classList.add('is-open'); }
  });
  $$('#mmenu a').forEach(function (a) { a.addEventListener('click', closeMenu); });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMenu(); closeModal(); closeLightbox(); } });

  /* ---------- reveal on scroll ---------- */
  var rv = $$('.rv');
  if (reduce || !('IntersectionObserver' in window)) rv.forEach(function (n) { n.classList.add('in'); });
  else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    rv.forEach(function (n, i) { n.style.setProperty('--dl', (i % 3) * 0.08 + 's'); io.observe(n); });
  }
  /* шаги процесса */
  var steps = $$('.step');
  if (steps.length && 'IntersectionObserver' in window) {
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle('in', e.isIntersecting || e.boundingClientRect.top < 0); });
    }, { threshold: .5 });
    steps.forEach(function (s) { so.observe(s); });
  } else steps.forEach(function (s) { s.classList.add('in'); });

  /* ---------- счётчики: только для подтверждённых показателей (data-count) ---------- */
  $$('[data-count]').forEach(function (el) {
    var to = +el.getAttribute('data-count');
    if (reduce || !isFinite(to)) { el.textContent = to; return; }
    var t0 = null;
    function tick(t) { t0 = t0 || t; var p = Math.min(1, (t - t0) / 1200); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
  });

  /* ---------- FAQ ---------- */
  $$('.acc-q').forEach(function (b) {
    b.addEventListener('click', function () {
      var item = b.closest('.acc-item'), open = !item.classList.contains('open');
      item.classList.toggle('open', open); b.setAttribute('aria-expanded', open);
    });
  });

  /* ---------- modal ---------- */
  var modal = $('#modal');
  function openModal(subject, context) {
    var f = $('form', modal);
    f.elements.subject.value = subject || 'Заявка с сайта';
    f.elements.context.value = context || '';
    $('#modal-sub').textContent = subject && subject !== 'Заявка с сайта' ? subject : '';
    $('.form-msg', f).textContent = ''; $('.form-msg', f).className = 'form-msg';
    modal.hidden = false; doc.body.style.overflow = 'hidden';
    setTimeout(function () { f.elements.name.focus(); }, 60);
  }
  function closeModal() { if (modal && !modal.hidden) { modal.hidden = true; doc.body.style.overflow = ''; } }
  window.KF = { openForm: openModal };
  doc.addEventListener('click', function (e) {
    var t = e.target.closest('[data-open-form]');
    if (t) { e.preventDefault(); openModal(t.getAttribute('data-subject'), t.getAttribute('data-context')); return; }
    if (e.target.closest('#modal [data-close]')) closeModal();
  });

  /* ---------- формы ---------- */
  var PHONE_RE = /^\+7\d{10}$/;
  function normPhone(v) {
    var d = String(v).replace(/\D/g, '');
    if (d.length === 11 && (d[0] === '8' || d[0] === '7')) d = d.slice(1);
    return d.length === 10 ? '+7' + d : null;
  }
  function fmtPhone(v) {
    var d = String(v).replace(/\D/g, '');
    if (d[0] === '8' || d[0] === '7') d = d.slice(1);
    d = d.slice(0, 10);
    var o = '+7';
    if (d.length) o += ' ' + d.slice(0, 3);
    if (d.length > 3) o += ' ' + d.slice(3, 6);
    if (d.length > 6) o += '-' + d.slice(6, 8);
    if (d.length > 8) o += '-' + d.slice(8, 10);
    return o;
  }
  $$('input[name=phone]').forEach(function (i) {
    i.addEventListener('input', function () { if (i.value) i.value = fmtPhone(i.value); });
  });
  $$('form[data-kf-form]').forEach(function (f) {
    f.elements.ts.value = Date.now();
    var msg = $('.form-msg', f), btn = $('button[type=submit]', f);
    function say(t, cls) { msg.textContent = t; msg.className = 'form-msg ' + (cls || ''); }
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      $$('.fld', f).forEach(function (x) { x.classList.remove('bad'); });
      var name = f.elements.name.value.trim(), ph = normPhone(f.elements.phone.value);
      if (name.length < 2) { f.elements.name.closest('.fld').classList.add('bad'); return say('Укажите имя', 'err'); }
      if (!ph || !PHONE_RE.test(ph)) { f.elements.phone.closest('.fld').classList.add('bad'); return say('Проверьте номер телефона: нужен российский номер из 10 цифр после +7', 'err'); }
      if (!f.elements.consent.checked) return say('Нужно согласие на обработку персональных данных', 'err');
      var ep = (D.site && D.site.formEndpoint) || '';
      if (!ep) return say('Отправка заявок ещё не подключена. Позвоните нам: ' + ((D.site && D.site.phone) || ''), 'err');
      var fd = new FormData(f); fd.set('phone', ph);
      fd.set('page', location.href);
      btn.disabled = true; say('Отправляем…');
      fetch((doc.body.getAttribute('data-pre') || '') + ep, { method: 'POST', body: fd })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.ok, j: j }; }); })
        .then(function (r) {
          if (r.ok) { say('Спасибо! Заявка отправлена, мы свяжемся с вами.', 'ok'); f.reset(); f.elements.ts.value = Date.now(); setTimeout(closeModal, 2500); }
          else say((r.j && r.j.error) || 'Не удалось отправить заявку. Позвоните нам: ' + D.site.phone, 'err');
        })
        .catch(function () { say('Нет связи с сервером. Позвоните нам: ' + D.site.phone, 'err'); })
        .then(function () { btn.disabled = false; });
    });
  });

  /* ---------- lightbox ---------- */
  var lb = $('#lightbox');
  function closeLightbox() { if (lb && !lb.hidden) lb.hidden = true; }
  doc.addEventListener('click', function (e) {
    var a = e.target.closest('[data-lightbox]');
    if (a) { e.preventDefault(); var im = $('img', lb); im.src = a.getAttribute('href'); im.alt = $('img', a).alt; lb.hidden = false; }
    else if (e.target.closest('#lightbox')) closeLightbox();
  });

  /* ---------- проекты: фильтр ---------- */
  $$('.chips [data-cat]').forEach(function (c) {
    c.addEventListener('click', function () {
      $$('.chips [data-cat]').forEach(function (x) { x.classList.toggle('is-on', x === c); });
      var cat = c.getAttribute('data-cat');
      $$('.proj').forEach(function (p) { p.hidden = cat !== 'all' && p.getAttribute('data-cat') !== cat; });
    });
  });
})();
