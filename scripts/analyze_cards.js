const fs = require('fs');

// Load game logs
const logsData = JSON.parse(fs.readFileSync('./docs/data/detailed_game_logs.json', 'utf8'));

// Track cards played per player
const playerCards = {};

// Track cards per game per player
const gameCards = {};

// Regex to match card plays
// Patterns:
// "[Player] plays [Card Name]"
// "[Player] plays [Card Name] for X and places it..."
const playPattern = /^(\w+) plays ([A-Z][^0-9]+?)(?:\s+for \d+|\s*$)/;

logsData.logs.forEach(game => {
    const tableId = game.tableId;
    gameCards[tableId] = {};

    game.players.forEach(player => {
        if (!playerCards[player]) playerCards[player] = {};
        if (!gameCards[tableId][player]) gameCards[tableId][player] = [];
    });

    game.logEntries.forEach(entry => {
        entry.actions.forEach(action => {
            const match = action.match(playPattern);
            if (match) {
                const player = match[1];
                let cardName = match[2].trim();

                // Clean up card name (remove trailing "for" if present)
                cardName = cardName.replace(/\s+for$/, '').trim();

                // Skip if it contains card_ (those are IDs, not names)
                if (cardName.includes('card_')) return;

                // Skip standard projects
                if (cardName.includes('standard project')) return;

                if (!playerCards[player]) playerCards[player] = {};
                playerCards[player][cardName] = (playerCards[player][cardName] || 0) + 1;

                if (gameCards[tableId] && gameCards[tableId][player]) {
                    gameCards[tableId][player].push(cardName);
                }
            }
        });
    });
});

// Output cards per game per player
console.log('=== CARDS PLAYED PER GAME ===\n');
Object.keys(gameCards).slice(0, 5).forEach(tableId => {
    console.log(`\nGame ${tableId}:`);
    Object.keys(gameCards[tableId]).forEach(player => {
        const cards = gameCards[tableId][player];
        if (cards.length > 0) {
            console.log(`  ${player}: ${cards.join(', ')}`);
        }
    });
});
console.log('\n... (showing first 5 games)\n');

// Output top 10 cards per player
console.log('\n=== TOP 10 MOST PLAYED CARDS PER PLAYER (min 2 plays) ===\n');

const trackedPlayers = ['msiebert', 'marksbrt', 'AstroHood', 'siebert23'];

trackedPlayers.forEach(player => {
    if (!playerCards[player]) return;

    const cards = Object.entries(playerCards[player])
        .filter(([name, count]) => count >= 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    console.log(`${player}:`);
    cards.forEach(([name, count], idx) => {
        console.log(`  ${idx + 1}. ${name} (${count} plays)`);
    });
    console.log('');
});

// Save full data to JSON
const output = {
    generatedAt: new Date().toISOString(),
    cardsPerGame: gameCards,
    topCardsByPlayer: {}
};

trackedPlayers.forEach(player => {
    if (!playerCards[player]) return;

    output.topCardsByPlayer[player] = Object.entries(playerCards[player])
        .filter(([name, count]) => count >= 1)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ card: name, plays: count }));
});

fs.writeFileSync('./docs/data/card_analysis.json', JSON.stringify(output, null, 2));
console.log('Full analysis saved to docs/data/card_analysis.json');
