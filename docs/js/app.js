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
        renderAccolades();
        renderLeaderboard();
        renderPerformanceMetric();
        renderScoreOverTime();
        renderTurnsOverTime();
        renderWinnerPPTOverTime();
        renderScoreKDE();
        renderScoreHistograms();
        renderAnimalIconsKDE();
        renderAnimalIconsByPlayer();
        renderAnimalIcons();
        renderContinentIconsKDE();
        renderContinentIconsByPlayer();
        renderContinentIcons();
        renderMoneyKDE();
        renderMoneyByPlayerKDE();
        renderAdditionalStats();
        renderCardsDrawnKDE();
        renderPointDisparity();
        renderDisparityDistribution();
        renderDisparityByPlayer();
        renderAnimalIconTotals();
        renderContinentIconTotals();
        renderPlayerBestMaps();
        renderMaps();
        renderMapSelectionTotal();
        renderMapSelectionByPlayer();
        renderTopCards();
        renderHistory();
    }

    // Summary cards
    function renderSummary() {
        const totalGames = gamesData.length;

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
        document.getElementById('avg-score').textContent = scoreCount ? Math.round(totalScore / scoreCount) : 0;
        document.getElementById('avg-turns').textContent = turnsCount ? Math.round(totalTurns / turnsCount) : 0;

        // Recent game summary
        const sortedGames = sortGamesChronologically(gamesData);
        const recentGame = sortedGames[sortedGames.length - 1];

        if (recentGame) {
            const results = recentGame.stats['Game result'] || {};
            const maps = recentGame.stats['Map'] || {};
            const turns = recentGame.stats['Number of turns'] || {};

            const turnCount = Object.values(turns)[0] || '?';
            const date = recentGame.date;
            const formattedDate = date ? (() => {
                const [year, month, day] = date.split('-');
                return `${parseInt(month)}/${parseInt(day)}/${year}`;
            })() : 'Unknown';

            // Sort results by placement
            const sortedResults = Object.entries(results)
                .map(([player, result]) => {
                    const placeMatch = result.match(/^(\d)/);
                    const scoreMatch = result.match(/\((\d+)\)/);
                    return {
                        player,
                        place: placeMatch ? parseInt(placeMatch[1]) : 99,
                        score: scoreMatch ? parseInt(scoreMatch[1]) : 0,
                        map: maps[player] || 'Unknown'
                    };
                })
                .sort((a, b) => a.place - b.place);

            const winner = sortedResults[0];

            const recentEl = document.getElementById('recent-game');
            recentEl.innerHTML = `
                <h3>Most Recent Game</h3>
                <div class="recent-game-info">
                    <span><strong>Date:</strong> ${formattedDate}</span>
                    <span><strong>Turns:</strong> ${turnCount}</span>
                    <a href="${recentGame.url}" target="_blank" class="game-link">View Game</a>
                </div>
                <div class="recent-game-results">
                    ${sortedResults.map(r => {
                        const isWinner = r.place === 1;
                        const color = PLAYER_COLORS[r.player];
                        return `<span class="recent-game-player ${isWinner ? 'winner' : ''}" style="color: ${color};">
                            ${r.place}. ${getDisplayName(r.player)} (${r.score}) - ${r.map}
                        </span>`;
                    }).join('')}
                </div>
            `;
        }
    }

    // Accolades
    function renderAccolades() {
        // Collect all individual performances
        const performances = [];

        gamesData.forEach(game => {
            const results = game.stats['Game result'] || {};
            const turns = game.stats['Number of turns'] || {};
            const appeal = game.stats['Appeal'] || {};
            const conservation = game.stats['Conservation'] || {};
            const date = game.date || 'Unknown';
            const url = game.url;
            const turnCount = parseInt(Object.values(turns)[0]) || 999;

            Object.entries(results).forEach(([player, result]) => {
                if (!TRACKED_PLAYERS.includes(player)) return;

                const scoreMatch = result.match(/\((\d+)\)/);
                const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
                const appealVal = parseInt(appeal[player]) || 0;
                const conservationVal = parseInt(conservation[player]) || 0;
                const isWinner = result.startsWith('1st');
                const placeMatch = result.match(/^(\d)/);
                const placement = placeMatch ? parseInt(placeMatch[1]) : 0;

                // Calculate point disparity
                const appealPts = appealVal;
                const conservationPts = 3 * conservationVal - 10;
                const disparity = appealPts - conservationPts;

                performances.push({
                    player,
                    score,
                    turns: turnCount,
                    appeal: appealVal,
                    conservation: conservationVal,
                    disparity,
                    date,
                    url,
                    isWinner,
                    placement
                });
            });
        });

        // Format date for display
        function formatDate(dateStr) {
            if (!dateStr || dateStr === 'Unknown') return '';
            const [year, month, day] = dateStr.split('-');
            return `${parseInt(month)}/${parseInt(day)}/${year.slice(2)}`;
        }

        // Render accolade list
        function renderList(elementId, sorted, valueKey, valueFormat) {
            const top3 = sorted.slice(0, 3);
            const el = document.getElementById(elementId);
            const placeSuffix = ['', 'st', 'nd', 'rd', 'th'];
            el.innerHTML = top3.map(p => {
                const placeStr = p.placement ? `${p.placement}${placeSuffix[p.placement]}` : '';
                return `
                <li>
                    <div class="accolade-info">
                        <span class="accolade-value">${valueFormat(p[valueKey])}</span>
                        <span class="accolade-detail">${getDisplayName(p.player)} (${placeStr}) - ${formatDate(p.date)}</span>
                    </div>
                    <a href="${p.url}" target="_blank" class="accolade-link game-link">View</a>
                </li>
            `}).join('');
        }

        // Highest scores
        const byScore = [...performances].sort((a, b) => b.score - a.score);
        renderList('highest-scores', byScore, 'score', v => `${v} pts`);

        // Fastest games (fewest turns) - only winners
        const winners = performances.filter(p => p.isWinner);
        const byTurns = [...winners].sort((a, b) => a.turns - b.turns);
        renderList('fastest-games', byTurns, 'turns', v => `${v} turns`);

        // Most appeal
        const byAppeal = [...performances].sort((a, b) => b.appeal - a.appeal);
        renderList('most-appeal', byAppeal, 'appeal', v => `${v} appeal`);

        // Most conservation
        const byConservation = [...performances].sort((a, b) => b.conservation - a.conservation);
        renderList('most-conservation', byConservation, 'conservation', v => `${v} conservation`);

        // Best win streak
        const sortedGames = sortGamesChronologically(gamesData);
        const playerStreaks = {};
        TRACKED_PLAYERS.forEach(player => {
            playerStreaks[player] = { current: 0, best: 0, bestEndDate: null, bestEndUrl: null };
        });

        sortedGames.forEach(game => {
            const results = game.stats['Game result'] || {};
            const date = game.date || 'Unknown';
            const url = game.url;

            TRACKED_PLAYERS.forEach(player => {
                const result = results[player];
                if (result && result.startsWith('1st')) {
                    playerStreaks[player].current++;
                    if (playerStreaks[player].current > playerStreaks[player].best) {
                        playerStreaks[player].best = playerStreaks[player].current;
                        playerStreaks[player].bestEndDate = date;
                        playerStreaks[player].bestEndUrl = url;
                    }
                } else {
                    playerStreaks[player].current = 0;
                }
            });
        });

        // Find the maximum streak
        const maxStreak = Math.max(...TRACKED_PLAYERS.map(p => playerStreaks[p].best));

        // Get all players with the max streak (ties)
        const streakWinners = TRACKED_PLAYERS
            .filter(p => playerStreaks[p].best === maxStreak)
            .map(p => ({
                player: p,
                streak: playerStreaks[p].best,
                date: playerStreaks[p].bestEndDate,
                url: playerStreaks[p].bestEndUrl
            }));

        // Render win streak list
        const streakEl = document.getElementById('best-win-streak');
        streakEl.innerHTML = streakWinners.map(s => `
            <li>
                <div class="accolade-info">
                    <span class="accolade-value">${s.streak} wins</span>
                    <span class="accolade-detail">${getDisplayName(s.player)} - ended ${formatDate(s.date)}</span>
                </div>
                <a href="${s.url}" target="_blank" class="accolade-link game-link">View</a>
            </li>
        `).join('');

        // Point disparity accolades (only for scores >= 100)
        const validDisparities = performances.filter(p => p.score >= 100);

        // Most appeal-heavy (highest positive disparity)
        const byPositiveDisparity = [...validDisparities].sort((a, b) => b.disparity - a.disparity);
        renderList('most-appeal-heavy', byPositiveDisparity, 'disparity', v => `+${v.toFixed(0)}`);

        // Most conservation-heavy (lowest/most negative disparity)
        const byNegativeDisparity = [...validDisparities].sort((a, b) => a.disparity - b.disparity);
        renderList('most-conservation-heavy', byNegativeDisparity, 'disparity', v => `${v.toFixed(0)}`);
    }

    // Leaderboard
    function renderLeaderboard() {
        const playerStats = {};

        allPlayers.forEach(player => {
            playerStats[player] = {
                wins: 0,
                games: 0,
                scores: [],
                totalScore: 0,
                totalPoints: 0,
                totalTurns: 0,
                bestPPT: 0,
                fastestWin: Infinity
            };
        });

        gamesData.forEach(game => {
            const results = game.stats['Game result'] || {};
            const turns = game.stats['Number of turns'] || {};

            Object.entries(results).forEach(([player, result]) => {
                if (!playerStats[player]) return;
                playerStats[player].games++;

                const isWinner = result.startsWith('1st');
                if (isWinner) {
                    playerStats[player].wins++;
                }

                const match = result.match(/\((\d+)\)/);
                if (match) {
                    const score = parseInt(match[1]);
                    playerStats[player].scores.push(score);
                    playerStats[player].totalScore += score;

                    // Efficiency tracking
                    const playerTurns = turns[player];
                    if (playerTurns) {
                        const t = parseInt(playerTurns);
                        playerStats[player].totalPoints += score;
                        playerStats[player].totalTurns += t;
                        const ppt = score / t;
                        if (ppt > playerStats[player].bestPPT) {
                            playerStats[player].bestPPT = ppt;
                        }
                        // Track fastest win
                        if (isWinner && t < playerStats[player].fastestWin) {
                            playerStats[player].fastestWin = t;
                        }
                    }
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
            const avgPPT = stats.totalTurns > 0 ? (stats.totalPoints / stats.totalTurns).toFixed(2) : '0.00';
            const bestPPT = stats.bestPPT.toFixed(2);
            const fastestWin = stats.fastestWin === Infinity ? '-' : stats.fastestWin;

            let rankClass = '';
            if (idx === 0) rankClass = 'rank-1';
            else if (idx === 1) rankClass = 'rank-2';
            else if (idx === 2) rankClass = 'rank-3';

            return `
                <tr>
                    <td class="${rankClass}">${idx + 1}</td>
                    <td>${getDisplayName(player)}</td>
                    <td>${stats.wins}</td>
                    <td>${winRate}%</td>
                    <td>${avgScore}</td>
                    <td>${bestScore}</td>
                    <td>${avgPPT}</td>
                    <td>${bestPPT}</td>
                    <td>${fastestWin}</td>
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

    // Score KDE plot
    function renderScoreKDE() {
        // Collect scores per player
        const playerScores = {};
        TRACKED_PLAYERS.forEach(player => {
            playerScores[player] = [];
        });

        let globalMin = Infinity;
        let globalMax = -Infinity;

        gamesData.forEach(game => {
            const results = game.stats['Game result'] || {};
            Object.entries(results).forEach(([player, result]) => {
                if (!TRACKED_PLAYERS.includes(player)) return;
                const match = result.match(/\((\d+)\)/);
                if (match) {
                    const score = parseInt(match[1]);
                    playerScores[player].push(score);
                    globalMin = Math.min(globalMin, score);
                    globalMax = Math.max(globalMax, score);
                }
            });
        });

        // Add padding to range
        const padding = (globalMax - globalMin) * 0.1;
        const xMin = globalMin - padding;
        const xMax = globalMax + padding;

        // Compute KDE for each player
        const datasets = TRACKED_PLAYERS.map(player => {
            const data = playerScores[player];
            const bandwidth = 5; // Wider bandwidth for scores
            const kde = computeKDE(data, xMin, xMax, bandwidth, 100);

            return {
                label: getDisplayName(player),
                data: kde.x.map((x, i) => ({ x: x, y: kde.y[i] })),
                borderColor: PLAYER_COLORS[player],
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                fill: false
            };
        });

        const ctx = document.getElementById('score-kde-chart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Score' }
                    },
                    y: {
                        title: { display: true, text: 'Density' },
                        beginAtZero: true
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

    // Gaussian kernel for KDE
    function gaussianKernel(x) {
        return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    }

    // Compute KDE for a dataset
    function computeKDE(data, xMin, xMax, bandwidth, numPoints = 100) {
        const step = (xMax - xMin) / (numPoints - 1);
        const xValues = [];
        const yValues = [];

        for (let i = 0; i < numPoints; i++) {
            const x = xMin + i * step;
            xValues.push(x);

            let density = 0;
            for (const xi of data) {
                density += gaussianKernel((x - xi) / bandwidth);
            }
            density /= (data.length * bandwidth);
            yValues.push(density);
        }

        return { x: xValues, y: yValues };
    }

    // Animal icons KDE plot
    function renderAnimalIconsKDE() {
        const animalTypes = [
            { key: 'Bird icons', label: 'Birds', color: '#87ceeb' },
            { key: 'Predator icons', label: 'Predators', color: '#f87171' },
            { key: 'Herbivore icons', label: 'Herbivores', color: '#4ade80' },
            { key: 'Reptile icons', label: 'Reptiles', color: '#8b5cf6' },
            { key: 'Primate icons', label: 'Primates', color: '#fde047' },
            { key: 'Sea Animal icons', label: 'Sea Animals', color: '#1e3a5f' },
            { key: 'Petting Zoo icons', label: 'Petting Zoo', color: '#d1d5db' },
            { key: 'Bear icons', label: 'Bears', color: '#8b4513' }
        ];

        // Collect totals for all types
        const allTotals = {};
        let globalMin = Infinity;
        let globalMax = -Infinity;

        animalTypes.forEach(type => {
            allTotals[type.key] = [];
            gamesData.forEach(game => {
                const iconStats = game.stats[type.key] || {};
                const total = Object.values(iconStats).reduce((sum, val) => {
                    return sum + (parseInt(val) || 0);
                }, 0);
                allTotals[type.key].push(total);
                globalMin = Math.min(globalMin, total);
                globalMax = Math.max(globalMax, total);
            });
        });

        // Add padding to range
        const padding = (globalMax - globalMin) * 0.1;
        const xMin = Math.max(0, globalMin - padding);
        const xMax = globalMax + padding;

        // Compute KDE for each type
        const datasets = animalTypes.map(type => {
            const data = allTotals[type.key];
            const bandwidth = 1.5; // Adjust for smoothness
            const kde = computeKDE(data, xMin, xMax, bandwidth, 100);

            return {
                label: type.label,
                data: kde.x.map((x, i) => ({ x: x, y: kde.y[i] })),
                borderColor: type.color,
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                fill: false
            };
        });

        const ctx = document.getElementById('animal-kde-chart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Icons per Game' }
                    },
                    y: {
                        title: { display: true, text: 'Density' },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Animal icons KDE by player
    function renderAnimalIconsByPlayer() {
        const animalTypes = [
            { key: 'Bird icons', canvasId: 'kde-birds-player', sharedAxis: true },
            { key: 'Predator icons', canvasId: 'kde-predators-player', sharedAxis: true },
            { key: 'Herbivore icons', canvasId: 'kde-herbivores-player', sharedAxis: true },
            { key: 'Reptile icons', canvasId: 'kde-reptiles-player', sharedAxis: true },
            { key: 'Primate icons', canvasId: 'kde-primates-player', sharedAxis: true },
            { key: 'Sea Animal icons', canvasId: 'kde-seaanimals-player', sharedAxis: true },
            { key: 'Petting Zoo icons', canvasId: 'kde-pettingzoo-player', sharedAxis: false },
            { key: 'Bear icons', canvasId: 'kde-bears-player', sharedAxis: false }
        ];

        // First pass: collect all data and find shared axis range
        const allPlayerCounts = {};
        let sharedMin = Infinity;
        let sharedMax = -Infinity;

        animalTypes.forEach(type => {
            allPlayerCounts[type.key] = {};
            TRACKED_PLAYERS.forEach(player => {
                allPlayerCounts[type.key][player] = [];
            });

            gamesData.forEach(game => {
                const iconStats = game.stats[type.key] || {};
                TRACKED_PLAYERS.forEach(player => {
                    const count = parseInt(iconStats[player]) || 0;
                    allPlayerCounts[type.key][player].push(count);
                    if (type.sharedAxis) {
                        sharedMin = Math.min(sharedMin, count);
                        sharedMax = Math.max(sharedMax, count);
                    }
                });
            });
        });

        // Add padding to shared range
        const sharedPadding = Math.max(1, (sharedMax - sharedMin) * 0.1);
        const sharedXMin = Math.max(0, sharedMin - sharedPadding);
        const sharedXMax = sharedMax + sharedPadding;

        animalTypes.forEach(type => {
            const playerCounts = allPlayerCounts[type.key];

            let xMin, xMax;
            if (type.sharedAxis) {
                xMin = sharedXMin;
                xMax = sharedXMax;
            } else {
                // Calculate individual range for this type
                let typeMin = Infinity;
                let typeMax = -Infinity;
                TRACKED_PLAYERS.forEach(player => {
                    playerCounts[player].forEach(count => {
                        typeMin = Math.min(typeMin, count);
                        typeMax = Math.max(typeMax, count);
                    });
                });
                const padding = Math.max(1, (typeMax - typeMin) * 0.1);
                xMin = Math.max(0, typeMin - padding);
                xMax = typeMax + padding;
            }

            // Compute KDE for each player
            const datasets = TRACKED_PLAYERS.map(player => {
                const data = playerCounts[player];
                const bandwidth = 0.8;
                const kde = computeKDE(data, xMin, xMax, bandwidth, 100);

                return {
                    label: getDisplayName(player),
                    data: kde.x.map((x, i) => ({ x: x, y: kde.y[i] })),
                    borderColor: PLAYER_COLORS[player],
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0,
                    fill: false
                };
            });

            const ctx = document.getElementById(type.canvasId).getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: { datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { boxWidth: 12, padding: 8 }
                        }
                    },
                    scales: {
                        x: {
                            type: 'linear',
                            min: xMin,
                            max: xMax,
                            title: { display: true, text: 'Icons per Game' }
                        },
                        y: {
                            title: { display: true, text: 'Density' },
                            beginAtZero: true
                        }
                    }
                }
            });
        });
    }

    // Animal icons distribution histograms
    function renderAnimalIcons() {
        const animalTypes = [
            { key: 'Bird icons', canvasId: 'histogram-birds', color: '#87ceeb', sharedAxis: true },
            { key: 'Predator icons', canvasId: 'histogram-predators', color: '#f87171', sharedAxis: true },
            { key: 'Herbivore icons', canvasId: 'histogram-herbivores', color: '#4ade80', sharedAxis: true },
            { key: 'Bear icons', canvasId: 'histogram-bears', color: '#8b4513', sharedAxis: false },
            { key: 'Reptile icons', canvasId: 'histogram-reptiles', color: '#8b5cf6', sharedAxis: true },
            { key: 'Primate icons', canvasId: 'histogram-primates', color: '#fde047', sharedAxis: true },
            { key: 'Petting Zoo icons', canvasId: 'histogram-pettingzoo', color: '#d1d5db', sharedAxis: false },
            { key: 'Sea Animal icons', canvasId: 'histogram-seaanimals', color: '#1e3a5f', sharedAxis: true }
        ];

        // Collect totals for all types first
        const allTotals = {};
        animalTypes.forEach(type => {
            allTotals[type.key] = [];
            gamesData.forEach(game => {
                const iconStats = game.stats[type.key] || {};
                const total = Object.values(iconStats).reduce((sum, val) => {
                    return sum + (parseInt(val) || 0);
                }, 0);
                allTotals[type.key].push(total);
            });
        });

        // Find max value for shared axis types
        const sharedAxisMax = Math.max(
            ...animalTypes
                .filter(t => t.sharedAxis)
                .flatMap(t => allTotals[t.key])
        );

        animalTypes.forEach(type => {
            const totals = allTotals[type.key];
            const maxVal = type.sharedAxis ? sharedAxisMax : Math.max(...totals, 0);

            // Build histogram bins
            const bins = {};
            for (let i = 0; i <= maxVal; i++) {
                bins[i] = 0;
            }
            totals.forEach(val => {
                bins[val] = (bins[val] || 0) + 1;
            });

            const labels = Object.keys(bins).map(k => k.toString());
            const data = Object.values(bins);

            const ctx = document.getElementById(type.canvasId).getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Games',
                        data: data,
                        backgroundColor: type.color + 'CC',
                        borderColor: type.color,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { stepSize: 1 },
                            title: { display: true, text: 'Games' }
                        },
                        x: {
                            title: { display: true, text: 'Icons' }
                        }
                    }
                }
            });
        });
    }

    // Continent icons KDE plot
    function renderContinentIconsKDE() {
        const continentTypes = [
            { key: 'Africa icons', label: 'Africa', color: '#fde047' },
            { key: 'Americas icons', label: 'Americas', color: '#f97316' },
            { key: 'Asia icons', label: 'Asia', color: '#4ade80' },
            { key: 'Europe icons', label: 'Europe', color: '#87ceeb' },
            { key: 'Australia icons', label: 'Australia', color: '#ef4444' }
        ];

        // Collect totals for all types
        const allTotals = {};
        let globalMin = Infinity;
        let globalMax = -Infinity;

        continentTypes.forEach(type => {
            allTotals[type.key] = [];
            gamesData.forEach(game => {
                const iconStats = game.stats[type.key] || {};
                const total = Object.values(iconStats).reduce((sum, val) => {
                    return sum + (parseInt(val) || 0);
                }, 0);
                allTotals[type.key].push(total);
                globalMin = Math.min(globalMin, total);
                globalMax = Math.max(globalMax, total);
            });
        });

        // Add padding to range
        const padding = (globalMax - globalMin) * 0.1;
        const xMin = Math.max(0, globalMin - padding);
        const xMax = globalMax + padding;

        // Compute KDE for each type
        const datasets = continentTypes.map(type => {
            const data = allTotals[type.key];
            const bandwidth = 1.5;
            const kde = computeKDE(data, xMin, xMax, bandwidth, 100);

            return {
                label: type.label,
                data: kde.x.map((x, i) => ({ x: x, y: kde.y[i] })),
                borderColor: type.color,
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                fill: false
            };
        });

        const ctx = document.getElementById('continent-kde-chart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Icons per Game' }
                    },
                    y: {
                        title: { display: true, text: 'Density' },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Continent icons KDE by player
    function renderContinentIconsByPlayer() {
        const continentTypes = [
            { key: 'Africa icons', canvasId: 'kde-africa-player' },
            { key: 'Americas icons', canvasId: 'kde-americas-player' },
            { key: 'Asia icons', canvasId: 'kde-asia-player' },
            { key: 'Europe icons', canvasId: 'kde-europe-player' },
            { key: 'Australia icons', canvasId: 'kde-australia-player' }
        ];

        // First pass: collect all data and find shared axis range
        const allPlayerCounts = {};
        let sharedMin = Infinity;
        let sharedMax = -Infinity;

        continentTypes.forEach(type => {
            allPlayerCounts[type.key] = {};
            TRACKED_PLAYERS.forEach(player => {
                allPlayerCounts[type.key][player] = [];
            });

            gamesData.forEach(game => {
                const iconStats = game.stats[type.key] || {};
                TRACKED_PLAYERS.forEach(player => {
                    const count = parseInt(iconStats[player]) || 0;
                    allPlayerCounts[type.key][player].push(count);
                    sharedMin = Math.min(sharedMin, count);
                    sharedMax = Math.max(sharedMax, count);
                });
            });
        });

        // Add padding to shared range
        const sharedPadding = Math.max(1, (sharedMax - sharedMin) * 0.1);
        const xMin = Math.max(0, sharedMin - sharedPadding);
        const xMax = sharedMax + sharedPadding;

        continentTypes.forEach(type => {
            const playerCounts = allPlayerCounts[type.key];

            // Compute KDE for each player
            const datasets = TRACKED_PLAYERS.map(player => {
                const data = playerCounts[player];
                const bandwidth = 0.8;
                const kde = computeKDE(data, xMin, xMax, bandwidth, 100);

                return {
                    label: getDisplayName(player),
                    data: kde.x.map((x, i) => ({ x: x, y: kde.y[i] })),
                    borderColor: PLAYER_COLORS[player],
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0,
                    fill: false
                };
            });

            const ctx = document.getElementById(type.canvasId).getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: { datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { boxWidth: 12, padding: 8 }
                        }
                    },
                    scales: {
                        x: {
                            type: 'linear',
                            min: xMin,
                            max: xMax,
                            title: { display: true, text: 'Icons per Game' }
                        },
                        y: {
                            title: { display: true, text: 'Density' },
                            beginAtZero: true
                        }
                    }
                }
            });
        });
    }

    // Continent icons distribution histograms
    function renderContinentIcons() {
        const continentTypes = [
            { key: 'Africa icons', canvasId: 'histogram-africa', color: '#fde047' },
            { key: 'Americas icons', canvasId: 'histogram-americas', color: '#f97316' },
            { key: 'Asia icons', canvasId: 'histogram-asia', color: '#4ade80' },
            { key: 'Europe icons', canvasId: 'histogram-europe', color: '#87ceeb' },
            { key: 'Australia icons', canvasId: 'histogram-australia', color: '#ef4444' }
        ];

        // Collect totals for all continents first
        const allTotals = {};
        continentTypes.forEach(type => {
            allTotals[type.key] = [];
            gamesData.forEach(game => {
                const iconStats = game.stats[type.key] || {};
                const total = Object.values(iconStats).reduce((sum, val) => {
                    return sum + (parseInt(val) || 0);
                }, 0);
                allTotals[type.key].push(total);
            });
        });

        // Find max value across all continents for shared axis
        const sharedAxisMax = Math.max(
            ...continentTypes.flatMap(t => allTotals[t.key])
        );

        continentTypes.forEach(type => {
            const totals = allTotals[type.key];

            // Build histogram bins using shared max
            const bins = {};
            for (let i = 0; i <= sharedAxisMax; i++) {
                bins[i] = 0;
            }
            totals.forEach(val => {
                bins[val] = (bins[val] || 0) + 1;
            });

            const labels = Object.keys(bins).map(k => k.toString());
            const data = Object.values(bins);

            const ctx = document.getElementById(type.canvasId).getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Games',
                        data: data,
                        backgroundColor: type.color + 'CC',
                        borderColor: type.color,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { stepSize: 1 },
                            title: { display: true, text: 'Games' }
                        },
                        x: {
                            title: { display: true, text: 'Icons' }
                        }
                    }
                }
            });
        });
    }

    // Money gained vs spent KDE
    function renderMoneyKDE() {
        const moneyGainedPerGame = [];
        const moneySpentPerGame = [];

        gamesData.forEach(game => {
            const gained = game.stats['Money gained'] || {};
            const spentAnimals = game.stats['Money spent on animals'] || {};
            const spentEnclosures = game.stats['Money spent on enclosures'] || {};
            const spentDonations = game.stats['Money spent on donations'] || {};
            const spentCards = game.stats['Money spent for playing cards from reputation range'] || {};

            let totalGained = 0;
            let totalSpent = 0;
            let playerCount = 0;

            TRACKED_PLAYERS.forEach(player => {
                const g = parseInt(gained[player]) || 0;
                const s1 = parseInt(spentAnimals[player]) || 0;
                const s2 = parseInt(spentEnclosures[player]) || 0;
                const s3 = parseInt(spentDonations[player]) || 0;
                const s4 = parseInt(spentCards[player]) || 0;

                totalGained += g;
                totalSpent += s1 + s2 + s3 + s4;
                playerCount++;
            });

            // Average per player
            moneyGainedPerGame.push(totalGained / playerCount);
            moneySpentPerGame.push(totalSpent / playerCount);
        });

        // Find global range
        const allValues = [...moneyGainedPerGame, ...moneySpentPerGame];
        const globalMin = Math.min(...allValues);
        const globalMax = Math.max(...allValues);
        const padding = (globalMax - globalMin) * 0.1;
        const xMin = Math.max(0, globalMin - padding);
        const xMax = globalMax + padding;

        // Compute KDEs
        const bandwidth = 5;
        const kdeGained = computeKDE(moneyGainedPerGame, xMin, xMax, bandwidth, 100);
        const kdeSpent = computeKDE(moneySpentPerGame, xMin, xMax, bandwidth, 100);

        const datasets = [
            {
                label: 'Money Gained',
                data: kdeGained.x.map((x, i) => ({ x: x, y: kdeGained.y[i] })),
                borderColor: '#22c55e',
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                fill: false
            },
            {
                label: 'Money Spent',
                data: kdeSpent.x.map((x, i) => ({ x: x, y: kdeSpent.y[i] })),
                borderColor: '#ef4444',
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                fill: false
            }
        ];

        const ctx = document.getElementById('money-kde-chart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Money per Player per Game' }
                    },
                    y: {
                        title: { display: true, text: 'Density' },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Money by player KDE
    function renderMoneyByPlayerKDE() {
        const playerMoneyGained = {};
        const playerMoneySpent = {};

        TRACKED_PLAYERS.forEach(player => {
            playerMoneyGained[player] = [];
            playerMoneySpent[player] = [];
        });

        gamesData.forEach(game => {
            const gained = game.stats['Money gained'] || {};
            const spentAnimals = game.stats['Money spent on animals'] || {};
            const spentEnclosures = game.stats['Money spent on enclosures'] || {};
            const spentDonations = game.stats['Money spent on donations'] || {};
            const spentCards = game.stats['Money spent for playing cards from reputation range'] || {};

            TRACKED_PLAYERS.forEach(player => {
                const g = parseInt(gained[player]) || 0;
                const s1 = parseInt(spentAnimals[player]) || 0;
                const s2 = parseInt(spentEnclosures[player]) || 0;
                const s3 = parseInt(spentDonations[player]) || 0;
                const s4 = parseInt(spentCards[player]) || 0;

                playerMoneyGained[player].push(g);
                playerMoneySpent[player].push(s1 + s2 + s3 + s4);
            });
        });

        // Find global range
        const allValues = [
            ...Object.values(playerMoneyGained).flat(),
            ...Object.values(playerMoneySpent).flat()
        ];
        const globalMin = Math.min(...allValues);
        const globalMax = Math.max(...allValues);
        const padding = (globalMax - globalMin) * 0.1;
        const xMin = Math.max(0, globalMin - padding);
        const xMax = globalMax + padding;

        const bandwidth = 5;
        const datasets = [];

        // Add spent (solid) and gained (dashed) for each player
        TRACKED_PLAYERS.forEach(player => {
            const kdeSpent = computeKDE(playerMoneySpent[player], xMin, xMax, bandwidth, 100);
            const kdeGained = computeKDE(playerMoneyGained[player], xMin, xMax, bandwidth, 100);

            datasets.push({
                label: `${getDisplayName(player)} Spent`,
                data: kdeSpent.x.map((x, i) => ({ x: x, y: kdeSpent.y[i] })),
                borderColor: PLAYER_COLORS[player],
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [],
                tension: 0.4,
                pointRadius: 0,
                fill: false
            });

            datasets.push({
                label: `${getDisplayName(player)} Gained`,
                data: kdeGained.x.map((x, i) => ({ x: x, y: kdeGained.y[i] })),
                borderColor: PLAYER_COLORS[player],
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                tension: 0.4,
                pointRadius: 0,
                fill: false
            });
        });

        const ctx = document.getElementById('money-player-kde-chart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { boxWidth: 12, padding: 8 }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Money per Game' }
                    },
                    y: {
                        title: { display: true, text: 'Density' },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Generic stat KDE renderer (player breakdown only)
    function renderStatKDE(statKey, playerCanvasId, bandwidth = 2) {
        const playerValues = {};
        TRACKED_PLAYERS.forEach(player => {
            playerValues[player] = [];
        });

        gamesData.forEach(game => {
            const stats = game.stats[statKey] || {};
            TRACKED_PLAYERS.forEach(player => {
                const val = parseInt(stats[player]) || 0;
                playerValues[player].push(val);
            });
        });

        // Find global range across all data
        const allValues = Object.values(playerValues).flat();
        const globalMin = Math.min(...allValues);
        const globalMax = Math.max(...allValues);
        const padding = Math.max(1, (globalMax - globalMin) * 0.1);
        const xMin = Math.max(0, globalMin - padding);
        const xMax = globalMax + padding;

        // Player breakdown KDE
        const datasets = TRACKED_PLAYERS.map(player => {
            const kde = computeKDE(playerValues[player], xMin, xMax, bandwidth, 100);
            return {
                label: getDisplayName(player),
                data: kde.x.map((x, i) => ({ x: x, y: kde.y[i] })),
                borderColor: PLAYER_COLORS[player],
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                fill: false
            };
        });

        const ctxPlayer = document.getElementById(playerCanvasId).getContext('2d');
        new Chart(ctxPlayer, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { boxWidth: 12, padding: 8 } }
                },
                scales: {
                    x: {
                        type: 'linear',
                        min: xMin,
                        max: xMax,
                        title: { display: true, text: 'Value per Game' }
                    },
                    y: {
                        title: { display: true, text: 'Density' },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Render all additional stat KDEs
    function renderAdditionalStats() {
        renderStatKDE('Conservation', 'conservation-player-kde', 3);
        renderStatKDE('Appeal', 'appeal-player-kde', 3);
        renderStatKDE('Reputation', 'reputation-player-kde', 2);
        renderStatKDE('Number of breaks triggered', 'breaks-player-kde', 0.5);
        renderStatKDE('Played sponsors', 'sponsors-player-kde', 1);
        renderStatKDE('Played animals', 'animals-player-kde', 1);
    }

    // Cards drawn KDE by player
    function renderCardsDrawnKDE() {
        const playerValues = {};
        TRACKED_PLAYERS.forEach(player => {
            playerValues[player] = [];
        });

        gamesData.forEach(game => {
            const stats = game.stats['Cards drawn from deck'] || {};
            TRACKED_PLAYERS.forEach(player => {
                const val = parseInt(stats[player]) || 0;
                playerValues[player].push(val);
            });
        });

        // Find global range across all data
        const allValues = Object.values(playerValues).flat();
        const globalMin = Math.min(...allValues);
        const globalMax = Math.max(...allValues);
        const padding = Math.max(1, (globalMax - globalMin) * 0.1);
        const xMin = Math.max(0, globalMin - padding);
        const xMax = globalMax + padding;

        const bandwidth = 2;

        // Player breakdown KDE
        const datasets = TRACKED_PLAYERS.map(player => {
            const kde = computeKDE(playerValues[player], xMin, xMax, bandwidth, 100);
            return {
                label: getDisplayName(player),
                data: kde.x.map((x, i) => ({ x: x, y: kde.y[i] })),
                borderColor: PLAYER_COLORS[player],
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                fill: false
            };
        });

        const ctx = document.getElementById('cards-drawn-player-kde').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { boxWidth: 12, padding: 8 } }
                },
                scales: {
                    x: {
                        type: 'linear',
                        min: xMin,
                        max: xMax,
                        title: { display: true, text: 'Cards Drawn per Game' }
                    },
                    y: {
                        title: { display: true, text: 'Density' },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Point disparity (appeal vs conservation)
    function renderPointDisparity() {
        // Appeal points = appeal
        // Conservation points = 10*2 + (conservation - 10)*3 = 3*conservation - 10
        // Only include players with final score >= 100
        const playerStats = {};

        TRACKED_PLAYERS.forEach(player => {
            playerStats[player] = {
                totalAppealPts: 0,
                totalConservationPts: 0,
                games: 0
            };
        });

        gamesData.forEach(game => {
            const appeal = game.stats['Appeal'] || {};
            const conservation = game.stats['Conservation'] || {};
            const results = game.stats['Game result'] || {};

            TRACKED_PLAYERS.forEach(player => {
                // Check if player's score >= 100
                const result = results[player];
                if (!result) return;
                const scoreMatch = result.match(/\((\d+)\)/);
                const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
                if (score < 100) return;

                const appealVal = parseInt(appeal[player]) || 0;
                const conservationVal = parseInt(conservation[player]) || 0;

                const appealPts = appealVal;
                const conservationPts = 3 * conservationVal - 10;

                playerStats[player].totalAppealPts += appealPts;
                playerStats[player].totalConservationPts += conservationPts;
                playerStats[player].games++;
            });
        });

        // Sort by disparity (appeal - conservation)
        const sorted = TRACKED_PLAYERS
            .map(player => {
                const stats = playerStats[player];
                const avgAppeal = stats.games > 0 ? stats.totalAppealPts / stats.games : 0;
                const avgConservation = stats.games > 0 ? stats.totalConservationPts / stats.games : 0;
                const disparity = avgAppeal - avgConservation;
                return { player, avgAppeal, avgConservation, disparity };
            })
            .sort((a, b) => b.disparity - a.disparity);

        const tbody = document.querySelector('#disparity-table tbody');
        tbody.innerHTML = sorted.map(s => {
            const color = PLAYER_COLORS[s.player];
            const disparityColor = s.disparity >= 0 ? '#ef4444' : '#22c55e';
            const disparitySign = s.disparity >= 0 ? '+' : '';
            return `
                <tr>
                    <td style="color: ${color}; font-weight: bold;">${getDisplayName(s.player)}</td>
                    <td>${s.avgAppeal.toFixed(1)}</td>
                    <td>${s.avgConservation.toFixed(1)}</td>
                    <td style="color: ${disparityColor}; font-weight: bold;">${disparitySign}${s.disparity.toFixed(1)}</td>
                </tr>
            `;
        }).join('');
    }

    // Disparity distribution (all players vs winners)
    // Only include players with final score >= 100
    function renderDisparityDistribution() {
        const allDisparities = [];
        const winnerDisparities = [];

        gamesData.forEach(game => {
            const appeal = game.stats['Appeal'] || {};
            const conservation = game.stats['Conservation'] || {};
            const results = game.stats['Game result'] || {};

            TRACKED_PLAYERS.forEach(player => {
                const result = results[player];
                if (!result) return;
                const scoreMatch = result.match(/\((\d+)\)/);
                const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
                if (score < 100) return;

                const appealVal = parseInt(appeal[player]) || 0;
                const conservationVal = parseInt(conservation[player]) || 0;

                const appealPts = appealVal;
                const conservationPts = 3 * conservationVal - 10;
                const disparity = appealPts - conservationPts;

                allDisparities.push(disparity);

                if (result.startsWith('1st')) {
                    winnerDisparities.push(disparity);
                }
            });
        });

        // Find global range
        const allValues = [...allDisparities, ...winnerDisparities];
        const globalMin = Math.min(...allValues);
        const globalMax = Math.max(...allValues);
        const padding = (globalMax - globalMin) * 0.1;
        const xMin = globalMin - padding;
        const xMax = globalMax + padding;

        // Compute KDEs
        const bandwidth = 5;
        const kdeAll = computeKDE(allDisparities, xMin, xMax, bandwidth, 100);
        const kdeWinners = computeKDE(winnerDisparities, xMin, xMax, bandwidth, 100);

        const datasets = [
            {
                label: 'All Players',
                data: kdeAll.x.map((x, i) => ({ x: x, y: kdeAll.y[i] })),
                borderColor: '#6b7280',
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                fill: false
            },
            {
                label: 'Winners Only',
                data: kdeWinners.x.map((x, i) => ({ x: x, y: kdeWinners.y[i] })),
                borderColor: '#ffd700',
                backgroundColor: '#ffd70040',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                fill: true
            }
        ];

        const ctx = document.getElementById('disparity-kde-chart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Point Disparity (+ = more appeal, - = more conservation)' }
                    },
                    y: {
                        title: { display: true, text: 'Density' },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Disparity histograms by player
    // Only include games where player's final score >= 100
    function renderDisparityByPlayer() {
        const playerDisparities = {};
        TRACKED_PLAYERS.forEach(player => {
            playerDisparities[player] = [];
        });

        gamesData.forEach(game => {
            const appeal = game.stats['Appeal'] || {};
            const conservation = game.stats['Conservation'] || {};
            const results = game.stats['Game result'] || {};

            TRACKED_PLAYERS.forEach(player => {
                const result = results[player];
                if (!result) return;
                const scoreMatch = result.match(/\((\d+)\)/);
                const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
                if (score < 100) return;

                const appealVal = parseInt(appeal[player]) || 0;
                const conservationVal = parseInt(conservation[player]) || 0;

                const appealPts = appealVal;
                const conservationPts = 3 * conservationVal - 10;
                const disparity = appealPts - conservationPts;

                playerDisparities[player].push(disparity);
            });
        });

        // Find global min/max for consistent binning
        const allDisparities = Object.values(playerDisparities).flat();
        const minDisparity = Math.min(...allDisparities);
        const maxDisparity = Math.max(...allDisparities);

        // Create bins (width of 10)
        const binWidth = 10;
        const binStart = Math.floor(minDisparity / binWidth) * binWidth;
        const binEnd = Math.ceil(maxDisparity / binWidth) * binWidth;

        const binLabels = [];
        for (let i = binStart; i < binEnd; i += binWidth) {
            binLabels.push(`${i}`);
        }

        const playerCanvasMap = {
            'msiebert': 'disparity-matt',
            'marksbrt': 'disparity-mark',
            'AstroHood': 'disparity-callie',
            'siebert23': 'disparity-keith'
        };

        TRACKED_PLAYERS.forEach(player => {
            const disparities = playerDisparities[player];
            const bins = new Array(binLabels.length).fill(0);

            disparities.forEach(d => {
                const binIndex = Math.floor((d - binStart) / binWidth);
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
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { stepSize: 1 },
                            title: { display: true, text: 'Games' }
                        },
                        x: {
                            title: { display: true, text: 'Disparity' }
                        }
                    }
                }
            });
        });
    }

    // Total animal icons by player
    function renderAnimalIconTotals() {
        const animalTypes = [
            { key: 'Bird icons', label: 'Birds' },
            { key: 'Predator icons', label: 'Predators' },
            { key: 'Herbivore icons', label: 'Herbivores' },
            { key: 'Reptile icons', label: 'Reptiles' },
            { key: 'Primate icons', label: 'Primates' },
            { key: 'Sea Animal icons', label: 'Sea Animals' },
            { key: 'Petting Zoo icons', label: 'Petting Zoo' },
            { key: 'Bear icons', label: 'Bears' }
        ];

        // Calculate totals per player per category
        const playerTotals = {};
        TRACKED_PLAYERS.forEach(player => {
            playerTotals[player] = {};
            animalTypes.forEach(type => {
                playerTotals[player][type.key] = 0;
            });
        });

        gamesData.forEach(game => {
            animalTypes.forEach(type => {
                const iconStats = game.stats[type.key] || {};
                TRACKED_PLAYERS.forEach(player => {
                    playerTotals[player][type.key] += parseInt(iconStats[player]) || 0;
                });
            });
        });

        // Build table rows - each row is a category with players sorted by count
        const tbody = document.querySelector('#animal-totals-table tbody');
        tbody.innerHTML = animalTypes.map(type => {
            // Sort players by their total for this category
            const sortedPlayers = [...TRACKED_PLAYERS].sort((a, b) =>
                playerTotals[b][type.key] - playerTotals[a][type.key]
            );

            return `
                <tr>
                    <td><strong>${type.label}</strong></td>
                    ${sortedPlayers.map((player) => {
                        const count = playerTotals[player][type.key];
                        const color = PLAYER_COLORS[player];
                        return `<td style="color: ${color}; font-weight: bold;">${getDisplayName(player)} (${count})</td>`;
                    }).join('')}
                </tr>
            `;
        }).join('');
    }

    // Total continent icons by player
    function renderContinentIconTotals() {
        const continentTypes = [
            { key: 'Africa icons', label: 'Africa' },
            { key: 'Americas icons', label: 'Americas' },
            { key: 'Asia icons', label: 'Asia' },
            { key: 'Europe icons', label: 'Europe' },
            { key: 'Australia icons', label: 'Australia' }
        ];

        // Calculate totals per player per category
        const playerTotals = {};
        TRACKED_PLAYERS.forEach(player => {
            playerTotals[player] = {};
            continentTypes.forEach(type => {
                playerTotals[player][type.key] = 0;
            });
        });

        gamesData.forEach(game => {
            continentTypes.forEach(type => {
                const iconStats = game.stats[type.key] || {};
                TRACKED_PLAYERS.forEach(player => {
                    playerTotals[player][type.key] += parseInt(iconStats[player]) || 0;
                });
            });
        });

        // Build table rows - each row is a category with players sorted by count
        const tbody = document.querySelector('#continent-totals-table tbody');
        tbody.innerHTML = continentTypes.map(type => {
            // Sort players by their total for this category
            const sortedPlayers = [...TRACKED_PLAYERS].sort((a, b) =>
                playerTotals[b][type.key] - playerTotals[a][type.key]
            );

            return `
                <tr>
                    <td><strong>${type.label}</strong></td>
                    ${sortedPlayers.map((player) => {
                        const count = playerTotals[player][type.key];
                        const color = PLAYER_COLORS[player];
                        return `<td style="color: ${color}; font-weight: bold;">${getDisplayName(player)} (${count})</td>`;
                    }).join('')}
                </tr>
            `;
        }).join('');
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

    // Convert win rate (0-1) to color (red to green)
    function winRateToColor(winRate) {
        // 0% = red, 25% = orange, 50% = yellow, 75%+ = green
        const r = Math.round(255 * Math.max(0, Math.min(1, 2 - 4 * winRate)));
        const g = Math.round(255 * Math.max(0, Math.min(1, 4 * winRate - 0)));
        const b = 0;
        return `rgba(${r}, ${g}, ${b}, 0.8)`;
    }

    // Total map selection histogram
    function renderMapSelectionTotal() {
        const mapCounts = {};
        const mapWins = {};

        gamesData.forEach(game => {
            const maps = game.stats['Map'] || {};
            const results = game.stats['Game result'] || {};

            Object.entries(maps).forEach(([player, mapName]) => {
                if (mapName && mapName !== '-') {
                    mapCounts[mapName] = (mapCounts[mapName] || 0) + 1;
                    if (!mapWins[mapName]) mapWins[mapName] = 0;

                    const result = results[player];
                    if (result && result.startsWith('1st')) {
                        mapWins[mapName]++;
                    }
                }
            });
        });

        // Sort by count descending
        const sorted = Object.entries(mapCounts).sort((a, b) => b[1] - a[1]);
        const labels = sorted.map(([name]) => name);
        const data = sorted.map(([, count]) => count);
        const colors = sorted.map(([name, count]) => {
            const winRate = count > 0 ? (mapWins[name] || 0) / count : 0;
            return winRateToColor(winRate);
        });

        const ctx = document.getElementById('map-selection-chart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Times Selected',
                    data: data,
                    backgroundColor: colors,
                    borderColor: colors.map(c => c.replace('0.8', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            afterLabel: function(context) {
                                const mapName = context.label;
                                const count = mapCounts[mapName];
                                const wins = mapWins[mapName] || 0;
                                const winRate = count > 0 ? ((wins / count) * 100).toFixed(0) : 0;
                                return `Win rate: ${winRate}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 },
                        title: { display: true, text: 'Times Selected' }
                    },
                    x: {
                        title: { display: true, text: 'Map' }
                    }
                }
            }
        });
    }

    // Map selection by player
    function renderMapSelectionByPlayer() {
        // Collect all map names first
        const allMapsSet = new Set();
        const playerMapCounts = {};
        const playerMapWins = {};

        TRACKED_PLAYERS.forEach(player => {
            playerMapCounts[player] = {};
            playerMapWins[player] = {};
        });

        gamesData.forEach(game => {
            const maps = game.stats['Map'] || {};
            const results = game.stats['Game result'] || {};

            Object.entries(maps).forEach(([player, mapName]) => {
                if (!TRACKED_PLAYERS.includes(player)) return;
                if (mapName && mapName !== '-') {
                    allMapsSet.add(mapName);
                    playerMapCounts[player][mapName] = (playerMapCounts[player][mapName] || 0) + 1;
                    if (!playerMapWins[player][mapName]) playerMapWins[player][mapName] = 0;

                    const result = results[player];
                    if (result && result.startsWith('1st')) {
                        playerMapWins[player][mapName]++;
                    }
                }
            });
        });

        // Sort maps by total usage
        const mapTotals = {};
        allMapsSet.forEach(map => {
            mapTotals[map] = TRACKED_PLAYERS.reduce((sum, player) =>
                sum + (playerMapCounts[player][map] || 0), 0);
        });
        const sortedMaps = [...allMapsSet].sort((a, b) => mapTotals[b] - mapTotals[a]);

        const playerCanvasMap = {
            'msiebert': 'map-selection-matt',
            'marksbrt': 'map-selection-mark',
            'AstroHood': 'map-selection-callie',
            'siebert23': 'map-selection-keith'
        };

        TRACKED_PLAYERS.forEach(player => {
            const data = sortedMaps.map(map => playerMapCounts[player][map] || 0);
            const colors = sortedMaps.map(map => {
                const count = playerMapCounts[player][map] || 0;
                const wins = playerMapWins[player][map] || 0;
                const winRate = count > 0 ? wins / count : 0;
                return winRateToColor(winRate);
            });

            const ctx = document.getElementById(playerCanvasMap[player]).getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: sortedMaps,
                    datasets: [{
                        label: 'Times Selected',
                        data: data,
                        backgroundColor: colors,
                        borderColor: colors.map(c => c.replace('0.8', '1')),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                afterLabel: function(context) {
                                    const mapName = context.label;
                                    const count = playerMapCounts[player][mapName] || 0;
                                    const wins = playerMapWins[player][mapName] || 0;
                                    const winRate = count > 0 ? ((wins / count) * 100).toFixed(0) : 0;
                                    return `Win rate: ${winRate}%`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { stepSize: 1 },
                            title: { display: true, text: 'Times Selected' }
                        },
                        x: {
                            title: { display: true, text: 'Map' }
                        }
                    }
                }
            });
        });
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

    // Top cards by player
    async function renderTopCards() {
        try {
            const response = await fetch('data/card_analysis.json');
            const data = await response.json();
            const topCards = data.topCardsByPlayer || {};

            // Aggregate cards across all players
            const allCards = {};
            TRACKED_PLAYERS.forEach(player => {
                (topCards[player] || []).forEach(item => {
                    allCards[item.card] = (allCards[item.card] || 0) + item.plays;
                });
            });

            // Sort cards by play count
            const sortedCards = Object.entries(allCards)
                .sort((a, b) => b[1] - a[1]);

            // Get top 20
            const overallTop20 = sortedCards.slice(0, 20);

            // Render top cards histogram
            const topCtx = document.getElementById('top-cards-overall').getContext('2d');
            new Chart(topCtx, {
                type: 'bar',
                data: {
                    labels: overallTop20.map(([card]) => card),
                    datasets: [{
                        label: 'Total Plays',
                        data: overallTop20.map(([, plays]) => plays),
                        backgroundColor: '#8b5cf6',
                        borderColor: '#7c3aed',
                        borderWidth: 1
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            title: { display: true, text: 'Total Plays' },
                            ticks: { stepSize: 1 }
                        }
                    }
                }
            });

            // Get bottom 20 (least played, but still >= 2 plays total)
            const leastPlayed = sortedCards
                .filter(([, plays]) => plays >= 2)
                .slice(-20)
                .reverse();

            // Render least cards histogram
            const leastCtx = document.getElementById('least-cards-overall').getContext('2d');
            new Chart(leastCtx, {
                type: 'bar',
                data: {
                    labels: leastPlayed.map(([card]) => card),
                    datasets: [{
                        label: 'Total Plays',
                        data: leastPlayed.map(([, plays]) => plays),
                        backgroundColor: '#f97316',
                        borderColor: '#ea580c',
                        borderWidth: 1
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            title: { display: true, text: 'Total Plays' },
                            ticks: { stepSize: 1 }
                        }
                    }
                }
            });

            // Tally cards played by winners and last place
            const cardsPerGame = data.cardsPerGame || {};
            const winnerCards = {};
            const loserCards = {};

            gamesData.forEach(game => {
                const tableId = game.tableId;
                const gameCards = cardsPerGame[tableId];
                if (!gameCards) return;

                // Find winner and last place of this game
                const results = game.stats['Game result'] || {};
                let winner = null;
                let loser = null;
                Object.entries(results).forEach(([player, result]) => {
                    if (result.startsWith('1')) {
                        winner = player;
                    }
                    if (result.startsWith('4')) {
                        loser = player;
                    }
                });

                if (winner && gameCards[winner]) {
                    gameCards[winner].forEach(card => {
                        winnerCards[card] = (winnerCards[card] || 0) + 1;
                    });
                }

                if (loser && gameCards[loser]) {
                    gameCards[loser].forEach(card => {
                        loserCards[card] = (loserCards[card] || 0) + 1;
                    });
                }
            });

            // Get top 20 winner cards
            const topWinnerCards = Object.entries(winnerCards)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20);

            // Render winner cards histogram
            const winnerCtx = document.getElementById('winner-cards-overall').getContext('2d');
            new Chart(winnerCtx, {
                type: 'bar',
                data: {
                    labels: topWinnerCards.map(([card]) => card),
                    datasets: [{
                        label: 'Plays by Winner',
                        data: topWinnerCards.map(([, plays]) => plays),
                        backgroundColor: '#ffd700',
                        borderColor: '#b8960c',
                        borderWidth: 1
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            title: { display: true, text: 'Times Played by Winner' },
                            ticks: { stepSize: 1 }
                        }
                    }
                }
            });

            // Get top 20 loser cards
            const topLoserCards = Object.entries(loserCards)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20);

            // Render loser cards histogram
            const loserCtx = document.getElementById('loser-cards-overall').getContext('2d');
            new Chart(loserCtx, {
                type: 'bar',
                data: {
                    labels: topLoserCards.map(([card]) => card),
                    datasets: [{
                        label: 'Plays by Last Place',
                        data: topLoserCards.map(([, plays]) => plays),
                        backgroundColor: '#6b7280',
                        borderColor: '#4b5563',
                        borderWidth: 1
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            title: { display: true, text: 'Times Played by Last Place' },
                            ticks: { stepSize: 1 }
                        }
                    }
                }
            });

            // Render player tables
            const playerTableMap = {
                'msiebert': 'top-cards-matt',
                'marksbrt': 'top-cards-mark',
                'AstroHood': 'top-cards-callie',
                'siebert23': 'top-cards-keith'
            };

            TRACKED_PLAYERS.forEach(player => {
                const tableId = playerTableMap[player];
                const table = document.getElementById(tableId);
                if (!table) return;

                const tbody = table.querySelector('tbody');
                const cards = (topCards[player] || []).slice(0, 10);

                tbody.innerHTML = cards.map((item, idx) => `
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${item.card}</td>
                        <td>${item.plays}</td>
                    </tr>
                `).join('');
            });
        } catch (error) {
            console.error('Failed to load card analysis:', error);
        }
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
