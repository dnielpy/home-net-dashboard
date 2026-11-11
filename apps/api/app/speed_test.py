import asyncio
import json
import logging
import os
import shutil
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import db, repository
from app.models import SpeedTestResult

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 90
PROGRESS_SCRIPT = Path(__file__).with_name("fast_progress.mjs")
# Fields of the CLI result that are passed on; the client IP stays on the server
RESULT_FIELDS = {
    "downloadMbps": "download_mbps",
    "pingMs": "ping_ms",
    "durationMs": "duration_ms",
    "serverLocation": "server_location",
    "clientLocation": "client_location",
}


class SpeedTestError(Exception):
    pass


def find_speed_test_module() -> Path:
    """fast-test-cli's speed test module, found next to the `fast` command (or FAST_CLI, the path to its cli.js)."""
    cli = os.environ.get("FAST_CLI") or shutil.which("fast")
    if not cli:
        raise SpeedTestError("The fast command (npm install --global fast-test-cli) is not installed")
    module = Path(cli).resolve().with_name("speed-test.js")
    if not module.is_file():
        raise SpeedTestError(f"Could not find fast-test-cli's speed-test.js next to {cli}")
    return module


def parse_event(line: str) -> dict[str, Any]:
    try:
        data = json.loads(line)
        if data["type"] == "progress":
            return {
                "type": "progress",
                "phase": data["phase"],
                "mbps": round(float(data["mbps"]), 1),
                "elapsed_ms": int(data["elapsedMs"]),
            }
        if data["type"] == "result":
            float(data["downloadMbps"])
            return {"type": "result", **{ours: data.get(theirs) for theirs, ours in RESULT_FIELDS.items()}}
    except (ValueError, KeyError, TypeError) as err:
        raise SpeedTestError(f"Unexpected output from fast: {line[:200]!r}") from err
    raise SpeedTestError(f"Unexpected output from fast: {line[:200]!r}")


async def _run_events() -> AsyncIterator[dict[str, Any]]:
    module = find_speed_test_module()
    try:
        process = await asyncio.create_subprocess_exec(
            "node", str(PROGRESS_SCRIPT), str(module), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
    except OSError as err:
        raise SpeedTestError(f"Could not start node: {err}") from err

    assert process.stdout is not None and process.stderr is not None
    try:
        async with asyncio.timeout(TIMEOUT_SECONDS):
            async for line in process.stdout:
                if line.strip():
                    yield parse_event(line.decode())
            await process.wait()
    except TimeoutError as err:
        raise SpeedTestError(f"fast did not finish in {TIMEOUT_SECONDS} seconds") from err
    finally:
        if process.returncode is None:
            process.kill()
            await process.wait()

    if process.returncode != 0:
        stderr = (await process.stderr.read()).decode(errors="replace").strip()
        raise SpeedTestError(f"fast failed: {stderr or process.returncode}")


async def save_result(event: dict[str, Any]) -> None:
    """Stores a finished test, so the dashboard can show the latest one without measuring again."""
    try:
        async with db.session_scope() as session:
            await repository.save(
                session,
                SpeedTestResult(
                    date=datetime.now(timezone.utc),
                    download_mbps=event["download_mbps"],
                    ping_ms=event["ping_ms"],
                    duration_ms=event["duration_ms"],
                    server_location=event["server_location"],
                    client_location=event["client_location"],
                ),
            )
    except Exception:
        logger.exception("Could not store the speed test result")


async def latest_result(session: AsyncSession) -> SpeedTestResult | None:
    query = select(SpeedTestResult).order_by(SpeedTestResult.date.desc(), SpeedTestResult.id.desc()).limit(1)
    return await session.scalar(query)


class SpeedTestRun:
    """One speed test whose events every listener receives, including the ones sent before it started listening."""

    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []
        self.done = False
        self._changed = asyncio.Condition()
        self._task = asyncio.create_task(self._collect())

    async def _collect(self) -> None:
        try:
            async for event in _run_events():
                if event["type"] == "result":
                    await save_result(event)
                await self._publish(event)
        except SpeedTestError as err:
            await self._publish({"type": "error", "detail": str(err)})
        finally:
            async with self._changed:
                self.done = True
                self._changed.notify_all()

    async def _publish(self, event: dict[str, Any]) -> None:
        async with self._changed:
            self.events.append(event)
            self._changed.notify_all()

    async def listen(self) -> AsyncIterator[dict[str, Any]]:
        sent = 0
        while True:
            async with self._changed:
                await self._changed.wait_for(lambda: len(self.events) > sent or self.done)
                pending = self.events[sent:]
                finished = self.done and len(self.events) == sent + len(pending)
            for event in pending:
                yield event
            sent += len(pending)
            if finished:
                return


_current: SpeedTestRun | None = None


def speed_test_events() -> AsyncIterator[dict[str, Any]]:
    """Events of the running speed test, or of a new one. Parallel tests would split the bandwidth, so a request
    made while a test runs follows that same test."""
    global _current

    if _current is None or _current.done:
        _current = SpeedTestRun()
    return _current.listen()
