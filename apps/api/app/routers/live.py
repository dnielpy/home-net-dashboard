import json
from collections.abc import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app import speed_test

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
