#!/bin/bash
# LATIF v5.0.0 - Termux/Android Setup Script
# Automated environment setup for Termux

set -e

echo "======================================"
echo "LATIF v5.0.0 - Termux Setup"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running in Termux
if [ ! -d "$HOME/.termux" ]; then
  echo -e "${YELLOW}⚠ Warning: Not running in Termux. Some features may not work.${NC}"
fi

# Step 1: Update packages
echo -e "${BLUE}[1/8]${NC} Updating package lists..."
pkg update -y >/dev/null 2>&1
echo -e "${GREEN}✓${NC} Package lists updated"

# Step 2: Upgrade packages
echo -e "${BLUE}[2/8]${NC} Upgrading packages..."
pkg upgrade -y >/dev/null 2>&1
echo -e "${GREEN}✓${NC} Packages upgraded"

# Step 3: Install Node.js
echo -e "${BLUE}[3/8]${NC} Installing Node.js..."
if ! command -v node &> /dev/null; then
  pkg install -y nodejs npm >/dev/null 2>&1
  echo -e "${GREEN}✓${NC} Node.js installed"
else
  echo -e "${GREEN}✓${NC} Node.js already installed (v$(node --version))"
fi

# Step 4: Verify Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
  echo -e "${YELLOW}⚠ Node.js v18+ recommended (you have v$(node --version))${NC}"
fi

# Step 5: Install additional dependencies
echo -e "${BLUE}[4/8]${NC} Installing system dependencies..."
pkg install -y git curl wget >/dev/null 2>&1
echo -e "${GREEN}✓${NC} System dependencies installed"

# Step 6: Install npm dependencies
echo -e "${BLUE}[5/8]${NC} Installing npm dependencies (this may take 2-3 minutes)..."
if [ -f "package.json" ]; then
  npm install >/dev/null 2>&1
  echo -e "${GREEN}✓${NC} npm dependencies installed"
else
  echo -e "${YELLOW}⚠ package.json not found in current directory${NC}"
fi

# Step 7: Create necessary directories
echo -e "${BLUE}[6/8]${NC} Creating directories..."
mkdir -p ~/.latif/data
mkdir -p ~/.latif/logs
mkdir -p ~/.latif/cache
mkdir -p ~/.latif/backups
mkdir -p ~/.latif/models
echo -e "${GREEN}✓${NC} Directories created"

# Step 8: Generate configuration if needed
echo -e "${BLUE}[7/8]${NC} Setting up configuration..."
if [ ! -f "config/android.json" ]; then
  echo "Generating android.json configuration..."
  mkdir -p config
  cat > config/android.json << 'EOF'
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
EOF
  echo -e "${GREEN}✓${NC} Configuration generated"
else
  echo -e "${GREEN}✓${NC} Configuration already exists"
fi

# Step 9: Create startup scripts
echo -e "${BLUE}[8/8]${NC} Creating startup scripts..."
chmod +x setup-termux.sh 2>/dev/null || true
chmod +x start-latif.sh 2>/dev/null || true
chmod +x configure-ollama.sh 2>/dev/null || true

echo ""
echo "======================================"
echo -e "${GREEN}Setup Complete!${NC}"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Review config/android.json if needed"
echo "2. Configure Ollama (optional): bash configure-ollama.sh"
echo "3. Start LATIF: bash start-latif.sh"
echo ""
echo "For help, see DEPLOYMENT_README.md"
echo ""
