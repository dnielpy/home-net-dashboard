import time
from collections.abc import Sequence
from datetime import datetime, timezone

from sqlalchemy import Row, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app import traffic, wavlink
from app.models import Device, DeviceSample

KB = 1024
# A gap longer than this many intervals (the API was down, the router didn't answer) counts as just this many
MAX_GAP_INTERVALS = 3
LIVE_CACHE_SECONDS = 3

_live_cache: tuple[float, list[wavlink.RouterDevice]] | None = None


def estimate_bytes(kbs: int, elapsed_seconds: float, interval_seconds: float) -> int:
    """The router only reports speeds, so the bytes are the speed held since the previous sample."""
    return int(kbs * KB * min(elapsed_seconds, interval_seconds * MAX_GAP_INTERVALS))


async def live_devices() -> list[wavlink.RouterDevice]:
    """The router's device list, reused for a few seconds so several open pages don't flood the router."""
    global _live_cache

    if _live_cache is not None and time.monotonic() - _live_cache[0] < LIVE_CACHE_SECONDS:
        return _live_cache[1]
    devices = await wavlink.get_client().list_devices()
    _live_cache = (time.monotonic(), devices)
    return devices


def clear_live_cache() -> None:
    global _live_cache

    _live_cache = None


async def _save_devices(session: AsyncSession, devices: Sequence[wavlink.RouterDevice], now: datetime) -> None:
    # One row per mac, or postgres refuses to upsert the same row twice in one statement
    devices = list({d.mac: d for d in devices}.values())
    online = [d for d in devices if d.online]
    if online:
        stmt = insert(Device).values(
            [{"mac": d.mac, "name": d.name, "last_ip": d.ip, "first_seen": now, "last_seen": now} for d in online]
        )
        await session.execute(
            stmt.on_conflict_do_update(
                index_elements=[Device.mac],
                set_={
                    # Keep a known name when the router sends an empty one
                    "name": func.coalesce(func.nullif(stmt.excluded.name, ""), Device.name),
                    "last_ip": func.coalesce(stmt.excluded.last_ip, Device.last_ip),
                    "last_seen": stmt.excluded.last_seen,
                },
            )
        )
    offline = [d for d in devices if not d.online]
    if offline:
        stmt = insert(Device).values(
            [{"mac": d.mac, "name": d.name, "first_seen": now, "last_seen": now} for d in offline]
        )
        await session.execute(
            stmt.on_conflict_do_update(
                index_elements=[Device.mac],
                set_={"name": func.coalesce(func.nullif(stmt.excluded.name, ""), Device.name)},
            )
        )


async def collect_devices(session: AsyncSession, interval_seconds: float) -> list[DeviceSample]:
    devices = await wavlink.get_client().list_devices()
    now = datetime.now(timezone.utc)
    previous = await session.scalar(select(func.max(DeviceSample.date)))
    elapsed = (now - previous).total_seconds() if previous else interval_seconds

    await _save_devices(session, devices, now)
    samples = [
        DeviceSample(
            date=now,
            mac=d.mac,
            down_kbs=d.down_kbs,
            up_kbs=d.up_kbs,
            down_bytes=estimate_bytes(d.down_kbs, elapsed, interval_seconds),
            up_bytes=estimate_bytes(d.up_kbs, elapsed, interval_seconds),
        )
        for d in devices
        if d.online
    ]
    session.add_all(samples)
    await session.commit()
    return samples


async def list_known_devices(session: AsyncSession) -> Sequence[Device]:
    return (await session.scalars(select(Device))).all()


async def list_usage(session: AsyncSession, since: datetime) -> dict[str, tuple[int, int]]:
    """Bytes down and up per mac since a date."""
    query = (
        select(DeviceSample.mac, func.sum(DeviceSample.down_bytes), func.sum(DeviceSample.up_bytes))
        .where(DeviceSample.date >= since)
        .group_by(DeviceSample.mac)
    )
    return {mac: (int(down), int(up)) for mac, down, up in (await session.execute(query)).all()}


async def list_device_history(
    session: AsyncSession, mac: str, since: datetime, bucket: traffic.Bucket
) -> Sequence[Row]:
    start = traffic.bucket_start(DeviceSample.date, bucket)
    query = (
        select(
            start,
            func.avg(DeviceSample.down_kbs).label("avg_down_kbs"),
            func.max(DeviceSample.down_kbs).label("max_down_kbs"),
            func.avg(DeviceSample.up_kbs).label("avg_up_kbs"),
            func.max(DeviceSample.up_kbs).label("max_up_kbs"),
            func.sum(DeviceSample.down_bytes).label("down_bytes"),
            func.sum(DeviceSample.up_bytes).label("up_bytes"),
        )
        .where(DeviceSample.mac == mac, DeviceSample.date >= since)
        .group_by(start)
        .order_by(start)
    )
    return (await session.execute(query)).all()
