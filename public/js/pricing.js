(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KangPricing = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var groups = [
    { title: 'Camisetas', items: [['Camiseta Oficial (Versión Fan)',2500],['Camiseta Jugador (Versión Player)',2900],['Camiseta Retro / Clásica',2900],['Camiseta Baloncesto (NBA)',3900]] },
    { title: 'Infantil', items: [['Conjunto Niño (Camiseta + Pantalón corto)',2500],['Traje Entrenamiento Niño (Corto)',3000],['Chándal Completo Niño (Chaqueta + Pantalón largo)',4200]] },
    { title: 'Entrenamiento & Verano', items: [['Conjunto Adulto (Camiseta + Pantalón corto)',2700],['Traje Entrenamiento (Chaleco / Manga corta + Short)',3500],['Traje Entrenamiento (Polo + Pantalón largo)',4000]] },
    { title: 'Chándals & Cortavientos', items: [['Chaqueta Cortavientos',4500],['Chándal Entrenamiento (Media cremallera + Pantalón)',4900],['Chándal Entrenamiento (Cremallera completa / Capucha)',5500],['Conjunto Cortavientos Completo',5500]] },
    { title: 'Abrigos & Invierno', items: [['Chaqueta Acolchada Corta',6000],['Abrigo Largo / Conjunto Acolchado Corto',7500],['Conjunto Acolchado Largo Completo',8900]] },
    { title: 'Personalización & Extras', items: [['Personalización (nombre y número)',200],['Parche (por unidad)',100],['Suplemento Talla Especial (3XL / 4XL)',300]] }
  ];
  function baseCents(product) {
    var t = String(product.title || '').toLowerCase(), type = String(product.type || '').toLowerCase();
    var flags = product.flags || [];
    function hasFlag(flag) { return Array.isArray(flags) ? flags.indexOf(flag) !== -1 : !!flags[flag]; }
    if (/\bnba\b|basketball/.test(t) || /nba/i.test(product.league || '')) return 3900;
    if (/long padded|padded long|long coat|long puffer/.test(t)) return /set|complete|suit|conjunto/.test(t) ? 8900 : 7500;
    if (/padded|puffer|acolchad/.test(t)) return /long|set|complete|conjunto/.test(t) ? 7500 : 6000;
    if (/windbreaker/.test(t) && /set|suit|complete|conjunto/.test(t)) return 5500;
    if (/windbreaker|cortavientos/.test(t) || type === 'jacket') return 4500;
    var kids = hasFlag('kids') || /kids|kid |junior|youth|infantil|child/.test(t);
    if (kids) {
      if (/tracksuit|track suit|training suit|chandal|chaqueta/.test(t) && /long|full|complete|set|suit|pant/.test(t)) return 4200;
      if (/training|entrenamiento/.test(t)) return 3000;
      return 2500;
    }
    if (/polo/.test(t) && /pant|trouser|long/.test(t)) return 4000;
    if (/retro|vintage/.test(t) || hasFlag('retro') || hasFlag('player') || /player version/.test(t)) return 2900;
    if (/full zip|full zipper|full-zip|hooded|hoodie/.test(t) && /training|tracksuit|track suit|suit/.test(t)) return 5500;
    if (/half zip|half-zip|quarter zip|1\/2 zip|1\/4 zip/.test(t)) return 4900;
    if (/training suit|tracksuit|track suit|suit set/.test(t) || type === 'training') return 4900;
    if (/vest|sleeveless|short sleeve/.test(t) && /short/.test(t)) return 3500;
    if (/set/.test(t) && /shirt|jersey|short/.test(t)) return 2700;
    if (type === 'polo') return 4000;
    if (type === 'jersey' || type === 'casual') return 2500;
    if (type === 'shorts') return 2700;
    if (type === 'hoodie') return 5500;
    return 2500;
  }
  function calculate(product, options) {
    options = options || {};
    var base = baseCents(product), custom = (options.name || options.number) ? 200 : 0;
    var selectedPatches = String(options.patches || '').split(',').map(function (patch) { return patch.trim(); }).filter(function (patch) { return patch && patch !== 'No'; });
    var patchCount = parseInt(options.patchCount, 10);
    if (!isFinite(patchCount) || patchCount < 0) patchCount = selectedPatches.length;
    var patches = patchCount * 100;
    var size = String(options.size || '').toUpperCase(), special = /^(3XL|4XL)$/.test(size) ? 300 : 0;
    return { basePriceCents: base, nameNumberCents: custom, patchesCents: patches, sizeSurchargeCents: special, unitPriceCents: base + custom + patches + special };
  }
  function money(cents) { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format((Number(cents) || 0) / 100); }
  return { groups: groups, calculate: calculate, money: money };
}));
