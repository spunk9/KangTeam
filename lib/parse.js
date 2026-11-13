'use strict';

var util = require('./util');
var teamsData = require('./teams');

var CANONICAL_NAMES = {
  'lfc': 'Liverpool',
  'm u': 'Manchester United',
  'manchester utd': 'Manchester United',
  'man utd': 'Manchester United',
  'man united': 'Manchester United',
  'man city': 'Manchester City',
  'psg': 'Paris Saint-Germain',
  'paris sg': 'Paris Saint-Germain',
  'juv': 'Juventus',
  'juve': 'Juventus',
  'barca': 'Barcelona',
  'fc barcelona': 'Barcelona',
  'atleti': 'Atlético de Madrid',
  'atletico': 'Atlético de Madrid',
  'atletico madrid': 'Atlético de Madrid',
  'inter': 'Inter de Milán',
  'inter milan': 'Inter de Milán',
  'internazionale': 'Inter de Milán',
  'milan': 'AC Milan',
  'ac milan': 'AC Milan',
  'bayern': 'Bayern Múnich',
  'bayern munich': 'Bayern Múnich',
  'dortmund': 'Borussia Dortmund',
  'monchengladbach': 'Borussia Mönchengladbach',
  'wolves': 'Wolverhampton',
  'spurs': 'Tottenham Hotspur',
  'newcastle': 'Newcastle United',
  'betis': 'Real Betis',
  'celta': 'Celta de Vigo',
  'sporting': 'Sporting CP',
  'porto': 'FC Porto',
  'benfica': 'Benfica',
  'psv': 'PSV Eindhoven',
  'ajax': 'Ajax',
  'feyenoord': 'Feyenoord',
  'vasco': 'Vasco da Gama',
  'chivas': 'Chivas de Guadalajara',
  'america': 'América',
  'tigres': 'Tigres UANL',
  'pumas': 'Pumas UNAM',
  'boca': 'Boca Juniors',
  'newells': 'Newell\'s Old Boys',
  'estudiantes': 'Estudiantes de La Plata',
  'lafc': 'Los Angeles FC',
  'nycfc': 'New York City FC',
  'san diego': 'San Diego FC',
  'olympique marseille': 'Olympique de Marsella',
  'marseille': 'Olympique de Marsella',
  'lyon': 'Olympique de Lyon',
  'monaco': 'Mónaco',
  'saint etienne': 'Saint-Étienne',
  'celtic': 'Celtic',
  'rangers': 'Rangers',
  'neymar': 'Neymar Jr',
  'f1': 'F1'
};

var COLORS = [
  'red', 'blue', 'white', 'black', 'green', 'pink', 'grey', 'gray', 'navy', 'cyan',
  'yellow', 'orange', 'purple', 'gold', 'silver', 'brown', 'beige', 'maroon',
  'burgundy', 'fluorescent', 'royal', 'light', 'dark', 'off-white', 'lake', 'neon',
  'sky', 'cream', 'teal', 'violet', 'orange', 'multi', 'tie-dye'
];

var STOP_WORDS = [
  'jersey', 'shirt', 'kit', 'home', 'away', 'third', 'fourth', 'goalkeeper',
  'training', 'tracksuit', 'windbreaker', 'jacket', 'hoodie', 'polo', 'shorts',
  'suit', 'set', 'player', 'long', 'sleeve', 'special', 'edition', 'retro',
  'anniversary', 'men', 'mens', 'women', 'womens', 'kids', 'kid', 'size',
  'two-stars', 'two', 'stars', 'full', 'zipper', 'zip', 'hooded', 'softshell',
  'originals', 't-shirt', 'tee', 'shorts', 'socks', 'pants', 'trousers',
  's-4xl', 's-xxl', 's-3xl', 's-5xl', 's-2xl', 's-xl', 's-l', 's-m'
];

var NORMALIZED_LEAGUE_LABELS = teamsData.LEAGUE_LABELS;

function canonicalName(name) {
  var key = util.teamKey(name);
  return CANONICAL_NAMES[key] || name;
}

