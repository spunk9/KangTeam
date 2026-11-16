(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KangPricing = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var groups = [
    { title: 'Camisetas', items: [['Camiseta Oficial (Versión Fan · Manga corta)',2500],['Camiseta Oficial Manga Larga (Versión Fan)',2800],['Camiseta Jugador / Retro (Manga corta)',2900],['Camiseta Jugador / Retro (Manga larga)',3200],['Camiseta Baloncesto (NBA)',3200]] },
    { title: 'Infantil', items: [['Conjunto Niño (Camiseta manga corta + Pantalón)',2500],['Camiseta Niño Manga Larga',2800],['Traje Entrenamiento Niño (Corto)',3000],['Chándal Completo Niño (Chaqueta + Pantalón largo)',4200]] },
    { title: 'Entrenamiento & Verano', items: [['Conjunto Adulto (Camiseta + Pantalón corto)',2700],['Traje Entrenamiento (Chaleco / Manga corta + Short)',3500],['Traje Entrenamiento (Polo + Pantalón largo)',4000]] },
    { title: 'Chándals & Cortavientos', items: [['Chaqueta Cortavientos',4500],['Chándal Entrenamiento (Media cremallera + Pantalón)',4900],['Chándal Entrenamiento (Cremallera completa / Capucha)',5500],['Conjunto Cortavientos Completo',5500]] },
    { title: 'Abrigos & Invierno', items: [['Chaqueta Acolchada Corta',6000],['Abrigo Largo / Conjunto Acolchado Corto',7500],['Conjunto Acolchado Largo Completo',8900]] },
    { title: 'Personalización & Extras', items: [['Suplemento Manga Larga (en camisetas)',300],['Personalización (nombre y número)',200],['Parche (por unidad)',100],['Suplemento Talla Especial (3XL / 4XL / 5XL)',300]] }
  ];
  function isLongSleeveFlag(product) {
    product = product || {};
    var t = String(product.title || '').toLowerCase();
    var flags = product.flags || [];
    var hasLong = Array.isArray(flags) ? flags.indexOf('long') !== -1 : !!flags.long;
    return hasLong || /\b(long[-\s]?sleeves?d?|manga\s+larga)\b/i.test(t);
  }
  function isJerseyLike(product) {
    product = product || {};
    var type = String(product.type || '').toLowerCase();
    var t = String(product.title || '').toLowerCase();
    if (type === 'shorts' || type === 'hoodie' || type === 'jacket' || type === 'training') return false;
    if ((/\bnba\b|basketball/.test(t) || /nba/i.test(product.league || '')) && !/\bshorts?\b/.test(t)) return false;
    if (/padded|puffer|acolchad|\bdown\s+jacket\b|\bvest\s+down\b|\bcotton\s+gilet\b|\bparka\b|\bwindbreaker\b|\bcortavientos\b|\bsoftshell\b/.test(t)) return false;
    if (/\b(hoodie|sweatshirt|tracksuit|track\s*suit|training\s+suit|suit\s+set)\b/.test(t)) return false;
    if (/\bshorts\b/.test(t) && /\b(t-shirt|tee|shirt|jersey|set|suit|kit)\b/.test(t)) return false;
    return type === 'jersey' || type === 'polo' || type === 'casual' || type === 'other' || !type;
  }
  function baseCents(product) {
    product = product || {};
    var t = String(product.title || '').toLowerCase();
    var sub = String(product.subcategory || '').toLowerCase();
    var type = String(product.type || '').toLowerCase();
    var flags = product.flags || [];
    function hasFlag(flag) { return Array.isArray(flags) ? flags.indexOf(flag) !== -1 : !!flags[flag]; }

    var isRetro = hasFlag('retro') || /\bretro\b|\bvintage\b/.test(t);
    var isPlayer = hasFlag('player') || /player\s+version|player\s+issue/.test(t);
    var isLongSleeve = isLongSleeveFlag(product);
    var kids = hasFlag('kids') ||
      product.audience === 'kids' ||
      /^\d{1,2}-\d{1,2}$/.test(String(product.sizeRange || '')) ||
      /^niños\b/.test(sub) ||
      /\b(kids?|youth|infantil|child|children)\b/.test(t) ||
      (/\bjunior\b/.test(t) && !/\b(?:boca|argentinos)\s+juniors\b/.test(t));

    // 1. Subcategorías exactas (colección GXG primavera / invierno)
    if (sub) {
      if (sub.indexOf('niños') !== -1 || (kids && type === 'training')) {
        if (sub.indexOf('pantalón largo') !== -1) return 4200; // Chándal Completo Niño (Chaqueta + Pantalón largo)
        return 3000; // Traje Entrenamiento Niño (Corto)
      }
      if (sub.indexOf('chaleco + pantalón corto') !== -1 || sub.indexOf('manga corta + pantalón corto') !== -1) return 3500;
      if (sub.indexOf('polo + pantalón largo') !== -1) return 4000;
      if (sub.indexOf('media cremallera + pantalón largo') !== -1) return 4900;
      if (sub.indexOf('cremallera completa + pantalón largo') !== -1 || sub.indexOf('con capucha + pantalón largo') !== -1) return 5500;
      if (sub.indexOf('cortavientos') !== -1 || sub.indexOf('softshell') !== -1) return 4500;
      if (sub.indexOf('sudadera') !== -1) return 5500;
      if (sub.indexOf('chaleco acolchado') !== -1 || sub.indexOf('chaqueta acolchada') !== -1) {
        if (/\blong\b|\blargo\b/.test(t) && /\b(set|suit|complete|conjunto)\b/.test(t)) return 8900;
        if (/\blong\b|\blargo\b|\b(set|suit|complete|conjunto)\b/.test(t)) return 7500;
        return 6000;
      }
      if (sub.indexOf('entrenamiento sin escudo') !== -1) {
        if (/full[\s-]?zip|hooded|hoodie/.test(t)) return 5500;
        if (/vest|sleeveless|short sleeve/.test(t) && /short/.test(t)) return 3500;
        return 4900;
      }
    }

    // 2. Baloncesto / NBA (solo camisetas, no pantalones cortos)
    if ((/\bnba\b|basketball/.test(t) || /nba/i.test(product.league || '')) && type !== 'shorts' && !/\bshorts?\b/.test(t)) {
      return 3200;
    }

    // 3. Abrigos e invierno (acolchados / plumas / puffer / down)
    var isPadded = /padded|puffer|acolchad|\bdown\s+jacket\b|\bvest\s+down\b|\bcotton\s+gilet\b|\bparka\b/.test(t);
    var isLongCoat = /long\s+(?:padded|puffer|coat|down|parka)|(?:padded|puffer|down)\s+long/.test(t);
    if (isLongCoat) {
      return /\b(set|complete|suit|conjunto)\b/.test(t) ? 8900 : 7500;
    }
    if (isPadded) {
      return /\b(set|complete|suit|conjunto)\b/.test(t) ? 7500 : 6000;
    }

    // 4. Cortavientos y chaquetas
    if (/\bwindbreaker\b|\bcortavientos\b/.test(t) && /\b(set|suit|complete|conjunto)\b/.test(t)) return 5500;
    if (/\bwindbreaker\b|\bcortavientos\b|\bsoftshell\b/.test(t) || type === 'jacket') return 4500;

    // 5. Infantil
    if (kids) {
      if ((type === 'training' || /\b(tracksuit|track\s*suit|training\s*suit|chandal|chaqueta)\b/.test(t)) && /\b(long|full|complete|largo|pant|trouser)\b/.test(t)) {
        return 4200;
      }
      if (type === 'training' || (/\b(training|entrenamiento)\b/.test(t) && /\b(kit|suit|wear|clothes|set)\b/.test(t))) return 3000;
      if (isLongSleeve && type !== 'shorts' && !/\bshorts?\b/.test(t)) return 2800;
      return 2500;
    }

    // 6. Entrenamiento, chándals y sudaderas adulto
    if (/\bpolo\b/.test(t) && /\b(training\s+(?:suit|wear)|tracksuit|track\s*suit|pant|trouser|pantal[oó]n)\b/.test(t)) return 4000;
    if (/\b(full[\s-]?zip|full\s+zipper|hooded)\b/.test(t) && (type === 'training' || type === 'hoodie' || /\b(training|tracksuit|track\s*suit|suit)\b/.test(t))) return 5500;
    if (type === 'hoodie' || /\b(hoodie|sweatshirt)\b/.test(t)) return 5500;
    if (/\b(half[\s-]?zip|quarter\s+zip|1\/2\s*zip|1\/4\s*zip)\b/.test(t)) return 4900;
    if (type === 'training' && (/\b(vest|sleeveless)\b/.test(t) || (/\bshort\s+sleeve\b/.test(t) && /\bshort\b/.test(t)))) return 3500;
    if (type === 'training' || /\b(training\s+suit|tracksuit|track\s*suit|suit\s+set)\b/.test(t)) return 4900;

    // 7. Conjuntos cortos adulto (camiseta + pantalón corto)
    if (/\b(set|suit|kit)\b/.test(t) && /\b(shirt|jersey|t-shirt|tee)\b/.test(t) && /\bshorts\b/.test(t)) return 2700;
    if (/\bshorts\b/.test(t) && /\b(t-shirt|tee|shirt|jersey)\b/.test(t)) return 2700;

    // 8. Camisetas (Fan 25€, Player/Retro 29€; +3€ manga larga), polos individuales y pantalones cortos
    if (type === 'shorts') return 2500;
    var sleeveExtra = isLongSleeve ? 300 : 0;
    if (type === 'jersey' || type === 'polo' || type === 'casual' || type === 'other') {
      if (isRetro || isPlayer) return 2900 + sleeveExtra;
      return 2500 + sleeveExtra;
    }

    return 2500;
  }
  function calculate(product, options) {
    options = options || {};
    var base = baseCents(product), custom = (options.name || options.number) ? 200 : 0;
    var isLongSleeveJersey = !String((product && product.subcategory) || '').trim() && isLongSleeveFlag(product) && isJerseyLike(product);
    var selectedPatches = String(options.patches || '').split(',').map(function (patch) { return patch.trim(); }).filter(function (patch) { return patch && patch !== 'No'; });
    var patchCount = parseInt(options.patchCount, 10);
    if (!isFinite(patchCount) || patchCount < 0) patchCount = selectedPatches.length;
    var patches = patchCount * 100;
    var size = String(options.size || '').toUpperCase(), special = /^(3XL|4XL|5XL)$/.test(size) ? 300 : 0;
    return {
      basePriceCents: base,
      isLongSleeve: isLongSleeveJersey,
      longSleeveCents: isLongSleeveJersey ? 300 : 0,
      nameNumberCents: custom,
      patchesCents: patches,
      sizeSurchargeCents: special,
      unitPriceCents: base + custom + patches + special
    };
  }
  var VOLUME_TIERS = [
    { minQty: 15, perItemCents: 300, label: '15+ prendas (-3,00 €/ud)' },
    { minQty: 10, perItemCents: 200, label: '10–14 prendas (-2,00 €/ud)' },
    { minQty: 5, perItemCents: 100, label: '5–9 prendas (-1,00 €/ud)' }
  ];

  function getVolumeDiscount(totalItems) {
    var qty = Math.max(0, parseInt(totalItems, 10) || 0);
    for (var i = 0; i < VOLUME_TIERS.length; i++) {
      if (qty >= VOLUME_TIERS[i].minQty) {
        return {
          tierMin: VOLUME_TIERS[i].minQty,
          perItemCents: VOLUME_TIERS[i].perItemCents,
          discountCents: VOLUME_TIERS[i].perItemCents * qty,
          label: VOLUME_TIERS[i].label
        };
      }
    }
    return { tierMin: 0, perItemCents: 0, discountCents: 0, label: '' };
  }

  function nextVolumeTier(totalItems) {
    var qty = Math.max(0, parseInt(totalItems, 10) || 0);
    for (var i = VOLUME_TIERS.length - 1; i >= 0; i--) {
      if (qty < VOLUME_TIERS[i].minQty) return VOLUME_TIERS[i];
    }
    return null;
  }

  function money(cents) { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format((Number(cents) || 0) / 100); }

  return {
    groups: groups,
    VOLUME_TIERS: VOLUME_TIERS,
    getVolumeDiscount: getVolumeDiscount,
    nextVolumeTier: nextVolumeTier,
    calculate: calculate,
    money: money
  };
}));

