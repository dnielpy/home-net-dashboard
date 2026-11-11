from collections import Counter
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ConnectionCheck
from app.segments import most_common_break


@dataclass
class Period:
    start: datetime
    end: datetime

    @property
    def duration_hours(self) -> float:
        return round((self.end - self.start).total_seconds() / 3600, 3)


@dataclass
class OutagePeriod(Period):
    break_at: str | None


@dataclass
class ConnectionStatus:
    online: bool | None
    break_at: str | None
    current_since: datetime | None
    last_online: datetime | None
    last_outage: OutagePeriod | None
    last_online_period: Period | None


async def _latest_date(session: AsyncSession, online: bool, before: datetime | None = None) -> datetime | None:
    query = select(func.max(ConnectionCheck.date)).where(ConnectionCheck.online == online)
    if before is not None:
        query = query.where(ConnectionCheck.date < before)
    return await session.scalar(query)


async def _first_date(session: AsyncSession, online: bool, after: datetime | None) -> datetime | None:
    query = select(func.min(ConnectionCheck.date)).where(ConnectionCheck.online == online)
    if after is not None:
        query = query.where(ConnectionCheck.date > after)
    return await session.scalar(query)


async def _break_between(session: AsyncSession, start: datetime, end: datetime) -> str | None:
    query = (
        select(ConnectionCheck.break_at, func.count())
        .where(ConnectionCheck.online.is_(False), ConnectionCheck.date >= start, ConnectionCheck.date < end)
        .where(ConnectionCheck.break_at.is_not(None))
        .group_by(ConnectionCheck.break_at)
    )
    rows = (await session.execute(query)).all()
    return most_common_break(Counter({break_at: count for break_at, count in rows}))


async def get_connection_status(session: AsyncSession) -> ConnectionStatus:
    latest = (
        await session.execute(
            select(ConnectionCheck.online, ConnectionCheck.break_at).order_by(ConnectionCheck.date.desc()).limit(1)
        )
    ).one_or_none()
    if latest is None:
        return ConnectionStatus(
            online=None, break_at=None, current_since=None, last_online=None, last_outage=None, last_online_period=None
        )

    online, break_at = latest
    last_online = await _latest_date(session, online=True)
    last_offline = await _latest_date(session, online=False)

    if not online:
        outage_since = await _first_date(session, online=False, after=last_online)
        last_online_period = None
        if last_online is not None and outage_since is not None:
            outage_before = await _latest_date(session, online=False, before=last_online)
            online_start = await _first_date(session, online=True, after=outage_before)
            if online_start is not None:
                last_online_period = Period(start=online_start, end=outage_since)
        return ConnectionStatus(
            online=False,
            break_at=break_at,
            current_since=outage_since,
            last_online=last_online,
            last_outage=None,
            last_online_period=last_online_period,
        )

    current_since = await _first_date(session, online=True, after=last_offline)
    last_outage = None
    if last_offline is not None and current_since is not None:
        online_before = await _latest_date(session, online=True, before=last_offline)
        start = await _first_date(session, online=False, after=online_before)
        if start is not None:
            last_outage = OutagePeriod(
                start=start, end=current_since, break_at=await _break_between(session, start, current_since)
            )

    return ConnectionStatus(
        online=True,
        break_at=None,
        current_since=current_since,
        last_online=last_online,
        last_outage=last_outage,
        last_online_period=None,
    )
