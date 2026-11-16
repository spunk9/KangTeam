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
    player: 'Versión Jugador',
    gk: 'Portero',
    special: 'Edición especial'
  };
  var VERSION_LABELS = { fan: 'Versión Fan', player: 'Versión Jugador' };

  var SEASON_ORDER = ['27/28', '26/27', '25/26', '24/25', '23/24', '22/23', '21/22', '20/21', '2016-2019', '2010-2015', 'Retro', 'Sin temporada'];
  var SEASON_LABELS = { '2016-2019': '2016–2019', '2010-2015': '2010–2015', 'Sin temporada': 'Sin temporada' };

  var numberFormat = new Intl.NumberFormat('es-ES');
  var cartStorageKey = 'kang_cart_v1';
  var favsStorageKey = 'kang_favs_v1';
  var ordersStorageKey = 'kang_orders_v1';
  var customerStorageKey = 'kang_customer_v1';
  var CART_PACK_TARGET = 5;
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
    filters: { q: '', team: '', league: '', season: '', type: '', version: '', collection: '', department: '', subcategory: '', flag: '', price: '', favs: '', custom: '' },
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
    calcHeight: 175,
    calcWeight: 73,
    calcKidsHeight: 130,
    cart: [],
    favorites: [],
    favSet: new Set(),
    orders: [],
    customer: { name: '', phone: '', email: '', city: '', notes: '' },
    deliveryMethod: 'pickup_cordoba',
    appliedPromo: null,
    promoError: '',
    promoInput: '',
    promoLoading: false,
    suggestIndex: -1,
    lastOrder: null,
    overlayCount: 0,
    returnFocus: null,
    previewTimer: null,
    albumCache: new Map(),
    helpTopic: '',
    searchVocab: [],
    searchTokenCache: new Map(),
    versionCompareOpen: false,
    bulkOpen: false,
    bulkQtys: {},
    removedCartCount: 0,
    trackResult: null,
    trackError: '',
    trackLoading: false,
    trackQueryId: '',
    trackQueryPhone4: '',
    adminToken: '',
    adminOrders: [],
    adminStats: null,
    adminMeta: null,
    adminLoading: false,
    adminError: '',
    adminStatusFilter: '',
    adminSearch: '',
    adminNeedsToken: false,
    adminDeleteConfirmId: '',
    deferredInstallPrompt: null,
    analyticsInitialized: false
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

  var SEARCH_ALIASES = {
    barsa: ['barcelona', 'fc barcelona'],
    barca: ['barcelona', 'fc barcelona'],
    cule: ['barcelona'],
    atleti: ['atletico de madrid', 'atletico'],
    atletico: ['atletico de madrid'],
    pateti: ['atletico de madrid'],
    madrid: ['real madrid', 'atletico de madrid'],
    merengue: ['real madrid'],
    manu: ['manchester united'],
    united: ['manchester united'],
    city: ['manchester city'],
    juve: ['juventus'],
    psg: ['psg', 'paris saint germain'],
    paris: ['paris saint germain', 'psg'],
    bayern: ['bayern munich'],
    bayer: ['bayer leverkusen', 'bayern munich'],
    inter: ['inter de milan', 'inter milan', 'inter miami'],
    milan: ['ac milan', 'inter de milan'],
    spurs: ['tottenham'],
    gunners: ['arsenal'],
    blues: ['chelsea'],
    reds: ['liverpool', 'manchester united'],
    betis: ['real betis'],
    bilbao: ['athletic club'],
    athletic: ['athletic club'],
    espanol: ['espanyol', 'espana'],
    espana: ['spain', 'espana'],
    portero: ['gk', 'goalkeeper', 'portero'],
    arquero: ['gk', 'portero'],
    nino: ['kids', 'ninos'],
    ninos: ['kids', 'ninos'],
    infantil: ['kids', 'ninos'],
    mujer: ['women', 'mujer'],
    chica: ['women', 'mujer'],
    chicas: ['women', 'mujer'],
    larga: ['manga larga', 'long'],
    jugador: ['player'],
    player: ['player'],
    chandal: ['training', 'tracksuit', 'chandal'],
    sudadera: ['hoodie', 'sweatshirt', 'sudadera'],
    chaqueta: ['jacket', 'windbreaker', 'chaqueta'],
    retro: ['retro'],
    vintage: ['retro'],
    clasica: ['retro'],
    seleccion: ['selecciones'],
    selecciones: ['selecciones']
  };

  function expandQueryText(raw) {
    return normalize(raw)
      .replace(/\bman\s+u\b/g, 'manchester united')
      .replace(/\bman\s+united\b/g, 'manchester united')
      .replace(/\bman\s+city\b/g, 'manchester city')
      .replace(/\binter\s+milan\b/g, 'inter de milan')
      .replace(/\batleti\b/g, 'atletico de madrid');
  }

  function levenshteinWithin(a, b, maxDist) {
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > maxDist) return false;
    var prev = [], curr = [], i, j, cost;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      curr[0] = i;
      var rowMin = curr[0];
      for (j = 1; j <= lb; j++) {
        cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        if (curr[j] < rowMin) rowMin = curr[j];
      }
      if (rowMin > maxDist) return false;
      var tmp = prev; prev = curr; curr = tmp;
    }
    return prev[lb] <= maxDist;
  }

  function resolveSearchVariants(token) {
    if (!token) return [];
    if (state.searchTokenCache.has(token)) return state.searchTokenCache.get(token);
    var variants = [token];
    var aliasList = SEARCH_ALIASES[token];
    if (aliasList) {
      aliasList.forEach(function (alt) {
        if (variants.indexOf(alt) === -1) variants.push(alt);
      });
    }
    if (token.length >= 4 && state.searchVocab.length) {
      var maxDist = token.length >= 7 ? 2 : 1;
      for (var i = 0; i < state.searchVocab.length; i++) {
        var word = state.searchVocab[i];
        if (word === token || word.indexOf(token) !== -1) continue;
        if (levenshteinWithin(token, word, maxDist)) {
          variants.push(word);
          if (variants.length >= 8) break;
        }
      }
    }
    state.searchTokenCache.set(token, variants);
    return variants;
  }

  function textMatchesSearchTokens(haystack, tokens) {
    for (var t = 0; t < tokens.length; t++) {
      var variants = resolveSearchVariants(tokens[t]);
      var ok = false;
      for (var v = 0; v < variants.length; v++) {
        if (haystack.indexOf(variants[v]) !== -1) { ok = true; break; }
      }
      if (!ok) return false;
    }
    return true;
  }

  function itemMatchesQuery(item, rawQuery) {
    var clean = expandQueryText(rawQuery);
    if (!clean) return true;
    if (item._search.indexOf(clean) !== -1) return true;
    var tokens = clean.split(' ').filter(Boolean);
    return tokens.length ? textMatchesSearchTokens(item._search, tokens) : true;
  }

  function updateDocumentTitle(prefix) {
    var store = state.config && state.config.store ? state.config.store : {};
    var name = store.name || 'KANG Team';
    document.title = prefix ? (prefix + ' · ' + name) : (name + ' · Catálogo de camisetas, chándals y equipaciones');
  }

  var TEAM_STAR_PRESETS = {
    'real madrid': [['MBAPPÉ', '9'], ['VINICIUS JR', '7'], ['BELLINGHAM', '5'], ['VALVERDE', '8']],
    'fc barcelona': [['LAMINE YAMAL', '19'], ['PEDRI', '8'], ['RAPHINHA', '11'], ['LEWANDOWSKI', '9']],
    'barcelona': [['LAMINE YAMAL', '19'], ['PEDRI', '8'], ['RAPHINHA', '11'], ['LEWANDOWSKI', '9']],
    'atletico de madrid': [['GRIEZMANN', '7'], ['JULIAN ALVAREZ', '19'], ['BARRIOS', '8'], ['KOKE', '6']],
    'atletico madrid': [['GRIEZMANN', '7'], ['JULIAN ALVAREZ', '19'], ['BARRIOS', '8'], ['KOKE', '6']],
    'manchester city': [['HAALAND', '9'], ['RODRI', '16'], ['FODEN', '47'], ['MARMOUSH', '7']],
    'manchester united': [['BRUNO FERNANDES', '8'], ['GARNACHO', '17'], ['MAINOO', '37'], ['RASHFORD', '10']],
    'arsenal': [['SAKA', '7'], ['ODEGAARD', '8'], ['RICE', '41'], ['HAVERTZ', '29']],
    'liverpool': [['SALAH', '11'], ['VAN DIJK', '4'], ['MAC ALLISTER', '10'], ['LUIS DIAZ', '7']],
    'chelsea': [['PALMER', '20'], ['ENZO', '8'], ['CAICEDO', '25'], ['JAMES', '24']],
    'psg': [['DEMBELE', '10'], ['BARCOLA', '29'], ['VITINHA', '17'], ['HAKIMI', '2']],
    'paris saint germain': [['DEMBELE', '10'], ['BARCOLA', '29'], ['VITINHA', '17'], ['HAKIMI', '2']],
    'bayern munich': [['MUSIALA', '42'], ['KANE', '9'], ['KIMMICH', '6'], ['OLISE', '17']],
    'ac milan': [['RAFA LEAO', '10'], ['PULISIC', '11'], ['THEO', '19'], ['REIJNDERS', '14']],
    'inter de milan': [['LAUTARO', '10'], ['BARELLA', '23'], ['THURAM', '9'], ['DIMARCO', '32']],
    'juventus': [['YILDIZ', '10'], ['VLAHOVIC', '9'], ['BREMER', '3'], ['LOCATELLI', '5']],
    'real betis': [['ISCO', '22'], ['LO CELSO', '20'], ['ANTONY', '7'], ['BARTRA', '5']],
    'athletic club': [['NICO WILLIAMS', '10'], ['IÑAKI WILLIAMS', '9'], ['SANCET', '8'], ['VIVIAN', '3']],
    'espana': [['LAMINE YAMAL', '19'], ['NICO WILLIAMS', '11'], ['RODRI', '16'], ['PEDRI', '20']],
    'spain': [['LAMINE YAMAL', '19'], ['NICO WILLIAMS', '11'], ['RODRI', '16'], ['PEDRI', '20']],
    'argentina': [['MESSI', '10'], ['LAUTARO', '22'], ['JULIAN ALVAREZ', '9'], ['DI MARIA', '11']],
    'portugal': [['RONALDO', '7'], ['BRUNO', '8'], ['RAFA LEAO', '17'], ['BERNARDO', '10']],
    'francia': [['MBAPPÉ', '10'], ['GRIEZMANN', '7'], ['DEMBELE', '11'], ['CAMAVINGA', '6']],
    'brasil': [['VINICIUS JR', '7'], ['RAPHINHA', '11'], ['RODRYGO', '10'], ['NEYMAR JR', '10']],
    'inter miami': [['MESSI', '10'], ['SUAREZ', '9'], ['BUSQUETS', '5'], ['ALBA', '18']],
    'al nassr': [['RONALDO', '7'], ['MANE', '10'], ['BROZOVIC', '77'], ['DURAN', '9']]
  };

  function getTeamPresets(teamName) {
    var key = normalize(teamName || '');
    if (TEAM_STAR_PRESETS[key]) return TEAM_STAR_PRESETS[key];
    var keys = Object.keys(TEAM_STAR_PRESETS);
    for (var i = 0; i < keys.length; i++) {
      if (key && key.indexOf(keys[i]) !== -1) return TEAM_STAR_PRESETS[keys[i]];
    }
    return [['CAPITÁN', '10'], ['GOLEADOR', '9'], ['LEYENDA', '7'], ['CRACK', '11']];
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

  var TEAM_THEMES = {
    'real madrid': { bg: '#f6f5f0', bg2: '#dedbd2', ink: '#161b26', accent: '#d4af37' },
    'fc barcelona': { bg: '#0c235c', bg2: '#6d122d', ink: '#ffd23f', accent: '#edbb00' },
    'barcelona': { bg: '#0c235c', bg2: '#6d122d', ink: '#ffd23f', accent: '#edbb00' },
    'atletico de madrid': { bg: '#b81d24', bg2: '#7a1218', ink: '#ffffff', accent: '#1e3a8a' },
    'atletico madrid': { bg: '#b81d24', bg2: '#7a1218', ink: '#ffffff', accent: '#1e3a8a' },
    'sevilla': { bg: '#f4f4f2', bg2: '#dedede', ink: '#c4161c', accent: '#c4161c' },
    'real betis': { bg: '#0f7a3e', bg2: '#0a582c', ink: '#ffffff', accent: '#ffffff' },
    'athletic club': { bg: '#c8102e', bg2: '#890b20', ink: '#ffffff', accent: '#111111' },
    'real sociedad': { bg: '#1155a6', bg2: '#0c3b73', ink: '#ffffff', accent: '#e5e7eb' },
    'valencia': { bg: '#f5f4ef', bg2: '#dcdad2', ink: '#14171c', accent: '#f97316' },
    'villarreal': { bg: '#fde047', bg2: '#eab308', ink: '#0f2350', accent: '#0f2350' },
    'manchester city': { bg: '#6cabdd', bg2: '#4d8ec2', ink: '#0b1e36', accent: '#ffffff' },
    'manchester united': { bg: '#c8102e', bg2: '#8c0a1f', ink: '#ffffff', accent: '#fbbf24' },
    'arsenal': { bg: '#cf142b', bg2: '#940d1d', ink: '#ffffff', accent: '#f3f4f6' },
    'liverpool': { bg: '#b91c1c', bg2: '#7f1d1d', ink: '#f8fafc', accent: '#facc15' },
    'chelsea': { bg: '#0b4595', bg2: '#072f66', ink: '#ffffff', accent: '#93c5fd' },
    'tottenham': { bg: '#f6f6f3', bg2: '#dcdce0', ink: '#132257', accent: '#132257' },
    'psg': { bg: '#0f204b', bg2: '#091430', ink: '#ffffff', accent: '#dc2626' },
    'paris saint germain': { bg: '#0f204b', bg2: '#091430', ink: '#ffffff', accent: '#dc2626' },
    'bayern munich': { bg: '#c8102e', bg2: '#8e0b20', ink: '#ffffff', accent: '#f8fafc' },
    'bayern': { bg: '#c8102e', bg2: '#8e0b20', ink: '#ffffff', accent: '#f8fafc' },
    'borussia dortmund': { bg: '#fde100', bg2: '#eab308', ink: '#111111', accent: '#111111' },
    'juventus': { bg: '#f5f5f2', bg2: '#22252c', ink: '#111111', accent: '#d9ff3f' },
    'ac milan': { bg: '#b91c1c', bg2: '#171717', ink: '#ffffff', accent: '#ef4444' },
    'inter de milan': { bg: '#0a4898', bg2: '#0e172a', ink: '#ffffff', accent: '#38bdf8' },
    'inter milan': { bg: '#0a4898', bg2: '#0e172a', ink: '#ffffff', accent: '#38bdf8' },
    'napoli': { bg: '#1685d8', bg2: '#0d63a8', ink: '#ffffff', accent: '#ffffff' },
    'as roma': { bg: '#8a1538', bg2: '#5f0d26', ink: '#facc15', accent: '#facc15' },
    'espana': { bg: '#c8102e', bg2: '#930c22', ink: '#facc15', accent: '#facc15' },
    'spain': { bg: '#c8102e', bg2: '#930c22', ink: '#facc15', accent: '#facc15' },
    'argentina': { bg: '#75b8e8', bg2: '#f4f7fb', ink: '#0f294a', accent: '#fbbf24' },
    'brasil': { bg: '#facc15', bg2: '#eab308', ink: '#15803d', accent: '#16a34a' },
    'brazil': { bg: '#facc15', bg2: '#eab308', ink: '#15803d', accent: '#16a34a' },
    'francia': { bg: '#15397f', bg2: '#0d2556', ink: '#ffffff', accent: '#ef4444' },
    'france': { bg: '#15397f', bg2: '#0d2556', ink: '#ffffff', accent: '#ef4444' },
    'portugal': { bg: '#a61c24', bg2: '#165b33', ink: '#fde047', accent: '#fde047' },
    'alemania': { bg: '#f7f7f3', bg2: '#dadad2', ink: '#14171c', accent: '#ef4444' },
    'germany': { bg: '#f7f7f3', bg2: '#dadad2', ink: '#14171c', accent: '#ef4444' },
    'inglaterra': { bg: '#f8fafc', bg2: '#dbe4f0', ink: '#0f2c67', accent: '#dc2626' },
    'england': { bg: '#f8fafc', bg2: '#dbe4f0', ink: '#0f2c67', accent: '#dc2626' },
    'italia': { bg: '#1357a6', bg2: '#0c3b73', ink: '#ffffff', accent: '#93c5fd' },
    'italy': { bg: '#1357a6', bg2: '#0c3b73', ink: '#ffffff', accent: '#93c5fd' },
    'marruecos': { bg: '#b91c1c', bg2: '#166534', ink: '#fef08a', accent: '#22c55e' },
    'morocco': { bg: '#b91c1c', bg2: '#166534', ink: '#fef08a', accent: '#22c55e' }
  };

  function getTeamTheme(name) {
    var key = normalize(name || '');
    if (TEAM_THEMES[key]) return TEAM_THEMES[key];
    var keys = Object.keys(TEAM_THEMES);
    for (var i = 0; i < keys.length; i++) {
      if (key && key.indexOf(keys[i]) !== -1) return TEAM_THEMES[keys[i]];
    }
    var fallbackAccent = colorFor(name || 'KANG');
    return { bg: '#f6f4ee', bg2: '#d7d3c8', ink: '#14171c', accent: fallbackAccent };
  }

  function hexToRgba(hex, alpha) {
    var clean = String(hex || '').replace('#', '');
    if (clean.length === 3) clean = clean.split('').map(function (c) { return c + c; }).join('');
    if (!/^[0-9a-f]{6}$/i.test(clean)) return 'rgba(217, 255, 63, ' + alpha + ')';
    var r = parseInt(clean.slice(0, 2), 16);
    var g = parseInt(clean.slice(2, 4), 16);
    var b = parseInt(clean.slice(4, 6), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  }

  function hexLuminance(hex) {
    var clean = String(hex || '').replace('#', '');
    if (clean.length === 3) clean = clean.split('').map(function (c) { return c + c; }).join('');
    if (!/^[0-9a-f]{6}$/i.test(clean)) return 0;
    var r = parseInt(clean.slice(0, 2), 16) / 255;
    var g = parseInt(clean.slice(2, 4), 16) / 255;
    var b = parseInt(clean.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function applyTeamThemeVars(el, teamName) {
    if (!el) return;
    var props = ['--team-c1', '--team-c2', '--team-accent-safe', '--team-glow', '--team-glow-2', '--team-glow-soft', '--team-border'];
    if (!teamName) {
      el.classList.remove('has-team-theme');
      props.forEach(function (p) { el.style.removeProperty(p); });
      return;
    }
    var theme = getTeamTheme(teamName);
    var isLightBg = hexLuminance(theme.bg) > 0.65;
    var accentCand = hexLuminance(theme.accent) > 0.14 ? theme.accent : (hexLuminance(theme.bg) > 0.25 ? theme.bg : '#d9ff3f');
    var safeAccent = (accentCand === '#ffffff' || accentCand === '#f8fafc' || accentCand === '#f3f4f6' || accentCand === '#e5e7eb')
      ? '#f4f2ec'
      : accentCand;
    var glowSource = isLightBg && hexLuminance(theme.accent) > 0.14 ? theme.accent : (hexLuminance(theme.bg) > 0.14 ? theme.bg : safeAccent);
    var glow2Source = hexLuminance(theme.bg2) > 0.14 ? theme.bg2 : safeAccent;

    el.classList.add('has-team-theme');
    el.style.setProperty('--team-c1', theme.bg || safeAccent);
    el.style.setProperty('--team-c2', theme.bg2 || safeAccent);
    el.style.setProperty('--team-accent-safe', safeAccent);
    el.style.setProperty('--team-glow', hexToRgba(glowSource, 0.22));
    el.style.setProperty('--team-glow-2', hexToRgba(glow2Source, 0.16));
    el.style.setProperty('--team-glow-soft', hexToRgba(safeAccent, 0.14));
    el.style.setProperty('--team-border', hexToRgba(safeAccent, 0.45));
  }

  function renderPatchBadgesHtml(patchesText) {
    if (!patchesText || patchesText === 'No') return '';
    var colors = { Liga: '#ff6b4a', Champions: '#7dd3fc', Mundial: '#facc15', Copa: '#86efac', Personalizado: '#d9ff3f' };
    return patchesText.split(',').map(function (p) { return p.trim(); }).filter(Boolean).map(function (name) {
      var color = colors[name] || '#d9ff3f';
      return '<span class="jersey-patch-emblem" style="--patch-color:' + color + '">' +
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 13.5 3.8v4.1c0 3.2-2.2 5.6-5.5 6.8-3.3-1.2-5.5-3.6-5.5-6.8V3.8L8 1.5Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' +
        esc(name) + '</span>';
    }).join('');
  }

  function jerseyDorsalStroke(inkHex) {
    return hexLuminance(inkHex) > 0.45 ? 'rgba(8, 10, 14, 0.52)' : 'rgba(255, 255, 255, 0.55)';
  }

  function jerseyNameFontSize(nameText) {
    var len = String(nameText || '').length;
    if (len <= 7) return 25;
    if (len <= 9) return 22;
    if (len <= 11) return 19;
    if (len <= 13) return 16.5;
    return 15;
  }

  function jerseyNumberFontSize(numText) {
    return String(numText || '').length <= 1 ? 118 : 110;
  }

  function jerseyPatchColor(name) {
    var colors = { Liga: '#ff6b4a', Champions: '#7dd3fc', Mundial: '#facc15', Copa: '#86efac', Personalizado: '#d9ff3f' };
    return colors[name] || '#d9ff3f';
  }

  function renderJerseySleevePatchesSvg(patchesText, isLongSleeve) {
    if (!patchesText || patchesText === 'No') return '';
    var list = String(patchesText).split(',').map(function (p) { return p.trim(); }).filter(Boolean);
    if (!list.length) return '';
    var rPos = isLongSleeve ? 'translate(271 84) rotate(22)' : 'translate(267 88) rotate(26)';
    var lPos = isLongSleeve ? 'translate(49 84) rotate(-22)' : 'translate(53 88) rotate(-26)';
    function shieldSvg(pos, patchName) {
      var c = jerseyPatchColor(patchName);
      var abbr = patchName.slice(0, 3).toUpperCase();
      return '<g transform="' + pos + '">' +
        '<path d="M 0 -13 L 10 -8 V 2 C 10 8 5.5 12 0 14 C -5.5 12 -10 8 -10 2 V -8 Z" fill="#11161f" stroke="' + c + '" stroke-width="1.6"/>' +
        '<text x="0" y="3.5" text-anchor="middle" font-size="6.4" font-weight="800" letter-spacing="0.4" fill="' + c + '">' + esc(abbr) + '</text>' +
      '</g>';
    }
    var out = shieldSvg(rPos, list[0]);
    if (list.length > 1) out += shieldSvg(lPos, list[1]);
    return out;
  }

  function renderJerseyBackSvg(opts) {
    var id = opts.idPrefix || 'modal-kit';
    var theme = opts.theme || getTeamTheme('');
    var isLong = !!opts.isLongSleeve;
    var rawName = String(opts.name || '').trim().toUpperCase().slice(0, 14);
    var rawNum = String(opts.number || '').replace(/\D/g, '').slice(0, 2);
    var dispName = rawName || 'TU NOMBRE';
    var dispNum = rawNum || '10';
    var strokeCol = jerseyDorsalStroke(theme.ink);
    var accent = theme.accent || '#d9ff3f';

    var bodyPath = isLong
      ? 'M 122 22 Q 160 38 198 22 C 217 25 236 31 252 41 C 274 72 292 136 308 224 L 275 235 C 264 186 252 152 238 132 C 232 182 232 242 236 306 Q 160 318 84 306 C 88 242 88 182 82 132 C 68 152 56 186 45 235 L 12 224 C 28 136 46 72 68 41 C 84 31 103 25 122 22 Z'
      : 'M 122 22 Q 160 38 198 22 C 217 25 236 31 252 41 C 269 58 286 86 299 122 L 255 147 Q 245 141 238 132 C 232 182 232 242 236 306 Q 160 318 84 306 C 88 242 88 182 82 132 Q 75 141 65 147 L 21 122 C 34 86 51 58 68 41 C 84 31 103 25 122 22 Z';

    var cuffL = isLong
      ? 'M 12 224 L 45 235 L 47 227 L 14 216 Z'
      : 'M 21 122 L 65 147 L 69 140 L 24 115 Z';
    var cuffR = isLong
      ? 'M 308 224 L 275 235 L 273 227 L 306 216 Z'
      : 'M 299 122 L 255 147 L 251 140 L 296 115 Z';

    var armStrokeOpacity = hexLuminance(theme.bg) > 0.55 ? '0.14' : '0.24';
    var armStrokeColor = hexLuminance(theme.bg) > 0.55 ? 'rgba(0,0,0,' + armStrokeOpacity + ')' : 'rgba(255,255,255,' + armStrokeOpacity + ')';

    return '<svg class="product-jersey-svg" viewBox="0 0 320 340" role="presentation">' +
      '<defs>' +
        '<linearGradient id="' + id + '-grad" x1="0.15" y1="0" x2="0.85" y2="1">' +
          '<stop offset="0%" stop-color="' + esc(theme.bg) + '"/>' +
          '<stop offset="100%" stop-color="' + esc(theme.bg2 || theme.bg) + '"/>' +
        '</linearGradient>' +
        '<linearGradient id="' + id + '-sheen" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0%" stop-color="#000000" stop-opacity="0.13"/>' +
          '<stop offset="22%" stop-color="#ffffff" stop-opacity="0.05"/>' +
          '<stop offset="50%" stop-color="#ffffff" stop-opacity="0.14"/>' +
          '<stop offset="78%" stop-color="#ffffff" stop-opacity="0.04"/>' +
          '<stop offset="100%" stop-color="#000000" stop-opacity="0.15"/>' +
        '</linearGradient>' +
        '<linearGradient id="' + id + '-vert" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.08"/>' +
          '<stop offset="65%" stop-color="#000000" stop-opacity="0"/>' +
          '<stop offset="100%" stop-color="#000000" stop-opacity="0.14"/>' +
        '</linearGradient>' +
        '<filter id="' + id + '-shadow" x="-15%" y="-15%" width="130%" height="130%">' +
          '<feDropShadow dx="0" dy="2" stdDeviation="1.4" flood-color="#000000" flood-opacity="0.24"/>' +
        '</filter>' +
      '</defs>' +
      '<path d="M 122 22 Q 160 11 198 22 Q 160 36 122 22 Z" fill="#171b22"/>' +
      '<path d="' + bodyPath + '" fill="url(#' + id + '-grad)"/>' +
      '<path d="' + bodyPath + '" fill="url(#' + id + '-sheen)"/>' +
      '<path d="' + bodyPath + '" fill="url(#' + id + '-vert)"/>' +
      '<path d="M 82 132 C 95 182 96 242 92 307 L 84 306 C 88 242 88 182 82 132 Z" fill="rgba(0,0,0,0.08)"/>' +
      '<path d="M 238 132 C 225 182 224 242 228 307 L 236 306 C 232 242 232 182 238 132 Z" fill="rgba(0,0,0,0.08)"/>' +
      '<path d="M 120 27 Q 98 78 82 132" fill="none" stroke="' + armStrokeColor + '" stroke-width="1.2" stroke-linecap="round"/>' +
      '<path d="M 200 27 Q 222 78 238 132" fill="none" stroke="' + armStrokeColor + '" stroke-width="1.2" stroke-linecap="round"/>' +
      '<path d="M 85 301 Q 160 313 235 301" fill="none" stroke="' + armStrokeColor + '" stroke-width="1" stroke-dasharray="3 2"/>' +
      '<path d="M 120 22 Q 160 37 200 22 L 198 30 Q 160 47 122 30 Z" fill="' + esc(accent) + '"/>' +
      '<path d="' + cuffL + '" fill="' + esc(accent) + '"/>' +
      '<path d="' + cuffR + '" fill="' + esc(accent) + '"/>' +
      '<path d="' + bodyPath + '" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.15"/>' +
      '<path d="M 160 43 L 166 46 V 51 C 166 55 163.5 57.5 160 59 C 156.5 57.5 154 55 154 51 V 46 Z" fill="' + esc(theme.ink) + '" opacity="0.28"/>' +
      '<g id="product-preview-sleeve-patches">' + renderJerseySleevePatchesSvg(opts.patches, isLong) + '</g>' +
      '<g filter="url(#' + id + '-shadow)">' +
        '<text class="jersey-svg-name' + (rawName ? '' : ' is-placeholder') + '" id="product-preview-name" x="160" y="106" text-anchor="middle" font-size="' + jerseyNameFontSize(dispName) + '" fill="' + esc(theme.ink) + '" stroke="' + strokeCol + '">' + esc(dispName) + '</text>' +
        '<text class="jersey-svg-number' + (rawNum ? '' : ' is-placeholder') + '" id="product-preview-number" x="160" y="226" text-anchor="middle" font-size="' + jerseyNumberFontSize(dispNum) + '" fill="' + esc(theme.ink) + '" stroke="' + strokeCol + '">' + esc(dispNum) + '</text>' +
      '</g>' +
      '<path d="M 160 237 L 164 241 L 160 245 L 156 241 Z" fill="' + esc(accent) + '" opacity="0.85"/>' +
      '<text x="160" y="294" text-anchor="middle" font-size="7.5" font-weight="800" letter-spacing="2.8" fill="' + esc(theme.ink) + '" opacity="0.38">KANG TEAM · PRO</text>' +
    '</svg>';
  }

  function recommendSize(item, isKids, heightCm, weightKg) {
    if (isKids) {
      var kh = Number(heightCm) || 130;
      var kMatch = KIDS_SIZE_GUIDE[KIDS_SIZE_GUIDE.length - 1];
      for (var i = 0; i < KIDS_SIZE_GUIDE.length; i++) {
        var parts = KIDS_SIZE_GUIDE[i].height.split('–');
        var maxH = parseInt(parts[1] || parts[0], 10);
        if (kh <= maxH) { kMatch = KIDS_SIZE_GUIDE[i]; break; }
      }
      return { size: kMatch.size, reason: 'Altura ' + kh + ' cm · aprox. ' + kMatch.age };
    }
    var h = Number(heightCm) || 175;
    var w = Number(weightKg) || 73;
    var hIdx = 0;
    if (h >= 195) hIdx = 7;
    else if (h >= 191) hIdx = 5;
    else if (h >= 187) hIdx = 4;
    else if (h >= 182) hIdx = 3;
    else if (h >= 177) hIdx = 2;
    else if (h >= 172) hIdx = 1;

    var wIdx = 0;
    if (w >= 115) wIdx = 7;
    else if (w >= 106) wIdx = 6;
    else if (w >= 98) wIdx = 5;
    else if (w >= 90) wIdx = 4;
    else if (w >= 83) wIdx = 3;
    else if (w >= 75) wIdx = 2;
    else if (w >= 68) wIdx = 1;

    var idx = Math.max(hIdx, wIdx);
    var isPlayer = !!(item && Array.isArray(item.flags) && item.flags.indexOf('player') !== -1);
    if (isPlayer && idx < ADULT_SIZE_GUIDE.length - 1) idx += 1;

    var available = item ? expandSizes(item.sizeRange) : ADULT_SIZE_GUIDE.map(function (r) { return r.size; });
    var chosen = ADULT_SIZE_GUIDE[idx].size;
    if (available.length && available.indexOf(chosen) === -1) {
      for (var j = idx; j < ADULT_SIZE_GUIDE.length; j++) {
        if (available.indexOf(ADULT_SIZE_GUIDE[j].size) !== -1) { chosen = ADULT_SIZE_GUIDE[j].size; break; }
      }
      if (available.indexOf(chosen) === -1) chosen = available[available.length - 1];
    }
    return {
      size: chosen,
      reason: (isPlayer ? 'Corte Player ajustado (+1 talla sugerida)' : 'Ajuste estándar recomendado')
    };
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
    { size: '5XL', chest: '128–134', length: '84', height: '195–205', weight: '+115 kg', extra: '+3,00 €' }
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
    if (state.appliedPromo) {
      state.appliedPromo = null;
      state.promoError = '';
    }
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
      state.config = { store: { name: 'KANG Team', whatsapp: '34699234010', bizum: '699234010', bizumName: '', email: 'santol86@gmail.com', instagram: 'tolillo9', yupoo: 'https://minkang.x.yupoo.com/categories/712891' } };
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
    var vocabSet = Object.create(null);
    state.teams.forEach(function (team) {
      normalize(team.name + ' ' + team.league).split(' ').forEach(function (w) {
        if (w.length >= 4) vocabSet[w] = true;
      });
    });
    state.searchVocab = Object.keys(vocabSet);
    state.searchTokenCache.clear();
  }

  function applyConfig() {
    var store = state.config && state.config.store ? state.config.store : {};
    if (state.route === 'home') updateDocumentTitle('');

    var rawWa = (store.whatsapp || '').replace(/\D/g, '');
    var waNumber = (rawWa && rawWa !== '34600000000' && rawWa !== '600000000') ? rawWa : '34699234010';
    var waHref = 'https://wa.me/' + waNumber;
    ['cta-whatsapp', 'contact-whatsapp', 'footer-whatsapp', 'help-whatsapp'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.href = waHref;
        el.target = '_blank';
        el.rel = 'noopener';
      }
    });
    var rawEmail = (store.email || '').trim();
    var email = (rawEmail && rawEmail.toLowerCase() !== 'pedidos@tudominio.com') ? rawEmail : 'santol86@gmail.com';
    ['contact-email', 'footer-email'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.href = 'mailto:' + email;
        if (id === 'footer-email') el.textContent = email;
      }
    });

    var rawIg = (store.instagram || '').trim().replace(/^@/, '');
    var igHandle = (rawIg && rawIg.toLowerCase() !== 'kangteam') ? rawIg : 'tolillo9';
    var igHref = 'https://instagram.com/' + encodeURIComponent(igHandle);
    ['contact-instagram', 'footer-instagram'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.href = igHref;
        el.target = '_blank';
        el.rel = 'noopener';
        if (id === 'footer-instagram') el.textContent = 'Instagram (@' + igHandle + ')';
      }
    });

    var social = $('#footer-social');
    if (social) {
      var html = '';
      if (waNumber) html += '<a href="' + waHref + '" target="_blank" rel="noopener" aria-label="WhatsApp"><svg><use href="#i-whatsapp"/></svg></a>';
      if (email) html += '<a href="mailto:' + esc(email) + '" aria-label="Email"><svg><use href="#i-mail"/></svg></a>';
      if (igHandle) html += '<a href="' + igHref + '" target="_blank" rel="noopener" aria-label="Instagram"><svg><use href="#i-instagram"/></svg></a>';
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
    var cards = KangPricing.groups.map(function (group, index) {
      return '<article class="price-card">' +
        '<div class="price-card-head"><span>PRECIOS KANG TEAM</span><span>' + String(index + 1).padStart(2, '0') + '</span></div>' +
        '<h2>' + esc(group.title) + '</h2><ul>' + group.items.map(function (entry) {
        return '<li><span>' + esc(entry[0]) + '</span><strong>' + esc(KangPricing.money(entry[1])) + '</strong></li>';
      }).join('') + '</ul></article>';
    });
    cards.push(
      '<article class="price-card is-highlight">' +
        '<div class="price-card-head"><span>AHORRO Y ENTREGA</span><span>' + String(cards.length + 1).padStart(2, '0') + '</span></div>' +
        '<h2>Descuentos de grupo y entrega</h2>' +
        '<ul>' +
          '<li><span>De 5 a 9 prendas en el pedido</span><strong>-1,00 € / ud.</strong></li>' +
          '<li><span>De 10 a 14 prendas en el pedido</span><strong>-2,00 € / ud.</strong></li>' +
          '<li><span>15 o más prendas en el pedido</span><strong>-3,00 € / ud.</strong></li>' +
          '<li><span>Recogida en mano (Córdoba capital)</span><strong>Gratis (0,00 €)</strong></li>' +
          '<li><span>Plazo estimado tras pedir al proveedor</span><strong>2–3 semanas</strong></li>' +
        '</ul>' +
      '</article>'
    );
    target.innerHTML = cards.join('');
  }

  function linePricing(line, item) {
    return KangPricing.calculate(item, line);
  }

  function cartSubtotalCents() {
    return state.cart.reduce(function (sum, line) { var item = state.byId.get(line.id); return sum + (item ? linePricing(line, item).unitPriceCents * (parseInt(line.qty, 10) || 0) : 0); }, 0);
  }

  function cartVolumeDiscount() {
    if (window.KangPricing && typeof KangPricing.getVolumeDiscount === 'function') {
      return KangPricing.getVolumeDiscount(cartTotalItems());
    }
    return { tierMin: 0, perItemCents: 0, discountCents: 0, label: '' };
  }

  function cartPriceCents() {
    return Math.max(0, cartSubtotalCents() - cartVolumeDiscount().discountCents);
  }

  function navigate(path) {
    if (('#' + path) === location.hash) renderRoute(true);
    else location.hash = path;
  }

  function routeTitleForState() {
    if (state.route === 'catalog') {
      if (state.filters.team) return state.filters.team + ' · Catálogo';
      if (state.filters.collection === 'primavera-invierno') return 'Primavera / invierno';
      if (state.filters.version) return VERSION_LABELS[state.filters.version] || 'Catálogo';
      return 'Catálogo completo';
    }
    if (state.route === 'teams') return 'Equipos y selecciones';
    if (state.route === 'prices') return 'Tarifas y extras';
    if (state.route === 'how') return 'Cómo funciona';
    if (state.route === 'track') return 'Seguimiento de pedido';
    if (state.route === 'admin') return 'Gestión de pedidos';
    return '';
  }

  function renderRoute(scroll) {
    var route = parseRoute();
    var isProductRoute = route.path.indexOf('/producto/') === 0;
    var routeKeys = {
      '/': 'home',
      '/catalogo': 'catalog',
      '/equipos': 'teams',
      '/como-funciona': 'how',
      '/precios': 'prices',
      '/seguimiento': 'track',
      '/admin': 'admin'
    };
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
      var rawExtra = route.params.get('extra') || '';
      var rawVersion = route.params.get('version') || '';
      if (!rawVersion && rawExtra === 'player') {
        rawVersion = 'player';
        rawExtra = '';
      }
      state.filters = {
        q: route.params.get('q') || '',
        team: route.params.get('equipo') || '',
        league: route.params.get('liga') || '',
        season: route.params.get('temporada') || '',
        type: route.params.get('tipo') || '',
        version: rawVersion,
        collection: route.params.get('coleccion') || '',
        department: route.params.get('uso') || '',
        subcategory: route.params.get('subcategoria') || '',
        flag: rawExtra,
        price: route.params.get('precio') || '',
        favs: route.params.get('favoritos') || '',
        custom: route.params.get('personalizable') || ''
      };
      var sortParam = route.params.get('orden');
      if (sortParam && ['new', 'price-asc', 'price-desc', 'team', 'season', 'name'].indexOf(sortParam) !== -1) {
        state.sort = sortParam;
      }
      state.view = (route.params.get('vista') === 'grid' || !!route.params.get('equipo') || !!state.filters.favs || !!state.filters.price || !!state.filters.version || !!state.filters.custom) ? 'grid' : 'teams';
      state.groupPage = 1;
      state.gridPage = 1;
      if (state.items.length) {
        syncFilterInputs();
        renderCatalog();
      } else if (state.loading) {
        renderCatalogSkeletons();
      }
      applyTeamThemeVars($('#view-catalog'), state.filters.team || state.filters.league);
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
    } else if (route.path === '/seguimiento') {
      viewId = 'view-track';
      navKey = 'track';
      var qId = (route.params.get('id') || '').trim().toUpperCase();
      var qPhone4 = (route.params.get('phone4') || '').replace(/\D/g, '').slice(-4);
      if (qId) state.trackQueryId = qId;
      if (qPhone4) state.trackQueryPhone4 = qPhone4;
      renderTrackView();
      if (qId && qPhone4.length === 4) {
        lookupOrderTrack(qId, qPhone4);
      }
    } else if (route.path === '/admin') {
      viewId = 'view-admin';
      navKey = '';
      if (!state.adminToken) {
        try { state.adminToken = sessionStorage.getItem('kang_admin_token') || ''; } catch (e) {}
      }
      renderAdminView();
      loadAdminOrders();
    } else if (isProductRoute) {
      viewId = state.route === 'catalog' ? 'view-catalog' : 'view-home';
      navKey = state.route === 'catalog' ? 'catalog' : 'home';
      if (state.route === 'catalog' && state.items.length) {
        syncFilterInputs();
        renderCatalog();
      }
    }

    if (!isProductRoute) {
      updateDocumentTitle(routeTitleForState());
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
    if (state.filters.version) params.set('version', state.filters.version);
    if (state.filters.collection) params.set('coleccion', state.filters.collection);
    if (state.filters.department) params.set('uso', state.filters.department);
    if (state.filters.subcategory) params.set('subcategoria', state.filters.subcategory);
    if (state.filters.flag) params.set('extra', state.filters.flag);
    if (state.filters.price) params.set('precio', state.filters.price);
    if (state.filters.favs) params.set('favoritos', state.filters.favs);
    if (state.filters.custom) params.set('personalizable', state.filters.custom);
    if (state.sort && state.sort !== 'new') params.set('orden', state.sort);
    if (state.view === 'grid') params.set('vista', 'grid');
    var query = params.toString();
    var nextHash = '#/catalogo' + (query ? '?' + query : '');
    state.lastListHash = nextHash;
    try {
      history.replaceState(null, '', nextHash);
    } catch (err) {}
  }

  function pickTeamFeaturedItem(teamItems) {
    if (!teamItems || !teamItems.length) return null;
    var scored = teamItems.map(function (item) {
      var score = 0;
      if (item.type === 'jersey') score += 50;
      if (item.seasonGroup === '26/27') score += 30;
      else if (item.seasonGroup === '25/26') score += 20;
      if (/\bhome\b/i.test(item.title || '')) score += 16;
      if (!Array.isArray(item.flags) || item.flags.indexOf('kids') === -1) score += 8;
      if (Array.isArray(item.flags) && item.flags.indexOf('player') !== -1) score += 4;
      score += (Number(item.seasonSort) || 0) / 10000;
      return { item: item, score: score };
    }).sort(function (a, b) { return b.score - a.score; });
    return scored[0].item;
  }

  function updateCatalogIntro() {
    var teamName = state.filters.team;
    var isSeasonal = state.filters.collection === 'primavera-invierno';
    var eyebrow = $('#catalog-eyebrow');
    var title = $('#catalog-title');
    var lead = $('#catalog-lead');
    var navEl = $('#catalog-team-nav');
    var leagueEl = $('#catalog-team-league');
    var crestEl = $('#catalog-team-crest');
    var watermarkEl = $('#catalog-team-watermark');
    var shortcutsEl = $('#catalog-team-shortcuts');
    var featureEl = $('#catalog-team-feature');
    var stripeEl = $('#catalog-team-stripe');

    if (teamName) {
      var teamInfo = state.teams.get(teamName);
      var teamItems = state.items.filter(function (item) { return item.team === teamName; });
      var leagueName = (teamInfo && teamInfo.league) || (teamItems[0] && teamItems[0].league) || 'Club oficial';
      var logo = teamLogoUrl(teamName);
      var seasonsList = teamInfo ? Array.from(teamInfo.seasons.keys()).sort(function (a, b) {
        return SEASON_ORDER.indexOf(a) - SEASON_ORDER.indexOf(b);
      }).slice(0, 4).map(seasonLabel) : [];

      if (navEl) navEl.hidden = false;
      if (leagueEl) leagueEl.textContent = leagueName;
      if (eyebrow) eyebrow.textContent = leagueName === 'Selecciones' ? 'Selección nacional' : 'Equipaciones del club';
      if (title) title.innerHTML = esc(teamName);
      if (lead) {
        lead.textContent = teamItems.length
          ? fmt(teamItems.length) + ' prendas disponibles' + (seasonsList.length ? ' · Temporadas: ' + seasonsList.join(' · ') : '') + '.'
          : 'Cargando colección de ' + teamName + '…';
      }

      if (crestEl) {
        crestEl.hidden = false;
        crestEl.innerHTML = logo
          ? '<img src="' + esc(logo) + '" alt="Escudo de ' + esc(teamName) + '" onerror="this.remove();this.parentNode.innerHTML=this.parentNode.getAttribute(\'data-fallback\')" data-fallback="' + esc(teamMono(teamName)) + '">'
          : teamMono(teamName);
      }

      if (watermarkEl) {
        if (logo) {
          watermarkEl.hidden = false;
          watermarkEl.innerHTML = '<img src="' + esc(logo) + '" alt="" onerror="this.parentNode.hidden=true">';
        } else {
          watermarkEl.hidden = true;
          watermarkEl.innerHTML = '';
        }
      }

      if (stripeEl) stripeEl.hidden = false;

      if (shortcutsEl) {
        if (teamItems.length) {
          var c26 = teamItems.filter(function (i) { return i.seasonGroup === '26/27'; }).length;
          var cPlayer = teamItems.filter(function (i) { return matchesVersion(i, 'player'); }).length;
          var cFan = teamItems.filter(function (i) { return matchesVersion(i, 'fan'); }).length;
          var cRetro = teamItems.filter(function (i) { return Array.isArray(i.flags) && i.flags.indexOf('retro') !== -1; }).length;
          var cLong = teamItems.filter(function (i) { return Array.isArray(i.flags) && i.flags.indexOf('long') !== -1; }).length;
          var btns = [];
          if (c26) btns.push({ k: 'season', v: '26/27', label: 'Temporada 26/27', count: c26, active: state.filters.season === '26/27' });
          if (cFan) btns.push({ k: 'version', v: 'fan', label: 'Versión Fan', count: cFan, active: state.filters.version === 'fan' });
          if (cPlayer) btns.push({ k: 'version', v: 'player', label: 'Versión Jugador', count: cPlayer, active: state.filters.version === 'player' });
          if (cRetro) btns.push({ k: 'flag', v: 'retro', label: 'Retro', count: cRetro, active: state.filters.flag === 'retro' });
          if (cLong) btns.push({ k: 'flag', v: 'long', label: 'Manga larga', count: cLong, active: state.filters.flag === 'long' });
          shortcutsEl.hidden = !btns.length;
          shortcutsEl.innerHTML = btns.map(function (b) {
            return '<button type="button" class="team-shortcut-btn' + (b.active ? ' is-active' : '') + '" data-team-shortcut="' + esc(b.k + ':' + b.v) + '">' +
              esc(b.label) + ' <span>' + fmt(b.count) + '</span></button>';
          }).join('');
        } else {
          shortcutsEl.hidden = true;
          shortcutsEl.innerHTML = '';
        }
      }

      if (featureEl) {
        var featured = pickTeamFeaturedItem(teamItems);
        if (featured) {
          var fPrice = window.KangPricing ? KangPricing.money(itemBasePriceCents(featured)) : '';
          featureEl.hidden = false;
          featureEl.setAttribute('data-feature-product', featured.id);
          featureEl.setAttribute('role', 'button');
          featureEl.setAttribute('tabindex', '0');
          featureEl.innerHTML =
            '<div class="catalog-team-feature-thumb"><img src="' + esc(coverUrl(featured, 'small')) + '" alt="' + esc(cleanTitle(featured)) + '"></div>' +
            '<div class="catalog-team-feature-copy">' +
              '<span class="catalog-team-feature-kicker">Destacada · ' + esc(featured.season || featured.seasonGroup || 'Club') + '</span>' +
              '<strong>' + esc(cleanTitle(featured)) + '</strong>' +
              '<div class="catalog-team-feature-foot">' + (fPrice ? esc(fPrice) : '') + '<span>Ver y personalizar →</span></div>' +
            '</div>';
        } else {
          featureEl.hidden = true;
          featureEl.innerHTML = '';
        }
      }
      if (state.route === 'catalog') updateDocumentTitle(teamName + ' · Catálogo');
      return;
    }

    if (navEl) navEl.hidden = true;
    if (crestEl) { crestEl.hidden = true; crestEl.innerHTML = ''; }
    if (watermarkEl) { watermarkEl.hidden = true; watermarkEl.innerHTML = ''; }
    if (shortcutsEl) { shortcutsEl.hidden = true; shortcutsEl.innerHTML = ''; }
    if (featureEl) { featureEl.hidden = true; featureEl.innerHTML = ''; featureEl.removeAttribute('data-feature-product'); }
    if (stripeEl) stripeEl.hidden = true;

    if (eyebrow) eyebrow.textContent = isSeasonal ? 'Colección GXG' : 'Catálogo completo';
    if (title) title.innerHTML = isSeasonal ? 'Ropa de<br><em>primavera / invierno.</em>' : 'Toda la colección,<br><em>equipo a equipo.</em>';
    if (lead) lead.textContent = isSeasonal
      ? 'Ropa de entrenamiento y paseo para adultos y niños. Filtra por tipo de prenda, cierre y equipo.'
      : 'Camisetas, chándals, chaquetas y más. Filtra por equipo y temporada y encuentra tu próxima prenda.';
    if (state.route === 'catalog') updateDocumentTitle(routeTitleForState());
  }

  // ── Inicio ───────────────────────────────────────────────

  function skeletonCardsHtml(count) {
    var list = [];
    for (var i = 0; i < (count || 8); i++) {
      list.push('<div class="skeleton-card" aria-hidden="true"><div class="skeleton-thumb"></div><div class="skeleton-lines"><div class="skeleton-line w-40"></div><div class="skeleton-line w-85"></div><div class="skeleton-line w-60"></div></div></div>');
    }
    return list.join('');
  }

  function renderCatalogSkeletons() {
    var results = $('#catalog-results');
    if (results) results.innerHTML = '<div class="skeleton-grid">' + skeletonCardsHtml(8) + '</div>';
    var homeNew = $('#home-new');
    if (homeNew && !homeNew.children.length) {
      homeNew.innerHTML = skeletonCardsHtml(4);
    }
  }

  function renderHome() {
    if (!state.items.length) return;

    var total = $('#stat-total');
    var teams = $('#stat-teams');
    if (total) total.textContent = fmt(state.items.length);
    if (teams) teams.textContent = fmt(state.teams.size);

    renderHero();
    renderHomeSeasons();
    renderHomeNew();
    renderHomeCollections();
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
        (card.img ? imgTag(coverUrl(card.img, 'medium'), card.sub) + '<div class="img-skeleton" aria-hidden="true"></div>' : '') +
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

  function renderHomeCollections() {
    var container = $('#home-collections');
    if (!container || !state.items.length) return;
    var playerItems = state.items.filter(function (i) { return Array.isArray(i.flags) && i.flags.indexOf('player') !== -1; });
    var retroItems = state.items.filter(function (i) { return Array.isArray(i.flags) && i.flags.indexOf('retro') !== -1; });
    var kidsItems = state.items.filter(function (i) { return Array.isArray(i.flags) && i.flags.indexOf('kids') !== -1; });
    var winterItems = state.items.filter(function (i) { return i.collection === 'primavera-invierno'; });

    var cards = [
      { kicker: 'Pro Match', title: 'Versión Jugador', desc: 'Corte profesional entallado y tejido técnico.', href: '#/catalogo?version=player&vista=grid', items: playerItems, glow: 'rgba(217,255,63,.2)' },
      { kicker: 'Clásicas', title: 'Camisetas Retro', desc: 'Ediciones históricas que marcaron época.', href: '#/catalogo?extra=retro&vista=grid', items: retroItems, glow: 'rgba(255,176,46,.2)' },
      { kicker: 'Cantera', title: 'Conjuntos Niño', desc: 'Tallas infantiles 10–30 con camiseta y pantalón.', href: '#/catalogo?extra=kids&vista=grid', items: kidsItems, glow: 'rgba(125,211,252,.2)' },
      { kicker: 'Entreno', title: 'Chándals y Abrigo', desc: 'Sudaderas, cortavientos y chándals de club.', href: '#/catalogo?coleccion=primavera-invierno&vista=grid', items: winterItems, glow: 'rgba(134,239,172,.2)' }
    ];

    container.innerHTML = cards.map(function (c) {
      var sample = c.items[0] || state.items[0];
      return '<a class="matchday-card" href="' + c.href + '" style="--md-glow:' + c.glow + '">' +
        (sample ? imgTag(coverUrl(sample, 'medium'), c.title) : '') +
        '<div class="matchday-card-body">' +
          '<span class="matchday-kicker">' + esc(c.kicker) + ' · ' + fmt(c.items.length) + '</span>' +
          '<h3>' + esc(c.title) + '</h3>' +
          '<p>' + esc(c.desc) + '</p>' +
          '<span class="matchday-cta">Explorar <svg><use href="#i-arrow"/></svg></span>' +
        '</div>' +
      '</a>';
    }).join('');
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

    var isLongJersey = (item.type === 'jersey' || item.type === 'polo' || item.type === 'other') &&
      ((item.flags && item.flags.indexOf('long') !== -1) || /\b(long[-\s]?sleeves?d?|manga\s+larga)\b/i.test(item.title || ''));
    var favActive = isFavorite(item.id);
    var photoCount = parseInt(item.photos, 10) || 1;
    return '<article class="card" data-product="' + esc(item.id) + '" data-photos="' + photoCount + '">' +
      '<div class="card-media">' +
        '<button class="card-open" type="button" aria-label="Ver ' + esc(title) + '"></button>' +
        imgTag(coverUrl(item, 'small'), title) +
        '<div class="img-skeleton" aria-hidden="true"></div>' +
        '<div class="card-badges" aria-hidden="true">' + badges + '</div>' +
        (photoCount > 1 ? '<span class="card-photo-pill" aria-hidden="true">' + photoCount + ' fotos</span>' : '') +
        '<button class="card-fav' + (favActive ? ' is-active' : '') + '" type="button" data-fav-toggle="' + esc(item.id) + '" aria-pressed="' + favActive + '" aria-label="' + (favActive ? 'Quitar de favoritos ' : 'Guardar en favoritos ') + esc(title) + '"><svg><use href="#i-heart"/></svg></button>' +
        '<button class="card-quick" type="button" aria-label="Ver y personalizar ' + esc(title) + '"><svg><use href="#i-plus"/></svg></button>' +
      '</div>' +
      '<div class="card-body">' +
        '<div class="card-kicker"><span>' + esc(item.team) + '</span><span>' + esc(item.season) + '</span></div>' +
        '<h3 class="card-title" title="' + esc(item.title) + '">' + esc(title) + '</h3>' +
        (priceText ? '<div class="card-price-row"><strong class="card-price">' + esc(priceText) + '</strong><span class="card-price-note">' + esc(priceMeta) + '</span></div>' : '') +
        '<div class="card-foot"><span class="type-label">' + esc((item.subcategory || typeLabel(item.type)) + (isLongJersey && !item.subcategory ? ' · Manga larga' : '')) + '</span>' +
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
    var slides = [
      { name: 'TU NOMBRE', number: '10', team: 'Real Madrid', patch: 'Champions' },
      { name: 'MBAPPÉ', number: '9', team: 'Real Madrid', patch: 'Champions' },
      { name: 'LAMINE', number: '19', team: 'FC Barcelona', patch: 'Liga' },
      { name: 'VINICIUS', number: '7', team: 'Brasil', patch: 'Mundial' },
      { name: 'N. WILLIAMS', number: '11', team: 'España', patch: 'Mundial' }
    ];
    function applySlide(slide) {
      var theme = getTeamTheme(slide.team);
      var strokeCol = jerseyDorsalStroke(theme.ink);
      var s1 = $('#home-kit-stop1');
      var s2 = $('#home-kit-stop2');
      var collar = $('#home-kit-collar');
      var cuffL = $('#home-kit-cuff-l');
      var cuffR = $('#home-kit-cuff-r');
      var nape = $('#home-kit-nape');
      var numDot = $('#home-kit-num-dot');
      var brand = $('#home-kit-brand');
      var patchEl = $('#home-preview-patch');
      var nameEl = $('#preview-name');
      var numberEl = $('#preview-number');

      if (s1) s1.setAttribute('stop-color', theme.bg);
      if (s2) s2.setAttribute('stop-color', theme.bg2 || theme.bg);
      if (collar) collar.setAttribute('fill', theme.accent);
      if (cuffL) cuffL.setAttribute('fill', theme.accent);
      if (cuffR) cuffR.setAttribute('fill', theme.accent);
      if (nape) nape.setAttribute('fill', theme.ink);
      if (numDot) numDot.setAttribute('fill', theme.accent);
      if (brand) brand.setAttribute('fill', theme.ink);
      if (patchEl) {
        var pc = jerseyPatchColor(slide.patch);
        patchEl.innerHTML =
          '<path d="M 0 -13 L 10 -8 V 2 C 10 8 5.5 12 0 14 C -5.5 12 -10 8 -10 2 V -8 Z" fill="#11161f" stroke="' + pc + '" stroke-width="1.6"/>' +
          '<text x="0" y="3.5" text-anchor="middle" font-size="6.4" font-weight="800" letter-spacing="0.4" fill="' + pc + '">' + esc(slide.patch.slice(0, 3).toUpperCase()) + '</text>';
      }
      if (nameEl) {
        nameEl.textContent = slide.name;
        nameEl.setAttribute('font-size', String(jerseyNameFontSize(slide.name)));
        nameEl.setAttribute('fill', theme.ink);
        nameEl.setAttribute('stroke', strokeCol);
      }
      if (numberEl) {
        numberEl.textContent = slide.number;
        numberEl.setAttribute('font-size', String(jerseyNumberFontSize(slide.number)));
        numberEl.setAttribute('fill', theme.ink);
        numberEl.setAttribute('stroke', strokeCol);
      }
    }
    var index = 0;
    applySlide(slides[0]);
    state.previewTimer = setInterval(function () {
      if (state.route !== 'home') return;
      index = (index + 1) % slides.length;
      applySlide(slides[index]);
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

    var query = expandQueryText($('#teams-search') ? $('#teams-search').value : '');
    var qTokens = query ? query.split(' ').filter(Boolean) : [];
    var league = $('#teams-league') ? $('#teams-league').value : '';
    var teams = Array.from(state.teams.values()).filter(function (team) {
      if (league && team.league !== league) return false;
      if (qTokens.length && !textMatchesSearchTokens(normalize(team.name + ' ' + team.league), qTokens)) return false;
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

  function isPlayerVersionItem(item) {
    if (!item) return false;
    if (Array.isArray(item.flags) && item.flags.indexOf('player') !== -1) return true;
    return /\bplayer\s+(?:version|issue)\b/i.test(item.title || '');
  }

  function isJerseyVersionItem(item) {
    if (!item) return false;
    if (item.type === 'jersey') return true;
    if (item.type === 'polo' && /\bjersey\b/i.test(item.title || '')) return true;
    if (item.type === 'other' && /\b(jersey|jerse|long\s+sleeves?)\b/i.test(item.title || '')) return true;
    return false;
  }

  function matchesVersion(item, version) {
    if (!version) return true;
    if (version === 'player') return isPlayerVersionItem(item);
    if (version === 'fan') return isJerseyVersionItem(item) && !isPlayerVersionItem(item);
    return true;
  }

  function getFilteredItems() {
    var q = state.filters.q || '';
    var team = state.filters.team;
    var league = state.filters.league;
    var season = state.filters.season;
    var type = state.filters.type;
    var version = state.filters.version;
    var collection = state.filters.collection;
    var department = state.filters.department;
    var subcategory = state.filters.subcategory;
    var flag = state.filters.flag;
    var price = state.filters.price;
    var onlyFavs = state.filters.favs === '1';
    var onlyCustom = state.filters.custom === '1';

    var items = state.items.filter(function (item) {
      if (onlyFavs && !isFavorite(item.id)) return false;
      if (onlyCustom && !item.custom) return false;
      if (team && item.team !== team) return false;
      if (league && item.league !== league) return false;
      if (season && item.seasonGroup !== season) return false;
      if (type && item.type !== type) return false;
      if (version && !matchesVersion(item, version)) return false;
      if (collection && item.collection !== collection) return false;
      if (department && item.department !== department) return false;
      if (subcategory && item.subcategory !== subcategory) return false;
      if (flag && (!Array.isArray(item.flags) || item.flags.indexOf(flag) === -1)) return false;
      if (price && !matchesPriceBand(item, price)) return false;
      if (q && !itemMatchesQuery(item, q)) return false;
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
    if (filters.version) params.set('version', filters.version);
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
    chips.push('<button type="button" class="quick-chip' + (state.filters.custom === '1' ? ' is-active' : '') + '" data-quick-custom aria-pressed="' + (state.filters.custom === '1') + '">Personalizable</button>');
    chips.push('<button type="button" class="quick-chip' + (state.filters.season === '26/27' ? ' is-active' : '') + '" data-quick-season="26/27" aria-pressed="' + (state.filters.season === '26/27') + '">Nueva 26/27</button>');
    chips.push('<span class="quick-chip-sep" aria-hidden="true"></span>');
    [
      ['fan', 'Versión Fan'],
      ['player', 'Versión Jugador']
    ].forEach(function (entry) {
      var active = state.filters.version === entry[0];
      chips.push('<button type="button" class="quick-chip' + (active ? ' is-active' : '') + '" data-quick-version="' + entry[0] + '" aria-pressed="' + active + '">' + entry[1] + '</button>');
    });
    chips.push('<span class="quick-chip-sep" aria-hidden="true"></span>');
    [
      ['kids', 'Niños'],
      ['women', 'Mujer'],
      ['retro', 'Retro']
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
    if (!state.items.length) {
      if (state.loading) renderCatalogSkeletons();
      return;
    }
    var results = $('#catalog-results');
    if (!results) return;

    applyTeamThemeVars($('#view-catalog'), state.filters.team || state.filters.league);

    var items = getFilteredItems();
    var useGrid = state.view === 'grid' || !!state.filters.team || !!state.filters.favs || !!state.filters.price || !!state.filters.version || !!state.filters.custom || state.sort === 'price-asc' || state.sort === 'price-desc';

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
    return ['q', 'team', 'league', 'season', 'type', 'version', 'collection', 'department', 'subcategory', 'flag', 'price', 'favs', 'custom'].filter(function (key) {
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
    function chip(key, label, extraAttr) {
      return '<span class="filter-chip"' + (extraAttr ? ' ' + extraAttr : '') + '>' + esc(label) +
        '<button type="button" data-clear-filter="' + key + '" aria-label="Quitar filtro ' + esc(label) + '">' +
        '<svg><use href="#i-close"/></svg></button></span>';
    }

    if (state.filters.q) chips.push(chip('q', 'Búsqueda: ' + state.filters.q));
    if (state.filters.team) chips.push(chip('team', 'Equipo: ' + state.filters.team, 'data-team-chip'));
    if (state.filters.league) chips.push(chip('league', 'Liga: ' + state.filters.league));
    if (state.filters.season) chips.push(chip('season', 'Temporada: ' + seasonLabel(state.filters.season)));
    if (state.filters.type) chips.push(chip('type', 'Tipo: ' + typeLabel(state.filters.type)));
    if (state.filters.version) chips.push(chip('version', 'Versión: ' + (VERSION_LABELS[state.filters.version] || state.filters.version)));
    if (state.filters.collection) chips.push(chip('collection', 'Colección: ' + (COLLECTION_LABELS[state.filters.collection] || state.filters.collection)));
    if (state.filters.department) chips.push(chip('department', 'Uso: ' + (DEPARTMENT_LABELS[state.filters.department] || state.filters.department)));
    if (state.filters.subcategory) chips.push(chip('subcategory', state.filters.subcategory));
    if (state.filters.flag) chips.push(chip('flag', 'Extra: ' + flagLabel(state.filters.flag)));
    if (state.filters.price) chips.push(chip('price', 'Precio: ' + (PRICE_BAND_LABELS[state.filters.price] || state.filters.price)));
    if (state.filters.favs) chips.push(chip('favs', 'Solo favoritos'));
    if (state.filters.custom) chips.push(chip('custom', 'Personalizable'));

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
    if (('flag' in patch && state.filters.flag) || ('price' in patch && state.filters.price) || ('favs' in patch && state.filters.favs) || ('version' in patch && state.filters.version) || ('custom' in patch && state.filters.custom)) {
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
    state.filters = { q: '', team: '', league: '', season: '', type: '', version: '', collection: '', department: '', subcategory: '', flag: '', price: '', favs: '', custom: '' };
    state.gridPage = 1;
    state.groupPage = 1;
    syncFilterInputs();
    renderCatalog();
    updateCatalogHash();
    updateCatalogIntro();
  }

  // ── Opciones de filtro ───────────────────────────────────

  function itemsForFacet(excludedFilter) {
    var q = state.filters.q || '';
    var onlyFavs = state.filters.favs === '1';
    return state.items.filter(function (item) {
      if (excludedFilter !== 'favs' && onlyFavs && !isFavorite(item.id)) return false;
      if (excludedFilter !== 'custom' && state.filters.custom === '1' && !item.custom) return false;
      if (excludedFilter !== 'team' && state.filters.team && item.team !== state.filters.team) return false;
      if (excludedFilter !== 'league' && state.filters.league && item.league !== state.filters.league) return false;
      if (excludedFilter !== 'season' && state.filters.season && item.seasonGroup !== state.filters.season) return false;
      if (excludedFilter !== 'type' && state.filters.type && item.type !== state.filters.type) return false;
      if (excludedFilter !== 'version' && state.filters.version && !matchesVersion(item, state.filters.version)) return false;
      if (excludedFilter !== 'collection' && state.filters.collection && item.collection !== state.filters.collection) return false;
      if (excludedFilter !== 'department' && state.filters.department && item.department !== state.filters.department) return false;
      if (excludedFilter !== 'subcategory' && state.filters.subcategory && item.subcategory !== state.filters.subcategory) return false;
      if (excludedFilter !== 'flag' && state.filters.flag && (!Array.isArray(item.flags) || item.flags.indexOf(state.filters.flag) === -1)) return false;
      if (excludedFilter !== 'price' && state.filters.price && !matchesPriceBand(item, state.filters.price)) return false;
      if (excludedFilter !== 'q' && q && !itemMatchesQuery(item, q)) return false;
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

  function versionOptionsHtml(items) {
    var list = items || itemsForFacet('version');
    var fanCount = 0;
    var playerCount = 0;
    list.forEach(function (item) {
      if (matchesVersion(item, 'player')) playerCount += 1;
      else if (matchesVersion(item, 'fan')) fanCount += 1;
    });
    return '<option value="">Todas las versiones</option>' +
      '<option value="fan">Versión Fan (' + fmt(fanCount) + ')</option>' +
      '<option value="player">Versión Jugador (' + fmt(playerCount) + ')</option>';
  }

  function populateFilterOptions() {
    var body = $('#filters-drawer-body');
    if (body) {
      body.innerHTML =
        '<label class="searchbox"><svg><use href="#i-search"/></svg>' +
          '<input type="search" id="drawer-search" placeholder="Busca una prenda o equipo…" autocomplete="off"></label>' +
        '<p class="filter-section-title">Versión de camiseta</p>' +
        '<div class="filter-chips" id="drawer-versions">' +
          '<button type="button" data-drawer-version="">Todas</button>' +
          '<button type="button" data-drawer-version="fan">Versión Fan</button>' +
          '<button type="button" data-drawer-version="player">Versión Jugador</button>' +
        '</div>' +
        '<p class="filter-section-title">Filtros rápidos</p>' +
        '<div class="filter-chips" id="drawer-quick-flags">' +
          '<button type="button" data-drawer-flag="kids">Niños</button>' +
          '<button type="button" data-drawer-flag="women">Mujer</button>' +
          '<button type="button" data-drawer-flag="retro">Retro</button>' +
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
      ['filter-version', versionOptionsHtml(itemsForFacet('version'))],
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
    setSelect('filter-version', state.filters.version);
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

    $$('#drawer-versions button').forEach(function (button) {
      button.classList.toggle('is-active', (button.getAttribute('data-drawer-version') || '') === (state.filters.version || ''));
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

    var q = expandQueryText(rawQuery);
    if (q.length < 2 || !state.items.length) {
      hideSearchSuggest();
      return;
    }

    var tokens = q.split(' ').filter(Boolean);
    var teams = Array.from(state.teams.values())
      .filter(function (team) {
        return team.name !== 'Otros' && textMatchesSearchTokens(normalize(team.name), tokens);
      })
      .sort(function (a, b) {
        var aStart = normalize(a.name).indexOf(q) === 0 ? 0 : 1;
        var bStart = normalize(b.name).indexOf(q) === 0 ? 0 : 1;
        return (aStart - bStart) || (b.count - a.count);
      })
      .slice(0, 4);

    var leagues = Array.from(state.leagues.entries())
      .filter(function (row) { return textMatchesSearchTokens(normalize(row[0]), tokens); })
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 2);

    var products = [];
    for (var i = 0; i < state.items.length && products.length < 5; i++) {
      var item = state.items[i];
      if (textMatchesSearchTokens(item._search, tokens)) products.push(item);
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
        if (event.target.closest('[data-quick-custom]')) {
          applyFilters({ custom: state.filters.custom === '1' ? '' : '1' });
          return;
        }
        var seasonBtn = event.target.closest('[data-quick-season]');
        if (seasonBtn) {
          var seasonVal = seasonBtn.getAttribute('data-quick-season');
          applyFilters({ season: state.filters.season === seasonVal ? '' : seasonVal });
          return;
        }
        var versionBtn = event.target.closest('[data-quick-version]');
        if (versionBtn) {
          var version = versionBtn.getAttribute('data-quick-version');
          applyFilters({ version: state.filters.version === version ? '' : version });
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
        var map = { 'filter-league': 'league', 'filter-team': 'team', 'filter-season': 'season', 'filter-type': 'type', 'filter-version': 'version', 'filter-collection': 'collection', 'filter-department': 'department', 'filter-subcategory': 'subcategory' };
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
        var version = event.target.closest('[data-drawer-version]');
        if (version) {
          var vVal = version.getAttribute('data-drawer-version');
          applyFilters({ version: vVal && state.filters.version === vVal ? '' : vVal });
          return;
        }
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

    var teamBackBtn = $('#catalog-team-back');
    if (teamBackBtn) {
      teamBackBtn.addEventListener('click', function () {
        state.view = 'teams';
        applyFilters({ team: '' });
      });
    }

    var teamShortcuts = $('#catalog-team-shortcuts');
    if (teamShortcuts) {
      teamShortcuts.addEventListener('click', function (event) {
        var btn = event.target.closest('[data-team-shortcut]');
        if (!btn) return;
        var pair = btn.getAttribute('data-team-shortcut').split(':');
        var k = pair[0];
        var v = pair[1];
        if (!k || !v) return;
        var patch = {};
        patch[k] = state.filters[k] === v ? '' : v;
        applyFilters(patch);
      });
    }

    var teamFeature = $('#catalog-team-feature');
    if (teamFeature) {
      var openFeatured = function () {
        var id = teamFeature.getAttribute('data-feature-product');
        if (id) openProduct(id);
      };
      teamFeature.addEventListener('click', openFeatured);
      teamFeature.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openFeatured();
        }
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
    ['product-modal', 'cart-drawer', 'favs-drawer', 'orders-drawer', 'filters-drawer', 'checkout-modal', 'pwa-ios-modal', 'mobile-menu', 'lightbox'].forEach(function (id) {
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
    state.versionCompareOpen = false;
    state.bulkOpen = false;
    state.bulkQtys = {};
    state.sizeGuideTab = isKidsItem(item) ? 'kids' : 'adult';

    var sizes = expandSizes(item.sizeRange);
    state.selectedSize = sizes.indexOf('M') !== -1 ? 'M' : (sizes[0] || 'S');
    updateDocumentTitle(cleanTitle(item) + ' · ' + item.team);

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
    applyTeamThemeVars(modal, item.team);

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
    applyTeamThemeVars(modal, '');
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
    updateDocumentTitle(routeTitleForState());
    if (state.returnFocus && state.returnFocus.isConnected) {
      try { state.returnFocus.focus(); } catch (err) {}
    }
    state.returnFocus = null;
  }

  function normalizeAlbumImages(album, item) {
    var images = (album && Array.isArray(album.images) ? album.images : []).map(function (path) {
      var value = String(path || '').replace(/^https?:\/\/photo\.yupoo\.com/i, '');
      if (!value) return '';
      if (value.charAt(0) !== '/') value = '/' + value;
      if (!/\.(jpg|jpeg|png|webp)$/i.test(value)) value += '/big.jpg';
      return value;
    }).filter(Boolean);

    if (images.length) {
      var cover = item && item.cover ? item.cover : '';
      var ordered = images.slice();
      var coverIndex = -1;
      for (var i = 0; i < ordered.length; i++) {
        if (cover && ordered[i].indexOf(cover + '/') === 0) { coverIndex = i; break; }
      }
      if (coverIndex > 0) {
        var first = ordered.splice(coverIndex, 1)[0];
        ordered.unshift(first);
      }
      return ordered.slice(0, 20);
    }
    return [];
  }

  async function fetchAlbumCached(item) {
    var id = item.albumId || item.id;
    var cacheKey = (item.source || 'minkang') + '-' + id;
    if (state.albumCache.has(cacheKey)) return state.albumCache.get(cacheKey);
    var res = await fetch('/api/album/' + encodeURIComponent(id) + (item.source === 'gxg' ? '?source=gxg' : ''), { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return [];
    var album = await res.json();
    var ordered = normalizeAlbumImages(album, item);
    state.albumCache.set(cacheKey, ordered);
    return ordered;
  }

  async function loadAlbum(item) {
    var token = state.galleryToken;
    try {
      var ordered = await fetchAlbumCached(item);
      if (token !== state.galleryToken || !state.product || String(state.product.id) !== String(item.id)) return;
      if (ordered.length) {
        state.gallery = ordered;
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
    var hasMulti = state.gallery.length > 1;
    var navHtml = hasMulti
      ? '<button class="gallery-nav-btn is-prev" type="button" data-gallery-step="-1" aria-label="Foto anterior"><svg><use href="#i-arrow-left"/></svg></button>' +
        '<button class="gallery-nav-btn is-next" type="button" data-gallery-step="1" aria-label="Foto siguiente"><svg><use href="#i-arrow"/></svg></button>' +
        '<span class="gallery-counter">' + (state.galleryIndex + 1) + ' / ' + state.gallery.length + '</span>'
      : '';
    main.innerHTML = imgTag(photoUrl(path, 'big', item.source), item.title, { eager: true }) +
      '<div class="img-skeleton" aria-hidden="true"></div>' +
      navHtml +
      '<button class="product-zoom" id="product-zoom" type="button" aria-label="Ampliar imagen">' +
      '<svg><use href="#i-zoom"/></svg></button>';

    if (thumbs) {
      thumbs.style.display = hasMulti ? '' : 'none';
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
    var hasSpecialSizes = /(?:3XL|4XL|5XL)/.test(String(item.sizeRange || ''));

    var baseLabel = item.subcategory || typeLabel(item.type);
    if (calc.isLongSleeve && !item.subcategory) baseLabel += ' · Manga larga (+3,00 € incl.)';
    var rows = [];
    rows.push('<div class="price-breakdown-row"><span>Precio base (' + esc(baseLabel) + ')</span><strong>' + esc(KangPricing.money(calc.basePriceCents)) + '</strong></div>');

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
      rows.push('<div class="price-breakdown-row is-muted"><span>Tallas especiales (3XL / 4XL / 5XL)</span><strong>Opcional (+3,00 €)</strong></div>');
    }

    if (qty > 1) {
      rows.push('<div class="price-breakdown-row is-active"><span>Cantidad (' + qty + ' × ' + esc(KangPricing.money(calc.unitPriceCents)) + ')</span><strong>' + esc(KangPricing.money(totalCents)) + '</strong></div>');
    }

    var inCartQty = cartTotalItems();
    var projectedQty = inCartQty + qty;
    var vol = (typeof KangPricing.getVolumeDiscount === 'function')
      ? KangPricing.getVolumeDiscount(projectedQty)
      : { discountCents: 0, perItemCents: 0, label: '' };
    var nextVol = (typeof KangPricing.nextVolumeTier === 'function')
      ? KangPricing.nextVolumeTier(projectedQty)
      : null;
    var volPct = nextVol ? Math.min(100, Math.round((projectedQty / nextVol.minQty) * 100)) : 100;
    var volCopy = '';
    if (vol.perItemCents > 0) {
      volCopy = '<strong>Descuento grupo activo (-' + esc(KangPricing.money(vol.perItemCents)) + '/ud.)</strong> · Ahorrarías <strong>-' + esc(KangPricing.money(vol.discountCents)) + '</strong> en tu pedido' +
        (nextVol ? ' · +' + (nextVol.minQty - projectedQty) + ' más para -' + esc(KangPricing.money(nextVol.perItemCents)) + '/ud.' : '');
    } else if (nextVol) {
      var needMore = nextVol.minQty - projectedQty;
      volCopy = (inCartQty > 0 ? 'Con tu carrito llevarías <strong>' + projectedQty + '/' + nextVol.minQty + ' uds.</strong> · ' : '') +
        'Añade <strong>' + needMore + (needMore === 1 ? ' prenda más' : ' prendas más') + '</strong> para aplicar <strong>-' + esc(KangPricing.money(nextVol.perItemCents)) + '/ud.</strong>';
    }
    var volHtml = volCopy
      ? '<div class="product-volume-progress' + (vol.perItemCents > 0 ? ' is-complete' : '') + '" id="product-volume-progress">' +
          '<div class="product-volume-copy">' + volCopy + '</div>' +
          '<div class="cart-progress-track"><div class="cart-progress-fill" style="width:' + volPct + '%"></div></div>' +
        '</div>'
      : '';

    return '<div class="product-price-head">' +
        '<div><span class="product-price-label">' + (qty > 1 ? 'Total (' + qty + ' uds.)' : 'Precio total') + '</span>' +
        '<strong class="product-price-main">' + esc(KangPricing.money(totalCents)) + '</strong></div>' +
        (qty > 1 ? '<span class="product-price-unit">' + esc(KangPricing.money(calc.unitPriceCents)) + ' / ud.</span>' : (calc.unitPriceCents > calc.basePriceCents ? '<span class="product-price-unit">Base ' + esc(KangPricing.money(calc.basePriceCents)) + '</span>' : '<span class="product-price-unit">Sin extras</span>')) +
      '</div>' +
      '<div class="price-breakdown">' + rows.join('') + '</div>' +
      volHtml;
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
    if (state.bulkOpen) updateBulkPanel();
  }

  function renderSizeGuideHtml() {
    var item = state.product;
    var available = item ? expandSizes(item.sizeRange) : [];
    var tab = state.sizeGuideTab === 'kids' ? 'kids' : 'adult';
    var isKids = tab === 'kids';
    var rec = recommendSize(item, isKids, isKids ? state.calcKidsHeight : state.calcHeight, state.calcWeight);
    var recAvailable = !available.length || available.indexOf(rec.size) !== -1;

    var tableRows = isKids ? KIDS_SIZE_GUIDE.map(function (row) {
      var isAvailable = available.indexOf(row.size) !== -1;
      var isCurrent = state.selectedSize === row.size;
      var isRec = rec.size === row.size;
      var cls = (isCurrent ? 'is-current ' : '') + (isRec ? 'is-recommended ' : '') + (isAvailable ? 'is-available' : 'is-unavailable');
      return '<tr class="' + cls.trim() + '"' + (isAvailable ? ' data-guide-size="' + esc(row.size) + '" title="Seleccionar talla ' + esc(row.size) + '"' : '') + '>' +
        '<td><strong>' + esc(row.size) + '</strong></td>' +
        '<td>' + esc(row.age) + '</td>' +
        '<td>' + esc(row.height) + ' cm</td>' +
        '<td>' + esc(row.chest) + ' cm</td>' +
      '</tr>';
    }).join('') : ADULT_SIZE_GUIDE.map(function (row) {
      var isAvailable = available.indexOf(row.size) !== -1;
      var isCurrent = state.selectedSize === row.size;
      var isRec = rec.size === row.size;
      var cls = (isCurrent ? 'is-current ' : '') + (isRec ? 'is-recommended ' : '') + (isAvailable ? 'is-available' : 'is-unavailable');
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
      : 'Medidas orientativas (±2 cm). En Versión Jugador (Player), el corte es más entallado: si dudas entre dos tallas, sube una. Tallas 3XL, 4XL y 5XL suman +3,00 €.';

    var calcHtml = '<div class="size-calc-box">' +
      '<div class="size-calc-top"><strong>Calculador rápido de talla</strong></div>' +
      (isKids
        ? '<div class="size-calc-inputs" style="grid-template-columns:1fr">' +
            '<div class="size-calc-field">' +
              '<label for="calc-kids-height"><span>Altura aprox.</span><b id="calc-kids-height-val">' + state.calcKidsHeight + ' cm</b></label>' +
              '<input id="calc-kids-height" type="range" min="80" max="170" step="2" value="' + state.calcKidsHeight + '">' +
            '</div>' +
          '</div>'
        : '<div class="size-calc-inputs">' +
            '<div class="size-calc-field">' +
              '<label for="calc-height"><span>Altura</span><b id="calc-height-val">' + state.calcHeight + ' cm</b></label>' +
              '<input id="calc-height" type="range" min="155" max="205" step="1" value="' + state.calcHeight + '">' +
            '</div>' +
            '<div class="size-calc-field">' +
              '<label for="calc-weight"><span>Peso</span><b id="calc-weight-val">' + state.calcWeight + ' kg</b></label>' +
              '<input id="calc-weight" type="range" min="50" max="125" step="1" value="' + state.calcWeight + '">' +
            '</div>' +
          '</div>') +
      '<div class="size-calc-result">' +
        '<span>Talla recomendada: <strong id="calc-rec-size">' + esc(rec.size) + '</strong> <small>(' + esc(rec.reason) + ')</small></span>' +
        (recAvailable ? '<button type="button" class="size-calc-apply" id="calc-apply-btn" data-apply-rec-size="' + esc(rec.size) + '">Usar ' + esc(rec.size) + '</button>' : '') +
      '</div>' +
    '</div>';

    return '<div class="size-guide-head">' +
        '<div class="size-guide-tabs" role="tablist" aria-label="Guía de tallas">' +
          '<button type="button" role="tab" aria-selected="' + (!isKids) + '" class="' + (!isKids ? 'is-active' : '') + '" data-guide-tab="adult">Adulto (S–5XL)</button>' +
          '<button type="button" role="tab" aria-selected="' + isKids + '" class="' + (isKids ? 'is-active' : '') + '" data-guide-tab="kids">Niños (10–30)</button>' +
        '</div>' +
        '<span class="size-guide-legend">Toca una talla disponible para elegirla</span>' +
      '</div>' +
      calcHtml +
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

    var teamTheme = getTeamTheme(item.team);
    var patchBadgesHtml = renderPatchBadgesHtml(state.patches);
    var isLongJersey = (window.KangPricing && KangPricing.calculate(item, {}).isLongSleeve) ||
      /\b(long[-\s]?sleeves?d?|manga\s+larga)\b/i.test(item.title || '') ||
      (Array.isArray(item.flags) && item.flags.indexOf('long') !== -1);
    var jerseySvgHtml = renderJerseyBackSvg({
      idPrefix: 'modal-kit',
      theme: teamTheme,
      name: state.customName,
      number: state.customNumber,
      patches: state.patches,
      isLongSleeve: isLongJersey
    });

    var presets = item.custom ? getTeamPresets(item.team) : [];
    var presetsHtml = presets.length
      ? '<div class="custom-presets">' +
          '<span class="custom-presets-label">Estrellas:</span>' +
          presets.map(function (pair) {
            var active = state.customName.toUpperCase() === pair[0] && String(state.customNumber) === pair[1];
            return '<button type="button" class="preset-btn' + (active ? ' is-active' : '') + '" data-preset-name="' + esc(pair[0]) + '" data-preset-number="' + esc(pair[1]) + '">' +
              esc(pair[0]) + ' <b>#' + esc(pair[1]) + '</b></button>';
          }).join('') +
        '</div>'
      : '';

    var customPanel = item.custom ?
      '<div class="custom-panel">' +
        '<div class="custom-panel-head"><strong>Nombre y dorsal</strong>' +
          '<span><svg><use href="#i-spark"/></svg> +2,00 €</span></div>' +
        presetsHtml +
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
            '<div class="product-jersey-stage" id="product-jersey-stage">' + jerseySvgHtml + '</div>' +
            '<div class="product-jersey-meta">' +
              (isLongJersey ? '<span class="product-jersey-sleeve-tag">Manga larga</span>' : '') +
              '<div class="jersey-patch-badges" id="product-preview-patches">' + (patchBadgesHtml || '<span class="product-jersey-patches">Vista previa ' + esc(item.team) + '</span>') + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<p class="custom-note"><svg><use href="#i-shield"/></svg> Nombre y dorsal: +2,00 € por prenda. Cada parche añade 1,00 €. El nombre se imprime en mayúsculas y el dorsal debe ser del 0 al 99.</p>' +
      '</div>' :
      '<div class="not-customizable"><svg><use href="#i-shirt"/></svg>' +
        '<span>Esta prenda no admite nombre ni dorsal. Solo necesitas elegir la talla.</span></div>';

    var showCompare = isJerseyVersionItem(item);
    var isPlayerItem = isPlayerVersionItem(item);
    var compareHtml = showCompare
      ? '<div class="version-compare-wrap">' +
          '<button type="button" class="version-compare-toggle" id="version-compare-toggle" aria-expanded="' + (state.versionCompareOpen ? 'true' : 'false') + '" aria-controls="version-compare-panel">' +
            '<span>Versión actual: <strong>' + (isPlayerItem ? 'Jugador (Player)' : 'Fan (Estadio)') + '</strong></span>' +
            '<small>Comparar Fan vs Jugador →</small>' +
          '</button>' +
          '<div class="version-compare-panel" id="version-compare-panel"' + (state.versionCompareOpen ? '' : ' hidden') + '>' + (state.versionCompareOpen ? renderVersionCompareHtml(item) : '') + '</div>' +
        '</div>'
      : '';

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
      compareHtml +
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
      '<div class="bulk-order-wrap">' +
        '<button type="button" class="bulk-toggle-btn" id="bulk-order-toggle" aria-expanded="' + (state.bulkOpen ? 'true' : 'false') + '" aria-controls="bulk-order-panel">' +
          '<span>¿Pedido para grupo, equipo o peña? Varias tallas a la vez</span>' +
          '<b>' + (state.bulkOpen ? 'Ocultar' : 'Abrir') + '</b>' +
        '</button>' +
        '<div class="bulk-panel" id="bulk-order-panel"' + (state.bulkOpen ? '' : ' hidden') + '>' + (state.bulkOpen ? renderBulkPanelHtml() : '') + '</div>' +
      '</div>' +
      (function () {
        var st = state.config && state.config.store ? state.config.store : {};
        var bNum = bizumDisplayNumber(st.bizum || '699234010');
        var bFmt = formatBizumPhone(st.bizum || '699234010');
        return '<div class="product-bizum-tip">' +
          '<span>Bizum directo <strong>' + esc(bFmt) + '</strong> · Recogida gratis en Córdoba (2–3 sem.)</span>' +
          '<button type="button" class="bizum-copy-btn" data-copy-value="' + esc(bNum) + '" data-copy-label="Teléfono Bizum (' + esc(bFmt) + ') copiado">Copiar Bizum</button>' +
        '</div>';
      }()) +
      '<p class="product-disclaimer">Sin comisiones. Confirmamos pago Bizum, disponibilidad y recogida por WhatsApp o email.</p>';

    updateProductPricing();
  }

  function renderVersionCompareHtml(item) {
    var isPlayer = isPlayerVersionItem(item);
    var altVersion = isPlayer ? 'fan' : 'player';
    var altLabel = isPlayer ? 'Ver camisetas Fan de ' + item.team : 'Ver camisetas Jugador de ' + item.team;
    return '<div class="version-compare-grid">' +
        '<div class="version-compare-col' + (!isPlayer ? ' is-current' : '') + '">' +
          '<div class="version-col-head"><strong>Versión Fan (Estadio)</strong>' + (!isPlayer ? '<span>Esta ficha</span>' : '') + '</div>' +
          '<ul>' +
            '<li><b>Corte:</b> Clásico, cómodo y algo más holgado.</li>' +
            '<li><b>Escudo y logo:</b> Bordados o aplicados tradicionales, gran durabilidad al lavado.</li>' +
            '<li><b>Tejido:</b> Transpirable estándar para uso diario.</li>' +
            '<li><b>Tallaje:</b> Elige tu talla habitual. Desde 25,00 €.</li>' +
          '</ul>' +
        '</div>' +
        '<div class="version-compare-col' + (isPlayer ? ' is-current' : '') + '">' +
          '<div class="version-col-head"><strong>Versión Jugador (Player)</strong>' + (isPlayer ? '<span>Esta ficha</span>' : '') + '</div>' +
          '<ul>' +
            '<li><b>Corte:</b> Slim / Atlético más ceñido al cuerpo.</li>' +
            '<li><b>Escudo y logo:</b> Termosellados ultraligeros de partido.</li>' +
            '<li><b>Tejido:</b> Microperforado técnico de máxima ventilación.</li>' +
            '<li><b>Tallaje:</b> Recomendado pedir <strong>1 talla más</strong>. Desde 30,00 €.</li>' +
          '</ul>' +
        '</div>' +
      '</div>' +
      (item.team && item.team !== 'Otros'
        ? '<button type="button" class="version-alt-link" data-switch-version-team="' + esc(item.team) + '" data-switch-version="' + altVersion + '">' + esc(altLabel) + ' →</button>'
        : '');
  }

  function updateVersionComparePanel() {
    var toggle = $('#version-compare-toggle');
    var panel = $('#version-compare-panel');
    if (toggle) toggle.setAttribute('aria-expanded', state.versionCompareOpen ? 'true' : 'false');
    if (!panel) return;
    panel.hidden = !state.versionCompareOpen;
    if (state.versionCompareOpen && state.product) panel.innerHTML = renderVersionCompareHtml(state.product);
  }

  function calculateBulkTotals(item) {
    var sizes = expandSizes(item.sizeRange);
    var name = item.custom ? String(state.customName || '').trim().toUpperCase().slice(0, 14) : '';
    var number = item.custom ? String(state.customNumber || '').replace(/\D/g, '').slice(0, 2) : '';
    var patches = item.custom ? state.patches : 'No';
    var units = 0;
    var totalCents = 0;
    sizes.forEach(function (size) {
      var q = Math.max(0, Math.min(30, parseInt(state.bulkQtys[size], 10) || 0));
      if (!q) return;
      var calc = KangPricing.calculate(item, { size: size, name: name, number: number, patches: patches });
      units += q;
      totalCents += calc.unitPriceCents * q;
    });
    return { units: units, totalCents: totalCents };
  }

  function renderBulkPanelHtml() {
    var item = state.product;
    if (!item || !window.KangPricing) return '';
    var sizes = expandSizes(item.sizeRange);
    var totals = calculateBulkTotals(item);
    var grid = sizes.map(function (size) {
      var q = Math.max(0, Math.min(30, parseInt(state.bulkQtys[size], 10) || 0));
      var extra = /^(3XL|4XL|5XL)$/.test(size);
      return '<div class="bulk-size-cell' + (q > 0 ? ' is-filled' : '') + '">' +
        '<div class="bulk-size-label"><strong>' + esc(size) + '</strong>' + (extra ? '<small>+3€</small>' : '') + '</div>' +
        '<div class="qty">' +
          '<button type="button" data-bulk-size="' + esc(size) + '" data-bulk-delta="-1" aria-label="Quitar talla ' + esc(size) + '"><svg><use href="#i-minus"/></svg></button>' +
          '<span>' + q + '</span>' +
          '<button type="button" data-bulk-size="' + esc(size) + '" data-bulk-delta="1" aria-label="Añadir talla ' + esc(size) + '"><svg><use href="#i-plus"/></svg></button>' +
        '</div>' +
      '</div>';
    }).join('');
    return '<div class="bulk-size-grid">' + grid + '</div>' +
      (item.custom ? '<p class="bulk-note">La personalización y los parches activos se aplican a todas las unidades seleccionadas. Déjalos vacíos para camisetas lisas.</p>' : '') +
      '<div class="bulk-summary">' +
        '<div><span>' + totals.units + ' ' + (totals.units === 1 ? 'prenda seleccionada' : 'prendas seleccionadas') + '</span>' +
        '<strong>' + esc(KangPricing.money(totals.totalCents)) + '</strong></div>' +
        '<button type="button" class="btn btn-primary" id="bulk-add-btn"' + (totals.units ? '' : ' disabled') + '>Añadir selección</button>' +
      '</div>';
  }

  function updateBulkPanel() {
    var toggle = $('#bulk-order-toggle');
    var panel = $('#bulk-order-panel');
    if (toggle) {
      toggle.setAttribute('aria-expanded', state.bulkOpen ? 'true' : 'false');
      var b = toggle.querySelector('b');
      if (b) b.textContent = state.bulkOpen ? 'Ocultar' : 'Abrir';
    }
    if (!panel) return;
    panel.hidden = !state.bulkOpen;
    if (state.bulkOpen) panel.innerHTML = renderBulkPanelHtml();
  }

  function addBulkToCart() {
    var item = state.product;
    if (!item) return;
    var sizes = expandSizes(item.sizeRange);
    var name = item.custom ? String(state.customName || '').trim().toUpperCase().slice(0, 14) : '';
    var number = item.custom ? String(state.customNumber || '').replace(/\D/g, '').slice(0, 2) : '';
    var patches = item.custom ? state.patches : 'No';
    var addedUnits = 0;

    sizes.forEach(function (size) {
      var q = Math.max(0, Math.min(30, parseInt(state.bulkQtys[size], 10) || 0));
      if (!q) return;
      var key = [item.id, size, name, number, patches].join('|');
      var existing = findCartLine(key);
      if (existing) existing.qty = Math.min(30, existing.qty + q);
      else state.cart.push({ key: key, id: item.id, size: size, qty: q, name: name, number: number, patches: patches });
      addedUnits += q;
    });

    if (!addedUnits) {
      toast('Selecciona al menos 1 talla', 'error');
      return;
    }
    saveCart();
    updateCartUI();
    closeProduct();
    toast(addedUnits + ' prendas añadidas al carrito');
    setTimeout(openCart, 200);
  }

  function updateCustomPreview() {
    var nameEl = $('#product-preview-name');
    var numEl = $('#product-preview-number');
    var sleevePatchesEl = $('#product-preview-sleeve-patches');
    var patchesEl = $('#product-preview-patches');
    var name = String(state.customName || '').trim().toUpperCase().slice(0, 14);
    var number = String(state.customNumber || '').replace(/\D/g, '').slice(0, 2);
    var dispName = name || 'TU NOMBRE';
    var dispNum = number || '10';
    if (nameEl) {
      nameEl.textContent = dispName;
      nameEl.setAttribute('font-size', String(jerseyNameFontSize(dispName)));
      nameEl.classList.toggle('is-placeholder', !name);
    }
    if (numEl) {
      numEl.textContent = dispNum;
      numEl.setAttribute('font-size', String(jerseyNumberFontSize(dispNum)));
      numEl.classList.toggle('is-placeholder', !number);
    }
    if (sleevePatchesEl) {
      var item = state.product;
      var isLong = item ? ((window.KangPricing && KangPricing.calculate(item, {}).isLongSleeve) ||
        /\b(long[-\s]?sleeves?d?|manga\s+larga)\b/i.test(item.title || '') ||
        (Array.isArray(item.flags) && item.flags.indexOf('long') !== -1)) : false;
      sleevePatchesEl.innerHTML = renderJerseySleevePatchesSvg(state.patches, isLong);
    }
    if (patchesEl) {
      var badges = renderPatchBadgesHtml(state.patches);
      patchesEl.innerHTML = badges || ('<span class="product-jersey-patches">Vista previa ' + esc(state.product ? state.product.team : 'en vivo') + '</span>');
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
        var presetBtn = event.target.closest('[data-preset-name]');
        if (presetBtn) {
          var pName = presetBtn.getAttribute('data-preset-name') || '';
          var pNum = presetBtn.getAttribute('data-preset-number') || '';
          state.customName = pName;
          state.customNumber = pNum;
          var nameInput = $('#custom-name');
          var numInput = $('#custom-number');
          if (nameInput) nameInput.value = pName;
          if (numInput) numInput.value = pNum;
          $$('#product-info .preset-btn').forEach(function (b) { b.classList.toggle('is-active', b === presetBtn); });
          updateCustomPreview();
          updateProductPricing();
          return;
        }
        if (event.target.closest('#version-compare-toggle')) {
          state.versionCompareOpen = !state.versionCompareOpen;
          updateVersionComparePanel();
          return;
        }
        var switchVer = event.target.closest('[data-switch-version-team]');
        if (switchVer) {
          var swTeam = switchVer.getAttribute('data-switch-version-team');
          var swVer = switchVer.getAttribute('data-switch-version');
          closeProduct(true);
          location.hash = '#/catalogo?equipo=' + enc(swTeam) + '&version=' + enc(swVer) + '&vista=grid';
          return;
        }
        if (event.target.closest('#bulk-order-toggle')) {
          state.bulkOpen = !state.bulkOpen;
          updateBulkPanel();
          return;
        }
        var bulkBtn = event.target.closest('[data-bulk-size]');
        if (bulkBtn) {
          var bSize = bulkBtn.getAttribute('data-bulk-size');
          var bDelta = parseInt(bulkBtn.getAttribute('data-bulk-delta'), 10) || 0;
          var cur = parseInt(state.bulkQtys[bSize], 10) || 0;
          state.bulkQtys[bSize] = Math.min(30, Math.max(0, cur + bDelta));
          updateBulkPanel();
          return;
        }
        if (event.target.closest('#bulk-add-btn')) {
          addBulkToCart();
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
        var applyRec = event.target.closest('[data-apply-rec-size]');
        if (applyRec) {
          var recSize = applyRec.getAttribute('data-apply-rec-size');
          if (recSize) {
            selectSize(recSize);
            toast('Talla ' + recSize + ' aplicada');
          }
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
          $$('#product-info .preset-btn').forEach(function (b) { b.classList.remove('is-active'); });
          updateCustomPreview();
          updateProductPricing();
        } else if (event.target.id === 'custom-number') {
          var cleaned = event.target.value.replace(/\D/g, '').slice(0, 2);
          if (event.target.value !== cleaned) event.target.value = cleaned;
          state.customNumber = cleaned;
          $$('#product-info .preset-btn').forEach(function (b) { b.classList.remove('is-active'); });
          updateCustomPreview();
          updateProductPricing();
        } else if (event.target.id === 'calc-height' || event.target.id === 'calc-weight' || event.target.id === 'calc-kids-height') {
          if (event.target.id === 'calc-height') state.calcHeight = parseInt(event.target.value, 10) || 175;
          if (event.target.id === 'calc-weight') state.calcWeight = parseInt(event.target.value, 10) || 73;
          if (event.target.id === 'calc-kids-height') state.calcKidsHeight = parseInt(event.target.value, 10) || 130;
          var isKidsTab = state.sizeGuideTab === 'kids';
          var rec = recommendSize(state.product, isKidsTab, isKidsTab ? state.calcKidsHeight : state.calcHeight, state.calcWeight);
          var hv = $('#calc-height-val'); if (hv) hv.textContent = state.calcHeight + ' cm';
          var wv = $('#calc-weight-val'); if (wv) wv.textContent = state.calcWeight + ' kg';
          var khv = $('#calc-kids-height-val'); if (khv) khv.textContent = state.calcKidsHeight + ' cm';
          var rs = $('#calc-rec-size'); if (rs) rs.textContent = rec.size;
          var applyBtn = $('#calc-apply-btn');
          if (applyBtn) {
            applyBtn.setAttribute('data-apply-rec-size', rec.size);
            applyBtn.textContent = 'Usar ' + rec.size;
          }
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
        var stepBtn = event.target.closest('[data-gallery-step]');
        if (stepBtn) {
          stepGallery(parseInt(stepBtn.getAttribute('data-gallery-step'), 10) || 0);
          return;
        }
        if (event.target.closest('#product-zoom') || event.target.tagName === 'IMG') {
          openLightbox(state.gallery[state.galleryIndex]);
        }
      });
      var mainTouchX = 0, mainTouchY = 0;
      main.addEventListener('touchstart', function (event) {
        if (event.touches && event.touches.length === 1) {
          mainTouchX = event.touches[0].clientX;
          mainTouchY = event.touches[0].clientY;
        }
      }, { passive: true });
      main.addEventListener('touchend', function (event) {
        if (!mainTouchX || !event.changedTouches || !event.changedTouches.length || state.gallery.length <= 1) return;
        var dx = event.changedTouches[0].clientX - mainTouchX;
        var dy = event.changedTouches[0].clientY - mainTouchY;
        mainTouchX = 0; mainTouchY = 0;
        if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          stepGallery(dx < 0 ? 1 : -1);
        }
      }, { passive: true });
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
    var cur = cartVolumeDiscount();
    var next = (window.KangPricing && typeof KangPricing.nextVolumeTier === 'function') ? KangPricing.nextVolumeTier(total) : null;
    var pct = next ? Math.min(100, Math.round((total / next.minQty) * 100)) : 100;
    box.classList.toggle('is-complete', cur.discountCents > 0);
    var copyHtml = '';
    if (next) {
      var remaining = next.minQty - total;
      var perItemTxt = KangPricing.money(next.perItemCents);
      copyHtml = '<span>Añade <strong>' + remaining + (remaining === 1 ? ' prenda más' : ' prendas más') + '</strong> para aplicar <strong>-' + esc(perItemTxt) + '/ud.</strong> (' + total + '/' + next.minQty + ')</span><strong>' + pct + '%</strong>';
    } else {
      copyHtml = '<span><strong>Descuento máximo activo</strong> · Ahorras <strong>' + esc(KangPricing.money(cur.discountCents)) + '</strong> (' + esc(cur.label) + ')</span><strong>-3 €/ud</strong>';
    }
    box.innerHTML = '<div class="cart-progress-copy">' + copyHtml + '</div>' +
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

    var vol = cartVolumeDiscount();
    var discRow = $('#cart-discount-row');
    var discLabel = $('#cart-discount-label');
    var discAmt = $('#cart-discount-amount');
    if (discRow) discRow.hidden = !(vol.discountCents > 0);
    if (discLabel && vol.discountCents > 0) discLabel.textContent = 'Descuento grupo (' + vol.label + ')';
    if (discAmt && vol.discountCents > 0) discAmt.textContent = '-' + KangPricing.money(vol.discountCents);

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

    var cartCopySummary = $('#cart-copy-summary');
    if (cartCopySummary) {
      cartCopySummary.addEventListener('click', function () {
        if (!state.cart.length) return;
        var vol = cartVolumeDiscount();
        var lines = ['RESUMEN CARRITO · KANG TEAM'];
        state.cart.forEach(function (line, idx) {
          var item = state.byId.get(line.id);
          if (!item) return;
          var pr = linePricing(line, item);
          var row = (idx + 1) + '. ' + cleanTitle(item) + ' (' + item.team + ') · Talla ' + line.size + ' × ' + line.qty + ' = ' + KangPricing.money(pr.unitPriceCents * line.qty);
          if (line.name || line.number) row += ' [' + [line.name, line.number ? '#' + line.number : ''].filter(Boolean).join(' ') + ']';
          if (line.patches && line.patches !== 'No') row += ' [Parches: ' + line.patches + ']';
          lines.push(row);
        });
        if (vol.discountCents > 0) lines.push('Descuento grupo (' + vol.label + '): -' + KangPricing.money(vol.discountCents));
        lines.push('Total estimado: ' + KangPricing.money(cartPriceCents()));
        lines.push('Entrega: Recogida gratuita en Córdoba capital (2–3 semanas)');
        copyText(lines.join('\n')).then(function () {
          toast('Resumen del carrito copiado');
        }).catch(function () {
          toast('No se pudo copiar el resumen', 'error');
        });
      });
    }

    var cartCopyBizum = $('#cart-copy-bizum');
    if (cartCopyBizum) {
      cartCopyBizum.addEventListener('click', function () {
        var st = state.config && state.config.store ? state.config.store : {};
        var rawBizum = bizumDisplayNumber(st.bizum || '699234010');
        var fmtBizum = formatBizumPhone(st.bizum || '699234010');
        copyText(rawBizum).then(function () {
          toast('Bizum ' + fmtBizum + ' copiado · Pon tu código KT-... en el concepto al confirmar');
        }).catch(function () {
          toast('No se pudo copiar el teléfono Bizum', 'error');
        });
      });
    }

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
          (/^KT-/.test(String(order.id || '')) ? '<button type="button" class="btn-link" data-track-order-id="' + esc(order.id) + '" data-track-order-phone4="' + esc(order.phone4 || '') + '">Seguir</button>' : '') +
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
        var trackBtn = event.target.closest('[data-track-order-id]');
        if (trackBtn) {
          var tId = trackBtn.getAttribute('data-track-order-id') || '';
          var tP4 = trackBtn.getAttribute('data-track-order-phone4') || '';
          closeOrders();
          location.hash = '#/seguimiento?id=' + enc(tId) + (tP4 ? '&phone4=' + enc(tP4) : '');
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

  function formatBizumPhone(digits) {
    var clean = String(digits || '').replace(/\D/g, '');
    if (!clean) return '';
    if (clean.length === 11 && clean.indexOf('34') === 0) {
      var local = clean.slice(2);
      return '+34 ' + local.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
    }
    if (clean.length === 9) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
    }
    return clean;
  }

  function bizumDisplayNumber(digits) {
    var clean = String(digits || '').replace(/\D/g, '');
    if (!clean) return '';
    if (clean.length === 11 && clean.indexOf('34') === 0) return clean.slice(2);
    return clean;
  }

  function checkoutTotals() {
    var subtotalCents = cartSubtotalCents();
    var vol = cartVolumeDiscount();
    var afterVolumeCents = Math.max(0, subtotalCents - vol.discountCents);
    var promoDiscountCents = 0;
    if (state.appliedPromo && state.appliedPromo.discountCents > 0) {
      promoDiscountCents = Math.min(afterVolumeCents, state.appliedPromo.discountCents);
    }
    var totalCents = Math.max(0, afterVolumeCents - promoDiscountCents);
    return {
      subtotalCents: subtotalCents,
      volume: vol,
      afterVolumeCents: afterVolumeCents,
      promo: state.appliedPromo,
      promoDiscountCents: promoDiscountCents,
      totalCents: totalCents
    };
  }

  function renderCheckoutSummaryTotalsHtml() {
    var total = cartTotalItems();
    var t = checkoutTotals();
    var isOutside = state.deliveryMethod === 'outside_cordoba';
    var html = '<div><span>Artículos (' + total + ')</span><strong>' + esc(KangPricing.money(t.subtotalCents)) + '</strong></div>';
    if (t.volume.discountCents > 0) {
      html += '<div class="is-discount"><span>Dto. grupo (' + esc(t.volume.label) + ')</span><strong>-' + esc(KangPricing.money(t.volume.discountCents)) + '</strong></div>';
    }
    if (t.promo && t.promoDiscountCents > 0) {
      html += '<div class="is-discount"><span>Cupón ' + esc(t.promo.code) + (t.promo.label ? ' (' + esc(t.promo.label) + ')' : '') + '</span><strong>-' + esc(KangPricing.money(t.promoDiscountCents)) + '</strong></div>';
    }
    html += '<div><span>Entrega</span><strong>' + (isOutside ? 'Fuera de Córdoba (a consultar)' : 'Recogida en Córdoba · Gratis') + '</strong></div>';
    html += '<div><span>Total del pedido</span><strong>' + esc(KangPricing.money(t.totalCents)) + '</strong></div>';
    return html;
  }

  function updateCheckoutSummaryUI() {
    var totalsBox = $('#checkout-summary-totals');
    if (totalsBox) totalsBox.innerHTML = renderCheckoutSummaryTotalsHtml();
    var note = $('#checkout-summary-note');
    if (note) {
      note.textContent = state.deliveryMethod === 'outside_cordoba'
        ? 'Pedidos fuera de Córdoba solo para compras grandes. Confirmamos gastos de envío por WhatsApp.'
        : 'Recogida gratuita en Córdoba capital. Plazo estimado de entrega: 2–3 semanas.';
    }
  }

  function updateCheckoutPaymentUI(form) {
    if (!form) return;
    var method = form.elements.paymentMethod ? form.elements.paymentMethod.value : 'confirm';
    var isBizum = method === 'bizum';
    var deliveryVal = form.elements.deliveryMethod ? form.elements.deliveryMethod.value : 'pickup_cordoba';
    state.deliveryMethod = deliveryVal === 'outside_cordoba' ? 'outside_cordoba' : 'pickup_cordoba';
    $$('.payment-option', form).forEach(function (card) {
      var input = card.querySelector('input[type="radio"]');
      card.classList.toggle('is-active', !!(input && input.checked));
    });
    var preview = $('#checkout-bizum-preview');
    if (preview) preview.hidden = !isBizum;
    var outsidePreview = $('#checkout-outside-preview');
    if (outsidePreview) outsidePreview.hidden = state.deliveryMethod !== 'outside_cordoba';
    var consentCopy = $('#checkout-consent-copy');
    var storeName = state.config && state.config.store && state.config.store.name ? state.config.store.name : 'KANG Team';
    if (consentCopy) {
      consentCopy.textContent = isBizum
        ? 'Acepto generar el pedido y recibir las instrucciones de Bizum directo. La disponibilidad y la recogida en Córdoba (plazo 2–3 semanas) se coordinan por WhatsApp o email.'
        : 'Acepto que ' + storeName + ' me contacte por WhatsApp o email para confirmar el pedido. No se realiza ningún cobro online.';
    }
    var submitBtn = $('#checkout-submit');
    if (submitBtn && !submitBtn.disabled) {
      submitBtn.innerHTML = (isBizum ? 'Confirmar y ver datos Bizum' : 'Enviar pedido') + ' <svg><use href="#i-arrow"/></svg>';
    }
    updateCheckoutSummaryUI();
  }

  async function applyCheckoutPromo() {
    var inp = $('#checkout-promo-input');
    var msgEl = $('#checkout-promo-msg');
    var btn = $('#checkout-promo-apply');
    var code = String(inp ? inp.value : state.promoInput || '').trim().toUpperCase();
    state.promoInput = code;
    if (!code) {
      state.appliedPromo = null;
      state.promoError = 'Introduce un código de cupón.';
      if (msgEl) { msgEl.textContent = state.promoError; msgEl.className = 'promo-msg is-error'; }
      updateCheckoutSummaryUI();
      return;
    }
    var totals = checkoutTotals();
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
      var res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          code: code,
          baseCents: totals.afterVolumeCents,
          totalItems: cartTotalItems()
        })
      });
      var data = null;
      try { data = await res.json(); } catch (e) {}
      if (!res.ok) throw new Error(extractApiError(data, 'Cupón no válido o caducado'));
      state.appliedPromo = data.promo;
      state.promoError = '';
      if (msgEl) {
        msgEl.textContent = 'Cupón ' + data.promo.code + ' aplicado: -' + KangPricing.money(data.promo.discountCents);
        msgEl.className = 'promo-msg is-ok';
      }
      var clearBtn = $('#checkout-promo-clear');
      if (clearBtn) clearBtn.hidden = false;
      updateCheckoutSummaryUI();
      toast('Cupón ' + data.promo.code + ' aplicado');
    } catch (err) {
      state.appliedPromo = null;
      state.promoError = err.message || 'Cupón no válido';
      if (msgEl) { msgEl.textContent = state.promoError; msgEl.className = 'promo-msg is-error'; }
      var clearBtn2 = $('#checkout-promo-clear');
      if (clearBtn2) clearBtn2.hidden = true;
      updateCheckoutSummaryUI();
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Aplicar'; }
    }
  }

  function renderCheckout() {
    var content = $('#checkout-content');
    if (!content) return;
    var total = cartTotalItems();
    var store = state.config && state.config.store ? state.config.store : {};
    var storeName = store.name || 'KANG Team';
    var saved = state.customer || { name: '', phone: '', email: '', city: '', notes: '' };
    var hasSaved = !!(saved.name || saved.phone);
    var defaultMethod = store.bizum ? 'bizum' : 'confirm';
    var delivery = state.deliveryMethod === 'outside_cordoba' ? 'outside_cordoba' : 'pickup_cordoba';
    var promoOpen = !!(state.appliedPromo || state.promoError);

    content.innerHTML = '<div class="checkout-grid">' +
      '<div class="checkout-form-wrap">' +
        '<p class="eyebrow">Último paso</p>' +
        '<h2 id="checkout-title">Confirma tu pedido</h2>' +
        '<p class="checkout-sub">Déjanos tus datos y elige cómo prefieres pagar y recoger tu pedido.</p>' +
        (hasSaved ? '<div class="checkout-autofill-note"><span>Datos rellenados de tu último pedido</span><button type="button" id="checkout-clear-customer">Usar otros datos</button></div>' : '') +
        '<form id="checkout-form" novalidate>' +
          '<div class="form-error" id="checkout-error" role="alert"></div>' +
          '<div class="form-grid">' +
            '<label class="field"><span>Nombre y apellidos *</span><input name="name" type="text" autocomplete="name" maxlength="80" value="' + esc(saved.name) + '" required></label>' +
            '<label class="field"><span>Teléfono / WhatsApp *</span><input name="phone" type="tel" autocomplete="tel" maxlength="30" value="' + esc(saved.phone) + '" required></label>' +
            '<label class="field"><span>Email (para avisos de estado)</span><input name="email" type="email" autocomplete="email" maxlength="120" value="' + esc(saved.email) + '"></label>' +
            '<label class="field"><span>Localidad / Zona</span><input name="city" type="text" autocomplete="address-level2" maxlength="80" placeholder="Córdoba" value="' + esc(saved.city) + '"></label>' +
            '<label class="field field-full"><span>Notas (disponibilidad para recoger, dudas de talla…)</span><textarea name="notes" maxlength="600">' + esc(saved.notes) + '</textarea></label>' +
          '</div>' +
          '<div class="checkout-payment-block">' +
            '<p class="field-label">Entrega</p>' +
            '<div class="payment-methods" role="radiogroup" aria-label="Tipo de entrega">' +
              '<label class="payment-option' + (delivery === 'pickup_cordoba' ? ' is-active' : '') + '">' +
                '<input type="radio" name="deliveryMethod" value="pickup_cordoba"' + (delivery === 'pickup_cordoba' ? ' checked' : '') + '>' +
                '<span class="payment-option-copy">' +
                  '<span class="payment-option-title">Recogida en Córdoba <span class="bizum-badge">Gratis</span></span>' +
                  '<small>Entrega en mano en Córdoba capital (2–3 semanas).</small>' +
                '</span>' +
              '</label>' +
              '<label class="payment-option' + (delivery === 'outside_cordoba' ? ' is-active' : '') + '">' +
                '<input type="radio" name="deliveryMethod" value="outside_cordoba"' + (delivery === 'outside_cordoba' ? ' checked' : '') + '>' +
                '<span class="payment-option-copy">' +
                  '<span class="payment-option-title">Fuera de Córdoba</span>' +
                  '<small>Solo pedidos grandes · A consultar por WhatsApp.</small>' +
                '</span>' +
              '</label>' +
            '</div>' +
            '<div class="payment-outside-preview" id="checkout-outside-preview"' + (delivery === 'outside_cordoba' ? '' : ' hidden') + '>' +
              'Los envíos fuera de Córdoba se valoran únicamente para pedidos de varias prendas. Te confirmaremos si aplica y el importe por WhatsApp.' +
            '</div>' +
          '</div>' +
          '<div class="checkout-payment-block">' +
            '<p class="field-label">Método de pago</p>' +
            '<div class="payment-methods" role="radiogroup" aria-label="Método de pago">' +
              '<label class="payment-option' + (defaultMethod === 'bizum' ? ' is-active' : '') + '">' +
                '<input type="radio" name="paymentMethod" value="bizum"' + (defaultMethod === 'bizum' ? ' checked' : '') + '>' +
                '<span class="payment-option-copy">' +
                  '<span class="payment-option-title">Bizum <span class="bizum-badge">Directo</span></span>' +
                  '<small>Sin comisiones. Te damos el número, importe y concepto.</small>' +
                '</span>' +
              '</label>' +
              '<label class="payment-option' + (defaultMethod === 'confirm' ? ' is-active' : '') + '">' +
                '<input type="radio" name="paymentMethod" value="confirm"' + (defaultMethod === 'confirm' ? ' checked' : '') + '>' +
                '<span class="payment-option-copy">' +
                  '<span class="payment-option-title">Confirmar antes</span>' +
                  '<small>Revisamos disponibilidad por WhatsApp antes de pagar.</small>' +
                '</span>' +
              '</label>' +
            '</div>' +
            '<div class="payment-bizum-preview" id="checkout-bizum-preview"' + (defaultMethod === 'bizum' ? '' : ' hidden') + '>' +
              'Al enviar el pedido obtendrás tu referencia <strong>KT-...</strong> y los datos de Bizum directo sin comisiones. Cuando hagas el Bizum, avísanos por WhatsApp.' +
            '</div>' +
          '</div>' +
          '<label class="form-consent"><input type="checkbox" id="checkout-consent">' +
            '<span id="checkout-consent-copy">' +
              (defaultMethod === 'bizum'
                ? 'Acepto generar el pedido y recibir las instrucciones de Bizum directo. La disponibilidad y la recogida en Córdoba (plazo 2–3 semanas) se coordinan por WhatsApp o email.'
                : 'Acepto que ' + esc(storeName) + ' me contacte por WhatsApp o email para confirmar el pedido. No se realiza ningún cobro online.') +
            '</span></label>' +
          '<button class="btn btn-primary btn-block" id="checkout-submit" type="submit">' + (defaultMethod === 'bizum' ? 'Confirmar y ver datos Bizum' : 'Enviar pedido') + ' <svg><use href="#i-arrow"/></svg></button>' +
        '</form>' +
      '</div>' +
      '<aside class="checkout-summary">' +
        '<h3 class="summary-title">Tu selección <span>' + total + ' art.</span></h3>' +
        '<div class="summary-items">' + cartSummaryHtml() + '</div>' +
        '<details class="promo-box"' + (promoOpen ? ' open' : '') + '>' +
          '<summary>¿Tienes un cupón privado?</summary>' +
          '<div class="promo-row">' +
            '<input type="text" id="checkout-promo-input" maxlength="32" placeholder="CÓDIGO" value="' + esc(state.appliedPromo ? state.appliedPromo.code : state.promoInput) + '">' +
            '<button type="button" class="btn btn-outline" id="checkout-promo-apply">Aplicar</button>' +
            '<button type="button" class="btn-link" id="checkout-promo-clear"' + (state.appliedPromo ? '' : ' hidden') + '>Quitar</button>' +
          '</div>' +
          '<p class="promo-msg ' + (state.appliedPromo ? 'is-ok' : (state.promoError ? 'is-error' : '')) + '" id="checkout-promo-msg">' +
            (state.appliedPromo ? ('Cupón ' + esc(state.appliedPromo.code) + ' aplicado: -' + esc(KangPricing.money(state.appliedPromo.discountCents))) : esc(state.promoError || '')) +
          '</p>' +
        '</details>' +
        '<div class="summary-totals" id="checkout-summary-totals">' + renderCheckoutSummaryTotalsHtml() + '</div>' +
        '<p class="summary-note" id="checkout-summary-note">' +
          (delivery === 'outside_cordoba'
            ? 'Pedidos fuera de Córdoba solo para compras grandes. Confirmamos gastos de envío por WhatsApp.'
            : 'Recogida gratuita en Córdoba capital. Plazo estimado de entrega: 2–3 semanas.') +
        '</p>' +
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

    var paymentMethod = form.elements.paymentMethod ? form.elements.paymentMethod.value : 'confirm';
    var deliveryMethod = form.elements.deliveryMethod ? form.elements.deliveryMethod.value : state.deliveryMethod;
    var payload = {
      paymentMethod: paymentMethod,
      deliveryMethod: deliveryMethod === 'outside_cordoba' ? 'outside_cordoba' : 'pickup_cordoba',
      promoCode: state.appliedPromo ? state.appliedPromo.code : '',
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
        throw new Error(extractApiError(data, 'No se pudo enviar el pedido. Inténtalo de nuevo.'));
      }

      saveCustomer(payload.customer);
      var snapshotItems = payload.items.map(function (line) {
        var item = state.byId.get(line.id);
        return Object.assign({}, line, { title: item ? cleanTitle(item) : '' });
      });
      var orderPhone4 = payload.customer.phone.replace(/\D/g, '').slice(-4);
      state.orders.unshift({
        id: data && data.order && data.order.id ? data.order.id : String(Date.now()),
        createdAt: new Date().toISOString(),
        paymentMethod: data && data.order && data.order.paymentMethod ? data.order.paymentMethod : paymentMethod,
        deliveryMethod: data && data.order && data.order.deliveryMethod ? data.order.deliveryMethod : payload.deliveryMethod,
        status: data && data.order && data.order.status ? data.order.status : (paymentMethod === 'bizum' ? 'bizum_pending' : 'pending'),
        phone4: orderPhone4,
        totalItems: payload.items.reduce(function (sum, l) { return sum + (parseInt(l.qty, 10) || 1); }, 0),
        totalPriceCents: data && data.order ? data.order.totalPriceCents : checkoutTotals().totalCents,
        items: snapshotItems
      });
      state.orders = state.orders.slice(0, 12);
      saveOrders();
      updateOrdersUI();

      state.lastOrder = data;
      state.appliedPromo = null;
      state.promoError = '';
      state.promoInput = '';
      state.cart = [];
      saveCart();
      updateCartUI();
      renderSuccess(data, payload.customer.name, orderPhone4);
      toast('Pedido enviado correctamente');
    } catch (err) {
      showCheckoutError(err.message || 'No se pudo enviar el pedido. Revisa tu conexión e inténtalo de nuevo.');
      if (button) {
        button.disabled = false;
        button.innerHTML = original;
      }
    }
  }

  function renderSuccess(data, customerName, phone4) {
    var content = $('#checkout-content');
    if (!content) return;
    var order = data && data.order ? data.order : {};
    var id = order.id || '';
    var trackHref = id ? '#/seguimiento?id=' + enc(id) + (phone4 ? '&phone4=' + enc(phone4) : '') : '#/seguimiento';
    var isBizum = order.paymentMethod === 'bizum';
    var isOutside = order.deliveryMethod === 'outside_cordoba';
    var store = state.config && state.config.store ? state.config.store : {};
    var bizumDigits = store.bizum || '';
    var bizumCopyPhone = bizumDisplayNumber(bizumDigits);
    var bizumFormatted = formatBizumPhone(bizumDigits);
    var amountText = order.totalPriceCents ? KangPricing.money(order.totalPriceCents) : '';
    var amountCopy = order.totalPriceCents ? (order.totalPriceCents / 100).toFixed(2).replace('.', ',') : '';
    var text = data && data.text ? data.text : '';
    var wa = (data && data.whatsappUrl) || ('https://wa.me/?text=' + encodeURIComponent(text));
    var mail = (data && data.mailtoUrl) || ('mailto:?subject=' + encodeURIComponent('Pedido ' + id) + '&body=' + encodeURIComponent(text));
    var automatic = data && data.delivery && (data.delivery.email || data.delivery.whatsapp);

    var savingsParts = [];
    if (order.volumeDiscountCents > 0) savingsParts.push('Dto. grupo -' + KangPricing.money(order.volumeDiscountCents));
    if (order.promoDiscountCents > 0) savingsParts.push('Cupón ' + order.promoCode + ' -' + KangPricing.money(order.promoDiscountCents));

    var bizumAllCopy = [
      bizumFormatted ? ('Bizum: ' + bizumCopyPhone) : '',
      amountCopy ? ('Importe: ' + amountCopy + ' €') : '',
      id ? ('Concepto: ' + id) : ''
    ].filter(Boolean).join(' · ');

    var bizumHtml = '';
    if (isBizum) {
      bizumHtml = '<div class="bizum-box">' +
        '<div class="bizum-box-head">' +
          '<span class="bizum-badge">Pago por Bizum</span>' +
          '<div class="bizum-head-right">' +
            '<span>Sin comisiones</span>' +
            (bizumAllCopy ? '<button class="bizum-copy-btn bizum-copy-all-btn" type="button" data-copy-value="' + esc(bizumAllCopy) + '" data-copy-label="Todos los datos Bizum copiados">Copiar todo</button>' : '') +
          '</div>' +
        '</div>' +
        '<div class="bizum-rows">' +
          (bizumFormatted
            ? '<div class="bizum-row">' +
                '<div><span class="bizum-row-label">Teléfono Bizum</span><strong class="bizum-row-val">' + esc(bizumFormatted) + '</strong></div>' +
                '<button class="bizum-copy-btn" type="button" data-copy-value="' + esc(bizumCopyPhone) + '" data-copy-label="Teléfono Bizum copiado">Copiar</button>' +
              '</div>'
            : '<div class="bizum-missing-note">El número de Bizum aún no está configurado en el servidor (<code>STORE_BIZUM</code>). Escríbenos por WhatsApp con tu código de pedido y te lo pasamos al momento.</div>') +
          (store.bizumName
            ? '<div class="bizum-row"><div><span class="bizum-row-label">Titular</span><strong class="bizum-row-val">' + esc(store.bizumName) + '</strong></div></div>'
            : '') +
          (amountText
            ? '<div class="bizum-row">' +
                '<div><span class="bizum-row-label">Importe total</span><strong class="bizum-row-val is-volt">' + esc(amountText) + '</strong></div>' +
                '<button class="bizum-copy-btn" type="button" data-copy-value="' + esc(amountCopy) + '" data-copy-label="Importe copiado">Copiar</button>' +
              '</div>'
            : '') +
          (id
            ? '<div class="bizum-row">' +
                '<div><span class="bizum-row-label">Concepto</span><strong class="bizum-row-val">' + esc(id) + '</strong></div>' +
                '<button class="bizum-copy-btn" type="button" data-copy-value="' + esc(id) + '" data-copy-label="Concepto copiado">Copiar</button>' +
              '</div>'
            : '') +
        '</div>' +
        '<p class="bizum-box-foot">Haz el Bizum sin comisiones y avísanos por WhatsApp para confirmarlo al momento. Plazo estimado tras pedir al proveedor: 2–3 semanas.</p>' +
      '</div>';
    }

    content.innerHTML = '<div class="success-panel">' +
      '<div class="success-icon"><svg><use href="#i-check"/></svg></div>' +
      '<h2 id="checkout-title" tabindex="-1">Pedido recibido</h2>' +
      '<p>Gracias' + (customerName ? ', ' + esc(customerName) : '') + '. Hemos guardado tu pedido. ' + (isOutside ? 'Revisaremos tu solicitud para fuera de Córdoba por WhatsApp.' : 'Entrega mediante recogida gratuita en Córdoba capital (plazo estimado 2–3 semanas).') + '</p>' +
      (data && data.order ? '<p class="success-total">Total del pedido: <strong>' + esc(KangPricing.money(data.order.totalPriceCents)) + '</strong>' + (savingsParts.length ? ' · ' + esc(savingsParts.join(' · ')) : '') + ' · ' + (isOutside ? 'Fuera de Córdoba (a consultar)' : 'Recogida en Córdoba · Gratis') + '</p>' : '') +
      '<span class="order-ref">PEDIDO ' + esc(id) + '</span>' +
      bizumHtml +
      '<div class="success-actions">' +
        '<a class="btn btn-whatsapp" href="' + esc(wa) + '" target="_blank" rel="noopener"><svg><use href="#i-whatsapp"/></svg> ' + (isBizum ? 'Avisar del Bizum / enviar pedido por WhatsApp' : 'Enviar por WhatsApp') + '</a>' +
        '<a class="btn btn-outline" href="' + esc(trackHref) + '" data-close-checkout><svg><use href="#i-truck"/></svg> Seguir estado del pedido</a>' +
        '<a class="btn btn-outline" href="' + esc(mail) + '"><svg><use href="#i-mail"/></svg> Enviar por email</a>' +
        '<button class="btn btn-ghost" type="button" data-copy-order>Copiar resumen del pedido</button>' +
        '<a class="btn btn-ghost" href="#/catalogo" data-close-checkout>Seguir explorando</a>' +
      '</div>' +
      '<p class="success-note">' +
        (automatic ? 'También hemos avisado a la tienda automáticamente. ' : 'Para agilizar la confirmación, envía el resumen con el botón de WhatsApp. ') +
        'Guarda tu número de pedido para ver su estado en cualquier momento.' +
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
      content.addEventListener('change', function (event) {
        if (event.target && (event.target.name === 'paymentMethod' || event.target.name === 'deliveryMethod')) {
          updateCheckoutPaymentUI(event.target.form);
        }
      });
      content.addEventListener('keydown', function (event) {
        if (event.target && event.target.id === 'checkout-promo-input' && event.key === 'Enter') {
          event.preventDefault();
          applyCheckoutPromo();
        }
      });
      content.addEventListener('click', function (event) {
        if (event.target.closest('#checkout-clear-customer')) {
          saveCustomer({ name: '', phone: '', email: '', city: '', notes: '' });
          renderCheckout();
          return;
        }
        if (event.target.closest('#checkout-promo-apply')) {
          applyCheckoutPromo();
          return;
        }
        if (event.target.closest('#checkout-promo-clear')) {
          state.appliedPromo = null;
          state.promoError = '';
          state.promoInput = '';
          var inp = $('#checkout-promo-input');
          if (inp) inp.value = '';
          var msg = $('#checkout-promo-msg');
          if (msg) { msg.textContent = ''; msg.className = 'promo-msg'; }
          var clr = $('#checkout-promo-clear');
          if (clr) clr.hidden = true;
          updateCheckoutSummaryUI();
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
    ensureLightboxControls(box);
    image.src = photoUrl(path, 'big', state.product && state.product.source);
    image.alt = state.product ? state.product.title : 'Imagen ampliada';
    updateLightboxNav();
    box.classList.add('is-open');
    setOverlayState(box, true);
    lockScroll();
    var close = $('#lightbox-close');
    if (close) close.focus();
  }

  function ensureLightboxControls(box) {
    if ($('#lightbox-prev', box)) return;
    box.insertAdjacentHTML('beforeend',
      '<button class="lightbox-nav-btn is-prev" id="lightbox-prev" type="button" data-lightbox-step="-1" aria-label="Imagen anterior"><svg><use href="#i-arrow-left"/></svg></button>' +
      '<button class="lightbox-nav-btn is-next" id="lightbox-next" type="button" data-lightbox-step="1" aria-label="Imagen siguiente"><svg><use href="#i-arrow"/></svg></button>' +
      '<span class="lightbox-counter" id="lightbox-counter"></span>'
    );
  }

  function updateLightboxNav() {
    var total = state.gallery.length;
    var prev = $('#lightbox-prev');
    var next = $('#lightbox-next');
    var counter = $('#lightbox-counter');
    if (prev) prev.hidden = total <= 1;
    if (next) next.hidden = total <= 1;
    if (counter) {
      counter.hidden = total <= 1;
      counter.textContent = (state.galleryIndex + 1) + ' / ' + total;
    }
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
    updateLightboxNav();
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

  // ── Asistente rápido de dudas (Opción A) ──────────────────

  var HELP_TOPICS = [
    { id: 'size', label: '📏 ¿Qué talla elijo?' },
    { id: 'bizum', label: '⚡ Pago por Bizum' },
    { id: 'prices', label: '✏️ Precios y dorsales' },
    { id: 'shipping', label: '📦 Envíos y plazos' },
    { id: 'patches', label: '🏆 ¿Qué son los parches?' }
  ];

  function helpTopicHtml(topicId) {
    var store = state.config && state.config.store ? state.config.store : {};
    var bizumFormatted = formatBizumPhone(store.bizum || '');
    if (topicId === 'size') {
      var rec = recommendSize(null, false, state.calcHeight, state.calcWeight);
      return '<div class="help-bubble">' +
        '<strong>Calculadora rápida de talla (adulto):</strong>' +
        '<div class="size-calc-inputs" style="margin-top:8px">' +
          '<div class="size-calc-field">' +
            '<label for="help-calc-h"><span>Altura</span><b id="help-calc-h-val">' + state.calcHeight + ' cm</b></label>' +
            '<input id="help-calc-h" type="range" min="155" max="205" step="1" value="' + state.calcHeight + '">' +
          '</div>' +
          '<div class="size-calc-field">' +
            '<label for="help-calc-w"><span>Peso</span><b id="help-calc-w-val">' + state.calcWeight + ' kg</b></label>' +
            '<input id="help-calc-w" type="range" min="50" max="125" step="1" value="' + state.calcWeight + '">' +
          '</div>' +
        '</div>' +
        '<p style="margin:6px 0 0">Talla recomendada: <strong id="help-calc-rec" style="color:var(--volt)">' + esc(rec.size) + '</strong>. En <strong>Versión Jugador (Player)</strong>, sube 1 talla si te gusta menos ajustada.</p>' +
      '</div>';
    }
    if (topicId === 'bizum') {
      return '<div class="help-bubble">' +
        '<strong>Bizum directo sin comisiones:</strong><br>' +
        'Al confirmar el carrito selecciona <strong>Bizum</strong>. Te mostraremos al instante el código de pedido <strong>KT-...</strong> para el concepto y el número' +
        (bizumFormatted ? ' (<strong>' + esc(bizumFormatted) + '</strong>)' : '') +
        '. También puedes elegir <em>Confirmar antes</em> si prefieres revisar stock y envío por WhatsApp.' +
      '</div>';
    }
    if (topicId === 'prices') {
      return '<div class="help-bubble">' +
        '<strong>Personalización y extras claros:</strong><br>' +
        '• Camisetas de manga larga: <strong>+3,00 €</strong> sobre manga corta<br>' +
        '• Nombre + dorsal en camiseta: <strong>+2,00 €</strong><br>' +
        '• Cada parche de competición: <strong>+1,00 €</strong><br>' +
        '• Tallas especiales 3XL / 4XL / 5XL: <strong>+3,00 €</strong><br>' +
        '<a class="help-mini-link" href="#/precios" data-help-close-link>Ver tabla completa de tarifas →</a>' +
      '</div>';
    }
    if (topicId === 'shipping') {
      return '<div class="help-bubble">' +
        '<strong>Entrega, plazos y descuentos:</strong><br>' +
        '• Entrega principal: <strong>recogida gratuita en Córdoba capital</strong> (fuera de Córdoba solo pedidos grandes a consultar).<br>' +
        '• Plazo estimado: <strong>2–3 semanas</strong> desde el pedido a proveedor.<br>' +
        '• Descuentos automáticos por volumen: <strong>5–9 uds (-1 €/ud.)</strong>, <strong>10–14 uds (-2 €/ud.)</strong>, <strong>15+ uds (-3 €/ud.)</strong>.' +
      '</div>';
    }
    if (topicId === 'patches') {
      return '<div class="help-bubble">' +
        '<strong>Parches de competición:</strong><br>' +
        'Son los escudos oficiales en mangas/pecho (Liga, Champions, Mundial o Copa). Puedes verlos en directo en la vista previa de cualquier camiseta personalizable.' +
      '</div>';
    }
    return '';
  }

  function renderHelpWidget() {
    var body = $('#help-body');
    if (!body) return;
    var active = state.helpTopic;
    var activeLabel = '';
    HELP_TOPICS.forEach(function (t) { if (t.id === active) activeLabel = t.label; });

    body.innerHTML =
      '<div class="help-bubble">¡Hola! Elige una duda frecuente para ver la respuesta al instante o escríbenos por WhatsApp.</div>' +
      (active ? '<div class="help-bubble is-user">' + esc(activeLabel) + '</div>' + helpTopicHtml(active) : '') +
      '<div class="help-topic-grid">' +
        HELP_TOPICS.map(function (t) {
          return '<button type="button" class="help-topic-btn' + (active === t.id ? ' is-active' : '') + '" data-help-topic="' + esc(t.id) + '">' + esc(t.label) + '</button>';
        }).join('') +
      '</div>';
  }

  function openHelpWidget() {
    var widget = $('#help-widget');
    var fab = $('#help-open');
    if (!widget) return;
    renderHelpWidget();
    widget.hidden = false;
    widget.setAttribute('aria-hidden', 'false');
    if (fab) fab.setAttribute('aria-expanded', 'true');
  }

  function closeHelpWidget() {
    var widget = $('#help-widget');
    var fab = $('#help-open');
    if (!widget || widget.hidden) return;
    widget.hidden = true;
    widget.setAttribute('aria-hidden', 'true');
    if (fab) fab.setAttribute('aria-expanded', 'false');
  }

  function bindHelpWidget() {
    var fab = $('#help-open');
    var closeBtn = $('#help-close');
    var widget = $('#help-widget');
    if (fab) {
      fab.addEventListener('click', function () {
        if (widget && !widget.hidden) closeHelpWidget();
        else openHelpWidget();
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeHelpWidget);
    if (widget) {
      widget.addEventListener('click', function (event) {
        var topicBtn = event.target.closest('[data-help-topic]');
        if (topicBtn) {
          state.helpTopic = topicBtn.getAttribute('data-help-topic') || '';
          renderHelpWidget();
          return;
        }
        if (event.target.closest('[data-help-close-link]')) {
          closeHelpWidget();
        }
      });
      widget.addEventListener('input', function (event) {
        if (event.target.id === 'help-calc-h' || event.target.id === 'help-calc-w') {
          if (event.target.id === 'help-calc-h') state.calcHeight = parseInt(event.target.value, 10) || 175;
          if (event.target.id === 'help-calc-w') state.calcWeight = parseInt(event.target.value, 10) || 73;
          var hv = $('#help-calc-h-val'); if (hv) hv.textContent = state.calcHeight + ' cm';
          var wv = $('#help-calc-w-val'); if (wv) wv.textContent = state.calcWeight + ' kg';
          var recEl = $('#help-calc-rec');
          if (recEl) recEl.textContent = recommendSize(null, false, state.calcHeight, state.calcWeight).size;
        }
      });
    }
  }

  // ── Segunda imagen suave al hacer hover en tarjetas ────────

  function bindCardHoverPreview() {
    if (window.matchMedia && !window.matchMedia('(hover: hover)').matches) return;
    document.addEventListener('pointerenter', function (event) {
      if (!event.target || !event.target.closest) return;
      var card = event.target.closest('.card[data-product]');
      if (!card || card.getAttribute('data-alt-done')) return;
      if (parseInt(card.getAttribute('data-photos'), 10) <= 1) return;
      var id = card.getAttribute('data-product');
      var item = state.byId.get(id);
      if (!item) return;
      card.setAttribute('data-alt-done', '1');
      fetchAlbumCached(item).then(function (ordered) {
        if (!ordered || ordered.length < 2 || !card.isConnected) return;
        var media = card.querySelector('.card-media');
        if (!media || media.querySelector('.card-alt-img')) return;
        var altImg = document.createElement('img');
        altImg.className = 'card-alt-img';
        altImg.alt = '';
        altImg.decoding = 'async';
        altImg.onload = function () {
          altImg.classList.add('is-loaded');
          card.classList.add('has-alt');
        };
        altImg.src = photoUrl(ordered[1], 'small', item.source);
        media.insertBefore(altImg, media.querySelector('.img-skeleton'));
      }).catch(function () {});
    }, true);
  }

  // ── Eventos globales ─────────────────────────────────────

  function handleEscape() {
    var lightbox = $('#lightbox');
    if (lightbox && lightbox.classList.contains('is-open')) return closeLightbox();
    var pwaModal = $('#pwa-ios-modal');
    if (pwaModal && pwaModal.classList.contains('is-open')) return closeIosPwaModal();
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
    var help = $('#help-widget');
    if (help && !help.hidden) return closeHelpWidget();
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
        var stepBtn = event.target.closest('[data-lightbox-step]');
        if (stepBtn) {
          stepGallery(parseInt(stepBtn.getAttribute('data-lightbox-step'), 10) || 0);
          return;
        }
        if (event.target === lightbox) closeLightbox();
      });
      var lbTouchX = 0, lbTouchY = 0;
      lightbox.addEventListener('touchstart', function (event) {
        if (event.touches && event.touches.length === 1) {
          lbTouchX = event.touches[0].clientX;
          lbTouchY = event.touches[0].clientY;
        }
      }, { passive: true });
      lightbox.addEventListener('touchend', function (event) {
        if (!lbTouchX || !event.changedTouches || !event.changedTouches.length || state.gallery.length <= 1) return;
        var dx = event.changedTouches[0].clientX - lbTouchX;
        var dy = event.changedTouches[0].clientY - lbTouchY;
        lbTouchX = 0; lbTouchY = 0;
        if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          stepGallery(dx < 0 ? 1 : -1);
        }
      }, { passive: true });
    }
    var lightboxClose = $('#lightbox-close');
    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);

    bindTrackEvents();
    bindAdminEvents();

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

      var copyValBtn = event.target.closest('[data-copy-value]');
      if (copyValBtn) {
        var val = copyValBtn.getAttribute('data-copy-value') || '';
        var label = copyValBtn.getAttribute('data-copy-label') || 'Copiado al portapapeles';
        if (!val) return;
        copyText(val).then(function () {
          toast(label);
        }).catch(function () {
          toast('No se pudo copiar', 'error');
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

  function updateOfflineBanner() {
    var banner = $('#offline-banner');
    if (banner) banner.hidden = navigator.onLine !== false;
  }

  function isIosBrowser() {
    var ua = navigator.userAgent || '';
    return /iphone|ipad|ipod/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  }

  function isStandalonePwa() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }

  function refreshPwaInstallButtons() {
    var visible = !isStandalonePwa() && (!!state.deferredInstallPrompt || isIosBrowser());
    var mobileBtn = $('#pwa-install-btn');
    var footerBtn = $('#pwa-footer-install');
    if (mobileBtn) mobileBtn.hidden = !visible;
    if (footerBtn) footerBtn.hidden = !visible;
  }

  function openIosPwaModal() {
    var modal = $('#pwa-ios-modal');
    var backdrop = $('#pwa-ios-backdrop');
    if (!modal) return;
    modal.hidden = false;
    modal.classList.add('is-open');
    setOverlayState(modal, true);
    if (backdrop) {
      backdrop.hidden = false;
      requestAnimationFrame(function () { backdrop.classList.add('is-open'); });
    }
    lockScroll();
    setTimeout(function () {
      var done = $('#pwa-ios-done');
      if (done) done.focus();
    }, 120);
  }

  function closeIosPwaModal() {
    var modal = $('#pwa-ios-modal');
    if (!modal || !modal.classList.contains('is-open')) return;
    releaseFocus(modal);
    modal.classList.remove('is-open');
    setOverlayState(modal, false);
    modal.hidden = true;
    var backdrop = $('#pwa-ios-backdrop');
    if (backdrop) {
      backdrop.classList.remove('is-open');
      setTimeout(function () { if (!backdrop.classList.contains('is-open')) backdrop.hidden = true; }, 320);
    }
    unlockScroll();
  }

  async function triggerPwaInstall() {
    if (state.deferredInstallPrompt) {
      var promptEvt = state.deferredInstallPrompt;
      state.deferredInstallPrompt = null;
      refreshPwaInstallButtons();
      try {
        promptEvt.prompt();
        var choice = await promptEvt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          toast('Instalando app de KANG Team…');
        }
      } catch (e) {}
      return;
    }
    if (isIosBrowser()) {
      openIosPwaModal();
    }
  }

  function initPWA() {
    updateOfflineBanner();
    window.addEventListener('online', function () {
      updateOfflineBanner();
      toast('Conexión recuperada');
    });
    window.addEventListener('offline', updateOfflineBanner);

    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    }

    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      state.deferredInstallPrompt = event;
      refreshPwaInstallButtons();
    });
    window.addEventListener('appinstalled', function () {
      state.deferredInstallPrompt = null;
      refreshPwaInstallButtons();
      toast('KANG Team añadida a tu pantalla de inicio');
    });

    var mobileBtn = $('#pwa-install-btn');
    if (mobileBtn) mobileBtn.addEventListener('click', function () { closeMenu(); triggerPwaInstall(); });
    var footerBtn = $('#pwa-footer-install');
    if (footerBtn) footerBtn.addEventListener('click', triggerPwaInstall);

    var iosClose = $('#pwa-ios-close');
    if (iosClose) iosClose.addEventListener('click', closeIosPwaModal);
    var iosDone = $('#pwa-ios-done');
    if (iosDone) iosDone.addEventListener('click', closeIosPwaModal);
    var iosBackdrop = $('#pwa-ios-backdrop');
    if (iosBackdrop) iosBackdrop.addEventListener('click', closeIosPwaModal);

    refreshPwaInstallButtons();
  }

  function initAnalytics() {
    if (state.analyticsInitialized) return;
    state.analyticsInitialized = true;
    var host = String(location.hostname || '').toLowerCase();
    var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';
    var isAiStudio = /\.run\.app$/i.test(host) || /\.googleusercontent\.com$/i.test(host);

    if (!isLocal && !isAiStudio) {
      var va = document.createElement('script');
      va.defer = true;
      va.src = '/_vercel/insights/script.js';
      document.head.appendChild(va);
    }

    var gaId = state.config && state.config.analyticsGaId ? String(state.config.analyticsGaId).trim() : '';
    if (gaId && /^[A-Z0-9-]+$/i.test(gaId) && !isLocal) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', gaId);
      var gs = document.createElement('script');
      gs.async = true;
      gs.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
      document.head.appendChild(gs);
    }
  }

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
    initPWA();
    bindGlobalEvents();
    bindCatalogEvents();
    bindProductEvents();
    bindCartEvents();
    bindFavsEvents();
    bindOrdersEvents();
    bindCheckoutEvents();
    bindHelpWidget();
    bindCardHoverPreview();

    renderRoute(false);
    renderCatalogSkeletons();
    updateCartUI();
    updateFavsUI();
    updateOrdersUI();

    await Promise.all([loadConfig(), loadCatalog(), loadTeamLogos()]);
    initAnalytics();

    var prevCartLen = state.cart.length;
    state.cart = state.cart.filter(function (line) { return state.byId.has(line.id); });
    state.removedCartCount = Math.max(0, prevCartLen - state.cart.length);
    saveCart();
    state.favorites = state.favorites.filter(function (id) { return state.byId.has(id); });
    state.favSet = new Set(state.favorites);
    saveFavorites();
    updateCartUI();
    updateFavsUI();
    updateOrdersUI();
    renderRoute(false);
    if (state.removedCartCount > 0) {
      toast(state.removedCartCount + (state.removedCartCount === 1 ? ' prenda de tu carrito ya no está disponible y se ha retirado' : ' prendas de tu carrito ya no están disponibles y se han retirado'));
    }
  }

  // ── Seguimiento público y Panel de Administración ──────────

  var ORDER_STATUS_META = {
    pending: { label: 'Recibido · Pendiente', cls: 'is-pending', step: 0 },
    bizum_pending: { label: 'Esperando Bizum', cls: 'is-bizum', step: 0 },
    paid: { label: 'Pago confirmado', cls: 'is-paid', step: 1 },
    ordered: { label: 'Pedido a proveedor', cls: 'is-ordered', step: 2 },
    shipped: { label: 'En camino (2–3 sem.)', cls: 'is-shipped', step: 2 },
    ready: { label: 'Listo para recogida (Córdoba)', cls: 'is-ready', step: 3 },
    delivered: { label: 'Entregado', cls: 'is-delivered', step: 4 },
    cancelled: { label: 'Cancelado', cls: 'is-cancelled', step: -1 }
  };
  var ORDER_STEPS = [
    { key: 'received', label: 'Recibido' },
    { key: 'paid', label: 'Pago OK' },
    { key: 'transit', label: 'En camino (2–3 sem.)' },
    { key: 'ready', label: 'Listo en Córdoba' },
    { key: 'delivered', label: 'Entregado' }
  ];

  function orderStatusInfo(status) {
    return ORDER_STATUS_META[status] || { label: status || 'Pendiente', cls: 'is-pending', step: 0 };
  }

  function extractApiError(data, fallback) {
    if (!data) return fallback;
    if (typeof data.error === 'string' && data.error) return data.error;
    if (data.error && typeof data.error === 'object') {
      return data.error.message || data.error.code || fallback;
    }
    if (typeof data.message === 'string' && data.message) return data.message;
    return fallback;
  }

  function formatShortEsDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  function buildTrackEtaBox(order) {
    if (!order || order.status === 'cancelled') return '';
    if (order.status === 'ready') {
      return '<div class="track-eta-box is-ready">' +
        '<div><span>Recogida en Córdoba capital</span>' +
        '<strong>¡Tu pedido ya está listo para recoger!</strong>' +
        '<p>Escríbenos por WhatsApp para coordinar el punto y hora de recogida.</p></div>' +
      '</div>';
    }
    if (order.status === 'delivered') {
      return '<div class="track-eta-box is-delivered">' +
        '<div><span>Pedido completado</span><strong>Entregado</strong></div>' +
      '</div>';
    }
    var rangeText = '2 a 3 semanas desde el pedido al proveedor';
    var subText = order.deliveryMethod === 'outside_cordoba'
      ? 'Entrega fuera de Córdoba · te confirmamos detalles por WhatsApp cuando llegue.'
      : 'Cuando llegue te avisaremos para recogerlo en mano en Córdoba capital.';
    if (order.supplierOrderedAt) {
      var baseMs = new Date(order.supplierOrderedAt).getTime();
      if (!isNaN(baseMs)) {
        var minIso = new Date(baseMs + 14 * 86400000).toISOString();
        var maxIso = new Date(baseMs + 21 * 86400000).toISOString();
        rangeText = 'Llegada estimada: ' + formatShortEsDate(minIso) + ' – ' + formatShortEsDate(maxIso) + ' (2–3 semanas)';
      }
    }
    return '<div class="track-eta-box">' +
      '<div><span>Plazo estimado</span><strong>' + esc(rangeText) + '</strong><p>' + esc(subText) + '</p></div>' +
    '</div>';
  }

  async function lookupOrderTrack(id, phone4) {
    var cleanId = String(id || '').trim().toUpperCase();
    var cleanP4 = String(phone4 || '').replace(/\D/g, '').slice(-4);
    state.trackQueryId = cleanId;
    state.trackQueryPhone4 = cleanP4;
    state.trackError = '';
    state.trackLoading = true;
    renderTrackView();
    try {
      var res = await fetch('/api/orders/track?id=' + enc(cleanId) + '&phone4=' + enc(cleanP4), { headers: { 'Accept': 'application/json' } });
      var data = null;
      try { data = await res.json(); } catch (e) {}
      if (!res.ok) throw new Error(extractApiError(data, 'Error ' + res.status + ' al consultar el pedido'));
      state.trackResult = data && data.order ? data.order : null;
      state.trackError = '';
    } catch (err) {
      state.trackResult = null;
      state.trackError = err.message || 'No se pudo consultar el pedido';
    } finally {
      state.trackLoading = false;
      renderTrackView();
    }
  }

  function renderTrackView() {
    var box = $('#track-content');
    if (!box) return;
    var recentBtns = (state.orders || []).filter(function (o) { return /^KT-/.test(String(o.id || '')); }).slice(0, 4);
    var recentHtml = recentBtns.length
      ? '<div class="track-recent"><span>Tus pedidos guardados:</span>' + recentBtns.map(function (o) {
          return '<button type="button" class="track-recent-btn" data-fill-track-id="' + esc(o.id) + '" data-fill-track-p4="' + esc(o.phone4 || '') + '">' + esc(o.id) + '</button>';
        }).join('') + '</div>'
      : '';

    var resultHtml = '';
    if (state.trackLoading) {
      resultHtml = '<div class="track-card"><p class="track-loading">Buscando pedido…</p></div>';
    } else if (state.trackError) {
      resultHtml = '<div class="track-card is-error"><strong>No se pudo consultar</strong><p>' + esc(state.trackError) + '</p></div>';
    } else if (state.trackResult) {
      var o = state.trackResult;
      var st = orderStatusInfo(o.status);
      var timelineHtml = st.step === -1
        ? '<div class="track-cancelled-note">Este pedido ha sido marcado como cancelado. Si tienes cualquier duda escríbenos por WhatsApp con tu código.</div>'
        : '<ol class="track-timeline">' + ORDER_STEPS.map(function (step, idx) {
            var done = idx < st.step;
            var cur = idx === st.step;
            return '<li class="' + (done ? 'is-done' : (cur ? 'is-current' : '')) + '"><span class="track-step-dot">' + (done ? '✓' : (idx + 1)) + '</span><b>' + esc(step.label) + '</b></li>';
          }).join('') + '</ol>';

      var etaHtml = buildTrackEtaBox(o);
      var notesHtml = o.adminNotes ? '<div class="track-note-box"><span>Nota de la tienda</span><p>' + esc(o.adminNotes) + '</p></div>' : '';

      var itemsHtml = (o.items || []).map(function (it) {
        var extra = [it.size ? 'Talla ' + it.size : '', 'x' + (it.qty || 1), it.name || '', it.number ? '#' + it.number : '', (it.patches && it.patches !== 'No') ? it.patches : ''].filter(Boolean).join(' · ');
        return '<li><div><strong>' + esc(it.title) + '</strong><small>' + esc(extra) + '</small></div><b>' + esc(KangPricing.money(it.lineTotalCents || 0)) + '</b></li>';
      }).join('');

      var discountRows = '';
      if ((o.volumeDiscountCents || 0) > 0 || (o.promoDiscountCents || 0) > 0) {
        discountRows = '<div class="track-discounts">' +
          '<div><span>Subtotal prendas</span><b>' + esc(KangPricing.money(o.subtotalCents || o.totalPriceCents || 0)) + '</b></div>' +
          ((o.volumeDiscountCents || 0) > 0 ? '<div class="is-discount"><span>Descuento grupo (' + esc(o.volumeDiscountLabel || '') + ')</span><b>-' + esc(KangPricing.money(o.volumeDiscountCents)) + '</b></div>' : '') +
          ((o.promoDiscountCents || 0) > 0 ? '<div class="is-discount"><span>Cupón ' + esc(o.promoCode || '') + '</span><b>-' + esc(KangPricing.money(o.promoDiscountCents)) + '</b></div>' : '') +
        '</div>';
      }

      var historyHtml = Array.isArray(o.statusHistory) && o.statusHistory.length
        ? '<div class="track-history"><h3>Historial</h3><ul>' + o.statusHistory.slice().reverse().map(function (h) {
            return '<li><span>' + esc(formatDate(h.at)) + '</span><b>' + esc(h.note || orderStatusInfo(h.status).label) + '</b></li>';
          }).join('') + '</ul></div>'
        : '';

      var deliveryLabel = o.deliveryMethod === 'outside_cordoba' ? 'Fuera de Córdoba (a consultar)' : 'Recogida en Córdoba · Gratis';

      resultHtml = '<article class="track-card">' +
        '<div class="track-card-head">' +
          '<div><span class="track-id-label">Pedido ' + esc(o.id) + '</span><h2>' + esc(st.label) + '</h2><p>Creado el ' + esc(formatDate(o.createdAt)) + ' · ' + (o.paymentMethod === 'bizum' ? 'Pago por Bizum' : 'Confirmación WhatsApp / Email') + ' · ' + esc(deliveryLabel) + '</p></div>' +
          '<div class="track-total-col"><span class="admin-status-badge ' + esc(st.cls) + '">' + esc(st.label) + '</span><strong>' + esc(KangPricing.money(o.totalPriceCents || 0)) + '</strong></div>' +
        '</div>' +
        timelineHtml +
        etaHtml +
        notesHtml +
        '<div class="track-items"><h3>Prendas (' + (o.totalItems || 0) + ')</h3><ul>' + itemsHtml + '</ul>' + discountRows + '</div>' +
        historyHtml +
      '</article>';
    }

    box.innerHTML = '<form class="track-form" id="track-form">' +
        '<label class="field"><span>Código de pedido</span>' +
          '<input type="text" name="id" id="track-id-input" placeholder="KT-261115-ABCD" value="' + esc(state.trackQueryId) + '" required></label>' +
        '<label class="field"><span>Últimos 4 dígitos del teléfono</span>' +
          '<input type="text" name="phone4" id="track-phone4-input" maxlength="4" inputmode="numeric" placeholder="6789" value="' + esc(state.trackQueryPhone4) + '" required></label>' +
        '<button type="submit" class="btn btn-primary">Consultar estado</button>' +
      '</form>' +
      recentHtml +
      resultHtml;
  }

  function bindTrackEvents() {
    var box = $('#track-content');
    if (!box) return;
    box.addEventListener('submit', function (event) {
      if (event.target && event.target.id === 'track-form') {
        event.preventDefault();
        var id = ($('#track-id-input') && $('#track-id-input').value || '').trim().toUpperCase();
        var p4 = ($('#track-phone4-input') && $('#track-phone4-input').value || '').replace(/\D/g, '').slice(-4);
        if (!id || p4.length !== 4) {
          toast('Introduce el código KT-... y 4 dígitos del teléfono', 'error');
          return;
        }
        try { history.replaceState(null, '', '#/seguimiento?id=' + enc(id) + '&phone4=' + enc(p4)); } catch (e) {}
        lookupOrderTrack(id, p4);
      }
    });
    box.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-fill-track-id]');
      if (!btn) return;
      var id = btn.getAttribute('data-fill-track-id') || '';
      var p4 = btn.getAttribute('data-fill-track-p4') || '';
      state.trackQueryId = id;
      if (p4) state.trackQueryPhone4 = p4;
      renderTrackView();
      if (id && p4.length === 4) lookupOrderTrack(id, p4);
    });
  }

  async function loadAdminOrders() {
    state.adminLoading = true;
    state.adminError = '';
    renderAdminView();
    try {
      var headers = { 'Accept': 'application/json' };
      if (state.adminToken) headers['x-admin-token'] = state.adminToken;
      var res = await fetch('/api/admin/orders', { headers: headers });
      var data = null;
      try { data = await res.json(); } catch (e) {}
      if (res.status === 401) {
        state.adminNeedsToken = true;
        state.adminError = state.adminToken ? extractApiError(data, 'Token incorrecto') : '';
        state.adminOrders = [];
        return;
      }
      if (!res.ok) throw new Error(extractApiError(data, 'Error ' + res.status + ' al cargar los pedidos'));
      state.adminNeedsToken = false;
      state.adminOrders = Array.isArray(data && data.orders) ? data.orders : [];
      state.adminStats = (data && data.stats) || null;
      state.adminMeta = {
        storageMode: data && data.storageMode,
        isVercel: !!(data && data.isVercel),
        adminConfigured: !!(data && data.adminConfigured)
      };
    } catch (err) {
      state.adminError = err.message || 'Error al cargar el panel';
    } finally {
      state.adminLoading = false;
      renderAdminView();
    }
  }

  async function updateAdminOrder(orderId, patch) {
    try {
      var headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
      if (state.adminToken) headers['x-admin-token'] = state.adminToken;
      var res = await fetch('/api/admin/orders/' + enc(orderId), {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify(patch)
      });
      var data = null;
      try { data = await res.json(); } catch (e) {}
      if (res.status === 401) {
        state.adminNeedsToken = true;
        state.adminError = 'Sesión caducada o token incorrecto';
        renderAdminView();
        return;
      }
      if (!res.ok) throw new Error(extractApiError(data, 'No se pudo actualizar (' + res.status + ')'));
      toast('Pedido ' + orderId + ' actualizado' + (data && data.emailSent ? ' · Email enviado al cliente' : ''));
      await loadAdminOrders();
    } catch (err) {
      toast(err.message || 'No se pudo guardar', 'error');
    }
  }

  async function deleteAdminOrder(orderId) {
    try {
      var headers = { 'Accept': 'application/json' };
      if (state.adminToken) headers['x-admin-token'] = state.adminToken;
      var res = await fetch('/api/admin/orders/' + enc(orderId), {
        method: 'DELETE',
        headers: headers
      });
      var data = null;
      try { data = await res.json(); } catch (e) {}
      if (res.status === 401) {
        state.adminNeedsToken = true;
        state.adminError = 'Sesión caducada o token incorrecto';
        renderAdminView();
        return;
      }
      if (!res.ok) throw new Error(extractApiError(data, 'No se pudo eliminar (' + res.status + ')'));
      state.adminDeleteConfirmId = '';
      toast('Pedido ' + orderId + ' eliminado');
      await loadAdminOrders();
    } catch (err) {
      toast(err.message || 'Error al eliminar pedido', 'error');
    }
  }

  function exportAdminCsv() {
    var rows = state.adminOrders || [];
    if (!rows.length) {
      toast('No hay pedidos para exportar', 'error');
      return;
    }
    function csvCell(v) {
      var s = String(v === undefined || v === null ? '' : v).replace(/\r?\n/g, ' ');
      return '"' + s.replace(/"/g, '""') + '"';
    }
    var header = ['ID', 'Fecha', 'Estado', 'Cliente', 'Telefono', 'Email', 'Ciudad', 'Entrega', 'MetodoPago', 'Prendas', 'SubtotalEUR', 'DtoGrupoEUR', 'Cupon', 'DtoCuponEUR', 'TotalEUR', 'TransportistaInterno', 'TrackingInterno', 'Notas'];
    var lines = [header.map(csvCell).join(',')];
    rows.forEach(function (o) {
      var st = orderStatusInfo(o.status).label;
      var deliveryTxt = o.deliveryMethod === 'outside_cordoba' ? 'Fuera de Córdoba' : 'Recogida Córdoba';
      var eur = function (cents) { return ((Number(cents) || 0) / 100).toFixed(2); };
      lines.push([
        o.id,
        o.createdAt || '',
        st,
        o.customer && o.customer.name,
        o.customer && o.customer.phone,
        o.customer && o.customer.email,
        o.customer && o.customer.city,
        deliveryTxt,
        o.paymentMethod || '',
        o.totalItems || 0,
        eur(o.subtotalCents || o.totalPriceCents),
        eur(o.volumeDiscountCents || 0),
        o.promoCode || '',
        eur(o.promoDiscountCents || 0),
        eur(o.totalPriceCents || 0),
        o.trackingCarrier || '',
        o.trackingCode || '',
        o.adminNotes || ''
      ].map(csvCell).join(','));
    });
    var blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'kang-team-pedidos-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('CSV exportado (' + rows.length + ' pedidos)');
  }

  async function adminTriggerSync() {
    try {
      var headers = { 'Accept': 'application/json' };
      if (state.adminToken) headers['x-admin-token'] = state.adminToken;
      var res = await fetch('/api/sync', { method: 'POST', headers: headers });
      var data = null;
      try { data = await res.json(); } catch (e) {}
      if (!res.ok) throw new Error(extractApiError(data, 'No se pudo iniciar la sincronización'));
      toast('Sincronización de catálogo iniciada en segundo plano');
    } catch (err) {
      toast(err.message || 'Error al sincronizar', 'error');
    }
  }

  function buildCustomerWhatsappUrl(order) {
    var phone = String((order.customer && order.customer.phone) || '').replace(/\D/g, '');
    if (phone.length === 9 && /^[6789]/.test(phone)) phone = '34' + phone;
    var st = orderStatusInfo(order.status).label;
    var phone4 = String((order.customer && order.customer.phone) || '').replace(/\D/g, '').slice(-4);
    var trackUrl = location.origin + '/#/seguimiento?id=' + encodeURIComponent(order.id) + (phone4 ? '&phone4=' + encodeURIComponent(phone4) : '');
    var name = (order.customer && order.customer.name) || '';
    var lines = ['Hola' + (name ? ' ' + name : '') + ', te escribimos de KANG Team sobre tu pedido ' + order.id + '.'];
    if (order.status === 'ready') {
      lines.push('¡Buenas noticias! Tu pedido ya está listo para recoger en Córdoba capital. ¿Cuándo te viene bien quedar?');
    } else if (order.status === 'ordered' || order.status === 'shipped') {
      lines.push('Tu pedido ya está tramitado / en camino. El plazo estimado de llegada es de 2 a 3 semanas.');
    } else {
      lines.push('Estado actual: ' + st + '.');
    }
    if (order.adminNotes) lines.push('Nota: ' + order.adminNotes);
    lines.push('Consulta el estado cuando quieras aquí: ' + trackUrl);
    return (phone ? 'https://wa.me/' + phone : 'https://wa.me/') + '?text=' + encodeURIComponent(lines.join('\n'));
  }

  function renderAdminView() {
    var box = $('#admin-content');
    if (!box) return;

    if (state.adminNeedsToken) {
      box.innerHTML = '<form class="admin-auth-card" id="admin-auth-form">' +
          '<h2>Acceso administrador</h2>' +
          '<p>Introduce el <code>ADMIN_TOKEN</code> configurado en el servidor para gestionar los pedidos y códigos de seguimiento.</p>' +
          (state.adminError ? '<div class="form-error is-visible">' + esc(state.adminError) + '</div>' : '') +
          '<label class="field"><span>Token de administrador</span>' +
            '<input type="password" id="admin-token-input" placeholder="Tu ADMIN_TOKEN" autocomplete="current-password" required></label>' +
          '<button type="submit" class="btn btn-primary btn-block">Entrar al panel</button>' +
        '</form>';
      return;
    }

    if (state.adminLoading && !state.adminOrders.length) {
      box.innerHTML = '<div class="track-card"><p class="track-loading">Cargando pedidos…</p></div>';
      return;
    }

    if (state.adminError && !state.adminOrders.length) {
      box.innerHTML = '<div class="track-card is-error"><strong>No disponible</strong><p>' + esc(state.adminError) + '</p>' +
        '<button type="button" class="btn btn-outline" id="admin-retry-btn">Reintentar</button></div>';
      return;
    }

    var meta = state.adminMeta || {};
    var storageText = meta.storageMode === 'blob' ? 'Vercel Blob (persistente)' : (meta.storageMode === 'disk' ? 'Disco local (data/orders)' : 'Memoria temporal (sin Vercel Blob conectado)');
    var stats = state.adminStats || { totalOrders: 0, pendingCount: 0, inProgressCount: 0, shippedCount: 0, revenueCents: 0, topTeams: [] };

    var filtered = state.adminOrders.filter(function (o) {
      if (state.adminStatusFilter && o.status !== state.adminStatusFilter) return false;
      if (state.adminSearch) {
        var hay = normalize([o.id, o.customer && o.customer.name, o.customer && o.customer.phone, o.customer && o.customer.city, (o.items || []).map(function (i) { return i.team + ' ' + i.title; }).join(' ')].join(' '));
        if (hay.indexOf(normalize(state.adminSearch)) === -1) return false;
      }
      return true;
    });

    var statusChips = [['', 'Todos']].concat(Object.keys(ORDER_STATUS_META).map(function (k) { return [k, ORDER_STATUS_META[k].label]; }));
    var cardsHtml = filtered.length
      ? filtered.map(function (o) {
          var st = orderStatusInfo(o.status);
          var waHref = buildCustomerWhatsappUrl(o);
          var isConfirmDelete = state.adminDeleteConfirmId === o.id;
          var hasEmail = !!(o.customer && o.customer.email);
          var itemsList = (o.items || []).map(function (it) {
            return '<li><span>' + esc(it.title) + '</span><b>Talla ' + esc(it.size) + ' ×' + (it.qty || 1) + (it.name ? ' · ' + esc(it.name) : '') + (it.number ? ' #' + esc(it.number) : '') + (it.patches && it.patches !== 'No' ? ' · ' + esc(it.patches) : '') + '</b></li>';
          }).join('');
          var statusOptions = Object.keys(ORDER_STATUS_META).map(function (k) {
            return '<option value="' + esc(k) + '"' + (o.status === k ? ' selected' : '') + '>' + esc(ORDER_STATUS_META[k].label) + '</option>';
          }).join('');
          var promoBadge = o.promoCode ? '<span class="admin-pay-tag is-promo">Cupón ' + esc(o.promoCode) + '</span>' : '';
          var deliveryTag = o.deliveryMethod === 'outside_cordoba' ? 'Fuera Córdoba' : 'Recogida Córdoba';
          return '<article class="admin-order-card" data-admin-order="' + esc(o.id) + '">' +
            '<div class="admin-order-head">' +
              '<div>' +
                '<div class="admin-order-title-row"><strong>' + esc(o.id) + '</strong><span class="admin-status-badge ' + esc(st.cls) + '">' + esc(st.label) + '</span><span class="admin-pay-tag">' + (o.paymentMethod === 'bizum' ? 'Bizum' : 'WhatsApp/Email') + '</span><span class="admin-pay-tag">' + esc(deliveryTag) + '</span>' + promoBadge + '</div>' +
                '<p class="admin-customer-line">' + esc(o.customer && o.customer.name) + ' · ' + esc(o.customer && o.customer.phone) + (o.customer && o.customer.city ? ' · ' + esc(o.customer.city) : '') + (hasEmail ? ' · ' + esc(o.customer.email) : '') + '</p>' +
                (o.customer && o.customer.notes ? '<p class="admin-customer-notes">Nota cliente: ' + esc(o.customer.notes) + '</p>' : '') +
              '</div>' +
              '<div class="admin-order-total"><strong>' + esc(KangPricing.money(o.totalPriceCents || 0)) + '</strong><span>' + esc(formatDate(o.createdAt)) + ' · ' + (o.totalItems || 0) + ' art.</span></div>' +
            '</div>' +
            '<ul class="admin-order-items">' + itemsList + '</ul>' +
            '<form class="admin-order-edit" data-admin-edit="' + esc(o.id) + '">' +
              '<label class="field"><span>Estado</span><select name="status">' + statusOptions + '</select></label>' +
              '<label class="field"><span>Transportista (interno)</span><input type="text" name="trackingCarrier" placeholder="17TRACK / YunExpress..." value="' + esc(o.trackingCarrier || '') + '"></label>' +
              '<label class="field"><span>Tracking privado</span><div class="admin-tracking-wrap"><input type="text" name="trackingCode" placeholder="Oculto al cliente" value="' + esc(o.trackingCode || '') + '">' + (o.trackingCode ? '<a class="admin-track-ext" href="https://t.17track.net/es#nums=' + enc(o.trackingCode) + '" target="_blank" rel="noopener" title="Abrir en 17TRACK (solo admin)">17TRACK</a>' : '') + '</div></label>' +
              '<label class="field admin-field-notes"><span>Nota (visible en seguimiento)</span><input type="text" name="adminNotes" placeholder="Ej: Llega aprox. la semana próxima" value="' + esc(o.adminNotes || '') + '"></label>' +
              '<div class="admin-order-btns">' +
                '<button type="submit" class="btn btn-primary">Guardar</button>' +
                '<a class="btn btn-whatsapp" href="' + esc(waHref) + '" target="_blank" rel="noopener"><svg><use href="#i-whatsapp"/></svg> WhatsApp</a>' +
                '<button type="button" class="btn btn-outline admin-delete-btn' + (isConfirmDelete ? ' is-confirm' : '') + '" data-admin-delete="' + esc(o.id) + '" title="Eliminar pedido">' + (isConfirmDelete ? '¿Confirmar?' : 'Eliminar') + '</button>' +
              '</div>' +
              '<div class="admin-edit-meta">' +
                (hasEmail
                  ? '<label class="admin-notify-check"><input type="checkbox" name="notifyEmail" checked> Avisar por email si cambia estado</label>'
                  : '<span class="admin-notify-muted">Sin email para aviso automático</span>') +
                '<span class="admin-private-hint">El código tracking es privado y nunca se muestra al cliente.</span>' +
              '</div>' +
            '</form>' +
          '</article>';
        }).join('')
      : '<div class="empty-state"><h3>Sin pedidos en esta vista</h3><p>Cuando lleguen pedidos o ajustes el filtro aparecerán aquí.</p></div>';

    box.innerHTML =
      '<div class="admin-topbar">' +
        '<div class="admin-storage-note">Almacenamiento: <strong>' + esc(storageText) + '</strong>' + (meta.isVercel && meta.storageMode !== 'blob' ? ' · <em>Activa Vercel Blob para guardar pedidos entre despliegues</em>' : '') + '</div>' +
        '<div class="admin-topbar-actions">' +
          (!meta.isVercel ? '<button type="button" class="btn btn-outline" id="admin-sync-btn">Sincronizar catálogo</button>' : '') +
          '<button type="button" class="btn btn-outline" id="admin-export-csv">Exportar CSV</button>' +
          '<button type="button" class="btn btn-outline" id="admin-refresh-btn">Actualizar</button>' +
          (state.adminToken ? '<button type="button" class="btn btn-ghost" id="admin-logout-btn">Cerrar sesión</button>' : '') +
        '</div>' +
      '</div>' +
      '<div class="admin-kpis">' +
        '<div class="admin-kpi"><span>Pedidos totales</span><strong>' + fmt(stats.totalOrders) + '</strong></div>' +
        '<div class="admin-kpi"><span>Pendientes / Bizum</span><strong>' + fmt(stats.pendingCount) + '</strong></div>' +
        '<div class="admin-kpi"><span>Pagados / En curso</span><strong>' + fmt(stats.inProgressCount) + '</strong></div>' +
        '<div class="admin-kpi"><span>Volumen estimado</span><strong class="is-volt">' + esc(KangPricing.money(stats.revenueCents || 0)) + '</strong></div>' +
      '</div>' +
      '<div class="admin-filters">' +
        '<label class="searchbox"><svg><use href="#i-search"/></svg><input type="search" id="admin-search-input" placeholder="Buscar por código KT-, cliente, teléfono o equipo…" value="' + esc(state.adminSearch) + '"></label>' +
        '<div class="admin-status-chips">' + statusChips.map(function (c) {
          return '<button type="button" class="' + (state.adminStatusFilter === c[0] ? 'is-active' : '') + '" data-admin-status="' + esc(c[0]) + '">' + esc(c[1]) + '</button>';
        }).join('') + '</div>' +
      '</div>' +
      '<div class="admin-orders-list">' + cardsHtml + '</div>';
  }

  function bindAdminEvents() {
    var box = $('#admin-content');
    if (!box) return;
    box.addEventListener('submit', function (event) {
      var authForm = event.target.closest('#admin-auth-form');
      if (authForm) {
        event.preventDefault();
        var tok = ($('#admin-token-input') && $('#admin-token-input').value || '').trim();
        state.adminToken = tok;
        try { sessionStorage.setItem('kang_admin_token', tok); } catch (e) {}
        loadAdminOrders();
        return;
      }
      var editForm = event.target.closest('[data-admin-edit]');
      if (editForm) {
        event.preventDefault();
        var orderId = editForm.getAttribute('data-admin-edit');
        var notifyCb = editForm.elements.notifyEmail;
        updateAdminOrder(orderId, {
          status: editForm.elements.status.value,
          trackingCarrier: editForm.elements.trackingCarrier.value.trim(),
          trackingCode: editForm.elements.trackingCode.value.trim(),
          adminNotes: editForm.elements.adminNotes.value.trim(),
          notifyEmail: notifyCb ? !!notifyCb.checked : true
        });
      }
    });
    box.addEventListener('click', function (event) {
      if (event.target.closest('#admin-refresh-btn') || event.target.closest('#admin-retry-btn')) {
        loadAdminOrders();
        return;
      }
      if (event.target.closest('#admin-export-csv')) {
        exportAdminCsv();
        return;
      }
      if (event.target.closest('#admin-sync-btn')) {
        adminTriggerSync();
        return;
      }
      if (event.target.closest('#admin-logout-btn')) {
        state.adminToken = '';
        state.adminNeedsToken = true;
        try { sessionStorage.removeItem('kang_admin_token'); } catch (e) {}
        renderAdminView();
        return;
      }
      var delBtn = event.target.closest('[data-admin-delete]');
      if (delBtn) {
        var delId = delBtn.getAttribute('data-admin-delete') || '';
        if (state.adminDeleteConfirmId === delId) {
          deleteAdminOrder(delId);
        } else {
          state.adminDeleteConfirmId = delId;
          renderAdminView();
        }
        return;
      }
      var chip = event.target.closest('[data-admin-status]');
      if (chip) {
        state.adminStatusFilter = chip.getAttribute('data-admin-status') || '';
        state.adminDeleteConfirmId = '';
        renderAdminView();
      }
    });
    box.addEventListener('input', function (event) {
      if (event.target && event.target.id === 'admin-search-input') {
        state.adminSearch = event.target.value || '';
        renderAdminView();
        var inp = $('#admin-search-input');
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      }
    });
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
