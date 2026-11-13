import asyncio
import time
from collections import deque
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from app import nano
from app.traffic import counter_delta

SAMPLE_INTERVAL_SECONDS = 1.0
# The rate is measured over the last few readings, so a counter that updates late does not show as 0 and then double
WINDOW_READINGS = 3


@dataclass
class Reading:
    traffic: nano.NanoTraffic
    at: float


def rate(current: Reading, previous: Reading) -> tuple[float, float]:
    """Bytes per second downloaded (rx) and uploaded (tx) between two readings of the Nano."""
    seconds = current.at - previous.at
    if seconds <= 0:
        return 0.0, 0.0
    rebooted = current.traffic.uptime < previous.traffic.uptime
    rx = counter_delta(current.traffic.rx_bytes, previous.traffic.rx_bytes, rebooted)
    tx = counter_delta(current.traffic.tx_bytes, previous.traffic.tx_bytes, rebooted)
    return rx / seconds, tx / seconds


async def throughput_events(
    read: Callable[[], Awaitable[nano.NanoTraffic]] = nano.read_traffic,
    interval: float = SAMPLE_INTERVAL_SECONDS,
) -> AsyncIterator[dict[str, Any]]:
    """Reads the Nano's counters every `interval` seconds and yields the current speed; runs until the client leaves."""
    window: deque[Reading] = deque(maxlen=WINDOW_READINGS)
    while True:
        try:
            reading = Reading(await read(), time.monotonic())
        except nano.NanoConfigError as err:
            yield {"type": "error", "detail": str(err)}
            return
        except nano.NanoUnavailableError as err:
            window.clear()
            yield {"type": "error", "detail": str(err)}
        else:
            if window and reading.traffic.uptime < window[-1].traffic.uptime:
                # The Nano rebooted; older readings belong to the previous counter
                window.clear()
            if window:
                rx, tx = rate(reading, window[0])
                yield {"type": "rate", "rx_bytes_per_second": round(rx), "tx_bytes_per_second": round(tx)}
            window.append(reading)
        await asyncio.sleep(interval)
