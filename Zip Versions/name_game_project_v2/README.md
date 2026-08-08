# Name Game Project Split - V1

This is the first project-structure version of the game.

## Files

- `index.html` contains the page markup.
- `css/style.css` contains the styles.
- `js/game.js` contains the current game logic.
- `data/` is reserved for future JSON databases.
- `audio/` is reserved for sound files.

## Important

Open `index.html` in a browser to run the game.

If sounds do not play, copy these files into the `audio/` folder:

- `namesubmitted.mp3`
- `reverse.mp3`
- `yourturn.mp3`
- `10secondsremaining.mp3`

This version does not yet split JavaScript into separate modules. It is the safe first step: CSS and JS are externalized while keeping gameplay logic intact.
