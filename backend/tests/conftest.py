from pathlib import Path

import pytest

from app.core.config import get_settings


@pytest.fixture(autouse=True)
def _isolated_environment(tmp_path: Path, monkeypatch):
    """Give every test a throwaway SQLite DB, models dir, and fresh singletons."""
    import app.core.orchestrator as orchestrator_module
    import app.services.model_manager as model_manager_module

    get_settings.cache_clear()
    monkeypatch.setenv("AGENTOS_HOST", "127.0.0.1")

    settings = get_settings()
    settings.data_dir = tmp_path
    settings.db_path = tmp_path / "agentos.db"
    settings.models_dir = tmp_path / "models"
    settings.models_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(model_manager_module, "_model_manager", None)
    monkeypatch.setattr(orchestrator_module, "_orchestrator", None)

    yield settings
