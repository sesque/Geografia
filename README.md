# ¿Dónde está Burgos? / Where is Burgos?

A geography quiz for the family, in Spanish and English. It runs in the browser with no installation and no server.

**Play it:** https://sesque.github.io/Geografia/

## Game modes

- **España:** capitals of the comunidades autónomas, and which comunidad a province belongs to.
- **Mundo:** countries and capitals of Europe, America, Asia, Oceania and Africa, and **Banderas del Mundo** (guess the country from its flag, countries with at least 1 million people).
- **Situar en el mapa:** click the province, comunidad or country on an interactive map.

Multiple-choice questions have 5 answers. You choose 10, 20 or 30 questions. After each answer the app shows the place on a map, and maps can be zoomed and dragged.

## Players, scores and records

- Pick an existing player or create a new one.
- The score is the percentage of correct answers per topic. You earn XP and levels, and a streak counter rewards consecutive correct answers.
- The menu shows the top 5 players for the highlighted topic, and the result screen tells you when you set a personal or an all-players record.
- Scores are stored in your browser. If the family scoreboard is set up (see below), they are also sent to a shared Google Sheet so everyone shares the same rankings.

## Run it locally

Open `index.html` in a browser. There is nothing to build.

Run the tests (Node 18 or later):

```
node --test tests/*.test.js
```

## Family scoreboard (optional)

Follow [docs/SETUP_SHEET.md](docs/SETUP_SHEET.md) to create the Google Apps Script web app and paste its URL into `js/config.js`. With an empty `sheetUrl` the app works with local scores only.

The URL ends up in a public repository and the script has no password, so use this for a family or a class, not for a competition.

## Project layout

| Path | Contents |
|---|---|
| `index.html`, `css/`, `js/` | The app: plain scripts, no framework or build step |
| `data/` | Provinces, comunidades and countries, plus generated `bundle.js` and the map geometry in `data/maps/` |
| `assets/flags/` | SVG flags |
| `apps-script/Code.gs` | Google Apps Script for the shared scoreboard |
| `docs/CONTRACTS.md` | Module APIs |
| `mockup/` | Design prototypes |
| `scripts/` | Data build and checking scripts |
| `tests/` | Node tests |

## Credits

- Maps: [Natural Earth](https://www.naturalearthdata.com/) (public domain) through `world-atlas`; see `data/maps/SOURCES.md`.
- Flags: [flag-icons](https://github.com/lipis/flag-icons) (MIT); see `assets/flags/LICENSE-flag-icons.txt`.
- Maps are drawn with [D3](https://d3js.org/) and [topojson-client](https://github.com/topojson/topojson-client).
- The country populations are approximate UN 2023 estimates.
- Built with Claude Code.
