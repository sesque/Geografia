# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Run: open `index.html` (works from file://, no server, no build). Live site: GitHub Pages from `main` (https://sesque.github.io/Geografia/); a push to `main` republishes it.
- Tests: `node --test tests/*.test.js` (the `tests/` directory form fails on Node 25). Single file: `node --test tests/quiz.test.js`.
- After editing `data/*.json` or `data/maps/*`: `python3 scripts/build_data.py` regenerates `data/bundle.js`, then `python3 scripts/check_maps.py` and `python3 scripts/check_flags.py`.
- Browser tests (Playwright): `js/config.js` holds the REAL Google Sheet URL, so every test context must block it or test games land in the family scoreboard: `page.route('**/script.google.com/**', abort)` and `'**/*.googleusercontent.com/**'`.

## Project

Geography quiz for a family (ES/EN toggle, dark "Arcade" UI, 13-year-old audience). Topics (`Quiz.TOPICS`):
- Spain, multiple choice: `es_ccaa_cap` (capitals of comunidades autónomas, both directions), `es_ccaa_prov` (which comunidad a province belongs to).
- World, multiple choice: capitals of the 5 continents (`world_<continent>`) and `world_flags` (Banderas del Mundo: flag to country; only countries with at least 1 million people and not disputed; no map shown).
- Locate on the map (click, no choices): `loc_prov`, `loc_ccaa`, `loc_<continent>`.

Rules: multiple choice has 5 options; 10/20/30 questions (fewer if the topic has fewer items); the player is new or existing; after each answer a map shows the place (except flags); the metric is % correct per player per topic.

## Architecture

- Classic scripts, one global each (`Store`, `Stats`, `Quiz`, `GeoMap`, `I18n`, `Sync`, `GeoConfig`, `GeoData`), also exported via `module.exports` for node tests. Load order is in `index.html`. `docs/CONTRACTS.md` specifies every module API; keep it in sync when changing them.
- Data flows `data/*.json` + `data/maps/*` -> `scripts/build_data.py` -> `data/bundle.js` (`window.GeoData`). Map feature ids: INE codes (provinces), ccaa ids, ISO numeric (countries). Questions reference them through `target.id`. Flags are `assets/flags/<iso_a2>.svg` (flag-icons, MIT).
- `Quiz.generate` makes language-neutral questions (`{es,en}` labels); `app.js` picks the language at render time. `GeoMap` owns all map rendering (`css/map.css`, `--gm-*` variables) so every sub-mode looks identical; zoom and pan work in every map.
- Scores: each finished game is saved in `localStorage` (`geografia.v1`) and sent through `Sync` to a Google Apps Script web app (`apps-script/Code.gs`, setup in `docs/SETUP_SHEET.md`) that appends to the sheet "Geografía – Scores". Unsent games wait in a queue (`geografia.queue.v1`). `Stats.merge` combines local and central games for rankings. An empty `GeoConfig.sheetUrl` means local-only.
- Gamification: 10 XP per correct answer, 12 named levels (`Stats.level`), streak flame (`Stats.streak`). Records on the result screen (`Stats.recordStatus`) compare % per topic across all game lengths: personal and absolute (absolute only when central data was obtained).
- Menu shows the top 5 for the highlighted topic (minimum 10 questions in the topic to appear). Games of topics no longer in `Quiz.TOPICS` are ignored.
- Delete player removes the player from this device only (and their unsent queue), never from the sheet.

## Decisions

- Russia, Turkey and Cyprus are in Europe; Bolivia's capital is La Paz; Sucre is not accepted.
- Disputed territories (Kosovo, Taiwan, Palestine, Western Sahara, N. Cyprus, Somaliland) are drawn with a dotted border and are never asked or offered as answers.
- Country populations (`population_m`, UN 2023) were typed from memory and are approximate; the 1 million flag cutoff is sensitive for Fiji (0.93), Djibouti (1.14), Eswatini (1.20), Mauritius (1.26).
- Spain provinces come from Natural Earth 1:10m (about 1 km accuracy), not official IGN data. Sources and licences: `data/maps/SOURCES.md`.
- The repo and the sheet URL in `js/config.js` are public and unauthenticated by design (family use); the Apps Script only validates the shape of submitted games.
- `mockup/` holds the design prototypes (layout, splash, three style options); the app implements style A.
- Work was done with the model-orchestration plugin: bulk and mechanical work goes to workers or cheaper agents, and their output is audited before acceptance.
