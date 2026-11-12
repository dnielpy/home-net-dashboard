from datetime import datetime, timedelta, timezone

from app.outages import find_outages
from app.segments import connection_totals, find_segments

T0 = datetime(2026, 11, 11, 0, 0, tzinfo=timezone.utc)
STEP = timedelta(seconds=30)


def _states(*states: str | None, step: timedelta = STEP) -> list[tuple[datetime, bool, str | None]]:
    """Each state is None for online or the hop where the chain is cut."""
    return [(T0 + step * index, state is None, state) for index, state in enumerate(states)]


def test_single_online_segment() -> None:
    [segment] = find_segments(_states(None, None, None))

    assert (segment.start, segment.end, segment.online, segment.break_at) == (T0, T0 + 2 * STEP, True, None)


def test_offline_segment_ends_with_first_online_check() -> None:
    segments = find_segments(_states(None, "provider", "provider", None))

    assert [(s.start, s.end, s.online) for s in segments] == [
        (T0, T0 + STEP, True),
        (T0 + STEP, T0 + 3 * STEP, False),
        (T0 + 3 * STEP, T0 + 3 * STEP, True),
    ]
    assert segments[1].break_at == "provider"


def test_gap_becomes_segment_without_data() -> None:
    states = _states(None, None) + [(T0 + timedelta(minutes=20), True, None)]

    segments = find_segments(states)

    assert [(s.start, s.end, s.online) for s in segments] == [
        (T0, T0 + STEP, True),
        (T0 + STEP, T0 + timedelta(minutes=20), None),
        (T0 + timedelta(minutes=20), T0 + timedelta(minutes=20), True),
    ]


def test_break_at_is_the_most_common_hop() -> None:
    [_, outage] = find_segments(_states(None, "internet", "provider", "provider", "internet", "provider"))

    assert outage.break_at == "provider"


def test_break_at_tie_picks_hop_closest_to_home() -> None:
    [outage] = find_segments(_states("internet", "nano"))

    assert outage.break_at == "nano"


def test_no_segments_without_checks() -> None:
    assert find_segments([]) == []


def test_outages_are_offline_segments() -> None:
    outages = find_outages(_states("router", None, None, "nano", "nano"))

    assert [(o.start, o.end, o.ongoing, o.break_at) for o in outages] == [
        (T0, T0 + STEP, False, "router"),
        (T0 + 3 * STEP, T0 + 4 * STEP, True, "nano"),
    ]
    assert outages[0].duration_hours == round(30 / 3600, 3)


def test_outage_closes_at_gap() -> None:
    states = _states(None, "provider") + [(T0 + timedelta(minutes=30), True, None)]

    [outage] = find_outages(states)

    assert (outage.start, outage.end, outage.ongoing) == (T0 + STEP, T0 + STEP, False)


def test_totals_leave_out_gaps() -> None:
    states = _states(None, None, "provider", None) + [(T0 + timedelta(minutes=20), True, None)]

    totals = connection_totals(find_segments(states))

    assert totals.since == T0
    assert totals.online_hours == round(2 * STEP.total_seconds() / 3600, 3)
    assert totals.offline_hours == round(STEP.total_seconds() / 3600, 3)


def test_totals_without_checks() -> None:
    totals = connection_totals([])

    assert (totals.since, totals.online_hours, totals.offline_hours) == (None, 0.0, 0.0)
