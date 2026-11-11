from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app import checks, pinger
from app.main import app
from app.models import ConnectionCheck
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


def test_hops_in_chain_order() -> None:
    response = client.get("/connection/hops")

    assert response.status_code == 200
    assert [hop["name"] for hop in response.json()] == ["router", "nano", "provider", "internet"]


def test_live_hop(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_ping_hop(name: str) -> HopResult:
        return HopResult(name, "10.40.43.99", True, 3.21)

    monkeypatch.setattr(pinger, "ping_hop", fake_ping_hop)

    response = client.get("/connection/live/nano")

    assert response.status_code == 200
    assert response.json() == {"name": "nano", "ip": "10.40.43.99", "ok": True, "latency_ms": 3.21}


def test_live_unknown_hop() -> None:
    assert client.get("/connection/live/modem").status_code == 404


def test_latest_check(monkeypatch: pytest.MonkeyPatch, fake_session) -> None:
    async def fake_latest(session):
        return ConnectionCheck(
            date=datetime(2026, 11, 11, 12, 0, tzinfo=timezone.utc),
            router_ok=True,
            nano_ok=True,
            provider_ok=False,
            internet_ok=False,
            router_ms=1.5,
            nano_ms=2.5,
            provider_ms=None,
            internet_ms=None,
            online=False,
            break_at="provider",
        )

    monkeypatch.setattr(checks, "latest_check", fake_latest)

    body = client.get("/connection/latest").json()

    assert (body["online"], body["break_at"]) == (False, "provider")
    assert [(hop["name"], hop["ok"], hop["latency_ms"]) for hop in body["hops"]] == [
        ("router", True, 1.5),
        ("nano", True, 2.5),
        ("provider", False, None),
        ("internet", False, None),
    ]


def test_latest_check_before_any(monkeypatch: pytest.MonkeyPatch, fake_session) -> None:
    async def fake_latest(session):
        return None

    monkeypatch.setattr(checks, "latest_check", fake_latest)

    assert client.get("/connection/latest").json() is None
