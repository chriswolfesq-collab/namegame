Database.js Restore V2

Copy this file into your project:

js/database.js

This version supports:
- data/manifest.json
- data/sports/baseball.json
- large JSON files with { people: [...] }
- fast category + starting-letter lookup
- Wikipedia learning cache
- browser console helpers:
  NameDatabase.stats()
  NameDatabase.byCategory.get("Baseball")?.length
  exportLearnedPeople()
  clearLearnedPeople()

Important:
Run the game from a local server for JSON loading:

python3 -m http.server 8000

Then open:

http://localhost:8000
