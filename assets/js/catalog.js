(function () {
  'use strict';
  var box = document.getElementById('filters'), grid = document.getElementById('pgrid');
  if (!box || !grid) return;
  var cards = Array.prototype.slice.call(grid.children);
  var sort = document.getElementById('sort'), count = document.getElementById('count'), nores = document.getElementById('nores');
  var f = function (n) { return box.querySelector('[name=' + n + ']'); };
  var num = function (el) { var v = parseFloat(el.value); return isFinite(v) ? v : null; };

  function apply() {
    var brands = Array.prototype.slice.call(box.querySelectorAll('[name=brand]:checked')).map(function (c) { return c.value; });
    var pmin = num(f('pmin')), pmax = num(f('pmax')), amin = num(f('amin')), amax = num(f('amax'));
    var wmin = num(f('wmin')), wmax = num(f('wmax')), type = f('type').value, inv = f('inverter').value;
    var shown = 0;
    cards.forEach(function (c) {
      var d = c.dataset, price = d.price === '' ? null : +d.price, area = +d.area, pw = +d.power;
      var ok = (!brands.length || brands.indexOf(d.brand) > -1) &&
        (pmin === null || (price !== null && price >= pmin)) && (pmax === null || (price !== null && price <= pmax)) &&
        (amin === null || area >= amin) && (amax === null || area <= amax) &&
        (wmin === null || pw >= wmin) && (wmax === null || pw <= wmax) &&
        (!type || d.type === type) && (inv === '' || d.inverter === inv);
      c.hidden = !ok; if (ok) shown++;
    });
    var mode = sort.value;
    var sorted = cards.slice().sort(function (a, b) {
      if (mode === 'pop') return b.dataset.pop - a.dataset.pop;
      var pa = a.dataset.price === '' ? Infinity : +a.dataset.price, pb = b.dataset.price === '' ? Infinity : +b.dataset.price;
      if (pa === pb) return 0;
      if (mode === 'price-asc') return pa - pb;
      if (pa === Infinity) return 1; if (pb === Infinity) return -1;
      return pb - pa;
    });
    sorted.forEach(function (c) { grid.appendChild(c); });
    count.textContent = 'Найдено моделей: ' + shown;
    nores.hidden = shown > 0;
  }
  box.addEventListener('input', apply); box.addEventListener('change', apply); sort.addEventListener('change', apply);
  document.getElementById('f-reset').addEventListener('click', function () {
    box.querySelectorAll('input').forEach(function (i) { if (i.type === 'checkbox') i.checked = false; else i.value = ''; });
    box.querySelectorAll('select').forEach(function (s) { s.selectedIndex = 0; });
    apply();
  });
  var tg = document.getElementById('f-toggle');
  tg.addEventListener('click', function () { var o = box.classList.toggle('open'); tg.setAttribute('aria-expanded', o); });
  // предзаполнение из ?brand=
  var qb = new URLSearchParams(location.search).get('brand');
  if (qb) { var c = box.querySelector('[name=brand][value="' + qb + '"]'); if (c) c.checked = true; }
  apply();
})();
