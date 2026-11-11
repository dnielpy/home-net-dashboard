import asyncio
import json
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import speed_test
from app.main import app
from app.speed_test import SpeedTestError, SpeedTestRun, find_speed_test_module, parse_event

client = TestClient(app)

RESULT_LINE = json.dumps(
    {
        "type": "result",
        "downloadMbps": 5.2,
        "uploadMbps": None,
        "pingMs": 454.1,
        "durationMs": 21526,
        "server": "https://example.nflxvideo.net/speedtest",
        "serverLocation": "Miami, US",
        "clientIp": "203.0.113.7",
        "clientLocation": "San Juan, PR",
    }
)


def test_parse_progress() -> None:
    event = parse_event('{"type": "progress", "phase": "download", "mbps": 4.8271, "elapsedMs": 1250.6}')

    assert event == {"type": "progress", "phase": "download", "mbps": 4.8, "elapsed_ms": 1250}


def test_parse_result_drops_the_client_ip() -> None:
    event = parse_event(RESULT_LINE)

    assert event == {
        "type": "result",
        "download_mbps": 5.2,
        "ping_ms": 454.1,
        "duration_ms": 21526,
        "server_location": "Miami, US",
        "client_location": "San Juan, PR",
    }


@pytest.mark.parametrize("line", ["Conectando con fast.com...", '{"type": "result"}', '{"type": "other"}'])
def test_parse_rejects_unexpected_output(line: str) -> None:
    with pytest.raises(SpeedTestError):
        parse_event(line)


def test_finds_speed_test_module_next_to_the_cli(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    (tmp_path / "cli.js").write_text("")
    (tmp_path / "speed-test.js").write_text("")
    monkeypatch.setenv("FAST_CLI", str(tmp_path / "cli.js"))

    assert find_speed_test_module() == (tmp_path / "speed-test.js").resolve()


def test_missing_cli(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("FAST_CLI", str(tmp_path / "cli.js"))

    with pytest.raises(SpeedTestError):
        find_speed_test_module()


def _fake_events(events: list[dict[str, Any]], fail: str | None = None, delay: float = 0.01):
    async def fake_run_events() -> AsyncIterator[dict[str, Any]]:
        for event in events:
            await asyncio.sleep(delay)
            yield event
        if fail:
            raise SpeedTestError(fail)

    return fake_run_events


PROGRESS = [{"type": "progress", "phase": "download", "mbps": mbps, "elapsed_ms": ms} for mbps, ms in [(1.0, 250), (3.5, 500)]]
RESULT = {"type": "result", "download_mbps": 5.2}


def test_late_listener_gets_every_event(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(speed_test, "_run_events", _fake_events([*PROGRESS, RESULT]))

    async def scenario() -> tuple[list, list]:
        run = SpeedTestRun()

        async def collect(after: float) -> list:
            await asyncio.sleep(after)
            return [event async for event in run.listen()]

        return await asyncio.gather(collect(0), collect(0.025))

    first, late = asyncio.run(scenario())

    assert first == late == [*PROGRESS, RESULT]


def test_failure_becomes_error_event(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(speed_test, "_run_events", _fake_events(PROGRESS[:1], fail="fast failed: offline"))

    async def scenario() -> list:
        return [event async for event in SpeedTestRun().listen()]

    events = asyncio.run(scenario())

    assert events[-1] == {"type": "error", "detail": "fast failed: offline"}


def test_requests_during_a_test_follow_the_same_test(monkeypatch: pytest.MonkeyPatch) -> None:
    starts = 0

    def counting_events():
        nonlocal starts
        starts += 1
        return _fake_events([RESULT])()

    monkeypatch.setattr(speed_test, "_run_events", counting_events)
    monkeypatch.setattr(speed_test, "_current", None)

    async def scenario() -> None:
        listeners = [speed_test.speed_test_events(), speed_test.speed_test_events()]
        await asyncio.gather(*[asyncio.create_task(_drain(listener)) for listener in listeners])

    async def _drain(listener) -> None:
        async for _ in listener:
            pass

    asyncio.run(scenario())

    assert starts == 1


def test_speed_test_endpoint_streams_ndjson(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_events() -> AsyncIterator[dict[str, Any]]:
        for event in [*PROGRESS, RESULT]:
            yield event

    monkeypatch.setattr(speed_test, "speed_test_events", fake_events)

    response = client.post("/speed-test")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")
    assert [json.loads(line) for line in response.text.splitlines()] == [*PROGRESS, RESULT]
