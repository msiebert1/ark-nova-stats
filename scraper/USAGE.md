# BGA Ark Nova Stats Scraper

Two methods to export your Ark Nova game history from Board Game Arena.

## Method 1: Browser Bookmarklet (Recommended)

The easiest way - runs directly in your browser.

### Setup

1. Create a new bookmark in your browser
2. Name it: `Export Ark Nova Stats`
3. For the URL, copy this entire line:

```
javascript:(function(){'use strict';const GAME_NAME='arknova';async function fetchGamesFromAPI(){const games=[];try{const playerMatch=window.location.href.match(/player=(\d+)/);const playerId=playerMatch?.[1]||'';const response=await fetch(`https://boardgamearena.com/gamestats/gamestats/getGames.html?game=${GAME_NAME}&finished=1&limit=100${playerId?'&player='+playerId:''}`,{credentials:'include'});if(!response.ok)throw new Error('API request failed');const data=await response.json();if(data.status==='1'&&data.data?.tables){for(const table of data.data.tables){const players=[];const playerData=table.players||table.player||{};if(typeof playerData==='object'){for(const[pid,pinfo]of Object.entries(playerData)){players.push({name:pinfo.name||pinfo.fullname||`Player_${pid}`,score:parseInt(pinfo.score)||0,rank:parseInt(pinfo.rank||pinfo.gamerank)||0});}}players.sort((a,b)=>a.rank-b.rank);let dateStr='Unknown';const endDate=table.end||table.end_date;if(endDate){if(typeof endDate==='number'||/^\d+$/.test(endDate)){dateStr=new Date(parseInt(endDate)*1000).toISOString().split('T')[0];}else{dateStr=String(endDate).slice(0,10);}}if(players.length>0){games.push({id:String(table.table_id||table.id),date:dateStr,map:'Unknown',turns:parseInt(table.gameresult?.turns||0),players:players,url:`https://boardgamearena.com/table?table=${table.table_id||table.id}`});}}}}catch(e){console.error('API fetch failed:',e);}return games;}async function exportStats(){const games=await fetchGamesFromAPI();if(games.length===0){alert('No Ark Nova games found! Make sure you are logged into BGA.');return;}const output={lastUpdated:new Date().toISOString(),games:games};const json=JSON.stringify(output,null,2);const modal=document.createElement('div');modal.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;';const content=document.createElement('div');content.style.cssText='background:white;padding:20px;border-radius:8px;max-width:800px;max-height:80vh;overflow:auto;width:100%;';content.innerHTML=`<h2 style="margin:0 0 10px 0;color:#2d5a27;">Ark Nova Stats Export</h2><p style="color:#666;">Found ${games.length} games. Copy and save to data/games.json</p><textarea id="bga-json" style="width:100%;height:300px;font-family:monospace;font-size:12px;padding:10px;border:1px solid #ddd;border-radius:4px;">${json}</textarea><div style="margin-top:10px;display:flex;gap:10px;"><button id="bga-copy" style="padding:10px 20px;background:#2d5a27;color:white;border:none;border-radius:4px;cursor:pointer;">Copy</button><button id="bga-dl" style="padding:10px 20px;background:#4a8c3f;color:white;border:none;border-radius:4px;cursor:pointer;">Download</button><button id="bga-close" style="padding:10px 20px;background:#666;color:white;border:none;border-radius:4px;cursor:pointer;">Close</button></div>`;modal.appendChild(content);document.body.appendChild(modal);document.getElementById('bga-copy').onclick=()=>{document.getElementById('bga-json').select();document.execCommand('copy');alert('Copied!');};document.getElementById('bga-dl').onclick=()=>{const blob=new Blob([json],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='games.json';a.click();};document.getElementById('bga-close').onclick=()=>modal.remove();modal.onclick=(e)=>{if(e.target===modal)modal.remove();};}exportStats();})();
```

### Usage

1. Log in to [Board Game Arena](https://boardgamearena.com)
2. Click the bookmarklet
3. A modal will appear with your game data
4. Click "Download" to save `games.json`
5. Move the file to `ark-nova-stats/data/games.json`

---

## Method 2: Python Scraper

More powerful, can fetch more games and run automatically.

### Requirements

- Python 3.7+
- `requests` library

### Setup

```bash
cd ark-nova-stats/scraper
pip install -r requirements.txt
```

### Usage

**Option A: Command line arguments**
```bash
python bga_scraper.py --email your@email.com --password yourpassword
```

**Option B: Environment variables**
```bash
export BGA_EMAIL=your@email.com
export BGA_PASSWORD=yourpassword
python bga_scraper.py
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--config`, `-c` | Path to config JSON file | - |
| `--email`, `-e` | BGA account email | `BGA_EMAIL` env var |
| `--password`, `-p` | BGA account password | `BGA_PASSWORD` env var |
| `--limit`, `-l` | Max games to fetch | 100 |
| `--output`, `-o` | Output file path | `../data/games.json` |

### Example

```bash
# Fetch last 200 games
python bga_scraper.py -e me@email.com -p mypass -l 200
```

**Option C: Config file (recommended for automation)**
```bash
# Copy the example config
cp config.example.json config.json

