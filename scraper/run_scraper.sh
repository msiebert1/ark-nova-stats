#!/bin/bash
#
# Ark Nova Stats Scraper - Wrapper Script
# This script is called by launchd to run the BGA scraper
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
CONFIG_FILE="$SCRIPT_DIR/config.json"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Log start time
echo ""
echo "========================================"
echo "Ark Nova Stats Scraper"
echo "Started: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# Check for config file
if [ ! -f "$CONFIG_FILE" ]; then
    echo "ERROR: Config file not found: $CONFIG_FILE"
    echo "Please create config.json with your BGA credentials."
    echo "See config.example.json for the format."
    exit 1
fi

# Activate conda environment if available
if [ -f "$HOME/miniconda3/etc/profile.d/conda.sh" ]; then
    source "$HOME/miniconda3/etc/profile.d/conda.sh"
    conda activate base 2>/dev/null || true
fi

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 not found"
    exit 1
fi

# Check if requests is installed
if ! python3 -c "import requests" 2>/dev/null; then
    echo "Installing required packages..."
    pip3 install -r "$SCRIPT_DIR/requirements.txt"
fi

# Run the scraper
cd "$SCRIPT_DIR"
python3 bga_scraper.py --config config.json

echo ""
echo "Completed: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
