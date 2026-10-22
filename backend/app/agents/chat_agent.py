import asyncio
from collections.abc import AsyncIterator

from app.core.config import get_settings
from app.services.model_manager import ModelManager

_SENTINEL = object()

DEFAULT_SYSTEM_PROMPT = (
    "You are the Chat Agent inside AgentOS, an offline-first local AI "
    "assistant. Be concise and helpful. You have no internet access."
)


class ChatEngineUnavailable(RuntimeError):
    """Raised when there is no usable local model to answer with."""


class ChatAgent:
    def __init__(self, model_manager: ModelManager) -> None:
        self._model_manager = model_manager
        self._settings = get_settings()

    def ensure_ready(self) -> None:
        if not self._model_manager.is_loaded:
            loaded = self._model_manager.load()
            if not loaded:
                status = self._model_manager.status()
                raise ChatEngineUnavailable(status["detail"])

    async def stream_reply(
        self, history: list[dict[str, str]]
    ) -> AsyncIterator[str]:
        """Yields response text chunks for the given chat history.

        `history` is a list of {"role": "user"|"assistant"|"system", "content": str}
        in chronological order, not including the system prompt.
        """
        self.ensure_ready()
        engine = self._model_manager.engine
        if engine is None:
            raise ChatEngineUnavailable(self._model_manager.status()["detail"])

        messages = [{"role": "system", "content": DEFAULT_SYSTEM_PROMPT}, *history]

        # llama.cpp's generator is synchronous and CPU-bound; run it on a
        # worker thread and bridge chunks back through a queue so the
        # FastAPI event loop stays responsive to other connections while a
        # response is streaming.
        queue: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def _produce() -> None:
            try:
                stream = engine.create_chat_completion(
                    messages=messages,
                    max_tokens=self._settings.llm_max_new_tokens,
                    stream=True,
                )
                for chunk in stream:
                    delta = chunk["choices"][0]["delta"]
                    token = delta.get("content")
                    if token:
                        loop.call_soon_threadsafe(queue.put_nowait, token)
            except Exception as exc:  # pragma: no cover - depends on native lib
                loop.call_soon_threadsafe(queue.put_nowait, exc)
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, _SENTINEL)

        asyncio.get_running_loop().run_in_executor(None, _produce)

        while True:
            item = await queue.get()
            if item is _SENTINEL:
                break
            if isinstance(item, Exception):
                raise item
            yield item
