from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from app.pinger import HOP_NAMES

MAX_CHECK_GAP = timedelta(minutes=5)


@dataclass
class Segment:
    start: datetime
    end: datetime
    online: bool | None
    break_at: str | None = None
    breaks: Counter[str] = field(default_factory=Counter, repr=False, compare=False)

    @property
    def duration_hours(self) -> float:
        return round((self.end - self.start).total_seconds() / 3600, 3)


def most_common_break(breaks: Counter[str]) -> str | None:
    if not breaks:
        return None
    # On a tie, the hop closest to the house wins
    return max(breaks, key=lambda name: (breaks[name], -HOP_NAMES.index(name)))


def find_segments(
    states: Iterable[tuple[datetime, bool, str | None]],
    max_gap: timedelta = MAX_CHECK_GAP,
) -> list[Segment]:
    """Group consecutive checks into periods online, offline or without data (gaps longer than `max_gap`)."""
    segments: list[Segment] = []
    current: Segment | None = None
    last_seen: datetime | None = None

    for date, online, break_at in states:
        if current is not None and last_seen is not None and date - last_seen > max_gap:
            current.end = last_seen
            segments.append(current)
            segments.append(Segment(start=last_seen, end=date, online=None))
            current = None

        if current is not None and current.online != online:
            current.end = date
            segments.append(current)
            current = None

        if current is None:
            current = Segment(start=date, end=date, online=online)
        if not online and break_at is not None:
            current.breaks[break_at] += 1

        last_seen = date

    if current is not None and last_seen is not None:
        current.end = last_seen
        segments.append(current)

    for segment in segments:
        segment.break_at = most_common_break(segment.breaks)

    return segments
