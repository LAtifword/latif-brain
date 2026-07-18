#!/bin/bash
# LATIF v5.0.0 - Ollama Configuration Script for NEWSETUP
# Configures connection to Ollama LLM backend

set -e

echo "======================================"
echo "LATIF v5.0.0 - Ollama Configuration"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

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

# Function to test connection
test_ollama_connection() {
  local host=$1
  local port=$2

  if curl -s -m 3 "http://$host:$port/api/tags" > /dev/null 2>&1; then
    return 0
  else
    return 1
  fi
}

# Default values
DEFAULT_HOST="localhost"
DEFAULT_PORT="11434"
DEFAULT_MODEL="qwen2.5:1.5b"

echo -e "${BLUE}Ollama Configuration${NC}"
echo ""
echo "This script helps configure LATIF to connect to Ollama."
echo "Ollama can run locally or on another device on your network."
echo ""
echo "TIPS FOR ANDROID:"
echo "- For local Ollama on desktop: Use desktop IP (e.g., 192.168.1.100)"
echo "- Port is usually 11434"
echo "- Check with: curl http://DESKTOP_IP:11434/api/tags"
echo ""

# Prompt for Ollama host
read -p "Ollama host (default: $DEFAULT_HOST): " OLLAMA_HOST
OLLAMA_HOST=${OLLAMA_HOST:-$DEFAULT_HOST}

# Prompt for Ollama port
read -p "Ollama port (default: $DEFAULT_PORT): " OLLAMA_PORT
OLLAMA_PORT=${OLLAMA_PORT:-$DEFAULT_PORT}

# Prompt for model
read -p "Model name (default: $DEFAULT_MODEL): " OLLAMA_MODEL
OLLAMA_MODEL=${OLLAMA_MODEL:-$DEFAULT_MODEL}

echo ""
echo -e "${BLUE}Testing connection to Ollama...${NC}"

if test_ollama_connection "$OLLAMA_HOST" "$OLLAMA_PORT"; then
  echo -e "${GREEN}✓ Successfully connected to Ollama at $OLLAMA_HOST:$OLLAMA_PORT${NC}"

  # Get available models
  echo ""
  echo -e "${BLUE}Available models on Ollama:${NC}"
  curl -s "http://$OLLAMA_HOST:$OLLAMA_PORT/api/tags" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | head -10

else
  echo -e "${RED}✗ Could not connect to Ollama at $OLLAMA_HOST:$OLLAMA_PORT${NC}"
  echo ""
  echo -e "${YELLOW}Troubleshooting:${NC}"
  echo "1. Make sure Ollama is running on your desktop"
  echo "2. If Ollama is on desktop, use desktop IP (not localhost)"
  echo "3. Check host and port are correct"
  echo "4. If on another device, ensure network access is allowed"
  echo "5. Try: curl http://$OLLAMA_HOST:$OLLAMA_PORT/api/tags"
  echo ""
  read -p "Continue with configuration anyway? (y/n): " CONTINUE
  if [ "$CONTINUE" != "y" ]; then
    exit 1
  fi
fi

echo ""
echo -e "${BLUE}Updating configuration...${NC}"

# Update config/android.json
if [ -f "config/android.json" ]; then
  # Check if jq is available
  if command -v jq &> /dev/null; then
    jq --arg host "$OLLAMA_HOST" \
       --arg port "$OLLAMA_PORT" \
       --arg model "$OLLAMA_MODEL" \
       '.llm.host = $host | .llm.port = $port | .llm.model = $model' \
       config/android.json > config/android.json.tmp && \
       mv config/android.json.tmp config/android.json
    echo -e "${GREEN}✓ Configuration updated with jq${NC}"
  else
    # Fallback: create backup and use sed
    echo "Creating backup and updating configuration..."
    cp config/android.json config/android.json.backup

    # Use sed for replacements (works on Android)
    sed -i "s|\"host\": \"[^\"]*\"|\"host\": \"$OLLAMA_HOST\"|g" config/android.json
    sed -i "s|\"port\": [0-9]*,|\"port\": $OLLAMA_PORT,|g" config/android.json
    sed -i "s|\"model\": \"[^\"]*\"|\"model\": \"$OLLAMA_MODEL\"|g" config/android.json

    echo -e "${GREEN}✓ Configuration updated${NC}"
  fi
else
  echo -e "${YELLOW}⚠ config/android.json not found${NC}"
  echo "Creating configuration..."

  mkdir -p config
  cat > config/android.json << EOF
{
  "environment": "android",
  "server": {
    "host": "localhost",
    "port": 3000,
    "ssl": false
  },
  "database": {
    "type": "indexeddb",
    "path": "~/.latif/data"
  },
  "llm": {
    "provider": "ollama",
    "host": "$OLLAMA_HOST",
    "port": $OLLAMA_PORT,
    "model": "$OLLAMA_MODEL",
    "temperature": 0.7,
    "maxTokens": 2048
  },
  "features": {
    "streaming": true,
    "caching": true,
    "agents": true,
    "workflows": true,
    "vision": true
  },
  "performance": {
    "maxConcurrentRequests": 2,
    "cacheSizeLimit": 100000000,
    "autoOptimize": true
  },
  "logging": {
    "level": "info",
    "format": "json",
    "maxFiles": 10
  }
}
EOF
  echo -e "${GREEN}✓ Configuration created${NC}"
fi

# Create .env file for convenience
cat > .env << EOF
NODE_ENV=production
LATIF_PORT=3000
OLLAMA_HOST=$OLLAMA_HOST:$OLLAMA_PORT
OLLAMA_MODEL=$OLLAMA_MODEL
LOG_LEVEL=info
EOF

echo -e "${GREEN}✓ .env file created${NC}"

echo ""
echo "======================================"
echo -e "${GREEN}Ollama Configuration Complete!${NC}"
echo "======================================"
echo ""
echo "Configuration saved to:"
echo "  - config/android.json (primary)"
echo "  - .env (environment variables)"
echo ""
echo "When you start LATIF with 'bash start-latif-NEWSETUP.sh',"
echo "it will connect to Ollama at: $OLLAMA_HOST:$OLLAMA_PORT"
echo "Using model: $OLLAMA_MODEL"
echo ""
echo "Next: bash start-latif-NEWSETUP.sh"
echo ""
