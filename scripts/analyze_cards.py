#!/usr/bin/env python3
import json
import re
from collections import defaultdict

# Load game logs
with open('./docs/data/detailed_game_logs.json', 'r') as f:
    logs_data = json.load(f)

tracked_players = ['msiebert', 'marksbrt', 'AstroHood', 'siebert23']

# Track cards played per player
player_cards = defaultdict(lambda: defaultdict(int))

# Track cards per game per player
game_cards = defaultdict(lambda: defaultdict(list))

# Regex to match card plays
# Patterns:
# "[Player] plays [Card Name]"
# "[Player] plays [Card Name] for X and places it..."
play_pattern = re.compile(r'^(\w+) plays ([A-Z][^0-9]+?)(?:\s+for \d+|\s*$)')

# Action card draft tracking
ACTION_CARDS = ['Build', 'Cards', 'Animals', 'Association', 'Sponsors']
draft_line_pattern = re.compile(r'^(\w+) will play with action cards: (.+)$')
player_action_drafts = defaultdict(lambda: defaultdict(int))        # player -> card -> count
player_action_draft_levels = defaultdict(                            # player -> card -> level -> count
    lambda: defaultdict(lambda: defaultdict(int))
)
game_action_draft_levels = defaultdict(                              # table_id -> player -> card -> level -> count
    lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
)


def parse_draft_picks(card_str):
    """Return list of (card_name, level) for cards that had an explicit level number (i.e. were drafted)."""
    normalized = card_str.replace(' and ', ', ')
    parts = [p.strip() for p in normalized.split(',')]
    picks = []
    for part in parts:
        tokens = part.strip().split()
        if len(tokens) == 2:
            card_name = tokens[0]
            try:
                level = int(tokens[1])
                picks.append((card_name, level))
            except ValueError:
                pass
    return picks


for game in logs_data['logs']:
    table_id = game['tableId']

    for entry in game.get('logEntries', []):
        for action in entry.get('actions', []):
            # Card plays
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

            # Action card draft choices
            draft_match = draft_line_pattern.match(action)
            if draft_match:
                player = draft_match.group(1)
                if player not in tracked_players:
                    continue
                picks = parse_draft_picks(draft_match.group(2))
                for card_name, level in picks:
                    if card_name in ACTION_CARDS:
                        player_action_drafts[player][card_name] += 1
                        player_action_draft_levels[player][card_name][str(level)] += 1
                        game_action_draft_levels[table_id][player][card_name][str(level)] += 1

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

# Output action card draft summary
print('\n=== ACTION CARD DRAFT CHOICES ===\n')
for player in tracked_players:
    if player not in player_action_drafts:
        continue
    print(f'{player}:')
    for card in ACTION_CARDS:
        count = player_action_drafts[player].get(card, 0)
        if count:
            levels = player_action_draft_levels[player][card]
            level_str = ', '.join(f'lvl{k}:{v}' for k, v in sorted(levels.items()))
            print(f'  {card}: {count} ({level_str})')
    print('')

# Save full data to JSON
output = {
    'generatedAt': '',
    'cardsPerGame': {k: dict(v) for k, v in game_cards.items()},
    'topCardsByPlayer': {},
    'actionCardDraftsByPlayer': {},
    'actionCardDraftLevelsByPlayer': {},
    'actionCardDraftLevelsByGame': {}
}

for player in tracked_players:
    if player not in player_cards:
        continue

    cards = [(name, count) for name, count in player_cards[player].items() if count >= 2]
    cards.sort(key=lambda x: -x[1])
    output['topCardsByPlayer'][player] = [{'card': name, 'plays': count} for name, count in cards]

for player in tracked_players:
    if player in player_action_drafts:
        output['actionCardDraftsByPlayer'][player] = dict(player_action_drafts[player])
    if player in player_action_draft_levels:
        output['actionCardDraftLevelsByPlayer'][player] = {
            card: dict(levels)
            for card, levels in player_action_draft_levels[player].items()
        }

output['actionCardDraftLevelsByGame'] = {
    table_id: {
        player: {card: dict(levels) for card, levels in cards.items()}
        for player, cards in players.items()
    }
    for table_id, players in game_action_draft_levels.items()
}

with open('./docs/data/card_analysis.json', 'w') as f:
    json.dump(output, f, indent=2)

print('Full analysis saved to docs/data/card_analysis.json')
