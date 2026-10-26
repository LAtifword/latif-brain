from app.core.database import get_connection


async def log_activity(agent_id: str, action: str, detail: str = "") -> None:
    conn = await get_connection()
    try:
        await conn.execute(
            "INSERT INTO activity_log (agent_id, action, detail) VALUES (?, ?, ?)",
            (agent_id, action, detail),
        )
        await conn.commit()
    finally:
        await conn.close()


async def list_recent_activity(limit: int = 20) -> list[dict]:
    conn = await get_connection()
    try:
        cursor = await conn.execute(
            "SELECT id, agent_id, action, detail, created_at FROM activity_log "
            "ORDER BY id DESC LIMIT ?",
            (limit,),
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        await conn.close()
