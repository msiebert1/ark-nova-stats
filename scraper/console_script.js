fetch('/gamestats/gamestats/getGames.html?game=arknova&finished=1&limit=100&player=95147106',{credentials:'include'}).then(r=>r.json()).then(d=>console.log(JSON.stringify(d,null,2)))
