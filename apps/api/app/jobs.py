import asyncio
import logging
import os
import time

from app import checks, db, nano, speed_test, traffic

logger = logging.getLogger(__name__)

DEFAULT_INTERVAL_SECONDS = 30
DEFAULT_SPEED_TEST_INTERVAL_SECONDS = 600


def get_interval_seconds() -> int:
    return int(os.environ.get("CHECK_JOB_INTERVAL_SECONDS", DEFAULT_INTERVAL_SECONDS))


def get_speed_test_interval_seconds() -> int:
    return int(os.environ.get("SPEED_TEST_INTERVAL_SECONDS", DEFAULT_SPEED_TEST_INTERVAL_SECONDS))


def _raise_if_cancelling() -> None:
    task = asyncio.current_task()
    if task is not None and task.cancelling():
        raise asyncio.CancelledError


async def check_once() -> None:
    try:
        async with db.session_scope() as session:
            check = await checks.collect_check(session)
    except Exception:
        _raise_if_cancelling()
        logger.exception("Connection check failed")
        return

    latencies = " ".join(
        f"{name}={ms}ms" if ok else f"{name}=down"
        for name, ok, ms in [
            ("router", check.router_ok, check.router_ms),
            ("nano", check.nano_ok, check.nano_ms),
            ("provider", check.provider_ok, check.provider_ms),
            ("internet", check.internet_ok, check.internet_ms),
        ]
    )
    logger.info("Connection check saved id=%s %s", check.id, latencies)


async def sample_traffic_once() -> None:
    try:
        async with db.session_scope() as session:
            sample = await traffic.collect_traffic(session)
    except Exception as err:
        _raise_if_cancelling()
        if isinstance(err, (nano.NanoUnavailableError, nano.NanoConfigError)):
            logger.warning("Traffic sample skipped: %s", err)
        else:
            logger.exception("Traffic sample failed")
        return

    logger.info("Traffic sample saved id=%s rx_delta=%sB tx_delta=%sB", sample.id, sample.rx_delta, sample.tx_delta)


async def run_check_job(interval_seconds: int) -> None:
    logger.info("Check job started, every %s seconds", interval_seconds)
    while True:
        started = time.monotonic()
        await asyncio.gather(check_once(), sample_traffic_once())
        elapsed = time.monotonic() - started
        await asyncio.sleep(max(0.0, interval_seconds - elapsed))


async def speed_test_once() -> None:
    """Runs a speed test (or follows the one already running); the result is stored as it finishes."""
    try:
        async for event in speed_test.speed_test_events():
            if event["type"] == "result":
                logger.info("Speed test saved download=%sMbps ping=%sms", event["download_mbps"], event["ping_ms"])
            elif event["type"] == "error":
                logger.warning("Speed test failed: %s", event["detail"])
    except Exception:
        _raise_if_cancelling()
        logger.exception("Speed test job failed")


async def run_speed_test_job(interval_seconds: int) -> None:
    logger.info("Speed test job started, every %s seconds", interval_seconds)
    while True:
        started = time.monotonic()
        await speed_test_once()
        elapsed = time.monotonic() - started
        await asyncio.sleep(max(0.0, interval_seconds - elapsed))
