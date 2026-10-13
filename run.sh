#!/usr/bin/env bash

# Resolve script directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "======================================================="
echo "⚡ Starting Fuck panagram Studio"
echo "======================================================="

# Check virtual environment
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment (.venv)..."
    python3 -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

# Install / update dependencies if needed
pip install -q -r requirements.txt

# Run application
python app.py
