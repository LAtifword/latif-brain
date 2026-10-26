#!/bin/bash

# LATIF GX Enterprise Server Startup Script

echo "🚀 Starting LATIF GX Enterprise Server..."
echo "==========================================="

# Set environment variables
export PYTHONUNBUFFERED=1
export SERVER_HOST=${SERVER_HOST:-127.0.0.1}
export SERVER_PORT=${SERVER_PORT:-8000}
export OLLAMA_HOST=${OLLAMA_HOST:-127.0.0.1}
export OLLAMA_PORT=${OLLAMA_PORT:-11434}
export LOG_LEVEL=${LOG_LEVEL:-INFO}

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install requirements
echo "📚 Installing dependencies..."
pip install -q -r requirements.txt

# Create directories
mkdir -p data cache logs

# Start server
echo "✅ Starting FastAPI server on http://$SERVER_HOST:$SERVER_PORT"
echo "📚 API docs available at http://$SERVER_HOST:$SERVER_PORT/docs"
echo ""

python -m uvicorn main:app --host $SERVER_HOST --port $SERVER_PORT --reload --log-level $LOG_LEVEL
