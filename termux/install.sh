#!/bin/bash

# LATIF v5 Termux Bootstrap Script
# One-command installation for Android/Termux
#
# Usage: bash install.sh
# Or: curl -s https://raw.github.../termux/install.sh | bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     LATIF v5 - Termux Bootstrap Installer                  ║"
echo "║     Personal AI Operating System                           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

# Check if running in Termux
if [ ! -d "$PREFIX" ]; then
  echo -e "${RED}✗ Error: Not running in Termux${NC}"
  echo "Please install Termux first: https://termux.com"
  exit 1
fi

echo -e "${YELLOW}Step 1/5: Updating package lists...${NC}"
pkg update -y > /dev/null 2>&1 || {
  echo -e "${RED}✗ Failed to update packages${NC}"
  exit 1
}

echo -e "${YELLOW}Step 2/5: Installing Node.js and npm...${NC}"
pkg install -y nodejs npm > /dev/null 2>&1 || {
  echo -e "${RED}✗ Failed to install Node.js${NC}"
  exit 1
}

# Verify installation
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js installation failed${NC}"
  exit 1
fi

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)

echo -e "${GREEN}✓ Node.js ${NODE_VERSION} installed${NC}"
echo -e "${GREEN}✓ npm ${NPM_VERSION} installed${NC}\n"

# Check if LATIF directory exists
if [ ! -d "~/latif-v5" ]; then
  echo -e "${YELLOW}Step 3/5: Creating LATIF directory...${NC}"
  mkdir -p ~/latif-v5
  cd ~/latif-v5
else
  echo -e "${YELLOW}Step 3/5: Using existing LATIF directory...${NC}"
  cd ~/latif-v5
fi

echo -e "${YELLOW}Step 4/5: Installing Node dependencies...${NC}"
if [ -f "package.json" ]; then
  npm install > /dev/null 2>&1 || {
    echo -e "${RED}✗ Failed to install dependencies${NC}"
    exit 1
  }
  echo -e "${GREEN}✓ Dependencies installed${NC}\n"
else
  echo -e "${YELLOW}⚠ package.json not found${NC}"
  echo -e "${YELLOW}Please extract LATIF v5 zip file first${NC}\n"
fi

echo -e "${YELLOW}Step 5/5: Creating environment configuration...${NC}"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
  cat > .env << 'EOF'
NODE_ENV=development
APP_DEBUG=true
APP_PORT=3000
DB_PATH=~/latif-v5/latif.db
LOG_LEVEL=info
LOG_DIR=~/latif-v5/logs
EOF
  echo -e "${GREEN}✓ .env file created${NC}\n"
else
  echo -e "${YELLOW}⚠ .env already exists, skipping${NC}\n"
fi

# Test the installation
echo -e "${BLUE}Testing LATIF installation...${NC}"
if npm run dev &
  sleep 3
  if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ LATIF API responding correctly${NC}"
    pkill -f "npm run dev"
  else
    echo -e "${YELLOW}⚠ API test failed, but installation may still be OK${NC}"
    pkill -f "npm run dev" 2>/dev/null || true
  fi
then
  :
fi

echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════╗"
echo "║          ✓ Installation Complete!                        ║"
echo "╚════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${BLUE}Next steps:${NC}\n"
echo "1. Start LATIF v5:"
echo -e "   ${YELLOW}npm run dev${NC}\n"

echo "2. Test it works (in another terminal):"
echo -e "   ${YELLOW}curl http://localhost:3000/health${NC}\n"

echo "3. Access API:"
echo -e "   ${YELLOW}http://localhost:3000${NC}\n"

echo "4. Read documentation:"
echo -e "   ${YELLOW}cat PHASE1_FOUNDATION.md${NC}\n"

echo -e "${GREEN}Happy coding! 🚀${NC}\n"
