// AI Engine 2.0
(function(){
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const RARE_LAST_LETTERS = new Set(["Q","X","Z","J","U","V","K","Y"]);
  // Chance of drawing from the "known/famous" tier first, by difficulty.
  const TIER_BIAS = {Easy:0.85, Medium:0.5, Hard:0.25, Expert:0.05};

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
      this.famousSet = new Set();
      this.ready = false;
    },

    async prepare({category="Any Famous Person", difficulty="Medium", knownNames=[]} = {}){
      this.reset();
      this.category = category;
      this.difficulty = difficulty;
      this.famousSet = new Set((knownNames || []).map(n => slug(cleanDisplayName(n))));

      if(!window.NameDatabase){
        console.warn("AIEngine.prepare: NameDatabase is missing.");
        return false;
      }

      try{
        if(category && category !== "Any Famous Person") await NameDatabase.loadCategory(category);
        else await NameDatabase.loadAll();
      }catch(e){
        console.warn("AIEngine.prepare: database load failed.", e);
      }

      let pool = [];
      if(category && category !== "Any Famous Person") pool = [...(NameDatabase.byCategory?.get(category) || [])];
      else pool = [...(NameDatabase.people || [])];

      if(!pool.length){
        console.warn("AIEngine.prepare: no database records found for category:", category);
        return false;
      }

      const seen = new Set();
      const cleanPool = [];

      for(const p of pool){
        const display = cleanDisplayName(p.name);
        if(!display) continue;
        const parsed = window.parseName ? window.parseName(display) : null;
        if(!parsed) continue;

        const id = playerId({...p, name:display});
        if(seen.has(id)) continue;
        seen.add(id);

        cleanPool.push({
          ...p,
          id,
          name: display,
          letters: {
            first: (p.letters?.first || parsed.firstInitial || display[0] || "").toUpperCase(),
            last: lastLetter({...p, name: display})
          }
        });
      }

      this.sourceCount = cleanPool.length;

      for(const letter of LETTERS){
        const letterPool = cleanPool.filter(p => firstLetter(p) === letter);
        const known = letterPool.filter(p => this.famousSet.has(slug(p.name)));
        const other = letterPool.filter(p => !this.famousSet.has(slug(p.name)));
        this.buckets[letter] = {known: shuffle(known), other: shuffle(other)};
        this.remaining[letter] = {known: [...this.buckets[letter].known], other: [...this.buckets[letter].other]};
      }

      this.ready = cleanPool.length > 0;
      console.log("AIEngine ready:", this.stats());
      return this.ready;
    },

    markUsedName(name){
      if(!name) return;
      const clean = cleanDisplayName(name);
      const dbMatch = window.NameDatabase?.byName?.get?.(slug(clean));
      const id = dbMatch ? playerId(dbMatch) : slug(clean);
      this.usedIds.add(id);
    },

    markUsedPerson(person){
      if(!person) return;
      this.usedIds.add(playerId(person));
    },

    // Pops a usable candidate from a tier array, discarding already-used entries along the way.
    // When preferRare is true, prefers a candidate whose last letter is uncommon (harder to follow).
    _pickFromTier(arr, usedNamesSet, preferRare){
      while(arr.length){
        let idx = arr.length - 1;
        if(preferRare){
          const rareIdx = arr.findIndex(p => RARE_LAST_LETTERS.has(lastLetter(p)));
          if(rareIdx >= 0 && Math.random() < 0.6) idx = rareIdx;
        }
        const picked = arr.splice(idx, 1)[0];
        const id = playerId(picked);
        if(this.usedIds.has(id)) continue;
        if(usedNamesSet && usedNamesSet.has(slug(picked.name))) continue;
        return picked;
      }
      return null;
    },

    nextMove({requiredLetter=null, usedNamesSet=null, difficulty=null} = {}){
      if(!this.ready) return null;

      const letter = requiredLetter ? String(requiredLetter).toUpperCase() : null;
      const lettersToTry = letter ? [letter] : shuffle(LETTERS);
      const diff = difficulty || this.difficulty || "Medium";
      const preferDouble = diff === "Expert" || (diff === "Hard" && Math.random() < 0.35);
      const preferRare = diff === "Hard" || diff === "Expert";
      const tierBias = TIER_BIAS[diff] ?? 0.5;

      for(const l of lettersToTry){
        const tiers = this.remaining[l];
        if(!tiers) continue;
        const tierOrder = Math.random() < tierBias ? ["known", "other"] : ["other", "known"];

        if(preferDouble){
          let picked = null;
          for(const t of tierOrder){
            const arr = tiers[t];
            const idx = arr.findIndex(p => {
              const id = playerId(p);
              if(this.usedIds.has(id)) return false;
              if(usedNamesSet && usedNamesSet.has(slug(p.name))) return false;
              return firstLetter(p) === lastLetter(p);
            });
            if(idx >= 0){ picked = arr.splice(idx, 1)[0]; break; }
          }
          if(picked){
            this.markUsedPerson(picked);
            return picked;
          }
        }

        for(const t of tierOrder){
          const picked = this._pickFromTier(tiers[t], usedNamesSet, preferRare);
          if(picked){
            this.markUsedPerson(picked);
            return picked;
          }
        }
      }

      return null;
    },

    stats(){
      const bucketCounts = {};
      for(const l of LETTERS) bucketCounts[l] = (this.remaining[l]?.known.length || 0) + (this.remaining[l]?.other.length || 0);
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

  window.AIEngine = Engine;
})();
