Name Game AI Engine 2.0

Architecture (js/):
  state.js      - single GameState object (players, turn, timers, etc.)
  rules.js      - pure name-parsing + category-matching, no side effects
  database.js   - local name database; the primary lookup for validation
  wikipedia.js  - network fallback, only used when a name isn't local
  validator.js  - validateName(): checks the local database first, Wikipedia second
  ai.js         - AI opponent, ranks candidates by real fame score
  audio.js      - sfx playback
  ui.js         - all DOM rendering
  engine.js     - turn engine: startGame/submitAnswer/giveStrike/aiTakeTurn
  main.js       - DOM event wiring + bootstrap

Data (data/):
  Every person record carries a "fame" score - real Wikipedia pageview counts,
  stamped on by scripts/fetch_fame_scores.py. The AI ranks candidates by this
  number directly instead of matching against hand-curated "famous name" lists.
  Re-run after adding new names to a category (it skips anything already scored):
    python3 scripts/fetch_fame_scores.py

Playing:
  Double-click dist/NameGame_AI_Engine_2_0.html. This standalone file embeds
  the CSS, JS, JSON databases, and audio, so it works with no local server and
  no network access for any name already in the local database.

  index.html is the DEVELOPMENT source - opening it directly (file://) will
  fail to load any data, since browsers block fetch() to local files. Serve it
  from a local HTTP server while editing, and rebuild dist afterward:
    python3 scripts/build_dist.py

Console checks:
  NameDatabase.stats()
  NameDatabase.byCategory.get("Baseball")?.length
  AIEngine.stats()
  debugAI()
