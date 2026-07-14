"""
LATIF GX Enterprise Backend Server
FastAPI-based multi-agent orchestration platform
"""

from fastapi import FastAPI, WebSocket, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import json
import logging
from datetime import datetime
import psutil
import uuid

from agents.orchestrator import AgentOrchestrator
from agents.planner import PlannerAgent
from agents.researcher import ResearcherAgent
from agents.executor import ExecutorAgent
from agents.critic import CriticAgent
from agents.memory import MemoryAgent
from workflows.engine import WorkflowEngine
from rag.hybrid_rag import HybridRAG
from knowledge.graph import KnowledgeGraph
from monitoring.metrics import MetricsCollector
from config import settings

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title="LATIF GX Enterprise Server",
    description="Multi-agent AI orchestration platform",
    version="5.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════

class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    model: str = "llama2"
    temperature: float = 0.7
    max_tokens: int = 2048
    stream: bool = False
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str
    tokens_used: int
    processing_time: float
    model: str

class AgentStatusUpdate(BaseModel):
    agent_id: str
    status: str
    tasks_completed: int
    last_activity: str

class WorkflowRequest(BaseModel):
    name: str
    description: str
    steps: List[Dict[str, Any]]
    agents: List[str]

class WorkflowStatus(BaseModel):
    workflow_id: str
    name: str
    status: str
    progress: int
    current_step: int
    total_steps: int
    start_time: str
    estimated_completion: str

class SystemMetrics(BaseModel):
    cpu_percent: float
    memory_percent: float
    memory_mb: float
    requests_per_minute: int
    uptime_seconds: float
    active_agents: int
    active_workflows: int

class EntityData(BaseModel):
    name: str
    entity_type: str
    description: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None

# ═══════════════════════════════════════════════════════════
# GLOBAL STATE
# ═══════════════════════════════════════════════════════════

orchestrator = None
workflow_engine = None
rag_system = None
knowledge_graph = None
metrics_collector = None
active_sessions = {}
websocket_connections = []

# ═══════════════════════════════════════════════════════════
# STARTUP & SHUTDOWN
# ═══════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup_event():
    global orchestrator, workflow_engine, rag_system, knowledge_graph, metrics_collector

    logger.info("🚀 Starting LATIF GX Enterprise Server...")

    try:
        # Initialize components
        orchestrator = AgentOrchestrator()
        await orchestrator.initialize()

        workflow_engine = WorkflowEngine()
        rag_system = HybridRAG()
        knowledge_graph = KnowledgeGraph()
        metrics_collector = MetricsCollector()

        logger.info("✅ All components initialized successfully")

    except Exception as e:
        logger.error(f"❌ Startup failed: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 Shutting down LATIF GX Enterprise Server...")
    if orchestrator:
        await orchestrator.shutdown()
    logger.info("✅ Server shutdown complete")

# ═══════════════════════════════════════════════════════════
# HEALTH & STATUS
# ═══════════════════════════════════════════════════════════

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "5.0.0",
        "components": {
            "orchestrator": "ready" if orchestrator else "initializing",
            "workflow_engine": "ready" if workflow_engine else "initializing",
            "rag_system": "ready" if rag_system else "initializing",
            "knowledge_graph": "ready" if knowledge_graph else "initializing"
        }
    }

@app.get("/metrics")
async def get_metrics() -> SystemMetrics:
    """Get system metrics"""
    if not metrics_collector:
        raise HTTPException(status_code=503, detail="Metrics not available yet")

    metrics = await metrics_collector.collect()
    return SystemMetrics(**metrics)

