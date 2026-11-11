import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_db_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_check_connection() -> None:
        raise ConnectionError("connection refused")

    monkeypatch.setattr(db, "check_connection", fake_check_connection)

    response = client.get("/health/db")

    assert response.status_code == 503
