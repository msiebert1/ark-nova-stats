// ==UserScript==
// @name         BGA Ark Nova Stats Collector
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Auto-collect Ark Nova game stats from BGA
// @match        https://boardgamearena.com/*
// @match        https://*.boardgamearena.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'arkNovaGames';
    const QUEUE_KEY = 'arkNovaQueue';
    const INDEX_KEY = 'arkNovaIndex';
    const RUNNING_KEY = 'arkNovaRunning';
    const EXISTING_IDS_KEY = 'arkNovaExistingIds';

    // URL to fetch existing games from GitHub Pages
    const GAMES_JSON_URL = 'https://msiebert1.github.io/ark-nova-stats/data/detailed_games.json';

    // Add control button to page
    function addControlButton() {
        const btn = document.createElement('button');
        btn.id = 'ark-nova-collector-btn';
        btn.innerHTML = '🦁 Collect';
        btn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:999999;padding:10px 15px;background:#2d5a27;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:bold;';
        btn.onclick = handleButtonClick;
        document.body.appendChild(btn);
        updateButtonState();
    }

    function updateButtonState() {
        const btn = document.getElementById('ark-nova-collector-btn');
        if (!btn) return;

        const isRunning = localStorage.getItem(RUNNING_KEY) === 'true';
        const games = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        const index = parseInt(localStorage.getItem(INDEX_KEY) || '0');

        if (isRunning && queue.length > 0) {
            btn.innerHTML = `🦁 ${index}/${queue.length}`;
            btn.style.background = '#e67e22';
        } else if (games.length > 0) {
            btn.innerHTML = `🦁 ${games.length} games`;
            btn.style.background = '#27ae60';
        } else {
            btn.innerHTML = '🦁 Collect';
            btn.style.background = '#2d5a27';
        }
    }

    function handleButtonClick() {
        const isRunning = localStorage.getItem(RUNNING_KEY) === 'true';

        if (isRunning) {
            // Stop collection
            if (confirm('Stop collection and export data?')) {
                localStorage.setItem(RUNNING_KEY, 'false');
                exportData();
            }
        } else {
            // Start or export
            const games = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            if (games.length > 0) {
                const choice = confirm(`You have ${games.length} games collected.\n\nOK = Export data\nCancel = Start new collection`);
                if (choice) {
                    exportData();
                } else {
                    startCollection();
                }
            } else {
                startCollection();
            }
        }
    }

    async function startCollection() {
        const isStatsPage = window.location.href.includes('/gamestats');

        if (!isStatsPage) {
            alert('Go to your gamestats page first:\nhttps://boardgamearena.com/gamestats?player=95147106&game=arknova');
            return;
        }

        const tableIds = [...new Set(
            [...document.querySelectorAll('a[href*="table="]')]
            .map(a => a.href.match(/table=(\d+)/)?.[1])
            .filter(Boolean)
        )];

        if (tableIds.length === 0) {
            alert('No games found! Make sure Ark Nova games are visible on the page.');
            return;
        }

        // Fetch existing game IDs from GitHub Pages
        let existingIds = [];
        try {
            const response = await fetch(GAMES_JSON_URL + '?t=' + Date.now());
            if (response.ok) {
                const data = await response.json();
                existingIds = (data.games || []).map(function(g) { return g.tableId; });
                console.log('[Ark Nova] Found ' + existingIds.length + ' existing games on GitHub Pages');
            }
        } catch (e) {
            console.log('[Ark Nova] Could not fetch existing games, will collect all:', e);
        }

        // Filter out already collected games
        const newTableIds = tableIds.filter(function(id) {
            return existingIds.indexOf(id) === -1;
        });

        if (newTableIds.length === 0) {
            alert('No new games to collect! All ' + tableIds.length + ' games already in database.');
            return;
        }

        localStorage.setItem(QUEUE_KEY, JSON.stringify(newTableIds));
        localStorage.setItem(INDEX_KEY, '0');
        localStorage.setItem(STORAGE_KEY, '[]');
        localStorage.setItem(RUNNING_KEY, 'true');
        localStorage.setItem(EXISTING_IDS_KEY, JSON.stringify(existingIds));

        alert('Found ' + newTableIds.length + ' NEW games to collect (skipping ' + existingIds.length + ' existing).\n\nClick the button anytime to stop and export.');

        window.location.href = 'https://boardgamearena.com/table?table=' + newTableIds[0];
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

    async function collectCurrentGame() {
        const tableId = new URL(window.location.href).searchParams.get('table');
        if (!tableId) return;

        // Wait for stats table
        let attempts = 0;
        while (attempts < 30) {
            if (document.querySelector('table.statstable tr')) break;
            await new Promise(r => setTimeout(r, 500));
            attempts++;
        }

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

            // Extract game date
            const date = extractGameDate();

            games.push({ tableId, url: window.location.href, players, stats, date });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
            console.log(`[Ark Nova] Collected game ${tableId} (${date || 'no date'}). Total: ${games.length}`);
        }

        // Move to next
        const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        let index = parseInt(localStorage.getItem(INDEX_KEY) || '0') + 1;
        localStorage.setItem(INDEX_KEY, index.toString());

        updateButtonState();

        if (index < queue.length) {
            await new Promise(r => setTimeout(r, 1000));
            window.location.href = 'https://boardgamearena.com/table?table=' + queue[index];
        } else {
            localStorage.setItem(RUNNING_KEY, 'false');
            alert(`Done! Collected ${games.length} games.\n\nClick the button to export.`);
        }
    }

    function exportData() {
        const games = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const output = {
            exportedAt: new Date().toISOString(),
            totalGames: games.length,
            games: games
        };

        const json = JSON.stringify(output, null, 2);

        // Copy to clipboard
        navigator.clipboard.writeText(json).then(() => {
            alert(`Exported ${games.length} games!\n\nJSON copied to clipboard.`);
        }).catch(() => {
            console.log(json);
            alert(`Exported ${games.length} games!\n\nCheck console for JSON (Cmd+Option+J)`);
        });
    }

    // Initialize
    setTimeout(() => {
        addControlButton();

        // Auto-collect if running and on a game page
        const isRunning = localStorage.getItem(RUNNING_KEY) === 'true';
        const isGamePage = window.location.href.includes('/table?table=');

        if (isRunning && isGamePage) {
            collectCurrentGame();
        }
    }, 1000);

})();
