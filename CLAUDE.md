# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A personal stats tracker for Ark Nova games played on Board Game Arena (BGA) by msiebert, AstroHood, marksbrt, and siebert23. Games are played roughly every two weeks. Data is collected via Tampermonkey browser scripts and published as a static site on GitHub Pages at `msiebert1.github.io/ark-nova-stats`.

## How to add a new game (the main recurring task)

1. User drops `new_games.json` and `new_logs.json` into `scraper/` (downloaded from the Tampermonkey scripts)
2. Run `./update.sh` from repo root — this merges data, regenerates card analysis, commits, and pushes

If the JSON files are malformed (double-wrapped), `merge_data.py` handles it automatically.

## Commands

```bash
./update.sh                                  # Full workflow: merge → analyze → commit → push
python3 scripts/merge_data.py                # Merge both games and logs (no commit)
python3 scripts/merge_data.py --games        # Merge only games
python3 scripts/merge_data.py --logs         # Merge only logs
python3 scripts/analyze_cards.py             # Regenerate card_analysis.json (run from repo root)
python3 scripts/analyze_appeal_discrepancies.py  # Debug appeal calculation vs. BGA final scores
```

> `analyze_cards.py` uses relative paths (`./docs/data/`) — must be run from repo root.
> `analyze_appeal_discrepancies.py` uses hardcoded absolute paths — only works on this machine.

## Key files

| File | Purpose |
|------|---------|
| `update.sh` | One-command update: merge → analyze → commit → push |
| `scripts/merge_data.py` | Merges `scraper/new_games.json` + `new_logs.json` into `docs/data/` |
| `scripts/analyze_cards.py` | Regenerates `docs/data/card_analysis.json` from game logs |
| `scripts/analyze_appeal_discrepancies.py` | Diagnostic: compares log-derived appeal totals vs. BGA final scores |
| `scraper/tampermonkey_script.js` | BGA game stats collector (runs on `/table?table=`) |
| `scraper/tampermonkey_gamelog.js` | BGA game log collector (runs on `/gamereview?table=`) |
| `docs/data/detailed_games.json` | Master game stats file (source of truth) |
| `docs/data/detailed_game_logs.json` | Master game logs file |
| `docs/data/card_analysis.json` | Derived card play frequency stats |
| `docs/index.html` | Single-page site |
| `docs/js/app.js` | All frontend logic and chart rendering (single IIFE, no build step) |
| `docs/css/style.css` | Site styles |

## Frontend architecture

`app.js` is one large IIFE with no framework or build step. On load it fetches both JSON files, filters games via `isValidGame()`, then calls `renderAll()`. Key behavior:

- `isValidGame()` — only counts completed 4-player games where all four tracked players participated and results are ranked (not "not ranked"). Games missing the `Map` stat are also excluded.
- Player usernames map to display names: msiebert → Matt, marksbrt → Mark, AstroHood → Callie, siebert23 → Keith. These aliases are in `PLAYER_ALIASES` at the top of `app.js`.
- `ALL_ANIMAL_CARDS` and `ALL_SPONSOR_CARDS` are hardcoded card databases used for card-level analysis.

## Data formats

**detailed_games.json**
```json
{
  "exportedAt": "...",
  "totalGames": 70,
  "games": [
    {
      "tableId": "824018766",
      "url": "https://boardgamearena.com/table?table=824018766",
      "players": ["msiebert", "AstroHood", "marksbrt", "siebert23"],
      "date": "2026-03-20",
      "stats": {
        "Score": { "msiebert": "120", "AstroHood": "118", ... },
        "Map": { "msiebert": "Map 13: Drawing Board", ... },
        ...
      }
    }
  ]
}
```

**detailed_game_logs.json**
```json
{
  "exportedAt": "...",
  "totalLogs": 74,
  "logs": [
    {
      "tableId": "824018766",
      "players": ["msiebert", ...],
      "logEntries": [
        { "moveNumber": 1, "actions": ["msiebert plays Sun Bear for 14..."] }
      ]
    }
  ]
}
```

**new_games.json / new_logs.json** (drop zone in `scraper/`) — same format as above but for just the new game(s). After a successful merge these are cleared. `merge_data.py` also handles the double-wrapped variant `{"games": [{...wrapper...}]}` in case of copy-paste issues.

## Players

| Username | Display name |
|----------|-------------|
| msiebert | Matt (site owner) |
| AstroHood | Callie |
| marksbrt | Mark |
| siebert23 | Keith |

## Tech stack

- Static site, no build step — plain HTML/CSS/JS in `docs/`
- GitHub Pages serves directly from `docs/` on `main`
- Python scripts for data processing (no dependencies beyond stdlib)
- Tampermonkey for browser-side data collection

## Legacy scraper scripts

`scraper/bga_scraper.py` and `scraper/playwright_scraper.py` are older server-side approaches to collecting data — they predate the Tampermonkey workflow and are no longer the primary collection method. `bga_scraper.py` uses cookie-based auth; `playwright_scraper.py` uses a saved browser session. These are superseded by the Tampermonkey scripts but kept for reference.

## Stats field names

Field names in `detailed_games.json` match BGA's stat labels exactly (e.g. `"Appeal"`, `"Conservation"`, `"Score"`, `"Map"`, `"Game result"`). Whatever BGA shows is what gets collected.
