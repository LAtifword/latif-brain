import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


def _env(name: str, default: str) -> str:
    return os.environ.get(f"AGENTOS_{name}", default)


@dataclass
class Settings:
    app_name: str = "AgentOS"
    host: str = field(default_factory=lambda: _env("HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: int(_env("PORT", "8765")))

    data_dir: Path = DATA_DIR
    db_path: Path = DATA_DIR / "agentos.db"
    models_dir: Path = DATA_DIR / "models"

    # Path to a GGUF file to auto-load for the Chat Agent on startup.
    # If unset, the model manager uses the first *.gguf file found in
    # models_dir, and if none exists the Chat Agent reports "no model loaded".
    default_model_path: str | None = field(
        default_factory=lambda: os.environ.get("AGENTOS_DEFAULT_MODEL_PATH")
    )

    # Context window / generation defaults for llama.cpp
    llm_context_size: int = field(
        default_factory=lambda: int(_env("LLM_CONTEXT_SIZE", "4096"))
    )
    llm_max_new_tokens: int = field(
        default_factory=lambda: int(_env("LLM_MAX_NEW_TOKENS", "512"))
    )
    llm_threads: int | None = None  # None = let llama.cpp auto-detect

    system_stats_interval_seconds: float = 2.0

    cors_origins: list[str] = field(default_factory=lambda: ["*"])


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.models_dir.mkdir(parents=True, exist_ok=True)
    return settings
