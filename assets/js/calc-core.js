/* Чистая логика расчёта. Не зависит от DOM, все тарифы приходят из config/prices.json. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KFCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function num(v) { v = Number(v); return isFinite(v) && v > 0 ? v : 0; }

  function installBandPrice(prices, areaPerUnit) {
    var bands = prices.install.bands;
    for (var i = 0; i < bands.length; i++) if (areaPerUnit <= bands[i].upToArea) return bands[i].price;
    return bands[bands.length - 1].price;
  }

  /* Модели, подходящие по площади на один кондиционер */
  function matchModels(products, areaPerUnit, brand) {
    return products.filter(function (p) {
      return p.area >= areaPerUnit && (!brand || p.brand === brand);
    }).sort(function (a, b) { return a.area - b.area || (a.price || 0) - (b.price || 0); });
  }

  function recommendedPowerKw(prices, areaPerUnit) {
    return Math.round((areaPerUnit / prices.areaPerKw) * 10) / 10;
  }

  /*
    state: { area, rooms, units, model (product|null), specialist (bool),
             installType (id), extras: {id: qty} }
  */
  function calculate(prices, state) {
    var units = Math.max(1, Math.floor(num(state.units)) || 1);
    var areaTotal = num(state.area);
    var areaPerUnit = areaTotal / units;
    var model = state.specialist ? null : (state.model || null);

    var equipUnit = model && typeof model.price === 'number' ? model.price : null;
    var equipment = equipUnit === null ? null : equipUnit * units;

    var type = prices.installTypes.filter(function (t) { return t.id === state.installType; })[0] ||
               prices.installTypes[0];
    var base = installBandPrice(prices, areaPerUnit || 1);
    var installUnit = Math.round(base * type.mult + type.add);
    var install = installUnit * units;

    var extraLines = [];
    var extrasSum = 0;
    var hasRequest = false;
    (prices.extras || []).forEach(function (e) {
      var q = Math.max(0, Math.floor(num((state.extras || {})[e.id])));
      if (!q) return;
      if (e.type === 'request' || e.price === null) { hasRequest = true; extraLines.push({ id: e.id, label: e.label, qty: q, sum: null }); return; }
      var billable = q;
      if (e.perUnit) { // метры сверх включённых, на каждый кондиционер
        billable = Math.max(0, q - prices.install.includedRouteMeters) * units;
      }
      var sum = billable * e.price;
      extrasSum += sum;
      extraLines.push({ id: e.id, label: e.label, qty: q, unit: e.unit, billable: billable, sum: sum });
    });

    var total = (equipment || 0) + install + extrasSum;
    return {
      units: units, areaPerUnit: areaPerUnit, model: model,
      equipment: equipment, equipmentPending: !model,
      installType: type, installUnit: installUnit, install: install,
      extras: extraLines, extrasSum: extrasSum, extrasRequest: hasRequest,
      total: total,
      totalIncludesEquipment: equipment !== null
    };
  }

  function formatMoney(n, currency) {
    return new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' ' + (currency || '₽');
  }

  return { calculate: calculate, matchModels: matchModels, installBandPrice: installBandPrice,
           recommendedPowerKw: recommendedPowerKw, formatMoney: formatMoney };
});
