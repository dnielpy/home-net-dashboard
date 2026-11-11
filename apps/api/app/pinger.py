import os
from dataclasses import dataclass
from datetime import datetime, timezone

from icmplib import async_multiping, async_ping

HOP_NAMES = ["router", "nano", "provider", "internet"]

DEFAULT_IPS = {
    "router": "10.40.43.100",
    "nano": "10.40.43.99",
    "provider": "10.40.43.125",
    "internet": "1.1.1.1",
}

PING_COUNT = 3
PING_INTERVAL_SECONDS = 0.2
PING_TIMEOUT_SECONDS = 1
# A single hop is pinged once a second for about 3 seconds, so the dashboard can walk the chain hop by hop
HOP_PING_COUNT = 4
HOP_PING_INTERVAL_SECONDS = 1


@dataclass
class HopResult:
    name: str
    ip: str
    ok: bool
    latency_ms: float | None


@dataclass
class ChainCheck:
    checked_at: datetime
    hops: list[HopResult]

    @property
    def online(self) -> bool:
        return self.hops[-1].ok

    @property
    def break_at(self) -> str | None:
        return find_break(self.hops)


def get_hop_ips() -> list[tuple[str, str]]:
    return [(name, os.environ.get(f"{name.upper()}_IP", DEFAULT_IPS[name])) for name in HOP_NAMES]


def find_break(hops: list[HopResult]) -> str | None:
    """The chain is cut right after the last hop that answers. A hop that ignores pings while a hop behind it
    answers is still passing traffic, so it is not the cut."""
    last_ok = max((index for index, hop in enumerate(hops) if hop.ok), default=-1)
    return hops[last_ok + 1].name if last_ok + 1 < len(hops) else None


async def ping_hops() -> ChainCheck:
    hops = get_hop_ips()
    checked_at = datetime.now(timezone.utc)
    hosts = await async_multiping(
        [ip for _, ip in hops],
        count=PING_COUNT,
        interval=PING_INTERVAL_SECONDS,
        timeout=PING_TIMEOUT_SECONDS,
        privileged=False,
    )
    results = [
        HopResult(
            name=name,
            ip=ip,
            ok=host.is_alive,
            latency_ms=round(host.avg_rtt, 2) if host.is_alive else None,
        )
        for (name, ip), host in zip(hops, hosts)
    ]
    return ChainCheck(checked_at=checked_at, hops=results)


class UnknownHopError(Exception):
    pass


async def ping_hop(name: str) -> HopResult:
    ip = dict(get_hop_ips()).get(name)
    if ip is None:
        raise UnknownHopError(f"Unknown hop {name!r}, expected one of {', '.join(HOP_NAMES)}")
    host = await async_ping(
        ip,
        count=HOP_PING_COUNT,
        interval=HOP_PING_INTERVAL_SECONDS,
        timeout=PING_TIMEOUT_SECONDS,
        privileged=False,
    )
    return HopResult(
        name=name,
        ip=ip,
        ok=host.is_alive,
        latency_ms=round(host.avg_rtt, 2) if host.is_alive else None,
    )
