#!/bin/bash
# LATIF v5.0.0 - Startup Script for NEWSETUP
# Launches LATIF services from /storage/emulated/0/NEWSETUP

set -e

echo "======================================"
echo "LATIF v5.0.0 - Starting Services"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
PORT=${LATIF_PORT:-3000}
NODE_ENV=${NODE_ENV:-production}
LOG_LEVEL=${LOG_LEVEL:-info}

# Detect NEWSETUP directory
ANDROID_STORAGE="/storage/emulated/0"
LATIF_NEWSETUP="$ANDROID_STORAGE/NEWSETUP"
LATIF_HOME="${HOME}/latif-v5"

# Determine working directory
if [ -d "$LATIF_NEWSETUP" ]; then
  WORK_DIR="$LATIF_NEWSETUP"
  echo -e "${BLUE}✓ Using Android storage: $WORK_DIR${NC}"
elif [ -L "$LATIF_HOME" ]; then
  WORK_DIR=$(readlink -f "$LATIF_HOME")
  echo -e "${BLUE}✓ Using symlink: $WORK_DIR${NC}"
elif [ -d "$LATIF_HOME" ]; then
  WORK_DIR="$LATIF_HOME"
  echo -e "${BLUE}✓ Using directory: $WORK_DIR${NC}"
elif [ -d "${HOME}/NEWSETUP" ]; then
  WORK_DIR="${HOME}/NEWSETUP"
  echo -e "${BLUE}✓ Using directory: $WORK_DIR${NC}"
else
  echo -e "${RED}✗ NEWSETUP directory not found!${NC}"
  exit 1
fi

cd "$WORK_DIR"
echo -e "${GREEN}✓ Working directory: $(pwd)${NC}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js not found. Run setup-termux-NEWSETUP.sh first.${NC}"
  exit 1
fi

echo -e "${BLUE}✓${NC} Node.js v$(node --version)"
echo -e "${BLUE}✓${NC} npm v$(npm --version)"
echo ""

# Check port availability
if lsof -i :$PORT >/dev/null 2>&1; then
  echo -e "${YELLOW}⚠ Port $PORT is already in use${NC}"
  echo "   Kill existing process or change LATIF_PORT environment variable"
  exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}⚠ node_modules not found. Running npm install...${NC}"
  npm install >/dev/null 2>&1
  echo -e "${GREEN}✓ npm packages installed${NC}"
fi

# Check if src/main.js exists
if [ ! -f "src/main.js" ]; then
  echo -e "${RED}✗ src/main.js not found!${NC}"
  echo "Make sure the NEWSETUP directory contains the complete project"
  exit 1
fi

# Create log directory
mkdir -p "$HOME/.latif/logs"

# Start LATIF
echo -e "${BLUE}Starting LATIF v5.0.0...${NC}"
echo ""

export NODE_ENV=$NODE_ENV
export LOG_LEVEL=$LOG_LEVEL
export LATIF_PORT=$PORT

# Run the main server
node src/main.js 2>&1 | tee -a "$HOME/.latif/logs/latif.log" &

LATIF_PID=$!
echo -e "${GREEN}✓ LATIF started (PID: $LATIF_PID)${NC}"

# Wait for server to be ready
echo "Waiting for server to be ready..."
sleep 3

# Health check
if curl -s http://localhost:$PORT/api/health > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Server is healthy${NC}"
  echo ""
  echo "======================================"
  echo -e "${GREEN}LATIF Running Successfully!${NC}"
  echo "======================================"
  echo ""
  echo "API Server: http://localhost:$PORT"
  echo "WebSocket:  ws://localhost:$PORT"
  echo "Logs:       $HOME/.latif/logs/latif.log"
  echo "Location:   $WORK_DIR"
  echo ""
  echo "Try:"
  echo "  curl http://localhost:$PORT/api/health"
  echo "  curl http://localhost:$PORT/api/stats"
  echo ""
  echo "Press Ctrl+C to stop LATIF"
  echo ""

  # Keep process in foreground
  wait $LATIF_PID
else
  echo -e "${RED}✗ Server health check failed${NC}"
  echo "Check logs: cat $HOME/.latif/logs/latif.log"
  kill $LATIF_PID 2>/dev/null || true
  exit 1
fi
