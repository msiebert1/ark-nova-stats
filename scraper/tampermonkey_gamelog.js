// ==UserScript==
// @name         BGA Ark Nova Game Log Collector
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Collect Ark Nova game logs from BGA - works on individual game review pages
// @match        https://boardgamearena.com/*
// @match        https://*.boardgamearena.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'arkNovaGameLogs';
    const LOGS_JSON_URL = 'https://msiebert1.github.io/ark-nova-stats/data/detailed_game_logs.json';

    let existingIds = new Set();

    // Fetch existing log IDs from GitHub Pages
    async function loadExistingIds() {
        try {
            const response = await fetch(LOGS_JSON_URL + '?t=' + Date.now());
            if (response.ok) {
                const data = await response.json();
                existingIds = new Set((data.logs || []).map(g => g.tableId));
                console.log('[Ark Nova Logs] Loaded ' + existingIds.size + ' existing logs from GitHub');
            }
        } catch (e) {
            console.log('[Ark Nova Logs] Could not fetch existing logs:', e);
        }
    }

    function addButton() {
        const isReviewPage = window.location.href.includes('/gamereview?table=');
        const tableId = isReviewPage ? new URL(window.location.href).searchParams.get('table') : null;

        const btn = document.createElement('button');
        btn.id = 'ark-nova-logs-btn';
        btn.style.cssText = 'position:fixed;top:10px;right:120px;z-index:999999;padding:10px 15px;background:#5a272d;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:bold;font-size:14px;';
        document.body.appendChild(btn);

        // Check for collected logs in localStorage
        const collected = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

        if (collected.length > 0) {
            btn.innerHTML = `📜 Export ${collected.length}`;
            btn.style.background = '#27ae60';
            btn.onclick = exportData;
        } else if (isReviewPage && tableId) {
            updateButtonForGame(btn, tableId);
        } else {
            btn.innerHTML = '📜 Logs';
            btn.style.background = '#666';
            btn.onclick = () => alert('Go to a game review page to collect logs.\n\nExample: boardgamearena.com/gamereview?table=794739898');
        }
    }

    async function updateButtonForGame(btn, tableId) {
        btn.innerHTML = '📜 Checking...';
        btn.style.background = '#666';

        await loadExistingIds();

        if (existingIds.has(tableId)) {
            btn.innerHTML = '📜 Already logged';
            btn.style.background = '#666';
            btn.onclick = () => alert('Game ' + tableId + ' log is already in the database.');
        } else {
            btn.innerHTML = '📜 Collect This Log';
            btn.style.background = '#5a272d';
            btn.onclick = () => collectLog(tableId, btn);
        }
    }

    async function collectLog(tableId, btn) {
        btn.innerHTML = '📜 Collecting...';
        btn.style.background = '#e67e22';

        // Wait for game log to load
        let attempts = 0;
        while (attempts < 60) {
            const testContainer = document.querySelector('.bga-link-inside');
            if (testContainer && /Move \d+/.test(testContainer.innerText)) break;
            await new Promise(r => setTimeout(r, 500));
            attempts++;
        }

        const logEntries = [];

        // Find the container with game log entries
        let container = null;
        document.querySelectorAll('div.pagesection__content').forEach(d => {
            if (d.innerText && d.innerText.indexOf('Move 1') !== -1) container = d;
        });

        if (!container) {
            btn.innerHTML = '📜 No log found';
            btn.style.background = '#c0392b';
            return;
        }

        const inner = container.querySelector('.bga-link-inside');
        if (inner) {
            const children = inner.children;
            let currentMove = null;
            let currentActions = [];

            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                const className = child.className || '';

                if (className.indexOf('smalltext') !== -1) {
                    const text = child.innerText.trim();
                    const moveMatch = text.match(/^Move (\d+)/);

                    if (moveMatch) {
                        if (currentMove !== null) {
                            logEntries.push({
                                moveNumber: currentMove,
                                actions: currentActions
                            });
                        }
                        currentMove = parseInt(moveMatch[1]);
                        currentActions = [];
                    }
                } else if (className.indexOf('gamelogreview') !== -1) {
                    const actionText = child.innerText.trim();
                    if (actionText) {
                        currentActions.push(actionText);
                    }
                }
            }

            if (currentMove !== null) {
                logEntries.push({
                    moveNumber: currentMove,
                    actions: currentActions
                });
            }
        }

        logEntries.sort((a, b) => a.moveNumber - b.moveNumber);

        // Get player info from the legend
        const players = [];
        const legendDiv = document.getElementById('legend1');
        if (legendDiv) {
            legendDiv.querySelectorAll('.dojoxLegendText').forEach(el => {
                const name = el.innerText.trim();
                if (name && players.indexOf(name) === -1) {
                    players.push(name);
                }
            });
        }

        const log = {
            tableId: tableId,
            url: window.location.href,
            collectedAt: new Date().toISOString(),
            players: players,
            logEntries: logEntries,
            moveCount: logEntries.length
        };

        // Add to localStorage
        const collected = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (!collected.find(g => g.tableId === tableId)) {
            collected.push(log);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(collected));
        }

        btn.innerHTML = `📜 Export ${collected.length}`;
        btn.style.background = '#27ae60';
        btn.onclick = exportData;

        console.log('[Ark Nova Logs] Collected log ' + tableId + ' with ' + logEntries.length + ' moves');
    }

    function exportData() {
        const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

        if (logs.length === 0) {
            alert('No logs to export.');
            return;
        }

        const output = {
            exportedAt: new Date().toISOString(),
            totalLogs: logs.length,
            logs: logs
        };

        const json = JSON.stringify(output, null, 2);

        navigator.clipboard.writeText(json).then(() => {
            const clear = confirm(`Exported ${logs.length} log(s)!\n\nJSON copied to clipboard.\n\nClear collected logs from storage?`);
            if (clear) {
                localStorage.removeItem(STORAGE_KEY);
                location.reload();
            }
        }).catch(() => {
            console.log(json);
            alert(`Exported ${logs.length} log(s)!\n\nCheck console for JSON (Cmd+Option+J)`);
        });
    }

    // Initialize
    setTimeout(addButton, 1000);
})();
