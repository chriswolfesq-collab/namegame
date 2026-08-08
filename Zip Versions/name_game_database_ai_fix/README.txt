Database AI Fix

Replace these files in your Name Game project:

1. Copy js/game.js into your project's js/game.js
2. Copy js/database.js into your project's js/database.js if needed

Important:
To use data/sports/baseball.json in Chrome, run the project from a local server instead of double-clicking index.html.

From the project folder, run:
python3 -m http.server 8000

Then open:
http://localhost:8000

After loading the game, test in the browser console:
NameDatabase.stats()
NameDatabase.byCategory.get("Baseball")?.length
