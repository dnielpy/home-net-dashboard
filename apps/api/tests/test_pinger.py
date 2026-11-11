import asyncio
from dataclasses import dataclass

import pytest

from app import pinger
from app.pinger import HopResult, find_break


def _hops(*oks: bool) -> list[HopResult]:
    return [HopResult(name=name, ip="0.0.0.0", ok=ok, latency_ms=1.0 if ok else None) for name, ok in zip(pinger.HOP_NAMES, oks)]


def test_no_break_when_every_hop_answers() -> None:
    assert find_break(_hops(True, True, True, True)) is None


def test_break_is_first_hop_that_fails() -> None:
    assert find_break(_hops(True, True, False, False)) == "provider"


def test_hop_that_ignores_pings_is_not_the_break_when_a_later_hop_answers() -> None:
    assert find_break(_hops(True, False, True, True)) is None


def test_break_is_after_the_last_hop_that_answers() -> None:
    assert find_break(_hops(True, False, True, False)) == "internet"


def test_break_at_router_when_nothing_answers() -> None:
    assert find_break(_hops(False, False, False, False)) == "router"


@dataclass
class FakeHost:
    address: str
    is_alive: bool
    avg_rtt: float


def test_ping_hops_uses_configured_ips(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PROVIDER_IP", "10.0.0.9")
    sent: list[str] = []

    async def fake_multiping(addresses: list[str], **kwargs) -> list[FakeHost]:
        sent.extend(addresses)
        return [FakeHost(address, address != "1.1.1.1", 2.345) for address in addresses]

    monkeypatch.setattr(pinger, "async_multiping", fake_multiping)

    chain = asyncio.run(pinger.ping_hops())

    assert sent == ["10.40.43.100", "10.40.43.99", "10.0.0.9", "1.1.1.1"]
    assert [hop.latency_ms for hop in chain.hops] == [2.35, 2.35, 2.35, None]
    assert chain.online is False
    assert chain.break_at == "internet"


def test_ping_hop_averages_about_three_seconds_of_pings(monkeypatch: pytest.MonkeyPatch) -> None:
    sent = {}

    async def fake_ping(address: str, **kwargs) -> FakeHost:
        sent.update(address=address, **kwargs)
        return FakeHost(address, True, 4.567)

    monkeypatch.setattr(pinger, "async_ping", fake_ping)

    result = asyncio.run(pinger.ping_hop("nano"))

    assert (result.ip, result.ok, result.latency_ms) == ("10.40.43.99", True, 4.57)
    assert (sent["count"] - 1) * sent["interval"] == 3


def test_ping_unknown_hop() -> None:
    with pytest.raises(pinger.UnknownHopError):
        asyncio.run(pinger.ping_hop("modem"))
