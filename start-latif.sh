#!/bin/bash
# LATIF v5.0.0 - Startup Script
# Launches LATIF services

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

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js not found. Run setup-termux.sh first.${NC}"
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

# Create log directory
mkdir -p ~/.latif/logs

# Start LATIF
echo -e "${BLUE}Starting LATIF v5.0.0...${NC}"
echo ""

export NODE_ENV=$NODE_ENV
export LOG_LEVEL=$LOG_LEVEL
export LATIF_PORT=$PORT

# Run the main server
node src/main.js 2>&1 | tee -a ~/.latif/logs/latif.log &

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
  echo "Logs:       ~/.latif/logs/latif.log"
  echo ""
  echo "Try:"
  echo "  curl http://localhost:$PORT/api/health"
  echo "  curl http://localhost:$PORT/api/models"
  echo ""
  echo "Press Ctrl+C to stop LATIF"
  echo ""

  # Keep process in foreground
  wait $LATIF_PID
else
  echo -e "${RED}✗ Server health check failed${NC}"
  echo "Check logs: cat ~/.latif/logs/latif.log"
  kill $LATIF_PID 2>/dev/null || true
  exit 1
fi
