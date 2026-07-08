// The single entry point for "is this name valid for this category". Checks
// the local database FIRST - instant, offline, no rate limits, and covers the
// vast majority of turns since the game ships 24,000+ names locally. Only a
// name that truly isn't in the local database ever touches the network.
(function(){
  const Database = window.NameGame.Database;
  const Wikipedia = window.NameGame.Wikipedia;
  const Rules = window.NameGame.Rules;

  function fromLocalRecord(record){
    return {
      valid: true,
      title: record.name,
      description: record.description || 'Verified in local database.',
      photo: record.image || '',
      categoriesText: (record.categories || []).join(' '),
      url: record.wiki || '',
      local: true,
    };
  }

  // name: the raw submitted string. category: the active game category.
  // skipNetwork: true when Auto Validate is off (players decide manually).
  async function validateName(name, category, {skipNetwork = false} = {}){
    const local = Database.lookupByName(name);
    if(local && Rules.categoryMatchesLocalRecord(local, category)){
      return fromLocalRecord(local);
    }

    if(skipNetwork){
      return {valid:true, skipped:true};
    }

    // Either not in the local database at all, or it's there but tagged for a
    // different category (e.g. a same-named person in a different sport) -
    // either way a live Wikipedia lookup is the only way to resolve it.
    const result = await Wikipedia.lookup(name, category);
    if(result.valid){
      Database.cacheWiki(name, result);
      Database.learnFromWikipedia(name, result, category);
    }
    return result;
  }

  window.NameGame.Validator = {validateName};
})();
