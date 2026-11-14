'use strict';

var https = require('https');
var teamsLib = require('./teams');

var INDEX_URL = 'https://football-logos.cc/ac-v3.json';
var ASSET_BASE = 'https://assets.football-logos.cc';
var CONFEDERATIONS = { fifa: true, uefa: true, conmebol: true, concacaf: true, afc: true, caf: true, ofc: true };
var TTL_MS = 12 * 60 * 60 * 1000;

var LEAGUE_TO_CAT = {
  'LaLiga': 'spain',
  'Premier League': 'england',
  'Serie A': 'italy',
  'Bundesliga': 'germany',
  'Ligue 1': 'france',
  'Brasileirão': 'brazil',
  'Liga Profesional': 'argentina',
  'Primeira Liga': 'portugal',
  'Eredivisie': 'netherlands',
  'Liga MX': 'mexico',
  'MLS': 'usa',
  'Chilean League': 'chile',
  'Scottish League': 'scotland'
};

var NATION_CAT_OVERRIDES = {
  'estados unidos': 'usa',
  'irlanda': 'republic-of-ireland',
  'rd congo': 'congo-dr',
  'costa de marfil': 'cote-d-ivoire',
  'turquia': 'turkey',
  'bosnia': 'bosnia-and-herzegovina',
  'emiratos arabes unidos': 'uae',
  'palestinian': 'palestine',
  'republica checa': 'czech-republic',
  'corea del sur': 'south-korea',
  'cabo verde': 'cape-verde',
  'curazao': 'curacao',
  'arabia saudi': 'saudi-arabia',
  'islas feroe': 'faroe-islands',
  'nueva zelanda': 'new-zealand',
  'sudafrica': 'south-africa',
  'macedonia del norte': 'north-macedonia',
  'irlanda del norte': 'northern-ireland',
  'trinidad y tobago': 'trinidad-and-tobago',
  'costa rica': 'costa-rica',
  'el salvador': 'el-salvador',
  'burkina faso': 'burkina-faso',
  'san marino': 'san-marino',
  'paises bajos': 'netherlands'
};

var EXTRA_ALIASES = {
  'inter de milan': 'italy/inter',
  'inter miami': 'usa/inter-miami-cf',
  'chivas de guadalajara': 'mexico/cd-guadalajara',
  'olympique de marsella': 'france/marseille',
  'olympique de marseille 125th': 'france/marseille',
  'olympique de lyon': 'france/lyon',
  'wolverhampton': 'england/wolves',
  'pumas unam': 'mexico/unam-pumas',
  'braga': 'portugal/sc-braga',
  'monaco': 'france/as-monaco',
  'como': 'italy/como-1907',
  'deportivo universidad catolica': 'chile/universidad-catolica',
  'universidad catolica': 'chile/universidad-catolica',
  'atletico rosario central': 'argentina/rosario-central',
  'san lorenzo': 'argentina/san-lorenzo-de-almagro',
  'rc strasbourg': 'france/rc-strasbourg-alsace',
  'dusseldorf': 'germany/fortuna-dusseldorf',
  'nurnberg': 'germany/1-fc-nurnberg',
  'kaiserslautern': 'germany/fc-kaiserslautern',
  'brescia calcio': 'italy/brescia',
  'brighton': 'england/brighton-and-hove-albion',
  'west bromwich albion': 'england/west-brom',
  'stade brestois': 'france/brest',
  'stade rennais': 'france/rennes',
  'los angeles fc': 'usa/lafc',
  'la galaxy': 'usa/la-galaxy',
  'new york city fc': 'usa/nycfc',
  'chicago fire': 'usa/chicago-fire-fc',
  'club leon': 'mexico/club-leon',
  'monterey': 'mexico/monterrey',
  'cartagena': 'spain/fc-cartagena',
  'eindhoven': 'netherlands/psv',
  'al hilal': 'saudi-arabia/al-hilal',
  'al nassr': 'saudi-arabia/al-nassr',
  'al ittihad': 'saudi-arabia/al-ittihad',
  'al ahly': 'egypt/al-ahly',
  'vest flamengo': 'brazil/flamengo',
  'kobe bryant x barcelona': 'spain/barcelona',
  'ad': 'brands/adidas',
  'adidas originals': 'brands/adidas',
  'ad cotton padded': 'brands/adidas',
  'nk': 'brands/nike',
  'nike t90': 'brands/nike',
  'nk cotton padded': 'brands/nike',
  'nk cotton gilet ty': 'brands/nike',
  'pm': 'brands/puma',
  'ua': 'brands/under-armour',
  'jm': 'brands/joma'
};

