// Run this on each game page (https://boardgamearena.com/table?table=XXXX)
// It will add the game stats to localStorage

(function() {
    const tableId = new URL(window.location.href).searchParams.get('table');
    if (!tableId) {
        alert('Not on a game page!');
        return;
    }

    const rows = [...document.querySelectorAll('table.statstable tr')];
    if (rows.length === 0) {
        alert('No stats table found! Make sure the game has finished loading.');
        return;
    }

    const data = rows.map(r => [...r.querySelectorAll('td,th')].map(c => c.innerText.trim()));
    const players = data[0].slice(1);

    const game = {
        tableId: tableId,
        url: window.location.href,
        players: players,
        stats: {}
    };

    for (let j = 1; j < data.length; j++) {
        const row = data[j];
        const statName = row[0];
        if (!statName || statName === 'All stats') continue;

        const values = row.slice(1);
        game.stats[statName] = {};
        players.forEach((player, idx) => {
            game.stats[statName][player] = values[idx] || '';
        });
    }

    // Add to storage
    let games = JSON.parse(localStorage.getItem('arkNovaGames') || '[]');

    // Check if already collected
    if (games.some(g => g.tableId === tableId)) {
        console.log('Game already collected:', tableId);
    } else {
        games.push(game);
        localStorage.setItem('arkNovaGames', JSON.stringify(games));
        console.log(`Game ${tableId} collected! Total: ${games.length} games`);
    }
})();
