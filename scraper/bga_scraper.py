#!/usr/bin/env python3
"""
BGA Ark Nova Stats Scraper

Scrapes game history from Board Game Arena for Ark Nova games.
Requires a BGA account with game history.

Usage (cookie-based auth - recommended):
    python bga_scraper.py --cookies cookies.json

    To export cookies:
    1. Log into boardgamearena.com in your browser
    2. Install a cookie export extension (e.g., "Cookie-Editor" for Chrome/Firefox)
    3. Export cookies for boardgamearena.com as JSON
    4. Save to cookies.json

Legacy usage (no longer works - BGA moved to OAuth):
    python bga_scraper.py --config config.json
    python bga_scraper.py --email YOUR_EMAIL --password YOUR_PASSWORD
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

try:
    import requests
except ImportError:
    print("Error: requests library required. Install with: pip install requests")
    sys.exit(1)

# BGA URLs
BGA_BASE = "https://boardgamearena.com"
BGA_EN_BASE = "https://en.boardgamearena.com"
BGA_LOGIN_URL = f"{BGA_EN_BASE}/account/account/login.html"
BGA_GAMES_URL = f"{BGA_EN_BASE}/gamestats/gamestats/getGames.html"
BGA_TABLE_URL = f"{BGA_EN_BASE}/table/table/tableinfos.html"

# Ark Nova game ID on BGA
ARK_NOVA_GAME_ID = "arknova"


class BGAScraper:
    def __init__(self, email: str = None, password: str = None):
        self.email = email
        self.password = password
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
        })
        self.logged_in = False

    def load_cookies(self, cookies_path: Path) -> bool:
        """Load cookies from a JSON file exported from browser."""
        if not cookies_path.exists():
            logger.error(f"Cookies file not found: {cookies_path}")
            return False

        try:
            with open(cookies_path) as f:
                cookies = json.load(f)

            # Handle different cookie export formats
            for cookie in cookies:
                # Cookie-Editor format
                if isinstance(cookie, dict):
                    name = cookie.get("name")
                    value = cookie.get("value")
                    domain = cookie.get("domain", ".boardgamearena.com")
                    if name and value:
                        self.session.cookies.set(
                            name, value,
                            domain=domain.lstrip("."),
                            path=cookie.get("path", "/")
                        )

            logger.info(f"Loaded {len(cookies)} cookies from {cookies_path}")
            return True
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in cookies file: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to load cookies: {e}")
            return False

    def verify_session(self) -> bool:
        """Verify the session is authenticated by checking a protected endpoint."""
        logger.info("Verifying session authentication...")

        try:
            # Try to access game stats - this requires authentication
            response = self.session.get(
                f"{BGA_EN_BASE}/gamestats",
                timeout=30,
                allow_redirects=False
            )

            # If we get redirected to login, we're not authenticated
            if response.status_code == 302:
                location = response.headers.get("Location", "")
                if "account" in location or "login" in location:
                    logger.error("Session not authenticated (redirected to login)")
                    return False

            # Check if we can access user-specific content
            response = self.session.get(BGA_EN_BASE, timeout=30)
            if "'user_status': 'logged'" in response.text or "'id':" in response.text:
                logger.info("Session verified - authenticated!")
                self.logged_in = True
                return True

            # Alternative check - try the games endpoint
            test_response = self.session.get(
                BGA_GAMES_URL,
                params={"game": ARK_NOVA_GAME_ID, "finished": 1, "limit": 1},
                timeout=30
            )
            if test_response.status_code == 200:
                try:
                    data = test_response.json()
                    if data.get("status") == "1":
                        logger.info("Session verified via API - authenticated!")
                        self.logged_in = True
                        return True
                except json.JSONDecodeError:
                    pass

            logger.error("Session verification failed - cookies may be expired")
            return False

        except Exception as e:
            logger.error(f"Session verification error: {e}")
            return False

    def login(self) -> bool:
        """Legacy login method - BGA now uses OAuth, so this likely won't work."""
        logger.warning("Direct login is deprecated - BGA now uses Asmodee OAuth")
        logger.warning("Please use --cookies with exported browser cookies instead")

        # First, get the main page to establish session and cookies
        self.session.get(BGA_EN_BASE, timeout=30)

        # Login request (kept for backwards compatibility, but unlikely to work)
        login_data = {
            "email": self.email,
            "password": self.password,
            "rememberme": "on",
            "form_id": "loginform",
        }

        response = self.session.post(BGA_LOGIN_URL, data=login_data, timeout=30)

        # Check if login succeeded by looking for error indicators
        if response.status_code == 200:
            try:
                result = response.json()
                if result.get("status") == "1" or result.get("success"):
                    logger.info("Login successful!")
                    self.logged_in = True
                    return True
                else:
                    logger.error(f"Login failed: {result.get('error', 'Unknown error')}")
                    return False
            except json.JSONDecodeError:
                # Response might not be JSON, check for redirect or success indicators
                if "logout" in response.text.lower() or response.url != BGA_LOGIN_URL:
                    logger.info("Login successful!")
                    self.logged_in = True
                    return True

        logger.error(f"Login failed with status {response.status_code}")
        logger.error("TIP: Export cookies from your browser and use --cookies instead")
        return False

    def get_game_history(self, player_id: str = None, limit: int = 100) -> list:
        """Fetch Ark Nova game history."""
        if not self.logged_in:
            raise RuntimeError("Not logged in. Call login() first.")

        logger.info(f"Fetching Ark Nova game history (limit: {limit})...")

        params = {
            "game": ARK_NOVA_GAME_ID,
            "finished": 1,
            "limit": limit,
        }

        if player_id:
            params["player"] = player_id

        response = self.session.get(BGA_GAMES_URL, params=params, timeout=30)

        if response.status_code != 200:
            logger.error(f"Failed to fetch games: {response.status_code}")
            return []

        try:
            data = response.json()
            if data.get("status") == "1" and "data" in data:
                tables = data["data"].get("tables", [])
                logger.info(f"Found {len(tables)} games")
                return tables
            else:
                logger.error(f"Unexpected response format: {data}")
                return []
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse response: {e}")
            return []

    def get_table_details(self, table_id: str) -> dict:
        """Get detailed information about a specific game table."""
        params = {
            "id": table_id,
        }

        response = self.session.get(BGA_TABLE_URL, params=params, timeout=30)

        if response.status_code == 200:
            try:
                data = response.json()
                if data.get("status") == "1":
                    return data.get("data", {})
            except json.JSONDecodeError:
                pass

        return {}

    def parse_game(self, table_data: dict) -> dict:
        """Parse raw table data into our game format."""
        table_id = table_data.get("table_id", table_data.get("id", ""))

        # Parse date
        end_date = table_data.get("end", table_data.get("end_date", ""))
        if end_date:
            try:
                # BGA uses Unix timestamp
                if isinstance(end_date, (int, float)) or end_date.isdigit():
                    dt = datetime.fromtimestamp(int(end_date))
                    date_str = dt.strftime("%Y-%m-%d")
                else:
                    date_str = end_date[:10]  # Take YYYY-MM-DD part
            except (ValueError, TypeError):
                date_str = str(end_date)[:10]
        else:
            date_str = "Unknown"

        # Parse players and scores
        players = []
        player_data = table_data.get("players", table_data.get("player", {}))

        if isinstance(player_data, dict):
            for pid, pinfo in player_data.items():
                player = {
                    "name": pinfo.get("name", pinfo.get("fullname", f"Player_{pid}")),
                    "score": int(pinfo.get("score", 0)),
                    "rank": int(pinfo.get("rank", pinfo.get("gamerank", 0))),
                }
                players.append(player)
        elif isinstance(player_data, list):
            for pinfo in player_data:
                player = {
                    "name": pinfo.get("name", pinfo.get("fullname", "Unknown")),
                    "score": int(pinfo.get("score", 0)),
                    "rank": int(pinfo.get("rank", pinfo.get("gamerank", 0))),
                }
                players.append(player)

        # Sort by rank
        players.sort(key=lambda p: p["rank"])

        # Get map and turns (may need table details)
        # Note: Map info might be in options or game-specific data
        options = table_data.get("options", {})
        map_name = "Unknown"
        turns = 0

        # Try to extract map from options
        if isinstance(options, dict):
            for key, value in options.items():
                if "map" in key.lower():
                    map_name = str(value)
                    break

        # Turns might be in gameresult or stats
        game_result = table_data.get("gameresult", {})
        if isinstance(game_result, dict):
            turns = game_result.get("turns", game_result.get("round", 0))

        return {
            "id": str(table_id),
            "date": date_str,
            "map": map_name,
            "turns": int(turns),
            "players": players,
            "url": f"{BGA_BASE}/table?table={table_id}",
        }

    def scrape_all_games(self, limit: int = 100) -> list:
        """Scrape all Ark Nova games and return formatted data."""
        tables = self.get_game_history(limit=limit)

        games = []
        for i, table in enumerate(tables):
            logger.debug(f"Processing game {i+1}/{len(tables)}...")
            game = self.parse_game(table)
            if game["players"]:  # Only add games with player data
                games.append(game)

        logger.info(f"Processed {len(games)} games successfully")
        return games


