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
WINDOW = timedelta(days=7)
# (starts ago, ends ago, hop where the chain is cut)
OUTAGES = [
    (timedelta(days=6, hours=3), timedelta(days=6, hours=1), "provider"),
    (timedelta(days=4, hours=20), timedelta(days=4, hours=19, minutes=50), "router"),
    (timedelta(days=3, hours=8), timedelta(days=3, hours=6, minutes=30), "nano"),
    (timedelta(days=1, hours=14), timedelta(days=1, hours=13, minutes=15), "internet"),
    (timedelta(hours=5), timedelta(hours=4, minutes=40), "provider"),
]
BASE_LATENCY_MS = {"router": 1.2, "nano": 2.0, "provider": 6.0, "internet": 38.0}
BATCH_SIZE = 2000


def _break_at(ago: timedelta) -> str | None:
    return next((hop for start, end, hop in OUTAGES if end < ago <= start), None)


def _check_row(moment: datetime, break_at: str | None, rng: random.Random) -> dict:
    cut = HOP_NAMES.index(break_at) if break_at else len(HOP_NAMES)
    row: dict = {"date": moment, "online": break_at is None, "break_at": break_at}
    for index, name in enumerate(HOP_NAMES):
        ok = index < cut
        row[f"{name}_ok"] = ok
        row[f"{name}_ms"] = round(BASE_LATENCY_MS[name] * rng.uniform(0.8, 1.6), 2) if ok else None
    return row


def _mbps(moment: datetime, rng: random.Random) -> float:
    hour = moment.hour + moment.minute / 60
    daily = 3 + 2.5 * math.sin((hour - 15) / 24 * 2 * math.pi)
    return max(0.05, daily + rng.gauss(0, 0.8))


def build_rows(now: datetime, seed: int = 42) -> tuple[list[dict], list[dict]]:
    rng = random.Random(seed)
    checks: list[dict] = []
    samples: list[dict] = []
    rx = tx = 0
    moment = now - WINDOW
    while moment <= now:
        break_at = _break_at(now - moment)
        checks.append(_check_row(moment, break_at, rng))

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
                    "uptime": int((moment - (now - WINDOW)).total_seconds()),
                    "rx_delta": rx_delta if samples else 0,
                    "tx_delta": tx_delta if samples else 0,
                }
            )
        moment += STEP
    return checks, samples


async def seed(replace: bool) -> None:
    now = datetime.now(timezone.utc)
    since = now - WINDOW

    async with db.session_scope() as session:
        existing = await session.scalar(
            select(func.count()).select_from(ConnectionCheck).where(ConnectionCheck.date >= since)
        )
        if existing and not replace:
            raise SystemExit(
                f"There are {existing} checks in the last 7 days. Run with --replace to delete them and seed."
            )
        if existing:
            await session.execute(delete(ConnectionCheck).where(ConnectionCheck.date >= since))
            await session.execute(delete(TrafficSample).where(TrafficSample.date >= since))

        checks, samples = build_rows(now)
        for model, rows in ((ConnectionCheck, checks), (TrafficSample, samples)):
            for start in range(0, len(rows), BATCH_SIZE):
                await session.execute(insert(model), rows[start : start + BATCH_SIZE])
        await session.commit()

    await db.dispose_engine()
    print(
        f"Deleted {existing or 0} checks and inserted {len(checks)} simulated checks and {len(samples)} traffic "
        f"samples from {since:%Y-%m-%d %H:%M} UTC."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed 7 days of simulated connection checks and traffic samples.")
    parser.add_argument("--replace", action="store_true", help="Delete existing data in the last 7 days first.")
    args = parser.parse_args()
    load_dotenv()
    asyncio.run(seed(args.replace))


if __name__ == "__main__":
    main()
