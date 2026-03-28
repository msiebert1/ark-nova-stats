#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Merging new game data..."
python3 scripts/merge_data.py

echo ""
echo "Regenerating card analysis..."
python3 scripts/analyze_cards.py > /dev/null

echo ""
echo "Committing and pushing..."
git add docs/data/
git diff --cached --quiet && echo "No changes to commit." && exit 0

GAME_COUNT=$(python3 -c "import json; d=json.load(open('docs/data/detailed_games.json')); print(d['totalGames'])")
git commit -m "Add game results — ${GAME_COUNT} total games ($(date +%Y-%m-%d))"
git push

echo ""
echo "Done! Site will update in ~1 minute."
