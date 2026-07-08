// AI opponent engine. Ranks every candidate name by its real fame score
// (Wikipedia pageviews, stamped onto each record at data-build time by
// scripts/fetch_fame_scores.py) instead of matching against hand-maintained
// "famous name" lists - one number per person replaces what used to be three
// separate curated lists (aiNames / LOCAL_AI_TAGS / famous.js) that always
// lagged behind whatever category or letter was actually in play.
(function(){
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const RARE_LAST_LETTERS = new Set(["Q","X","Z","J","U","V","K","Y"]);

  // How deep into the fame-sorted pool each difficulty is willing to reach for
  // a required letter. Easy stays near the top (recognizable names only);
  // Expert will happily reach for someone nobody's heard of.
  const DIFFICULTY_FRACTION = {Easy:0.12, Medium:0.40, Hard:0.75, Expert:1.0};

  function normalizeName(name){
    return String(name || "").trim().replace(/\s+/g, " ");
  }

  function cleanDisplayName(name){
    return normalizeName(name).replace(/\s+\([^)]*\)\s*$/g, "").trim();
  }

  function slug(value){
    return normalizeName(value).toLowerCase();
  }

  function shuffle(list){
    const arr = [...(list || [])];
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function playerId(person){
    return person?.id || slug(cleanDisplayName(person?.name || ""));
  }

  function firstLetter(person){
    return (person?.letters?.first || person?.name?.[0] || "").toUpperCase();
  }

  function lastLetter(person){
    const explicit = person?.letters?.last;
    if(explicit && /^[A-Z]$/i.test(explicit)) return explicit.toUpperCase();
    const clean = cleanDisplayName(person?.name || "");
    const parts = clean.split(" ").filter(Boolean);
    return (parts.at(-1)?.[0] || "").toUpperCase();
  }

  function isUsable(person, usedIds, usedNamesSet){
    if(usedIds.has(playerId(person))) return false;
    if(usedNamesSet && usedNamesSet.has(slug(person.name))) return false;
    return true;
  }

  const Engine = {
    category: null,
    difficulty: "Medium",
    sourceCount: 0,
    buckets: {},
    remaining: {},
    usedIds: new Set(),
    ready: false,

    reset(){
      this.category = null;
      this.difficulty = "Medium";
      this.sourceCount = 0;
      this.buckets = {};
      this.remaining = {};
      this.usedIds = new Set();
      this.ready = false;
    },

    async prepare({category="Any Famous Person", difficulty="Medium"} = {}){
      this.reset();
      this.category = category;
      this.difficulty = difficulty;

      const Database = window.NameGame?.Database;
      if(!Database){
        console.warn("AIEngine.prepare: Database is missing.");
        return false;
      }

      try{
        if(category && category !== "Any Famous Person") await Database.loadCategory(category);
        else await Database.loadAll();
      }catch(e){
        console.warn("AIEngine.prepare: database load failed.", e);
      }

      let pool = [];
      if(category && category !== "Any Famous Person") pool = [...(Database.byCategory?.get(category) || [])];
      else pool = [...(Database.people || [])];

      if(!pool.length){
        console.warn("AIEngine.prepare: no database records found for category:", category);
        return false;
      }

      const seen = new Set();
      const cleanPool = [];

      for(const p of pool){
        const display = cleanDisplayName(p.name);
        if(!display) continue;
        const parsed = window.NameGame?.Rules?.parseName?.(display) || null;
        if(!parsed) continue;

        const id = playerId({...p, name:display});
        if(seen.has(id)) continue;
        seen.add(id);

        cleanPool.push({
          ...p,
          id,
          name: display,
          fame: Number.isFinite(p.fame) ? p.fame : 0,
          letters: {
            first: (p.letters?.first || parsed.firstInitial || display[0] || "").toUpperCase(),
            last: lastLetter({...p, name: display})
          }
        });
      }

      this.sourceCount = cleanPool.length;

      // Shuffle first so identically-scored (usually fame:0) entries don't
      // always come out in the same dataset order, then sort by fame
      // descending - a stable sort preserves that shuffle as the tiebreak.
      for(const letter of LETTERS){
        const letterPool = shuffle(cleanPool.filter(p => firstLetter(p) === letter));
        letterPool.sort((a, b) => b.fame - a.fame);
        this.buckets[letter] = letterPool;
        this.remaining[letter] = [...letterPool];
      }

      this.ready = cleanPool.length > 0;
      console.log("AIEngine ready:", this.stats());
      return this.ready;
    },

    markUsedName(name){
      if(!name) return;
      const clean = cleanDisplayName(name);
      const dbMatch = window.NameGame?.Database?.byName?.get?.(slug(clean));
      const id = dbMatch ? playerId(dbMatch) : slug(clean);
      this.usedIds.add(id);
    },

    markUsedPerson(person){
      if(!person) return;
      this.usedIds.add(playerId(person));
    },

    nextMove({requiredLetter=null, usedNamesSet=null, difficulty=null} = {}){
      if(!this.ready) return null;

      const letter = requiredLetter ? String(requiredLetter).toUpperCase() : null;
      const lettersToTry = letter ? [letter] : shuffle(LETTERS);
      const diff = difficulty || this.difficulty || "Medium";
      const preferDouble = diff === "Expert" || (diff === "Hard" && Math.random() < 0.35);
      const preferRare = diff === "Hard" || diff === "Expert";
      const fraction = DIFFICULTY_FRACTION[diff] ?? 0.4;

      for(const l of lettersToTry){
        const arr = this.remaining[l];
        if(!arr) continue;

        // Drop stale used entries as we encounter them so arr.length (and the
        // eligible-fraction cutoff computed from it) stays accurate over a
        // long game instead of counting names that can never be picked again.
        let i = 0;
        while(i < arr.length){
          if(!isUsable(arr[i], this.usedIds, usedNamesSet)){ arr.splice(i, 1); continue; }
          i++;
        }
        if(!arr.length) continue;

        const eligibleCount = Math.max(1, Math.ceil(arr.length * fraction));

        if(preferDouble){
          const idx = arr.slice(0, eligibleCount).findIndex(p => firstLetter(p) === lastLetter(p));
          if(idx >= 0){
            const [picked] = arr.splice(idx, 1);
            this.markUsedPerson(picked);
            return picked;
          }
        }

        if(preferRare && Math.random() < 0.6){
          const idx = arr.slice(0, eligibleCount).findIndex(p => RARE_LAST_LETTERS.has(lastLetter(p)));
          if(idx >= 0){
            const [picked] = arr.splice(idx, 1);
            this.markUsedPerson(picked);
            return picked;
          }
        }

        const idx = Math.floor(Math.random() * eligibleCount);
        const [picked] = arr.splice(idx, 1);
        this.markUsedPerson(picked);
        return picked;
      }

      return null;
    },

    stats(){
      const bucketCounts = {};
      for(const l of LETTERS) bucketCounts[l] = this.remaining[l]?.length || 0;
      return {
        ready:this.ready,
        category:this.category,
        sourceCount:this.sourceCount,
        used:this.usedIds.size,
        remaining:Object.values(bucketCounts).reduce((a,b)=>a+b,0),
        buckets:bucketCounts
      };
    }
  };

  window.NameGame = window.NameGame || {};
  window.NameGame.AI = Engine;
  window.AIEngine = Engine;
})();
