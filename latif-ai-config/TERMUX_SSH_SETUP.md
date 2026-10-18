# 🤖 Termux SSH Setup for LATIF GX

Complete guide to access your LATIF GX project from Termux on Android.

## Prerequisites

- Termux app installed from F-Droid or Google Play
- Git installed in Termux
- SSH key access to your GitHub

## Step 1: Install Required Packages in Termux

```bash
pkg update
pkg install openssh git curl wget python-pip
pkg install build-essential clang
```

## Step 2: Generate SSH Key in Termux

```bash
# Generate SSH key
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""

# View your public key
cat ~/.ssh/id_rsa.pub
```

## Step 3: Add SSH Key to GitHub

1. Copy the output from `cat ~/.ssh/id_rsa.pub`
2. Go to https://github.com/settings/keys
3. Click "New SSH key"
4. Paste your public key
5. Save

## Step 4: Configure SSH in Termux

```bash
# Create SSH config file
cat > ~/.ssh/config << 'EOF'
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_rsa
    StrictHostKeyChecking accept-new
EOF

# Set proper permissions
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub
chmod 700 ~/.ssh
chmod 644 ~/.ssh/config

# Test SSH connection
ssh -T git@github.com
# Should show: Hi LAtifword! You've successfully authenticated...
```

## Step 5: Clone Your Project in Termux

```bash
# Create projects directory
mkdir -p ~/projects
cd ~/projects

# Clone with SSH
git clone git@github.com:LAtifword/latif-brain.git
cd latif-brain

# Verify you're on the right branch
git branch -a
git checkout claude/local-model-config-6mtzxi
```

## Step 6: Configure Git in Termux

```bash
# Set your Git identity
git config --global user.email "noreply@anthropic.com"
git config --global user.name "Claude"

# Optional: Cache credentials
git config --global credential.helper store
```

## Step 7: Setup Python Backend in Termux

```bash
# Install Python packages
pip install fastapi uvicorn pydantic httpx psutil python-multipart websockets

# Or use requirements.txt
cd ~/projects/latif-brain/latif-ai-config/backend
pip install -r requirements.txt
```

## Step 8: Setup Ollama Connection in Termux

```bash
# If running Ollama on your main device, find its IP
# Example: 192.168.1.100

# Create .env file in backend directory
cat > ~/projects/latif-brain/latif-ai-config/backend/.env << 'EOF'
OLLAMA_HOST=192.168.1.100:11434
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
DEFAULT_MODEL=llama2
EOF
```

## Step 9: Run LATIF Backend in Termux

```bash
cd ~/projects/latif-brain/latif-ai-config/backend

# Start the server
python -m uvicorn main:app --host 0.0.0.0 --port 8000

# Or in background with nohup
nohup python -m uvicorn main:app --host 0.0.0.0 --port 8000 > latif.log 2>&1 &
```

## Step 10: Access Dashboard from Termux Browser

```bash
# Start a simple HTTP server for the frontend
cd ~/projects/latif-brain/latif-ai-config
python -m http.server 3000

# Open in browser: http://127.0.0.1:3000/index-enterprise.html
```

## Common Termux Commands

```bash
# Check running processes
ps aux | grep python

# Kill a process
kill -9 <PID>

# View server logs
cat latif.log

# Tail logs (follow in real-time)
tail -f latif.log

# Check open ports
netstat -tln

# Check IP address
ifconfig | grep "inet "

# Keep Termux running in background
# Use: Ctrl+Z to suspend, then 'bg' to background

# Start SSH server in Termux (optional)
sshd  # Allows SSH into Termux from other devices
```

## Connect from Another Device to Termux

```bash
# On your computer, connect to Termux
ssh -p 8022 user@<termux-ip>

# Default Termux user is 'u0_a'
# Or use: whoami (to check your username)
```

## Troubleshooting

### SSH Key Permission Issues

```bash
# Fix permissions
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub
chmod 700 ~/.ssh
```

### Can't Connect to GitHub

```bash
# Test connection with verbose output
ssh -vT git@github.com

# Check if key is being used
ssh-add -l

# Add key to SSH agent
ssh-add ~/.ssh/id_rsa
```

### Git Push Fails

```bash
# Verify remote URL
git remote -v

# Change to SSH URL if needed
git remote set-url origin git@github.com:LAtifword/latif-brain.git

# Try push again
git push -u origin claude/local-model-config-6mtzxi
```

