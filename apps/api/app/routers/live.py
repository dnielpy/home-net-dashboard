import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app import speed_test, throughput
from app.db import get_session
from app.schemas import SpeedTestOut, ThroughputNowOut

router = APIRouter(tags=["live"])


async def _ndjson(events: AsyncIterator[dict]) -> AsyncIterator[str]:
    async for event in events:
        yield json.dumps(event) + "\n"


@router.post(
    "/speed-test",
    description=(
        "Measure download speed with fast.com. Streams newline-delimited JSON while it measures: "
        '`{"type": "progress", "phase", "mbps", "elapsed_ms"}` about every 250 ms, then `{"type": "result", '
        '"download_mbps", "ping_ms", "duration_ms", "server_location", "client_location"}` or '
        '`{"type": "error", "detail"}`. A request made while a test is running follows that same test.'
    ),
)
async def run_speed_test() -> StreamingResponse:
    return StreamingResponse(_ndjson(speed_test.speed_test_events()), media_type="application/x-ndjson")


@router.get(
    "/connection/throughput",
    description=(
        "The Nano's live speed, read from its counters every second. Streams newline-delimited JSON until the client "
        'leaves: `{"type": "rate", "rx_bytes_per_second", "tx_bytes_per_second"}` (rx is download), or '
        '`{"type": "error", "detail"}` when the Nano cannot be read.'
    ),
)
async def live_throughput() -> StreamingResponse:
    return StreamingResponse(
        _ndjson(throughput.throughput_events()),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store"},
    )


@router.get(
    "/connection/throughput/current",
    response_model=ThroughputNowOut,
    description=(
        "The Nano's speed right now, as the first rate of a live reading (about a second). 503 when the Nano cannot "
        "be read within 5 seconds."
    ),
)
async def current_throughput() -> ThroughputNowOut:
    try:
        rx, tx = await throughput.current_rate()
    except throughput.ThroughputUnavailableError as err:
        raise HTTPException(status_code=503, detail=str(err)) from err
    return ThroughputNowOut(
        measured_at=datetime.now(UTC),
        rx_bytes_per_second=round(rx),
        tx_bytes_per_second=round(tx),
    )


@router.get(
    "/speed-test/latest",
    response_model=SpeedTestOut | None,
    description="The latest finished speed test (run every 10 minutes and on demand), or null before the first one.",
)
async def latest_speed_test(session: AsyncSession = Depends(get_session)) -> SpeedTestOut | None:
    result = await speed_test.latest_result(session)
    if result is None:
        return None
    return SpeedTestOut(
        measured_at=result.date,
        download_mbps=result.download_mbps,
        ping_ms=result.ping_ms,
        duration_ms=result.duration_ms,
        server_location=result.server_location,
        client_location=result.client_location,
    )
