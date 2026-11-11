import argparse
import asyncio
import math
import random
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from sqlalchemy import delete, func, insert, select

from app import db
from app.models import ConnectionCheck, TrafficSample
from app.pinger import HOP_NAMES

STEP = timedelta(seconds=30)
DEFAULT_DAYS = 30
BASE_LATENCY_MS = {"router": 1.2, "nano": 2.0, "provider": 6.0, "internet": 38.0}
# Where simulated outages cut the chain, and how often
OUTAGE_HOPS = ["provider"] * 5 + ["internet"] * 2 + ["nano"] * 2 + ["router"]
OUTAGES_PER_DAY = 1
BATCH_SIZE = 2000

Outage = tuple[datetime, datetime, str]


def build_outages(start: datetime, end: datetime, rng: random.Random) -> list[Outage]:
    count = max(1, round((end - start) / timedelta(days=1) * OUTAGES_PER_DAY))
    outages = []
    for _ in range(count):
        begins = start + (end - start) * rng.random()
        lasts = timedelta(minutes=rng.choice([5, 10, 20, 45, 90, 180]) * rng.uniform(0.7, 1.3))
        outages.append((begins, begins + lasts, rng.choice(OUTAGE_HOPS)))
    return sorted(outages)


def _break_at(moment: datetime, outages: list[Outage]) -> str | None:
    return next((hop for begins, ends, hop in outages if begins <= moment < ends), None)


def _check_row(moment: datetime, break_at: str | None, rng: random.Random) -> dict:
    cut = HOP_NAMES.index(break_at) if break_at else len(HOP_NAMES)
    row: dict = {"date": moment, "online": break_at is None, "break_at": break_at}
    for index, name in enumerate(HOP_NAMES):
        ok = index < cut
        row[f"{name}_ok"] = ok
        row[f"{name}_ms"] = round(BASE_LATENCY_MS[name] * rng.uniform(0.8, 1.6), 2) if ok else None
    return row


def _mbps(moment: datetime, rng: random.Random) -> float:
    """Busier in the evening and on weekends, quiet late at night."""
    hour = (moment.hour - 5) % 24 + moment.minute / 60  # local time in Havana
    daily = 1 + 0.8 * math.sin((hour - 15) / 24 * 2 * math.pi)
    weekend = 1.3 if moment.weekday() >= 5 else 1.0
    return max(0.02, daily * weekend + rng.gauss(0, 0.3))


def build_rows(start: datetime, end: datetime, seed: int = 42) -> tuple[list[dict], list[dict]]:
    """Simulated checks and traffic samples every 30 seconds in [start, end)."""
    rng = random.Random(seed)
    outages = build_outages(start, end, rng)
    checks: list[dict] = []
    samples: list[dict] = []
    rx = tx = 0
    moment = start
    while moment < end:
        break_at = _break_at(moment, outages)
        checks.append(_check_row(moment, break_at, rng))

        # The Nano cannot be read while the chain is cut before or at it
        if break_at not in ("router", "nano"):
            online = break_at is None
            rx_delta = round(_mbps(moment, rng) * 1_000_000 / 8 * STEP.total_seconds()) if online else rng.randint(0, 4000)
            tx_delta = round(rx_delta * rng.uniform(0.12, 0.25))
            rx, tx = rx + rx_delta, tx + tx_delta
            samples.append(
                {
                    "date": moment,
                    "rx_bytes": rx,
                    "tx_bytes": tx,
                    "uptime": int((moment - start).total_seconds()),
                    "rx_delta": rx_delta if samples else 0,
                    "tx_delta": tx_delta if samples else 0,
                }
            )
        moment += STEP
    return checks, samples


async def seed(days: int, replace: bool) -> None:
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)

    async with db.session_scope() as session:
        if replace:
            await session.execute(delete(ConnectionCheck).where(ConnectionCheck.date >= start))
            await session.execute(delete(TrafficSample).where(TrafficSample.date >= start))
            end = now
        else:
            # Fill only the time before the data already stored, so the latest traffic sample stays the real one
            # and the next reading of the Nano is not compared with a simulated counter
            earliest = [
                await session.scalar(select(func.min(ConnectionCheck.date))),
                await session.scalar(select(func.min(TrafficSample.date))),
            ]
            end = min([date for date in earliest if date is not None], default=now)

        checks, samples = build_rows(start, end) if end > start else ([], [])
        for model, rows in ((ConnectionCheck, checks), (TrafficSample, samples)):
            for offset in range(0, len(rows), BATCH_SIZE):
                await session.execute(insert(model), rows[offset : offset + BATCH_SIZE])
        await session.commit()

    await db.dispose_engine()
    print(
        f"Inserted {len(checks)} simulated checks and {len(samples)} traffic samples "
        f"from {start:%Y-%m-%d %H:%M} to {end:%Y-%m-%d %H:%M} UTC."
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed simulated connection checks and traffic samples before the data already stored."
    )
    parser.add_argument("--days", type=int, default=DEFAULT_DAYS, help=f"How many days back (default {DEFAULT_DAYS}).")
    parser.add_argument(
        "--replace", action="store_true", help="Delete all data in those days first and seed up to now."
    )
    args = parser.parse_args()
    load_dotenv()
    asyncio.run(seed(args.days, args.replace))


if __name__ == "__main__":
    main()