def save_games(games: list, output_path: Path):
    """Save games to JSON file."""
    data = {
        "lastUpdated": datetime.utcnow().isoformat() + "Z",
        "games": games,
    }

    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)

    logger.info(f"Saved {len(games)} games to {output_path}")


def load_config(config_path: Path) -> dict:
    """Load configuration from JSON file."""
    if not config_path.exists():
        logger.error(f"Config file not found: {config_path}")
        return {}

    try:
        with open(config_path) as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in config file: {e}")
        return {}


def main():
    parser = argparse.ArgumentParser(description="Scrape Ark Nova games from BGA")
    parser.add_argument("--cookies", "-k", help="Path to cookies JSON file (recommended)")
    parser.add_argument("--config", "-c", help="Path to config JSON file (legacy)")
    parser.add_argument("--email", "-e", help="BGA email - deprecated, use --cookies")
    parser.add_argument("--password", "-p", help="BGA password - deprecated, use --cookies")
    parser.add_argument("--limit", "-l", type=int, default=100, help="Max games to fetch")
    parser.add_argument("--output", "-o", default="../data/games.json", help="Output file path")

    args = parser.parse_args()

    script_dir = Path(__file__).parent

    # Load config file if specified
    config = {}
    if args.config:
        config_path = Path(args.config)
        if not config_path.is_absolute():
            config_path = script_dir / config_path
        config = load_config(config_path)

    # Check for cookies file: args > config > default location
    cookies_path = None
    if args.cookies:
        cookies_path = Path(args.cookies)
        if not cookies_path.is_absolute():
            cookies_path = script_dir / cookies_path
    elif config.get("cookies"):
        cookies_path = Path(config["cookies"])
        if not cookies_path.is_absolute():
            cookies_path = script_dir / cookies_path
    elif (script_dir / "cookies.json").exists():
        cookies_path = script_dir / "cookies.json"

    # Get legacy credentials: args > config > environment
    email = args.email or config.get("email") or os.environ.get("BGA_EMAIL")
    password = args.password or config.get("password") or os.environ.get("BGA_PASSWORD")
    limit = args.limit if args.limit != 100 else config.get("limit", 100)

    # Resolve output path
    output_path = (script_dir / args.output).resolve()

    logger.info(f"Starting Ark Nova stats scraper at {datetime.now().isoformat()}")

    # Create scraper
    scraper = BGAScraper(email, password)

    # Try cookie-based auth first (preferred)
    if cookies_path:
        logger.info(f"Using cookie-based authentication from {cookies_path}")
        if not scraper.load_cookies(cookies_path):
            logger.error("Failed to load cookies")
            sys.exit(1)
        if not scraper.verify_session():
            logger.error("Cookie session is not valid or expired")
            logger.error("Please re-export cookies from your browser after logging in")
            sys.exit(1)
    elif email and password:
        # Fall back to legacy login (unlikely to work)
        logger.warning("Using legacy email/password login (may not work)")
        if not scraper.login():
            logger.error("Failed to log in to BGA")
            logger.error("")
            logger.error("BGA now uses Asmodee OAuth. To use this scraper:")
            logger.error("  1. Log into boardgamearena.com in your browser")
            logger.error("  2. Install 'Cookie-Editor' browser extension")
            logger.error("  3. Export cookies as JSON to cookies.json")
            logger.error("  4. Run: python bga_scraper.py --cookies cookies.json")
            sys.exit(1)
    else:
        logger.error("Authentication required.")
        logger.error("")
        logger.error("Recommended: Use cookie-based authentication:")
        logger.error("  1. Log into boardgamearena.com in your browser")
        logger.error("  2. Install 'Cookie-Editor' browser extension")
        logger.error("  3. Export cookies as JSON to cookies.json")
        logger.error("  4. Run: python bga_scraper.py --cookies cookies.json")
        logger.error("")
        logger.error("Or specify cookies path in config.json:")
        logger.error('  {"cookies": "path/to/cookies.json", "limit": 100}')
        sys.exit(1)

    games = scraper.scrape_all_games(limit=limit)

    if games:
        save_games(games, output_path)
        logger.info("Scrape completed successfully")
    else:
        logger.warning("No games found")
        sys.exit(0)


if __name__ == "__main__":
    main()
