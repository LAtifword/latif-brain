from fastapi import APIRouter, HTTPException

from app.models.schemas import EngineStatus, ModelFileInfo
from app.services.model_manager import get_model_manager

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("", response_model=list[ModelFileInfo])
async def list_models() -> list[ModelFileInfo]:
    manager = get_model_manager()
    files = manager.list_model_files()
    return [
        ModelFileInfo(id=f["id"], filename=f["filename"], path=f["path"],
                       size_bytes=f["size_bytes"], ram_estimate_mb=f["ram_estimate_mb"],
                       added_at="", is_loaded=f["is_loaded"])
        for f in files
    ]


@router.get("/status", response_model=EngineStatus)
async def engine_status() -> EngineStatus:
    return EngineStatus(**get_model_manager().status())


@router.post("/load", response_model=EngineStatus)
async def load_model(path: str | None = None) -> EngineStatus:
    manager = get_model_manager()
    ok = manager.load(path)
    if not ok:
        raise HTTPException(status_code=422, detail=manager.status()["detail"])
    return EngineStatus(**manager.status())


@router.post("/unload", response_model=EngineStatus)
async def unload_model() -> EngineStatus:
    manager = get_model_manager()
    manager.unload()
    return EngineStatus(**manager.status())
