import logging
import time
import uuid
from pathlib import Path
from typing import Any

from app.core.config import get_settings

logger = logging.getLogger("agentos.model_manager")

# RAM required roughly tracks GGUF file size plus KV-cache/context overhead.
RAM_OVERHEAD_FACTOR = 1.15


class ModelManager:
    """Discovers local GGUF files and owns the loaded llama.cpp instance.

    llama-cpp-python is an optional native dependency. If it isn't installed
    the manager still works for listing/estimating models, it just reports
    that the inference engine is unavailable instead of pretending to load
    a model.
    """

    def __init__(self) -> None:
        self._settings = get_settings()
        self._llama: Any | None = None
        self._loaded_path: str | None = None
        self._load_error: str | None = None
        self._import_attempted: bool = False
        self._llama_cpp_import_error: str | None = None

    def list_model_files(self) -> list[dict]:
        files = sorted(self._settings.models_dir.glob("*.gguf"))
        result = []
        for f in files:
            size_bytes = f.stat().st_size
            result.append(
                {
                    "id": str(uuid.uuid5(uuid.NAMESPACE_URL, str(f.resolve()))),
                    "filename": f.name,
                    "path": str(f.resolve()),
                    "size_bytes": size_bytes,
                    "ram_estimate_mb": round(
                        size_bytes / (1024 * 1024) * RAM_OVERHEAD_FACTOR, 1
                    ),
                    "is_loaded": str(f.resolve()) == self._loaded_path,
                }
            )
        return result

    def _resolve_default_model(self) -> Path | None:
        if self._settings.default_model_path:
            candidate = Path(self._settings.default_model_path)
            if candidate.exists():
                return candidate
        files = sorted(self._settings.models_dir.glob("*.gguf"))
        return files[0] if files else None

    def _import_llama_cpp(self):
        self._import_attempted = True
        try:
            from llama_cpp import Llama  # type: ignore

            self._llama_cpp_import_error = None
            return Llama
        except ImportError as exc:  # pragma: no cover - depends on env
            self._llama_cpp_import_error = str(exc)
            return None

    def load(self, model_path: str | None = None) -> bool:
        target = Path(model_path) if model_path else self._resolve_default_model()
        if target is None or not target.exists():
            self._load_error = "No GGUF model file found in models directory."
            return False

        Llama = self._import_llama_cpp()
        if Llama is None:
            self._load_error = (
                "llama-cpp-python is not installed. Install it to enable local "
                "inference: pip install llama-cpp-python"
            )
            return False

        try:
            self._llama = Llama(
                model_path=str(target),
                n_ctx=self._settings.llm_context_size,
                n_threads=self._settings.llm_threads,
                verbose=False,
            )
            self._loaded_path = str(target.resolve())
            self._load_error = None
            return True
        except Exception as exc:  # pragma: no cover - depends on native lib
            logger.exception("Failed to load GGUF model %s", target)
            self._load_error = f"Failed to load model: {exc}"
            self._llama = None
            self._loaded_path = None
            return False

    def unload(self) -> None:
        self._llama = None
        self._loaded_path = None

    @property
    def is_loaded(self) -> bool:
        return self._llama is not None

    @property
    def loaded_model_name(self) -> str | None:
        return Path(self._loaded_path).name if self._loaded_path else None

    @property
    def engine(self) -> Any | None:
        return self._llama

    def status(self) -> dict:
        if self._llama is None and not self._import_attempted:
            # We don't yet know whether llama-cpp-python is installed; find
            # out now rather than optimistically reporting it as available.
            self._import_llama_cpp()
        engine_importable = self._llama is not None or self._llama_cpp_import_error is None

        detail = "Ready."
        if self._load_error:
            detail = self._load_error
        elif not self.is_loaded:
            detail = "No model loaded yet."

        return {
            "engine_available": engine_importable,
            "model_loaded": self.is_loaded,
            "model_name": self.loaded_model_name,
            "backend": "llama.cpp",
            "detail": detail,
        }


_model_manager: ModelManager | None = None


def get_model_manager() -> ModelManager:
    global _model_manager
    if _model_manager is None:
        _model_manager = ModelManager()
    return _model_manager


_start_time = time.time()


def process_uptime_seconds() -> float:
    return time.time() - _start_time
