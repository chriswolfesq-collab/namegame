(function(){
  const DEFAULT_OPTIONS = {
    manifestPath: "data/manifest.json",
    cacheKey: "nameGameWikiCache"
  };

  const normalizeName = (name) => String(name || "").trim().replace(/\s+/g, " ");
  const slug = (value) => normalizeName(value).toLowerCase();

  function toRecord(entry, source = "manual"){
    if (typeof entry === "string") {
      const name = normalizeName(entry);
      const parts = name.split(" ");
      return {
        id: slug(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        name,
        aliases: [],
        categories: ["Any Famous Person"],
        letters: { first: name[0]?.toUpperCase() || "", last: parts.at(-1)?.[0]?.toUpperCase() || "" },
        difficulty: 2,
        image: null,
        wiki: null,
        source
      };
    }

    const name = normalizeName(entry.name);
    const parts = name.split(" ");
    return {
      id: entry.id || slug(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name,
      aliases: Array.isArray(entry.aliases) ? entry.aliases : [],
      categories: [...new Set(["Any Famous Person", ...(entry.categories || [])])],
      letters: entry.letters || { first: name[0]?.toUpperCase() || "", last: parts.at(-1)?.[0]?.toUpperCase() || "" },
      difficulty: Number(entry.difficulty || 2),
      image: entry.image || null,
      wiki: entry.wiki || null,
      source
    };
  }

  const Database = {
    people: [],
    byName: new Map(),
    byCategory: new Map(),
    byLetter: new Map(),
    loaded: new Set(),
    manifest: null,
    wikiCache: {},
    options: {...DEFAULT_OPTIONS},

    init(options = {}){
      this.options = {...DEFAULT_OPTIONS, ...options};
      try {
        this.wikiCache = JSON.parse(localStorage.getItem(this.options.cacheKey) || "{}");
      } catch(e) {
        this.wikiCache = {};
      }
      this.rebuildIndexes();
      this.updateStats();
      return this;
    },

    async loadManifest(path = this.options.manifestPath){
      if (this.manifest) return this.manifest;
      try {
        const res = await fetch(path);
        if (!res.ok) throw new Error("Manifest failed");
        this.manifest = await res.json();
        return this.manifest;
      } catch(e) {
        this.manifest = {version:1, files:[]};
        return this.manifest;
      }
    },

    async loadAll(){
      const manifest = await this.loadManifest();
      for (const file of manifest.files || []) {
        await this.loadFile(file.path, file.key);
      }
      return this.stats();
    },

    async loadCategory(categoryLabel){
      const manifest = await this.loadManifest();
      const file = (manifest.files || []).find(f => f.label === categoryLabel || f.key === categoryLabel);
      if (!file) return false;
      return this.loadFile(file.path, file.key);
    },

    async loadFile(path, key = path){
      if (this.loaded.has(key)) return true;
      try {
        const res = await fetch(path);
        if (!res.ok) throw new Error("Load failed: " + path);
        const data = await res.json();
        const people = Array.isArray(data) ? data : (data.people || []);
        this.addPeople(people, key);
        this.loaded.add(key);
        return true;
      } catch(e) {
        console.warn("Database file not loaded:", path, e);
        return false;
      }
    },

    addPeople(list, source = "manual"){
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
        } else {
          this.people.push(rec);
          this.byName.set(key, rec);
        }
      }
      this.rebuildIndexes();
      this.updateStats();
    },

    rebuildIndexes(){
      this.byCategory = new Map();
      this.byLetter = new Map();

      for (const person of this.people) {
        for (const cat of person.categories || ["Any Famous Person"]) {
          if (!this.byCategory.has(cat)) this.byCategory.set(cat, []);
          this.byCategory.get(cat).push(person);
        }

        const first = person.letters?.first || person.name?.[0]?.toUpperCase();
        if (first) {
          if (!this.byLetter.has(first)) this.byLetter.set(first, []);
          this.byLetter.get(first).push(person);
        }
      }
    },

    search({startsWith = null, category = "Any Famous Person", unusedSet = new Set(), difficulty = null, limit = 50} = {}){
      let pool = category && category !== "Any Famous Person"
        ? [...(this.byCategory.get(category) || [])]
        : [...this.people];

      if (!pool.length) pool = [...this.people];

      if (startsWith) {
        const letter = String(startsWith).toUpperCase();
        pool = pool.filter(p => (p.letters?.first || p.name?.[0]?.toUpperCase()) === letter);
      }

      pool = pool.filter(p => !unusedSet.has(slug(p.name)));

      if (difficulty === "Easy") pool = pool.filter(p => (p.difficulty || 2) <= 2);
      if (difficulty === "Expert") {
        const doubles = pool.filter(p => {
          const first = p.letters?.first;
          const last = p.letters?.last;
          return first && last && first === last;
        });
        if (doubles.length && Math.random() < 0.45) pool = doubles;
      }

      return pool.slice(0, limit);
    },

    pick(options = {}){
      const results = this.search(options);
      if (!results.length) return null;
      return results[Math.floor(Math.random() * results.length)];
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

    stats(){
      return {
        people: this.people.length,
        categories: this.byCategory.size,
        loadedFiles: this.loaded.size,
        wikiCache: Object.keys(this.wikiCache || {}).length
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
          Wiki Cache: ${s.wikiCache}
        </div>
      `;
    }
  };

  window.NameDatabase = Database.init();
  window.addNameGamePeople = (list, source = "console") => Database.addPeople(list, source);
})();