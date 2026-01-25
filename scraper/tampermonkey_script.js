// ==UserScript==
// @name         BGA Ark Nova Stats Collector
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Collect Ark Nova game stats from BGA - works on individual game pages
// @match        https://boardgamearena.com/*
// @match        https://*.boardgamearena.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'arkNovaGames';
    const GAMES_JSON_URL = 'https://msiebert1.github.io/ark-nova-stats/data/detailed_games.json';

    let existingIds = new Set();
    let isLoading = false;

    // Fetch existing game IDs from GitHub Pages
    async function loadExistingIds() {
        try {
            const response = await fetch(GAMES_JSON_URL + '?t=' + Date.now());
            if (response.ok) {
                const data = await response.json();
                existingIds = new Set((data.games || []).map(g => g.tableId));
                console.log('[Ark Nova Stats] Loaded ' + existingIds.size + ' existing games from GitHub');
            }
        } catch (e) {
            console.log('[Ark Nova Stats] Could not fetch existing games:', e);
        }
    }

    function addButton() {
        const isGamePage = window.location.href.includes('/table?table=');
        const tableId = isGamePage ? new URL(window.location.href).searchParams.get('table') : null;

        const btn = document.createElement('button');
        btn.id = 'ark-nova-stats-btn';
        btn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:999999;padding:10px 15px;background:#2d5a27;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:bold;font-size:14px;';
        document.body.appendChild(btn);

        // Check for collected games in localStorage
        const collected = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

        if (collected.length > 0) {
            btn.innerHTML = `🦁 Export ${collected.length}`;
            btn.style.background = '#27ae60';
            btn.onclick = exportData;
        } else if (isGamePage && tableId) {
            updateButtonForGame(btn, tableId);
        } else {
            btn.innerHTML = '🦁 Stats';
            btn.style.background = '#666';
            btn.onclick = () => alert('Go to a game table page to collect stats.\n\nExample: boardgamearena.com/table?table=794739898');
        }
    }

    async function updateButtonForGame(btn, tableId) {
        btn.innerHTML = '🦁 Checking...';
        btn.style.background = '#666';

        await loadExistingIds();

        if (existingIds.has(tableId)) {
            btn.innerHTML = '🦁 Already logged';
            btn.style.background = '#666';
            btn.onclick = () => alert('Game ' + tableId + ' is already in the database.');
        } else {
            btn.innerHTML = '🦁 Collect This Game';
            btn.style.background = '#2d5a27';
            btn.onclick = () => collectGame(tableId, btn);
        }
    }

    async function collectGame(tableId, btn) {
        btn.innerHTML = '🦁 Collecting...';
        btn.style.background = '#e67e22';

        // Wait for stats table
        let attempts = 0;
        while (attempts < 30) {
            if (document.querySelector('table.statstable tr')) break;
            await new Promise(r => setTimeout(r, 500));
            attempts++;
        }

        const rows = [...document.querySelectorAll('table.statstable tr')];

        if (rows.length === 0) {
            btn.innerHTML = '🦁 No stats found';
            btn.style.background = '#c0392b';
            return;
        }

        const data = rows.map(r => [...r.querySelectorAll('td,th')].map(c => c.innerText.trim()));
        const players = data[0].slice(1);
        const stats = {};

        for (let i = 1; i < data.length; i++) {
            const statName = data[i][0];
            if (!statName || statName === 'All stats') continue;
            stats[statName] = {};
            players.forEach((p, j) => stats[statName][p] = data[i][j + 1] || '');
        }

        const date = extractGameDate();

        const game = { tableId, url: window.location.href, players, stats, date };

        // Add to localStorage
        const collected = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (!collected.find(g => g.tableId === tableId)) {
            collected.push(game);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(collected));
        }

        btn.innerHTML = `🦁 Export ${collected.length}`;
        btn.style.background = '#27ae60';
        btn.onclick = exportData;

        console.log('[Ark Nova Stats] Collected game ' + tableId);
    }

    function extractGameDate() {
        const bodyText = document.body.innerText;

        const createdMatch = bodyText.match(/Created\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
        if (createdMatch) {
            const [, m, d, y] = createdMatch;
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }

        const dateMatch = bodyText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dateMatch) {
            const [, m, d, y] = dateMatch;
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }

        return null;
    }

    function exportData() {
        const games = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

        if (games.length === 0) {
            alert('No games to export.');
            return;
        }

        const output = {
            exportedAt: new Date().toISOString(),
            totalGames: games.length,
            games: games
        };

        const json = JSON.stringify(output, null, 2);

        navigator.clipboard.writeText(json).then(() => {
            const clear = confirm(`Exported ${games.length} game(s)!\n\nJSON copied to clipboard.\n\nClear collected games from storage?`);
            if (clear) {
                localStorage.removeItem(STORAGE_KEY);
                location.reload();
            }
        }).catch(() => {
            console.log(json);
            alert(`Exported ${games.length} game(s)!\n\nCheck console for JSON (Cmd+Option+J)`);
        });
    }

    // Initialize
    setTimeout(addButton, 1000);
})();