# ═══════════════════════════════════════════════════════════
# CHAT API
# ═══════════════════════════════════════════════════════════

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send a message and get a response"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Server not ready")

    session_id = request.session_id or str(uuid.uuid4())
    start_time = datetime.now()

    try:
        # Use orchestrator to process message
        response = await orchestrator.process_message(
            message=request.message,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            session_id=session_id
        )

        processing_time = (datetime.now() - start_time).total_seconds()

        return ChatResponse(
            response=response.get("content", ""),
            session_id=session_id,
            tokens_used=response.get("tokens_used", 0),
            processing_time=processing_time,
            model=request.model
        )

    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """Streaming chat endpoint"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Server not ready")

    session_id = request.session_id or str(uuid.uuid4())

    async def generate():
        try:
            async for chunk in orchestrator.stream_message(
                message=request.message,
                model=request.model,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                session_id=session_id
            ):
                yield json.dumps({
                    "chunk": chunk,
                    "session_id": session_id,
                    "timestamp": datetime.now().isoformat()
                }) + "\n"
        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield json.dumps({"error": str(e)}) + "\n"

    return generate()

# ═══════════════════════════════════════════════════════════
# AGENTS API
# ═══════════════════════════════════════════════════════════

@app.get("/api/agents")
async def get_agents() -> List[Dict[str, Any]]:
    """Get all agents and their status"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Server not ready")

    agents = await orchestrator.get_all_agents()
    return agents

