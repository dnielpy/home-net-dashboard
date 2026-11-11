from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta

from app.segments import MAX_CHECK_GAP, find_segments


@dataclass
class Outage:
    start: datetime
    end: datetime
    ongoing: bool
    break_at: str | None

    @property
    def duration_hours(self) -> float:
        return round((self.end - self.start).total_seconds() / 3600, 3)


def find_outages(
    states: Iterable[tuple[datetime, bool, str | None]],
    max_gap: timedelta = MAX_CHECK_GAP,
) -> list[Outage]:
    """An outage is a run of checks without internet. It ends with the first check that reaches internet again,
    or at the last check before a gap of more than `max_gap` without checks."""
    segments = find_segments(states, max_gap)
    return [
        Outage(
            start=segment.start,
            end=segment.end,
            ongoing=segment is segments[-1],
            break_at=segment.break_at,
        )
        for segment in segments
        if segment.online is False
    ]
