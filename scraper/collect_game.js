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

    // Extract game date from the page
    function extractGameDate() {
        const bodyText = document.body.innerText;

        // Method 1: Look for "Created MM/DD/YYYY" pattern (BGA format)
        const createdMatch = bodyText.match(/Created\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
        if (createdMatch) {
            const [, m, d, y] = createdMatch;
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }

        // Method 2: Look for any MM/DD/YYYY pattern
        const dateMatch = bodyText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dateMatch) {
            const [, m, d, y] = dateMatch;
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }

        // Method 3: Look for month name patterns (e.g., "Jan 15, 2026")
        const monthMatch = bodyText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i);
        if (monthMatch) {
            const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                            jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
            const m = months[monthMatch[1].toLowerCase().slice(0, 3)];
            const d = monthMatch[2].padStart(2, '0');
            const y = monthMatch[3];
            return `${y}-${m}-${d}`;
        }

        return null;
    }

    const data = rows.map(r => [...r.querySelectorAll('td,th')].map(c => c.innerText.trim()));
    const players = data[0].slice(1);
    const date = extractGameDate();

    const game = {
        tableId: tableId,
        url: window.location.href,
        players: players,
        stats: {},
        date: date
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
