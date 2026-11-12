import asyncio
from collections import namedtuple
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app import devices, wavlink
from app.main import app
from app.models import Device
from app.wavlink import RouterDevice

client = TestClient(app)

NOW = datetime(2026, 11, 11, 20, 0, tzinfo=timezone.utc)
PHONE = "F4:06:16:68:CA:29"
LAPTOP = "9E:40:68:FE:7F:B1"
HistoryRow = namedtuple("HistoryRow", "start avg_down_kbs max_down_kbs avg_up_kbs max_up_kbs down_bytes up_bytes")


def _device(mac: str, *, online: bool = True, down: int = 0, up: int = 0, name: str = "", blocked: bool = False) -> RouterDevice:
    return RouterDevice(
        mac=mac,
        name=name,
        ip="192.168.20.10" if online else None,
        online=online,
        blocked=blocked,
        down_kbs=down,
        up_kbs=up,
        connected_since=NOW if online else None,
        limit_down_kbs=0,
        limit_up_kbs=0,
    )


def test_estimate_bytes() -> None:
    assert devices.estimate_bytes(100, 10, 10) == 100 * 1024 * 10


def test_estimate_bytes_caps_long_gaps() -> None:
    assert devices.estimate_bytes(100, 3600, 10) == 100 * 1024 * 30


class FakeSession:
    def __init__(self, previous: datetime | None) -> None:
        self.previous = previous
        self.executed = 0
        self.added: list = []

    async def scalar(self, query):
        return self.previous

    async def execute(self, statement):
        self.executed += 1

    def add_all(self, instances) -> None:
        self.added.extend(instances)

    async def commit(self) -> None:
        pass


def test_collect_devices_saves_online_devices_only(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeClient:
        async def list_devices(self):
            return [_device(PHONE, down=200, up=5), _device(LAPTOP, online=False)]

    monkeypatch.setattr(wavlink, "get_client", lambda: FakeClient())
    session = FakeSession(previous=datetime.now(timezone.utc) - timedelta(seconds=10))

    [sample] = asyncio.run(devices.collect_devices(session, interval_seconds=10))

    assert sample.mac == PHONE
    assert (sample.down_kbs, sample.up_kbs) == (200, 5)
    # About 10 s at 200 KB/s since the previous sample
    assert 200 * 1024 * 9 < sample.down_bytes <= 200 * 1024 * 11
    assert session.executed == 2


@pytest.fixture
def router(monkeypatch: pytest.MonkeyPatch, fake_session):
    state = {"devices": [_device(PHONE, down=200, up=5, name="iPhone"), _device(LAPTOP, online=False, blocked=True)]}
    calls: list[tuple] = []

    async def fake_live_devices():
        return state["devices"]

    async def fake_known(session):
        return [
            Device(mac=LAPTOP, name="MacBookAir", last_ip="192.168.20.110", last_seen=NOW),
            Device(mac="11:22:33:44:55:66", name="Old tablet", last_ip="192.168.20.50", last_seen=NOW),
        ]

    async def fake_usage(session, since):
        return {PHONE: (5_000_000, 100_000)}

    class FakeClient:
        async def set_blocked(self, mac, blocked):
            calls.append(("block", mac, blocked))
            state["devices"] = [
                _device(d.mac, online=d.online, down=d.down_kbs, up=d.up_kbs, name=d.name, blocked=blocked if d.mac == mac else d.blocked)
                for d in state["devices"]
            ]

        async def set_limit(self, mac, down, up):
            calls.append(("limit", mac, down, up))

        async def set_name(self, mac, name):
            calls.append(("name", mac, name))

    monkeypatch.setattr(devices, "live_devices", fake_live_devices)
    monkeypatch.setattr(devices, "list_known_devices", fake_known)
    monkeypatch.setattr(devices, "list_usage", fake_usage)
    monkeypatch.setattr(wavlink, "get_client", lambda: FakeClient())
    return calls


def test_list_devices(router) -> None:
    response = client.get("/devices")

    assert response.status_code == 200
    phone, laptop, tablet = response.json()
    assert (phone["mac"], phone["online"], phone["down_kbs"], phone["usage_24h_down_bytes"]) == (PHONE, True, 200, 5_000_000)
    # A name the router lost comes from the history
    assert (laptop["name"], laptop["ip"], laptop["blocked"], laptop["in_router"]) == ("MacBookAir", "192.168.20.110", True, True)
    assert (tablet["name"], tablet["in_router"], tablet["online"]) == ("Old tablet", False, False)


def test_block_device(router) -> None:
    response = client.post(f"/devices/{PHONE.lower()}/block", json={"blocked": True})

    assert response.status_code == 200
    assert response.json()["blocked"] is True
    assert router == [("block", PHONE, True)]


def test_limit_and_rename_device(router) -> None:
    assert client.post(f"/devices/{PHONE}/limit", json={"down_kbs": 100, "up_kbs": 0}).status_code == 200
    assert client.post(f"/devices/{PHONE}/name", json={"name": " Tele sala "}).status_code == 200

    assert router == [("limit", PHONE, 100, 0), ("name", PHONE, "Tele sala")]


@pytest.mark.parametrize(
    "path, body",
    [
        ("/devices/not-a-mac/block", {"blocked": True}),
        (f"/devices/{PHONE}/limit", {"down_kbs": -1, "up_kbs": 0}),
        (f"/devices/{PHONE}/name", {"name": ""}),
    ],
)
def test_invalid_input(router, path: str, body: dict) -> None:
    assert client.post(path, json=body).status_code == 422


def test_action_on_unknown_device(router) -> None:
    assert client.post("/devices/11:22:33:44:55:66/block", json={"blocked": True}).status_code == 404
    assert router == []


def test_router_unavailable(monkeypatch: pytest.MonkeyPatch, fake_session) -> None:
    async def failing():
        raise wavlink.WavlinkUnavailableError("timed out")

    monkeypatch.setattr(devices, "live_devices", failing)

    assert client.get("/devices").status_code == 503


def test_device_history(monkeypatch: pytest.MonkeyPatch, fake_session) -> None:
    seen = {}

    async def fake_history(session, mac, since, bucket):
        seen.update(mac=mac, bucket=bucket)
        return [HistoryRow(NOW, 120.456, 300, 4.0, 9, 1_000, 50), HistoryRow(NOW + timedelta(hours=1), 0, 0, 0, 0, 2_000, 0)]

    monkeypatch.setattr(devices, "list_device_history", fake_history)

    body = client.get(f"/devices/{PHONE.lower()}/history?hours=6&bucket=10min").json()

    assert seen == {"mac": PHONE, "bucket": "10min"}
    assert (body["total_down_bytes"], body["total_up_bytes"]) == (3_000, 50)
    assert body["items"][0]["avg_down_kbs"] == 120.5


def test_device_usage(router) -> None:
    response = client.get("/device-usage?hours=6")

    assert response.status_code == 200
    # Only devices that used something, the heaviest first, named from the history
    assert response.json() == [{"mac": PHONE, "name": "", "down_bytes": 5_000_000, "up_bytes": 100_000}]


def test_device_usage_rejects_too_many_hours(fake_session) -> None:
    assert client.get("/device-usage?hours=721").status_code == 422
