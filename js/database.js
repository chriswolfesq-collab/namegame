(function(){
  const DEFAULT_OPTIONS = {
    manifestPath: "data/manifest.json",
    cacheKey: "nameGameWikiCache",
    learnedKey: "nameGameLearnedPeople"
  };

  const normalizeName = (name) => String(name || "").trim().replace(/\s+/g, " ");
  const slug = (value) => normalizeName(value).toLowerCase();

  function makeId(name){
    return slug(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function lettersForName(name){
    const clean = normalizeName(name);
    const parts = clean.split(" ").filter(Boolean);
    return {
      first: parts[0]?.[0]?.toUpperCase() || "",
      last: parts.at(-1)?.[0]?.toUpperCase() || ""
    };
  }

  function toRecord(entry, source = "manual"){
    if (typeof entry === "string") {
      const name = normalizeName(entry);
      return {
        id: makeId(name),
        name,
        aliases: [],
        categories: ["Any Famous Person"],
        letters: lettersForName(name),
        difficulty: 2,
        image: null,
        wiki: null,
        description: null,
        source
      };
    }

    const name = normalizeName(entry?.name || "");
    return {
      id: entry.id || makeId(name),
      name,
      aliases: Array.isArray(entry.aliases) ? entry.aliases : [],
      categories: [...new Set(["Any Famous Person", ...(entry.categories || [])])],
      letters: entry.letters || lettersForName(name),
      difficulty: Number(entry.difficulty || 2),
      image: entry.image || entry.photo || null,
      wiki: entry.wiki || entry.url || null,
      description: entry.description || entry.extract || null,
      meta: entry.meta || {},
      source
    };
  }

  const Database = {
    people: [],
    byName: new Map(),
    byCategory: new Map(),
    byLetter: new Map(),
    byCategoryLetter: new Map(),
    loaded: new Set(),
    manifest: null,
    wikiCache: {},
    learnedPeople: [],
    options: {...DEFAULT_OPTIONS},

    init(options = {}){
      this.options = {...DEFAULT_OPTIONS, ...options};

      try {
        this.wikiCache = JSON.parse(localStorage.getItem(this.options.cacheKey) || "{}");
      } catch(e) {
        this.wikiCache = {};
      }

      try {
        this.learnedPeople = JSON.parse(localStorage.getItem(this.options.learnedKey) || "[]");
        if (!Array.isArray(this.learnedPeople)) this.learnedPeople = [];
      } catch(e) {
        this.learnedPeople = [];
      }

      if (this.learnedPeople.length) {
        this.addPeople(this.learnedPeople, "learned", {silent:true});
      }

      this.rebuildIndexes();
      this.updateStats();
      return this;
    },

    async loadManifest(path = this.options.manifestPath){
      if (this.manifest) return this.manifest;

      try {
        const res = await fetch(path);
        if (!res.ok) throw new Error("Manifest failed: " + path);
        this.manifest = await res.json();
        return this.manifest;
      } catch(e) {
        console.warn("Database manifest not loaded:", e);
        this.manifest = {version:1, files:[]};
        return this.manifest;
      }
    },

    async loadAll(){
      const manifest = await this.loadManifest();
      for (const file of manifest.files || []) {
        await this.loadFile(file.path, file.key || file.label || file.path);
      }
      this.updateStats();
      return this.stats();
    },

    async loadCategory(categoryLabel){
      const manifest = await this.loadManifest();

      const file = (manifest.files || []).find(f =>
        f.label === categoryLabel ||
        f.key === categoryLabel ||
        String(f.key || "").toLowerCase() === String(categoryLabel || "").toLowerCase()
      );

      if (file) {
        return this.loadFile(file.path, file.key || file.label || categoryLabel);
      }

      // Smart fallback paths for common categories.
      const fallbackPaths = {
        "Baseball": "data/sports/baseball.json",
        "Football": "data/sports/football.json",
        "Basketball": "data/sports/basketball.json",
        "Hockey": "data/sports/hockey.json",
        "Soccer": "data/sports/soccer.json",
        "Motorsports": "data/sports/motorsports.json",
        "Tennis": "data/sports/tennis.json",
        "Golf": "data/sports/golf.json",
        "Combat Sports": "data/sports/combat_sports.json",
        "Olympics / Track & Field": "data/sports/olympics_track.json",
        "Actors / Actresses": "data/entertainment/actors.json",
        "Musicians": "data/entertainment/musicians.json",
        "Fictional Characters": "data/popculture/fictional.json",
        "Politicians / Historical Figures": "data/history/politicians_historical.json"
      };

      if (fallbackPaths[categoryLabel]) {
        return this.loadFile(fallbackPaths[categoryLabel], categoryLabel);
      }

      return false;
    },

    async loadFile(path, key = path){
      if (this.loaded.has(key)) return true;

      try {
        const res = await fetch(path);
        if (!res.ok) throw new Error("Load failed: " + path);
        const data = await res.json();

        // Supports:
        // [ {...}, {...} ]
        // { people: [ ... ] }
        // { source, label, count, people: [ ... ] }
        const people = Array.isArray(data) ? data : (Array.isArray(data.people) ? data.people : []);

        this.addPeople(people, key);
        this.loaded.add(key);
        this.updateStats();
        return true;
      } catch(e) {
        console.warn("Database file not loaded:", path, e);
        return false;
      }
    },

    addPeople(list, source = "manual", options = {}){
      for (const item of list || []) {
        const rec = toRecord(item, source);
        if (!rec.name) continue;

        const key = slug(rec.name);

        if (this.byName.has(key)) {
          const existing = this.byName.get(key);
          existing.categories = [...new Set([...(existing.categories || []), ...(rec.categories || [])])];
          existing.aliases = [...new Set([...(existing.aliases || []), ...(rec.aliases || [])])];
          existing.image = existing.image || rec.image;
          existing.wiki = existing.wiki || rec.wiki;
          existing.description = existing.description || rec.description;
          existing.meta = {...(existing.meta || {}), ...(rec.meta || {})};
        } else {
          this.people.push(rec);
          this.byName.set(key, rec);
        }
      }

      this.rebuildIndexes();
      if (!options.silent) this.updateStats();
    },

    rebuildIndexes(){
      this.byCategory = new Map();
      this.byLetter = new Map();
      this.byCategoryLetter = new Map();

      for (const person of this.people) {
        const first = person.letters?.first || person.name?.[0]?.toUpperCase() || "";

        if (first) {
          if (!this.byLetter.has(first)) this.byLetter.set(first, []);
          this.byLetter.get(first).push(person);
        }

        for (const cat of person.categories || ["Any Famous Person"]) {
          if (!this.byCategory.has(cat)) this.byCategory.set(cat, []);
          this.byCategory.get(cat).push(person);

          const combo = cat + "::" + first;
          if (first) {
            if (!this.byCategoryLetter.has(combo)) this.byCategoryLetter.set(combo, []);
            this.byCategoryLetter.get(combo).push(person);
          }
        }
      }
    },

    search({startsWith = null, category = "Any Famous Person", unusedSet = new Set(), difficulty = null, limit = 50} = {}){
      const letter = startsWith ? String(startsWith).toUpperCase() : null;
      let pool;

      if (category && category !== "Any Famous Person" && letter) {
        pool = [...(this.byCategoryLetter.get(category + "::" + letter) || [])];
      } else if (category && category !== "Any Famous Person") {
        pool = [...(this.byCategory.get(category) || [])];
      } else if (letter) {
        pool = [...(this.byLetter.get(letter) || [])];
      } else {
        pool = [...this.people];
      }

      // Don't silently use wrong categories. Only fall back to all people if the chosen category has not loaded at all.
      if (!pool.length && category && category !== "Any Famous Person" && !this.byCategory.has(category)) {
        pool = letter ? [...(this.byLetter.get(letter) || [])] : [...this.people];
      }

      pool = pool.filter(p => !unusedSet.has(slug(p.name)));

      if (difficulty === "Easy") {
        pool = pool.filter(p => (p.difficulty || 2) <= 2);
      }

      if (difficulty === "Expert") {
        const doubles = pool.filter(p => {
          const first = p.letters?.first;
          const last = p.letters?.last;
          return first && last && first === last;
        });
        if (doubles.length && Math.random() < 0.45) pool = doubles;
      }

      // Shuffle a small slice to avoid always choosing from the top of alphabetized JSON.
      if (pool.length > limit) {
        const sample = [];
        const seenIndexes = new Set();
        const target = Math.min(limit, pool.length);
        while (sample.length < target) {
          const i = Math.floor(Math.random() * pool.length);
          if (seenIndexes.has(i)) continue;
          seenIndexes.add(i);
          sample.push(pool[i]);
        }
        return sample;
      }

      return pool;
    },

    pick(options = {}){
      const results = this.search(options);
      if (!results.length) return null;
      return results[Math.floor(Math.random() * results.length)];
    },

    categoriesFromWikiData(data, activeCategory = "Any Famous Person"){
      const cats = new Set(["Any Famous Person"]);
      const text = [
        data?.title || "",
        data?.description || "",
        data?.extract || "",
        data?.categoriesText || ""
      ].join(" ").toLowerCase();

      if (activeCategory && activeCategory !== "Any Famous Person" && activeCategory !== "Custom") {
        cats.add(activeCategory);
      }

      const rules = window.CATEGORY_RULES || {};
      Object.entries(rules).forEach(([cat, rule]) => {
        if (!rule || !Array.isArray(rule.positive) || !rule.positive.length) return;
        const hit = rule.positive.some(term => text.includes(String(term).toLowerCase()));
        if (hit) cats.add(cat);
      });

      const sports = ["Baseball","Football","Basketball","Hockey","Soccer","Motorsports","Tennis","Golf","Combat Sports","Olympics / Track & Field"];
      if (sports.some(c => cats.has(c))) cats.add("Athletes");

      return [...cats];
    },

    learnFromWikipedia(name, wikiData, activeCategory = "Any Famous Person"){
      const clean = normalizeName(name || wikiData?.title);
      if (!clean || !wikiData || wikiData.valid === false) return null;

      const rec = {
        id: makeId(clean),
        name: clean,
        aliases: wikiData.title && wikiData.title !== clean ? [wikiData.title] : [],
        categories: this.categoriesFromWikiData(wikiData, activeCategory),
        letters: lettersForName(clean),
        difficulty: 2,
        image: wikiData.photo || null,
        wiki: wikiData.url || null,
        description: wikiData.description || "",
        meta: {
          wikiTitle: wikiData.title || clean,
          cachedAt: Date.now()
        },
        source: "learned"
      };

      this.addPeople([rec], "learned");

      const key = slug(rec.name);
      const existingIndex = this.learnedPeople.findIndex(p => slug(p.name) === key);
      if (existingIndex >= 0) this.learnedPeople[existingIndex] = rec;
      else this.learnedPeople.push(rec);

      try {
        localStorage.setItem(this.options.learnedKey, JSON.stringify(this.learnedPeople));
      } catch(e) {}

      this.updateStats();
      return rec;
    },

    cacheWiki(name, data){
      const key = slug(name);
      if (!key || !data) return;
      this.wikiCache[key] = {...data, cachedAt: Date.now()};
      try {
        localStorage.setItem(this.options.cacheKey, JSON.stringify(this.wikiCache));
      } catch(e) {}
      this.updateStats();
    },

    getCachedWiki(name){
      return this.wikiCache[slug(name)] || null;
    },

    exportLearned(){
      return JSON.stringify({people:this.learnedPeople}, null, 2);
    },

    clearLearned(){
      this.learnedPeople = [];
      try { localStorage.removeItem(this.options.learnedKey); } catch(e) {}
      this.people = this.people.filter(p => p.source !== "learned");
      this.byName = new Map(this.people.map(p => [slug(p.name), p]));
      this.rebuildIndexes();
      this.updateStats();
    },

    stats(){
      return {
        people: this.people.length,
        categories: this.byCategory.size,
        loadedFiles: this.loaded.size,
        wikiCache: Object.keys(this.wikiCache || {}).length,
        learned: this.learnedPeople.length
      };
    },

    updateStats(){
      const el = document.getElementById("dbStats");
      if (!el) return;
      const s = this.stats();
      el.innerHTML = `
        <div class="label">DATABASE</div>
        <div style="font-family:Arial,sans-serif;font-weight:900;line-height:1.5">
          People: ${s.people}<br>
          Categories: ${s.categories}<br>
          Loaded Files: ${s.loadedFiles}<br>
          Wiki Cache: ${s.wikiCache}<br>
          Learned: ${s.learned}
        </div>
      `;
    }
  };

  window.NameDatabase = Database.init();
  window.addNameGamePeople = (list, source = "console") => Database.addPeople(list, source);
  window.exportLearnedPeople = () => Database.exportLearned();
  window.clearLearnedPeople = () => Database.clearLearned();
})();