# Edit with your credentials
nano config.json

# Run with config
python bga_scraper.py --config config.json
```

---

## Automatic Scheduling (macOS)

Set up the scraper to run automatically every Sunday and Monday.

### Quick Setup

Run the setup script - it will guide you through the process:

```bash
cd ark-nova-stats/scraper
./setup_schedule.sh
```

The script will:
1. Check prerequisites (Python, requests library)
2. Help you create a config file with your BGA credentials
3. Test the scraper
4. Install the scheduled job

### Manual Setup

If you prefer to set things up manually:

**1. Create config file:**
```bash
cp config.example.json config.json
# Edit config.json with your BGA email and password
chmod 600 config.json  # Secure the file
```

**2. Test the scraper:**
```bash
python bga_scraper.py --config config.json
```

**3. Install the launchd job:**
```bash
cp com.arknova.stats.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.arknova.stats.plist
```

### Schedule Details

By default, the scraper runs at **9:00 AM** on:
- Sunday (day 0)
- Monday (day 1)

To change the schedule, edit `com.arknova.stats.plist` before installing.

### Managing the Schedule

```bash
# Check if the job is loaded
launchctl list | grep arknova

# View logs
tail -f ~/ark-nova-stats/scraper/logs/scraper.log

# Run manually
./run_scraper.sh

# Disable the schedule
launchctl unload ~/Library/LaunchAgents/com.arknova.stats.plist

# Re-enable the schedule
launchctl load ~/Library/LaunchAgents/com.arknova.stats.plist

# Completely remove
launchctl unload ~/Library/LaunchAgents/com.arknova.stats.plist
rm ~/Library/LaunchAgents/com.arknova.stats.plist
```

---

## Data Format

Both methods export JSON in this format:

```json
{
  "lastUpdated": "2025-01-16T00:00:00Z",
  "games": [
    {
      "id": "123456789",
      "date": "2025-01-15",
      "map": "Map A (Basic)",
      "turns": 45,
      "players": [
        { "name": "Player1", "score": 95, "rank": 1 },
        { "name": "Player2", "score": 87, "rank": 2 }
      ],
      "url": "https://boardgamearena.com/table?table=123456789"
    }
  ]
}
```

---

## Troubleshooting

**Bookmarklet shows no games:**
- Make sure you're logged into BGA
- Try refreshing the page first

**Python scraper login fails:**
- Double-check your email and password
- BGA may have rate limiting - wait and try again
- Your account may have 2FA enabled (not supported)

**Missing data (maps, turns):**
- Some game details aren't available from the history API
- You can manually add this data to the JSON file
