from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app import devices, traffic, wavlink
from app.db import get_session
from app.schemas import (
    DeviceBlockIn,
    DeviceHistoryOut,
    DeviceHistoryPoint,
    DeviceLimitIn,
    DeviceNameIn,
    DeviceOut,
)

router = APIRouter(tags=["devices"])

MAC_PATTERN = r"^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$"
MacPath = Path(pattern=MAC_PATTERN, description="The device's MAC address, like 9E:40:68:FE:7F:B1.")


def _router_error(err: Exception) -> HTTPException:
    if isinstance(err, wavlink.WavlinkConfigError):
        return HTTPException(status_code=500, detail=str(err))
    return HTTPException(status_code=503, detail=f"Router unavailable: {err}")


async def _live_devices() -> list[wavlink.RouterDevice]:
    try:
        return await devices.live_devices()
    except (wavlink.WavlinkUnavailableError, wavlink.WavlinkConfigError) as err:
        raise _router_error(err) from err


def _sort_key(device: DeviceOut) -> tuple:
    return (
        not device.online,
        -(device.down_kbs + device.up_kbs),
        not device.in_router,
        device.name == "",
        device.name.lower(),
        device.mac,
    )


async def _device_list(session: AsyncSession) -> list[DeviceOut]:
    live = await _live_devices()
    known = {device.mac: device for device in await devices.list_known_devices(session)}
    usage = await devices.list_usage(session, datetime.now(timezone.utc) - timedelta(hours=24))

    result = []
    for d in live:
        stored = known.get(d.mac)
        down, up = usage.get(d.mac, (0, 0))
        result.append(
            DeviceOut(
                mac=d.mac,
                name=d.name or (stored.name if stored else ""),
                ip=d.ip or (stored.last_ip if stored else None),
                in_router=True,
                online=d.online,
                blocked=d.blocked,
                down_kbs=d.down_kbs,
                up_kbs=d.up_kbs,
                connected_since=d.connected_since,
                last_seen=stored.last_seen if stored else None,
                limit_down_kbs=d.limit_down_kbs,
                limit_up_kbs=d.limit_up_kbs,
                usage_24h_down_bytes=down,
                usage_24h_up_bytes=up,
            )
        )
    live_macs = {d.mac for d in live}
    for mac, stored in known.items():
        if mac in live_macs:
            continue
        down, up = usage.get(mac, (0, 0))
        result.append(
            DeviceOut(
                mac=mac,
                name=stored.name,
                ip=stored.last_ip,
                in_router=False,
                online=False,
                blocked=False,
                down_kbs=0,
                up_kbs=0,
                connected_since=None,
                last_seen=stored.last_seen,
                limit_down_kbs=0,
                limit_up_kbs=0,
                usage_24h_down_bytes=down,
                usage_24h_up_bytes=up,
            )
        )
    return sorted(result, key=_sort_key)


@router.get(
    "/devices",
    response_model=list[DeviceOut],
    description=(
        "Devices the router lists, live (speeds in KB/s, as the router reports them; limits of 0 mean unlimited), "
        "plus the bytes each used in the last 24 hours (estimated from its speed every few seconds) and the devices "
        "the router no longer lists but the history knows (`in_router: false`). Online devices first, fastest first."
    ),
)
async def list_devices(session: AsyncSession = Depends(get_session)) -> list[DeviceOut]:
    return await _device_list(session)


@router.get(
    "/devices/{mac}/history",
    response_model=DeviceHistoryOut,
    description="Average and peak speed (KB/s) and estimated bytes of one device per 10 minutes, hour or day.",
)
async def device_history(
    mac: str = MacPath,
    hours: float = Query(24, gt=0, le=720, description="How many hours back to include."),
    bucket: traffic.Bucket = Query("hour", description="Group per 10 minutes, per hour or per day."),
    session: AsyncSession = Depends(get_session),
) -> DeviceHistoryOut:
    rows = await devices.list_device_history(
        session, mac.upper(), datetime.now(timezone.utc) - timedelta(hours=hours), bucket
    )
    items = [
        DeviceHistoryPoint(
            start=row.start,
            avg_down_kbs=round(float(row.avg_down_kbs), 1),
            max_down_kbs=row.max_down_kbs,
            avg_up_kbs=round(float(row.avg_up_kbs), 1),
            max_up_kbs=row.max_up_kbs,
            down_bytes=row.down_bytes,
            up_bytes=row.up_bytes,
        )
        for row in rows
    ]
    return DeviceHistoryOut(
        mac=mac.upper(),
        total_down_bytes=sum(item.down_bytes for item in items),
        total_up_bytes=sum(item.up_bytes for item in items),
        items=items,
    )


async def _act(mac: str, session: AsyncSession, action) -> DeviceOut:
    mac = mac.upper()
    if mac not in {d.mac for d in await _live_devices()}:
        raise HTTPException(status_code=404, detail=f"The router does not list {mac}")
    try:
        await action(wavlink.get_client(), mac)
    except (wavlink.WavlinkUnavailableError, wavlink.WavlinkConfigError) as err:
        raise _router_error(err) from err
    finally:
        devices.clear_live_cache()
    return next(d for d in await _device_list(session) if d.mac == mac)


@router.post(
    "/devices/{mac}/block",
    response_model=DeviceOut,
    description="Cut (`blocked: true`) or give back (`false`) internet to a device. Returns it as the router lists it now.",
)
async def block_device(
    body: DeviceBlockIn, mac: str = MacPath, session: AsyncSession = Depends(get_session)
) -> DeviceOut:
    return await _act(mac, session, lambda client, m: client.set_blocked(m, body.blocked))


@router.post(
    "/devices/{mac}/limit",
    response_model=DeviceOut,
    description="Limit a device's download and upload speed in KB/s; 0 removes that limit.",
)
async def limit_device(
    body: DeviceLimitIn, mac: str = MacPath, session: AsyncSession = Depends(get_session)
) -> DeviceOut:
    return await _act(mac, session, lambda client, m: client.set_limit(m, body.down_kbs, body.up_kbs))


@router.post(
    "/devices/{mac}/name",
    response_model=DeviceOut,
    description="Rename a device in the router.",
)
async def rename_device(
    body: DeviceNameIn, mac: str = MacPath, session: AsyncSession = Depends(get_session)
) -> DeviceOut:
    return await _act(mac, session, lambda client, m: client.set_name(m, body.name.strip()))
