#!/bin/bash

# LATIF GX Termux Automated Setup Script
# Run this in Termux to automatically configure SSH and clone the project

set -e

echo "🤖 LATIF GX - Termux Setup Script"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running in Termux
if [ ! -d "$PREFIX" ]; then
    echo -e "${RED}❌ This script must be run in Termux!${NC}"
    echo "Install Termux from: https://f-droid.org/en/packages/com.termux/"
    exit 1
fi

echo -e "${YELLOW}📦 Step 1: Updating packages...${NC}"
pkg update -y
pkg upgrade -y

echo -e "${YELLOW}📥 Step 2: Installing required packages...${NC}"
pkg install -y openssh git curl wget python-pip build-essential clang

echo -e "${YELLOW}🔐 Step 3: Generating SSH key...${NC}"
if [ ! -f ~/.ssh/id_rsa ]; then
    mkdir -p ~/.ssh
    ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""
    chmod 600 ~/.ssh/id_rsa
    chmod 644 ~/.ssh/id_rsa.pub
    echo -e "${GREEN}✅ SSH key generated!${NC}"
    echo ""
    echo "📋 Your public key:"
    cat ~/.ssh/id_rsa.pub
    echo ""
    echo -e "${YELLOW}⚠️  Add this key to GitHub:${NC}"
    echo "1. Go to: https://github.com/settings/keys"
    echo "2. Click 'New SSH key'"
    echo "3. Paste the key above"
    echo "4. Save"
    echo ""
    read -p "Press Enter once you've added the key to GitHub..."
else
    echo -e "${GREEN}✅ SSH key already exists${NC}"
fi

echo -e "${YELLOW}⚙️  Step 4: Configuring SSH...${NC}"
cat > ~/.ssh/config << 'EOF'
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_rsa
    StrictHostKeyChecking accept-new
EOF
chmod 644 ~/.ssh/config

echo -e "${YELLOW}🔗 Step 5: Testing GitHub connection...${NC}"
if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    echo -e "${GREEN}✅ GitHub SSH connection successful!${NC}"
else
    echo -e "${RED}⚠️  Could not connect to GitHub. Please check your SSH key.${NC}"
fi

echo -e "${YELLOW}📂 Step 6: Creating project directory...${NC}"
mkdir -p ~/projects
cd ~/projects

echo -e "${YELLOW}🔄 Step 7: Cloning LATIF GX repository...${NC}"
if [ ! -d latif-brain ]; then
    git clone git@github.com:LAtifword/latif-brain.git
    cd latif-brain
else
    cd latif-brain
    git pull origin main
fi

echo -e "${YELLOW}📝 Step 8: Configuring Git...${NC}"
git config --global user.email "noreply@anthropic.com"
git config --global user.name "Claude"

echo -e "${YELLOW}🔀 Step 9: Checking out feature branch...${NC}"
git fetch origin
git checkout claude/local-model-config-6mtzxi || git checkout -b claude/local-model-config-6mtzxi origin/claude/local-model-config-6mtzxi

echo -e "${YELLOW}📦 Step 10: Installing Python dependencies...${NC}"
pip install --upgrade pip
pip install -r latif-ai-config/backend/requirements.txt

echo -e "${YELLOW}⚙️  Step 11: Setting up environment...${NC}"
cat > latif-ai-config/backend/.env << 'EOF'
# LATIF GX Termux Configuration
PYTHONUNBUFFERED=1
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
DEFAULT_MODEL=llama2
TEMPERATURE=0.7
MAX_TOKENS=2048
LOG_LEVEL=INFO

# Configure Ollama connection
# Replace 192.168.1.100 with your computer's IP
OLLAMA_HOST=192.168.1.100:11434
OLLAMA_PORT=11434
EOF

echo -e "${YELLOW}📦 Step 12: Setting up storage access...${NC}"
termux-setup-storage 2>/dev/null || echo "Storage access may need manual permission"

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${YELLOW}📚 Next steps:${NC}"
echo ""
echo "1. Find your computer's IP address:"
echo "   On Linux/macOS: ifconfig | grep 'inet '"
echo "   On Windows: ipconfig (look for 'IPv4 Address')"
echo ""
echo "2. Update the OLLAMA_HOST in ~/.env:"
echo "   nano ~/projects/latif-brain/latif-ai-config/backend/.env"
echo ""
echo "3. Start the backend server:"
echo "   cd ~/projects/latif-brain/latif-ai-config/backend"
echo "   python -m uvicorn main:app --host 0.0.0.0 --port 8000"
echo ""
echo "4. In another Termux session, start the frontend:"
echo "   cd ~/projects/latif-brain/latif-ai-config"
echo "   python -m http.server 3000"
echo ""
echo "5. Open browser on your phone:"
echo "   http://127.0.0.1:3000/index-enterprise.html"
echo ""
echo -e "${YELLOW}💡 Useful commands:${NC}"
echo "   cd ~/projects/latif-brain          # Go to project"
echo "   git status                         # Check git status"
echo "   git push origin claude/...         # Push changes"
echo "   git pull origin main               # Pull updates"
echo ""
echo "📖 For more info, see: TERMUX_SSH_SETUP.md"
echo ""
