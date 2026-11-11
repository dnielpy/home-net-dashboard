import os
from collections.abc import Sequence
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import Row, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import nano, repository
from app.models import TrafficSample

Bucket = Literal["hour", "day"]

DEFAULT_TIMEZONE = "America/Havana"


def get_timezone() -> str:
    return os.environ.get("TZ") or DEFAULT_TIMEZONE


def counter_delta(current: int, previous: int | None, rebooted: bool) -> int:
    if previous is None:
        return 0
    if rebooted:
        # The counters start again from zero when the Nano reboots
        return current
    # A counter that goes down without a reboot is not trustworthy, so it adds nothing
    return max(0, current - previous)


def build_sample(reading: nano.NanoTraffic, previous: TrafficSample | None, date: datetime) -> TrafficSample:
    rebooted = previous is not None and reading.uptime < previous.uptime
    return TrafficSample(
        date=date,
        rx_bytes=reading.rx_bytes,
        tx_bytes=reading.tx_bytes,
        uptime=reading.uptime,
        rx_delta=counter_delta(reading.rx_bytes, previous.rx_bytes if previous else None, rebooted),
        tx_delta=counter_delta(reading.tx_bytes, previous.tx_bytes if previous else None, rebooted),
    )


async def latest_sample(session: AsyncSession) -> TrafficSample | None:
    query = select(TrafficSample).order_by(TrafficSample.date.desc(), TrafficSample.id.desc()).limit(1)
    return await session.scalar(query)


async def collect_traffic(session: AsyncSession) -> TrafficSample:
    reading = await nano.read_traffic()
    previous = await latest_sample(session)
    return await repository.save(session, build_sample(reading, previous, datetime.now(timezone.utc)))


async def list_bandwidth(session: AsyncSession, since: datetime, bucket: Bucket) -> Sequence[Row]:
    tz = get_timezone()
    start = func.timezone(tz, func.date_trunc(bucket, func.timezone(tz, TrafficSample.date))).label("start")
    query = (
        select(start, func.sum(TrafficSample.rx_delta).label("rx_bytes"), func.sum(TrafficSample.tx_delta).label("tx_bytes"))
        .where(TrafficSample.date >= since)
        .group_by(start)
        .order_by(start)
    )
    return (await session.execute(query)).all()
