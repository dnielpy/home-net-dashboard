from fastapi import APIRouter, HTTPException

from app import pinger
from app.schemas import HopOut, LiveConnectionOut

router = APIRouter(tags=["connection"])


@router.get(
    "/connection/live",
    response_model=LiveConnectionOut,
    description=(
        "Ping the router, the Nano, the provider and internet right now. `break_at` is the first hop that does not "
        "answer, which is where the connection is cut."
    ),
)
async def live() -> LiveConnectionOut:
    try:
        chain = await pinger.ping_hops()
    except OSError as err:
        raise HTTPException(status_code=503, detail=f"Could not send pings: {err}")
    return LiveConnectionOut(
        checked_at=chain.checked_at,
        online=chain.online,
        break_at=chain.break_at,
        hops=[HopOut(name=hop.name, ip=hop.ip, ok=hop.ok, latency_ms=hop.latency_ms) for hop in chain.hops],
    )
