// STEP 1: Run this on the gamestats page first to start
// STEP 2: It will auto-navigate through each game and collect stats
// STEP 3: When done, it will show the JSON to copy

(async function() {
    const STORAGE_KEY = 'arkNovaGames';
    const QUEUE_KEY = 'arkNovaQueue';
    const INDEX_KEY = 'arkNovaIndex';

    const isGamePage = window.location.href.includes('/table?table=');
    const isStatsPage = window.location.href.includes('/gamestats');

    if (isStatsPage) {
        // Initialize: get all game IDs and start
        const tableIds = [...new Set(
            [...document.querySelectorAll('a[href*="table="]')]
            .map(a => a.href.match(/table=(\d+)/)?.[1])
            .filter(Boolean)
        )];

        if (tableIds.length === 0) {
            alert('No games found!');
            return;
        }

        localStorage.setItem(QUEUE_KEY, JSON.stringify(tableIds));
        localStorage.setItem(INDEX_KEY, '0');
        localStorage.setItem(STORAGE_KEY, '[]');

        alert(`Found ${tableIds.length} games. Click OK to start auto-collection.\n\nDO NOT close or navigate away - the script will handle everything.`);

        // Go to first game
        window.location.href = 'https://boardgamearena.com/table?table=' + tableIds[0];

    } else if (isGamePage) {
        // Wait for stats table to appear
        let attempts = 0;
        while (attempts < 30) {
            if (document.querySelector('table.statstable tr')) break;
            await new Promise(r => setTimeout(r, 500));
            attempts++;
            console.log('Waiting for stats... attempt ' + attempts);
        }

        // Collect stats
        const tableId = new URL(window.location.href).searchParams.get('table');
        const rows = [...document.querySelectorAll('table.statstable tr')];

        let games = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

        if (rows.length > 0 && !games.find(g => g.tableId === tableId)) {
            const data = rows.map(r => [...r.querySelectorAll('td,th')].map(c => c.innerText.trim()));
            const players = data[0].slice(1);
            const stats = {};

            for (let i = 1; i < data.length; i++) {
                const statName = data[i][0];
                if (!statName || statName === 'All stats') continue;
                stats[statName] = {};
                players.forEach((p, j) => stats[statName][p] = data[i][j + 1] || '');
            }

            games.push({ tableId, url: window.location.href, players, stats });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
            console.log(`Collected game ${tableId}. Total: ${games.length}`);
        } else {
            console.log(rows.length === 0 ? 'No stats found' : 'Already collected');
        }

        // Move to next game
        const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        let index = parseInt(localStorage.getItem(INDEX_KEY) || '0') + 1;
        localStorage.setItem(INDEX_KEY, index.toString());

        if (index < queue.length) {
            console.log(`Going to game ${index + 1}/${queue.length}`);
            window.location.href = 'https://boardgamearena.com/table?table=' + queue[index];
        } else {
            // DONE - show results
            const finalGames = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            const output = JSON.stringify({
                exportedAt: new Date().toISOString(),
                totalGames: finalGames.length,
                games: finalGames
            }, null, 2);

            console.log('=== COLLECTION COMPLETE ===');
            console.log(output);

            // Try to copy to clipboard
            try {
                await navigator.clipboard.writeText(output);
                alert(`Done! Collected ${finalGames.length} games.\n\nJSON copied to clipboard - paste into a file.`);
            } catch(e) {
                alert(`Done! Collected ${finalGames.length} games.\n\nCheck console for JSON output.`);
            }
        }
    } else {
        alert('Please run this on either:\n- Your gamestats page\n- A game table page');
    }
})();
