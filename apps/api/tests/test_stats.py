from collections import namedtuple
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app import checks, connection_status, traffic
from app.connection_status import ConnectionStatus, OutagePeriod
from app.main import app

client = TestClient(app)

T0 = datetime(2026, 11, 11, 0, 0, tzinfo=timezone.utc)
State = namedtuple("State", "date online break_at")
Bucket = namedtuple("Bucket", "start rx_bytes tx_bytes")


@pytest.fixture
def states(monkeypatch: pytest.MonkeyPatch, fake_session):
    rows = [
        State(T0, True, None),
        State(T0 + timedelta(seconds=30), False, "provider"),
        State(T0 + timedelta(seconds=60), False, "provider"),
        State(T0 + timedelta(seconds=90), True, None),
    ]

    async def fake_list_states(session, since):
        return rows

    monkeypatch.setattr(checks, "list_states", fake_list_states)


def test_connection_history(states) -> None:
    response = client.get("/connection-history?hours=24")

    assert response.status_code == 200
    assert [(s["online"], s["break_at"]) for s in response.json()] == [(True, None), (False, "provider"), (True, None)]


def test_outages(states) -> None:
    [outage] = client.get("/outages").json()

    assert outage["break_at"] == "provider"
    assert outage["ongoing"] is False
    assert outage["duration_hours"] == round(60 / 3600, 3)


@pytest.mark.parametrize("path", ["/connection-history?hours=0", "/outages?hours=200", "/bandwidth?hours=800"])
def test_hours_out_of_range(path: str, fake_session) -> None:
    assert client.get(path).status_code == 422


def test_bandwidth(monkeypatch: pytest.MonkeyPatch, fake_session) -> None:
    seen = {}

    async def fake_list_bandwidth(session, since, bucket):
        seen["bucket"] = bucket
        return [Bucket(T0, 1000, 100), Bucket(T0 + timedelta(days=1), 3000, 300)]

    monkeypatch.setattr(traffic, "list_bandwidth", fake_list_bandwidth)

    response = client.get("/bandwidth?hours=168&bucket=day")

    assert response.status_code == 200
    body = response.json()
    assert seen["bucket"] == "day"
    assert (body["total_rx_bytes"], body["total_tx_bytes"]) == (4000, 400)
    assert len(body["items"]) == 2


def test_bandwidth_rejects_unknown_bucket(fake_session) -> None:
    assert client.get("/bandwidth?bucket=week").status_code == 422


def test_connection_status(monkeypatch: pytest.MonkeyPatch, fake_session) -> None:
    async def fake_status(session):
        return ConnectionStatus(
            online=True,
            break_at=None,
            current_since=T0 + timedelta(hours=1),
            last_online=T0 + timedelta(hours=2),
            last_outage=OutagePeriod(start=T0, end=T0 + timedelta(hours=1), break_at="nano"),
            last_online_period=None,
        )

    monkeypatch.setattr(connection_status, "get_connection_status", fake_status)

    body = client.get("/connection-status").json()

    assert body["online"] is True
    assert body["last_outage"] == {
        "start": "2026-11-11T00:00:00Z",
        "end": "2026-11-11T01:00:00Z",
        "duration_hours": 1.0,
        "break_at": "nano",
    }
    assert body["last_online_period"] is None
