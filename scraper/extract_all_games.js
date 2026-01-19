// Run this on https://boardgamearena.com/gamestats?player=YOUR_ID&game=arknova
// Make sure all your games are loaded on the page first (scroll down to load more if needed)

(async function() {
    // Get all table IDs from the current page
    const tableIds = [...new Set([...document.querySelectorAll('a[href*="table="]')].map(a => a.href.match(/table=(\d+)/)?.[1]).filter(Boolean))];
    console.log(`Found ${tableIds.length} games to process...`);

    if (tableIds.length === 0) {
        alert('No games found! Make sure you are on the gamestats page with Ark Nova games visible.');
        return;
    }

    const allGames = [];

    for (let i = 0; i < tableIds.length; i++) {
        const tableId = tableIds[i];
        console.log(`Processing game ${i + 1}/${tableIds.length}: ${tableId}`);

        try {
            // Fetch the table page
            const response = await fetch(`https://boardgamearena.com/table?table=${tableId}`, {
                credentials: 'include'
            });
            const html = await response.text();

            // Parse the HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Extract stats table
            const rows = [...doc.querySelectorAll('table.statstable tr')];
            if (rows.length === 0) {
                console.log(`  No stats table found for ${tableId}`);
                continue;
            }

            // Parse into structured data
            const data = rows.map(r => [...r.querySelectorAll('td,th')].map(c => c.innerText.trim()));

            // First row has player names
            const players = data[0].slice(1); // Skip empty first cell

            // Build game object
            const game = {
                tableId: tableId,
                url: `https://boardgamearena.com/table?table=${tableId}`,
                players: players,
                stats: {}
            };

            // Process each stat row
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

            allGames.push(game);

            // Small delay to avoid overwhelming the server
            await new Promise(r => setTimeout(r, 500));

        } catch (err) {
            console.error(`Error processing ${tableId}:`, err);
        }
    }

    console.log(`\nCompleted! Processed ${allGames.length} games.`);

    // Output the data
    const output = {
        exportedAt: new Date().toISOString(),
        totalGames: allGames.length,
        games: allGames
    };

    const json = JSON.stringify(output, null, 2);

    // Copy to clipboard
    await navigator.clipboard.writeText(json);
    console.log('JSON copied to clipboard!');

    // Also log it
    console.log(json);

    alert(`Done! Extracted ${allGames.length} games.\n\nJSON has been copied to clipboard.\nPaste it into a file to save.`);
})();
