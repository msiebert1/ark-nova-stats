#!/usr/bin/env python3
"""
Ark Nova BGA Stats Scraper using Playwright

This script automates browser interaction to scrape game statistics.

Usage:
    1. First run: python playwright_scraper.py --login
       (This opens a browser for you to log in manually, then saves the session)

    2. Subsequent runs: python playwright_scraper.py
       (Uses saved session to scrape games)
"""

import asyncio
import json
import argparse
import re
from pathlib import Path
from datetime import datetime

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Playwright not installed. Run:")
    print("  pip install playwright")
    print("  playwright install chromium")
    exit(1)


PLAYER_ID = "95147106"
AUTH_FILE = Path(__file__).parent / "playwright_auth.json"
OUTPUT_FILE = Path(__file__).parent.parent / "data" / "detailed_games.json"


async def login_and_save_session():
    """Use existing Chrome profile to get logged-in session."""
    import os

    # Find Chrome user data directory
    home = os.path.expanduser("~")
    chrome_user_data = os.path.join(home, "Library", "Application Support", "Google", "Chrome")

    if not os.path.exists(chrome_user_data):
        print(f"Chrome user data not found at {chrome_user_data}")
        print("Make sure Chrome is installed and you've logged into BGA in Chrome.")
        return

    print("Launching Chrome with your existing profile...")
    print("NOTE: Close all other Chrome windows first!\n")

    async with async_playwright() as p:
        # Launch with user's Chrome profile
        context = await p.chromium.launch_persistent_context(
            user_data_dir=os.path.join(chrome_user_data, "Default"),
            headless=False,
            channel="chrome",  # Use installed Chrome
        )

        page = context.pages[0] if context.pages else await context.new_page()

        print("Opening BGA...")
        await page.goto("https://boardgamearena.com/")
        await asyncio.sleep(3)

        # Check if logged in
        is_logged_in = await page.evaluate("""
            () => document.body.innerHTML.includes("'user_status': 'logged'")
        """)

        if is_logged_in:
            print("Already logged in! Saving session...")
            await context.storage_state(path=str(AUTH_FILE))
            print(f"Session saved to {AUTH_FILE}")
        else:
            print("Not logged in. Please log in manually in the browser window.")
            print("Waiting up to 5 minutes...")

            for i in range(300):
                is_logged_in = await page.evaluate("""
                    () => document.body.innerHTML.includes("'user_status': 'logged'")
                """)
                if is_logged_in:
                    print("Login detected! Saving session...")
                    await context.storage_state(path=str(AUTH_FILE))
                    print(f"Session saved to {AUTH_FILE}")
                    break
                if i % 10 == 0:
                    print(f"Waiting... ({i}s)")
                await asyncio.sleep(1)

        await context.close()


async def scrape_games(limit: int = None):
    """Scrape Ark Nova game statistics."""
    if not AUTH_FILE.exists():
        print("No saved session found. Run with --login first.")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # Set to True for headless
        context = await browser.new_context(storage_state=str(AUTH_FILE))
        page = await context.new_page()

        # Go to gamestats page
        print("Loading game stats page...")
        await page.goto(f"https://boardgamearena.com/gamestats?player={PLAYER_ID}&game=arknova")
        await page.wait_for_load_state("networkidle")
        await asyncio.sleep(2)  # Extra wait for dynamic content

        # Get all table IDs
        table_ids = await page.evaluate("""
            () => [...new Set(
                [...document.querySelectorAll('a[href*="table="]')]
                .map(a => a.href.match(/table=(\\d+)/)?.[1])
                .filter(Boolean)
            )]
        """)

        print(f"Found {len(table_ids)} games")

        if limit:
            table_ids = table_ids[:limit]
            print(f"Limiting to {limit} games")

        all_games = []

        for i, table_id in enumerate(table_ids):
            print(f"Processing game {i+1}/{len(table_ids)}: {table_id}")

            try:
                # Navigate to game page
                await page.goto(f"https://boardgamearena.com/table?table={table_id}")
                await page.wait_for_load_state("networkidle")

                # Wait for stats table to appear
                try:
                    await page.wait_for_selector("table.statstable tr", timeout=10000)
                except:
                    print(f"  No stats table found, skipping...")
                    continue

                # Extract stats
                game_data = await page.evaluate("""
                    (tableId) => {
                        const rows = [...document.querySelectorAll('table.statstable tr')];
                        if (rows.length === 0) return null;

                        const data = rows.map(r =>
                            [...r.querySelectorAll('td,th')].map(c => c.innerText.trim())
                        );

                        const players = data[0].slice(1);
                        const stats = {};

                        for (let i = 1; i < data.length; i++) {
                            const statName = data[i][0];
                            if (!statName || statName === 'All stats') continue;
                            stats[statName] = {};
                            players.forEach((p, j) => {
                                stats[statName][p] = data[i][j + 1] || '';
                            });
                        }

                        return {
                            tableId: tableId,
                            url: window.location.href,
                            players: players,
                            stats: stats
                        };
                    }
                """, table_id)

                if game_data:
                    all_games.append(game_data)
                    print(f"  Collected: {len(game_data['players'])} players, {len(game_data['stats'])} stats")

                # Small delay to be nice to the server
                await asyncio.sleep(0.5)

            except Exception as e:
                print(f"  Error: {e}")
                continue

        await browser.close()

        # Save results
        output = {
            "exportedAt": datetime.utcnow().isoformat() + "Z",
            "playerId": PLAYER_ID,
            "totalGames": len(all_games),
            "games": all_games
        }

        OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_FILE, "w") as f:
            json.dump(output, f, indent=2)

        print(f"\nDone! Saved {len(all_games)} games to {OUTPUT_FILE}")


async def main():
    parser = argparse.ArgumentParser(description="Scrape Ark Nova stats from BGA")
    parser.add_argument("--login", action="store_true", help="Open browser to log in and save session")
    parser.add_argument("--limit", type=int, help="Limit number of games to scrape")
    args = parser.parse_args()

    if args.login:
        await login_and_save_session()
    else:
        await scrape_games(limit=args.limit)


if __name__ == "__main__":
    asyncio.run(main())