var SPANISH_TO_EN = {};
teamsLib.NATIONS.forEach(function (row) {
  SPANISH_TO_EN[norm(row[1])] = norm(row[0]);
});

var CLUB_ALIASES = {};
teamsLib.EXTRA_CLUBS.forEach(function (row) {
  CLUB_ALIASES[norm(row[0])] = row.slice(2).map(norm);
});

var indexCache = { fetchedAt: 0, entries: null, indexes: null };
var inFlightIndex = null;
var resolvedCache = { signature: '', fetchedAt: 0, payload: null };

function norm(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cleanTeamLookupName(name) {
  return norm(
    String(name || '')
      .replace(/\b\d{2}\s*\/\s*\d{2}\b/g, ' ')
      .replace(/\b\d{2,3}(?:th|st|nd|rd)\b/ig, ' ')
      .replace(/\b(?:19|20)\d{2}\b/g, ' ')
  );
}

function stripClubAffixes(n) {
  return n
    .replace(/\b(?:fc|cf|sc|afc|ca|cd|rc|rcd|as|ac|sl|ud|sd|ss|ssc|club|deportivo|atletico)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildLogoUrl(entry) {
  if (!entry || !entry.id || !entry.h) return '';
  var isConfed = entry.categoryId === 'tournaments' && CONFEDERATIONS[entry.id.split('--')[0]];
  var prefix = isConfed ? '/logos' : '/logos/' + entry.categoryId;
  return ASSET_BASE + prefix + '/64x64/' + entry.id + '.' + entry.h + '.png';
}

function addToIndex(map, key, entry) {
  if (!key) return;
  var bucket = map.get(key);
  if (!bucket) {
    bucket = [];
    map.set(key, bucket);
  }
  bucket.push(entry);
}

function buildIndexes(entries) {
  var byPath = new Map();
  var byNorm = new Map();
  var byNormCat = new Map();
  var nationalByCat = new Map();

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    if (!entry || !entry.id || !entry.categoryId || !entry.h || !entry.hasPng) continue;
    byPath.set(entry.categoryId + '/' + entry.id, entry);

    if (/-national-team$/.test(entry.id)) {
      nationalByCat.set(entry.categoryId, entry);
      addToIndex(byNorm, norm(entry.name), entry);
      if (Array.isArray(entry.alt)) {
        for (var j = 0; j < entry.alt.length; j++) addToIndex(byNorm, norm(entry.alt[j]), entry);
      }
      continue;
    }

    if (entry.categoryId === 'tournaments') continue;

    var keys = [norm(entry.name), norm(entry.id.replace(/-/g, ' '))];
    if (Array.isArray(entry.alt)) {
      for (var k = 0; k < entry.alt.length; k++) keys.push(norm(entry.alt[k]));
    }
    for (var m = 0; m < keys.length; m++) {
      addToIndex(byNorm, keys[m], entry);
      addToIndex(byNormCat, entry.categoryId + '|' + keys[m], entry);
    }
  }

  return {
    byPath: byPath,
    byNorm: byNorm,
    byNormCat: byNormCat,
    nationalByCat: nationalByCat
  };
}

function pickBest(list, preferCat) {
  if (!list || !list.length) return null;
  var nonNational = list.filter(function (e) { return !/-national-team$/.test(e.id); });
  var pool = nonNational.length ? nonNational : list;
  if (preferCat) {
    var inCat = pool.filter(function (e) { return e.categoryId === preferCat; });
    if (inCat.length) {
      return inCat.slice().sort(function (a, b) { return (b.variantCount || 0) - (a.variantCount || 0); })[0];
    }
  }
  return pool.slice().sort(function (a, b) { return (b.variantCount || 0) - (a.variantCount || 0); })[0];
}

function resolveTeamEntry(teamName, league, indexes) {
  var rawNorm = norm(teamName);
  var cleanedNorm = cleanTeamLookupName(teamName);
  var n = cleanedNorm || rawNorm;
  if (!n || n === 'otros') return null;

  if (EXTRA_ALIASES[rawNorm] && indexes.byPath.has(EXTRA_ALIASES[rawNorm])) {
    return indexes.byPath.get(EXTRA_ALIASES[rawNorm]);
  }
  if (EXTRA_ALIASES[n] && indexes.byPath.has(EXTRA_ALIASES[n])) {
    return indexes.byPath.get(EXTRA_ALIASES[n]);
  }

  if (league === 'Selecciones' || NATION_CAT_OVERRIDES[n] || n === 'palestinian') {
    var cat = NATION_CAT_OVERRIDES[n] || (SPANISH_TO_EN[n] || n).replace(/\s+/g, '-');
    if (indexes.nationalByCat.has(cat)) return indexes.nationalByCat.get(cat);
    var natHits = indexes.byNorm.get(SPANISH_TO_EN[n] || n);
    if (natHits) {
      for (var i = 0; i < natHits.length; i++) {
        if (/-national-team$/.test(natHits[i].id)) return natHits[i];
      }
    }
  }

  var preferCat = LEAGUE_TO_CAT[league] || '';
  var candidates = [n];
  if (rawNorm && rawNorm !== n) candidates.push(rawNorm);
  if (CLUB_ALIASES[n]) candidates = candidates.concat(CLUB_ALIASES[n]);
  var stripped = stripClubAffixes(n);
  if (stripped && stripped.length >= 3 && stripped !== n) candidates.push(stripped);

  for (var j = 0; j < candidates.length; j++) {
    var cand = candidates[j];
    if (!cand) continue;
    if (preferCat && indexes.byNormCat.has(preferCat + '|' + cand)) {
      return pickBest(indexes.byNormCat.get(preferCat + '|' + cand), preferCat);
    }
    if (indexes.byNorm.has(cand)) {
      return pickBest(indexes.byNorm.get(cand), preferCat);
    }
  }

  return null;
}

function fetchIndexJson() {
  return new Promise(function (resolve, reject) {
    var req = https.get(INDEX_URL, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'KangTeamCatalog/1.0 (+https://football-logos.cc)'
      }
    }, function (res) {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode + ' al obtener logos'));
      }
      var chunks = [];
      res.on('data', function (chunk) { chunks.push(chunk); });
      res.on('end', function () {
        try {
          var parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (!Array.isArray(parsed)) return reject(new Error('Formato no válido en ac-v3.json'));
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('timeout', function () {
      req.destroy(new Error('Tiempo de espera agotado al obtener logos'));
    });
    req.on('error', reject);
  });
}

async function ensureIndexes() {
  var now = Date.now();
  if (indexCache.indexes && (now - indexCache.fetchedAt) < TTL_MS) {
    return indexCache;
  }
  if (!inFlightIndex) {
    inFlightIndex = fetchIndexJson().then(function (entries) {
      indexCache = {
        fetchedAt: Date.now(),
        entries: entries,
        indexes: buildIndexes(entries)
      };
      inFlightIndex = null;
      return indexCache;
    }).catch(function (err) {
      inFlightIndex = null;
      if (indexCache.indexes) return indexCache;
      throw err;
    });
  }
  return inFlightIndex;
}

async function getTeamLogos(items, catalogVersion) {
  var list = Array.isArray(items) ? items : [];
  var signature = String(catalogVersion || list.length);
  var now = Date.now();
  if (resolvedCache.payload && resolvedCache.signature === signature && (now - resolvedCache.fetchedAt) < TTL_MS) {
    return resolvedCache.payload;
  }

  var state;
  try {
    state = await ensureIndexes();
  } catch (err) {
    if (resolvedCache.payload) return resolvedCache.payload;
    return { updatedAt: null, totalTeams: 0, matched: 0, logos: {} };
  }

  var teamLeagues = {};
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    if (!item || !item.team || item.team === 'Otros') continue;
    if (!teamLeagues[item.team]) teamLeagues[item.team] = item.league || '';
  }

  var logos = {};
  var teamNames = Object.keys(teamLeagues);
  var matched = 0;
  for (var j = 0; j < teamNames.length; j++) {
    var teamName = teamNames[j];
    var entry = resolveTeamEntry(teamName, teamLeagues[teamName], state.indexes);
    if (entry) {
      var url = buildLogoUrl(entry);
      if (url) {
        logos[teamName] = url;
        matched++;
      }
    }
  }

  var payload = {
    updatedAt: new Date(state.fetchedAt).toISOString(),
    source: 'https://football-logos.cc/',
    totalTeams: teamNames.length,
    matched: matched,
    logos: logos
  };

  resolvedCache = {
    signature: signature,
    fetchedAt: state.fetchedAt,
    payload: payload
  };

  return payload;
}

module.exports = {
  getTeamLogos: getTeamLogos
};
