/**
 * BGA Ark Nova Stats Exporter Bookmarklet
 *
 * HOW TO USE:
 * 1. Go to https://boardgamearena.com/gamestats?player=YOUR_PLAYER_ID&game=1&finished=1
 *    (Or navigate: Profile > Statistics > Filter by Ark Nova)
 * 2. Run this bookmarklet
 * 3. Copy the JSON output and save to data/games.json
 *
 * To create the bookmarklet:
 * 1. Create a new bookmark in your browser
 * 2. Name it "Export BGA Ark Nova Stats"
 * 3. For the URL, paste the minified version (see bookmarklet-minified.txt)
 */

(function() {
    'use strict';

    const GAME_NAME = 'arknova';

    // Map code to readable names (based on Ark Nova maps)
    const MAP_NAMES = {
        '0': 'Map A (Basic)',
        '1': 'Map 0',
        '2': 'Plan 1',
        '3': 'Plan 2',
        '4': 'Plan 3',
        '5': 'Plan 4',
        '6': 'Plan 5',
        '7': 'Plan 6',
        '8': 'Plan 7',
        '9': 'Plan 8',
        'default': 'Unknown Map'
    };

    function getMapName(mapId) {
        return MAP_NAMES[String(mapId)] || MAP_NAMES['default'];
    }

    function parseDate(timestamp) {
        if (!timestamp) return 'Unknown';
        const date = new Date(timestamp * 1000);
        return date.toISOString().split('T')[0];
    }

    function extractGamesFromPage() {
        const games = [];

        // Try to find game data in the page
        // BGA loads data dynamically, so we look for table rows or data attributes

        // Method 1: Look for gamestat table rows
        const rows = document.querySelectorAll('.gamestat_row, .gametable_row, tr[id*="table_"]');

        rows.forEach(row => {
            try {
                const tableId = row.id?.replace('table_', '') ||
                               row.dataset?.tableId ||
                               row.querySelector('[data-table-id]')?.dataset?.tableId;

                if (!tableId) return;

                // Extract player data
                const playerElements = row.querySelectorAll('.gamestat_player, .player_in_table');
                const players = [];

                playerElements.forEach((el, index) => {
                    const name = el.querySelector('.playername, .player_name')?.textContent?.trim() ||
                                el.textContent?.trim();
                    const scoreEl = el.querySelector('.gamestat_score, .score');
                    const score = scoreEl ? parseInt(scoreEl.textContent) || 0 : 0;
                    const rankEl = el.querySelector('.gamestat_rank, .rank');
                    const rank = rankEl ? parseInt(rankEl.textContent) || (index + 1) : (index + 1);

                    if (name) {
                        players.push({ name, score, rank });
                    }
                });

                // Extract date
                const dateEl = row.querySelector('.gamestat_date, .table_date, [data-date]');
                const date = dateEl?.dataset?.date || dateEl?.textContent?.trim() || 'Unknown';

                // Extract map (if available)
                const mapEl = row.querySelector('.gamestat_option, [data-map]');
                const map = mapEl?.textContent?.trim() || 'Unknown';

                if (players.length > 0) {
                    games.push({
                        id: tableId,
                        date: date,
                        map: map,
                        turns: 0, // Not always available from list view
                        players: players.sort((a, b) => a.rank - b.rank),
                        url: `https://boardgamearena.com/table?table=${tableId}`
                    });
                }
            } catch (e) {
                console.error('Error parsing row:', e);
            }
        });

        return games;
    }

    async function fetchGamesFromAPI() {
        // Try to fetch from BGA API directly
        const games = [];

        try {
            // Get current player ID from page if possible
            const playerMatch = window.location.href.match(/player=(\d+)/);
            const playerId = playerMatch?.[1] || '';

            const response = await fetch(
                `https://boardgamearena.com/gamestats/gamestats/getGames.html?game=${GAME_NAME}&finished=1&limit=100${playerId ? '&player=' + playerId : ''}`,
                { credentials: 'include' }
            );

            if (!response.ok) throw new Error('API request failed');

            const data = await response.json();

            if (data.status === '1' && data.data?.tables) {
                for (const table of data.data.tables) {
                    const players = [];
                    const playerData = table.players || table.player || {};

                    if (typeof playerData === 'object') {
                        for (const [pid, pinfo] of Object.entries(playerData)) {
                            players.push({
                                name: pinfo.name || pinfo.fullname || `Player_${pid}`,
                                score: parseInt(pinfo.score) || 0,
                                rank: parseInt(pinfo.rank || pinfo.gamerank) || 0
                            });
                        }
                    }

                    players.sort((a, b) => a.rank - b.rank);

                    // Parse date
                    let dateStr = 'Unknown';
                    const endDate = table.end || table.end_date;
                    if (endDate) {
                        if (typeof endDate === 'number' || /^\d+$/.test(endDate)) {
                            dateStr = new Date(parseInt(endDate) * 1000).toISOString().split('T')[0];
                        } else {
                            dateStr = String(endDate).slice(0, 10);
                        }
                    }

                    // Get map from options
                    let mapName = 'Unknown';
                    if (table.options) {
                        for (const [key, value] of Object.entries(table.options)) {
                            if (key.toLowerCase().includes('map') || key.toLowerCase().includes('plan')) {
                                mapName = getMapName(value);
                                break;
                            }
                        }
                    }

                    if (players.length > 0) {
                        games.push({
                            id: String(table.table_id || table.id),
                            date: dateStr,
                            map: mapName,
                            turns: parseInt(table.gameresult?.turns || table.gameresult?.round || 0),
                            players: players,
                            url: `https://boardgamearena.com/table?table=${table.table_id || table.id}`
                        });
                    }
                }
            }
        } catch (e) {
            console.error('API fetch failed:', e);
        }

        return games;
    }

    async function exportStats() {
        let games = [];

        // Try API first
        console.log('Attempting to fetch from BGA API...');
        games = await fetchGamesFromAPI();

        // Fall back to page scraping if API didn't work
        if (games.length === 0) {
            console.log('API fetch returned no results, trying page scrape...');
            games = extractGamesFromPage();
        }

        if (games.length === 0) {
            alert('No Ark Nova games found!\n\nMake sure you are:\n1. Logged into BGA\n2. On your game statistics page\n3. Have Ark Nova games in your history');
            return;
        }

        const output = {
            lastUpdated: new Date().toISOString(),
            games: games
        };

        const json = JSON.stringify(output, null, 2);

        // Create a modal to display the JSON
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            max-width: 800px;
            max-height: 80vh;
            overflow: auto;
            width: 100%;
        `;

        content.innerHTML = `
            <h2 style="margin: 0 0 10px 0; color: #2d5a27;">Ark Nova Stats Export</h2>
            <p style="color: #666;">Found ${games.length} games. Copy the JSON below and save to <code>data/games.json</code></p>
            <textarea id="bga-export-json" style="width: 100%; height: 300px; font-family: monospace; font-size: 12px; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">${json}</textarea>
            <div style="margin-top: 10px; display: flex; gap: 10px;">
                <button id="bga-copy-btn" style="padding: 10px 20px; background: #2d5a27; color: white; border: none; border-radius: 4px; cursor: pointer;">Copy to Clipboard</button>
                <button id="bga-download-btn" style="padding: 10px 20px; background: #4a8c3f; color: white; border: none; border-radius: 4px; cursor: pointer;">Download JSON</button>
                <button id="bga-close-btn" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Copy button
        document.getElementById('bga-copy-btn').onclick = () => {
            const textarea = document.getElementById('bga-export-json');
            textarea.select();
            document.execCommand('copy');
            alert('Copied to clipboard!');
        };

        // Download button
        document.getElementById('bga-download-btn').onclick = () => {
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'games.json';
            a.click();
            URL.revokeObjectURL(url);
        };

        // Close button
        document.getElementById('bga-close-btn').onclick = () => {
            modal.remove();
        };

        // Close on backdrop click
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }

    // Run the export
    exportStats();
})();