function buildResolver(sidebarTeams) {
  var entries = [];
  var byKey = {};
  var infoByTeam = {};

  function add(name, league, aliases) {
    name = canonicalName(String(name || '').trim());
    if (!name) return;
    var key = util.teamKey(name);
    if (!key) return;

    if (byKey[key]) {
      // Completamos liga/alias si faltaban.
      var existing = byKey[key];
      if (!existing.league && league) existing.league = league;
      (aliases || []).forEach(function (a) {
        var norm = util.normalizeText(a);
        if (norm && existing.aliasSet[norm] !== true) {
          existing.aliasSet[norm] = true;
          existing.aliases.push(norm);
        }
      });
      return;
    }

    var aliasSet = {};
    var allAliases = [name].concat(aliases || []);
    allAliases.forEach(function (a) {
      var norm = util.normalizeText(a);
      if (norm) aliasSet[norm] = true;
    });
    var entry = {
      name: name,
      league: league || 'Otras ligas',
      aliases: Object.keys(aliasSet),
      aliasSet: aliasSet
    };
    byKey[key] = entry;
    entries.push(entry);
    infoByTeam[name] = { name: name, league: entry.league };
  }

  // 1) Clubes curados (mejor liga y alias).
  teamsData.EXTRA_CLUBS.forEach(function (row) {
    add(row[0], row[1], row.slice(2));
  });

  // 2) Selecciones (nombre visible en español).
  teamsData.NATIONS.forEach(function (row) {
    var extra = teamsData.NATION_ALIASES[row[0]] || [];
    add(row[1], 'Selecciones', [row[0]].concat(row.slice(2)).concat(extra));
  });

  // 3) Equipos del menú de Yupoo que no estuvieran ya.
  (sidebarTeams || []).forEach(function (row) {
    var league = NORMALIZED_LEAGUE_LABELS[row.league] || row.league || 'Otras ligas';
    if (league === 'Menu' || league === 'Menu 2') return;
    add(row.name, league, []);
  });

  var index = [];
  entries.forEach(function (e) {
    e.aliases.forEach(function (alias) {
      index.push({
        alias: alias,
        words: alias.split(' ').length,
        team: e.name,
        league: e.league,
        important: alias.split(' ').length >= 2 || (teamsData.NATIONS.some(function (n) {
          return util.normalizeText(n[0]) === alias || util.normalizeText(n[1]) === alias;
        }))
      });
    });
  });
  index.sort(function (a, b) {
    return (b.words - a.words) || (b.alias.length - a.alias.length);
  });

  var teamNames = Object.keys(infoByTeam).sort(function (a, b) {
    return a.localeCompare(b, 'es');
  });

  return {
    teamNames: teamNames,
    teamInfo: infoByTeam,
    resolve: function (title) { return resolveTeam(title, index, infoByTeam); }
  };
}

function stripLeadingNoise(input) {
  var work = separateGluedTokens(input).trim();
  var noise = [
    /^(retro|vintage|classic|new|official|ready|stock|in stock|limited|special|hot|top quality|best quality|1:1|fan version|player version)\b[\s:,\-–—|]*/i,
    /^(players?)(?:\s+version)?\b[\s:,\-–—|]*/i,
    /^(kids?|children|junior|youth|boys?|girls?)\b[\s:,\-–—|]*/i,
    /^(women'?s?|men'?s?|ladies)\b[\s:,\-–—|]*/i,
    /^(long[ -]?sleeved?|short[ -]?sleeved?)\b[\s:,\-–—|]*/i,
    /^\d+[\.\)]?\s+/,
    /^\d+(?=[A-Za-zÀ-ÿ])/,
    /^(?:19|20)\d{2}\b[\s:,\-–—|]*/,
    /^\d{2}\s*\/\s*\d{2}\b[\s:,\-–—|]*/
  ];
  for (var pass = 0; pass < 8; pass++) {
    var before = work;
    for (var i = 0; i < noise.length; i++) work = work.replace(noise[i], '');
    work = work.replace(/^[\s:,\-–—|•·]+/, '');
    if (work === before) break;
  }
  return work;
}

