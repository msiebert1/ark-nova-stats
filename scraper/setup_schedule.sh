#!/bin/bash
#
# Setup script for Ark Nova Stats Scraper scheduling
#
# This script:
# 1. Checks prerequisites
# 2. Helps create the config file
# 3. Installs the launchd job to run on Sundays and Mondays
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_NAME="com.arknova.stats.plist"
PLIST_SRC="$SCRIPT_DIR/$PLIST_NAME"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"
CONFIG_FILE="$SCRIPT_DIR/config.json"

echo "========================================"
echo "Ark Nova Stats Scraper - Setup"
echo "========================================"
echo ""

# Check for Python
echo "Checking prerequisites..."
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is required but not found."
    echo "Install Python 3 and try again."
    exit 1
fi
echo "  Python 3: OK"

# Check/install requests
if ! python3 -c "import requests" 2>/dev/null; then
    echo "  Installing requests library..."
    pip3 install requests
fi
echo "  requests: OK"

# Check for config file
echo ""
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Config file not found. Let's create one."
    echo ""
    read -p "Enter your BGA email: " bga_email
    read -sp "Enter your BGA password: " bga_password
    echo ""
    read -p "Max games to fetch (default 100): " limit
    limit=${limit:-100}

    cat > "$CONFIG_FILE" << EOF
{
  "email": "$bga_email",
  "password": "$bga_password",
  "limit": $limit
}
EOF

    # Secure the config file
    chmod 600 "$CONFIG_FILE"
    echo "Config file created: $CONFIG_FILE"
else
    echo "Config file exists: $CONFIG_FILE"
fi

# Test the scraper
echo ""
echo "Testing the scraper..."
cd "$SCRIPT_DIR"
if python3 bga_scraper.py --config config.json --limit 5; then
    echo "Scraper test: OK"
else
    echo "ERROR: Scraper test failed. Please check your credentials."
    exit 1
fi

# Install launchd job
echo ""
echo "Installing scheduled job..."

# Create LaunchAgents directory if needed
mkdir -p "$HOME/Library/LaunchAgents"

# Unload existing job if present
if launchctl list | grep -q "com.arknova.stats"; then
    echo "  Unloading existing job..."
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
fi

# Copy plist
cp "$PLIST_SRC" "$PLIST_DEST"
echo "  Copied plist to $PLIST_DEST"

# Load the job
launchctl load "$PLIST_DEST"
echo "  Loaded launchd job"

echo ""
echo "========================================"
echo "Setup complete!"
echo "========================================"
echo ""
echo "The scraper will now run automatically at 9:00 AM on:"
echo "  - Every Sunday"
echo "  - Every Monday"
echo ""
echo "Logs are stored in: $SCRIPT_DIR/logs/scraper.log"
echo ""
echo "Useful commands:"
echo "  Run manually:    $SCRIPT_DIR/run_scraper.sh"
echo "  View logs:       tail -f $SCRIPT_DIR/logs/scraper.log"
echo "  Disable:         launchctl unload $PLIST_DEST"
echo "  Re-enable:       launchctl load $PLIST_DEST"
echo "  Check status:    launchctl list | grep arknova"
echo ""
