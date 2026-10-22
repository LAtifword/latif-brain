"""
Multi-Agent Orchestrator
Coordinates execution of specialized agents
"""

import asyncio
import json
import logging
from typing import Dict, List, Any, AsyncIterator
from datetime import datetime
import httpx

logger = logging.getLogger(__name__)

class AgentOrchestrator:
    """Orchestrates multi-agent execution"""

    def __init__(self, ollama_host: str = "127.0.0.1", ollama_port: int = 11434):
        self.ollama_host = ollama_host
        self.ollama_port = ollama_port
        self.base_url = f"http://{ollama_host}:{ollama_port}"

        self.agents = {
            "planner": {
                "id": "planner",
                "name": "Planner Agent",
                "status": "idle",
                "tasks_completed": 0,
                "description": "Breaks down complex tasks into actionable plans",
                "model": "llama2"
            },
            "researcher": {
                "id": "researcher",
                "name": "Researcher Agent",
                "status": "idle",
                "tasks_completed": 0,
                "description": "Searches and analyzes information",
                "model": "llama2"
            },
            "executor": {
                "id": "executor",
                "name": "Executor Agent",
                "status": "idle",
                "tasks_completed": 0,
                "description": "Executes planned tasks and generates output",
                "model": "llama2"
            },
            "critic": {
                "id": "critic",
                "name": "Critic Agent",
                "status": "idle",
                "tasks_completed": 0,
                "description": "Reviews and validates agent outputs",
                "model": "llama2"
            },
            "memory": {
                "id": "memory",
                "name": "Memory Agent",
                "status": "idle",
                "tasks_completed": 0,
                "description": "Maintains context and long-term facts",
                "model": "llama2"
            }
        }

        self.sessions = {}
        self.available_models = []

    async def initialize(self):
        """Initialize orchestrator"""
        logger.info("Initializing Agent Orchestrator...")

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    data = response.json()
                    self.available_models = [m.get("name") for m in data.get("models", [])]
                    logger.info(f"✅ Connected to Ollama. Available models: {self.available_models}")
                else:
                    logger.warning(f"⚠️ Ollama not responding. Using default model.")
                    self.available_models = ["llama2"]

        except Exception as e:
            logger.warning(f"⚠️ Could not connect to Ollama: {e}. Will attempt on first request.")
            self.available_models = ["llama2"]

    async def shutdown(self):
        """Shutdown orchestrator"""
        logger.info("Shutting down Agent Orchestrator...")
        for agent_id in self.agents:
            await self.stop_agent(agent_id)

    async def get_all_agents(self) -> List[Dict[str, Any]]:
        """Get all agents"""
        return list(self.agents.values())

    async def get_agent(self, agent_id: str) -> Dict[str, Any]:
        """Get specific agent"""
        return self.agents.get(agent_id)

    async def start_agent(self, agent_id: str) -> bool:
        """Start an agent"""
        if agent_id not in self.agents:
            return False

        self.agents[agent_id]["status"] = "active"
        logger.info(f"Started agent: {agent_id}")
        return True

    async def stop_agent(self, agent_id: str) -> bool:
        """Stop an agent"""
        if agent_id not in self.agents:
            return False

        self.agents[agent_id]["status"] = "idle"
        logger.info(f"Stopped agent: {agent_id}")
        return True

    async def process_message(
        self,
        message: str,
        model: str = "llama2",
        temperature: float = 0.7,
        max_tokens: int = 2048,
        session_id: str = None
    ) -> Dict[str, Any]:
        """Process message through orchestrator"""

        if model not in self.available_models and self.available_models:
            model = self.available_models[0]

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                # Create system prompt
                system_prompt = self._create_system_prompt()

                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": model,
                        "prompt": system_prompt + "\n\nUser: " + message + "\n\nAssistant:",
                        "temperature": temperature,
                        "num_predict": max_tokens,
                        "stream": False
                    },
                    timeout=60.0
                )

                if response.status_code == 200:
                    data = response.json()
                    content = data.get("response", "").strip()

                    # Update agent stats
                    self.agents["executor"]["tasks_completed"] += 1

                    return {
                        "content": content,
                        "tokens_used": data.get("prompt_eval_count", 0),
                        "model": model,
                        "session_id": session_id
                    }
                else:
                    raise Exception(f"Ollama error: {response.status_code}")

        except Exception as e:
            logger.error(f"Process message error: {e}")
            return {
                "content": f"Error processing request: {str(e)}",
                "tokens_used": 0,
                "model": model,
                "error": True
            }

    async def stream_message(
        self,
        message: str,
        model: str = "llama2",
        temperature: float = 0.7,
        max_tokens: int = 2048,
        session_id: str = None
    ) -> AsyncIterator[str]:
        """Stream message response"""

        if model not in self.available_models and self.available_models:
            model = self.available_models[0]

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                system_prompt = self._create_system_prompt()

                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/generate",
                    json={
                        "model": model,
                        "prompt": system_prompt + "\n\nUser: " + message + "\n\nAssistant:",
                        "temperature": temperature,
                        "num_predict": max_tokens,
                        "stream": True
                    },
                    timeout=60.0
                ) as response:
                    async for line in response.aiter_lines():
                        if line:
                            try:
                                data = json.loads(line)
                                yield data.get("response", "")
                            except json.JSONDecodeError:
                                continue

        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"\nError: {str(e)}"

    def _create_system_prompt(self) -> str:
        """Create system prompt for the model"""
        return """You are LATIF GX, an advanced AI operating system with multi-agent orchestration capabilities.

You have access to specialized agents:
- Planner: Breaks down complex tasks
- Researcher: Searches and analyzes information
- Executor: Executes tasks and generates output
- Critic: Reviews and validates outputs
- Memory: Maintains context and facts

Your response should be:
1. Accurate and well-researched
2. Structured and organized
3. Actionable with clear next steps
4. Transparent about limitations

Always maintain context from previous messages and reference relevant knowledge."""

    async def delegate_to_agent(
        self,
        agent_id: str,
        task: str,
        context: Dict[str, Any] = None
    ) -> str:
        """Delegate task to specific agent"""

        if agent_id not in self.agents:
            raise ValueError(f"Unknown agent: {agent_id}")

        agent = self.agents[agent_id]
        agent["status"] = "busy"

        try:
            # Simulate agent processing
            response = await self.process_message(
                message=task,
                model=agent.get("model", "llama2")
            )

            agent["tasks_completed"] += 1
            return response.get("content", "")

        finally:
            agent["status"] = "idle"
