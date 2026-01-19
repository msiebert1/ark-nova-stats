copy(JSON.stringify({exportedAt:new Date().toISOString(),games:JSON.parse(localStorage.getItem('arkNovaGames'))},null,2));alert('Copied!')
