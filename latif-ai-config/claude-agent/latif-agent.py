"""
LATIF GX Claude Managed Agent
Implements Claude integration with LATIF GX backend
"""

import os
import json
import httpx
import logging
from typing import Any, Dict, Optional
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class LatifAgent:
    """Claude agent for LATIF GX backend integration"""

    def __init__(self, backend_url: str = None):
        """Initialize the agent"""
        self.backend_url = backend_url or os.getenv("LATIF_BACKEND_URL", "http://127.0.0.1:8000")
        self.client = httpx.AsyncClient(timeout=60.0)
        self.model = "llama2"
        self.temperature = 0.7
        self.max_tokens = 2048

    async def send_message(
        self,
        message: str,
        model: str = None,
        temperature: float = None,
        max_tokens: int = None
    ) -> Dict[str, Any]:
        """Send a message to LATIF and get response"""
        try:
            response = await self.client.post(
                f"{self.backend_url}/api/chat",
                json={
                    "message": message,
                    "model": model or self.model,
                    "temperature": temperature or self.temperature,
                    "max_tokens": max_tokens or self.max_tokens,
                    "stream": False
                }
            )
            return response.json()
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            return {"error": str(e)}

    async def get_agents(self) -> Dict[str, Any]:
        """Get all agents and their status"""
        try:
            response = await self.client.get(f"{self.backend_url}/api/agents")
            return {"agents": response.json()}
        except Exception as e:
            logger.error(f"Error getting agents: {e}")
            return {"error": str(e)}

    async def get_agent_status(self, agent_id: str) -> Dict[str, Any]:
        """Get specific agent status"""
        try:
            response = await self.client.get(f"{self.backend_url}/api/agents/{agent_id}")
            return response.json()
        except Exception as e:
            logger.error(f"Error getting agent status: {e}")
            return {"error": str(e)}

    async def start_agent(self, agent_id: str) -> Dict[str, Any]:
        """Start an agent"""
        try:
            response = await self.client.post(f"{self.backend_url}/api/agents/{agent_id}/start")
            return response.json()
        except Exception as e:
            logger.error(f"Error starting agent: {e}")
            return {"error": str(e)}

    async def stop_agent(self, agent_id: str) -> Dict[str, Any]:
        """Stop an agent"""
        try:
            response = await self.client.post(f"{self.backend_url}/api/agents/{agent_id}/stop")
            return response.json()
        except Exception as e:
            logger.error(f"Error stopping agent: {e}")
            return {"error": str(e)}

    async def create_workflow(
        self,
        name: str,
        description: str,
        steps: list,
        agents: list
    ) -> Dict[str, Any]:
        """Create a workflow"""
        try:
            response = await self.client.post(
                f"{self.backend_url}/api/workflows",
                json={
                    "name": name,
                    "description": description,
                    "steps": steps,
                    "agents": agents
                }
            )
            return response.json()
        except Exception as e:
            logger.error(f"Error creating workflow: {e}")
            return {"error": str(e)}

    async def get_workflows(self) -> Dict[str, Any]:
        """Get all workflows"""
        try:
            response = await self.client.get(f"{self.backend_url}/api/workflows")
            return {"workflows": response.json()}
        except Exception as e:
            logger.error(f"Error getting workflows: {e}")
            return {"error": str(e)}

    async def get_workflow_status(self, workflow_id: str) -> Dict[str, Any]:
        """Get workflow status"""
        try:
            response = await self.client.get(f"{self.backend_url}/api/workflows/{workflow_id}")
            return response.json()
        except Exception as e:
            logger.error(f"Error getting workflow status: {e}")
            return {"error": str(e)}

    async def pause_workflow(self, workflow_id: str) -> Dict[str, Any]:
        """Pause a workflow"""
        try:
            response = await self.client.post(f"{self.backend_url}/api/workflows/{workflow_id}/pause")
            return response.json()
        except Exception as e:
            logger.error(f"Error pausing workflow: {e}")
            return {"error": str(e)}

    async def resume_workflow(self, workflow_id: str) -> Dict[str, Any]:
        """Resume a workflow"""
        try:
            response = await self.client.post(f"{self.backend_url}/api/workflows/{workflow_id}/resume")
            return response.json()
        except Exception as e:
            logger.error(f"Error resuming workflow: {e}")
            return {"error": str(e)}

    async def cancel_workflow(self, workflow_id: str) -> Dict[str, Any]:
        """Cancel a workflow"""
        try:
            response = await self.client.post(f"{self.backend_url}/api/workflows/{workflow_id}/cancel")
            return response.json()
        except Exception as e:
            logger.error(f"Error canceling workflow: {e}")
            return {"error": str(e)}

    async def search_knowledge(self, query: str, limit: int = 20) -> Dict[str, Any]:
        """Search knowledge graph"""
        try:
            response = await self.client.get(
                f"{self.backend_url}/api/knowledge/search",
                params={"query": query, "limit": limit}
            )
            return response.json()
        except Exception as e:
            logger.error(f"Error searching knowledge: {e}")
            return {"error": str(e)}

    async def get_knowledge_stats(self) -> Dict[str, Any]:
        """Get knowledge graph stats"""
        try:
            response = await self.client.get(f"{self.backend_url}/api/knowledge/stats")
            return response.json()
        except Exception as e:
            logger.error(f"Error getting knowledge stats: {e}")
            return {"error": str(e)}

    async def add_entity(
        self,
        name: str,
        entity_type: str,
        description: str = None
    ) -> Dict[str, Any]:
        """Add entity to knowledge graph"""
        try:
            response = await self.client.post(
                f"{self.backend_url}/api/knowledge/entities",
                json={
                    "name": name,
                    "entity_type": entity_type,
                    "description": description
                }
            )
            return response.json()
        except Exception as e:
            logger.error(f"Error adding entity: {e}")
            return {"error": str(e)}

    async def rag_search(self, query: str, limit: int = 10) -> Dict[str, Any]:
        """Search documents via RAG"""
        try:
            response = await self.client.post(
                f"{self.backend_url}/api/rag/search",
                json={"query": query, "limit": limit}
            )
            return response.json()
        except Exception as e:
            logger.error(f"Error searching RAG: {e}")
            return {"error": str(e)}

    async def get_metrics(self) -> Dict[str, Any]:
        """Get system metrics"""
        try:
            response = await self.client.get(f"{self.backend_url}/metrics")
            return response.json()
        except Exception as e:
            logger.error(f"Error getting metrics: {e}")
            return {"error": str(e)}

    async def health_check(self) -> Dict[str, Any]:
        """Check system health"""
        try:
            response = await self.client.get(f"{self.backend_url}/health")
            return response.json()
        except Exception as e:
            logger.error(f"Error checking health: {e}")
            return {"error": str(e), "status": "unhealthy"}

    async def process_user_request(self, request: str) -> Dict[str, Any]:
        """
        Main entry point for processing user requests.
        Analyzes the request and routes to appropriate tools.
        """
        logger.info(f"Processing request: {request}")

        # Check system health first
        health = await self.health_check()
        if "error" in health:
            return {"error": "System is not responding", "health": health}

        # Route based on request content
        request_lower = request.lower()

        # Knowledge Graph requests
        if any(keyword in request_lower for keyword in ["search", "find", "look for", "know"]):
            return await self.search_knowledge(request, limit=20)

        # Workflow requests
        elif any(keyword in request_lower for keyword in ["workflow", "execute", "run", "process"]):
            agents = await self.get_agents()
            return {
                "message": "Ready to create workflow",
                "agents": agents,
                "request": request
            }

        # Agent requests
        elif any(keyword in request_lower for keyword in ["agent", "planner", "researcher", "executor"]):
            return await self.get_agents()

        # RAG/Document search
        elif any(keyword in request_lower for keyword in ["document", "file", "rag", "retrieval"]):
            return await self.rag_search(request, limit=10)

        # Metrics/Status
        elif any(keyword in request_lower for keyword in ["metric", "status", "health", "performance"]):
            metrics = await self.get_metrics()
            return metrics

        # Default: Chat
        else:
            return await self.send_message(request)

    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()


# Example usage
async def main():
    """Example usage of the agent"""
    agent = LatifAgent()

    try:
        # Check health
        print("🏥 Checking system health...")
        health = await agent.health_check()
        print(json.dumps(health, indent=2))

        # Get agents
        print("\n🤖 Getting agents...")
        agents = await agent.get_agents()
        print(json.dumps(agents, indent=2))

        # Send a message
        print("\n💬 Sending message...")
        response = await agent.send_message("Hello LATIF! What can you do?")
        print(json.dumps(response, indent=2))

        # Search knowledge
        print("\n🔍 Searching knowledge graph...")
        results = await agent.search_knowledge("AI agents", limit=5)
        print(json.dumps(results, indent=2))

        # Get metrics
        print("\n📊 Getting metrics...")
        metrics = await agent.get_metrics()
        print(json.dumps(metrics, indent=2))

    finally:
        await agent.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
