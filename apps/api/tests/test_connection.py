from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app import pinger
from app.main import app
from app.pinger import ChainCheck, HopResult

client = TestClient(app)


def test_live(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_ping_hops() -> ChainCheck:
        return ChainCheck(
            checked_at=datetime(2026, 11, 11, 12, 0, tzinfo=timezone.utc),
            hops=[
                HopResult("router", "10.40.43.100", True, 1.1),
                HopResult("nano", "10.40.43.99", True, 2.2),
                HopResult("provider", "10.40.43.125", False, None),
                HopResult("internet", "1.1.1.1", False, None),
            ],
        )

    monkeypatch.setattr(pinger, "ping_hops", fake_ping_hops)

    response = client.get("/connection/live")

    assert response.status_code == 200
    body = response.json()
    assert body["online"] is False
    assert body["break_at"] == "provider"
    assert [hop["ok"] for hop in body["hops"]] == [True, True, False, False]


def test_live_when_pings_cannot_be_sent(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_ping_hops() -> ChainCheck:
        raise PermissionError("Operation not permitted")

    monkeypatch.setattr(pinger, "ping_hops", fake_ping_hops)

    assert client.get("/connection/live").status_code == 503
