// Ark Nova Stats App
(function() {
    'use strict';

    // Player configuration - only track games with these 4 players
    const TRACKED_PLAYERS = ['msiebert', 'marksbrt', 'AstroHood', 'siebert23'];
    const PLAYER_ALIASES = {
        'msiebert': 'Matt',
        'marksbrt': 'Mark',
        'AstroHood': 'Callie',
        'siebert23': 'Keith'
    };

    // Helper to get display name
    function getDisplayName(username) {
        return PLAYER_ALIASES[username] || username;
    }

    let gamesData = null;
    let allPlayers = new Set();
    let allMaps = new Set();

    // Check if game is a valid completed 4-player Ark Nova game with our tracked players
    function isValidGame(game) {
        if (game.players.length !== 4) return false;
        const gamePlayers = new Set(game.players);
        if (!TRACKED_PLAYERS.every(p => gamePlayers.has(p)) ||
            TRACKED_PLAYERS.length !== gamePlayers.size) {
            return false;
        }

        // Ensure it's an Ark Nova game (has Map stat)
        if (!game.stats['Map']) return false;

        // Ensure game is completed (has ranked results, not "not ranked")
        const results = game.stats['Game result'] || {};
        const hasValidResults = Object.values(results).every(r => !r.includes('not ranked'));
        return hasValidResults;
    }

    // Load data and initialize
    async function init() {
        try {
            const response = await fetch('data/detailed_games.json');
            const data = await response.json();

            // Filter to only valid 4-player games with our tracked players
            gamesData = data.games.filter(isValidGame);

            // Use only tracked players
            TRACKED_PLAYERS.forEach(p => allPlayers.add(p));

            // Extract maps from filtered games
            gamesData.forEach(game => {
                const map = Object.values(game.stats.Map || {})[0];
                if (map && map !== '-') allMaps.add(map);
            });

            renderAll();
            setupFilters();
        } catch (error) {
            console.error('Failed to load data:', error);
            document.querySelector('main').innerHTML = `
                <div class="empty-state">
                    <h2>Failed to load data</h2>
                    <p>Make sure detailed_games.json is in the data folder.</p>
                </div>
            `;
        }
    }

    // Player colors for charts
    const PLAYER_COLORS = {
        'msiebert': '#8b5cf6',    // Matt - purple
        'marksbrt': '#f97316',    // Mark - orange
        'AstroHood': '#22c55e',   // Callie - green
        'siebert23': '#000000'    // Keith - black
    };

    function renderAll() {
        renderSummary();
        renderLeaderboard();
        renderPerformanceMetric();
        renderScoreOverTime();
        renderTurnsOverTime();
        renderWinnerPPTOverTime();
        renderScoreHistograms();
        renderPlacement();
        renderPlayerBestMaps();
        renderMaps();
        renderEfficiency();
        renderHistory();
    }

    // Summary cards
    function renderSummary() {
        const totalGames = gamesData.length;
        const totalPlayers = allPlayers.size;

        let totalScore = 0;
        let scoreCount = 0;
        let totalTurns = 0;
        let turnsCount = 0;

        gamesData.forEach(game => {
            // Get scores
            const results = game.stats['Game result'] || {};
            Object.values(results).forEach(r => {
                const match = r.match(/\((\d+)\)/);
                if (match) {
                    totalScore += parseInt(match[1]);
                    scoreCount++;
                }
            });

            // Get turns
            const turns = game.stats['Number of turns'] || {};
            const turnVal = Object.values(turns)[0];
            if (turnVal) {
                totalTurns += parseInt(turnVal);
                turnsCount++;
            }
        });

        document.getElementById('total-games').textContent = totalGames;
        document.getElementById('total-players').textContent = totalPlayers;
        document.getElementById('avg-score').textContent = scoreCount ? Math.round(totalScore / scoreCount) : 0;
        document.getElementById('avg-turns').textContent = turnsCount ? Math.round(totalTurns / turnsCount) : 0;
    }

    // Leaderboard
    function renderLeaderboard() {
        const playerStats = {};

        allPlayers.forEach(player => {
            playerStats[player] = { wins: 0, games: 0, scores: [], totalScore: 0 };
        });

        gamesData.forEach(game => {
            const results = game.stats['Game result'] || {};
            Object.entries(results).forEach(([player, result]) => {
                if (!playerStats[player]) return;
                playerStats[player].games++;

                if (result.startsWith('1st')) {
                    playerStats[player].wins++;
                }

                const match = result.match(/\((\d+)\)/);
                if (match) {
                    const score = parseInt(match[1]);
                    playerStats[player].scores.push(score);
                    playerStats[player].totalScore += score;
                }
            });
        });

        const sorted = Object.entries(playerStats)
            .filter(([_, s]) => s.games >= 1)
            .sort((a, b) => {
                // Sort by win rate, then by avg score
                const aRate = a[1].wins / a[1].games;
                const bRate = b[1].wins / b[1].games;
                if (bRate !== aRate) return bRate - aRate;
                const aAvg = a[1].totalScore / a[1].games;
                const bAvg = b[1].totalScore / b[1].games;
                return bAvg - aAvg;
            });

        const tbody = document.querySelector('#leaderboard-table tbody');
        tbody.innerHTML = sorted.map(([player, stats], idx) => {
            const winRate = ((stats.wins / stats.games) * 100).toFixed(1);
            const avgScore = stats.games ? Math.round(stats.totalScore / stats.games) : 0;
            const bestScore = stats.scores.length ? Math.max(...stats.scores) : 0;

            let rankClass = '';
            if (idx === 0) rankClass = 'rank-1';
            else if (idx === 1) rankClass = 'rank-2';
            else if (idx === 2) rankClass = 'rank-3';

            return `
                <tr>
                    <td class="${rankClass}">${idx + 1}</td>
                    <td>${getDisplayName(player)}</td>
                    <td>${stats.wins}</td>
                    <td>${stats.games}</td>
                    <td>${winRate}%</td>
                    <td>${avgScore}</td>
                    <td>${bestScore}</td>
                </tr>
            `;
        }).join('');
    }

    // Performance Metric: 10×1st + 6×2nd + 3×3rd + 1×4th
    function renderPerformanceMetric() {
        const placements = {};

        allPlayers.forEach(player => {
            placements[player] = { 1: 0, 2: 0, 3: 0, 4: 0 };
        });

        gamesData.forEach(game => {
            const results = game.stats['Game result'] || {};
            Object.entries(results).forEach(([player, result]) => {
                if (!placements[player]) return;

                const placeMatch = result.match(/^(\d)/);
                if (placeMatch) {
                    const place = parseInt(placeMatch[1]);
                    if (place >= 1 && place <= 4) {
                        placements[player][place]++;
                    }
                }
            });
        });

        const sorted = Object.entries(placements)
            .map(([player, p]) => {
                const score = 10 * p[1] + 6 * p[2] + 3 * p[3] + 1 * p[4];
                return { player, placements: p, score };
            })
            .sort((a, b) => b.score - a.score);

        const tbody = document.querySelector('#performance-table tbody');
        tbody.innerHTML = sorted.map((item, idx) => {
            let rankClass = '';
            if (idx === 0) rankClass = 'rank-1';
            else if (idx === 1) rankClass = 'rank-2';
            else if (idx === 2) rankClass = 'rank-3';

            return `
                <tr>
                    <td class="${rankClass}">${idx + 1}</td>
                    <td>${getDisplayName(item.player)}</td>
                    <td>${item.placements[1]}</td>
                    <td>${item.placements[2]}</td>
                    <td>${item.placements[3]}</td>
                    <td>${item.placements[4]}</td>
                    <td><strong>${item.score}</strong></td>
                </tr>
            `;
        }).join('');
    }

    // Sort games chronologically (by date if available, otherwise by tableId)
    function sortGamesChronologically(games) {
        return [...games].sort((a, b) => {
            if (a.date && b.date) {
                return a.date.localeCompare(b.date);
            }
            // Fall back to tableId (roughly chronological on BGA)
            return a.tableId.localeCompare(b.tableId);
        });
    }

    // Format date for display
    function formatGameLabel(game, index) {
        if (game.date) {
            // Format as "M/D" for brevity
            const [year, month, day] = game.date.split('-');
            return `${parseInt(month)}/${parseInt(day)}`;
        }
        return `Game ${index + 1}`;
    }

    // Score over time line chart
    function renderScoreOverTime() {
        // Collect scores per player over time (sorted by date)
        const sortedGames = sortGamesChronologically(gamesData);

        const playerScores = {};
        TRACKED_PLAYERS.forEach(player => {
            playerScores[player] = [];
        });

        const gameLabels = [];

        sortedGames.forEach((game, index) => {
            gameLabels.push(formatGameLabel(game, index));
            const results = game.stats['Game result'] || {};

            TRACKED_PLAYERS.forEach(player => {
                const result = results[player];
                if (result) {
                    const match = result.match(/\((\d+)\)/);
                    playerScores[player].push(match ? parseInt(match[1]) : null);
                } else {
                    playerScores[player].push(null);
                }
            });
        });

        const datasets = TRACKED_PLAYERS.map(player => ({
            label: getDisplayName(player),
            data: playerScores[player],
            borderColor: PLAYER_COLORS[player],
            backgroundColor: PLAYER_COLORS[player] + '20',
            tension: 0.1,
            fill: false,
            pointRadius: 4,
            pointHoverRadius: 6
        }));

        const ctx = document.getElementById('score-time-chart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: gameLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        title: {
                            display: true,
                            text: 'Final Score'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Game'
                        }
                    }
                }
            }
        });
    }

    // Turns per game over time
    function renderTurnsOverTime() {
        const sortedGames = sortGamesChronologically(gamesData);

        const gameLabels = [];
        const turnsData = [];

        sortedGames.forEach((game, index) => {
            gameLabels.push(formatGameLabel(game, index));
            const turns = game.stats['Number of turns'] || {};
            const turnVal = Object.values(turns)[0];
            turnsData.push(turnVal ? parseInt(turnVal) : null);
        });

        const ctx = document.getElementById('turns-time-chart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: gameLabels,
                datasets: [{
                    label: 'Turns',
                    data: turnsData,
                    borderColor: '#2d5a27',
                    backgroundColor: '#2d5a2720',
                    tension: 0.1,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        title: {
                            display: true,
                            text: 'Number of Turns'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Game'
                        }
                    }
                }
            }
        });
    }

    // Winner points per turn over time
    function renderWinnerPPTOverTime() {
        const sortedGames = sortGamesChronologically(gamesData);

        const gameLabels = [];
        const winnerPPTData = [];
        const winnerColors = [];

        sortedGames.forEach((game, index) => {
            gameLabels.push(formatGameLabel(game, index));
            const results = game.stats['Game result'] || {};
            const turns = game.stats['Number of turns'] || {};

            // Find winner
            let winnerPPT = null;
            let winnerPlayer = null;
            Object.entries(results).forEach(([player, result]) => {
                if (result.startsWith('1st')) {
                    const scoreMatch = result.match(/\((\d+)\)/);
                    const playerTurns = turns[player];
                    if (scoreMatch && playerTurns) {
                        winnerPPT = parseInt(scoreMatch[1]) / parseInt(playerTurns);
                        winnerPlayer = player;
                    }
                }
            });

            winnerPPTData.push(winnerPPT);
            winnerColors.push(winnerPlayer ? PLAYER_COLORS[winnerPlayer] : '#999');
        });

        const ctx = document.getElementById('winner-ppt-chart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: gameLabels,
                datasets: [{
                    label: 'Winner PPT',
                    data: winnerPPTData,
                    backgroundColor: winnerColors,
                    borderColor: winnerColors.map(c => c.replace('20', '')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `PPT: ${context.raw.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        title: {
                            display: true,
                            text: 'Points Per Turn'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Game'
                        }
                    }
                }
            }
        });
    }

    // Score histograms per player
    function renderScoreHistograms() {
        // Collect all scores to determine bin range
        const allScores = [];
        const playerScores = {};

        TRACKED_PLAYERS.forEach(player => {
            playerScores[player] = [];
        });

        gamesData.forEach(game => {
            const results = game.stats['Game result'] || {};
            Object.entries(results).forEach(([player, result]) => {
                if (!TRACKED_PLAYERS.includes(player)) return;
                const match = result.match(/\((\d+)\)/);
                if (match) {
                    const score = parseInt(match[1]);
                    allScores.push(score);
                    playerScores[player].push(score);
                }
            });
        });

        // Calculate bins (use consistent binning across all players)
        const minScore = Math.min(...allScores);
        const maxScore = Math.max(...allScores);
        const binWidth = 10;
        const binStart = Math.floor(minScore / binWidth) * binWidth;
        const binEnd = Math.ceil(maxScore / binWidth) * binWidth;

        const binLabels = [];
        for (let i = binStart; i < binEnd; i += binWidth) {
            binLabels.push(`${i}-${i + binWidth - 1}`);
        }

        // Create histogram for each player
        const playerCanvasMap = {
            'msiebert': 'histogram-matt',
            'marksbrt': 'histogram-mark',
            'AstroHood': 'histogram-callie',
            'siebert23': 'histogram-keith'
        };

        TRACKED_PLAYERS.forEach(player => {
            const scores = playerScores[player];
            const bins = new Array(binLabels.length).fill(0);

            scores.forEach(score => {
                const binIndex = Math.floor((score - binStart) / binWidth);
                if (binIndex >= 0 && binIndex < bins.length) {
                    bins[binIndex]++;
                }
            });

            const ctx = document.getElementById(playerCanvasMap[player]).getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: binLabels,
                    datasets: [{
                        label: 'Games',
                        data: bins,
                        backgroundColor: PLAYER_COLORS[player] + 'CC',
                        borderColor: PLAYER_COLORS[player],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            },
                            title: {
                                display: true,
                                text: 'Count'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Score Range'
                            }
                        }
                    }
                }
            });
        });
    }

    // Placement distribution
    function renderPlacement() {
        const placements = {};

        allPlayers.forEach(player => {
            placements[player] = { 1: 0, 2: 0, 3: 0, 4: 0, total: 0 };
        });

        gamesData.forEach(game => {
            const results = game.stats['Game result'] || {};
            Object.entries(results).forEach(([player, result]) => {
                if (!placements[player]) return;
                placements[player].total++;

                const placeMatch = result.match(/^(\d)/);
                if (placeMatch) {
                    const place = parseInt(placeMatch[1]);
                    if (place >= 1 && place <= 4) {
                        placements[player][place]++;
                    }
                }
            });
        });

        const sorted = Object.entries(placements)
            .filter(([_, p]) => p.total >= 1)
            .sort((a, b) => b[1][1] - a[1][1]);

        const tbody = document.querySelector('#placement-table tbody');
        tbody.innerHTML = sorted.map(([player, p]) => `
            <tr>
                <td>${getDisplayName(player)}</td>
                <td class="rank-1">${p[1]}</td>
                <td class="rank-2">${p[2]}</td>
                <td class="rank-3">${p[3]}</td>
                <td>${p[4]}</td>
            </tr>
        `).join('');
    }

    // Best map per player
    function renderPlayerBestMaps() {
        const playerMapWins = {};

        TRACKED_PLAYERS.forEach(player => {
            playerMapWins[player] = {};
        });

        gamesData.forEach(game => {
            const maps = game.stats['Map'] || {};
            const results = game.stats['Game result'] || {};

            Object.entries(maps).forEach(([player, mapName]) => {
                if (!TRACKED_PLAYERS.includes(player)) return;
                if (!mapName || mapName === '-') return;

                const result = results[player];
                if (result && result.startsWith('1st')) {
                    playerMapWins[player][mapName] = (playerMapWins[player][mapName] || 0) + 1;
                }
            });
        });

        const tbody = document.querySelector('#player-maps-table tbody');
        tbody.innerHTML = TRACKED_PLAYERS.map(player => {
            const mapWins = playerMapWins[player];
            const entries = Object.entries(mapWins);

            if (entries.length === 0) {
                return `
                    <tr>
                        <td>${getDisplayName(player)}</td>
                        <td>-</td>
                        <td>0</td>
                    </tr>
                `;
            }

            // Find map with most wins
            const [bestMap, wins] = entries.sort((a, b) => b[1] - a[1])[0];
            return `
                <tr>
                    <td>${getDisplayName(player)}</td>
                    <td>${bestMap}</td>
                    <td>${wins}</td>
                </tr>
            `;
        }).join('');
    }

    // Maps stats - tracks performance of each map regardless of who played it
    function renderMaps() {
        const mapStats = {};

        gamesData.forEach(game => {
            const maps = game.stats['Map'] || {};
            const results = game.stats['Game result'] || {};

            // Each player has their own map - track each map's performance
            Object.entries(maps).forEach(([player, mapName]) => {
                if (!mapName || mapName === '-') return;

                if (!mapStats[mapName]) {
                    mapStats[mapName] = {
                        timesPlayed: 0,
                        wins: 0,
                        totalPlacement: 0,
                        totalScore: 0
                    };
                }

                mapStats[mapName].timesPlayed++;

                // Get this player's placement and score
                const result = results[player];
                if (result) {
                    const placeMatch = result.match(/^(\d)/);
                    if (placeMatch) {
                        const place = parseInt(placeMatch[1]);
                        mapStats[mapName].totalPlacement += place;
                        if (place === 1) {
                            mapStats[mapName].wins++;
                        }
                    }

                    const scoreMatch = result.match(/\((\d+)\)/);
                    if (scoreMatch) {
                        mapStats[mapName].totalScore += parseInt(scoreMatch[1]);
                    }
                }
            });
        });

        // Sort by wins (most first), then by average placement
        const sorted = Object.entries(mapStats)
            .filter(([_, stats]) => stats.timesPlayed >= 1)
            .sort((a, b) => {
                if (b[1].wins !== a[1].wins) return b[1].wins - a[1].wins;
                const aAvg = a[1].totalPlacement / a[1].timesPlayed;
                const bAvg = b[1].totalPlacement / b[1].timesPlayed;
                return aAvg - bAvg;
            });

        const tbody = document.querySelector('#maps-table tbody');
        tbody.innerHTML = sorted.map(([map, stats]) => {
            const avgPlacement = (stats.totalPlacement / stats.timesPlayed).toFixed(2);
            const avgScore = Math.round(stats.totalScore / stats.timesPlayed);

            return `
                <tr>
                    <td>${map}</td>
                    <td>${stats.timesPlayed}</td>
                    <td>${stats.wins}</td>
                    <td>${avgPlacement}</td>
                    <td>${avgScore}</td>
                </tr>
            `;
        }).join('');
    }

    // Efficiency stats
    function renderEfficiency() {
        const playerEfficiency = {};

        allPlayers.forEach(player => {
            playerEfficiency[player] = { totalPoints: 0, totalTurns: 0, games: 0, bestPPT: 0 };
        });

        gamesData.forEach(game => {
            const results = game.stats['Game result'] || {};
            const turns = game.stats['Number of turns'] || {};

            Object.entries(results).forEach(([player, result]) => {
                if (!playerEfficiency[player]) return;

                const scoreMatch = result.match(/\((\d+)\)/);
                const playerTurns = turns[player];

                if (scoreMatch && playerTurns) {
                    const score = parseInt(scoreMatch[1]);
                    const t = parseInt(playerTurns);

                    playerEfficiency[player].totalPoints += score;
                    playerEfficiency[player].totalTurns += t;
                    playerEfficiency[player].games++;

                    const ppt = score / t;
                    if (ppt > playerEfficiency[player].bestPPT) {
                        playerEfficiency[player].bestPPT = ppt;
                    }
                }
            });
        });

        const sorted = Object.entries(playerEfficiency)
            .filter(([_, e]) => e.games >= 1)
            .sort((a, b) => {
                const aAvg = a[1].totalPoints / a[1].totalTurns;
                const bAvg = b[1].totalPoints / b[1].totalTurns;
                return bAvg - aAvg;
            });

        const tbody = document.querySelector('#efficiency-table tbody');
        tbody.innerHTML = sorted.map(([player, e]) => {
            const avgPPT = e.totalTurns ? (e.totalPoints / e.totalTurns).toFixed(2) : 0;
            return `
                <tr>
                    <td>${getDisplayName(player)}</td>
                    <td>${avgPPT}</td>
                    <td>${e.bestPPT.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
    }

    // Game history
    function renderHistory(filterPlayer = '', filterMap = '', sortBy = 'date-desc') {
        let games = [...gamesData];

        // Apply filters
        if (filterPlayer) {
            games = games.filter(g => g.players.includes(filterPlayer));
        }
        if (filterMap) {
            games = games.filter(g => {
                const maps = g.stats['Map'] || {};
                return Object.values(maps).includes(filterMap);
            });
        }

        // Sort
        games.sort((a, b) => {
            switch (sortBy) {
                case 'date-asc':
                    return a.tableId.localeCompare(b.tableId);
                case 'score-desc':
                    const aMax = getMaxScore(a);
                    const bMax = getMaxScore(b);
                    return bMax - aMax;
                case 'turns-asc':
                    const aTurns = getTurns(a);
                    const bTurns = getTurns(b);
                    return aTurns - bTurns;
                default: // date-desc
                    return b.tableId.localeCompare(a.tableId);
            }
        });

        const tbody = document.querySelector('#history-table tbody');
        tbody.innerHTML = games.map(game => {
            const results = game.stats['Game result'] || {};
            const maps = game.stats['Map'] || {};
            const turns = game.stats['Number of turns'] || {};

            const map = Object.values(maps)[0] || 'Unknown';
            const turnCount = Object.values(turns)[0] || '?';

            // Find winner
            let winner = '';
            let winnerScore = 0;
            Object.entries(results).forEach(([player, result]) => {
                if (result.startsWith('1st')) {
                    winner = player;
                    const match = result.match(/\((\d+)\)/);
                    if (match) winnerScore = match[1];
                }
            });

            // Build results summary
            const resultsList = Object.entries(results)
                .map(([player, result]) => {
                    const placeMatch = result.match(/^(\d)/);
                    const scoreMatch = result.match(/\((\d+)\)/);
                    const place = placeMatch ? placeMatch[1] : '?';
                    const score = scoreMatch ? scoreMatch[1] : '?';
                    const isFirst = result.startsWith('1st');
                    return `<span class="result-pill ${isFirst ? 'first' : ''}">
                        <span class="result-rank">${place}.</span>
                        ${getDisplayName(player)} (${score})
                    </span>`;
                })
                .join('');

            // Extract date from tableId or use placeholder
            const date = game.tableId.slice(0, 4) + '-' + game.tableId.slice(4, 6) + '-' + game.tableId.slice(6, 8);

            return `
                <tr>
                    <td>${game.tableId}</td>
                    <td>${map}</td>
                    <td>${turnCount}</td>
                    <td><span class="winner-badge">${getDisplayName(winner)} (${winnerScore})</span></td>
                    <td><div class="results-summary">${resultsList}</div></td>
                    <td><a href="${game.url}" target="_blank" class="game-link">View</a></td>
                </tr>
            `;
        }).join('');
    }

    function getMaxScore(game) {
        const results = game.stats['Game result'] || {};
        let max = 0;
        Object.values(results).forEach(r => {
            const match = r.match(/\((\d+)\)/);
            if (match) {
                const score = parseInt(match[1]);
                if (score > max) max = score;
            }
        });
        return max;
    }

    function getTurns(game) {
        const turns = game.stats['Number of turns'] || {};
        const val = Object.values(turns)[0];
        return val ? parseInt(val) : 999;
    }

    // Setup filter controls
    function setupFilters() {
        const playerSelect = document.getElementById('filter-player');
        const mapSelect = document.getElementById('filter-map');
        const sortSelect = document.getElementById('sort-by');

        // Populate player filter (sorted by display name)
        [...allPlayers]
            .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
            .forEach(player => {
                const option = document.createElement('option');
                option.value = player;
                option.textContent = getDisplayName(player);
                playerSelect.appendChild(option);
            });

        // Populate map filter
        [...allMaps].sort().forEach(map => {
            const option = document.createElement('option');
            option.value = map;
            option.textContent = map;
            mapSelect.appendChild(option);
        });

        // Event listeners
        const updateHistory = () => {
            renderHistory(playerSelect.value, mapSelect.value, sortSelect.value);
        };

        playerSelect.addEventListener('change', updateHistory);
        mapSelect.addEventListener('change', updateHistory);
        sortSelect.addEventListener('change', updateHistory);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
