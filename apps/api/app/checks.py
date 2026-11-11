from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import Row, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import pinger, repository
from app.models import ConnectionCheck


def build_check(chain: pinger.ChainCheck) -> ConnectionCheck:
    hops = {hop.name: hop for hop in chain.hops}
    return ConnectionCheck(
        date=chain.checked_at,
        router_ok=hops["router"].ok,
        nano_ok=hops["nano"].ok,
        provider_ok=hops["provider"].ok,
        internet_ok=hops["internet"].ok,
        router_ms=hops["router"].latency_ms,
        nano_ms=hops["nano"].latency_ms,
        provider_ms=hops["provider"].latency_ms,
        internet_ms=hops["internet"].latency_ms,
        online=chain.online,
        break_at=chain.break_at,
    )


async def collect_check(session: AsyncSession) -> ConnectionCheck:
    chain = await pinger.ping_hops()
    return await repository.save(session, build_check(chain))


async def list_states(session: AsyncSession, since: datetime) -> Sequence[Row]:
    query = (
        select(ConnectionCheck.date, ConnectionCheck.online, ConnectionCheck.break_at)
        .where(ConnectionCheck.date >= since)
        .order_by(ConnectionCheck.date.asc(), ConnectionCheck.id.asc())
    )
    return (await session.execute(query)).all()
