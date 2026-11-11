from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _isolated_db(tmp_path, monkeypatch):
    """Every test gets its own SQLite file; settings are cached, so patch the object."""
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "db_path", str(tmp_path / "test.db"), raising=False)
    from app.store import db as db_module

    db_module.init_db()
    yield


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c
