from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.orchestrator import get_orchestrator
from app.models.schemas import SystemStats
from app.services.system_monitor import collect_system_stats
from app.ws.manager import system_stats_manager

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.get("/stats", response_model=SystemStats)
async def stats() -> SystemStats:
    return SystemStats(**collect_system_stats())


@router.get("/summary")
async def summary() -> dict:
    orchestrator = get_orchestrator()
    return {
        "agents_running": orchestrator.running_agent_count(),
        "agents_total": len(orchestrator.list_agents()),
    }


@router.websocket("/ws")
async def system_stats_ws(websocket: WebSocket) -> None:
    """Live push channel for system stats.

    A background task started in main.py polls collect_system_stats() on an
    interval and broadcasts to every connected client via
    system_stats_manager; this endpoint just registers/unregisters the
    connection.
    """
    await system_stats_manager.connect(websocket)
    try:
        while True:
            # Connection is push-only; block on receive purely to detect
            # client disconnects (Flutter's web_socket_channel doesn't need
            # to send anything here).
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await system_stats_manager.disconnect(websocket)
