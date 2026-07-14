import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    routes_activity,
    routes_agents,
    routes_auth,
    routes_chat,
    routes_models,
    routes_system,
)
from app.core.config import get_settings
from app.core.database import init_db
from app.services.activity_log import log_activity
from app.services.system_monitor import collect_system_stats
from app.ws.manager import system_stats_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agentos")

_broadcast_task: asyncio.Task | None = None


async def _broadcast_system_stats_loop() -> None:
    settings = get_settings()
    while True:
        try:
            await system_stats_manager.broadcast_json(collect_system_stats())
        except Exception:  # pragma: no cover - defensive
            logger.exception("Failed to broadcast system stats")
        await asyncio.sleep(settings.system_stats_interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await log_activity("system", "startup", "AgentOS backend started")

    global _broadcast_task
    _broadcast_task = asyncio.create_task(_broadcast_system_stats_loop())

    yield

    if _broadcast_task:
        _broadcast_task.cancel()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(routes_system.router)
    app.include_router(routes_agents.router)
    app.include_router(routes_chat.router)
    app.include_router(routes_models.router)
    app.include_router(routes_activity.router)
    app.include_router(routes_auth.router)

    return app


app = create_app()