function titleCase(input) {
  return String(input || '').split(/\s+/).map(function (word) {
    if (!word) return '';
    if (word.length <= 4 && word === word.toUpperCase()) return word;
    if (/^[A-Z][a-z]/.test(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

function fallbackTeamName(title) {
  var work = stripLeadingNoise(title)
    .replace(/\b(?:S|M|L|XL|XXL|2XL|3XL|4XL|5XL)\s*[-–]\s*(?:S|M|L|XL|XXL|2XL|3XL|4XL|5XL)\b/ig, ' ')
    .replace(/\bsize\s*:?\s*\d{2}\s*[-–]\s*\d{2}\b/ig, ' ')
    .replace(/#\s*\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  var words = work.split(' ');
  var picked = [];
  for (var i = 0; i < words.length && picked.length < 4; i++) {
    var raw = words[i].replace(/^[^A-Za-z0-9À-ÿ]+|[^A-Za-z0-9À-ÿ]+$/g, '');
    if (!raw) continue;
    var norm = util.normalizeText(raw);
    if (!norm) continue;
    if (STOP_WORDS.indexOf(norm) !== -1) break;
    if (COLORS.indexOf(norm) !== -1 && picked.length === 0) return 'Otros';
    if (/^\d+$/.test(norm)) break;
    picked.push(raw);
  }

  if (!picked.length) return 'Otros';
  var name = titleCase(picked.join(' '));
  if (util.teamKey(name).length < 2) return 'Otros';
  return name;
}

function resolveTeam(title, index, infoByTeam) {
  var work = stripLeadingNoise(title);
  var norm = util.normalizeText(work);

  for (var i = 0; i < index.length; i++) {
    var item = index[i];
    if (norm === item.alias || norm.indexOf(item.alias + ' ') === 0) {
      return { team: item.team, league: item.league };
    }
  }

  // Segunda pasada: equipos con nombre compuesto que aparecen tras un color o
  // una colaboración (p. ej. "White Real Madrid ...").
  var firstWords = norm.split(' ').slice(0, 10).join(' ');
  for (var j = 0; j < index.length; j++) {
    var candidate = index[j];
    if (!candidate.important) continue;
    if ((' ' + firstWords + ' ').indexOf(' ' + candidate.alias + ' ') !== -1) {
      return { team: candidate.team, league: candidate.league };
    }
  }

  var name = fallbackTeamName(title);
  var info = infoByTeam[name];
  return { team: name, league: info ? info.league : 'Otras ligas' };
}

/** Separa temporadas y tallas que vienen pegadas al nombre ("Barcelona12/13"). */
function separateGluedTokens(title) {
  return util.cleanText(title)
    .replace(/([A-Za-zÀ-ÿ])(\d{2})\s*\/\s*(\d{2})/g, '$1 $2/$3')
    .replace(/(\d{2})\s*\/\s*(\d{2})([A-Za-zÀ-ÿ])/g, '$1/$2 $3')
    .replace(/([A-Za-zÀ-ÿ])((?:19|20)\d{2})(?=\s|$)/g, '$1 $2');
}

function parseSeason(title) {
  var text = separateGluedTokens(title);
  var m = text.match(/(?:^|\s)(\d{2})\s*\/\s*(\d{2})(?=\s|$)/);
  if (m) {
    var a = parseInt(m[1], 10);
    var start = a <= 40 ? 2000 + a : 1900 + a;
    return { label: pad2(m[1]) + '/' + pad2(m[2]), sort: start, retro: false };
  }
  m = text.match(/(?:^|\s)((?:19|20)\d{2})\s*[\/\-–]\s*((?:19|20)\d{2})/);
  if (m) {
    return { label: m[1].slice(2) + '/' + m[2].slice(2), sort: parseInt(m[1], 10), retro: false };
  }
  m = text.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  if (m) {
    return { label: m[1], sort: parseInt(m[1], 10), retro: false };
  }
  return { label: 'Sin temporada', sort: 0, retro: false };
}

/** Agrupa las temporadas para que el filtro sea usable (174 → ~11 grupos). */
function seasonGroup(label, sort) {
  if (!sort) return 'Sin temporada';
  if (sort >= 2020) {
    var start = sort;
    return pad2(String(start).slice(2)) + '/' + pad2(String(start + 1).slice(2));
  }
  if (sort >= 2016) return '2016-2019';
  if (sort >= 2010) return '2010-2015';
  return 'Retro';
}

function pad2(value) {
  var str = String(value);
  return str.length < 2 ? '0' + str : str;
}

function parseType(title, seasonSort) {
  var t = ' ' + util.normalizeText(title) + ' ';
  if (/\b(training suit|tracksuit|track suit|suit set)\b/.test(t)) return 'training';
  if (/\b(windbreaker|jacket|softshell|parka|anorak)\b/.test(t)) return 'jacket';
  if (/\b(hoodie|hooded|sweatshirt|crewneck)\b/.test(t)) return 'hoodie';
  if (/\bpolo\b/.test(t)) return 'polo';
  if (/\b(shorts|pants|trousers)\b/.test(t)) return 'shorts';
  if (/\b(t-shirt|tee)\b/.test(t)) return 'casual';
  if (/\b(jerseys?|jeresy|ersey|shirts?|kits?)\b/.test(t)) return 'jersey';
  // La mayoría de referencias con temporada son camisetas aunque el título
  // omita la palabra "Jersey" ("Retro Roma 91/92 Third Away").
  if (seasonSort > 0) return 'jersey';
  return 'other';
}

function parseFlags(title, seasonSort) {
  var t = ' ' + util.normalizeText(title) + ' ';
  var flags = [];
  if (/\b(retro|vintage)\b/.test(t) || (seasonSort && seasonSort <= 2015)) flags.push('retro');
  if (/\b(kids?|junior|youth|boys?|girls?|nino|nina)\b/.test(t)) flags.push('kids');
  if (/\b(women|woman|ladies|female)\b/.test(t)) flags.push('women');
  if (/\blong[ -]?sleeve/.test(t)) flags.push('long');
  if (/\b(player version|player issue)\b/.test(t)) flags.push('player');
  if (/\b(goalkeeper|gk)\b/.test(t)) flags.push('gk');
  if (/\b(special edition|anniversary|limited)\b/.test(t)) flags.push('special');
  return flags;
}

function normalizeSizeLabel(value) {
  var v = String(value).toUpperCase().replace(/\s+/g, '');
  if (v === 'XXL') return '2XL';
  if (v === 'XXXL') return '3XL';
  return v;
}

function parseSizeRange(title) {
  var text = util.cleanText(title);
  var m = text.match(/size\s*:?\s*(\d{2})\s*[-–]\s*(\d{2})/i);
  if (m) return m[1] + '-' + m[2];
  m = text.match(/\b(S|M|L|XL|XXL|2XL|3XL|4XL|5XL)\s*[-–]\s*(S|M|L|XL|XXL|2XL|3XL|4XL|5XL)\b/i);
  if (m) {
    var from = normalizeSizeLabel(m[1]);
    var to = normalizeSizeLabel(m[2]);
    return from + '-' + to;
  }
  return 'S-2XL';
}

function parseItem(raw, resolver) {
  var title = separateGluedTokens(raw.title);
  var season = parseSeason(title);
  var type = parseType(title, season.sort);
  var flags = parseFlags(title, season.sort);
  var team = resolver.resolve(title);
  var cover = String(raw.cover || '');
  var pathMatch = cover.match(/photo\.yupoo\.com(\/[^/]+\/[^/]+)\//);
  var coverPath = pathMatch ? pathMatch[1] : '';

  return {
    id: String(raw.id),
    title: title,
    team: team.team,
    league: team.league,
    season: season.label,
    seasonSort: season.sort,
    seasonGroup: seasonGroup(season.label, season.sort),
    type: type,
    custom: type === 'jersey',
    flags: flags,
    sizeRange: parseSizeRange(title),
    cover: coverPath,
    photos: raw.photos || 1
  };
}

module.exports = {
  buildResolver: buildResolver,
  parseItem: parseItem,
  parseSeason: parseSeason,
  seasonGroup: seasonGroup,
  parseType: parseType,
  parseSizeRange: parseSizeRange,
  fallbackTeamName: fallbackTeamName,
  stripLeadingNoise: stripLeadingNoise,
  separateGluedTokens: separateGluedTokens
};
