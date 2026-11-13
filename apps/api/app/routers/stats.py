from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app import checks, connection_status, traffic
from app.db import get_session
from app.outages import find_outages
from app.schemas import (
    BandwidthOut,
    BandwidthPoint,
    ConnectionStatusOut,
    OutageOut,
    OutagePeriodOut,
    PeriodOut,
    SegmentOut,
)
from app.segments import connection_totals, find_segments

router = APIRouter(tags=["stats"])


# The window the hours online and offline cover
TOTALS_HOURS = 24


def _since(hours: float) -> datetime:
    return datetime.now(timezone.utc) - timedelta(hours=hours)


@router.get(
    "/connection-status",
    response_model=ConnectionStatusOut,
    description=(
        "Whether internet answers according to the latest check, where the chain is cut if not, since when it is in "
        "that state, the last check with internet, the last finished outage (while online) and the last period "
        "online (during an outage), plus the hours online and offline in the last 24 hours, counted from the first "
        "check in them (`totals_since`) and leaving out gaps without checks."
    ),
)
async def get_connection_status(session: AsyncSession = Depends(get_session)) -> ConnectionStatusOut:
    status = await connection_status.get_connection_status(session)
    last_outage = status.last_outage
    last_online_period = status.last_online_period
    rows = await checks.list_states(session, _since(TOTALS_HOURS))
    totals = connection_totals(find_segments((row.date, row.online, row.break_at) for row in rows))
    return ConnectionStatusOut(
        online=status.online,
        break_at=status.break_at,
        current_since=status.current_since,
        last_online=status.last_online,
        last_outage=(
            OutagePeriodOut(
                start=last_outage.start,
                end=last_outage.end,
                duration_hours=last_outage.duration_hours,
                break_at=last_outage.break_at,
            )
            if last_outage
            else None
        ),
        last_online_period=(
            PeriodOut(
                start=last_online_period.start,
                end=last_online_period.end,
                duration_hours=last_online_period.duration_hours,
            )
            if last_online_period
            else None
        ),
        totals_since=totals.since,
        online_hours=totals.online_hours,
        offline_hours=totals.offline_hours,
    )


@router.get(
    "/connection-history",
    response_model=list[SegmentOut],
    description=(
        "Periods online (`online: true`), offline (`false`) and without checks (`null`, a gap of more than 5 minutes) "
        "in the last `hours`, oldest first."
    ),
)
async def connection_history(
    hours: float = Query(24, gt=0, le=720, description="How many hours back to include."),
    session: AsyncSession = Depends(get_session),
) -> list[SegmentOut]:
    rows = await checks.list_states(session, _since(hours))
    return [
        SegmentOut(start=segment.start, end=segment.end, online=segment.online, break_at=segment.break_at)
        for segment in find_segments((row.date, row.online, row.break_at) for row in rows)
    ]


@router.get(
    "/outages",
    response_model=list[OutageOut],
    description=(
        "Outages in the last `hours`, oldest first. An outage is a run of checks where internet does not answer. "
        "`break_at` is the hop that failed most often during it."
    ),
)
async def list_outages(
    hours: float = Query(24, gt=0, le=168, description="How many hours back to include."),
    session: AsyncSession = Depends(get_session),
) -> list[OutageOut]:
    rows = await checks.list_states(session, _since(hours))
    return [
        OutageOut(
            start=outage.start,
            end=outage.end,
            duration_hours=outage.duration_hours,
            ongoing=outage.ongoing,
            break_at=outage.break_at,
        )
        for outage in find_outages((row.date, row.online, row.break_at) for row in rows)
    ]


@router.get(
    "/bandwidth",
    response_model=BandwidthOut,
    description=(
        "Bytes downloaded (rx) and uploaded (tx) through the Nano in the last `hours`, per 10 minutes, hour or day."
    ),
)
async def bandwidth(
    hours: float = Query(24, gt=0, le=720, description="How many hours back to include."),
    bucket: traffic.Bucket = Query("hour", description="Group the traffic per 10 minutes, per hour or per day."),
    session: AsyncSession = Depends(get_session),
) -> BandwidthOut:
    rows = await traffic.list_bandwidth(session, _since(hours), bucket)
    items = [BandwidthPoint(start=row.start, rx_bytes=row.rx_bytes, tx_bytes=row.tx_bytes) for row in rows]
    return BandwidthOut(
        total_rx_bytes=sum(item.rx_bytes for item in items),
        total_tx_bytes=sum(item.tx_bytes for item in items),
        items=items,
    )
