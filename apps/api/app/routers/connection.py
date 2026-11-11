from fastapi import APIRouter, HTTPException

from app import pinger
from app.schemas import HopInfoOut, HopOut, LiveConnectionOut

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


@router.get(
    "/connection/hops",
    response_model=list[HopInfoOut],
    description="The hops of the chain in order, from the router to internet.",
)
def hops() -> list[HopInfoOut]:
    return [HopInfoOut(name=name, ip=ip) for name, ip in pinger.get_hop_ips()]


@router.get(
    "/connection/live/{hop}",
    response_model=HopOut,
    description="Ping a single hop once a second for about 3 seconds. `latency_ms` is the average round trip.",
)
async def live_hop(hop: str) -> HopOut:
    try:
        result = await pinger.ping_hop(hop)
    except pinger.UnknownHopError as err:
        raise HTTPException(status_code=404, detail=str(err))
    except OSError as err:
        raise HTTPException(status_code=503, detail=f"Could not send pings: {err}")
    return HopOut(name=result.name, ip=result.ip, ok=result.ok, latency_ms=result.latency_ms)
