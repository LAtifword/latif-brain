import asyncio
import json

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)

    async def broadcast_json(self, payload: dict) -> None:
        message = json.dumps(payload)
        async with self._lock:
            targets = list(self._connections)
        for connection in targets:
            try:
                await connection.send_text(message)
            except Exception:
                await self.disconnect(connection)


system_stats_manager = ConnectionManager()
