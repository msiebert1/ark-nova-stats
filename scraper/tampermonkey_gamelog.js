// ==UserScript==
// @name         BGA Ark Nova Game Log Collector
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Collect Ark Nova game logs from BGA game review pages
// @match        https://boardgamearena.com/*
// @match        https://*.boardgamearena.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'arkNovaGameLogs';
    const QUEUE_KEY = 'arkNovaLogQueue';
    const INDEX_KEY = 'arkNovaLogIndex';
    const RUNNING_KEY = 'arkNovaLogRunning';

    // URL to fetch existing game logs from GitHub Pages
    const LOGS_JSON_URL = 'https://msiebert1.github.io/ark-nova-stats/data/detailed_game_logs.json';

    // Add control button to page
    function addControlButton() {
        const btn = document.createElement('button');
        btn.id = 'ark-nova-log-btn';
        btn.innerHTML = '📜 Logs';
        btn.style.cssText = 'position:fixed;top:10px;right:120px;z-index:999999;padding:10px 15px;background:#5a272d;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:bold;';
        btn.onclick = handleButtonClick;
        document.body.appendChild(btn);
        updateButtonState();
    }

    function updateButtonState() {
        const btn = document.getElementById('ark-nova-log-btn');
        if (!btn) return;

        const isRunning = localStorage.getItem(RUNNING_KEY) === 'true';
        const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        const index = parseInt(localStorage.getItem(INDEX_KEY) || '0');

        if (isRunning && queue.length > 0) {
            btn.innerHTML = `📜 ${index}/${queue.length}`;
            btn.style.background = '#e67e22';
        } else if (logs.length > 0) {
            btn.innerHTML = `📜 ${logs.length} logs`;
            btn.style.background = '#27ae60';
        } else {
            btn.innerHTML = '📜 Logs';
            btn.style.background = '#5a272d';
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
            const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            if (logs.length > 0) {
                const choice = confirm(`You have ${logs.length} game logs collected.\n\nOK = Export data\nCancel = Start new collection`);
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

        // Fetch existing log IDs from GitHub Pages
        let existingIds = [];
        try {
            const response = await fetch(LOGS_JSON_URL + '?t=' + Date.now());
            if (response.ok) {
                const data = await response.json();
                existingIds = (data.logs || []).map(function(g) { return g.tableId; });
                console.log('[Ark Nova Logs] Found ' + existingIds.length + ' existing logs on GitHub Pages');
            }
        } catch (e) {
            console.log('[Ark Nova Logs] Could not fetch existing logs, will collect all:', e);
        }

        // Filter out already collected games
        const newTableIds = tableIds.filter(function(id) {
            return existingIds.indexOf(id) === -1;
        });

        if (newTableIds.length === 0) {
            alert('No new games to collect! All ' + tableIds.length + ' game logs already in database.');
            return;
        }

        localStorage.setItem(QUEUE_KEY, JSON.stringify(newTableIds));
        localStorage.setItem(INDEX_KEY, '0');
        localStorage.setItem(STORAGE_KEY, '[]');
        localStorage.setItem(RUNNING_KEY, 'true');

        alert('Found ' + newTableIds.length + ' NEW games to collect (skipping ' + existingIds.length + ' existing).\n\nClick the button anytime to stop and export.');

        window.location.href = 'https://boardgamearena.com/gamereview?table=' + newTableIds[0];
    }

    async function collectCurrentGameLog() {
        const tableId = new URL(window.location.href).searchParams.get('table');
        if (!tableId) return;

        // Wait for game log to load
        let attempts = 0;
        while (attempts < 60) {
            var testContainer = document.querySelector('.bga-link-inside');
            if (testContainer && /Move \d+/.test(testContainer.innerText)) break;
            await new Promise(r => setTimeout(r, 500));
            attempts++;
        }

        let logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

        if (!logs.find(g => g.tableId === tableId)) {
            const logEntries = [];

            // Find the container with game log entries
            var container = null;
            document.querySelectorAll('div.pagesection__content').forEach(function(d) {
                if (d.innerText && d.innerText.indexOf('Move 1') !== -1) container = d;
            });

            if (container) {
                var inner = container.querySelector('.bga-link-inside');
                if (inner) {
                    var children = inner.children;
                    var currentMove = null;
                    var currentActions = [];

                    for (var i = 0; i < children.length; i++) {
                        var child = children[i];
                        var className = child.className || '';

                        // Check if this is a move header
                        if (className.indexOf('smalltext') !== -1) {
                            var text = child.innerText.trim();
                            var moveMatch = text.match(/^Move (\d+)/);

                            if (moveMatch) {
                                // Save previous move if exists
                                if (currentMove !== null) {
                                    logEntries.push({
                                        moveNumber: currentMove,
                                        actions: currentActions
                                    });
                                }

                                // Start new move
                                currentMove = parseInt(moveMatch[1]);
                                currentActions = [];
                            }
                        }
                        // Check if this is an action entry
                        else if (className.indexOf('gamelogreview') !== -1) {
                            var actionText = child.innerText.trim();
                            if (actionText) {
                                currentActions.push(actionText);
                            }
                        }
                    }

                    // Save last move
                    if (currentMove !== null) {
                        logEntries.push({
                            moveNumber: currentMove,
                            actions: currentActions
                        });
                    }
                }
            }

            // Sort by move number
            logEntries.sort(function(a, b) { return a.moveNumber - b.moveNumber; });

            // Get player info from the legend
            const players = [];
            var legendDiv = document.getElementById('legend1');
            if (legendDiv) {
                var labels = legendDiv.querySelectorAll('.dojoxLegendText');
                labels.forEach(function(el) {
                    var name = el.innerText.trim();
                    if (name && players.indexOf(name) === -1) {
                        players.push(name);
                    }
                });
            }

            logs.push({
                tableId: tableId,
                url: window.location.href,
                collectedAt: new Date().toISOString(),
                players: players,
                logEntries: logEntries,
                moveCount: logEntries.length
            });

            localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
            console.log('[Ark Nova Logs] Collected game ' + tableId + '. Moves: ' + logEntries.length + '. Total logs: ' + logs.length);
        }

        // Move to next
        const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        let index = parseInt(localStorage.getItem(INDEX_KEY) || '0') + 1;
        localStorage.setItem(INDEX_KEY, index.toString());

        updateButtonState();

        if (index < queue.length) {
            await new Promise(r => setTimeout(r, 2000));
            window.location.href = 'https://boardgamearena.com/gamereview?table=' + queue[index];
        } else {
            localStorage.setItem(RUNNING_KEY, 'false');
            alert('Done! Collected ' + logs.length + ' game logs.\n\nClick the button to export.');
        }
    }

    function exportData() {
        const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const output = {
            exportedAt: new Date().toISOString(),
            totalLogs: logs.length,
            logs: logs
        };

        const json = JSON.stringify(output, null, 2);

        // Copy to clipboard
        navigator.clipboard.writeText(json).then(() => {
            alert(`Exported ${logs.length} game logs!\n\nJSON copied to clipboard.\n\nPaste into a file to save.`);
        }).catch(() => {
            console.log(json);
            alert(`Exported ${logs.length} game logs!\n\nCheck console for JSON (Cmd+Option+J)`);
        });
    }

    // Initialize
    setTimeout(() => {
        addControlButton();

        // Auto-collect if running and on a gamereview page
        const isRunning = localStorage.getItem(RUNNING_KEY) === 'true';
        const isReviewPage = window.location.href.includes('/gamereview?table=');

        if (isRunning && isReviewPage) {
            collectCurrentGameLog();
        }
    }, 1000);

})();
