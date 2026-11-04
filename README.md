# except you.

*an incremental game about 3 am.*

It's 3:07 am and you can't sleep. Your head won't stop. You click, and the thoughts pile up.
Across the street, the building is still awake, and everyone in it seems to have someone.

It takes about thirty minutes and plays best with headphones, on a phone or a computer.

## Play

Open `index.html` in a browser. Nothing needs installing or building. Progress saves to the browser as you go.

To make a single self-contained file (CSS and JS inlined) for hosting or sending:

```sh
node tools/build.js            # -> dist/except-you.html
```

## How it's put together

| file | what's in it |
| --- | --- |
| `index.html` | the page |
| `css/style.css` | the look: a dark room, three columns on desktop, tabs on a phone |
| `js/data.js` | every word in the game, the numbers, and the economy as pure functions |
| `js/audio.js` | all sound, synthesized live with Web Audio (no audio files) |
| `js/visuals.js` | rain, film grain, drifting text, and the building across the street, drawn on canvas |
| `js/game.js` | state, the loop, saving, the four acts, the moments, the endings |

Tools (Node, plus the Playwright that ships with Chromium):

- `node tools/sim.js [clicksPerSecond]` simulates a player and prints when each act lands. Use it after changing any number in `data.js`.
- `node tools/playtest.js [outDir] [--mobile]` plays the whole night in a headless browser through the real UI at 24× speed, screenshots every act, and fails on any console error.
- `index.html?debug&speed=10&fast` speeds up time (`speed`) and the cutscenes (`fast`), and exposes `window.__night` for poking at state.

## Spoilers

<details>
<summary>the shape of the night</summary>

1. **awake.** You stare at the ceiling. Each click is a thought, and the generators are habits: replaying the conversation, checking your phone, rereading "haha yeah". Phone notifications are the golden cookies. They're never from them.
2. **the window.** You open the curtains. Watching the couples across the street gives you *longing*. Spending longing on "keep watching" brings them closer together and multiplies your thoughts. When you've seen everything, the slowed song swells: *anybody can find love. / except you.*
3. **loud.** A habit you never bought shows up and grows on its own. The UI glitches, the voice quotes your real stats back at you, and the buttons beg you to make it stop. Buying "make it stop" makes it louder.
4. **silence.** The game turns around. You hold to breathe, earn quiet, and let go of every habit one at a time. The number goes down to zero. Someone texts. Someone across the street is awake too.

A quieter voice whispers through the first three acts and is easy to miss. What you kept, who you answered, and whether you waved all change the last line.

</details>
