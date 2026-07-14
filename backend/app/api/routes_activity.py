from fastapi import APIRouter

from app.models.schemas import ActivityItem
from app.services.activity_log import list_recent_activity

router = APIRouter(prefix="/api/activity", tags=["activity"])


@router.get("", response_model=list[ActivityItem])
async def get_activity(limit: int = 20) -> list[ActivityItem]:
    items = await list_recent_activity(limit)
    return [ActivityItem(**item) for item in items]
