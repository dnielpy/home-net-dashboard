import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from app import nano, throughput
from app.main import app
from app.nano import NanoTraffic
from app.throughput import Reading, rate, throughput_events

client = TestClient(app)


def test_rate_is_bytes_per_second() -> None:
    previous = Reading(NanoTraffic(rx_bytes=1000, tx_bytes=100, uptime=10), at=0.0)
    current = Reading(NanoTraffic(rx_bytes=5000, tx_bytes=300, uptime=12), at=2.0)

    assert rate(current, previous) == (2000, 100)


def test_rate_after_reboot_counts_from_zero() -> None:
    previous = Reading(NanoTraffic(rx_bytes=9000, tx_bytes=900, uptime=500), at=0.0)
    current = Reading(NanoTraffic(rx_bytes=400, tx_bytes=40, uptime=1), at=1.0)

    assert rate(current, previous) == (400, 40)


def _reader(*results: NanoTraffic | Exception):
    queue = list(results)

    async def read() -> NanoTraffic:
        result = queue.pop(0)
        if isinstance(result, Exception):
            raise result
        return result

    return read


async def _take(events, count: int) -> list[dict]:
    return [await anext(events) for _ in range(count)]


def test_events_start_after_the_second_reading() -> None:
    read = _reader(
        NanoTraffic(rx_bytes=0, tx_bytes=0, uptime=1),
        NanoTraffic(rx_bytes=1000, tx_bytes=10, uptime=2),
    )

    [event] = asyncio.run(_take(throughput_events(read, interval=0), 1))

    assert event["type"] == "rate"
    assert event["rx_bytes_per_second"] > 0


def test_unreachable_nano_becomes_error_and_keeps_reading() -> None:
    read = _reader(
        nano.NanoUnavailableError("down"),
        NanoTraffic(rx_bytes=0, tx_bytes=0, uptime=1),
        NanoTraffic(rx_bytes=1000, tx_bytes=10, uptime=2),
    )

    events = asyncio.run(_take(throughput_events(read, interval=0), 2))

    assert [event["type"] for event in events] == ["error", "rate"]


def test_missing_credentials_end_the_stream() -> None:
    async def run() -> list[dict]:
        return [event async for event in throughput_events(_reader(nano.NanoConfigError("no login")), interval=0)]

    assert asyncio.run(run()) == [{"type": "error", "detail": "no login"}]


def test_throughput_endpoint_streams_ndjson(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_events():
        yield {"type": "rate", "rx_bytes_per_second": 125_000, "tx_bytes_per_second": 1_000}

    monkeypatch.setattr(throughput, "throughput_events", fake_events)

    response = client.get("/connection/throughput")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")
    assert [json.loads(line) for line in response.text.splitlines()] == [
        {"type": "rate", "rx_bytes_per_second": 125_000, "tx_bytes_per_second": 1_000}
    ]


def test_current_throughput_is_the_first_rate(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_events():
        yield {"type": "error", "detail": "down"}
        yield {"type": "rate", "rx_bytes_per_second": 125_000, "tx_bytes_per_second": 1_000}

    monkeypatch.setattr(throughput, "throughput_events", fake_events)

    response = client.get("/connection/throughput/current")

    assert response.status_code == 200
    body = response.json()
    assert (body["rx_bytes_per_second"], body["tx_bytes_per_second"]) == (125_000, 1_000)
    assert body["measured_at"]


def test_current_throughput_without_a_rate_is_503(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_events():
        yield {"type": "error", "detail": "no login"}

    monkeypatch.setattr(throughput, "throughput_events", fake_events)

    response = client.get("/connection/throughput/current")

    assert response.status_code == 503
    assert response.json()["detail"] == "no login"


def test_current_rate_times_out(monkeypatch: pytest.MonkeyPatch) -> None:
    async def never():
        await asyncio.sleep(10)
        yield {}

    monkeypatch.setattr(throughput, "throughput_events", never)

    with pytest.raises(throughput.ThroughputUnavailableError, match="did not answer"):
        asyncio.run(throughput.current_rate(timeout=0.01))
