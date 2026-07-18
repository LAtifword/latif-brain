#!/bin/bash
# LATIF v5.0.0 - Optimized Termux Setup for NEWSETUP (Android Storage)
# Works with /storage/emulated/0/NEWSETUP directory structure

set -e

echo "======================================"
echo "LATIF v5.0.0 - Termux Setup (NEWSETUP)"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Detect NEWSETUP directory (Android storage paths)
ANDROID_STORAGE="/storage/emulated/0"
LATIF_NEWSETUP="$ANDROID_STORAGE/NEWSETUP"
LATIF_HOME="$HOME/latif-v5"

# Check if NEWSETUP exists on Android storage
if [ -d "$LATIF_NEWSETUP" ]; then
  echo -e "${BLUE}✓ Found NEWSETUP on Android storage${NC}"
  echo -e "${BLUE}  Path: $LATIF_NEWSETUP${NC}"

  # Create symlink in Termux home for easier access
  if [ ! -L "$LATIF_HOME" ]; then
    ln -s "$LATIF_NEWSETUP" "$LATIF_HOME" 2>/dev/null || true
    echo -e "${GREEN}✓ Created symlink: $LATIF_HOME -> $LATIF_NEWSETUP${NC}"
  fi

  WORK_DIR="$LATIF_NEWSETUP"

elif [ -d "$HOME/NEWSETUP" ]; then
  WORK_DIR="$HOME/NEWSETUP"
  echo -e "${BLUE}✓ Found NEWSETUP in Termux home${NC}"
  LATIF_HOME="$HOME/NEWSETUP"

else
  echo -e "${RED}✗ NEWSETUP directory not found!${NC}"
  echo ""
  echo "Expected locations:"
  echo "  1. Android Storage: $LATIF_NEWSETUP"
  echo "  2. Termux Home: $HOME/NEWSETUP"
  echo ""
  exit 1
fi

echo -e "${GREEN}✓ Working directory: $WORK_DIR${NC}"
echo ""

# Step 1: Check if running in Termux
if [ ! -d "$HOME/.termux" ]; then
  echo -e "${YELLOW}⚠ Warning: Not running in Termux. Some features may not work.${NC}"
fi

# Step 2: Update packages
echo -e "${BLUE}[1/8]${NC} Updating package lists..."
pkg update -y >/dev/null 2>&1
echo -e "${GREEN}✓${NC} Package lists updated"

# Step 3: Upgrade packages
echo -e "${BLUE}[2/8]${NC} Upgrading packages..."
pkg upgrade -y >/dev/null 2>&1
echo -e "${GREEN}✓${NC} Packages upgraded"

# Step 4: Install Node.js
echo -e "${BLUE}[3/8]${NC} Installing Node.js..."
if ! command -v node &> /dev/null; then
  pkg install -y nodejs npm >/dev/null 2>&1
  echo -e "${GREEN}✓${NC} Node.js installed"
else
  echo -e "${GREEN}✓${NC} Node.js already installed (v$(node --version))"
fi

# Step 5: Verify Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
  echo -e "${YELLOW}⚠ Node.js v18+ recommended (you have v$(node --version))${NC}"
fi

# Step 6: Install additional dependencies
echo -e "${BLUE}[4/8]${NC} Installing system dependencies..."
pkg install -y git curl wget >/dev/null 2>&1
echo -e "${GREEN}✓${NC} System dependencies installed"

# Step 7: Install npm dependencies
echo -e "${BLUE}[5/8]${NC} Installing npm dependencies (this may take 2-3 minutes)..."
cd "$WORK_DIR"
if [ -f "package.json" ]; then
  npm install >/dev/null 2>&1
  echo -e "${GREEN}✓${NC} npm dependencies installed"
else
  echo -e "${RED}✗ package.json not found in $WORK_DIR${NC}"
  echo "Make sure the zip file is extracted completely"
  exit 1
fi

# Step 8: Create necessary directories
echo -e "${BLUE}[6/8]${NC} Creating runtime directories..."
mkdir -p "$HOME/.latif/data"
mkdir -p "$HOME/.latif/logs"
mkdir -p "$HOME/.latif/cache"
mkdir -p "$HOME/.latif/backups"
mkdir -p "$HOME/.latif/models"
echo -e "${GREEN}✓${NC} Directories created in: $HOME/.latif"

# Step 9: Setup configuration
echo -e "${BLUE}[7/8]${NC} Setting up configuration..."
if [ ! -f "config/android.json" ]; then
  echo "Generating android.json configuration..."
  mkdir -p "$WORK_DIR/config"
  cat > "$WORK_DIR/config/android.json" << 'CONFIGEOF'
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
    "host": "localhost",
    "port": 11434,
    "model": "qwen2.5:1.5b",
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
CONFIGEOF
  echo -e "${GREEN}✓${NC} Configuration generated"
else
  echo -e "${GREEN}✓${NC} Configuration already exists"
fi

# Step 10: Create startup scripts
echo -e "${BLUE}[8/8]${NC} Setting up startup scripts..."
cd "$WORK_DIR"
chmod +x setup-termux-NEWSETUP.sh 2>/dev/null || true
chmod +x start-latif-NEWSETUP.sh 2>/dev/null || true
chmod +x configure-ollama-NEWSETUP.sh 2>/dev/null || true

echo ""
echo "======================================"
echo -e "${GREEN}Setup Complete!${NC}"
echo "======================================"
echo ""
echo "✓ LATIF Directory: $WORK_DIR"
echo "✓ Symlink: $LATIF_HOME -> $WORK_DIR"
echo "✓ Node.js: v$(node --version)"
echo "✓ npm: v$(npm --version)"
echo "✓ Configuration: $WORK_DIR/config/android.json"
echo "✓ Runtime directories: $HOME/.latif"
echo "✓ npm packages: installed"
echo ""
echo "Next steps:"
echo "1. cd $LATIF_HOME  (or $WORK_DIR)"
echo "2. Review config/android.json if needed"
echo "3. Configure Ollama (optional):"
echo "   bash configure-ollama-NEWSETUP.sh"
echo "4. Start LATIF:"
echo "   bash start-latif-NEWSETUP.sh"
echo ""
echo "Verify installation:"
echo "   curl http://localhost:3000/api/health"
echo ""
