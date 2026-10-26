import uuid

from app.core.database import get_connection


async def create_conversation(agent_id: str, title: str) -> dict:
    conn = await get_connection()
    try:
        conv_id = str(uuid.uuid4())
        await conn.execute(
            "INSERT INTO conversations (id, agent_id, title) VALUES (?, ?, ?)",
            (conv_id, agent_id, title),
        )
        await conn.commit()
        cursor = await conn.execute(
            "SELECT * FROM conversations WHERE id = ?", (conv_id,)
        )
        row = await cursor.fetchone()
        return dict(row)
    finally:
        await conn.close()


async def get_conversation(conversation_id: str) -> dict | None:
    conn = await get_connection()
    try:
        cursor = await conn.execute(
            "SELECT * FROM conversations WHERE id = ?", (conversation_id,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None
    finally:
        await conn.close()


async def list_conversations(agent_id: str) -> list[dict]:
    conn = await get_connection()
    try:
        cursor = await conn.execute(
            "SELECT * FROM conversations WHERE agent_id = ? ORDER BY updated_at DESC",
            (agent_id,),
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        await conn.close()


async def add_message(conversation_id: str, role: str, content: str) -> dict:
    conn = await get_connection()
    try:
        msg_id = str(uuid.uuid4())
        await conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)",
            (msg_id, conversation_id, role, content),
        )
        await conn.execute(
            "UPDATE conversations SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') "
            "WHERE id = ?",
            (conversation_id,),
        )
        await conn.commit()
        cursor = await conn.execute("SELECT * FROM messages WHERE id = ?", (msg_id,))
        row = await cursor.fetchone()
        return dict(row)
    finally:
        await conn.close()


async def list_messages(conversation_id: str) -> list[dict]:
    conn = await get_connection()
    try:
        cursor = await conn.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (conversation_id,),
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        await conn.close()