### Python Packages Installation Fails

```bash
# Install build tools
pkg install build-essential clang

# Or use precompiled wheels
pip install --only-binary :all: <package-name>
```

### Can't Find Ollama Server

```bash
# Find your computer's local IP
# On main machine: ifconfig | grep "inet "
# Example: 192.168.1.100

# Use that IP in Termux:
export OLLAMA_HOST=192.168.1.100:11434

# Test connection
curl http://192.168.1.100:11434/api/tags
```

## Termux Storage Access

```bash
# Grant storage permissions
termux-setup-storage

# Access storage
cd ~/storage/downloads
cd ~/storage/documents
cd ~/storage/shared
```

## Keep Termux Session Running

**Using Tmux:**
```bash
# Install tmux
pkg install tmux

# Create session
tmux new-session -d -s latif

# Run backend in session
tmux send-keys -t latif "cd ~/projects/latif-brain/latif-ai-config/backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000" Enter

# List sessions
tmux list-sessions

# Attach to session
tmux attach -t latif

# Detach: Ctrl+B then D
```

**Using Nohup:**
```bash
# Run in background, survives terminal close
nohup python -m uvicorn main:app --host 0.0.0.0 --port 8000 > latif.log 2>&1 &

# Or with output to storage
nohup python -m uvicorn main:app --host 0.0.0.0 --port 8000 > ~/storage/downloads/latif.log 2>&1 &
```

## Complete Workflow in Termux

```bash
# 1. Update packages
pkg update && pkg upgrade

# 2. Clone project
mkdir -p ~/projects
cd ~/projects
git clone git@github.com:LAtifword/latif-brain.git
cd latif-brain

# 3. Create backend directory
mkdir -p latif-ai-config/backend

# 4. Install dependencies
pip install -r latif-ai-config/backend/requirements.txt

# 5. Configure environment
export OLLAMA_HOST=192.168.1.100:11434
export SERVER_HOST=0.0.0.0
export SERVER_PORT=8000

# 6. Start backend
cd latif-ai-config/backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000

# 7. In another Termux session (or tab)
cd ~/projects/latif-brain/latif-ai-config
python -m http.server 3000

# 8. Open browser
# http://127.0.0.1:3000/index-enterprise.html
```

## Environment Variables for Termux

Add to `~/.bashrc` or `~/.bash_profile`:

```bash
# Git
export GIT_AUTHOR_NAME="Claude"
export GIT_AUTHOR_EMAIL="noreply@anthropic.com"
export GIT_COMMITTER_NAME="Claude"
export GIT_COMMITTER_EMAIL="noreply@anthropic.com"

# Python
export PYTHONUNBUFFERED=1
export PYTHONPATH=~/projects/latif-brain:$PYTHONPATH

# LATIF
export OLLAMA_HOST=192.168.1.100:11434
export SERVER_HOST=0.0.0.0
export SERVER_PORT=8000
export LOG_LEVEL=INFO
```

Then load it:
```bash
source ~/.bashrc
```

## Performance Tips

1. **Use storage optimization:**
   ```bash
   pkg install busybox
   ```

2. **Limit Python workers:**
   ```bash
   # Use 2 workers instead of 4
   python -m uvicorn main:app --workers 2
   ```

3. **Monitor resources:**
   ```bash
   # Install monitoring tools
   pkg install htop
   htop
   ```

4. **Cache pip packages:**
   ```bash
   pip config set global.cache-dir ~/storage/downloads/.pip-cache
   ```

## Advanced: Run Everything in Tmux

```bash
#!/bin/bash
# Save as: ~/run_latif.sh
# chmod +x ~/run_latif.sh

tmux new-session -d -s latif

# Window 1: Backend
tmux new-window -t latif -n backend
tmux send-keys -t latif:backend "cd ~/projects/latif-brain/latif-ai-config/backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000" Enter

# Window 2: Frontend
tmux new-window -t latif -n frontend
tmux send-keys -t latif:frontend "cd ~/projects/latif-brain/latif-ai-config && python -m http.server 3000" Enter

# Window 3: Shell
tmux new-window -t latif -n shell

echo "LATIF running in Tmux!"
echo "Run: tmux attach -t latif"
```

Then:
```bash
bash ~/run_latif.sh
tmux attach -t latif
```

---

**You're now ready to develop LATIF GX from Termux on Android!** 🚀

Questions? Check logs with: `tail -f latif.log`