@app.get("/api/agents/{agent_id}")
async def get_agent_status(agent_id: str) -> Dict[str, Any]:
    """Get specific agent status"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Server not ready")

    agent = await orchestrator.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    return agent

@app.post("/api/agents/{agent_id}/start")
async def start_agent(agent_id: str):
    """Start an agent"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Server not ready")

    success = await orchestrator.start_agent(agent_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to start agent")

    return {"status": "started", "agent_id": agent_id}

@app.post("/api/agents/{agent_id}/stop")
async def stop_agent(agent_id: str):
    """Stop an agent"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Server not ready")

    success = await orchestrator.stop_agent(agent_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to stop agent")

    return {"status": "stopped", "agent_id": agent_id}

# ═══════════════════════════════════════════════════════════
# WORKFLOWS API
# ═══════════════════════════════════════════════════════════

@app.post("/api/workflows", response_model=WorkflowStatus)
async def create_workflow(request: WorkflowRequest):
    """Create and start a new workflow"""
    if not workflow_engine:
        raise HTTPException(status_code=503, detail="Workflow engine not ready")

    try:
        workflow = await workflow_engine.create_workflow(
            name=request.name,
            description=request.description,
            steps=request.steps,
            agents=request.agents
        )

        return WorkflowStatus(**workflow)

    except Exception as e:
        logger.error(f"Workflow creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/workflows")
async def get_workflows() -> List[WorkflowStatus]:
    """Get all workflows"""
    if not workflow_engine:
        raise HTTPException(status_code=503, detail="Workflow engine not ready")

    workflows = await workflow_engine.get_all_workflows()
    return [WorkflowStatus(**w) for w in workflows]

@app.get("/api/workflows/{workflow_id}")
async def get_workflow_status(workflow_id: str) -> WorkflowStatus:
    """Get workflow status"""
    if not workflow_engine:
        raise HTTPException(status_code=503, detail="Workflow engine not ready")

    workflow = await workflow_engine.get_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    return WorkflowStatus(**workflow)

@app.post("/api/workflows/{workflow_id}/pause")
async def pause_workflow(workflow_id: str):
    """Pause a workflow"""
    if not workflow_engine:
        raise HTTPException(status_code=503, detail="Workflow engine not ready")

    success = await workflow_engine.pause_workflow(workflow_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to pause workflow")

    return {"status": "paused", "workflow_id": workflow_id}

@app.post("/api/workflows/{workflow_id}/resume")
async def resume_workflow(workflow_id: str):
    """Resume a workflow"""
    if not workflow_engine:
        raise HTTPException(status_code=503, detail="Workflow engine not ready")

    success = await workflow_engine.resume_workflow(workflow_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to resume workflow")

    return {"status": "resumed", "workflow_id": workflow_id}

@app.post("/api/workflows/{workflow_id}/cancel")
async def cancel_workflow(workflow_id: str):
    """Cancel a workflow"""
    if not workflow_engine:
        raise HTTPException(status_code=503, detail="Workflow engine not ready")

    success = await workflow_engine.cancel_workflow(workflow_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to cancel workflow")

    return {"status": "cancelled", "workflow_id": workflow_id}

# ═══════════════════════════════════════════════════════════
# KNOWLEDGE GRAPH API
# ═══════════════════════════════════════════════════════════

@app.get("/api/knowledge/stats")
async def get_knowledge_stats():
    """Get knowledge graph statistics"""
    if not knowledge_graph:
        raise HTTPException(status_code=503, detail="Knowledge graph not ready")

    stats = await knowledge_graph.get_stats()
    return stats

@app.post("/api/knowledge/entities")
async def add_entity(entity: EntityData):
    """Add entity to knowledge graph"""
    if not knowledge_graph:
        raise HTTPException(status_code=503, detail="Knowledge graph not ready")

    entity_id = await knowledge_graph.add_entity(
        name=entity.name,
        entity_type=entity.entity_type,
        description=entity.description,
        properties=entity.properties
    )

    return {"entity_id": entity_id, "name": entity.name}

@app.get("/api/knowledge/entities")
async def get_entities(limit: int = 50):
    """Get recent entities"""
    if not knowledge_graph:
        raise HTTPException(status_code=503, detail="Knowledge graph not ready")

    entities = await knowledge_graph.get_recent_entities(limit=limit)
    return entities

@app.get("/api/knowledge/search")
async def search_knowledge(query: str, limit: int = 20):
    """Search knowledge graph"""
    if not knowledge_graph:
        raise HTTPException(status_code=503, detail="Knowledge graph not ready")

    results = await knowledge_graph.search(query, limit=limit)
    return results

# ═══════════════════════════════════════════════════════════
# RAG API
# ═══════════════════════════════════════════════════════════

@app.post("/api/rag/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload file for RAG"""
    if not rag_system:
        raise HTTPException(status_code=503, detail="RAG system not ready")

    try:
        content = await file.read()
        file_id = await rag_system.add_document(
            content=content.decode(),
            filename=file.filename,
            file_type=file.content_type
        )

        return {
            "file_id": file_id,
            "filename": file.filename,
            "size": len(content),
            "status": "indexed"
        }

    except Exception as e:
        logger.error(f"File upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/rag/search")
async def rag_search(query: str, limit: int = 10):
    """Search documents via RAG"""
    if not rag_system:
        raise HTTPException(status_code=503, detail="RAG system not ready")

    try:
        results = await rag_system.search(query, limit=limit)
        return {
            "query": query,
            "results": results,
            "count": len(results)
        }

    except Exception as e:
        logger.error(f"RAG search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ═══════════════════════════════════════════════════════════
# WEBSOCKET
# ═══════════════════════════════════════════════════════════

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for real-time updates"""
    await websocket.accept()
    websocket_connections.append(websocket)

    try:
        while True:
            # Receive message
            data = await websocket.receive_text()
            message = json.loads(data)

            # Handle different message types
            if message.get("type") == "subscribe":
                # Subscribe to updates
                await websocket.send_json({
                    "type": "subscribed",
                    "channel": message.get("channel")
                })

            elif message.get("type") == "ping":
                # Respond to ping
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now().isoformat()
                })

    except Exception as e:
        logger.error(f"WebSocket error: {e}")

    finally:
        websocket_connections.remove(websocket)

async def broadcast_update(update_type: str, data: Dict):
    """Broadcast update to all WebSocket connections"""
    message = {
        "type": update_type,
        "data": data,
        "timestamp": datetime.now().isoformat()
    }

    for connection in websocket_connections:
        try:
            await connection.send_json(message)
        except Exception as e:
            logger.error(f"Broadcast error: {e}")

# ═══════════════════════════════════════════════════════════
# ROOT
# ═══════════════════════════════════════════════════════════

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "LATIF GX Enterprise Server",
        "version": "5.0.0",
        "status": "running",
        "docs": "/docs",
        "endpoints": {
            "health": "/health",
            "metrics": "/metrics",
            "chat": "/api/chat",
            "agents": "/api/agents",
            "workflows": "/api/workflows",
            "knowledge": "/api/knowledge",
            "rag": "/api/rag"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )
