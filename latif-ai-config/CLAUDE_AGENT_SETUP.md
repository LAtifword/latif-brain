# 🤖 Deploy LATIF GX as a Claude Managed Agent

Turn your LATIF GX system into a Claude Agent that anyone can interact with through Claude!

## What You Get

✅ **Claude Integration** - Access LATIF GX through Claude interface  
✅ **Multi-Agent Orchestration** - Leverage all 5 agents (Planner, Researcher, Executor, Critic, Memory)  
✅ **Workflow Automation** - Create and manage complex workflows  
✅ **RAG Integration** - Search and retrieve from your document corpus  
✅ **Knowledge Graph** - Query and manage your knowledge base  
✅ **Real-Time Monitoring** - Track system metrics and agent status  

## Architecture

```
Claude Interface
       ↓
Claude Managed Agent
       ↓
LATIF Agent Bridge (latif-agent.py)
       ↓
LATIF GX Backend (FastAPI)
       ↓
Local LLM (Ollama/llama.cpp)
```

## Step 1: Prepare Your Backend

Ensure your LATIF GX backend is running:

```bash
cd latif-ai-config/backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Verify it's working:
```bash
curl http://127.0.0.1:8000/health
```

## Step 2: Deploy as Claude Agent

### Option A: Using Claude Agent SDK (Recommended)

```bash
# Install Claude SDK
pip install anthropic

# Create agent project
mkdir ~/my-latif-agent
cd ~/my-latif-agent

