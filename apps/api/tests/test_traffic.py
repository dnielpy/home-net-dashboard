from datetime import datetime, timezone

from app.models import TrafficSample
from app.nano import NanoTraffic
from app.traffic import build_sample, counter_delta

NOW = datetime(2026, 11, 11, tzinfo=timezone.utc)


def _previous(rx: int, tx: int, uptime: int) -> TrafficSample:
    return TrafficSample(rx_bytes=rx, tx_bytes=tx, uptime=uptime, rx_delta=0, tx_delta=0)


def test_first_sample_has_no_delta() -> None:
    assert counter_delta(500, None, rebooted=False) == 0


def test_delta_is_difference_between_samples() -> None:
    assert counter_delta(1500, 1000, rebooted=False) == 500


def test_reboot_counts_from_zero() -> None:
    assert counter_delta(200, 1_000_000, rebooted=True) == 200


def test_counter_going_down_without_reboot_adds_nothing() -> None:
    assert counter_delta(200, 1_000_000, rebooted=False) == 0


def test_build_sample() -> None:
    sample = build_sample(NanoTraffic(rx_bytes=4000, tx_bytes=150, uptime=40), _previous(1000, 100, 10), NOW)

    assert (sample.rx_delta, sample.tx_delta, sample.date) == (3000, 50, NOW)


def test_build_sample_after_reboot() -> None:
    sample = build_sample(NanoTraffic(rx_bytes=300, tx_bytes=30, uptime=5), _previous(9000, 900, 50_000), NOW)

    assert (sample.rx_delta, sample.tx_delta) == (300, 30)
