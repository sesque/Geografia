# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Run: open `index.html` (works from file://, no server, no build).
- Tests: `node --test tests/*.test.js` (the `tests/` directory form fails on Node 25). Single file: `node --test tests/quiz.test.js`.
- After editing `data/*.json` or `data/maps/*`: `python3 scripts/build_data.py` regenerates `data/bundle.js`, then `python3 scripts/check_maps.py`.

## Project

Geography quiz web app for a student (Spanish-language UI and content). Topics:
- Capitales de provincia de España
- Comunidades autónomas
- Países y capitales of Europa, América, Asia, Oceanía and África
- "Locate on map": click the country, provincia or comunidad on an interactive map (no multiple choice)

Rules from the requirements:
- Multiple choice has 5 options. The student picks the topic and the number of questions (10, 20 or 30).
- The player is either a new name or an existing player.
- After every answer, in all modes, show a map locating the city, provincia, comunidad or country.
- Scoring metric is the % of correct answers per player per topic. Extra stats and rankings are welcome.

## Architecture

- Classic scripts, one global each (`Store`, `Stats`, `Quiz`, `GeoMap`, `I18n`, `GeoData`), also exported via `module.exports` for node tests. Load order is in `index.html`. The module APIs are specified in `docs/CONTRACTS.md`; keep it in sync when changing them.
- Data flows `data/*.json` + `data/maps/*` -> `scripts/build_data.py` -> `data/bundle.js` (`window.GeoData`). Map feature ids are INE codes (provinces), ccaa ids, and ISO numeric (countries); questions reference them through `target.id`.
- `Quiz.generate` makes language-neutral questions (`{es,en}` labels); `app.js` picks the language at render time. `GeoMap` owns all map rendering and styling (`css/map.css`, `--gm-*` variables) so every sub-mode looks identical.
- Players and scores live in `localStorage` key `geografia.v1` (single device). Dataset facts must be audited by hand: a wrong capital misteaches the student.

## Decisions

- Bilingual ES/EN toggle; separate sub-modes for locate-on-map (provincias, comunidades, países per continent).
- Russia, Turkey and Cyprus are in Europe. Bolivia's capital is La Paz.
- Capitales de provincia asks all 50 provinces, including those whose name equals the capital.
- Disputed territories (Kosovo, Taiwan, Palestine, Western Sahara): neutral dotted border and excluded from locate-on-map questions.
- Splash screen "Where is Burgos?" lasts 5 seconds and is skippable; mockups live in `mockup/` (approved layout: `layout.html`, with Next on the space bar and a live % correct under the progress bar).
- Map data is in `data/maps/` (sources and licences in `SOURCES.md`); `python3 scripts/check_maps.py` verifies datasets against the geometry.

## Workflow

The model-orchestration plugin is active. Delegate bulk or mechanical work to workers or cheaper agents, and review their output before accepting it.