# Copy agent files
cp /path/to/latif-ai-config/claude-agent/* .

# Install dependencies
pip install -r requirements.txt
```

### Option B: Manual Agent Registration

1. Go to https://claude.ai/agents
2. Click "Create New Agent"
3. Configure:
   - **Name**: LATIF GX Enterprise AI
   - **Description**: Multi-agent AI orchestration system
   - **Instructions**: Use the system_prompt from agent-config.yaml
   - **Backend URL**: Your LATIF backend (e.g., http://your-server:8000)

## Step 3: Configure Tools

Add these tools to your Claude Agent:

### 1. Chat Tool
```json
{
  "name": "send_message",
  "description": "Send a message and get AI response",
  "parameters": {
    "message": "string (required)",
    "model": "string (default: llama2)",
    "temperature": "number (default: 0.7)"
  }
}
```

### 2. Agent Management Tools
```json
{
  "name": "get_agents",
  "description": "List all agents and their status",
  "parameters": {}
},
{
  "name": "start_agent",
  "description": "Start a specific agent",
  "parameters": {
    "agent_id": "string (planner|researcher|executor|critic|memory)"
  }
}
```

### 3. Workflow Tools
```json
{
  "name": "create_workflow",
  "description": "Create and execute a workflow",
  "parameters": {
    "name": "string",
    "description": "string",
    "steps": "array of objects",
    "agents": "array of strings"
  }
},
{
  "name": "get_workflows",
  "description": "List all workflows"
}
```

### 4. Knowledge Tools
```json
{
  "name": "search_knowledge",
  "description": "Search the knowledge graph",
  "parameters": {
    "query": "string",
    "limit": "integer (default: 20)"
  }
}
```

### 5. RAG Tools
```json
{
  "name": "rag_search",
  "description": "Search documents using RAG",
  "parameters": {
    "query": "string",
    "limit": "integer (default: 10)"
  }
}
```

## Step 4: System Prompt

Use this as your agent's system prompt:

```
You are LATIF GX, an advanced AI operating system with multi-agent orchestration capabilities.

Your backend system includes:
- 5 Specialized Agents: Planner, Researcher, Executor, Critic, Memory
- Workflow Engine: Execute complex multi-step tasks
- Hybrid RAG: Search and analyze documents
- Knowledge Graph: Manage entities and relationships
- Real-time Monitoring: Track system health and metrics

When users ask you to:
1. Research or analyze → Use Researcher agent or RAG search
2. Plan tasks → Use Planner agent or create workflows
3. Execute → Use Executor agent
4. Review or evaluate → Use Critic agent
5. Remember facts → Use Memory agent and knowledge graph

Always:
- Check system health before requests
- Use appropriate agents for tasks
- Monitor workflow progress
- Provide clear status updates
- Explain your reasoning
```

## Step 5: Test the Integration

```bash
# Test Python agent
python latif-agent.py

# Or in Claude, try:
# "What agents are available?"
# "Create a workflow to research AI"
# "Search my knowledge graph for topics about AI"
# "Show me system metrics"
```

## Example Interactions

### Query 1: Multi-Agent Research
**User**: "Research the latest developments in AI agents and summarize findings"

**Agent Response**:
1. ✅ Check system health
2. ✅ Activate Researcher agent
3. ✅ Search documents with RAG
4. ✅ Query knowledge graph
5. ✅ Generate summary response

### Query 2: Workflow Execution
**User**: "Create a workflow to analyze customer feedback documents and extract insights"

**Agent Response**:
1. ✅ Activate Planner agent
2. ✅ Break down into steps
3. ✅ Create workflow with Executor and Critic agents
4. ✅ Monitor progress
5. ✅ Report results

### Query 3: Knowledge Management
**User**: "Add this insight to my knowledge graph and find related information"

**Agent Response**:
1. ✅ Extract entity and relationships
2. ✅ Add to knowledge graph
3. ✅ Search for related entities
4. ✅ Provide connections

## Deployment Options

### Local Deployment
```bash
# Run everything locally
ollama serve  # Terminal 1
cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000  # Terminal 2
# Access agent via Claude interface
```

### Cloud Deployment (Production)

#### Option 1: Docker on AWS/GCP/Azure
```bash
# Build Docker image
docker build -f Dockerfile -t latif-agent .

# Deploy
docker run -p 8000:8000 \
  -e OLLAMA_HOST=your-ollama-server:11434 \
  latif-agent
```

#### Option 2: Vercel/Railway
```bash
# Deploy FastAPI backend to Vercel or Railway
# Configure CORS and HTTPS
# Update Claude Agent backend URL
```

#### Option 3: Claude Workspace
```bash
# If using Claude API directly
export CLAUDE_API_KEY="sk-..."
export LATIF_BACKEND_URL="https://your-backend.com"
python latif-agent.py
```

## Advanced Configuration

### Environment Variables
```bash
export LATIF_BACKEND_URL="http://127.0.0.1:8000"
export OLLAMA_HOST="127.0.0.1:11434"
export DEFAULT_MODEL="llama2"
export CLAUDE_API_KEY="your-api-key"
export AGENT_TIMEOUT=60
export MAX_CONCURRENT_REQUESTS=10
```

### Logging
```bash
# Enable detailed logging
export LOG_LEVEL="DEBUG"

# View logs
tail -f latif-agent.log
```

### Rate Limiting
Configure in agent-config.yaml:
```yaml
rate_limit:
  requests_per_minute: 60
  concurrent_requests: 10
```

## Monitoring & Debugging

### Health Check
```bash
curl http://127.0.0.1:8000/health
```

### View Metrics
```bash
curl http://127.0.0.1:8000/metrics
```

### Agent Status
```bash
curl http://127.0.0.1:8000/api/agents
```

### Check Workflows
```bash
curl http://127.0.0.1:8000/api/workflows
```

## Troubleshooting

### Agent Connection Issues
```bash
# Verify backend is running
curl http://127.0.0.1:8000/health

# Check backend logs
tail -f backend.log

# Restart backend
systemctl restart latif-backend
```

### Slow Responses
```bash
# Check system metrics
curl http://127.0.0.1:8000/metrics

# Reduce max tokens
export DEFAULT_MAX_TOKENS=1024

# Disable workflow progress tracking
# (faster, but less detailed)
```

### Agent Not Responding
```bash
# Check if Claude API key is valid
echo $CLAUDE_API_KEY

# Verify agent endpoint
python -c "import anthropic; print(anthropic.Anthropic().models.list())"

# Test agent directly
python latif-agent.py
```

## Security

### For Production

1. **Use HTTPS**
   ```bash
   # Generate SSL certificate
   openssl req -x509 -newkey rsa:4096 -out cert.pem -keyout key.pem -days 365
   ```

2. **Add Authentication**
   ```python
   # In main.py, add:
   from fastapi.security import HTTPBearer
   security = HTTPBearer()
   
   @app.get("/api/agents")
   async def get_agents(credentials: HTTPAuthCredentials = Depends(security)):
       # Validate token
   ```

3. **Environment Variables**
   ```bash
   export BACKEND_API_KEY="your-secret-key"
   ```

4. **Rate Limiting**
   - Already configured in agent-config.yaml
   - Adjust based on your needs

5. **CORS Configuration**
   ```python
   # In main.py
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["https://claude.ai"],  # Only Claude domain
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```

## Files Included

```
claude-agent/
├── agent-config.yaml          # Agent configuration
├── latif-agent.py             # Agent implementation
├── requirements.txt           # Python dependencies
└── README.md                  # This file
```

## Next Steps

1. ✅ Set up your LATIF backend
2. ✅ Configure the Claude Agent
3. ✅ Test locally
4. ✅ Deploy to production
5. ✅ Share with your team!

## Support

- **LATIF Documentation**: See SETUP_GUIDE.md
- **Claude API Docs**: https://docs.anthropic.com
- **Backend API Docs**: http://your-backend:8000/docs

## Example: Quick Start Command

```bash
# One-liner to deploy everything
cd latif-ai-config && \
python -m uvicorn backend/main:app --host 0.0.0.0 --port 8000 & \
python claude-agent/latif-agent.py
```

---

**Your LATIF GX system is now accessible through Claude!** 🚀

Users can interact with all your AI agents, workflows, and knowledge through a single Claude interface.

✨ **Full Power of LATIF GX + Simplicity of Claude Interface**
