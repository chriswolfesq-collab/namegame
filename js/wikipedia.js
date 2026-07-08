// Wikipedia is the FALLBACK path only - the local-first validator (validator.js)
// only reaches here for a name that isn't already in the local database. That
// keeps this the rare path instead of the hot path, which is what actually
// fixes the rate-limit problems this game used to hit on every single turn.
(function(){
  const Rules = window.NameGame.Rules;

  let wikipediaRateLimited = false;

  // All outgoing Wikipedia requests funnel through here so a burst (e.g. an AI
  // retrying several picks in a row) can't fire faster than MIN_SPACING_MS
  // apart, and any 429 backs the whole queue off exponentially instead of every
  // caller hammering the API again immediately.
  const MIN_SPACING_MS = 250;
  let queueTail = Promise.resolve();
  let lastRequestAt = 0;
  let backoffMs = 0;

  function gatedFetch(url, options){
    const run = async () => {
      const wait = Math.max(0, MIN_SPACING_MS - (Date.now() - lastRequestAt)) + backoffMs;
      if(wait > 0) await new Promise(r => setTimeout(r, wait));
      lastRequestAt = Date.now();
      const res = await fetch(url, options);
      if(res.status === 429 || res.status >= 500){
        backoffMs = Math.min(8000, (backoffMs || 500) * 2);
      }else if(res.ok){
        backoffMs = 0;
      }
      return res;
    };
    const result = queueTail.then(run, run);
    queueTail = result.catch(() => {});
    return result;
  }

  // Wikipedia occasionally answers with 429 (rate limit) or a 5xx blip. Those are not
  // "this name doesn't exist" - retrying once after a short delay clears almost all of
  // them. wikipediaRateLimited stays true for this validation call if it never recovers,
  // so the caller can show an honest "service unavailable" message instead of "invalid".
  async function fetchWithRetry(url, options){
    let res = await gatedFetch(url, options);
    if(res.status === 429 || res.status >= 500){
      await new Promise(r => setTimeout(r, 1200));
      res = await gatedFetch(url, options);
    }
    if(res.status === 429 || res.status >= 500) wikipediaRateLimited = true;
    return res;
  }

  function baseTitle(title){
    return (title || '').replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
  }

  async function fetchWikiCategories(title){
    try{
      const url = 'https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&prop=categories&cllimit=50&titles=' + encodeURIComponent(title);
      const res = await fetchWithRetry(url);
      if(!res.ok) return '';
      const data = await res.json();
      const pages = data && data.query && data.query.pages ? Object.values(data.query.pages) : [];
      const cats = (pages[0] && pages[0].categories) ? pages[0].categories.map(c => c.title.replace('Category:', '')) : [];
      return cats.join(' ');
    }catch(e){
      return '';
    }
  }

  async function searchWikipedia(query){
    try{
      // categories requested in the same call as the search results, instead of a
      // separate follow-up fetch per candidate - halves the request count for any
      // name that needs the search fallback.
      const url = 'https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&generator=search&gsrsearch=' + encodeURIComponent(query) + '&gsrlimit=8&prop=pageprops|description|info|categories&cllimit=50&inprop=url';
      const res = await fetchWithRetry(url);
      if(!res.ok) return [];
      const data = await res.json();
      const pages = data && data.query && data.query.pages ? Object.values(data.query.pages) : [];
      // Disambiguation pages ("Walter Anderson") are never a valid answer on their own -
      // the real person is one of the pages the disambiguation page links to.
      return pages.filter(p => !(p.pageprops && 'disambiguation' in p.pageprops)).map(p => {
        p.categoriesText = (p.categories || []).map(c => c.title.replace('Category:', '')).join(' ');
        return p;
      });
    }catch(e){
      return [];
    }
  }

  // Common names (especially in large scraped sports rosters) frequently collide with
  // unrelated, more prominent Wikipedia articles of the same name. A plain name search
  // often won't even surface the right person in the first several results, so when a
  // specific category is active we search with a category hint first (mirrors how a
  // human would disambiguate, e.g. "walter anderson baseball"), then fall back to a
  // plain name search.
  async function findWikipediaMatch(name, categoryHint){
    const nameLower = name.toLowerCase();

    if(categoryHint){
      const hinted = await searchWikipedia(name + ' ' + categoryHint);
      const exactHinted = hinted.find(p => baseTitle(p.title) === nameLower);
      if(exactHinted) return exactHinted;
    }

    const plain = await searchWikipedia(name);
    const exactPlain = plain.find(p => baseTitle(p.title) === nameLower);
    if(exactPlain) return exactPlain;

    if(categoryHint){
      const hinted = await searchWikipedia(name + ' ' + categoryHint);
      if(hinted[0]) return hinted[0];
    }

    return plain[0] || null;
  }

  // Looks a name up live on Wikipedia and returns the same shape the local
  // validator uses: {valid, title, description, photo, categoriesText, url}
  // or {valid:false, reason, serviceError?}.
  async function lookup(name, category){
    wikipediaRateLimited = false;
    const categoryHint = category === 'Any Famous Person' ? '' : (Rules.CATEGORY_SEARCH_HINT[category] || '');

    try{
      const summaryUrl = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(name);
      const res = await fetchWithRetry(summaryUrl, {headers:{'Accept':'application/json'}});
      if(res.ok){
        const data = await res.json();
        if(data && data.title && data.type !== 'disambiguation'){
          data.categoriesText = await fetchWikiCategories(data.title);
          const match = Rules.categoryMatchesWikipedia(data, category);
          if(match.ok){
            const detail = (data.description || data.extract || 'Wikipedia page found.');
            return {
              valid: true, title: data.title, description: detail,
              photo: data.thumbnail && data.thumbnail.source ? data.thumbnail.source : '',
              categoriesText: data.categoriesText || '',
              url: data.content_urls && data.content_urls.desktop ? data.content_urls.desktop.page : ''
            };
          }
          // Direct hit exists but doesn't match the category - for categorized games,
          // a same-named category-specific person may still exist under a disambiguated
          // title (e.g. "Walter Anderson (baseball)"), so keep looking before failing.
          if(!categoryHint){
            return {valid:false, reason:'Wrong category', title:data.title, matchCat:match.cat};
          }
        }
      }

      const best = await findWikipediaMatch(name, categoryHint);
      if(best && best.title){
        const match = Rules.categoryMatchesWikipedia(best, category);
        if(!match.ok){
          return {valid:false, reason:'Wrong category', title:best.title, matchCat:match.cat};
        }
        return {
          valid: true, title: best.title, description: best.description || '',
          photo: '', categoriesText: best.categoriesText || '', url: best.fullurl || ''
        };
      }

      if(wikipediaRateLimited){
        return {valid:false, reason:'Wikipedia rate-limited', serviceError:true};
      }
      return {valid:false, reason:'No Wikipedia match found'};
    }catch(e){
      return {valid:false, reason:'Wikipedia request failed', serviceError:true};
    }
  }

  window.NameGame.Wikipedia = {lookup};
})();
