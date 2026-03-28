# Ark Nova Stats

Personal stats tracker for Ark Nova games played on Board Game Arena. Data is collected via Tampermonkey browser scripts and published as a static site on GitHub Pages.

---

## Adding a New Game

### Step 1 — Collect game stats

1. Go to the BGA table page: `boardgamearena.com/table?table=<TABLE_ID>`
2. The Tampermonkey **"Collect This Game"** button appears in the top-right corner
   - If it says **"Already logged"**, this game is already in the database
3. Click **"Collect This Game"** and wait for it to finish
4. Click the button again (now showing **"Export 1"**) → `new_games.json` downloads automatically
5. Move `new_games.json` to `ark-nova-stats/scraper/`

### Step 2 — Collect game log

1. Go to the BGA game review page: `boardgamearena.com/gamereview?table=<TABLE_ID>`
2. The Tampermonkey **"Collect This Log"** button appears in the top-right corner
3. Click **"Collect This Log"** and wait for it to finish (the log takes a moment to load)
4. Click the button again (now showing **"Export 1"**) → `new_logs.json` downloads automatically
5. Move `new_logs.json` to `ark-nova-stats/scraper/`

### Step 3 — Update the site

From the repo root, run:

```bash
./update.sh
```

This will:
- Merge `new_games.json` and `new_logs.json` into the site data files
- Regenerate the card analysis
- Commit and push to GitHub

The site updates on GitHub Pages within ~1 minute of the push.

---

## Tampermonkey Setup

If you need to reinstall the scripts (new browser, new machine, etc.):

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Create a new script and paste the contents of `scraper/tampermonkey_script.js` (game stats collector)
3. Create a second new script and paste the contents of `scraper/tampermonkey_gamelog.js` (game log collector)
4. Save both — they will activate automatically on `boardgamearena.com`

---

## Repo Structure

```
ark-nova-stats/
├── update.sh                  # Run this after dropping in new data files
├── docs/                      # GitHub Pages site
│   ├── index.html
│   ├── css/style.css
│   ├── js/app.js
│   └── data/
│       ├── detailed_games.json      # All game stats
│       ├── detailed_game_logs.json  # All game logs
│       └── card_analysis.json       # Derived card play stats
├── scripts/
│   ├── merge_data.py          # Merges new_games.json / new_logs.json into docs/data/
│   └── analyze_cards.py       # Regenerates card_analysis.json from game logs
└── scraper/
    ├── tampermonkey_script.js  # BGA game stats collector
    ├── tampermonkey_gamelog.js # BGA game log collector
    ├── new_games.json          # Drop new game stats here before running update.sh
    └── new_logs.json           # Drop new game logs here before running update.sh
```

---

## Troubleshooting

**"Collect This Game" button doesn't appear**
- Wait a second for the page to fully load, then refresh
- Make sure Tampermonkey is enabled for boardgamearena.com

**"Collect This Log" button times out / shows "No log found"**
- The game review page can be slow to load all moves — try refreshing and collecting again

**`update.sh` reports "No new data to add"**
- The game may already be in the database (the Tampermonkey button would have shown "Already logged")
- Check that you moved the files to `scraper/` and not somewhere else

**Double-wrapped JSON (if pasting manually)**
- `merge_data.py` handles this automatically — it detects and unwraps the nested format
