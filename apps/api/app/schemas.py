from datetime import datetime

from pydantic import BaseModel


class HopInfoOut(BaseModel):
    name: str
    ip: str


class HopOut(BaseModel):
    name: str
    ip: str
    ok: bool
    latency_ms: float | None


class LiveConnectionOut(BaseModel):
    checked_at: datetime
    online: bool
    break_at: str | None
    hops: list[HopOut]


class PeriodOut(BaseModel):
    start: datetime
    end: datetime
    duration_hours: float


class OutagePeriodOut(PeriodOut):
    break_at: str | None


class ConnectionStatusOut(BaseModel):
    online: bool | None
    break_at: str | None
    current_since: datetime | None
    last_online: datetime | None
    last_outage: OutagePeriodOut | None
    last_online_period: PeriodOut | None


class SegmentOut(BaseModel):
    start: datetime
    end: datetime
    online: bool | None
    break_at: str | None


class OutageOut(BaseModel):
    start: datetime
    end: datetime
    duration_hours: float
    ongoing: bool
    break_at: str | None


class BandwidthPoint(BaseModel):
    start: datetime
    rx_bytes: int
    tx_bytes: int


class BandwidthOut(BaseModel):
    total_rx_bytes: int
    total_tx_bytes: int
    items: list[BandwidthPoint]
