(function () {
  'use strict';
  var root = document.getElementById('calc-root');
  if (!root || !window.KF_DATA || !window.KFCalc) return;
  var P = KF_DATA.prices, PR = KF_DATA.catalog.products, BR = KF_DATA.catalog.brands, C = KFCalc;
  var cur = P.currency || '₽';
  var ROOMS = ['Квартира', 'Частный дом', 'Офис', 'Магазин', 'Другое'];
  var S = { step: 1, room: null, area: '', rooms: 1, units: 1, specialist: false, brand: '', modelId: null, installType: P.installTypes[0].id, extras: {} };
  var TOTAL = 6;
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (n) { return C.formatMoney(n, cur); };

  // предвыбор модели из ?model=
  var qm = new URLSearchParams(location.search).get('model');
  if (qm) {
    var pm = PR.filter(function (p) { return p.id === qm; })[0];
    if (pm) { S.modelId = pm.id; S.brand = pm.brand; S.area = pm.area; S.room = ROOMS[0]; S.step = 2; }
  }

  function model() { return PR.filter(function (p) { return p.id === S.modelId; })[0] || null; }
  function result() {
    var st = { area: S.area, rooms: S.rooms, units: S.units, model: model(), specialist: S.specialist, installType: S.installType, extras: S.extras };
    return C.calculate(P, st);
  }
  function areaPerUnit() { return (+S.area || 0) / Math.max(1, S.units); }

  /* ---------- сводка ---------- */
  function summaryHTML(r) {
    var eq = r.equipmentPending ? 'по результатам подбора' : money(r.equipment) + (r.units > 1 ? ' (' + r.units + ' шт.)' : '');
    var lines = '<div class="ln"><dt>Кондиционер</dt><dd>' + eq + '</dd></div>' +
      '<div class="ln"><dt>' + esc(r.installType.label) + '</dt><dd>' + money(r.install) + '</dd></div>';
    var ex = '<div class="ln"><dt>Дополнительные работы</dt><dd>' + (r.extrasSum ? money(r.extrasSum) : (r.extrasRequest ? '' : '—')) + (r.extrasRequest ? (r.extrasSum ? ' + ' : '') + 'отдельно' : '') + '</dd></div>';
    r.extras.forEach(function (e) {
      ex += '<div class="ln sub-ln"><dt>' + esc(e.label) + ' · ' + e.qty + (e.unit ? ' ' + e.unit : '') + '</dt><dd>' + (e.sum === null ? 'по запросу' : money(e.sum)) + '</dd></div>';
    });
    var fine = (r.equipmentPending ? 'Итог без оборудования: модель подберёт специалист. ' : '') + 'Расчёт предварительный и не является офертой. Точную стоимость назовёт менеджер после замера.';
    if (!P.confirmed) fine = 'Тарифы временные (демо). ' + fine;
    return '<h3>Предварительный расчёт</h3><dl>' + lines + ex + '</dl>' +
      '<div class="total"><span>Итого</span><b id="total-b">' + money(r.total) + '</b></div>' +
      '<p class="fine">' + fine + '</p>';
  }
  var sumEl, lastTotal = null;
  function updateSummary() {
    var r = result();
    var wasExpanded = sumEl.classList.contains('expanded');
    sumEl.innerHTML = summaryHTML(r);
    if (wasExpanded) sumEl.classList.add('expanded');
    var b = sumEl.querySelector('#total-b');
    if (lastTotal !== null && lastTotal !== r.total && b) { b.classList.add('bump'); }
    lastTotal = r.total;
    return r;
  }

  /* ---------- шаги ---------- */
  function progress() {
    var h = '<div class="progress" aria-label="Шаг ' + S.step + ' из ' + TOTAL + '">';
    for (var i = 1; i <= TOTAL; i++) h += '<i class="' + (i <= S.step ? 'on' : '') + '"></i>';
    return h + '</div>';
  }
  function nav(canNext, last) {
    return '<div class="cnav">' + (S.step > 1 ? '<button type="button" class="btn btn-ghost" data-act="back">Назад</button>' : '<span></span>') +
      (last ? '' : '<button type="button" class="btn btn-dark" data-act="next"' + (canNext ? '' : ' disabled') + '>Далее</button>') + '</div>';
  }
  function stepper(id, val, min, max) {
    return '<div class="stepper" data-st="' + id + '" data-min="' + min + '" data-max="' + max + '"><button type="button" data-d="-1" aria-label="Меньше">−</button><output>' + val + '</output><button type="button" data-d="1" aria-label="Больше">+</button></div>';
  }

  function step1() {
    return '<h3>Какое у вас помещение?</h3><p class="sub">Это поможет подобрать оборудование.</p><div class="opts">' +
      ROOMS.map(function (r) { return '<button type="button" class="opt' + (S.room === r ? ' on' : '') + '" data-room="' + r + '"><b>' + r + '</b></button>'; }).join('') + '</div>' + nav(!!S.room);
  }
  function step2() {
    return '<h3>Площадь помещения</h3><p class="sub">Если кондиционеров несколько, укажите общую площадь и число комнат.</p>' +
      '<div class="row-in"><label class="fld"><span>Площадь, м²</span><input id="c-area" type="number" min="1" max="500" step="1" inputmode="decimal" value="' + esc(S.area) + '" placeholder="Например, 28"></label>' +
      '<div class="fld"><span>Количество комнат</span>' + stepper('rooms', S.rooms, 1, 10) + '</div></div>' + nav(+S.area > 0);
  }
  function step3() {
    var apu = areaPerUnit(), brandsHtml = '<button type="button" class="chip' + (!S.brand ? ' is-on' : '') + '" data-brand="">Все бренды</button>' +
      BR.map(function (b) { return '<button type="button" class="chip' + (S.brand === b.name ? ' is-on' : '') + '" data-brand="' + esc(b.name) + '">' + esc(b.name) + '</button>'; }).join('');
    var models = C.matchModels(PR, apu, S.brand);
    var list;
    if (S.specialist) list = '<p class="sub">Специалист подберёт модель под вашу площадь и бюджет. В итог войдёт только монтаж.</p>';
    else if (!models.length) list = '<p class="notice">Подходящих моделей в каталоге для ' + Math.round(apu) + ' м² на кондиционер не найдено. Увеличьте число кондиционеров или оставьте подбор специалисту.</p>';
    else list = '<p class="sub">Рекомендуемая мощность — около ' + C.recommendedPowerKw(P, apu) + ' кВт на кондиционер (ориентировочно).</p><div class="opts opts-list">' +
      models.map(function (m) {
        return '<button type="button" class="opt model' + (S.modelId === m.id ? ' on' : '') + '" data-model="' + esc(m.id) + '"><b>' + esc(m.brand) + ' ' + esc(m.name) + '</b><span>' + (typeof m.price === 'number' ? money(m.price) : 'цена по запросу') + '</span><small>до ' + m.area + ' м² · ' + m.power + ' кВт · ' + (m.inverter ? 'инвертор' : 'обычный') + (m.demo ? ' · демо-данные' : '') + '</small></button>';
      }).join('') + '</div>';
    var canNext = S.specialist || !!model();
    return '<h3>Выбор кондиционера</h3>' +
      '<div class="chips" role="group"><button type="button" class="chip' + (!S.specialist ? ' is-on' : '') + '" data-spec="0">Подобрать по площади</button><button type="button" class="chip' + (S.specialist ? ' is-on' : '') + '" data-spec="1">Оставить подбор специалисту</button></div>' +
      (S.specialist ? '' : '<div class="chips" role="group" aria-label="Бренд">' + brandsHtml + '</div>') +
      '<div class="fld"><span>Количество кондиционеров</span>' + stepper('units', S.units, 1, 10) + '</div>' + list + nav(canNext);
  }
  function step4() {
    return '<h3>Тип установки</h3><p class="sub">От этого зависит стоимость монтажа.</p><div class="opts">' +
      P.installTypes.map(function (t) { return '<button type="button" class="opt' + (S.installType === t.id ? ' on' : '') + '" data-itype="' + t.id + '"><b>' + esc(t.label) + '</b><small>' + esc(t.desc) + '</small></button>'; }).join('') + '</div>' + nav(true);
  }
  function step5() {
    var rows = P.extras.map(function (e) {
      var q = S.extras[e.id] || 0, hint = e.note ? '<small>' + esc(e.note) + (e.perUnit ? '; включено ' + P.install.includedRouteMeters + ' м' : '') + '</small>' : '';
      var price = (e.price === null || e.type === 'request') ? 'по запросу' : money(e.price) + (e.unit ? ' / ' + e.unit : '');
      var ctl = e.type === 'request' ? '<label class="chk"><input type="checkbox" data-xreq="' + e.id + '"' + (q ? ' checked' : '') + '><span>Нужно</span></label>' : stepper('x:' + e.id, q, 0, e.max || 20);
      return '<div class="extra"><div><b>' + esc(e.label) + '</b>' + hint + '<small>' + price + '</small></div>' + ctl + '</div>';
    }).join('');
    return '<h3>Дополнительные услуги</h3><p class="sub">Выберите то, что нужно. Необязательно.</p>' + rows + nav(true);
  }
  function step6() {
    return '<h3>Итоговый расчёт</h3><p class="sub">Проверьте параметры справа. Оставьте контакты — менеджер уточнит детали и назовёт точную стоимость.</p>' +
      '<ul class="ticks"><li>Помещение: ' + esc(S.room || '—') + ', ' + esc(S.area) + ' м²</li><li>Кондиционеров: ' + S.units + '</li><li>Тип установки: ' + esc(result().installType.label) + '</li></ul>' +
      '<div class="btn-row"><button type="button" class="btn btn-accent btn-lg" data-act="order">Получить точный расчёт</button><a class="btn btn-ghost btn-lg" href="tel:' + KF_DATA.site.phoneRaw + '">Позвонить</a></div>' + nav(true, true);
  }

  var main;
  function render() {
    var fn = [null, step1, step2, step3, step4, step5, step6][S.step];
    main.innerHTML = (P.confirmed ? '' : '<p class="calc-warn"><b>Демо-режим:</b> тарифы в калькуляторе — временные заглушки, не цены компании.</p>') + progress() + '<div class="cstep">' + fn() + '</div>';
    updateSummary();
    var inp = main.querySelector('#c-area'); if (inp && !qm) { /* не отбираем фокус на мобильных */ }
  }
  function nextEnabled() {
    var b = main.querySelector('[data-act=next]'); if (!b) return;
    var ok = S.step === 1 ? !!S.room : S.step === 2 ? +S.area > 0 : S.step === 3 ? (S.specialist || !!model()) : true;
    b.disabled = !ok;
  }

  function context() {
    var r = result(), m = r.model, L = [];
    L.push('Помещение: ' + (S.room || '—') + ', ' + S.area + ' м², комнат: ' + S.rooms + ', кондиционеров: ' + r.units);
    L.push(m ? 'Модель: ' + m.brand + ' ' + m.name : 'Модель: подбор специалистом');
    L.push('Кондиционер: ' + (r.equipmentPending ? 'по результатам подбора' : money(r.equipment)));
    L.push('Монтаж (' + r.installType.label + '): ' + money(r.install));
    L.push('Доп. работы: ' + (r.extras.length ? r.extras.map(function (e) { return e.label + ' ' + e.qty + (e.unit || '') + (e.sum === null ? ' (по запросу)' : ' = ' + money(e.sum)); }).join('; ') : 'нет'));
    L.push('ИТОГО (предварительно): ' + money(r.total) + (r.equipmentPending ? ' без оборудования' : ''));
    if (!P.confirmed) L.push('ВНИМАНИЕ: расчёт на временных тарифах-заглушках');
    return L.join('\n');
  }

  /* ---------- события ---------- */
  function onClick(e) {
    var t = e.target.closest('button,[data-act]'); if (!t) return;
    var d = t.dataset;
    if (d.act === 'next') { S.step = Math.min(TOTAL, S.step + 1); render(); scrollTop(); return; }
    if (d.act === 'back') { S.step = Math.max(1, S.step - 1); render(); scrollTop(); return; }
    if (d.act === 'order') { KF.openForm('Расчёт из калькулятора', context()); return; }
    if (d.room) { S.room = d.room; render(); return; }
    if (d.brand !== undefined && t.hasAttribute('data-brand')) { S.brand = d.brand; var m = model(); if (m && S.brand && m.brand !== S.brand) S.modelId = null; render(); return; }
    if (d.spec !== undefined) { S.specialist = d.spec === '1'; render(); return; }
    if (d.model) { S.modelId = d.model; render(); return; }
    if (d.itype) { S.installType = d.itype; render(); return; }
    if (d.d && t.parentNode.dataset.st) {
      var box = t.parentNode, id = box.dataset.st, min = +box.dataset.min, max = +box.dataset.max;
      var cur = id.indexOf('x:') === 0 ? (S.extras[id.slice(2)] || 0) : id === 'rooms' ? S.rooms : S.units;
      var v = Math.max(min, Math.min(max, cur + (+d.d)));
      if (id === 'rooms') { S.rooms = v; S.units = v; }
      else if (id === 'units') { S.units = v; var mm = model(); if (mm && mm.area < areaPerUnit()) S.modelId = null; render(); return; }
      else S.extras[id.slice(2)] = v;
      box.querySelector('output').textContent = v; updateSummary(); nextEnabled();
    }
  }
  function onInput(e) {
    if (e.target.id === 'c-area') {
      S.area = e.target.value; var mm = model();
      if (mm && mm.area < areaPerUnit()) S.modelId = null;
      updateSummary(); nextEnabled();
    }
    if (e.target.dataset && e.target.dataset.xreq) { S.extras[e.target.dataset.xreq] = e.target.checked ? 1 : 0; updateSummary(); }
  }
  function scrollTop() { var r = root.getBoundingClientRect(); if (r.top < 0 || r.top > 200) window.scrollTo({ top: window.scrollY + r.top - 90, behavior: 'smooth' }); }

  root.innerHTML = '<div class="calc-main" id="calc-main"></div><aside class="csum" id="calc-sum" aria-live="polite"></aside>';
  main = root.querySelector('#calc-main'); sumEl = root.querySelector('#calc-sum');
  main.addEventListener('click', onClick); main.addEventListener('input', onInput); main.addEventListener('change', onInput);
  sumEl.addEventListener('click', function () { sumEl.classList.toggle('expanded'); });
  render();
})();
