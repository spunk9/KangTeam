'use strict';

/* ═══════════════════════════════════════════════════════════
   KANG TEAM · Catálogo online
   Aplicación de una sola página, sin dependencias.
   ═══════════════════════════════════════════════════════════ */

(function () {
  var $ = function (selector, root) { return (root || document).querySelector(selector); };
  var $$ = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };

  var TYPE_LABELS = {
    jersey: 'Camiseta',
    training: 'Chándal',
    jacket: 'Chaqueta',
    polo: 'Polo',
    shorts: 'Pantalón',
    hoodie: 'Sudadera',
    casual: 'Camiseta casual',
    other: 'Otra prenda'
  };
  var COLLECTION_LABELS = {
    equipaciones: 'Camisetas y equipaciones',
    'primavera-invierno': 'Ropa primavera / invierno'
  };
  var DEPARTMENT_LABELS = { training: 'Entrenamiento', walk: 'Paseo' };

  var FLAG_LABELS = {
    retro: 'Retro',
    kids: 'Niños',
    women: 'Mujer',
    long: 'Manga larga',
    player: 'Player version',
    gk: 'Portero',
    special: 'Edición especial'
  };

  var SEASON_ORDER = ['27/28', '26/27', '25/26', '24/25', '23/24', '22/23', '21/22', '20/21', '2016-2019', '2010-2015', 'Retro', 'Sin temporada'];
  var SEASON_LABELS = { '2016-2019': '2016–2019', '2010-2015': '2010–2015', 'Sin temporada': 'Sin temporada' };

  var numberFormat = new Intl.NumberFormat('es-ES');
  var cartStorageKey = 'kang_cart_v1';
  var favsStorageKey = 'kang_favs_v1';
  var ordersStorageKey = 'kang_orders_v1';
  var customerStorageKey = 'kang_customer_v1';
  var CART_PACK_TARGET = 3;
  var PRICE_BAND_LABELS = { le25: 'Hasta 25 €', '26-45': '26 – 45 €', gt45: 'Más de 45 €' };
  var state = {
    catalog: null,
    items: [],
    byId: new Map(),
    config: null,
    teams: new Map(),
    teamLogos: new Map(),
    leagues: new Map(),
    seasons: new Map(),
    types: new Map(),
    filters: { q: '', team: '', league: '', season: '', type: '', collection: '', department: '', subcategory: '', flag: '', price: '', favs: '' },
    view: 'teams',
    sort: 'new',
    gridPage: 1,
    groupPage: 1,
    route: 'home',
    lastListHash: '#/',
    loading: true,
    product: null,
    gallery: [],
    galleryIndex: 0,
    selectedSize: '',
    qty: 1,
    patches: 'No',
    customName: '',
    customNumber: '',
    sizeGuideOpen: false,
    sizeGuideTab: 'adult',
    cart: [],
    favorites: [],
    favSet: new Set(),
    orders: [],
    customer: { name: '', phone: '', email: '', city: '', notes: '' },
    suggestIndex: -1,
    lastOrder: null,
    overlayCount: 0,
    returnFocus: null,
    previewTimer: null
  };

  // ── Utilidades ───────────────────────────────────────────

  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function enc(value) { return encodeURIComponent(String(value === undefined ? '' : value)); }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function fmt(value) { return numberFormat.format(Number(value) || 0); }

  function debounce(fn, wait) {
    var timer;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  function hashInt(value) {
    var hash = 0;
    var str = String(value || '');
    for (var i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    return Math.abs(hash);
  }

  function colorFor(name) {
    var palette = ['#d9ff3f', '#ffb02e', '#7dd3fc', '#f0abfc', '#fca5a5', '#86efac', '#fde68a', '#c4b5fd', '#fdba74', '#a7f3d0'];
    return palette[hashInt(name) % palette.length];
  }

  function initials(name) {
    var cleaned = String(name || '').replace(/[^\w\s\u00C0-\u024F]/g, ' ').trim();
    var words = cleaned.split(/\s+/).filter(function (word) {
      return word && !/^(de|del|la|el|fc|cf|sc|afc|club|the)$/i.test(word);
    });
    if (!words.length) return 'KT';
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return words.slice(0, 3).map(function (word) { return word.charAt(0); }).join('').toUpperCase();
  }

  function teamLogoUrl(name) {
    if (!name || !state.teamLogos) return '';
    return state.teamLogos.get(name) || '';
  }

  function teamMono(name) {
    var logo = teamLogoUrl(name);
    var label = '<span class="team-mono-text">' + esc(initials(name)) + '</span>';
    if (!logo) {
      return '<span class="team-mono" style="--mono-bg:' + colorFor(name) + '" aria-hidden="true">' + label + '</span>';
    }
    return '<span class="team-mono has-logo" style="--mono-bg:' + colorFor(name) + '" aria-hidden="true">' +
      '<img src="' + esc(logo) + '" alt="" loading="lazy" decoding="async"' +
      ' onload="this.parentNode.classList.add(\'is-logo-ready\')"' +
      ' onerror="this.parentNode.classList.remove(\'has-logo\');this.remove()">' +
      label +
      '</span>';
  }

  function coverUrl(item, size) {
    if (!item || !item.cover) return '/placeholder.svg';
    return (item.source && item.source !== 'minkang' ? '/img/' + item.source : '/img') + item.cover + '/' + (size || 'small') + '.jpg';
  }

  function albumUrl(path, size) {
    if (!path) return '/placeholder.svg';
    return '/img' + path.replace(/\/[^/]+$/, '/' + (size || 'medium') + '.jpg');
  }

  function imgTag(src, alt, options) {
    options = options || {};
    var cls = 'fade-img' + (options.cls ? ' ' + options.cls : '');
    return '<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="' + (options.eager ? 'eager' : 'lazy') + '" decoding="async" class="' + cls + '"' +
      ' onload="this.classList.add(\'is-loaded\')"' +
      ' onerror="this.onerror=null;this.src=\'/placeholder.svg\';this.classList.add(\'is-loaded\')">';
  }

  function seasonLabel(value) { return SEASON_LABELS[value] || value || 'Sin temporada'; }

  function typeLabel(value) { return TYPE_LABELS[value] || 'Prenda'; }

  function flagLabel(value) { return FLAG_LABELS[value] || value; }

  var ADULT_SIZE_GUIDE = [
    { size: 'S', chest: '96–100', length: '70', height: '165–172', weight: '60–68 kg' },
    { size: 'M', chest: '100–104', length: '72', height: '172–177', weight: '68–75 kg' },
    { size: 'L', chest: '104–108', length: '74', height: '177–182', weight: '75–83 kg' },
    { size: 'XL', chest: '108–112', length: '76', height: '182–187', weight: '83–90 kg' },
    { size: '2XL', chest: '112–116', length: '78', height: '187–192', weight: '90–98 kg' },
    { size: '3XL', chest: '116–122', length: '80', height: '190–196', weight: '98–106 kg', extra: '+3,00 €' },
    { size: '4XL', chest: '122–128', length: '82', height: '192–200', weight: '106–115 kg', extra: '+3,00 €' },
    { size: '5XL', chest: '128–134', length: '84', height: '195–205', weight: '+115 kg' }
  ];

  var KIDS_SIZE_GUIDE = [
    { size: '10', age: '1–2 años', height: '80–88', chest: '54–58' },
    { size: '12', age: '2 años', height: '88–94', chest: '58–62' },
    { size: '14', age: '2–3 años', height: '94–100', chest: '62–66' },
    { size: '16', age: '3–4 años', height: '95–105', chest: '66–70' },
    { size: '18', age: '4–5 años', height: '105–115', chest: '70–74' },
    { size: '20', age: '6–7 años', height: '115–125', chest: '74–78' },
    { size: '22', age: '7–8 años', height: '125–135', chest: '78–82' },
    { size: '24', age: '9–10 años', height: '135–145', chest: '82–86' },
    { size: '26', age: '10–11 años', height: '145–155', chest: '86–90' },
    { size: '28', age: '12–13 años', height: '155–165', chest: '90–94' },
    { size: '30', age: '13–14 años', height: '165–170', chest: '94–98' }
  ];

  function isKidsItem(item) {
    if (!item) return false;
    if (/^\d{1,2}-\d{1,2}$/.test(String(item.sizeRange || ''))) return true;
    return Array.isArray(item.flags) && item.flags.indexOf('kids') !== -1;
  }

  function sizeGuideRow(size) {
    var key = String(size || '').toUpperCase();
    for (var i = 0; i < KIDS_SIZE_GUIDE.length; i++) {
      if (KIDS_SIZE_GUIDE[i].size === key) return { kind: 'kids', row: KIDS_SIZE_GUIDE[i] };
    }
    for (var j = 0; j < ADULT_SIZE_GUIDE.length; j++) {
      if (ADULT_SIZE_GUIDE[j].size === key) return { kind: 'adult', row: ADULT_SIZE_GUIDE[j] };
    }
    return null;
  }

  function sizeFitHintText(size, item) {
    var match = sizeGuideRow(size);
    if (!match) return '';
    if (match.kind === 'kids') {
      return 'Talla ' + match.row.size + ' · Edad aprox. ' + match.row.age + ' · Altura ' + match.row.height + ' cm · Pecho ' + match.row.chest + ' cm';
    }
    var parts = ['Talla ' + match.row.size, 'Pecho ' + match.row.chest + ' cm', 'Largo ' + match.row.length + ' cm', 'Altura ' + match.row.height + ' cm'];
    if (item && Array.isArray(item.flags) && item.flags.indexOf('player') !== -1) {
      parts.push('Corte Player ajustado');
    }
    if (match.row.extra) {
      parts.push('Suplemento ' + match.row.extra);
    }
    return parts.join(' · ');
  }

  function cleanTitle(item) {
    if (!item || !item.title) return '';
    if (item._cleanTitle) return item._cleanTitle;
    var text = String(item.title)
      .replace(/T恤/g, ' Camiseta ')
      .replace(/Polo衫/gi, ' Polo ')
      .replace(/黑色/g, ' Negro ')
      .replace(/白色/g, ' Blanco ');

    text = text
      .replace(/^[A-Z]?\d{3,6}#\s*/i, '')
      .replace(/[-–—]?\s*[\u3040-\u30ff\u4e00-\u9fff]+[\w\u3040-\u30ff\u4e00-\u9fff-]*/g, ' ')
      .replace(/\b口\d+\b/g, ' ')
      .replace(/\bsize\s*:?\s*\d{1,2}\s*[-–]\s*\d{1,2}\b/ig, ' ')
      .replace(/\b(?:10|12|14|16|18|20|22|24|26|28|30)\s*[-–]\s*(?:10|12|14|16|18|20|22|24|26|28|30)\b/g, ' ')
      .replace(/\b(?:XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL)\s*[-–]\s*(?:XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL)\b/ig, ' ')
      .replace(/\b(?:two-stars|top quality|best quality|in stock|ready stock|1:1)\b/ig, ' ')
      .replace(/\b(2[0-9])(2[0-9])\b/g, function (full, a, b) {
        return parseInt(b, 10) === parseInt(a, 10) + 1 ? a + '/' + b : full;
      })
      .replace(/\bM-U\b/g, 'Manchester United')
      .replace(/\bGK-/ig, 'Portero ');

    var subTraining = item.subcategory && !/^Niños\s*·/i.test(item.subcategory) ? item.subcategory : 'Conjunto Entrenamiento';
    text = text
      .replace(/\bFull\s+Zip(?:per)?\s+Hooded\s+Windbreaker\s+Set\b/ig, 'Conjunto Cortavientos Capucha')
      .replace(/\bWindbreaker\s+Set\b/ig, 'Conjunto Cortavientos')
      .replace(/\bWindbreaker\b/ig, 'Cortavientos')
      .replace(/\bTraining\s+Suit\s+Set\b/ig, 'Chándal Entrenamiento')
      .replace(/\bTraining\s+Suit\b/ig, 'Chándal Entrenamiento')
      .replace(/\bTraining\s+Wear\b/ig, subTraining)
      .replace(/\bTracksuit\b/ig, 'Chándal')
      .replace(/\bPlayer\s+Version\b/ig, 'Versión Jugador')
      .replace(/\bLong[-\s]?Sleeved?\b/ig, 'Manga Larga')
      .replace(/\bLong\s+Sleeves\b/ig, 'Manga Larga')
      .replace(/\bShort[-\s]?Sleeved?\b/ig, 'Manga Corta')
      .replace(/\bWomen'?s\b/ig, 'Mujer')
      .replace(/\bKids\s+Kit\b/ig, 'Niños')
      .replace(/\bKids\b/ig, 'Niños')
      .replace(/\bGoalkeeper\b/ig, 'Portero')
      .replace(/\bSpecial\s+Edition\b/ig, 'Edición Especial')
      .replace(/\bAnniversary\s+Edition\b/ig, 'Edición Aniversario')
      .replace(/\bCommemorative\s+Edition\b/ig, 'Edición Conmemorativa')
      .replace(/\bThird\s+Away\b/ig, '3ª Equipación')
      .replace(/\bThird\b/ig, '3ª Equipación')
      .replace(/\bFourth\b/ig, '4ª Equipación')
      .replace(/\bHome\b/ig, '1ª Equipación')
      .replace(/\bAway\b/ig, '2ª Equipación')
      .replace(/\bRetro\s+Jersey\b/ig, 'Camiseta Retro')
      .replace(/\bBasketball\s+Jersey\b/ig, 'Camiseta Baloncesto')
      .replace(/\bBasketball\s+Shorts\b/ig, 'Pantalón Baloncesto')
      .replace(/\bStand\s+Collar\b/ig, 'Cuello Alto')
      .replace(/\bCotton[-\u2011\s]?padded\b/ig, 'Acolchada')
      .replace(/\bCotton\s+Gilet\b/ig, 'Chaleco Acolchado')
      .replace(/\bPuffer\b/ig, 'Plumas')
      .replace(/\bCrew\s*Neck\b/ig, 'Cuello Redondo')
      .replace(/\bFull[-\s]?Zip(?:per)?\b/ig, 'Cremallera Completa')
      .replace(/\bHalf[-\s]?Zip(?:per)?\b/ig, 'Media Cremallera')
      .replace(/\bSleeveless\b/ig, 'Sin Mangas')
      .replace(/\bTrack\s+Jacket\b/ig, 'Chaqueta Chándal')
      .replace(/\bSweatshirt\b/ig, 'Sudadera')
      .replace(/\bHoodie\b/ig, 'Sudadera Capucha')
      .replace(/\bHooded\b/ig, 'con Capucha')
      .replace(/\bPullover\b/ig, 'Jersey')
      .replace(/\bFleece\b/ig, 'Forro Polar')
      .replace(/\bT-Shirt\b/ig, 'Camiseta')
      .replace(/\bJersey\b/ig, 'Camiseta')
      .replace(/\bKit\b/ig, 'Equipación')
      .replace(/\bPOLO\b/g, 'Polo');

    text = text
      .replace(/\b(1ª|2ª|3ª|4ª)\s+Equipación\s+(?:([^·]+?)\s+)?Camiseta\s+Retro\b/gi, '$1 Equipación $2 Retro')
      .replace(/\b(1ª|2ª|3ª|4ª)\s+Equipación\s+(?:([^·]+?)\s+)?Camiseta\b/gi, '$1 Equipación $2')
      .replace(/\s*[-–—|]+\s*$/g, '')
      .replace(/^\s*[-–—|]+\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    item._cleanTitle = text || item.title;
    return item._cleanTitle;
  }

  var TEAM_NORMALIZE_MAP = {
    'rcd espanyol 26/27': 'Espanyol',
    'ca osasuna 26/27': 'Osasuna',
    'olympique de marseille 26/27': 'Olympique de Marsella',
    'olympique de marseille 125th': 'Olympique de Marsella',
    'olympique de marseille 09/10': 'Olympique de Marsella',
    'olympique de marseille 1998/99': 'Olympique de Marsella',
    'as monaco 26/27': 'Mónaco',
    'u.c sampdoria 26/27 samp': 'Sampdoria',
    'inte milan 24/25': 'Inter de Milán',
    'ac 13/14 milan': 'AC Milan',
    'ac 95/96': 'AC Milan',
    'girondins de bordeaux 96/97': 'Girondins de Burdeos',
    'palmeras+all sponsors+patches': 'Palmeiras',
    'newell old boy 93/94': "Newell's Old Boys",
    'c.d guadalajara 26/27': 'Chivas de Guadalajara',
    'atletico 25/26': 'Atlético de Madrid',
    'atlético 25/26': 'Atlético de Madrid',
    'ronaldo 25/26': 'Cristiano Ronaldo',
    'cd tenerife 26/27': 'CD Tenerife',
    'cd tenerife 25/26': 'CD Tenerife',
    'ceuta asociacion deportiva 98/00': 'AD Ceuta FC',
    'sunderlandl 05/06': 'Sunderland',
    'charlotte 26/27': 'Charlotte FC',
    'metz 03/04 red': 'FC Metz',
    'nk cotton gilet': 'NK',
    'nk cotton gilet ty': 'NK',
    'nk cotton-padded': 'NK',
    'nk cotton‑padded': 'NK',
    'ad cotton gilet ty': 'AD',
    'ad cotton-padded': 'AD',
    'ad cotton‑padded': 'AD',
    'ad archive collar engineered': 'AD',
    'tnf cotton gilet xs-2xl-509': 'TNF',
    'chinese new year tang-style': 'Otros',
    'oasis tour jacquard striped': 'Otros',
    'silicone team emblem 25/26': 'Otros',
    'ant 26/27 limited': 'Otros',
    'yakos 26/27': 'Otros',
    'ibrahimovic 25/26': 'Otros',
    'fernandez 93/94': 'Otros',
    'roman 00/01': 'Otros',
    'flc 99/00': 'Otros'
  };

  var TEAM_LEAGUE_FIX = {
    'Espanyol': 'LaLiga',
    'Osasuna': 'LaLiga',
    'CD Tenerife': 'LaLiga',
    'AD Ceuta FC': 'LaLiga',
    'Olympique de Marsella': 'Ligue 1',
    'Mónaco': 'Ligue 1',
    'Girondins de Burdeos': 'Ligue 1',
    'Inter de Milán': 'Serie A',
    'AC Milan': 'Serie A',
    'Sampdoria': 'Serie A',
    'Palmeiras': 'Brasileirão',
    "Newell's Old Boys": 'Liga Profesional',
    'Chivas de Guadalajara': 'Liga MX',
    'Atlético de Madrid': 'LaLiga',
    'Cristiano Ronaldo': 'Jugadores',
    'Otros': 'Otras ligas'
  };

  function normalizeCatalogItemTeam(item) {
    if (!item || !item.team) return;
    var raw = String(item.team).trim();
    var lower = raw.toLowerCase();
    var next = TEAM_NORMALIZE_MAP[lower];
    if (!next && /\s+\d{2,4}\/\d{2,4}$/.test(raw)) {
      next = raw.replace(/\s+\d{2,4}\/\d{2,4}$/, '').trim();
    }
    if (next && next !== raw) {
      item.team = next;
      if (TEAM_LEAGUE_FIX[next]) item.league = TEAM_LEAGUE_FIX[next];
    }
  }

  function itemBasePriceCents(item) {
    if (!window.KangPricing || !item) return 2500;
    return KangPricing.calculate(item, {}).basePriceCents;
  }

  function matchesPriceBand(item, band) {
    if (!band) return true;
    var cents = itemBasePriceCents(item);
    if (band === 'le25') return cents <= 2500;
    if (band === '26-45') return cents > 2500 && cents <= 4500;
    if (band === 'gt45') return cents > 4500;
    return true;
  }

  function formatDate(value) {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
    } catch (err) { return '—'; }
  }

  function loadCart() {
    try {
      var raw = localStorage.getItem(cartStorageKey);
      var parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (item) { return item && item.id && item.qty > 0; });
    } catch (err) { return []; }
  }

  function saveCart() {
    try { localStorage.setItem(cartStorageKey, JSON.stringify(state.cart)); } catch (err) {}
  }

  function loadFavorites() {
    try {
      var raw = localStorage.getItem(favsStorageKey);
      var parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.map(String).filter(Boolean);
    } catch (err) { return []; }
  }

  function saveFavorites() {
    try { localStorage.setItem(favsStorageKey, JSON.stringify(state.favorites)); } catch (err) {}
  }

  function isFavorite(id) {
    return state.favSet.has(String(id));
  }

  function loadOrders() {
    try {
      var raw = localStorage.getItem(ordersStorageKey);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
    } catch (err) { return []; }
  }

  function saveOrders() {
    try { localStorage.setItem(ordersStorageKey, JSON.stringify(state.orders.slice(0, 12))); } catch (err) {}
  }

  function loadCustomer() {
    try {
      var raw = localStorage.getItem(customerStorageKey);
      var parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') return { name: '', phone: '', email: '', city: '', notes: '' };
      return {
        name: String(parsed.name || ''),
        phone: String(parsed.phone || ''),
        email: String(parsed.email || ''),
        city: String(parsed.city || ''),
        notes: String(parsed.notes || '')
      };
    } catch (err) {
      return { name: '', phone: '', email: '', city: '', notes: '' };
    }
  }

  function saveCustomer(customer) {
    state.customer = {
      name: String(customer && customer.name || ''),
      phone: String(customer && customer.phone || ''),
      email: String(customer && customer.email || ''),
      city: String(customer && customer.city || ''),
      notes: String(customer && customer.notes || '')
    };
    try { localStorage.setItem(customerStorageKey, JSON.stringify(state.customer)); } catch (err) {}
  }

  function toast(message, type) {
    var region = $('#toast-region');
    if (!region) return;
    var el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' is-error' : '');
    el.innerHTML = '<svg><use href="#i-' + (type === 'error' ? 'close' : 'check') + '"/></svg><span>' + esc(message) + '</span>';
    region.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(function () { el.remove(); }, 250);
    }, 3200);
  }

  // ── Carga de datos ───────────────────────────────────────

  async function loadConfig() {
    try {
      var res = await fetch('/api/config', { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('config');
      state.config = await res.json();
    } catch (err) {
      state.config = { store: { name: 'KANG Team', whatsapp: '', email: '', instagram: '', yupoo: 'https://minkang.x.yupoo.com/categories/712891' } };
    }
    applyConfig();
  }

  async function loadTeamLogos() {
    try {
      var res = await fetch('/api/team-logos', { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return;
      var data = await res.json();
      var map = data && data.logos && typeof data.logos === 'object' ? data.logos : {};
      state.teamLogos = new Map(Object.keys(map).map(function (key) { return [key, map[key]]; }));
      if (!state.loading && state.items.length) {
        renderHeroMarquee();
        renderHomeTeams();
        renderTeamsView();
        if (state.route === 'catalog' && state.view === 'teams') renderCatalog();
      }
    } catch (err) {}
  }

  async function loadCatalog() {
    var res;
    try {
      res = await fetch('/api/catalog', { headers: { 'Accept': 'application/json' } });
    } catch (err) {
      renderLoadError('No se pudo conectar con el catálogo. Comprueba tu conexión e inténtalo de nuevo.');
      return;
    }
    if (res.status === 503) {
      renderSyncing();
      setTimeout(loadCatalog, 2500);
      return;
    }
    if (!res.ok) {
      renderLoadError('El catálogo no está disponible en este momento.');
      return;
    }

    var data = await res.json();
    state.catalog = data;
    state.items = Array.isArray(data.items) ? data.items : [];
    state.byId = new Map(state.items.map(function (item) { return [item.id, item]; }));
    buildFacets();
    state.loading = false;
    populateFilterOptions();
    renderHome();
    renderTeamsView();
    updateCartUI();
    updateSyncNote();
    if (state.route === 'catalog') {
      syncFilterInputs();
      renderCatalog();
    }
  }

  function buildFacets() {
    state.teams.clear();
    state.leagues.clear();
    state.seasons.clear();
    state.types.clear();

    state.items.forEach(function (item) {
      item.collection = item.collection || 'equipaciones';
      item.source = item.source || 'minkang';
      normalizeCatalogItemTeam(item);
      var display = cleanTitle(item);
      item._search = normalize([item.team, item.title, display, item.season, item.league, typeLabel(item.type), item.subcategory, DEPARTMENT_LABELS[item.department] || ''].join(' '));
      var team = state.teams.get(item.team);
      if (!team) {
        team = { name: item.team, league: item.league || 'Otras ligas', count: 0, seasons: new Map(), cover: item.cover, sample: item };
        state.teams.set(item.team, team);
      }
      team.count += 1;
      team.seasons.set(item.seasonGroup, (team.seasons.get(item.seasonGroup) || 0) + 1);
      if (!team.cover) team.cover = item.cover;

      state.leagues.set(team.league, (state.leagues.get(team.league) || 0) + 1);
      state.seasons.set(item.seasonGroup, (state.seasons.get(item.seasonGroup) || 0) + 1);
      state.types.set(item.type, (state.types.get(item.type) || 0) + 1);
    });
  }

  function applyConfig() {
    var store = state.config && state.config.store ? state.config.store : {};
    var name = store.name || 'KANG Team';
    document.title = name + ' · Catálogo de camisetas, chándals y equipaciones';

    var waNumber = (store.whatsapp || '').replace(/\D/g, '');
    var waHref = waNumber ? 'https://wa.me/' + waNumber : 'https://wa.me/';
    ['cta-whatsapp', 'contact-whatsapp', 'footer-whatsapp'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.href = waHref;
    });
    var email = store.email || '';
    ['contact-email', 'footer-email'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        if (email) el.href = 'mailto:' + email;
        else el.href = '#/como-funciona';
      }
    });

    var social = $('#footer-social');
    if (social) {
      var html = '';
      if (waNumber) html += '<a href="' + waHref + '" target="_blank" rel="noopener" aria-label="WhatsApp"><svg><use href="#i-whatsapp"/></svg></a>';
      if (email) html += '<a href="mailto:' + esc(email) + '" aria-label="Email"><svg><use href="#i-mail"/></svg></a>';
      if (store.instagram) html += '<a href="https://instagram.com/' + esc(store.instagram.replace(/^@/, '')) + '" target="_blank" rel="noopener" aria-label="Instagram"><svg><use href="#i-instagram"/></svg></a>';
      html += '<a href="https://minkang.x.yupoo.com/categories/712891" target="_blank" rel="noopener" aria-label="Yupoo"><svg><use href="#i-arrow"/></svg></a>';
      social.innerHTML = html;
    }

    if (store.name && store.name !== 'KANG Team') {
      $$('.brand-word').forEach(function (el) {
        var parts = store.name.trim().split(/\s+/);
        var last = parts.pop();
        el.innerHTML = esc(parts.join(' ')) + (parts.length ? ' ' : '') + '<span>' + esc(last.toUpperCase()) + '</span>';
      });
    }
  }

  function updateSyncNote() {
    var note = $('#sync-note');
    if (!note) return;
    var updated = state.catalog && state.catalog.meta ? state.catalog.meta.generatedAt : null;
    note.textContent = updated ? 'Catálogo actualizado · ' + formatDate(updated) : 'Catálogo sincronizado';
  }

  function renderSyncing() {
    var home = $('#view-home');
    if (home && !home.hidden) {
      var total = $('#stat-total');
      if (total) total.textContent = '…';
    }
    var results = $('#catalog-results');
    if (results && !$('#view-catalog').hidden) {
      results.innerHTML = '<div class="empty-state"><svg><use href="#i-spark"/></svg><h3>Sincronizando catálogo</h3><p>Estamos descargando las últimas prendas de Yupoo. Tardará unos segundos.</p></div>';
    }
  }

  function renderLoadError(message) {
    var region = $('#catalog-results');
    if (region) {
      region.innerHTML = '<div class="empty-state"><svg><use href="#i-close"/></svg><h3>No se pudo cargar el catálogo</h3><p>' + esc(message) + '</p><button class="btn btn-primary" type="button" onclick="location.reload()">Reintentar</button></div>';
    }
    toast(message, 'error');
  }

  // ── Enrutado ─────────────────────────────────────────────

  function parseRoute() {
    var hash = location.hash.replace(/^#/, '') || '/';
    var parts = hash.split('?');
    var path = parts[0] || '/';
    if (path.length > 1 && path.charAt(path.length - 1) === '/') path = path.slice(0, -1);
    return { path: path, params: new URLSearchParams(parts[1] || '') };
  }

  function renderPrices() {
    var target = $('#prices-content');
    if (!target || !window.KangPricing) return;
    target.innerHTML = KangPricing.groups.map(function (group, index) {
      return '<article class="price-card">' +
        '<div class="price-card-head"><span>PRECIOS KANG TEAM</span><span>' + String(index + 1).padStart(2, '0') + '</span></div>' +
        '<h2>' + esc(group.title) + '</h2><ul>' + group.items.map(function (entry) {
        return '<li><span>' + esc(entry[0]) + '</span><strong>' + esc(KangPricing.money(entry[1])) + '</strong></li>';
      }).join('') + '</ul></article>';
    }).join('');
  }

  function linePricing(line, item) {
    return KangPricing.calculate(item, line);
  }

  function cartPriceCents() {
    return state.cart.reduce(function (sum, line) { var item = state.byId.get(line.id); return sum + (item ? linePricing(line, item).unitPriceCents * (parseInt(line.qty,10)||0) : 0); }, 0);
  }

  function navigate(path) {
    if (('#' + path) === location.hash) renderRoute(true);
    else location.hash = path;
  }

  function renderRoute(scroll) {
    var route = parseRoute();
    var isProductRoute = route.path.indexOf('/producto/') === 0;
    var routeKeys = { '/': 'home', '/catalogo': 'catalog', '/equipos': 'teams', '/como-funciona': 'how', '/precios': 'prices' };
    state.route = isProductRoute ? (state.route || 'catalog') : (routeKeys[route.path] || 'home');

    if (!isProductRoute) {
      state.lastListHash = location.hash || '#/';
    }

    $$('.view').forEach(function (view) { view.hidden = true; });
    var navKey = 'home';
    var viewId = 'view-home';

    if (route.path === '/catalogo') {
      viewId = 'view-catalog';
      navKey = route.params.get('coleccion') === 'primavera-invierno' ? 'seasonal' : 'catalog';
      state.filters = {
        q: route.params.get('q') || '',
        team: route.params.get('equipo') || '',
        league: route.params.get('liga') || '',
        season: route.params.get('temporada') || '',
        type: route.params.get('tipo') || '',
        collection: route.params.get('coleccion') || '',
        department: route.params.get('uso') || '',
        subcategory: route.params.get('subcategoria') || '',
        flag: route.params.get('extra') || '',
        price: route.params.get('precio') || '',
        favs: route.params.get('favoritos') || ''
      };
      var sortParam = route.params.get('orden');
      if (sortParam && ['new', 'price-asc', 'price-desc', 'team', 'season', 'name'].indexOf(sortParam) !== -1) {
        state.sort = sortParam;
      }
      state.view = (route.params.get('vista') === 'grid' || !!route.params.get('equipo') || !!state.filters.favs || !!state.filters.price) ? 'grid' : 'teams';
      state.groupPage = 1;
      state.gridPage = 1;
      if (state.items.length) {
        syncFilterInputs();
        renderCatalog();
      }
      updateCatalogIntro();
      if (route.params.get('focus') === 'search') {
        setTimeout(function () { var input = $('#catalog-search'); if (input) input.focus(); }, 90);
      }
    } else if (route.path === '/equipos') {
      viewId = 'view-teams';
      navKey = 'teams';
      if (state.items.length) renderTeamsView();
    } else if (route.path === '/como-funciona') {
      viewId = 'view-how';
      navKey = 'how';
    } else if (route.path === '/precios') {
      viewId = 'view-prices';
      navKey = 'prices';
      renderPrices();
    } else if (isProductRoute) {
      viewId = state.route === 'catalog' ? 'view-catalog' : 'view-home';
      navKey = state.route === 'catalog' ? 'catalog' : 'home';
      if (state.route === 'catalog' && state.items.length) {
        syncFilterInputs();
        renderCatalog();
      }
    }

    var view = document.getElementById(viewId);
    if (view) view.hidden = false;

    $$('[data-nav]').forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('data-nav') === navKey);
    });

    if (isProductRoute && state.items.length) {
      var productId = decodeURIComponent(route.path.slice('/producto/'.length));
      if (!state.product || String(state.product.id) !== String(productId) || !$('#product-modal').classList.contains('is-open')) {
        openProduct(productId, { skipHash: true });
      }
    }

    if (scroll && !isProductRoute) {
      try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (err) { window.scrollTo(0, 0); }
    }
  }

  function updateCatalogHash() {
    if (state.route !== 'catalog') return;
    if (location.hash.indexOf('#/producto/') === 0) return;
    var params = new URLSearchParams();
    if (state.filters.q) params.set('q', state.filters.q);
    if (state.filters.team) params.set('equipo', state.filters.team);
    if (state.filters.league) params.set('liga', state.filters.league);
    if (state.filters.season) params.set('temporada', state.filters.season);
    if (state.filters.type) params.set('tipo', state.filters.type);
    if (state.filters.collection) params.set('coleccion', state.filters.collection);
    if (state.filters.department) params.set('uso', state.filters.department);
    if (state.filters.subcategory) params.set('subcategoria', state.filters.subcategory);
    if (state.filters.flag) params.set('extra', state.filters.flag);
    if (state.filters.price) params.set('precio', state.filters.price);
    if (state.filters.favs) params.set('favoritos', state.filters.favs);
    if (state.sort && state.sort !== 'new') params.set('orden', state.sort);
    if (state.view === 'grid') params.set('vista', 'grid');
    var query = params.toString();
    var nextHash = '#/catalogo' + (query ? '?' + query : '');
    state.lastListHash = nextHash;
    try {
      history.replaceState(null, '', nextHash);
    } catch (err) {}
  }

  function updateCatalogIntro() {
    var isSeasonal = state.filters.collection === 'primavera-invierno';
    var eyebrow = $('#catalog-eyebrow');
    var title = $('#catalog-title');
    var lead = $('#catalog-lead');
    if (eyebrow) eyebrow.textContent = isSeasonal ? 'Colección GXG' : 'Catálogo completo';
    if (title) title.innerHTML = isSeasonal ? 'Ropa de<br><em>primavera / invierno.</em>' : 'Toda la colección,<br><em>equipo a equipo.</em>';
    if (lead) lead.textContent = isSeasonal
      ? 'Ropa de entrenamiento y paseo para adultos y niños. Filtra por tipo de prenda, cierre y equipo.'
      : 'Camisetas, chándals, chaquetas y más. Filtra por equipo y temporada y encuentra tu próxima prenda.';
  }

  // ── Inicio ───────────────────────────────────────────────

  function renderHome() {
    if (!state.items.length) return;

    var total = $('#stat-total');
    var teams = $('#stat-teams');
    if (total) total.textContent = fmt(state.items.length);
    if (teams) teams.textContent = fmt(state.teams.size);

    renderHero();
    renderHomeSeasons();
    renderHomeNew();
    renderHomeTeams();
    startPreviewLoop();
  }

  function renderHero() {
    var collage = $('#hero-collage');
    var feature = $('#hero-feature');
    var marquee = $('#marquee-track');

    var withCover = state.items.filter(function (item) { return item.cover; });
    var chosen = withCover.slice(0, 42);
    if (collage) {
      var html = '';
      for (var col = 0; col < 3; col++) {
        var slice = chosen.filter(function (_, index) { return index % 3 === col; }).slice(0, 14);
        var doubled = slice.concat(slice);
        html += '<div class="hero-strip">' + doubled.map(function (item, index) {
          return '<div class="hero-shot">' + imgTag(coverUrl(item, 'small'), item.title, { eager: col === 0 && index < 3 }) + '</div>';
        }).join('') + '</div>';
      }
      collage.innerHTML = html;
    }

    if (feature) {
      var heroItem = chosen.filter(function (item) { return item.custom && item.seasonGroup === '26/27'; })[0] || chosen[0];
      if (heroItem) {
        var heroTitle = cleanTitle(heroItem);
        var heroPrice = window.KangPricing ? KangPricing.money(itemBasePriceCents(heroItem)) : '';
        feature.innerHTML = '<div class="hero-feature-card">' +
          '<div class="hero-badge">NUEVO<span>26/27</span></div>' +
          '<div class="hero-feature-img">' + imgTag(coverUrl(heroItem, 'medium'), heroTitle, { eager: true }) + '</div>' +
          '<div class="hero-feature-meta"><div><span>' + esc(heroItem.team) + ' · ' + esc(heroItem.season) + (heroPrice ? ' · ' + esc(heroPrice) : '') + '</span><strong>' + esc(heroTitle) + '</strong></div><svg><use href="#i-arrow"/></svg></div>' +
          '</div>';
        feature.style.cursor = 'pointer';
        feature.onclick = function () { openProduct(heroItem.id); };
      }
    }

    renderHeroMarquee();
  }

  function renderHeroMarquee() {
    var marquee = $('#marquee-track');
    if (!marquee || !state.teams.size) return;
    var topTeams = Array.from(state.teams.values()).filter(function (team) { return team.name !== 'Otros'; }).sort(function (a, b) { return b.count - a.count; }).slice(0, 16);
    var items = topTeams.concat(topTeams);
    marquee.innerHTML = items.map(function (team) {
      var logo = teamLogoUrl(team.name);
      var fallback = coverUrl(team.sample, 'square');
      var src = logo || fallback;
      var cls = logo ? ' class="is-crest"' : '';
      return '<button type="button" class="marquee-item" data-team-link="' + esc(team.name) + '"><img' + cls + ' src="' + esc(src) + '" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.classList.remove(\'is-crest\');this.src=\'' + esc(fallback) + '\'">' + esc(team.name) + '</button>';
    }).join('');
  }

  function renderHomeSeasons() {
    var container = $('#home-seasons');
    if (!container) return;

    var current = state.items.filter(function (item) { return item.seasonGroup === '26/27'; });
    var previous = state.items.filter(function (item) { return item.seasonGroup === '25/26'; });
    var retro = state.items.filter(function (item) { return item.seasonGroup === 'Retro'; });
    var nations = state.items.filter(function (item) { return item.league === 'Selecciones'; });

    var cards = [
      { key: '26/27', label: '26/27', sub: 'Nueva temporada', count: current.length, img: current[0] },
      { key: '25/26', label: '25/26', sub: 'Temporada anterior', count: previous.length, img: previous[0] },
      { key: 'Retro', label: 'Retro', sub: 'Clásicas de siempre', count: retro.length, img: retro[0] },
      { key: 'Selecciones', label: 'Selecciones', sub: 'Mundial 2026', count: nations.length, img: nations[0], league: true }
    ];

    container.innerHTML = cards.map(function (card) {
      var href = card.league ? '#/catalogo?liga=Selecciones' : '#/catalogo?temporada=' + enc(card.key);
      return '<a class="season-card" href="' + href + '">' +
        (card.img ? imgTag(coverUrl(card.img, 'medium'), card.sub) : '') +
        '<div class="season-card-body"><small>' + esc(card.sub) + '</small><strong>' + esc(card.label) + '</strong><span>' + fmt(card.count) + ' prendas <svg><use href="#i-arrow"/></svg></span></div>' +
        '</a>';
    }).join('');
  }

  function renderHomeNew() {
    var container = $('#home-new');
    if (!container) return;
    var items = state.items.filter(function (item) {
      return item.seasonGroup === '26/27' && item.custom;
    }).slice(0, 12);
    if (!items.length) items = state.items.slice(0, 12);
    container.innerHTML = items.map(productCard).join('');
  }

  function renderHomeTeams() {
    var container = $('#home-teams');
    if (!container) return;
    var teams = Array.from(state.teams.values())
      .filter(function (team) { return team.name !== 'Otros' && team.count > 0; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 12);
    container.innerHTML = teams.map(teamCard).join('');
  }

  function productCard(item) {
    var badges = '';
    if (item.custom) badges += '<span class="badge badge-volt">Personalizable</span>';
    if (item.flags && item.flags.indexOf('retro') !== -1) badges += '<span class="badge badge-light">Retro</span>';
    if (item.flags && item.flags.indexOf('kids') !== -1) badges += '<span class="badge">Niños</span>';

    var title = cleanTitle(item);
    var baseCents = itemBasePriceCents(item);
    var priceText = window.KangPricing ? KangPricing.money(baseCents) : '';
    var hasSpecialSize = /(?:3XL|4XL)/.test(String(item.sizeRange || ''));
    var priceMeta = item.custom
      ? '+2 € nombre/dorsal · +1 € parche'
      : (hasSpecialSize ? '3XL/4XL +3 €' : 'Tallas ' + (item.sizeRange || 'S-2XL'));

    var favActive = isFavorite(item.id);
    return '<article class="card" data-product="' + esc(item.id) + '">' +
      '<div class="card-media">' +
        '<button class="card-open" type="button" aria-label="Ver ' + esc(title) + '"></button>' +
        imgTag(coverUrl(item, 'small'), title) +
        '<div class="card-badges" aria-hidden="true">' + badges + '</div>' +
        '<button class="card-fav' + (favActive ? ' is-active' : '') + '" type="button" data-fav-toggle="' + esc(item.id) + '" aria-pressed="' + favActive + '" aria-label="' + (favActive ? 'Quitar de favoritos ' : 'Guardar en favoritos ') + esc(title) + '"><svg><use href="#i-heart"/></svg></button>' +
        '<button class="card-quick" type="button" aria-label="Ver y personalizar ' + esc(title) + '"><svg><use href="#i-plus"/></svg></button>' +
      '</div>' +
      '<div class="card-body">' +
        '<div class="card-kicker"><span>' + esc(item.team) + '</span><span>' + esc(item.season) + '</span></div>' +
        '<h3 class="card-title" title="' + esc(item.title) + '">' + esc(title) + '</h3>' +
        (priceText ? '<div class="card-price-row"><strong class="card-price">' + esc(priceText) + '</strong><span class="card-price-note">' + esc(priceMeta) + '</span></div>' : '') +
        '<div class="card-foot"><span class="type-label">' + esc(item.subcategory || typeLabel(item.type)) + '</span>' +
          (item.custom ? '<span class="custom-label"><svg><use href="#i-shirt"/></svg> Nombre + dorsal</span>' : '<span class="custom-label">' + esc(item.sizeRange) + '</span>') +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function teamCard(team) {
    var topSeasons = Array.from(team.seasons.keys()).sort(function (a, b) {
      return SEASON_ORDER.indexOf(a) - SEASON_ORDER.indexOf(b);
    }).slice(0, 2).map(seasonLabel).join(' · ');
    return '<a class="team-card" href="#/catalogo?equipo=' + enc(team.name) + '">' +
      teamMono(team.name) +
      '<div class="team-card-copy"><strong>' + esc(team.name) + '</strong><span>' + fmt(team.count) + ' prendas · ' + esc(topSeasons) + '</span></div>' +
      '<svg class="team-card-arrow"><use href="#i-arrow"/></svg>' +
      '</a>';
  }

  function startPreviewLoop() {
    if (state.previewTimer) return;
    var names = ['TU NOMBRE', 'MBAPPÉ', 'VINICIUS', 'BELLINGHAM', 'LAMINE'];
    var numbers = ['10', '9', '7', '5', '19'];
    var index = 0;
    state.previewTimer = setInterval(function () {
      if (state.route !== 'home') return;
      index = (index + 1) % names.length;
      var nameEl = $('#preview-name');
      var numberEl = $('#preview-number');
      if (nameEl) nameEl.textContent = names[index];
      if (numberEl) numberEl.textContent = numbers[index];
    }, 3200);
  }

  // ── Equipos ──────────────────────────────────────────────

  function populateTeamsLeague() {
    var select = $('#teams-league');
    if (!select) return;
    var current = select.value;
    var leagues = Array.from(state.leagues.entries()).sort(function (a, b) { return b[1] - a[1]; });
    select.innerHTML = '<option value="">Todas las ligas</option>' + leagues.map(function (row) {
      return '<option value="' + esc(row[0]) + '">' + esc(row[0]) + ' (' + fmt(row[1]) + ')</option>';
    }).join('');
    select.value = current;
  }

  function renderTeamsView() {
    if (!state.items.length) return;
    populateTeamsLeague();
    var container = $('#teams-results');
    if (!container) return;

    var query = normalize($('#teams-search') ? $('#teams-search').value : '');
    var league = $('#teams-league') ? $('#teams-league').value : '';
    var teams = Array.from(state.teams.values()).filter(function (team) {
      if (league && team.league !== league) return false;
      if (query && normalize(team.name + ' ' + team.league).indexOf(query) === -1) return false;
      return true;
    });

    if (!teams.length) {
      container.innerHTML = '<div class="empty-state"><svg><use href="#i-search"/></svg><h3>Sin equipos</h3><p>No encontramos equipos con esa búsqueda.</p></div>';
      return;
    }

    var grouped = {};
    teams.forEach(function (team) {
      if (!grouped[team.league]) grouped[team.league] = [];
      grouped[team.league].push(team);
    });

    var leagueNames = Object.keys(grouped).sort(function (a, b) {
      return grouped[b].length - grouped[a].length;
    });
    if (leagueNames.indexOf('Selecciones') !== -1) {
      leagueNames = ['Selecciones'].concat(leagueNames.filter(function (name) { return name !== 'Selecciones'; }));
    }

    container.innerHTML = leagueNames.map(function (name) {
      var list = grouped[name].sort(function (a, b) { return b.count - a.count; });
      var total = list.reduce(function (sum, team) { return sum + team.count; }, 0);
      return '<section class="league-block">' +
        '<div class="league-block-head"><h2>' + esc(name) + '</h2><span>' + fmt(list.length) + ' equipos · ' + fmt(total) + ' prendas</span></div>' +
        '<div class="team-grid">' + list.map(teamCard).join('') + '</div>' +
        '</section>';
    }).join('');
  }

  // ── Catálogo ─────────────────────────────────────────────

  var PAGE_GRID = 24;
  var PAGE_TEAMS = 6;

  function seasonRank(item) {
    var rank = SEASON_ORDER.indexOf(item.seasonGroup);
    return rank === -1 ? SEASON_ORDER.length : rank;
  }

  function getFilteredItems() {
    var q = normalize(state.filters.q);
    var team = state.filters.team;
    var league = state.filters.league;
    var season = state.filters.season;
    var type = state.filters.type;
    var collection = state.filters.collection;
    var department = state.filters.department;
    var subcategory = state.filters.subcategory;
    var flag = state.filters.flag;
    var price = state.filters.price;
    var onlyFavs = state.filters.favs === '1';

    var items = state.items.filter(function (item) {
      if (onlyFavs && !isFavorite(item.id)) return false;
      if (team && item.team !== team) return false;
      if (league && item.league !== league) return false;
      if (season && item.seasonGroup !== season) return false;
      if (type && item.type !== type) return false;
      if (collection && item.collection !== collection) return false;
      if (department && item.department !== department) return false;
      if (subcategory && item.subcategory !== subcategory) return false;
      if (flag && (!Array.isArray(item.flags) || item.flags.indexOf(flag) === -1)) return false;
      if (price && !matchesPriceBand(item, price)) return false;
      if (q && item._search.indexOf(q) === -1) return false;
      return true;
    });

    return sortItems(items);
  }

  function sortItems(list) {
    var items = list.slice();
    if (state.sort === 'price-asc') {
      items.sort(function (a, b) {
        return itemBasePriceCents(a) - itemBasePriceCents(b) ||
          (Number(b.seasonSort) || 0) - (Number(a.seasonSort) || 0) ||
          a.title.localeCompare(b.title, 'es');
      });
    } else if (state.sort === 'price-desc') {
      items.sort(function (a, b) {
        return itemBasePriceCents(b) - itemBasePriceCents(a) ||
          (Number(b.seasonSort) || 0) - (Number(a.seasonSort) || 0) ||
          a.title.localeCompare(b.title, 'es');
      });
    } else if (state.sort === 'team') {
      items.sort(function (a, b) {
        return a.team.localeCompare(b.team, 'es') ||
          seasonRank(a) - seasonRank(b) ||
          a.title.localeCompare(b.title, 'es');
      });
    } else if (state.sort === 'season') {
      items.sort(function (a, b) {
        return (Number(b.seasonSort) || 0) - (Number(a.seasonSort) || 0) ||
          a.team.localeCompare(b.team, 'es') ||
          a.title.localeCompare(b.title, 'es');
      });
    } else if (state.sort === 'name') {
      items.sort(function (a, b) { return a.title.localeCompare(b.title, 'es'); });
    }
    return items;
  }

  function catalogHref(filters, view) {
    var params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.team) params.set('equipo', filters.team);
    if (filters.league) params.set('liga', filters.league);
    if (filters.season) params.set('temporada', filters.season);
    if (filters.type) params.set('tipo', filters.type);
    if (filters.collection) params.set('coleccion', filters.collection);
    if (filters.department) params.set('uso', filters.department);
    if (filters.subcategory) params.set('subcategoria', filters.subcategory);
    if (filters.flag) params.set('extra', filters.flag);
    if (filters.price) params.set('precio', filters.price);
    if (filters.favs) params.set('favoritos', filters.favs);
    if (view === 'grid') params.set('vista', 'grid');
    var query = params.toString();
    return '#/catalogo' + (query ? '?' + query : '');
  }

  function groupByTeam(items) {
    var map = new Map();
    items.forEach(function (item) {
      var group = map.get(item.team);
      if (!group) {
        group = { name: item.team, league: item.league || 'Otras ligas', items: [], seasons: new Map(), cover: item.cover };
        map.set(item.team, group);
      }
      group.items.push(item);
      group.seasons.set(item.seasonGroup, (group.seasons.get(item.seasonGroup) || 0) + 1);
      if (!group.cover) group.cover = item.cover;
    });

    var groups = Array.from(map.values());
    groups.forEach(function (group) {
      group.items.sort(function (a, b) {
        if (state.sort === 'price-asc') return itemBasePriceCents(a) - itemBasePriceCents(b) || (Number(b.seasonSort) || 0) - (Number(a.seasonSort) || 0);
        if (state.sort === 'price-desc') return itemBasePriceCents(b) - itemBasePriceCents(a) || (Number(b.seasonSort) || 0) - (Number(a.seasonSort) || 0);
        return (Number(b.seasonSort) || 0) - (Number(a.seasonSort) || 0) || a.title.localeCompare(b.title, 'es');
      });
    });

    groups.sort(function (a, b) {
      if (state.sort === 'team') return a.name.localeCompare(b.name, 'es');
      return b.items.length - a.items.length || a.name.localeCompare(b.name, 'es');
    });
    return groups;
  }

  function renderQuickFilters() {
    var container = $('#quick-filters');
    if (!container) return;
    var favCount = state.favorites.length;
    var chips = [];
    chips.push('<button type="button" class="quick-chip is-fav' + (state.filters.favs === '1' ? ' is-active' : '') + '" data-quick-fav aria-pressed="' + (state.filters.favs === '1') + '"><svg><use href="#i-heart"/></svg>Favoritos' + (favCount ? ' (' + favCount + ')' : '') + '</button>');
    [
      ['kids', 'Niños'],
      ['women', 'Mujer'],
      ['retro', 'Retro'],
      ['player', 'Player']
    ].forEach(function (entry) {
      var active = state.filters.flag === entry[0];
      chips.push('<button type="button" class="quick-chip' + (active ? ' is-active' : '') + '" data-quick-flag="' + entry[0] + '" aria-pressed="' + active + '">' + entry[1] + '</button>');
    });
    chips.push('<span class="quick-chip-sep" aria-hidden="true"></span>');
    [
      ['le25', '≤ 25 €'],
      ['26-45', '26 – 45 €'],
      ['gt45', '+45 €']
    ].forEach(function (entry) {
      var active = state.filters.price === entry[0];
      chips.push('<button type="button" class="quick-chip' + (active ? ' is-active' : '') + '" data-quick-price="' + entry[0] + '" aria-pressed="' + active + '">' + entry[1] + '</button>');
    });
    container.innerHTML = chips.join('');
  }

  function renderCatalog() {
    if (!state.items.length) return;
    var results = $('#catalog-results');
    if (!results) return;

    var items = getFilteredItems();
    var useGrid = state.view === 'grid' || !!state.filters.team || !!state.filters.favs || !!state.filters.price || state.sort === 'price-asc' || state.sort === 'price-desc';

    renderQuickFilters();
    renderActiveFilters();
    updateFilterCount();

    if (!items.length) {
      results.innerHTML = '<div class="empty-state">' +
        '<svg><use href="#i-search"/></svg>' +
        '<h3>Sin resultados</h3>' +
        '<p>No encontramos prendas con esos filtros. Prueba a quitar alguno o busca otro equipo.</p>' +
        '<button class="btn btn-primary" type="button" data-clear-all>Limpiar filtros</button>' +
        '</div>';
      var emptyCount = $('#results-count');
      if (emptyCount) emptyCount.innerHTML = 'Sin resultados';
      setLoadMore(false);
      return;
    }

    if (useGrid) renderGrid(items);
    else renderGroups(items);

    updateCatalogHash();
  }

  function renderGrid(items) {
    var shown = Math.min(items.length, state.gridPage * PAGE_GRID);
    var results = $('#catalog-results');
    if (results) {
      results.innerHTML = '<h2 class="sr-only">Resultados del catálogo</h2>' +
        '<div class="product-grid">' + items.slice(0, shown).map(productCard).join('') + '</div>';
    }
    var count = $('#results-count');
    if (count) {
      count.innerHTML = 'Mostrando <strong>' + fmt(shown) + '</strong> de <strong>' + fmt(items.length) + '</strong> prendas';
    }
    setLoadMore(shown < items.length, 'Cargar más prendas', items.length - shown);
  }

  function renderGroups(items) {
    var groups = groupByTeam(items);
    var shown = Math.min(groups.length, state.groupPage * PAGE_TEAMS);
    var results = $('#catalog-results');
    if (results) {
      results.innerHTML = groups.slice(0, shown).map(teamGroupSection).join('');
    }
    var count = $('#results-count');
    if (count) {
      count.innerHTML = 'Mostrando <strong>' + fmt(shown) + '</strong> de <strong>' + fmt(groups.length) + '</strong> equipos · <strong>' + fmt(items.length) + '</strong> prendas';
    }
    setLoadMore(shown < groups.length, 'Cargar más equipos', groups.length - shown);
  }

  function teamGroupSection(group) {
    var seasons = Array.from(group.seasons.keys())
      .sort(function (a, b) { return SEASON_ORDER.indexOf(a) - SEASON_ORDER.indexOf(b); })
      .slice(0, 3);
    var preview = group.items.slice(0, 8);
    var filters = Object.assign({}, state.filters, { team: group.name });
    var href = catalogHref(filters, 'grid');

    return '<section class="team-group">' +
      '<div class="team-group-head">' +
        '<div class="team-group-title">' + teamMono(group.name) +
          '<div><h2>' + esc(group.name) + '</h2>' +
          '<p>' + fmt(group.items.length) + ' prendas · ' + esc(group.league) + '</p></div>' +
        '</div>' +
        '<div class="team-group-actions">' +
          '<div class="season-tags">' + seasons.map(function (season) {
            return '<span class="season-tag">' + esc(seasonLabel(season)) + '</span>';
          }).join('') + '</div>' +
          '<a href="' + esc(href) + '">Ver todo <svg><use href="#i-arrow"/></svg></a>' +
        '</div>' +
      '</div>' +
      '<div class="rail">' + preview.map(productCard).join('') + '</div>' +
    '</section>';
  }

  function setLoadMore(visible, label, remaining) {
    var wrap = $('#load-more-wrap');
    if (!wrap) return;
    wrap.hidden = !visible;
    if (!visible) return;
    var button = $('#load-more');
    if (button) {
      button.innerHTML = esc(label || 'Cargar más') + ' <span id="load-more-count">' + fmt(remaining || 0) + '</span>';
    }
  }

  function loadMoreResults() {
    if (state.view === 'grid' || state.filters.team) state.gridPage += 1;
    else state.groupPage += 1;
    renderCatalog();
  }

  function setView(view) {
    state.view = view === 'grid' ? 'grid' : 'teams';
    if (state.view === 'teams') state.filters.team = '';
    state.gridPage = 1;
    state.groupPage = 1;
    syncFilterInputs();
    renderCatalog();
    updateCatalogHash();
    updateCatalogIntro();
  }

  function activeFilterCount() {
    return ['q', 'team', 'league', 'season', 'type', 'collection', 'department', 'subcategory', 'flag', 'price', 'favs'].filter(function (key) {
      return !!state.filters[key];
    }).length;
  }

  function updateFilterCount() {
    var count = activeFilterCount();
    var badge = $('#filter-count');
    if (badge) {
      badge.textContent = String(count);
      badge.style.display = count ? '' : 'none';
    }
  }

  function renderActiveFilters() {
    var container = $('#active-filters');
    if (!container) return;

    var chips = [];
    function chip(key, label) {
      return '<span class="filter-chip">' + esc(label) +
        '<button type="button" data-clear-filter="' + key + '" aria-label="Quitar filtro ' + esc(label) + '">' +
        '<svg><use href="#i-close"/></svg></button></span>';
    }

    if (state.filters.q) chips.push(chip('q', 'Búsqueda: ' + state.filters.q));
    if (state.filters.team) chips.push(chip('team', 'Equipo: ' + state.filters.team));
    if (state.filters.league) chips.push(chip('league', 'Liga: ' + state.filters.league));
    if (state.filters.season) chips.push(chip('season', 'Temporada: ' + seasonLabel(state.filters.season)));
    if (state.filters.type) chips.push(chip('type', 'Tipo: ' + typeLabel(state.filters.type)));
    if (state.filters.collection) chips.push(chip('collection', 'Colección: ' + (COLLECTION_LABELS[state.filters.collection] || state.filters.collection)));
    if (state.filters.department) chips.push(chip('department', 'Uso: ' + (DEPARTMENT_LABELS[state.filters.department] || state.filters.department)));
    if (state.filters.subcategory) chips.push(chip('subcategory', state.filters.subcategory));
    if (state.filters.flag) chips.push(chip('flag', 'Extra: ' + flagLabel(state.filters.flag)));
    if (state.filters.price) chips.push(chip('price', 'Precio: ' + (PRICE_BAND_LABELS[state.filters.price] || state.filters.price)));
    if (state.filters.favs) chips.push(chip('favs', 'Solo favoritos'));

    if (!chips.length) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = chips.join('') +
      '<button type="button" class="filter-chip" data-clear-all>Limpiar todo</button>';
  }

  function applyFilters(patch) {
    patch = patch || {};
    var previousCollection = state.filters.collection;
    Object.keys(patch).forEach(function (key) {
      if (key in state.filters) state.filters[key] = String(patch[key] || '').trim();
    });

    if ('collection' in patch && state.filters.collection !== previousCollection) {
      state.filters.department = '';
      state.filters.subcategory = '';
    }

    if ('league' in patch && state.filters.team) {
      var team = state.teams.get(state.filters.team);
      if (team && team.league !== state.filters.league) state.filters.team = '';
    }
    if ('team' in patch && state.filters.team) state.view = 'grid';
    if (('flag' in patch && state.filters.flag) || ('price' in patch && state.filters.price) || ('favs' in patch && state.filters.favs)) {
      state.view = 'grid';
    }

    state.gridPage = 1;
    state.groupPage = 1;
    syncFilterInputs();
    renderCatalog();
    updateCatalogHash();
    updateCatalogIntro();
  }

  function clearAllFilters() {
    state.filters = { q: '', team: '', league: '', season: '', type: '', collection: '', department: '', subcategory: '', flag: '', price: '', favs: '' };
    state.gridPage = 1;
    state.groupPage = 1;
    syncFilterInputs();
    renderCatalog();
    updateCatalogHash();
  }

  // ── Opciones de filtro ───────────────────────────────────

  function itemsForFacet(excludedFilter) {
    var q = normalize(state.filters.q);
    var onlyFavs = state.filters.favs === '1';
    return state.items.filter(function (item) {
      if (excludedFilter !== 'favs' && onlyFavs && !isFavorite(item.id)) return false;
      if (excludedFilter !== 'team' && state.filters.team && item.team !== state.filters.team) return false;
      if (excludedFilter !== 'league' && state.filters.league && item.league !== state.filters.league) return false;
      if (excludedFilter !== 'season' && state.filters.season && item.seasonGroup !== state.filters.season) return false;
      if (excludedFilter !== 'type' && state.filters.type && item.type !== state.filters.type) return false;
      if (excludedFilter !== 'collection' && state.filters.collection && item.collection !== state.filters.collection) return false;
      if (excludedFilter !== 'department' && state.filters.department && item.department !== state.filters.department) return false;
      if (excludedFilter !== 'subcategory' && state.filters.subcategory && item.subcategory !== state.filters.subcategory) return false;
      if (excludedFilter !== 'flag' && state.filters.flag && (!Array.isArray(item.flags) || item.flags.indexOf(state.filters.flag) === -1)) return false;
      if (excludedFilter !== 'price' && state.filters.price && !matchesPriceBand(item, state.filters.price)) return false;
      if (excludedFilter !== 'q' && q && item._search.indexOf(q) === -1) return false;
      return true;
    });
  }

  function countFacet(items, key) {
    var counts = Object.create(null);
    items.forEach(function (item) {
      var value = item[key];
      if (value === undefined || value === null || value === '') return;
      counts[value] = (counts[value] || 0) + 1;
    });
    return counts;
  }

  function withSelectedFacet(counts, key) {
    var selected = state.filters[key];
    if (selected && counts[selected] === undefined) counts[selected] = 0;
    return counts;
  }

  function leagueOptionsHtml(allLabel, items) {
    var counts = withSelectedFacet(countFacet(items || itemsForFacet('league'), 'league'), 'league');
    var rows = Object.keys(counts).map(function (name) { return [name, counts[name]]; }).sort(function (a, b) {
      return b[1] - a[1] || a[0].localeCompare(b[0], 'es');
    });
    return '<option value="">' + esc(allLabel) + '</option>' + rows.map(function (row) {
      return '<option value="' + esc(row[0]) + '">' + esc(row[0]) + ' (' + fmt(row[1]) + ')</option>';
    }).join('');
  }

  function teamOptionsHtml(allLabel, items) {
    var byLeague = Object.create(null);
    (items || itemsForFacet('team')).forEach(function (item) {
      var league = item.league || 'Otras ligas';
      var name = item.team || 'Otros';
      if (!byLeague[league]) byLeague[league] = Object.create(null);
      byLeague[league][name] = (byLeague[league][name] || 0) + 1;
    });

    var selectedTeam = state.filters.team;
    if (selectedTeam) {
      var selectedData = state.teams.get(selectedTeam);
      var selectedLeague = selectedData ? selectedData.league : 'Otras ligas';
      if (!byLeague[selectedLeague]) byLeague[selectedLeague] = Object.create(null);
      if (byLeague[selectedLeague][selectedTeam] === undefined) byLeague[selectedLeague][selectedTeam] = 0;
    }

    var leagues = Object.keys(byLeague).sort(function (a, b) {
      var countA = Object.keys(byLeague[a]).reduce(function (sum, name) { return sum + byLeague[a][name]; }, 0);
      var countB = Object.keys(byLeague[b]).reduce(function (sum, name) { return sum + byLeague[b][name]; }, 0);
      if (a === 'Selecciones') return -1;
      if (b === 'Selecciones') return 1;
      return countB - countA || a.localeCompare(b, 'es');
    });

    return '<option value="">' + esc(allLabel) + '</option>' + leagues.map(function (league) {
      var teams = Object.keys(byLeague[league]).sort(function (a, b) { return a.localeCompare(b, 'es'); });
      return '<optgroup label="' + esc(league) + '">' + teams.map(function (name) {
        return '<option value="' + esc(name) + '">' + esc(name) + ' (' + fmt(byLeague[league][name]) + ')</option>';
      }).join('') + '</optgroup>';
    }).join('');
  }

  function seasonOptionsHtml(items) {
    var counts = withSelectedFacet(countFacet(items || itemsForFacet('season'), 'seasonGroup'), 'season');
    var keys = Object.keys(counts).sort(function (a, b) {
      var ai = SEASON_ORDER.indexOf(a), bi = SEASON_ORDER.indexOf(b);
      if (ai === -1) ai = SEASON_ORDER.length;
      if (bi === -1) bi = SEASON_ORDER.length;
      return ai - bi || a.localeCompare(b, 'es');
    });
    return '<option value="">Todas las temporadas</option>' + keys.map(function (key) {
      return '<option value="' + esc(key) + '">' + esc(seasonLabel(key)) + ' (' + fmt(counts[key]) + ')</option>';
    }).join('');
  }

  function typeOptionsHtml(items) {
    var counts = withSelectedFacet(countFacet(items || itemsForFacet('type'), 'type'), 'type');
    var rows = Object.keys(counts).map(function (type) { return [type, counts[type]]; }).sort(function (a, b) {
      return b[1] - a[1] || a[0].localeCompare(b[0], 'es');
    });
    return '<option value="">Todos los tipos</option>' + rows.map(function (row) {
      return '<option value="' + esc(row[0]) + '">' + esc(typeLabel(row[0])) + ' (' + fmt(row[1]) + ')</option>';
    }).join('');
  }

  function dimensionOptionsHtml(allLabel, key, labels, items) {
    var counts = withSelectedFacet(countFacet(items || itemsForFacet(key), key), key);
    var rows = Object.keys(counts).map(function (value) { return [value, counts[value]]; }).sort(function (a, b) {
      return b[1] - a[1] || String(labels[a[0]] || a[0]).localeCompare(String(labels[b[0]] || b[0]), 'es');
    });
    return '<option value="">' + esc(allLabel) + '</option>' + rows.map(function (row) {
      return '<option value="' + esc(row[0]) + '">' + esc(labels[row[0]] || row[0]) + ' (' + fmt(row[1]) + ')</option>';
    }).join('');
  }

  function seasonChipsHtml(items) {
    var counts = withSelectedFacet(countFacet(items || itemsForFacet('season'), 'seasonGroup'), 'season');
    var keys = Object.keys(counts).sort(function (a, b) {
      var ai = SEASON_ORDER.indexOf(a), bi = SEASON_ORDER.indexOf(b);
      if (ai === -1) ai = SEASON_ORDER.length;
      if (bi === -1) bi = SEASON_ORDER.length;
      return ai - bi || a.localeCompare(b, 'es');
    });
    return '<button type="button" data-season="">Todas</button>' + keys.map(function (key) {
      return '<button type="button" data-season="' + esc(key) + '">' + esc(seasonLabel(key)) + '</button>';
    }).join('');
  }

  function typeChipsHtml(items) {
    var counts = withSelectedFacet(countFacet(items || itemsForFacet('type'), 'type'), 'type');
    var rows = Object.keys(counts).map(function (type) { return [type, counts[type]]; }).sort(function (a, b) {
      return b[1] - a[1] || a[0].localeCompare(b[0], 'es');
    });
    return '<button type="button" data-type="">Todos</button>' + rows.map(function (row) {
      return '<button type="button" data-type="' + esc(row[0]) + '">' + esc(typeLabel(row[0])) + '</button>';
    }).join('');
  }

  function populateFilterOptions() {
    var body = $('#filters-drawer-body');
    if (body) {
      body.innerHTML =
        '<label class="searchbox"><svg><use href="#i-search"/></svg>' +
          '<input type="search" id="drawer-search" placeholder="Busca una prenda o equipo…" autocomplete="off"></label>' +
        '<p class="filter-section-title">Filtros rápidos</p>' +
        '<div class="filter-chips" id="drawer-quick-flags">' +
          '<button type="button" data-drawer-flag="kids">Niños</button>' +
          '<button type="button" data-drawer-flag="women">Mujer</button>' +
          '<button type="button" data-drawer-flag="retro">Retro</button>' +
          '<button type="button" data-drawer-flag="player">Player</button>' +
        '</div>' +
        '<p class="filter-section-title">Precio base</p>' +
        '<div class="filter-chips" id="drawer-prices">' +
          '<button type="button" data-drawer-price="">Todos</button>' +
          '<button type="button" data-drawer-price="le25">≤ 25 €</button>' +
          '<button type="button" data-drawer-price="26-45">26 – 45 €</button>' +
          '<button type="button" data-drawer-price="gt45">+45 €</button>' +
        '</div>' +
        '<p class="filter-section-title">Temporada</p>' +
        '<div class="filter-chips" id="drawer-seasons"></div>' +
        '<p class="filter-section-title">Tipo de prenda</p>' +
        '<div class="filter-chips" id="drawer-types"></div>' +
        '<label class="select-wrap"><span>Colección</span><select id="drawer-collection"></select><svg><use href="#i-chevron"/></svg></label>' +
        '<label class="select-wrap"><span>Uso</span><select id="drawer-department"></select><svg><use href="#i-chevron"/></svg></label>' +
        '<label class="select-wrap"><span>Prenda</span><select id="drawer-subcategory"></select><svg><use href="#i-chevron"/></svg></label>' +
        '<label class="select-wrap"><span>Liga</span><select id="drawer-league"></select><svg><use href="#i-chevron"/></svg></label>' +
        '<label class="select-wrap"><span>Equipo</span><select id="drawer-team"></select><svg><use href="#i-chevron"/></svg></label>';
    }

    syncFilterInputs();
  }

  function refreshFilterOptions() {
    if (!state.items.length) return;
    var options = [
      ['filter-league', leagueOptionsHtml('Todas las ligas', itemsForFacet('league'))],
      ['drawer-league', leagueOptionsHtml('Todas las ligas', itemsForFacet('league'))],
      ['filter-team', teamOptionsHtml('Todos los equipos', itemsForFacet('team'))],
      ['drawer-team', teamOptionsHtml('Todos los equipos', itemsForFacet('team'))],
      ['filter-season', seasonOptionsHtml(itemsForFacet('season'))],
      ['filter-type', typeOptionsHtml(itemsForFacet('type'))],
      ['filter-collection', dimensionOptionsHtml('Todas', 'collection', COLLECTION_LABELS, itemsForFacet('collection'))],
      ['filter-department', dimensionOptionsHtml('Todos', 'department', DEPARTMENT_LABELS, itemsForFacet('department'))],
      ['filter-subcategory', dimensionOptionsHtml('Todas', 'subcategory', {}, itemsForFacet('subcategory'))],
      ['drawer-collection', dimensionOptionsHtml('Todas', 'collection', COLLECTION_LABELS, itemsForFacet('collection'))],
      ['drawer-department', dimensionOptionsHtml('Todos', 'department', DEPARTMENT_LABELS, itemsForFacet('department'))],
      ['drawer-subcategory', dimensionOptionsHtml('Todas', 'subcategory', {}, itemsForFacet('subcategory'))]
    ];
    options.forEach(function (entry) {
      var select = document.getElementById(entry[0]);
      if (select) select.innerHTML = entry[1];
    });
    var seasons = $('#drawer-seasons');
    if (seasons) seasons.innerHTML = seasonChipsHtml(itemsForFacet('season'));
    var types = $('#drawer-types');
    if (types) types.innerHTML = typeChipsHtml(itemsForFacet('type'));
  }

  function syncFilterInputs() {
    refreshFilterOptions();
    var search = $('#catalog-search');
    if (search && document.activeElement !== search) search.value = state.filters.q;

    var setSelect = function (id, value) {
      var el = document.getElementById(id);
      if (el) el.value = value || '';
    };
    setSelect('filter-league', state.filters.league);
    setSelect('filter-team', state.filters.team);
    setSelect('filter-season', state.filters.season);
    setSelect('filter-type', state.filters.type);
    setSelect('filter-collection', state.filters.collection);
    setSelect('filter-department', state.filters.department);
    setSelect('filter-subcategory', state.filters.subcategory);

    var sortSelect = $('#sort-select');
    if (sortSelect) sortSelect.value = state.sort;

    $$('.view-switch button').forEach(function (button) {
      var active = button.getAttribute('data-view') === (state.view === 'grid' ? 'grid' : 'teams');
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    syncDrawerValues();
    updateFilterCount();
  }

  function syncDrawerValues() {
    var search = $('#drawer-search');
    if (search && document.activeElement !== search) search.value = state.filters.q;
    var league = $('#drawer-league');
    if (league) league.value = state.filters.league || '';
    var team = $('#drawer-team');
    if (team) team.value = state.filters.team || '';
    ['collection', 'department', 'subcategory'].forEach(function (key) {
      var select = $('#drawer-' + key);
      if (select) select.value = state.filters[key] || '';
    });

    $$('#drawer-quick-flags button').forEach(function (button) {
      button.classList.toggle('is-active', (button.getAttribute('data-drawer-flag') || '') === (state.filters.flag || ''));
    });
    $$('#drawer-prices button').forEach(function (button) {
      button.classList.toggle('is-active', (button.getAttribute('data-drawer-price') || '') === (state.filters.price || ''));
    });
    $$('#drawer-seasons button').forEach(function (button) {
      button.classList.toggle('is-active', (button.getAttribute('data-season') || '') === (state.filters.season || ''));
    });
    $$('#drawer-types button').forEach(function (button) {
      button.classList.toggle('is-active', (button.getAttribute('data-type') || '') === (state.filters.type || ''));
    });
  }

  // ── Autocompletado predictivo del buscador ───────────────

  function hideSearchSuggest() {
    var box = $('#search-suggest');
    var input = $('#catalog-search');
    if (box) box.hidden = true;
    if (input) input.setAttribute('aria-expanded', 'false');
    state.suggestIndex = -1;
  }

  function renderSearchSuggest(rawQuery) {
    var box = $('#search-suggest');
    var input = $('#catalog-search');
    if (!box || !input) return;

    var q = normalize(rawQuery);
    if (q.length < 2 || !state.items.length) {
      hideSearchSuggest();
      return;
    }

    var teams = Array.from(state.teams.values())
      .filter(function (team) { return team.name !== 'Otros' && normalize(team.name).indexOf(q) !== -1; })
      .sort(function (a, b) {
        var aStart = normalize(a.name).indexOf(q) === 0 ? 0 : 1;
        var bStart = normalize(b.name).indexOf(q) === 0 ? 0 : 1;
        return (aStart - bStart) || (b.count - a.count);
      })
      .slice(0, 4);

    var leagues = Array.from(state.leagues.entries())
      .filter(function (row) { return normalize(row[0]).indexOf(q) !== -1; })
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 2);

    var tokens = q.split(' ').filter(Boolean);
    var products = [];
    for (var i = 0; i < state.items.length && products.length < 5; i++) {
      var item = state.items[i];
      var match = true;
      for (var t = 0; t < tokens.length; t++) {
        if (item._search.indexOf(tokens[t]) === -1) { match = false; break; }
      }
      if (match) products.push(item);
    }

    if (!teams.length && !leagues.length && !products.length) {
      hideSearchSuggest();
      return;
    }

    var html = '';
    if (teams.length) {
      html += '<div class="suggest-group-label">Equipos</div>';
      html += teams.map(function (team) {
        return '<button type="button" class="suggest-item" role="option" data-suggest-team="' + esc(team.name) + '">' +
          teamMono(team.name) +
          '<div class="suggest-copy"><strong>' + esc(team.name) + '</strong><span>' + esc(team.league) + ' · ' + fmt(team.count) + ' prendas</span></div>' +
        '</button>';
      }).join('');
    }
    if (leagues.length) {
      html += '<div class="suggest-group-label">Ligas</div>';
      html += leagues.map(function (row) {
        return '<button type="button" class="suggest-item is-league-tag" role="option" data-suggest-league="' + esc(row[0]) + '">' +
          '<svg><use href="#i-layers"/></svg>' +
          '<div class="suggest-copy"><strong>' + esc(row[0]) + '</strong><span>' + fmt(row[1]) + ' prendas</span></div>' +
        '</button>';
      }).join('');
    }
    if (products.length) {
      html += '<div class="suggest-group-label">Prendas destacadas</div>';
      html += products.map(function (item) {
        return '<button type="button" class="suggest-item" role="option" data-suggest-product="' + esc(item.id) + '">' +
          '<div class="suggest-thumb"><img src="' + esc(coverUrl(item, 'small')) + '" alt="" loading="lazy"></div>' +
          '<div class="suggest-copy"><strong>' + esc(cleanTitle(item)) + '</strong><span>' + esc(item.team) + ' · ' + esc(item.season) + '</span></div>' +
          '<span class="suggest-price">' + esc(KangPricing.money(itemBasePriceCents(item))) + '</span>' +
        '</button>';
      }).join('');
    }

    box.innerHTML = html;
    box.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    state.suggestIndex = -1;
  }

  function stepSearchSuggest(delta) {
    var box = $('#search-suggest');
    if (!box || box.hidden) return false;
    var items = $$('.suggest-item', box);
    if (!items.length) return false;
    state.suggestIndex = (state.suggestIndex + delta + items.length) % items.length;
    items.forEach(function (el, idx) { el.classList.toggle('is-selected', idx === state.suggestIndex); });
    try { items[state.suggestIndex].scrollIntoView({ block: 'nearest' }); } catch (err) {}
    return true;
  }

  // ── Cierre y apertura del panel de filtros ───────────────

  function openFilters() {
    var drawer = $('#filters-drawer');
    var backdrop = $('#filters-backdrop');
    if (!drawer || drawer.classList.contains('is-open')) return;
    syncDrawerValues();
    drawer.classList.add('is-open');
    setOverlayState(drawer, true);
    if (backdrop) {
      backdrop.hidden = false;
      requestAnimationFrame(function () { backdrop.classList.add('is-open'); });
    }
    var opener = $('#filters-open');
    if (opener) opener.setAttribute('aria-expanded', 'true');
    lockScroll();
    setTimeout(function () {
      var input = $('#drawer-search');
      if (input) input.focus();
    }, 220);
  }

  function closeFilters() {
    var drawer = $('#filters-drawer');
    if (!drawer || !drawer.classList.contains('is-open')) return;
    releaseFocus(drawer);
    drawer.classList.remove('is-open');
    setOverlayState(drawer, false);
    var opener = $('#filters-open');
    if (opener) opener.setAttribute('aria-expanded', 'false');
    var backdrop = $('#filters-backdrop');
    if (backdrop) {
      backdrop.classList.remove('is-open');
      setTimeout(function () { if (!backdrop.classList.contains('is-open')) backdrop.hidden = true; }, 320);
    }
    unlockScroll();
    if (opener) opener.focus();
  }

  // ── Eventos del catálogo ─────────────────────────────────

  function bindCatalogEvents() {
    var search = $('#catalog-search');
    if (search) {
      search.addEventListener('input', debounce(function () {
        applyFilters({ q: search.value });
        renderSearchSuggest(search.value);
      }, 180));
      search.addEventListener('focus', function () {
        if (search.value.trim().length >= 2) renderSearchSuggest(search.value);
      });
      search.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowDown') {
          if (stepSearchSuggest(1)) event.preventDefault();
          return;
        }
        if (event.key === 'ArrowUp') {
          if (stepSearchSuggest(-1)) event.preventDefault();
          return;
        }
        if (event.key === 'Enter') {
          var box = $('#search-suggest');
          var selected = box && !box.hidden && state.suggestIndex >= 0 ? $$('.suggest-item', box)[state.suggestIndex] : null;
          if (selected) {
            event.preventDefault();
            selected.click();
            return;
          }
          hideSearchSuggest();
          return;
        }
        if (event.key === 'Escape') {
          var suggest = $('#search-suggest');
          if (suggest && !suggest.hidden) {
            hideSearchSuggest();
            return;
          }
          if (search.value) {
            search.value = '';
            applyFilters({ q: '' });
          }
        }
      });
    }

    var suggestBox = $('#search-suggest');
    if (suggestBox) {
      suggestBox.addEventListener('click', function (event) {
        var teamBtn = event.target.closest('[data-suggest-team]');
        if (teamBtn) {
          hideSearchSuggest();
          applyFilters({ q: '', team: teamBtn.getAttribute('data-suggest-team') });
          return;
        }
        var leagueBtn = event.target.closest('[data-suggest-league]');
        if (leagueBtn) {
          hideSearchSuggest();
          applyFilters({ q: '', league: leagueBtn.getAttribute('data-suggest-league') });
          return;
        }
        var prodBtn = event.target.closest('[data-suggest-product]');
        if (prodBtn) {
          hideSearchSuggest();
          openProduct(prodBtn.getAttribute('data-suggest-product'));
        }
      });
    }

    var quickFilters = $('#quick-filters');
    if (quickFilters) {
      quickFilters.addEventListener('click', function (event) {
        if (event.target.closest('[data-quick-fav]')) {
          applyFilters({ favs: state.filters.favs === '1' ? '' : '1' });
          return;
        }
        var flagBtn = event.target.closest('[data-quick-flag]');
        if (flagBtn) {
          var flag = flagBtn.getAttribute('data-quick-flag');
          applyFilters({ flag: state.filters.flag === flag ? '' : flag });
          return;
        }
        var priceBtn = event.target.closest('[data-quick-price]');
        if (priceBtn) {
          var price = priceBtn.getAttribute('data-quick-price');
          applyFilters({ price: state.filters.price === price ? '' : price });
        }
      });
    }

    var filters = $('#catalog-filters');
    if (filters) {
      filters.addEventListener('change', function (event) {
        var map = { 'filter-league': 'league', 'filter-team': 'team', 'filter-season': 'season', 'filter-type': 'type', 'filter-collection': 'collection', 'filter-department': 'department', 'filter-subcategory': 'subcategory' };
        var key = map[event.target.id];
        if (!key) return;
        var patch = {};
        patch[key] = event.target.value;
        applyFilters(patch);
      });
    }

    var clear = $('#filters-clear');
    if (clear) clear.addEventListener('click', clearAllFilters);

    var sort = $('#sort-select');
    if (sort) {
      sort.addEventListener('change', function () {
        state.sort = sort.value;
        state.gridPage = 1;
        state.groupPage = 1;
        renderCatalog();
      });
    }

    $$('.view-switch button').forEach(function (button) {
      button.addEventListener('click', function () { setView(button.getAttribute('data-view')); });
    });

    var more = $('#load-more');
    if (more) more.addEventListener('click', loadMoreResults);

    var openBtn = $('#filters-open');
    if (openBtn) openBtn.addEventListener('click', openFilters);
    var closeBtn = $('#filters-close');
    if (closeBtn) closeBtn.addEventListener('click', closeFilters);
    var applyBtn = $('#filters-apply');
    if (applyBtn) applyBtn.addEventListener('click', closeFilters);
    var resetBtn = $('#filters-reset');
    if (resetBtn) resetBtn.addEventListener('click', clearAllFilters);
    var backdrop = $('#filters-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeFilters);

    var drawerBody = $('#filters-drawer-body');
    if (drawerBody) {
      var drawerSearch = debounce(function (value) {
        applyFilters({ q: value });
      }, 220);

      drawerBody.addEventListener('input', function (event) {
        if (event.target && event.target.id === 'drawer-search') drawerSearch(event.target.value);
      });
      drawerBody.addEventListener('change', function (event) {
        if (event.target.id === 'drawer-league') applyFilters({ league: event.target.value });
        else if (event.target.id === 'drawer-team') applyFilters({ team: event.target.value });
        else if (event.target.id === 'drawer-collection') applyFilters({ collection: event.target.value });
        else if (event.target.id === 'drawer-department') applyFilters({ department: event.target.value });
        else if (event.target.id === 'drawer-subcategory') applyFilters({ subcategory: event.target.value });
      });
      drawerBody.addEventListener('click', function (event) {
        var flag = event.target.closest('[data-drawer-flag]');
        if (flag) {
          var val = flag.getAttribute('data-drawer-flag');
          applyFilters({ flag: state.filters.flag === val ? '' : val });
          return;
        }
        var price = event.target.closest('[data-drawer-price]');
        if (price) {
          applyFilters({ price: price.getAttribute('data-drawer-price') });
          return;
        }
        var season = event.target.closest('[data-season]');
        if (season) {
          applyFilters({ season: season.getAttribute('data-season') });
          return;
        }
        var type = event.target.closest('[data-type]');
        if (type) applyFilters({ type: type.getAttribute('data-type') });
      });
    }

    document.addEventListener('click', function (event) {
      if (!event.target.closest('#search-wrap')) hideSearchSuggest();
      var clearOne = event.target.closest('[data-clear-filter]');
      if (clearOne) {
        var patch = {};
        patch[clearOne.getAttribute('data-clear-filter')] = '';
        applyFilters(patch);
        return;
      }
      if (event.target.closest('[data-clear-all]')) {
        clearAllFilters();
        return;
      }
      var teamLink = event.target.closest('[data-team-link]');
      if (teamLink) {
        location.hash = catalogHref({
          q: '',
          team: teamLink.getAttribute('data-team-link'),
          league: '',
          season: '',
          type: ''
        });
      }
    });

    var teamsSearch = $('#teams-search');
    if (teamsSearch) teamsSearch.addEventListener('input', debounce(renderTeamsView, 180));
    var teamsLeague = $('#teams-league');
    if (teamsLeague) teamsLeague.addEventListener('change', renderTeamsView);
  }

  // ── Capas y bloqueo del scroll ───────────────────────────

  function lockScroll() {
    state.overlayCount += 1;
    if (state.overlayCount === 1) document.body.classList.add('no-scroll');
  }

  function unlockScroll() {
    state.overlayCount = Math.max(0, state.overlayCount - 1);
    if (!state.overlayCount) document.body.classList.remove('no-scroll');
  }

  function releaseFocus(container) {
    if (container && container.contains(document.activeElement)) {
      try { document.activeElement.blur(); } catch (err) {}
    }
  }

  function setOverlayState(el, open) {
    if (!el) return;
    el.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) el.removeAttribute('inert');
    else el.setAttribute('inert', '');
  }

  function initOverlays() {
    ['product-modal', 'cart-drawer', 'favs-drawer', 'orders-drawer', 'filters-drawer', 'checkout-modal', 'mobile-menu', 'lightbox'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.classList.contains('is-open')) setOverlayState(el, false);
    });
  }

  function photoUrl(path, size, source) {
    if (!path) return '/placeholder.svg';
    var value = String(path).replace(/^https?:\/\/photo\.yupoo\.com/i, '');
    if (value.charAt(0) !== '/') value = '/' + value;
    if (!/\.(jpg|jpeg|png|webp)$/i.test(value)) {
      value += '/' + (size || 'big') + '.jpg';
    } else if (size) {
      value = value.replace(/\/[^/]+\.(jpg|jpeg|png|webp)$/i, '/' + size + '.jpg');
    }
    return (source && source !== 'minkang' ? '/img/' + source : '/img') + value;
  }

  function expandSizes(range) {
    var value = String(range || 'S-2XL');
    var kids = value.match(/^(\d{1,2})-(\d{1,2})$/);
    var sizes = [];
    var index;

    if (kids) {
      var from = parseInt(kids[1], 10);
      var to = parseInt(kids[2], 10);
      for (index = from; index <= to; index += 2) sizes.push(String(index));
      return sizes;
    }

    var order = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
    var parts = value.split('-');
    var start = order.indexOf(parts[0]);
    var end = order.indexOf(parts[1]);
    if (start === -1) start = 2;
    if (end === -1) end = 4;
    if (end < start) end = start;
    return order.slice(start, end + 1);
  }

  // ── Ficha de producto ────────────────────────────────────

  function openProduct(id, options) {
    options = options || {};
    var item = state.byId.get(String(id));
    if (!item) {
      toast('Esta prenda ya no está disponible', 'error');
      return;
    }

    var modal = $('#product-modal');
    var backdrop = $('#product-backdrop');
    if (!modal) return;

    state.product = item;
    state.galleryToken += 1;
    state.gallery = [item.cover ? item.cover + '/big.jpg' : ''];
    state.galleryIndex = 0;
    state.qty = 1;
    state.patches = 'No';
    state.customName = '';
    state.customNumber = '';
    state.sizeGuideOpen = false;
    state.sizeGuideTab = isKidsItem(item) ? 'kids' : 'adult';

    var sizes = expandSizes(item.sizeRange);
    state.selectedSize = sizes.indexOf('M') !== -1 ? 'M' : (sizes[0] || 'S');

    if (!options.skipHash) {
      if (location.hash.indexOf('#/producto/') !== 0) {
        state.lastListHash = location.hash || '#/';
      }
      var targetHash = '#/producto/' + enc(item.id);
      if (location.hash !== targetHash) {
        try { history.pushState(null, '', targetHash); } catch (err) {}
      }
    }

    renderProduct();
    renderGallery();

    if (!modal.classList.contains('is-open')) {
      state.returnFocus = document.activeElement;
      modal.classList.add('is-open');
      setOverlayState(modal, true);
      if (backdrop) {
        backdrop.hidden = false;
        requestAnimationFrame(function () { backdrop.classList.add('is-open'); });
      }
      lockScroll();
      setTimeout(function () {
        var close = $('#product-close');
        if (close) close.focus();
      }, 220);
    }

    var body = modal.querySelector('.product-layout');
    if (body) body.scrollTop = 0;
    loadAlbum(item);
  }

  function closeProduct(skipHashRestore) {
    var modal = $('#product-modal');
    if (!modal || !modal.classList.contains('is-open')) return;
    releaseFocus(modal);
    modal.classList.remove('is-open');
    setOverlayState(modal, false);
    var backdrop = $('#product-backdrop');
    if (backdrop) {
      backdrop.classList.remove('is-open');
      setTimeout(function () { if (!backdrop.classList.contains('is-open')) backdrop.hidden = true; }, 320);
    }
    unlockScroll();
    if (!skipHashRestore && location.hash.indexOf('#/producto/') === 0) {
      try { history.replaceState(null, '', state.lastListHash || '#/'); } catch (err) {}
    }
    if (state.returnFocus && state.returnFocus.isConnected) {
      try { state.returnFocus.focus(); } catch (err) {}
    }
    state.returnFocus = null;
  }

  async function loadAlbum(item) {
    var id = item.albumId || item.id;
    var token = state.galleryToken;
    try {
      var res = await fetch('/api/album/' + encodeURIComponent(id) + (item.source === 'gxg' ? '?source=gxg' : ''), { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return;
      var album = await res.json();
      if (token !== state.galleryToken || !state.product || String(state.product.id) !== String(item.id)) return;
      var images = (album.images || []).map(function (path) {
        var value = String(path || '').replace(/^https?:\/\/photo\.yupoo\.com/i, '');
        if (!value) return '';
        if (value.charAt(0) !== '/') value = '/' + value;
        if (!/\.(jpg|jpeg|png|webp)$/i.test(value)) value += '/big.jpg';
        return value;
      }).filter(Boolean);

      if (images.length) {
        var cover = state.product.cover || '';
        var ordered = images.slice();
        var coverIndex = -1;
        for (var i = 0; i < ordered.length; i++) {
          if (cover && ordered[i].indexOf(cover + '/') === 0) { coverIndex = i; break; }
        }
        if (coverIndex > 0) {
          var first = ordered.splice(coverIndex, 1)[0];
          ordered.unshift(first);
        }
        state.gallery = ordered.slice(0, 20);
        state.galleryIndex = 0;
        renderGallery();
      }
    } catch (err) {}
  }

  function renderGallery() {
    var main = $('#product-main-img');
    var thumbs = $('#product-thumbs');
    var item = state.product;
    if (!main || !item) return;

    var path = state.gallery[state.galleryIndex] || '';
    main.innerHTML = imgTag(photoUrl(path, 'big', item.source), item.title, { eager: true }) +
      '<div class="img-skeleton" aria-hidden="true"></div>' +
      '<button class="product-zoom" id="product-zoom" type="button" aria-label="Ampliar imagen">' +
      '<svg><use href="#i-zoom"/></svg></button>';

    if (thumbs) {
      thumbs.style.display = state.gallery.length > 1 ? '' : 'none';
      thumbs.innerHTML = state.gallery.map(function (photo, index) {
        return '<button type="button" class="' + (index === state.galleryIndex ? 'is-active' : '') + '" ' +
          'data-photo="' + index + '" aria-label="Ver foto ' + (index + 1) + '">' +
          '<img src="' + esc(photoUrl(photo, 'medium', item.source)) + '" alt="" loading="lazy"></button>';
      }).join('');
    }
  }

  function selectPhoto(index) {
    if (!state.gallery[index]) return;
    state.galleryIndex = index;
    renderGallery();
  }

  function currentProductPricing() {
    var item = state.product;
    if (!item || !window.KangPricing) return { basePriceCents: 2500, nameNumberCents: 0, patchesCents: 0, sizeSurchargeCents: 0, unitPriceCents: 2500 };
    var name = item.custom ? String(state.customName || '').trim().toUpperCase().slice(0, 14) : '';
    var number = item.custom ? String(state.customNumber || '').replace(/\D/g, '').slice(0, 2) : '';
    var patches = item.custom ? state.patches : 'No';
    return KangPricing.calculate(item, {
      name: name,
      number: number,
      patches: patches,
      size: state.selectedSize
    });
  }

  function renderPriceBreakdownHtml() {
    var item = state.product;
    if (!item || !window.KangPricing) return '';
    var calc = currentProductPricing();
    var qty = Math.max(1, parseInt(state.qty, 10) || 1);
    var totalCents = calc.unitPriceCents * qty;
    var selectedPatches = state.patches === 'No' ? [] : state.patches.split(',').map(function (p) { return p.trim(); }).filter(Boolean);
    var hasSpecialSizes = /(?:3XL|4XL)/.test(String(item.sizeRange || ''));

    var rows = [];
    rows.push('<div class="price-breakdown-row"><span>Precio base (' + esc(item.subcategory || typeLabel(item.type)) + ')</span><strong>' + esc(KangPricing.money(calc.basePriceCents)) + '</strong></div>');

    if (item.custom) {
      rows.push('<div class="price-breakdown-row' + (calc.nameNumberCents ? ' is-active' : ' is-muted') + '">' +
        '<span>Nombre y dorsal</span>' +
        '<strong>' + (calc.nameNumberCents ? '+' + esc(KangPricing.money(calc.nameNumberCents)) : 'Opcional (+2,00 €)') + '</strong></div>');
      rows.push('<div class="price-breakdown-row' + (calc.patchesCents ? ' is-active' : ' is-muted') + '">' +
        '<span>Parches' + (selectedPatches.length ? ' (' + selectedPatches.length + ')' : '') + '</span>' +
        '<strong>' + (calc.patchesCents ? '+' + esc(KangPricing.money(calc.patchesCents)) : 'Opcional (+1,00 €/ud.)') + '</strong></div>');
    }

    if (calc.sizeSurchargeCents > 0) {
      rows.push('<div class="price-breakdown-row is-active"><span>Suplemento talla especial (' + esc(state.selectedSize) + ')</span><strong>+' + esc(KangPricing.money(calc.sizeSurchargeCents)) + '</strong></div>');
    } else if (hasSpecialSizes) {
      rows.push('<div class="price-breakdown-row is-muted"><span>Tallas especiales (3XL / 4XL)</span><strong>Opcional (+3,00 €)</strong></div>');
    }

    if (qty > 1) {
      rows.push('<div class="price-breakdown-row is-active"><span>Cantidad (' + qty + ' × ' + esc(KangPricing.money(calc.unitPriceCents)) + ')</span><strong>' + esc(KangPricing.money(totalCents)) + '</strong></div>');
    }

    return '<div class="product-price-head">' +
        '<div><span class="product-price-label">' + (qty > 1 ? 'Total (' + qty + ' uds.)' : 'Precio total') + '</span>' +
        '<strong class="product-price-main">' + esc(KangPricing.money(totalCents)) + '</strong></div>' +
        (qty > 1 ? '<span class="product-price-unit">' + esc(KangPricing.money(calc.unitPriceCents)) + ' / ud.</span>' : (calc.unitPriceCents > calc.basePriceCents ? '<span class="product-price-unit">Base ' + esc(KangPricing.money(calc.basePriceCents)) + '</span>' : '<span class="product-price-unit">Sin extras</span>')) +
      '</div>' +
      '<div class="price-breakdown">' + rows.join('') + '</div>';
  }

  function updateProductPricing() {
    var box = $('#product-price-box');
    if (box) box.innerHTML = renderPriceBreakdownHtml();
    var addBtn = $('#product-add');
    if (addBtn && window.KangPricing) {
      var calc = currentProductPricing();
      var qty = Math.max(1, parseInt(state.qty, 10) || 1);
      addBtn.innerHTML = 'Añadir al carrito · ' + esc(KangPricing.money(calc.unitPriceCents * qty)) + ' <svg><use href="#i-cart"/></svg>';
    }
  }

  function renderSizeGuideHtml() {
    var item = state.product;
    var available = item ? expandSizes(item.sizeRange) : [];
    var tab = state.sizeGuideTab === 'kids' ? 'kids' : 'adult';
    var isKids = tab === 'kids';

    var tableRows = isKids ? KIDS_SIZE_GUIDE.map(function (row) {
      var isAvailable = available.indexOf(row.size) !== -1;
      var isCurrent = state.selectedSize === row.size;
      var cls = (isCurrent ? 'is-current' : '') + (isAvailable ? ' is-available' : ' is-unavailable');
      return '<tr class="' + cls.trim() + '"' + (isAvailable ? ' data-guide-size="' + esc(row.size) + '" title="Seleccionar talla ' + esc(row.size) + '"' : '') + '>' +
        '<td><strong>' + esc(row.size) + '</strong></td>' +
        '<td>' + esc(row.age) + '</td>' +
        '<td>' + esc(row.height) + ' cm</td>' +
        '<td>' + esc(row.chest) + ' cm</td>' +
      '</tr>';
    }).join('') : ADULT_SIZE_GUIDE.map(function (row) {
      var isAvailable = available.indexOf(row.size) !== -1;
      var isCurrent = state.selectedSize === row.size;
      var cls = (isCurrent ? 'is-current' : '') + (isAvailable ? ' is-available' : ' is-unavailable');
      return '<tr class="' + cls.trim() + '"' + (isAvailable ? ' data-guide-size="' + esc(row.size) + '" title="Seleccionar talla ' + esc(row.size) + '"' : '') + '>' +
        '<td><strong>' + esc(row.size) + '</strong>' + (row.extra ? ' <small>' + esc(row.extra) + '</small>' : '') + '</td>' +
        '<td>' + esc(row.chest) + ' cm</td>' +
        '<td>' + esc(row.length) + ' cm</td>' +
        '<td>' + esc(row.height) + ' cm</td>' +
        '<td>' + esc(row.weight) + '</td>' +
      '</tr>';
    }).join('');

    var headers = isKids
      ? '<tr><th>Talla</th><th>Edad aprox.</th><th>Altura</th><th>Pecho</th></tr>'
      : '<tr><th>Talla</th><th>Pecho</th><th>Largo</th><th>Altura</th><th>Peso</th></tr>';

    var note = isKids
      ? 'Medidas orientativas (±2 cm). Si el niño está entre dos tallas, elige la superior para mayor comodidad.'
      : 'Medidas orientativas (±2 cm). En Versión Jugador (Player), el corte es más entallado: si dudas entre dos tallas, sube una. Tallas 3XL y 4XL suman +3,00 €.';

    return '<div class="size-guide-head">' +
        '<div class="size-guide-tabs" role="tablist" aria-label="Guía de tallas">' +
          '<button type="button" role="tab" aria-selected="' + (!isKids) + '" class="' + (!isKids ? 'is-active' : '') + '" data-guide-tab="adult">Adulto (S–5XL)</button>' +
          '<button type="button" role="tab" aria-selected="' + isKids + '" class="' + (isKids ? 'is-active' : '') + '" data-guide-tab="kids">Niños (10–30)</button>' +
        '</div>' +
        '<span class="size-guide-legend">Toca una talla disponible para elegirla</span>' +
      '</div>' +
      '<div class="size-guide-table-wrap">' +
        '<table class="size-guide-table"><thead>' + headers + '</thead><tbody>' + tableRows + '</tbody></table>' +
      '</div>' +
      '<p class="size-guide-note">' + esc(note) + '</p>';
  }

  function updateSizeGuidePanel() {
    var panel = $('#size-guide-panel');
    var toggle = $('#size-guide-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', state.sizeGuideOpen ? 'true' : 'false');
    if (!panel) return;
    panel.hidden = !state.sizeGuideOpen;
    if (state.sizeGuideOpen) panel.innerHTML = renderSizeGuideHtml();
  }

  function updateSizeHints() {
    var hint = $('#size-hint');
    if (hint) hint.textContent = state.selectedSize;
    var fit = $('#size-fit-hint');
    if (fit) fit.textContent = sizeFitHintText(state.selectedSize, state.product);
    if (state.sizeGuideOpen) updateSizeGuidePanel();
  }

  function renderProduct() {
    var item = state.product;
    var info = $('#product-info');
    if (!item || !info) return;

    var sizes = expandSizes(item.sizeRange);
    if (sizes.indexOf(state.selectedSize) === -1) state.selectedSize = sizes[0] || 'S';

    var tags = '';
    if (item.league) tags += '<span class="product-tag">' + esc(item.league) + '</span>';
    (item.flags || []).forEach(function (flag) {
      tags += '<span class="product-tag' + (flag === 'player' ? ' is-accent' : '') + '">' + esc(flagLabel(flag)) + '</span>';
    });
    tags += '<span class="product-tag">' + esc(item.subcategory || typeLabel(item.type)) + '</span>';
    if (item.department) tags += '<span class="product-tag">' + esc(DEPARTMENT_LABELS[item.department] || item.department) + '</span>';

    var sizeButtons = sizes.map(function (size) {
      return '<button type="button" class="size-btn' +
        (size === state.selectedSize ? ' is-active' : '') +
        (/^\d+$/.test(size) ? ' is-kid' : '') +
        '" data-size="' + esc(size) + '">' + esc(size) + '</button>';
    }).join('');

    var selectedPatches = state.patches === 'No' ? [] : state.patches.split(',').map(function (patch) { return patch.trim(); });
    var patches = ['No', 'Liga', 'Champions', 'Mundial', 'Copa'].map(function (patch) {
      var active = patch === 'No' ? selectedPatches.length === 0 : selectedPatches.indexOf(patch) !== -1;
      return '<button type="button" class="patch-option' + (active ? ' is-active' : '') + '" data-patch="' + esc(patch) + '" aria-pressed="' + active + '">' +
        '<svg><use href="#i-check"/></svg>' + (patch === 'No' ? 'Sin parches' : esc(patch)) + '</button>';
    }).join('');

    var customPanel = item.custom ?
      '<div class="custom-panel">' +
        '<div class="custom-panel-head"><strong>Nombre y dorsal</strong>' +
          '<span><svg><use href="#i-spark"/></svg> +2,00 €</span></div>' +
        '<div class="custom-panel-grid">' +
          '<div>' +
            '<div class="custom-fields">' +
              '<label class="field"><span>Nombre</span>' +
                '<input type="text" id="custom-name" maxlength="14" placeholder="TU NOMBRE" autocomplete="off" style="text-transform:uppercase" value="' + esc(state.customName) + '"></label>' +
              '<label class="field"><span>Dorsal</span>' +
                '<input type="text" id="custom-number" maxlength="2" inputmode="numeric" placeholder="10" autocomplete="off" value="' + esc(state.customNumber) + '"></label>' +
            '</div>' +
            '<p class="field-label" style="margin-top:14px">Parches <span>+1,00 € / ud. · Opcional</span></p>' +
            '<div class="patch-row" id="patch-row">' + patches + '</div>' +
          '</div>' +
          '<div class="product-jersey-preview" aria-hidden="true">' +
            '<div class="product-jersey-shirt">' +
              '<span class="product-jersey-name' + (state.customName ? '' : ' is-placeholder') + '" id="product-preview-name">' + esc((state.customName || 'TU NOMBRE').toUpperCase()) + '</span>' +
              '<span class="product-jersey-number' + (state.customNumber ? '' : ' is-placeholder') + '" id="product-preview-number">' + esc(state.customNumber || '10') + '</span>' +
            '</div>' +
            '<span class="product-jersey-patches" id="product-preview-patches">' + (selectedPatches.length ? 'Parches: ' + esc(selectedPatches.join(', ')) : 'Vista previa en vivo') + '</span>' +
          '</div>' +
        '</div>' +
        '<p class="custom-note"><svg><use href="#i-shield"/></svg> Nombre y dorsal: +2,00 € por prenda. Cada parche añade 1,00 €. El nombre se imprime en mayúsculas y el dorsal debe ser del 0 al 99.</p>' +
      '</div>' :
      '<div class="not-customizable"><svg><use href="#i-shirt"/></svg>' +
        '<span>Esta prenda no admite nombre ni dorsal. Solo necesitas elegir la talla.</span></div>';

    var title = cleanTitle(item);
    var fitText = sizeFitHintText(state.selectedSize, item);
    var favActive = isFavorite(item.id);

    info.innerHTML =
      '<div class="product-info-top">' +
        '<span class="product-league">' + esc(item.league || 'Catálogo') + '</span>' +
        '<span class="product-season">' + esc(seasonLabel(item.seasonGroup)) + '</span>' +
        (item.custom ? '<span class="product-tag is-accent">Personalizable</span>' : '') +
        '<div class="product-info-actions">' +
          '<button type="button" class="product-action-btn is-fav' + (favActive ? ' is-active' : '') + '" id="product-fav" data-fav-toggle="' + esc(item.id) + '" aria-pressed="' + favActive + '"><svg><use href="#i-heart"/></svg><span>' + (favActive ? 'Guardado' : 'Favorito') + '</span></button>' +
          '<button type="button" class="product-action-btn" id="product-share" data-share-product><svg><use href="#i-share"/></svg><span>Compartir</span></button>' +
        '</div>' +
      '</div>' +
      '<h2 id="product-title">' + esc(title) + '</h2>' +
      '<p class="product-team">' + esc(item.team) + ' · ' + esc(item.season) + ' · Tallas ' + esc(item.sizeRange) + '</p>' +
      '<p class="product-supplier-ref"><span>Ref. proveedor:</span> ' + esc(item.title) + '</p>' +
      '<div class="product-tags">' + tags + '</div>' +
      '<div class="product-price-box" id="product-price-box">' + renderPriceBreakdownHtml() + '</div>' +
      '<div class="size-head-row">' +
        '<p class="field-label">Talla <span id="size-hint">' + esc(state.selectedSize) + '</span></p>' +
        '<button type="button" class="size-guide-toggle" id="size-guide-toggle" aria-expanded="' + (state.sizeGuideOpen ? 'true' : 'false') + '" aria-controls="size-guide-panel"><svg><use href="#i-ruler"/></svg> Guía de tallas</button>' +
      '</div>' +
      '<div class="size-list" id="size-list">' + sizeButtons + '</div>' +
      '<p class="size-fit-hint" id="size-fit-hint">' + esc(fitText) + '</p>' +
      '<div class="size-guide-panel" id="size-guide-panel"' + (state.sizeGuideOpen ? '' : ' hidden') + '>' + (state.sizeGuideOpen ? renderSizeGuideHtml() : '') + '</div>' +
      customPanel +
      '<div class="product-add-row">' +
        '<div class="qty">' +
          '<button type="button" data-qty="-1" aria-label="Quitar una unidad"><svg><use href="#i-minus"/></svg></button>' +
          '<span id="product-qty">' + esc(state.qty) + '</span>' +
          '<button type="button" data-qty="1" aria-label="Añadir una unidad"><svg><use href="#i-plus"/></svg></button>' +
        '</div>' +
        '<button class="btn btn-primary" id="product-add" type="button">Añadir al carrito <svg><use href="#i-cart"/></svg></button>' +
      '</div>' +
      '<p class="product-disclaimer">Sin pago online. Confirmamos precio, disponibilidad y envío por WhatsApp o email.</p>';

    updateProductPricing();
  }

  function updateCustomPreview() {
    var nameEl = $('#product-preview-name');
    var numEl = $('#product-preview-number');
    var patchesEl = $('#product-preview-patches');
    var name = String(state.customName || '').trim().toUpperCase().slice(0, 14);
    var number = String(state.customNumber || '').replace(/\D/g, '').slice(0, 2);
    if (nameEl) {
      nameEl.textContent = name || 'TU NOMBRE';
      nameEl.classList.toggle('is-placeholder', !name);
    }
    if (numEl) {
      numEl.textContent = number || '10';
      numEl.classList.toggle('is-placeholder', !number);
    }
    if (patchesEl) {
      patchesEl.textContent = state.patches && state.patches !== 'No' ? 'Parches: ' + state.patches : 'Vista previa en vivo';
    }
  }

  function shareCurrentProduct() {
    var item = state.product;
    if (!item) return;
    var url = location.origin + location.pathname + '#/producto/' + enc(item.id);
    var title = cleanTitle(item) + ' · ' + item.team;
    if (navigator.share) {
      navigator.share({ title: title, text: title + ' en KANG Team', url: url }).catch(function (err) {
        if (err && err.name === 'AbortError') return;
        copyText(url).then(function () { toast('Enlace del producto copiado'); }).catch(function () { toast('No se pudo copiar el enlace', 'error'); });
      });
      return;
    }
    copyText(url).then(function () {
      toast('Enlace del producto copiado');
    }).catch(function () {
      toast('No se pudo copiar el enlace', 'error');
    });
  }

  function selectSize(size) {
    state.selectedSize = size;
    $$('#product-info .size-btn').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-size') === size);
    });
    updateSizeHints();
    updateProductPricing();
  }

  function selectPatch(value) {
    var selected = state.patches === 'No' ? [] : state.patches.split(',').map(function (patch) { return patch.trim(); });
    if (value === 'No') selected = [];
    else if (selected.indexOf(value) === -1) selected.push(value);
    else selected = selected.filter(function (patch) { return patch !== value; });
    state.patches = selected.length ? selected.join(', ') : 'No';
    $$('#product-info .patch-option').forEach(function (option) {
      var patch = option.getAttribute('data-patch');
      var active = patch === 'No' ? selected.length === 0 : selected.indexOf(patch) !== -1;
      option.classList.toggle('is-active', active);
      option.setAttribute('aria-pressed', String(active));
    });
    updateCustomPreview();
    updateProductPricing();
  }

  function changeProductQty(delta) {
    state.qty = Math.min(30, Math.max(1, state.qty + delta));
    var qty = $('#product-qty');
    if (qty) qty.textContent = String(state.qty);
    updateProductPricing();
  }

  function bindProductEvents() {
    var info = $('#product-info');
    if (info) {
      info.addEventListener('click', function (event) {
        if (event.target.closest('[data-share-product]')) {
          shareCurrentProduct();
          return;
        }
        if (event.target.closest('#size-guide-toggle')) {
          state.sizeGuideOpen = !state.sizeGuideOpen;
          updateSizeGuidePanel();
          return;
        }
        var guideTab = event.target.closest('[data-guide-tab]');
        if (guideTab) {
          state.sizeGuideTab = guideTab.getAttribute('data-guide-tab') === 'kids' ? 'kids' : 'adult';
          updateSizeGuidePanel();
          return;
        }
        var guideSize = event.target.closest('[data-guide-size]');
        if (guideSize) {
          selectSize(guideSize.getAttribute('data-guide-size'));
          return;
        }
        var size = event.target.closest('[data-size]');
        if (size) {
          selectSize(size.getAttribute('data-size'));
          return;
        }
        var patch = event.target.closest('[data-patch]');
        if (patch) {
          selectPatch(patch.getAttribute('data-patch'));
          return;
        }
        var qty = event.target.closest('[data-qty]');
        if (qty) {
          changeProductQty(parseInt(qty.getAttribute('data-qty'), 10) || 0);
          return;
        }
        if (event.target.closest('#product-add')) addToCart();
      });

      info.addEventListener('input', function (event) {
        if (event.target.id === 'custom-name') {
          state.customName = event.target.value.slice(0, 14);
          updateCustomPreview();
          updateProductPricing();
        } else if (event.target.id === 'custom-number') {
          var cleaned = event.target.value.replace(/\D/g, '').slice(0, 2);
          if (event.target.value !== cleaned) event.target.value = cleaned;
          state.customNumber = cleaned;
          updateCustomPreview();
          updateProductPricing();
        }
      });
    }

    var thumbs = $('#product-thumbs');
    if (thumbs) {
      thumbs.addEventListener('click', function (event) {
        var button = event.target.closest('[data-photo]');
        if (button) selectPhoto(parseInt(button.getAttribute('data-photo'), 10));
      });
    }

    var main = $('#product-main-img');
    if (main) {
      main.addEventListener('click', function (event) {
        if (event.target.closest('#product-zoom') || event.target.tagName === 'IMG') {
          openLightbox(state.gallery[state.galleryIndex]);
        }
      });
    }

    var close = $('#product-close');
    if (close) close.addEventListener('click', closeProduct);
    var backdrop = $('#product-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeProduct);
  }

  // ── Carrito ──────────────────────────────────────────────

  function findCartLine(key) {
    return state.cart.filter(function (line) { return line.key === key; })[0] || null;
  }

  function addToCart() {
    var item = state.product;
    if (!item) return;
    if (!state.selectedSize) {
      toast('Elige una talla antes de continuar', 'error');
      return;
    }

    var name = item.custom ? String(state.customName || '').trim().toUpperCase().slice(0, 14) : '';
    var number = item.custom ? String(state.customNumber || '').replace(/\D/g, '').slice(0, 2) : '';
    var patches = item.custom ? state.patches : 'No';
    var key = [item.id, state.selectedSize, name, number, patches].join('|');
    var existing = findCartLine(key);

    if (existing) {
      existing.qty = Math.min(30, existing.qty + state.qty);
    } else {
      state.cart.push({
        key: key,
        id: item.id,
        size: state.selectedSize,
        qty: state.qty,
        name: name,
        number: number,
        patches: patches
      });
    }

    saveCart();
    updateCartUI();
    closeProduct();
    toast(cleanTitle(item) + ' añadido al carrito');
    setTimeout(openCart, 200);
  }

  function cartTotalItems() {
    return state.cart.reduce(function (sum, line) { return sum + (parseInt(line.qty, 10) || 0); }, 0);
  }

  function renderCartProgress(total) {
    var box = $('#cart-progress');
    if (!box) return;
    if (!total) {
      box.innerHTML = '';
      box.classList.remove('is-complete');
      return;
    }
    var remaining = Math.max(0, CART_PACK_TARGET - total);
    var pct = Math.min(100, Math.round((total / CART_PACK_TARGET) * 100));
    box.classList.toggle('is-complete', remaining === 0);
    box.innerHTML = '<div class="cart-progress-copy">' +
      (remaining === 0
        ? '<span><strong>Envío combinado listo</strong> · ' + total + ' prendas optimizan el envío</span><strong>100%</strong>'
        : '<span>Añade <strong>' + remaining + (remaining === 1 ? ' prenda más' : ' prendas más') + '</strong> para optimizar tu envío combinado (' + total + '/' + CART_PACK_TARGET + ')</span><strong>' + pct + '%</strong>') +
      '</div>' +
      '<div class="cart-progress-track"><div class="cart-progress-fill" style="width:' + pct + '%"></div></div>';
  }

  function updateCartUI() {
    var total = cartTotalItems();
    var count = $('#cart-count');
    if (count) {
      count.textContent = String(total);
      count.classList.toggle('is-empty', total === 0);
    }
    var titleCount = $('#cart-title-count');
    if (titleCount) titleCount.textContent = '(' + total + ')';
    var totalEl = $('#cart-total-items');
    if (totalEl) totalEl.textContent = total + (total === 1 ? ' artículo' : ' artículos');
    var priceEl = $('#cart-total-price');
    if (priceEl) priceEl.textContent = KangPricing.money(cartPriceCents());
    var foot = $('#cart-foot');
    if (foot) foot.hidden = total === 0;
    renderCartProgress(total);
    renderCartBody();
  }

  function renderCartBody() {
    var body = $('#cart-body');
    if (!body) return;

    if (!state.cart.length) {
      body.innerHTML = '<div class="cart-empty">' +
        '<svg><use href="#i-cart"/></svg>' +
        '<h3>Tu carrito está vacío</h3>' +
        '<p>Encuentra tu equipo, elige talla y personaliza tu camiseta con nombre y dorsal.</p>' +
        '<button class="btn btn-primary" type="button" id="cart-continue">Explorar catálogo</button>' +
        '</div>';
      return;
    }

    body.innerHTML = state.cart.map(function (line) {
      var item = state.byId.get(line.id);
      if (!item) return '';

      var customs = '<span>Talla ' + esc(line.size) + '</span>';
      if (line.name) customs += '<span>' + esc(line.name) + '</span>';
      if (line.number) customs += '<span>#' + esc(line.number) + '</span>';
      if (line.patches && line.patches !== 'No') customs += '<span>Parches: ' + esc(line.patches) + '</span>';

      var prices = linePricing(line, item);
      var displayTitle = cleanTitle(item);
      return '<article class="cart-item" data-cart-line="' + esc(line.key) + '">' +
        '<div class="cart-thumb"><img src="' + esc(coverUrl(item, 'small')) + '" alt="" loading="lazy"></div>' +
        '<div class="cart-item-copy">' +
          '<span class="cart-team">' + esc(item.team) + ' · ' + esc(item.season) + '</span>' +
          '<h4 title="' + esc(item.title) + '">' + esc(displayTitle) + '</h4>' +
          '<div class="cart-custom">' + customs + '</div>' +
          '<div class="cart-line-price">' + esc(KangPricing.money(prices.unitPriceCents)) + ' / unidad · Subtotal: <strong>' + esc(KangPricing.money(prices.unitPriceCents * line.qty)) + '</strong></div>' +
          '<div class="cart-item-foot">'+
            '<div class="qty">' +
              '<button type="button" data-cart-dec aria-label="Quitar una unidad"><svg><use href="#i-minus"/></svg></button>' +
              '<span>' + esc(line.qty) + '</span>' +
              '<button type="button" data-cart-inc aria-label="Añadir una unidad"><svg><use href="#i-plus"/></svg></button>' +
            '</div>' +
            '<button class="cart-remove" type="button" data-cart-remove aria-label="Quitar del carrito">' +
              '<svg><use href="#i-trash"/></svg></button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function changeCartQty(key, delta) {
    var line = findCartLine(key);
    if (!line) return;
    line.qty = Math.min(30, Math.max(1, (parseInt(line.qty, 10) || 1) + delta));
    saveCart();
    updateCartUI();
  }

  function removeCartLine(key) {
    state.cart = state.cart.filter(function (line) { return line.key !== key; });
    saveCart();
    updateCartUI();
    toast('Prenda eliminada del carrito');
  }

  function openCart() {
    var drawer = $('#cart-drawer');
    var backdrop = $('#cart-backdrop');
    if (!drawer || drawer.classList.contains('is-open')) return;
    renderCartBody();
    drawer.classList.add('is-open');
    setOverlayState(drawer, true);
    if (backdrop) {
      backdrop.hidden = false;
      requestAnimationFrame(function () { backdrop.classList.add('is-open'); });
    }
    lockScroll();
    setTimeout(function () {
      var close = $('#cart-close');
      if (close) close.focus();
    }, 220);
  }

  function closeCart() {
    var drawer = $('#cart-drawer');
    if (!drawer || !drawer.classList.contains('is-open')) return;
    releaseFocus(drawer);
    drawer.classList.remove('is-open');
    setOverlayState(drawer, false);
    var backdrop = $('#cart-backdrop');
    if (backdrop) {
      backdrop.classList.remove('is-open');
      setTimeout(function () { if (!backdrop.classList.contains('is-open')) backdrop.hidden = true; }, 320);
    }
    unlockScroll();
    var opener = $('#cart-open');
    if (opener) opener.focus();
  }

  function bindCartEvents() {
    var open = $('#cart-open');
    if (open) open.addEventListener('click', openCart);
    var close = $('#cart-close');
    if (close) close.addEventListener('click', closeCart);
    var backdrop = $('#cart-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeCart);

    var body = $('#cart-body');
    if (body) {
      body.addEventListener('click', function (event) {
        var line = event.target.closest('[data-cart-line]');
        var key = line ? line.getAttribute('data-cart-line') : '';
        if (event.target.closest('[data-cart-inc]')) {
          changeCartQty(key, 1);
          return;
        }
        if (event.target.closest('[data-cart-dec]')) {
          changeCartQty(key, -1);
          return;
        }
        if (event.target.closest('[data-cart-remove]')) {
          removeCartLine(key);
          return;
        }
        if (event.target.closest('#cart-continue')) {
          closeCart();
          location.hash = '#/catalogo';
        }
      });
    }

    var empty = $('#cart-empty-btn');
    if (empty) {
      empty.addEventListener('click', function () {
        if (!state.cart.length) return;
        state.cart = [];
        saveCart();
        updateCartUI();
        toast('Carrito vaciado');
      });
    }

    var checkout = $('#checkout-open');
    if (checkout) checkout.addEventListener('click', openCheckout);

    var cartOrdersBtn = $('#cart-orders-btn');
    if (cartOrdersBtn) {
      cartOrdersBtn.addEventListener('click', function () {
        closeCart();
        openOrders();
      });
    }
  }

  // ── Favoritos ────────────────────────────────────────────

  function toggleFavorite(id) {
    var key = String(id || '');
    if (!key || !state.byId.has(key)) return;
    var active;
    if (state.favSet.has(key)) {
      state.favSet.delete(key);
      state.favorites = state.favorites.filter(function (itemId) { return itemId !== key; });
      active = false;
      toast('Eliminado de favoritos');
    } else {
      state.favSet.add(key);
      state.favorites.unshift(key);
      active = true;
      toast('Guardado en favoritos');
    }
    saveFavorites();
    updateFavsUI();

    $$('[data-fav-toggle]').forEach(function (btn) {
      if (btn.getAttribute('data-fav-toggle') !== key) return;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
      if (btn.id === 'product-fav') {
        var span = btn.querySelector('span');
        if (span) span.textContent = active ? 'Guardado' : 'Favorito';
      }
    });

    if (state.route === 'catalog') {
      renderQuickFilters();
      if (state.filters.favs === '1') renderCatalog();
    }
  }

  function updateFavsUI() {
    var total = state.favorites.length;
    var count = $('#favs-count');
    if (count) {
      count.textContent = String(total);
      count.classList.toggle('is-empty', total === 0);
    }
    var titleCount = $('#favs-title-count');
    if (titleCount) titleCount.textContent = '(' + total + ')';
    var foot = $('#favs-foot');
    if (foot) foot.hidden = total === 0;
    renderFavsBody();
  }

  function renderFavsBody() {
    var body = $('#favs-body');
    if (!body) return;
    var valid = state.favorites.map(function (id) { return state.byId.get(id); }).filter(Boolean);
    if (!valid.length) {
      body.innerHTML = '<div class="cart-empty">' +
        '<svg><use href="#i-heart"/></svg>' +
        '<h3>Aún no tienes favoritos</h3>' +
        '<p>Pulsa el corazón en cualquier prenda para guardarla aquí y volver cuando quieras.</p>' +
        '<button class="btn btn-primary" type="button" id="favs-continue">Explorar catálogo</button>' +
        '</div>';
      return;
    }

    body.innerHTML = valid.map(function (item) {
      var title = cleanTitle(item);
      return '<article class="fav-item" data-fav-item="' + esc(item.id) + '">' +
        '<div class="fav-thumb" data-fav-open="' + esc(item.id) + '"><img src="' + esc(coverUrl(item, 'small')) + '" alt="" loading="lazy"></div>' +
        '<div class="fav-copy" data-fav-open="' + esc(item.id) + '">' +
          '<span>' + esc(item.team) + ' · ' + esc(item.season) + '</span>' +
          '<h4>' + esc(title) + '</h4>' +
          '<strong>' + esc(KangPricing.money(itemBasePriceCents(item))) + '</strong>' +
        '</div>' +
        '<button class="cart-remove" type="button" data-fav-toggle="' + esc(item.id) + '" aria-label="Quitar de favoritos"><svg><use href="#i-trash"/></svg></button>' +
      '</article>';
    }).join('');
  }

  function openFavs() {
    var drawer = $('#favs-drawer');
    var backdrop = $('#favs-backdrop');
    if (!drawer || drawer.classList.contains('is-open')) return;
    renderFavsBody();
    drawer.classList.add('is-open');
    setOverlayState(drawer, true);
    if (backdrop) {
      backdrop.hidden = false;
      requestAnimationFrame(function () { backdrop.classList.add('is-open'); });
    }
    lockScroll();
    setTimeout(function () { var close = $('#favs-close'); if (close) close.focus(); }, 220);
  }

  function closeFavs() {
    var drawer = $('#favs-drawer');
    if (!drawer || !drawer.classList.contains('is-open')) return;
    releaseFocus(drawer);
    drawer.classList.remove('is-open');
    setOverlayState(drawer, false);
    var backdrop = $('#favs-backdrop');
    if (backdrop) {
      backdrop.classList.remove('is-open');
      setTimeout(function () { if (!backdrop.classList.contains('is-open')) backdrop.hidden = true; }, 320);
    }
    unlockScroll();
  }

  function bindFavsEvents() {
    var open = $('#favs-open');
    if (open) open.addEventListener('click', openFavs);
    var close = $('#favs-close');
    if (close) close.addEventListener('click', closeFavs);
    var backdrop = $('#favs-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeFavs);

    var body = $('#favs-body');
    if (body) {
      body.addEventListener('click', function (event) {
        var openItem = event.target.closest('[data-fav-open]');
        if (openItem) {
          var id = openItem.getAttribute('data-fav-open');
          closeFavs();
          openProduct(id);
          return;
        }
        if (event.target.closest('#favs-continue')) {
          closeFavs();
          location.hash = '#/catalogo';
        }
      });
    }

    var viewCat = $('#favs-view-catalog');
    if (viewCat) viewCat.addEventListener('click', closeFavs);

    var clearBtn = $('#favs-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (!state.favorites.length) return;
        state.favorites = [];
        state.favSet.clear();
        saveFavorites();
        updateFavsUI();
        $$('[data-fav-toggle].is-active').forEach(function (el) {
          el.classList.remove('is-active');
          el.setAttribute('aria-pressed', 'false');
        });
        if (state.route === 'catalog') renderCatalog();
        toast('Favoritos vaciados');
      });
    }
  }

  // ── Pedidos recientes ────────────────────────────────────

  function updateOrdersUI() {
    var total = state.orders.length;
    var dot = $('#orders-dot');
    if (dot) dot.hidden = total === 0;
    var titleCount = $('#orders-title-count');
    if (titleCount) titleCount.textContent = '(' + total + ')';
    var foot = $('#orders-foot');
    if (foot) foot.hidden = total === 0;
    var cartBtn = $('#cart-orders-btn');
    if (cartBtn) cartBtn.hidden = total === 0;
    renderOrdersBody();
  }

  function renderOrdersBody() {
    var body = $('#orders-body');
    if (!body) return;
    if (!state.orders.length) {
      body.innerHTML = '<div class="cart-empty">' +
        '<svg><use href="#i-clock"/></svg>' +
        '<h3>Sin pedidos recientes</h3>' +
        '<p>Cuando envíes un pedido quedará guardado aquí para consultarlo o repetirlo en un clic.</p>' +
        '<button class="btn btn-primary" type="button" id="orders-continue">Explorar catálogo</button>' +
        '</div>';
      return;
    }

    body.innerHTML = state.orders.map(function (order) {
      var rows = (order.items || []).slice(0, 4).map(function (line) {
        var item = state.byId.get(String(line.id));
        var title = item ? cleanTitle(item) : (line.title || 'Prenda del catálogo');
        var thumb = item ? coverUrl(item, 'small') : '/placeholder.svg';
        var detail = 'Talla ' + esc(line.size) + ' · x' + esc(line.qty) +
          (line.name ? ' · ' + esc(line.name) : '') +
          (line.number ? ' #' + esc(line.number) : '');
        return '<div class="order-history-item">' +
          '<img src="' + esc(thumb) + '" alt="" loading="lazy">' +
          '<div class="order-history-item-copy"><b>' + esc(title) + '</b><small>' + detail + '</small></div>' +
        '</div>';
      }).join('');

      var extra = (order.items || []).length > 4 ? '<div class="order-history-item"><small>+ ' + (order.items.length - 4) + ' prendas más</small></div>' : '';

      return '<article class="order-history-card">' +
        '<div class="order-history-head">' +
          '<div><strong>PEDIDO ' + esc(order.id) + '</strong><span>' + esc(formatDate(order.createdAt)) + ' · ' + esc(order.totalItems || 0) + ' art.</span></div>' +
          '<strong class="order-history-total">' + esc(KangPricing.money(order.totalPriceCents || 0)) + '</strong>' +
        '</div>' +
        '<div class="order-history-items">' + rows + extra + '</div>' +
        '<div class="order-history-actions">' +
          '<button type="button" class="btn btn-primary" data-repeat-order="' + esc(order.id) + '">Repetir pedido</button>' +
          '<button type="button" class="btn-link" data-delete-order="' + esc(order.id) + '">Quitar</button>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function repeatOrder(orderId) {
    var order = state.orders.filter(function (row) { return String(row.id) === String(orderId); })[0];
    if (!order || !Array.isArray(order.items)) return;

    var added = 0;
    var skipped = 0;
    order.items.forEach(function (line) {
      var item = state.byId.get(String(line.id));
      if (!item) { skipped += 1; return; }
      var name = item.custom ? String(line.name || '').trim().toUpperCase().slice(0, 14) : '';
      var number = item.custom ? String(line.number || '').replace(/\D/g, '').slice(0, 2) : '';
      var patches = item.custom ? (line.patches || 'No') : 'No';
      var key = [item.id, line.size || 'M', name, number, patches].join('|');
      var existing = findCartLine(key);
      var qty = Math.min(30, Math.max(1, parseInt(line.qty, 10) || 1));
      if (existing) existing.qty = Math.min(30, existing.qty + qty);
      else state.cart.push({ key: key, id: item.id, size: line.size || 'M', qty: qty, name: name, number: number, patches: patches });
      added += qty;
    });

    if (!added) {
      toast('Las prendas de ese pedido ya no están disponibles', 'error');
      return;
    }

    saveCart();
    updateCartUI();
    closeOrders();
    openCart();
    toast(skipped ? 'Prendas disponibles añadidas (' + skipped + ' no disponibles)' : 'Pedido cargado en el carrito');
  }

  function openOrders() {
    var drawer = $('#orders-drawer');
    var backdrop = $('#orders-backdrop');
    if (!drawer || drawer.classList.contains('is-open')) return;
    renderOrdersBody();
    drawer.classList.add('is-open');
    setOverlayState(drawer, true);
    if (backdrop) {
      backdrop.hidden = false;
      requestAnimationFrame(function () { backdrop.classList.add('is-open'); });
    }
    lockScroll();
    setTimeout(function () { var close = $('#orders-close'); if (close) close.focus(); }, 220);
  }

  function closeOrders() {
    var drawer = $('#orders-drawer');
    if (!drawer || !drawer.classList.contains('is-open')) return;
    releaseFocus(drawer);
    drawer.classList.remove('is-open');
    setOverlayState(drawer, false);
    var backdrop = $('#orders-backdrop');
    if (backdrop) {
      backdrop.classList.remove('is-open');
      setTimeout(function () { if (!backdrop.classList.contains('is-open')) backdrop.hidden = true; }, 320);
    }
    unlockScroll();
  }

  function bindOrdersEvents() {
    var open = $('#orders-open');
    if (open) open.addEventListener('click', openOrders);
    var close = $('#orders-close');
    if (close) close.addEventListener('click', closeOrders);
    var backdrop = $('#orders-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeOrders);

    var body = $('#orders-body');
    if (body) {
      body.addEventListener('click', function (event) {
        var repeatBtn = event.target.closest('[data-repeat-order]');
        if (repeatBtn) {
          repeatOrder(repeatBtn.getAttribute('data-repeat-order'));
          return;
        }
        var delBtn = event.target.closest('[data-delete-order]');
        if (delBtn) {
          var id = delBtn.getAttribute('data-delete-order');
          state.orders = state.orders.filter(function (row) { return String(row.id) !== String(id); });
          saveOrders();
          updateOrdersUI();
          return;
        }
        if (event.target.closest('#orders-continue')) {
          closeOrders();
          location.hash = '#/catalogo';
        }
      });
    }

    var clearBtn = $('#orders-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        state.orders = [];
        saveOrders();
        updateOrdersUI();
        toast('Historial borrado');
      });
    }
  }

  // ── Pedido ───────────────────────────────────────────────

  function cartSummaryHtml() {
    return state.cart.map(function (line) {
      var item = state.byId.get(line.id);
      if (!item) return '';
      var detail = 'Talla ' + line.size + ' · x' + line.qty;
      if (line.name) detail += ' · ' + line.name;
      if (line.number) detail += ' #' + line.number;
      if (line.patches && line.patches !== 'No') detail += ' · ' + line.patches;
      var prices = linePricing(line, item);
      var displayTitle = cleanTitle(item);
      return '<div class="summary-item">' +
        '<img src="' + esc(coverUrl(item, 'small')) + '" alt="" loading="lazy">' +
        '<div class="summary-item-copy"><strong title="' + esc(item.title) + '">' + esc(displayTitle) + '</strong><span>' + esc(detail) + '</span><span>' + esc(KangPricing.money(prices.unitPriceCents)) + ' / unidad · Subtotal: ' + esc(KangPricing.money(prices.unitPriceCents * line.qty)) + '</span></div>' +
      '</div>';
    }).join('');
  }

  function renderCheckout() {
    var content = $('#checkout-content');
    if (!content) return;
    var total = cartTotalItems();
    var storeName = state.config && state.config.store && state.config.store.name ? state.config.store.name : 'KANG Team';
    var saved = state.customer || { name: '', phone: '', email: '', city: '', notes: '' };
    var hasSaved = !!(saved.name || saved.phone);

    content.innerHTML = '<div class="checkout-grid">' +
      '<div class="checkout-form-wrap">' +
        '<p class="eyebrow">Último paso</p>' +
        '<h2 id="checkout-title">Confirma tu pedido</h2>' +
        '<p class="checkout-sub">Déjanos tus datos y te escribimos para confirmar disponibilidad y envío. Sin pago online.</p>' +
        (hasSaved ? '<div class="checkout-autofill-note"><span>Datos rellenados de tu último pedido</span><button type="button" id="checkout-clear-customer">Usar otros datos</button></div>' : '') +
        '<form id="checkout-form" novalidate>' +
          '<div class="form-error" id="checkout-error" role="alert"></div>' +
          '<div class="form-grid">' +
            '<label class="field"><span>Nombre y apellidos *</span><input name="name" type="text" autocomplete="name" maxlength="80" value="' + esc(saved.name) + '" required></label>' +
            '<label class="field"><span>Teléfono / WhatsApp *</span><input name="phone" type="tel" autocomplete="tel" maxlength="30" value="' + esc(saved.phone) + '" required></label>' +
            '<label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" maxlength="120" value="' + esc(saved.email) + '"></label>' +
            '<label class="field"><span>Ciudad</span><input name="city" type="text" autocomplete="address-level2" maxlength="80" value="' + esc(saved.city) + '"></label>' +
            '<label class="field field-full"><span>Notas (dirección, talla, dudas…)</span><textarea name="notes" maxlength="600">' + esc(saved.notes) + '</textarea></label>' +
          '</div>' +
          '<label class="form-consent"><input type="checkbox" id="checkout-consent">' +
            '<span>Acepto que ' + esc(storeName) + ' me contacte por WhatsApp o email para confirmar el pedido. No se realiza ningún cobro online.</span></label>' +
          '<button class="btn btn-primary btn-block" id="checkout-submit" type="submit">Enviar pedido <svg><use href="#i-arrow"/></svg></button>' +
        '</form>' +
      '</div>' +
      '<aside class="checkout-summary">' +
        '<h3 class="summary-title">Tu selección <span>' + total + ' art.</span></h3>' +
        '<div class="summary-items">' + cartSummaryHtml() + '</div>' +
        '<div class="summary-totals">' +
          '<div><span>Artículos</span><strong>' + total + '</strong></div>' +
          '<div><span>Envío</span><strong>Por confirmar</strong></div>' +
          '<div><span>Total del pedido</span><strong>' + esc(KangPricing.money(cartPriceCents())) + '</strong></div>' +
        '</div>' +
        '<p class="summary-note">Los gastos de envío se confirman aparte. Puedes añadir o quitar prendas antes de enviar.</p>' +
      '</aside>' +
    '</div>';
  }

  function openCheckout() {
    if (!state.cart.length) {
      toast('Tu carrito está vacío', 'error');
      return;
    }
    closeCart();
    var modal = $('#checkout-modal');
    var backdrop = $('#checkout-backdrop');
    if (!modal) return;
    renderCheckout();
    if (!modal.classList.contains('is-open')) {
      modal.classList.add('is-open');
      setOverlayState(modal, true);
      if (backdrop) {
        backdrop.hidden = false;
        requestAnimationFrame(function () { backdrop.classList.add('is-open'); });
      }
      lockScroll();
    }
    setTimeout(function () {
      var input = $('#checkout-form input[name="name"]');
      if (input) input.focus();
    }, 240);
  }

  function closeCheckout() {
    var modal = $('#checkout-modal');
    if (!modal || !modal.classList.contains('is-open')) return;
    releaseFocus(modal);
    modal.classList.remove('is-open');
    setOverlayState(modal, false);
    var backdrop = $('#checkout-backdrop');
    if (backdrop) {
      backdrop.classList.remove('is-open');
      setTimeout(function () { if (!backdrop.classList.contains('is-open')) backdrop.hidden = true; }, 320);
    }
    unlockScroll();
  }

  function showCheckoutError(message) {
    var error = $('#checkout-error');
    if (!error) {
      toast(message, 'error');
      return;
    }
    error.textContent = message;
    error.classList.add('is-visible');
    try { error.scrollIntoView({ block: 'nearest' }); } catch (err) {}
  }

  function validateCheckout(form) {
    var name = form.elements.name.value.trim();
    var phone = form.elements.phone.value.trim();
    var email = form.elements.email.value.trim();
    var consent = $('#checkout-consent');

    if (name.length < 2) return 'Escribe tu nombre y apellidos.';
    if (phone.replace(/\D/g, '').length < 6) return 'Escribe un teléfono o WhatsApp válido.';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return 'El email no parece válido.';
    if (!consent || !consent.checked) return 'Marca la casilla para que podamos contactarte.';
    return '';
  }

  async function submitOrder(event) {
    event.preventDefault();
    var form = event.target;
    if (!form || form.id !== 'checkout-form') return;

    var error = validateCheckout(form);
    if (error) {
      showCheckoutError(error);
      return;
    }

    var button = $('#checkout-submit');
    var original = button ? button.innerHTML : '';
    if (button) {
      button.disabled = true;
      button.textContent = 'Enviando pedido…';
    }

    var payload = {
      customer: {
        name: form.elements.name.value.trim(),
        phone: form.elements.phone.value.trim(),
        email: form.elements.email.value.trim(),
        city: form.elements.city.value.trim(),
        notes: form.elements.notes.value.trim()
      },
      items: state.cart.map(function (line) {
        var item = state.byId.get(line.id);
        return {
          id: line.id,
          size: line.size,
          qty: line.qty,
          name: item && item.custom ? line.name : '',
          number: item && item.custom ? line.number : '',
          patches: item && item.custom ? line.patches : 'No'
        };
      })
    };

    try {
      var res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      var data = null;
      try { data = await res.json(); } catch (err) {}
      if (!res.ok) {
        throw new Error(data && data.error ? data.error : 'No se pudo enviar el pedido. Inténtalo de nuevo.');
      }

      saveCustomer(payload.customer);
      var snapshotItems = payload.items.map(function (line) {
        var item = state.byId.get(line.id);
        return Object.assign({}, line, { title: item ? cleanTitle(item) : '' });
      });
      state.orders.unshift({
        id: data && data.order && data.order.id ? data.order.id : String(Date.now()),
        createdAt: new Date().toISOString(),
        totalItems: payload.items.reduce(function (sum, l) { return sum + (parseInt(l.qty, 10) || 1); }, 0),
        totalPriceCents: data && data.order ? data.order.totalPriceCents : cartPriceCents(),
        items: snapshotItems
      });
      state.orders = state.orders.slice(0, 12);
      saveOrders();
      updateOrdersUI();

      state.lastOrder = data;
      state.cart = [];
      saveCart();
      updateCartUI();
      renderSuccess(data, payload.customer.name);
      toast('Pedido enviado correctamente');
    } catch (err) {
      showCheckoutError(err.message || 'No se pudo enviar el pedido. Revisa tu conexión e inténtalo de nuevo.');
      if (button) {
        button.disabled = false;
        button.innerHTML = original;
      }
    }
  }

  function renderSuccess(data, customerName) {
    var content = $('#checkout-content');
    if (!content) return;
    var id = data && data.order ? data.order.id : '';
    var text = data && data.text ? data.text : '';
    var wa = (data && data.whatsappUrl) || ('https://wa.me/?text=' + encodeURIComponent(text));
    var mail = (data && data.mailtoUrl) || ('mailto:?subject=' + encodeURIComponent('Pedido ' + id) + '&body=' + encodeURIComponent(text));
    var automatic = data && data.delivery && (data.delivery.email || data.delivery.whatsapp);

    content.innerHTML = '<div class="success-panel">' +
      '<div class="success-icon"><svg><use href="#i-check"/></svg></div>' +
      '<h2 id="checkout-title" tabindex="-1">Pedido recibido</h2>' +
      '<p>Gracias' + (customerName ? ', ' + esc(customerName) : '') + '. Hemos guardado tu pedido y te contactaremos para confirmar disponibilidad y envío.</p>' +
      (data && data.order ? '<p class="success-total">Total del pedido: <strong>' + esc(KangPricing.money(data.order.totalPriceCents)) + '</strong> · envío por confirmar</p>' : '') +
      '<span class="order-ref">PEDIDO ' + esc(id) + '</span>' +
      '<div class="success-actions">' +
        '<a class="btn btn-whatsapp" href="' + esc(wa) + '" target="_blank" rel="noopener"><svg><use href="#i-whatsapp"/></svg> Enviar por WhatsApp</a>' +
        '<a class="btn btn-outline" href="' + esc(mail) + '"><svg><use href="#i-mail"/></svg> Enviar por email</a>' +
        '<button class="btn btn-ghost" type="button" data-copy-order>Copiar resumen del pedido</button>' +
        '<a class="btn btn-ghost" href="#/catalogo" data-close-checkout>Seguir explorando</a>' +
      '</div>' +
      '<p class="success-note">' +
        (automatic ? 'También hemos intentado avisar a la tienda automáticamente. ' : 'Para asegurarte de que lo recibimos, envía el resumen con uno de los botones. ') +
        'Guarda tu número de pedido por si necesitas consultarnos.' +
      '</p>' +
    '</div>';

    var heading = content.querySelector('h2');
    if (heading) {
      try { heading.focus(); } catch (err) {}
    }
  }

  function copyText(text) {
    return new Promise(function (resolve, reject) {
      function fallback() {
        try {
          var area = document.createElement('textarea');
          area.value = text;
          area.setAttribute('readonly', '');
          area.style.position = 'fixed';
          area.style.opacity = '0';
          document.body.appendChild(area);
          area.select();
          var ok = document.execCommand('copy');
          document.body.removeChild(area);
          if (ok) resolve();
          else reject(new Error('No se pudo copiar'));
        } catch (err) {
          reject(err);
        }
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(resolve).catch(fallback);
      } else {
        fallback();
      }
    });
  }

  function bindCheckoutEvents() {
    var content = $('#checkout-content');
    if (content) {
      content.addEventListener('submit', submitOrder);
      content.addEventListener('click', function (event) {
        if (event.target.closest('#checkout-clear-customer')) {
          saveCustomer({ name: '', phone: '', email: '', city: '', notes: '' });
          renderCheckout();
        }
      });
    }
    var close = $('#checkout-close');
    if (close) close.addEventListener('click', closeCheckout);
    var backdrop = $('#checkout-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeCheckout);
  }

  // ── Lightbox ─────────────────────────────────────────────

  function openLightbox(path) {
    var box = $('#lightbox');
    var image = $('#lightbox-img');
    if (!box || !image) return;
    image.src = photoUrl(path, 'big', state.product && state.product.source);
    image.alt = state.product ? state.product.title : 'Imagen ampliada';
    box.classList.add('is-open');
    setOverlayState(box, true);
    lockScroll();
    var close = $('#lightbox-close');
    if (close) close.focus();
  }

  function closeLightbox() {
    var box = $('#lightbox');
    if (!box || !box.classList.contains('is-open')) return;
    releaseFocus(box);
    box.classList.remove('is-open');
    setOverlayState(box, false);
    unlockScroll();
    var zoom = $('#product-zoom');
    if (zoom) zoom.focus();
  }

  function stepGallery(delta) {
    if (!state.gallery.length) return;
    state.galleryIndex = (state.galleryIndex + delta + state.gallery.length) % state.gallery.length;
    renderGallery();
    var image = $('#lightbox-img');
    var box = $('#lightbox');
    if (image && box && box.classList.contains('is-open')) {
      image.src = photoUrl(state.gallery[state.galleryIndex], 'big', state.product && state.product.source);
    }
  }

  // ── Menú móvil ───────────────────────────────────────────

  function openMenu() {
    var menu = $('#mobile-menu');
    if (!menu || menu.classList.contains('is-open')) return;
    menu.classList.add('is-open');
    setOverlayState(menu, true);
    var opener = $('#menu-open');
    if (opener) opener.setAttribute('aria-expanded', 'true');
    lockScroll();
  }

  function closeMenu() {
    var menu = $('#mobile-menu');
    if (!menu || !menu.classList.contains('is-open')) return;
    releaseFocus(menu);
    menu.classList.remove('is-open');
    setOverlayState(menu, false);
    var opener = $('#menu-open');
    if (opener) opener.setAttribute('aria-expanded', 'false');
    unlockScroll();
    if (opener) opener.focus();
  }

  // ── Eventos globales ─────────────────────────────────────

  function handleEscape() {
    var lightbox = $('#lightbox');
    if (lightbox && lightbox.classList.contains('is-open')) return closeLightbox();
    var checkout = $('#checkout-modal');
    if (checkout && checkout.classList.contains('is-open')) return closeCheckout();
    var product = $('#product-modal');
    if (product && product.classList.contains('is-open')) return closeProduct();
    var cart = $('#cart-drawer');
    if (cart && cart.classList.contains('is-open')) return closeCart();
    var favs = $('#favs-drawer');
    if (favs && favs.classList.contains('is-open')) return closeFavs();
    var orders = $('#orders-drawer');
    if (orders && orders.classList.contains('is-open')) return closeOrders();
    var filters = $('#filters-drawer');
    if (filters && filters.classList.contains('is-open')) return closeFilters();
    var menu = $('#mobile-menu');
    if (menu && menu.classList.contains('is-open')) return closeMenu();
  }

  function bindGlobalEvents() {
    var menuOpen = $('#menu-open');
    if (menuOpen) menuOpen.addEventListener('click', openMenu);
    var menuClose = $('#menu-close');
    if (menuClose) menuClose.addEventListener('click', closeMenu);
    var mobileMenu = $('#mobile-menu');
    if (mobileMenu) {
      mobileMenu.addEventListener('click', function (event) {
        if (event.target.closest('a')) closeMenu();
      });
    }
    var mobileFavs = $('#mobile-favs-btn');
    if (mobileFavs) mobileFavs.addEventListener('click', function () { closeMenu(); openFavs(); });
    var mobileOrders = $('#mobile-orders-btn');
    if (mobileOrders) mobileOrders.addEventListener('click', function () { closeMenu(); openOrders(); });

    var lightbox = $('#lightbox');
    if (lightbox) {
      lightbox.addEventListener('click', function (event) {
        if (event.target === lightbox) closeLightbox();
      });
    }
    var lightboxClose = $('#lightbox-close');
    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);

    document.addEventListener('click', function (event) {
      var favBtn = event.target.closest('[data-fav-toggle]');
      if (favBtn) {
        event.stopPropagation();
        toggleFavorite(favBtn.getAttribute('data-fav-toggle'));
        return;
      }

      if (event.target.closest('[data-copy-order]')) {
        var text = state.lastOrder && state.lastOrder.text ? state.lastOrder.text : '';
        if (!text) return;
        copyText(text).then(function () {
          toast('Resumen copiado al portapapeles');
        }).catch(function () {
          toast('No se pudo copiar el resumen', 'error');
        });
        return;
      }

      if (event.target.closest('[data-close-checkout]')) {
        closeCheckout();
        return;
      }

      var card = event.target.closest('[data-product]');
      if (card) openProduct(card.getAttribute('data-product'));
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        handleEscape();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'K')) {
        event.preventDefault();
        if (state.route !== 'catalog') {
          location.hash = '#/catalogo?focus=search';
        } else {
          var search = $('#catalog-search');
          if (search) {
            search.focus();
            search.select();
          }
        }
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        var box = $('#lightbox');
        if (box && box.classList.contains('is-open')) {
          event.preventDefault();
          stepGallery(event.key === 'ArrowRight' ? 1 : -1);
        }
        return;
      }
    });

    window.addEventListener('hashchange', function () {
      var isProd = location.hash.indexOf('#/producto/') === 0;
      var product = $('#product-modal');
      if (!isProd && product && product.classList.contains('is-open')) closeProduct(true);
      var checkout = $('#checkout-modal');
      if (checkout && checkout.classList.contains('is-open')) closeCheckout();
      var menu = $('#mobile-menu');
      if (menu && menu.classList.contains('is-open')) closeMenu();
      renderRoute(!isProd);
    });
  }

  // ── Arranque ─────────────────────────────────────────────

  async function init() {
    var year = $('#year');
    if (year) year.textContent = String(new Date().getFullYear());

    state.cart = loadCart();
    state.favorites = loadFavorites();
    state.favSet = new Set(state.favorites);
    state.orders = loadOrders();
    state.customer = loadCustomer();
    state.galleryToken = 0;

    initOverlays();
    bindGlobalEvents();
    bindCatalogEvents();
    bindProductEvents();
    bindCartEvents();
    bindFavsEvents();
    bindOrdersEvents();
    bindCheckoutEvents();

    renderRoute(false);
    updateCartUI();
    updateFavsUI();
    updateOrdersUI();

    await Promise.all([loadConfig(), loadCatalog(), loadTeamLogos()]);

    state.cart = state.cart.filter(function (line) { return state.byId.has(line.id); });
    saveCart();
    state.favorites = state.favorites.filter(function (id) { return state.byId.has(id); });
    state.favSet = new Set(state.favorites);
    saveFavorites();
    updateCartUI();
    updateFavsUI();
    updateOrdersUI();
    renderRoute(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init().catch(function (err) {
      console.error('Error al iniciar el catálogo:', err);
      toast('No se pudo iniciar el catálogo. Recarga la página.', 'error');
    });
  }
})();
