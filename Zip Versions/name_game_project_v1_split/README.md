# Name Game Project V4 - Automatic Wikipedia Learning

This version adds automatic Wikipedia learning to the Phase 1 database engine.

## What changed

When a valid name is accepted by Wikipedia, the game now stores that person in the local database using `localStorage`.

The learned record includes:

- name
- aliases
- categories inferred from Wikipedia and the selected category
- first/last letters
- photo URL when available
- Wikipedia title, description, and URL

## Browser console helpers

```js
NameDatabase.stats()
exportLearnedPeople()
clearLearnedPeople()
addNameGamePeople([{name:"Shohei Ohtani", categories:["Athletes","Baseball"]}])
```

## Important

Learned people are stored in the browser where the game is played. They persist between sessions on that browser.

To export them, run:

```js
copy(exportLearnedPeople())
```

Then paste the copied JSON into a file such as:

```text
data/learned_people.json
```

## Running locally

If JSON loading is blocked when opening `index.html` directly, run a local server:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Next Step

The next upgrade is to have the AI prefer the learned database before falling back to the old hardcoded `aiNames` list.
