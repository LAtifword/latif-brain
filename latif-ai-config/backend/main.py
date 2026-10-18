"""
LATIF GX Enterprise Backend Server
FastAPI-based multi-agent orchestration platform
"""

from fastapi import FastAPI, WebSocket, HTTPException, UploadFile, File, Header
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
import time

from agents.orchestrator import AgentOrchestrator
from agents.planner import PlannerAgent
from agents.researcher import ResearcherAgent
from agents.executor import ExecutorAgent
from agents.critic import CriticAgent
from agents.memory import MemoryAgent
from workflows.engine import WorkflowEngine
from rag.hybrid_rag import HybridRAG
from rag.hybrid_rag_v2 import HybridRAGv2
from knowledge.graph import KnowledgeGraph
from monitoring.metrics import MetricsCollector
from config import settings
from features import (
    vector_db, output_manager, cost_optimizer, semantic_cache,
    prompt_cache, rate_limiter, fallback_manager
)

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

class StructuredOutputRequest(BaseModel):
    task: str
    output_format: str = "json"
    schema: Optional[Dict[str, Any]] = None

class CostOptimizationRequest(BaseModel):
    prompt: str
    available_models: List[str]
    required_quality: float = 0.7
    budget_per_request: Optional[float] = None

class VectorSearchRequest(BaseModel):
    text: str
    limit: int = 10
    metadata_filter: Optional[Dict[str, Any]] = None

class SemanticCacheRequest(BaseModel):
    query: str
    similarity_threshold: float = 0.85

# ═══════════════════════════════════════════════════════════
# GLOBAL STATE
# ═══════════════════════════════════════════════════════════

orchestrator = None
workflow_engine = None
rag_system = None
rag_system_v2 = None
knowledge_graph = None
metrics_collector = None
active_sessions = {}
websocket_connections = []
# Advanced features already imported and initialized

# ═══════════════════════════════════════════════════════════
# STARTUP & SHUTDOWN
# ═══════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup_event():
    global orchestrator, workflow_engine, rag_system, rag_system_v2, knowledge_graph, metrics_collector

    logger.info("🚀 Starting LATIF GX Enterprise Server (v5.1.0 - Advanced Features)...")

    try:
        # Initialize core components
        orchestrator = AgentOrchestrator()
        await orchestrator.initialize()

        workflow_engine = WorkflowEngine()
        rag_system = HybridRAG()
        rag_system_v2 = HybridRAGv2()  # RAG v2 with hybrid search
        knowledge_graph = KnowledgeGraph()
        metrics_collector = MetricsCollector()

        # Initialize advanced features
        logger.info("📊 Initializing advanced features...")

        # Register model fallback chains
        await fallback_manager.check_all_models()
        logger.info("✅ Model fallback chains initialized")

        # Initialize prompt cache
        logger.info("✅ Semantic caching initialized")

        # Initialize rate limiter
        logger.info("✅ Advanced rate limiting initialized")

        logger.info("✅ All components and advanced features initialized successfully")

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
async def chat(request: ChatRequest, client_id: Optional[str] = Header(None)):
    """Send a message and get a response with advanced features"""
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Server not ready")

    client = client_id or "anonymous"
    session_id = request.session_id or str(uuid.uuid4())
    start_time = time.time()

    # Check rate limit
    allowed, retry_after, remaining = rate_limiter.check_rate_limit(client)
    if not allowed:
        logger.warning(f"Rate limit exceeded for client: {client}")
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Retry after {retry_after:.1f} seconds",
            headers={"Retry-After": str(int(retry_after))}
        )

    try:
        # Try semantic cache first
        cached_response, was_hit, similarity = await semantic_cache.get_or_compute(
            request.message,
            lambda: orchestrator.process_message(
                request.message,
                request.model,
                request.temperature,
                request.max_tokens,
                session_id
            ),
            similarity_threshold=0.80
        )

        latency_ms = (time.time() - start_time) * 1000

        # Record cost and metrics
        metrics = cost_optimizer.get_token_metrics(
            request.message,
            cached_response.get("content", ""),
            request.model
        )

        cost_optimizer.record_usage(
            request.model,
            metrics.prompt_tokens,
            metrics.completion_tokens,
            latency_ms,
            0.85 if was_hit else 0.9  # Cache hit gets quality boost
        )

        rate_limiter.release_request(client)

        return ChatResponse(
            response=cached_response.get("content", ""),
            session_id=session_id,
            tokens_used=metrics.total_tokens,
            processing_time=latency_ms / 1000,
            model=request.model
        )

    except HTTPException:
        rate_limiter.release_request(client)
        raise
    except Exception as e:
        logger.error(f"Chat error: {e}")
        rate_limiter.release_request(client)
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
# ADVANCED FEATURES API
# ═══════════════════════════════════════════════════════════

@app.get("/api/features/status")
async def get_features_status():
    """Get status of all advanced features"""
    return {
        "vector_db": {"enabled": True, "backend": vector_db.backend_type},
        "structured_output": {"enabled": True, "functions": len(output_manager.functions)},
        "cost_optimization": {"enabled": True, "tracked_models": len(cost_optimizer.model_performance)},
        "semantic_cache": {"enabled": True, "cache_stats": semantic_cache.get_stats()},
        "rate_limiting": {"enabled": True, "limits": rate_limiter.get_global_stats()},
        "model_fallback": {"enabled": True, "chains": list(fallback_manager.chains.keys())},
        "rag_v2": {"enabled": True}
    }

