from fastapi import APIRouter, HTTPException

from app.core.orchestrator import get_orchestrator
from app.models.schemas import AgentInfo

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("", response_model=list[AgentInfo])
async def list_agents() -> list[AgentInfo]:
    return [AgentInfo(**a) for a in get_orchestrator().list_agents()]


@router.get("/{agent_id}", response_model=AgentInfo)
async def get_agent(agent_id: str) -> AgentInfo:
    agent = get_orchestrator().get_agent(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return AgentInfo(**agent)
