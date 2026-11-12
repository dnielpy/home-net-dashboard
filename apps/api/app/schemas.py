from datetime import datetime

from pydantic import BaseModel, Field


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
    totals_since: datetime | None
    online_hours: float
    offline_hours: float


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


class SpeedTestOut(BaseModel):
    measured_at: datetime
    download_mbps: float
    ping_ms: float | None
    duration_ms: int | None
    server_location: str | None
    client_location: str | None


class DeviceOut(BaseModel):
    mac: str
    name: str
    ip: str | None
    # False when the device is only known from the history (the router no longer lists it)
    in_router: bool
    online: bool
    blocked: bool
    down_kbs: int
    up_kbs: int
    connected_since: datetime | None
    last_seen: datetime | None
    limit_down_kbs: int
    limit_up_kbs: int
    usage_24h_down_bytes: int
    usage_24h_up_bytes: int


class DeviceUsageOut(BaseModel):
    mac: str
    name: str
    down_bytes: int
    up_bytes: int


class DeviceHistoryPoint(BaseModel):
    start: datetime
    avg_down_kbs: float
    max_down_kbs: int
    avg_up_kbs: float
    max_up_kbs: int
    down_bytes: int
    up_bytes: int


class DeviceHistoryOut(BaseModel):
    mac: str
    total_down_bytes: int
    total_up_bytes: int
    items: list[DeviceHistoryPoint]


class DeviceBlockIn(BaseModel):
    blocked: bool


class DeviceLimitIn(BaseModel):
    down_kbs: int = Field(ge=0, le=1_000_000, description="Download limit in KB/s; 0 removes it.")
    up_kbs: int = Field(ge=0, le=1_000_000, description="Upload limit in KB/s; 0 removes it.")


class DeviceNameIn(BaseModel):
    name: str = Field(min_length=1, max_length=32)
