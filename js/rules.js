// Pure rules: name parsing and category matching. No DOM, no network, no
// shared state - just functions of their inputs, so they're trivial to test
// and reuse from both the local validator and the Wikipedia fallback.
(function(){
  function parseName(full){
    const cleaned = full.trim().replace(/\s+/g, ' ');
    const parts = cleaned.split(' ');
    if(parts.length < 2) return null;
    const first = parts[0], last = parts[parts.length - 1];
    return {
      cleaned, first, last,
      firstInitial: first[0].toUpperCase(),
      lastInitial: last[0].toUpperCase(),
      isDouble: first[0].toUpperCase() === last[0].toUpperCase(),
    };
  }

  // Wikipedia bios and local database descriptions run 1-3 sentences long,
  // which floods the turn log faster than a table can read it. Cut to a
  // single short clause at a word boundary.
  function shortenText(text, maxLen = 55){
    if(!text) return '';
    const clean = text.trim();
    if(clean.length <= maxLen) return clean;
    const cut = clean.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '') + '…';
  }

  const CATEGORY_RULES = {
    "Any Famous Person": {positive:[], negative:[]},

    "Actors / Actresses": {
      positive:[" actor"," actress","film actor","television actor","voice actor","comedian","filmmaker"],
      negative:["football player","baseball player","basketball player","ice hockey player","racing driver","boxer","mixed martial artist","politician","singer","rapper"]
    },

    "Athletes": {
      positive:["athlete","football player","baseball player","basketball player","ice hockey player","soccer player","association football player","footballer","tennis player","golfer","boxer","fighter","racing driver","olympian","olympic","professional wrestler","gymnast","swimmer","runner","quarterback","pitcher","outfielder","infielder"],
      negative:[" actor"," actress","film actor","television actor","voice actor","filmmaker","singer","songwriter","rapper","musician","politician","writer","author"]
    },

    "Baseball": {
      positive:["baseball player","major league baseball","mlb","minor league baseball","negro league","pitcher","catcher","outfielder","infielder","first baseman","second baseman","third baseman","shortstop","designated hitter","baseball coach","baseball manager"],
      negative:["football player","basketball player","ice hockey player","soccer player","footballer","racing driver","actor","actress","singer","politician"]
    },

    "Football": {
      positive:["american football player","football player","national football league","nfl","college football","quarterback","running back","wide receiver","tight end","linebacker","cornerback","safety","defensive end","offensive tackle","offensive guard","placekicker","punter"],
      negative:["baseball player","basketball player","ice hockey player","soccer player","footballer","racing driver","actor","actress","singer","politician"]
    },

    "Basketball": {
      positive:["basketball player","national basketball association","nba","wnba","point guard","shooting guard","small forward","power forward","basketball coach"],
      negative:["baseball player","football player","ice hockey player","soccer player","footballer","racing driver","actor","actress","singer","politician"]
    },

    "Hockey": {
      positive:["ice hockey player","national hockey league","nhl","hockey player","goaltender","defenceman","defenseman","ice hockey coach"],
      negative:["baseball player","football player","basketball player","soccer player","footballer","racing driver","actor","actress","singer","politician"]
    },

    "Soccer": {
      positive:["association football player","footballer","soccer player","major league soccer","mls","premier league","la liga","serie a","bundesliga","ligue 1","fifa","uefa"],
      negative:["american football player","baseball player","basketball player","ice hockey player","racing driver","actor","actress","singer","politician"]
    },

    "Motorsports": {
      positive:["racing driver","racecar driver","race car driver","formula one","formula 1","f1 driver","nascar","indycar","indy car","motogp","world rally championship","wrc","endurance racing","le mans","stock car racing","open-wheel racing","drag racer"],
      negative:["baseball player","football player","basketball player","ice hockey player","soccer player","actor","actress","singer","politician"]
    },

    "Tennis": {
      positive:["tennis player","atp","wta","grand slam","davis cup","billie jean king cup"],
      negative:["baseball player","football player","basketball player","ice hockey player","racing driver","actor","actress","singer","politician"]
    },

    "Golf": {
      positive:["golfer","pga tour","lpga","masters tournament","u.s. open","open championship","ryder cup"],
      negative:["baseball player","football player","basketball player","ice hockey player","racing driver","actor","actress","singer","politician"]
    },

    "Combat Sports": {
      positive:["boxer","boxing","mixed martial artist","mma fighter","ufc","kickboxer","wrestler","professional wrestler","judoka","martial artist","brazilian jiu-jitsu"],
      negative:["baseball player","football player","basketball player","ice hockey player","racing driver","actor","actress","singer","politician"]
    },

    "Olympics / Track & Field": {
      positive:["olympian","olympic","track and field","sprinter","long-distance runner","middle-distance runner","hurdler","swimmer","gymnast","skier","figure skater","speed skater","javelin thrower","discus thrower","shot putter","pole vaulter"],
      negative:["actor","actress","singer","politician","writer","author"]
    },

    "Musicians": {
      positive:["musician","singer","songwriter","rapper","band","composer","guitarist","pianist","drummer","record producer"],
      negative:["football player","baseball player","basketball player","actor","actress","politician"]
    },

    "Fictional Characters": {
      positive:["fictional character","animated character","comic book character","video game character","television character","film character"],
      negative:["american actor","american actress","football player","baseball player","politician","singer"]
    },

    "Politicians / Historical Figures": {
      positive:["politician","president","prime minister","governor","senator","representative","king","queen","emperor","general","activist","leader","historical figure"],
      negative:["actor","actress","football player","baseball player","basketball player","singer","rapper"]
    },

    "Custom": {positive:[], negative:[]}
  };

  const CATEGORY_SEARCH_HINT = {
    "Baseball":"baseball player",
    "Football":"american football player",
    "Basketball":"basketball player",
    "Hockey":"ice hockey player",
    "Soccer":"soccer player",
    "Motorsports":"racing driver",
    "Tennis":"tennis player",
    "Golf":"golfer",
    "Combat Sports":"fighter",
    "Olympics / Track & Field":"olympian",
    "Athletes":"athlete",
    "Actors / Actresses":"actor",
    "Musicians":"musician",
    "Fictional Characters":"fictional character",
    "Politicians / Historical Figures":"politician"
  };

  function categorySearchText(obj){
    return [
      obj.title || '',
      obj.description || '',
      obj.extract || '',
      obj.categoriesText || ''
    ].join(' ').toLowerCase();
  }

  function categoryMatchesWikipedia(obj, category){
    const cat = category || 'Any Famous Person';
    if(cat === 'Any Famous Person') return {ok:true};

    const rules = CATEGORY_RULES[cat] || {positive:[], negative:[]};
    if(!rules.positive.length) return {ok:true};

    const text = ' ' + categorySearchText(obj).replace(/\s+/g, ' ') + ' ';

    const positiveHit = (rules.positive || []).find(rule => text.includes(rule.toLowerCase()));
    const negativeHit = (rules.negative || []).find(rule => text.includes(rule.toLowerCase()));

    if(positiveHit) return {ok:true, hit:positiveHit};
    if(negativeHit) return {ok:false, cat, reason:'negative match: ' + negativeHit};

    return {ok:false, cat};
  }

  // A record already stored in the local database was accepted into this
  // category by an earlier Wikipedia lookup (either shipped with the data or
  // learned during play) - no need to re-run keyword matching on it.
  function categoryMatchesLocalRecord(record, category){
    const cat = category || 'Any Famous Person';
    if(cat === 'Any Famous Person') return true;
    return (record.categories || []).includes(cat);
  }

  window.NameGame = window.NameGame || {};
  window.NameGame.Rules = {
    parseName,
    shortenText,
    CATEGORY_RULES,
    CATEGORY_SEARCH_HINT,
    categoryMatchesWikipedia,
    categoryMatchesLocalRecord,
  };
})();
