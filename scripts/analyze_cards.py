#!/usr/bin/env python3
import json
import re
from collections import defaultdict

# Load game logs
with open('./docs/data/detailed_game_logs.json', 'r') as f:
    logs_data = json.load(f)

# Track cards played per player
player_cards = defaultdict(lambda: defaultdict(int))

# Track cards per game per player
game_cards = defaultdict(lambda: defaultdict(list))

# Regex to match card plays
# Patterns:
# "[Player] plays [Card Name]"
# "[Player] plays [Card Name] for X and places it..."
play_pattern = re.compile(r'^(\w+) plays ([A-Z][^0-9]+?)(?:\s+for \d+|\s*$)')

for game in logs_data['logs']:
    table_id = game['tableId']

    for entry in game.get('logEntries', []):
        for action in entry.get('actions', []):
            match = play_pattern.match(action)
            if match:
                player = match.group(1)
                card_name = match.group(2).strip()

                # Clean up card name (remove trailing "for" if present)
                card_name = re.sub(r'\s+for$', '', card_name).strip()

                # Skip if it contains card_ (those are IDs, not names)
                if 'card_' in card_name:
                    continue

                # Skip standard projects
                if 'standard project' in card_name.lower():
                    continue

                player_cards[player][card_name] += 1
                game_cards[table_id][player].append(card_name)

# Output cards per game per player
print('=== CARDS PLAYED PER GAME ===\n')
for i, (table_id, players) in enumerate(list(game_cards.items())[:5]):
    print(f'\nGame {table_id}:')
    for player, cards in players.items():
        if cards:
            print(f'  {player}: {", ".join(cards)}')
print('\n... (showing first 5 games)\n')

# Output top 10 cards per player
print('\n=== TOP 10 MOST PLAYED CARDS PER PLAYER (min 2 plays) ===\n')

tracked_players = ['msiebert', 'marksbrt', 'AstroHood', 'siebert23']

for player in tracked_players:
    if player not in player_cards:
        continue

    cards = [(name, count) for name, count in player_cards[player].items() if count >= 2]
    cards.sort(key=lambda x: -x[1])
    cards = cards[:10]

    print(f'{player}:')
    for idx, (name, count) in enumerate(cards):
        print(f'  {idx + 1}. {name} ({count} plays)')
    print('')

# Save full data to JSON
output = {
    'generatedAt': '',
    'cardsPerGame': {k: dict(v) for k, v in game_cards.items()},
    'topCardsByPlayer': {}
}

for player in tracked_players:
    if player not in player_cards:
        continue

    cards = [(name, count) for name, count in player_cards[player].items() if count >= 2]
    cards.sort(key=lambda x: -x[1])
    output['topCardsByPlayer'][player] = [{'card': name, 'plays': count} for name, count in cards]

with open('./docs/data/card_analysis.json', 'w') as f:
    json.dump(output, f, indent=2)

print('Full analysis saved to docs/data/card_analysis.json')
