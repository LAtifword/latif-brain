import json
import logging

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app.agents.chat_agent import ChatEngineUnavailable
from app.core.orchestrator import get_orchestrator
from app.models.schemas import ConversationOut, MessageOut
from app.services import conversation_repo
from app.services.activity_log import log_activity

logger = logging.getLogger("agentos.chat")

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/conversations", response_model=ConversationOut)
async def create_conversation(title: str = "New chat") -> ConversationOut:
    conv = await conversation_repo.create_conversation("chat", title)
    return ConversationOut(**conv)


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations() -> list[ConversationOut]:
    convs = await conversation_repo.list_conversations("chat")
    return [ConversationOut(**c) for c in convs]


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
async def get_messages(conversation_id: str) -> list[MessageOut]:
    conv = await conversation_repo.get_conversation(conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = await conversation_repo.list_messages(conversation_id)
    return [MessageOut(**m) for m in messages]


@router.websocket("/ws/{conversation_id}")
async def chat_websocket(websocket: WebSocket, conversation_id: str) -> None:
    """Streams a real local-model reply token-by-token.

    Client protocol: send {"content": "<user message>"} as text JSON.
    Server replies with a sequence of {"type": "token", "content": "..."}
    frames, then {"type": "done"} or {"type": "error", "detail": "..."}.
    """
    await websocket.accept()

    conv = await conversation_repo.get_conversation(conversation_id)
    if conv is None:
        await websocket.send_text(json.dumps({"type": "error", "detail": "Conversation not found"}))
        await websocket.close()
        return

    orchestrator = get_orchestrator()

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
                user_content = str(payload["content"]).strip()
            except (json.JSONDecodeError, KeyError):
                await websocket.send_text(
                    json.dumps({"type": "error", "detail": "Expected {\"content\": str}"})
                )
                continue

            if not user_content:
                continue

            await conversation_repo.add_message(conversation_id, "user", user_content)
            history_rows = await conversation_repo.list_messages(conversation_id)
            history = [{"role": m["role"], "content": m["content"]} for m in history_rows]

            full_reply = ""
            try:
                async for chunk in orchestrator.chat_agent.stream_reply(history):
                    full_reply += chunk
                    await websocket.send_text(json.dumps({"type": "token", "content": chunk}))
            except ChatEngineUnavailable as exc:
                await websocket.send_text(json.dumps({"type": "error", "detail": str(exc)}))
                await log_activity("chat", "error", str(exc))
                continue
            except Exception as exc:  # pragma: no cover - depends on native lib
                logger.exception("Chat generation failed")
                await websocket.send_text(json.dumps({"type": "error", "detail": str(exc)}))
                continue

            if full_reply.strip():
                await conversation_repo.add_message(conversation_id, "assistant", full_reply)
                await log_activity("chat", "reply", full_reply[:120])

            await websocket.send_text(json.dumps({"type": "done"}))
    except WebSocketDisconnect:
        return
