# Ark Nova Stats — Claude Context

## What this project is

A personal stats tracker for Ark Nova games played on Board Game Arena (BGA) by msiebert, AstroHood, marksbrt, and siebert23. Games are played roughly every two weeks. Data is collected via Tampermonkey browser scripts and published as a static site on GitHub Pages at `msiebert1.github.io/ark-nova-stats`.

## How to add a new game (the main recurring task)

1. User drops `new_games.json` and `new_logs.json` into `scraper/` (downloaded from the Tampermonkey scripts)
2. Run `./update.sh` from repo root — this merges data, regenerates card analysis, commits, and pushes

If the JSON files are malformed (double-wrapped), `merge_data.py` handles it automatically.

## Key files

| File | Purpose |
|------|---------|
| `update.sh` | One-command update: merge → analyze → commit → push |
| `scripts/merge_data.py` | Merges `scraper/new_games.json` + `new_logs.json` into `docs/data/` |
| `scripts/analyze_cards.py` | Regenerates `docs/data/card_analysis.json` from game logs |
| `scraper/tampermonkey_script.js` | BGA game stats collector (runs on `/table?table=`) |
| `scraper/tampermonkey_gamelog.js` | BGA game log collector (runs on `/gamereview?table=`) |
| `docs/data/detailed_games.json` | Master game stats file (source of truth) |
| `docs/data/detailed_game_logs.json` | Master game logs file |
| `docs/data/card_analysis.json` | Derived card play frequency stats |
| `docs/index.html` | Single-page site |
| `docs/js/app.js` | All frontend logic and chart rendering |
| `docs/css/style.css` | Site styles |

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

- **msiebert** — site owner
- **AstroHood**
- **marksbrt**
- **siebert23**

## Tech stack

- Static site, no build step — plain HTML/CSS/JS in `docs/`
- GitHub Pages serves directly from `docs/` on `main`
- Python scripts for data processing (no dependencies beyond stdlib)
- Tampermonkey for browser-side data collection

## Common tasks

**Add a new game:** See above — drop files in `scraper/`, run `./update.sh`

**Change site appearance / add new stats/charts:** Edit `docs/js/app.js` and/or `docs/css/style.css`

**Change what stats are tracked:** The stats come directly from BGA's stats table — whatever BGA shows is what gets collected. Field names in `detailed_games.json` match BGA's stat labels exactly (e.g. `"Appeal"`, `"Conservation"`, `"Score"`)

**Regenerate card analysis only:** `python3 scripts/analyze_cards.py`

**Merge data only (no commit):** `python3 scripts/merge_data.py`