@app.post("/api/features/structured-output")
async def generate_structured_output(request: StructuredOutputRequest):
    """Generate structured output with validation"""
    try:
        prompt = output_manager.create_structured_prompt(
            task=request.task,
            output_format=request.output_format,
            schema=request.schema
        )

        # Use cached prompt completion if available
        response, hit = await prompt_cache.get_completion(
            prompt,
            lambda: orchestrator.process_message(prompt, "llama2", 0.7, 2048, str(uuid.uuid4()))
        )

        # Process structured response
        result = await output_manager.process_structured_response(
            response.get("content", ""),
            request.output_format,
            request.schema
        )

        return {
            "success": True,
            "cache_hit": hit,
            "output": result
        }

    except Exception as e:
        logger.error(f"Structured output error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/features/optimize-cost")
async def optimize_costs(request: CostOptimizationRequest):
    """Select optimal model for request"""
    try:
        # Get token metrics for prompt
        metrics = cost_optimizer.get_token_metrics(
            request.prompt,
            "",
            "llama2"
        )

        # Select optimal model
        optimal_model = cost_optimizer.select_optimal_model(
            request.available_models,
            request.required_quality,
            request.budget_per_request
        )

        # Get cost breakdown
        cost_summary = cost_optimizer.get_cost_summary(hours=24)
        performance = cost_optimizer.get_performance_report()

        return {
            "recommended_model": optimal_model,
            "prompt_tokens": metrics.prompt_tokens,
            "estimated_cost": metrics.cost,
            "cost_summary": cost_summary,
            "model_performance": performance
        }

    except Exception as e:
        logger.error(f"Cost optimization error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/features/vector-search")
async def vector_search(request: VectorSearchRequest):
    """Search using vector embeddings"""
    try:
        # Embed query text (simplified)
        query_embedding = [0.5] * 128  # Placeholder - would use real embedding in production

        results = await vector_db.search_embeddings(query_embedding, request.limit)

        return {
            "query": request.text,
            "results": results,
            "count": len(results),
            "backend": vector_db.backend_type
        }

    except Exception as e:
        logger.error(f"Vector search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/features/cache/stats")
async def get_cache_stats():
    """Get semantic cache statistics"""
    return {
        "semantic_cache": semantic_cache.get_stats(),
        "prompt_cache": prompt_cache.get_stats()
    }

@app.post("/api/features/cache/invalidate")
async def invalidate_cache(query: Optional[str] = None):
    """Invalidate cache entries"""
    if query:
        semantic_cache.invalidate(query)
        return {"status": "invalidated", "query": query}
    else:
        semantic_cache.invalidate()
        prompt_cache.clear()
        return {"status": "all_caches_cleared"}

@app.get("/api/features/rate-limit/quota")
async def get_rate_limit_quota(client_id: str = Header(None)):
    """Get rate limit quota for client"""
    client = client_id or "anonymous"
    return rate_limiter.get_client_quota(client)

@app.get("/api/features/models/fallback")
async def get_fallback_chains():
    """Get all model fallback chains and status"""
    chains_status = {}
    for chain_name in fallback_manager.chains:
        chains_status[chain_name] = fallback_manager.get_chain_status(chain_name)

    return {
        "chains": chains_status,
        "all_models": fallback_manager.get_status()
    }

@app.post("/api/features/models/select")
async def select_model_from_chain(
    chain_name: str = "balanced",
    min_quality: float = 0.5
):
    """Select best available model from fallback chain"""
    model = await fallback_manager.select_model(chain_name, min_quality)

    if not model:
        raise HTTPException(status_code=503, detail=f"No healthy model found in chain '{chain_name}'")

    return {"selected_model": model, "chain": chain_name}

@app.get("/api/features/rag-v2/stats")
async def get_rag_v2_stats():
    """Get RAG v2 hybrid search engine statistics"""
    if not rag_system_v2:
        raise HTTPException(status_code=503, detail="RAG v2 not ready")

    return rag_system_v2.get_stats()

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
    """Search documents via RAG (v1)"""
    if not rag_system:
        raise HTTPException(status_code=503, detail="RAG system not ready")

    try:
        results = await rag_system.search(query, limit=limit)
        return {
            "query": query,
            "results": results,
            "count": len(results),
            "version": "v1"
        }

    except Exception as e:
        logger.error(f"RAG search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/rag/search-v2")
async def rag_search_v2(
    query: str,
    limit: int = 10,
    alpha: float = 0.5,
    metadata_filter: Optional[Dict[str, Any]] = None
):
    """Advanced hybrid search via RAG v2 (BM25 + Semantic)"""
    if not rag_system_v2:
        raise HTTPException(status_code=503, detail="RAG v2 not ready")

    try:
        results = rag_system_v2.search(query, limit, alpha, metadata_filter)

        return {
            "query": query,
            "results": [
                {
                    "doc_id": r.doc_id,
                    "title": r.title,
                    "content": r.content[:500],  # Truncate for response
                    "metadata": r.metadata,
                    "relevance_score": r.relevance_score,
                    "search_type": r.search_type
                }
                for r in results
            ],
            "count": len(results),
            "version": "v2",
            "hybrid_ratio": {"bm25": alpha, "semantic": 1 - alpha}
        }

    except Exception as e:
        logger.error(f"RAG v2 search error: {e}")
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
