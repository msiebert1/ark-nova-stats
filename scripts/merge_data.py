#!/usr/bin/env python3
"""
Merge newly collected game data and logs into existing JSON files.

Usage:
  python scripts/merge_data.py              # merges both from default locations
  python scripts/merge_data.py --games      # merge only games
  python scripts/merge_data.py --logs       # merge only logs
"""

import json
import argparse
from pathlib import Path
from datetime import datetime

REPO_ROOT = Path(__file__).parent.parent
DOCS_DATA_DIR = REPO_ROOT / "docs" / "data"
SCRAPER_DIR = REPO_ROOT / "scraper"

DEFAULT_NEW_GAMES = SCRAPER_DIR / "new_games.json"
DEFAULT_NEW_LOGS = SCRAPER_DIR / "new_logs.json"

def merge_games(new_games_path: str):
    """Merge new games into detailed_games.json"""
    existing_path = DOCS_DATA_DIR / "detailed_games.json"

    # Load existing data
    with open(existing_path, 'r') as f:
        existing = json.load(f)

    existing_ids = {g['tableId'] for g in existing['games']}

    # Load new data
    with open(new_games_path, 'r') as f:
        new_data = json.load(f)

    new_games = new_data.get('games', [])

    # Filter to truly new games
    added = []
    for game in new_games:
        if game['tableId'] not in existing_ids:
            existing['games'].append(game)
            added.append(game['tableId'])
            existing_ids.add(game['tableId'])

    # Update metadata
    existing['exportedAt'] = datetime.now().isoformat() + 'Z'
    existing['totalGames'] = len(existing['games'])

    # Save
    with open(existing_path, 'w') as f:
        json.dump(existing, f, indent=2)

    print(f"Games: Added {len(added)} new games (total: {existing['totalGames']})")
    if added:
        print(f"  New IDs: {', '.join(added)}")
    return len(added)

def merge_logs(new_logs_path: str):
    """Merge new logs into detailed_game_logs.json"""
    existing_path = DOCS_DATA_DIR / "detailed_game_logs.json"

    # Load existing data
    with open(existing_path, 'r') as f:
        existing = json.load(f)

    existing_ids = {g['tableId'] for g in existing['logs']}

    # Load new data
    with open(new_logs_path, 'r') as f:
        new_data = json.load(f)

    new_logs = new_data.get('logs', [])

    # Filter to truly new logs
    added = []
    for log in new_logs:
        if log['tableId'] not in existing_ids:
            existing['logs'].append(log)
            added.append(log['tableId'])
            existing_ids.add(log['tableId'])

    # Update metadata
    existing['exportedAt'] = datetime.now().isoformat() + 'Z'
    existing['totalLogs'] = len(existing['logs'])

    # Save
    with open(existing_path, 'w') as f:
        json.dump(existing, f, indent=2)

    print(f"Logs: Added {len(added)} new logs (total: {existing['totalLogs']})")
    if added:
        print(f"  New IDs: {', '.join(added)}")
    return len(added)

def clear_file(path: Path):
    """Reset a new_*.json file to empty state"""
    if 'games' in path.name:
        with open(path, 'w') as f:
            json.dump({"games": []}, f, indent=2)
    else:
        with open(path, 'w') as f:
            json.dump({"logs": []}, f, indent=2)

def main():
    parser = argparse.ArgumentParser(description='Merge new game data into existing files')
    parser.add_argument('--games', '-g', nargs='?', const=str(DEFAULT_NEW_GAMES),
                        help='Merge games (default: scraper/new_games.json)')
    parser.add_argument('--logs', '-l', nargs='?', const=str(DEFAULT_NEW_LOGS),
                        help='Merge logs (default: scraper/new_logs.json)')
    args = parser.parse_args()

    # If no args provided, merge both from defaults
    if args.games is None and args.logs is None:
        args.games = str(DEFAULT_NEW_GAMES)
        args.logs = str(DEFAULT_NEW_LOGS)

    total_added = 0

    if args.games:
        added = merge_games(args.games)
        total_added += added
        if added > 0:
            clear_file(Path(args.games))

    if args.logs:
        added = merge_logs(args.logs)
        total_added += added
        if added > 0:
            clear_file(Path(args.logs))

    if total_added > 0:
        print(f"\nDone! Don't forget to commit and push to GitHub.")
    else:
        print("\nNo new data to add.")

if __name__ == '__main__':
    main()
