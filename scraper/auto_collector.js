// AUTO COLLECTOR - Run this on the gamestats page
// It will open each game, collect stats, and move to the next one

(async function() {
    // Check if we're on a game page or gamestats page
    const tableId = new URL(window.location.href).searchParams.get('table');

    if (tableId) {
        // We're on a game page - collect stats and go to next
        await collectCurrentGame();
    } else {
        // We're on gamestats - start the collection process
        await startCollection();
    }

    async function startCollection() {
        const tableIds = [...new Set([...document.querySelectorAll('a[href*="table="]')]
            .map(a => a.href.match(/table=(\d+)/)?.[1])
            .filter(Boolean))];

        console.log(`Found ${tableIds.length} games`);

        // Store the list of games to process
        localStorage.setItem('arkNovaQueue', JSON.stringify(tableIds));
        localStorage.setItem('arkNovaGames', '[]');

        alert(`Found ${tableIds.length} games. Click OK to start collecting.\n\nThe script will open each game page. Just wait for it to load, then run this script again (or use bookmarklet).`);

        // Go to first game
        if (tableIds.length > 0) {
            window.location.href = `https://boardgamearena.com/table?table=${tableIds[0]}`;
        }
    }

    async function collectCurrentGame() {
        const tableId = new URL(window.location.href).searchParams.get('table');

        // Wait for stats table to load
        let attempts = 0;
        while (attempts < 20) {
            const rows = document.querySelectorAll('table.statstable tr');
            if (rows.length > 0) break;
            await new Promise(r => setTimeout(r, 500));
            attempts++;
        }

        const rows = [...document.querySelectorAll('table.statstable tr')];
        if (rows.length === 0) {
            console.log('No stats found, skipping...');
        } else {
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

            let games = JSON.parse(localStorage.getItem('arkNovaGames') || '[]');
            if (!games.some(g => g.tableId === tableId)) {
                games.push(game);
                localStorage.setItem('arkNovaGames', JSON.stringify(games));
            }
            console.log(`Collected game ${tableId}. Total: ${games.length}`);
        }

        // Get next game from queue
        let queue = JSON.parse(localStorage.getItem('arkNovaQueue') || '[]');
        const currentIndex = queue.indexOf(tableId);

        if (currentIndex >= 0 && currentIndex < queue.length - 1) {
            const nextId = queue[currentIndex + 1];
            console.log(`Going to next game: ${nextId}`);
            window.location.href = `https://boardgamearena.com/table?table=${nextId}`;
        } else {
            // Done!
            const games = JSON.parse(localStorage.getItem('arkNovaGames') || '[]');
            const output = {
                exportedAt: new Date().toISOString(),
                totalGames: games.length,
                games: games
            };
            console.log('COLLECTION COMPLETE!');
            console.log(JSON.stringify(output, null, 2));
            alert(`Done! Collected ${games.length} games.\n\nOpen console to copy the JSON data.`);
        }
    }
})();
