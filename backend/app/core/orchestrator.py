from app.agents.chat_agent import ChatAgent
from app.agents.definitions import AGENT_DEFINITIONS
from app.services.model_manager import get_model_manager


class Orchestrator:
    """Owns agent instances and reports their real, live status.

    This is intentionally small: its job is to be the single place that
    knows which agents actually exist and can do work versus which are
    registered as metadata only. Every other layer (API, WebSocket, mobile
    UI) asks the orchestrator for status rather than assuming an agent is
    online.
    """

    def __init__(self) -> None:
        self._model_manager = get_model_manager()
        self.chat_agent = ChatAgent(self._model_manager)

    def list_agents(self) -> list[dict]:
        agents = []
        for definition in AGENT_DEFINITIONS:
            if not definition.implemented:
                status = "not_implemented"
            else:
                status = "online" if self._model_manager.is_loaded else "offline"
            agents.append(
                {
                    "id": definition.id,
                    "name": definition.name,
                    "category": definition.category,
                    "description": definition.description,
                    "icon": definition.icon,
                    "implemented": definition.implemented,
                    "status": status,
                    "capabilities": definition.capabilities,
                }
            )
        return agents

    def get_agent(self, agent_id: str) -> dict | None:
        for agent in self.list_agents():
            if agent["id"] == agent_id:
                return agent
        return None

    def running_agent_count(self) -> int:
        return sum(1 for a in self.list_agents() if a["status"] == "online")


_orchestrator: Orchestrator | None = None


def get_orchestrator() -> Orchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = Orchestrator()
    return _orchestrator
