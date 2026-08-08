Name Game AI Engine 2.0

What changed:
- AI now uses AIEngine in js/ai.js.
- Baseball AI uses data/sports/baseball.json directly.
- AI builds shuffled A-Z buckets once at game start.
- AI no longer uses the tiny hardcoded fallback list when the database is ready.
- Names like "Aaron Brooks (baseball)" are displayed as "Aaron Brooks".
- Added debug helper:
  debugAI()

Recommended:
Open dist/NameGame_AI_Engine_2_0.html directly. This standalone file embeds CSS, JS, JSON databases, and audio.

Console checks:
NameDatabase.stats()
NameDatabase.byCategory.get("Baseball")?.length
AIEngine.stats()
debugAI()
