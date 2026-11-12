from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Float, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ConnectionCheck(Base):
    __tablename__ = "connection_check"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    router_ok: Mapped[bool] = mapped_column(Boolean, nullable=False)
    nano_ok: Mapped[bool] = mapped_column(Boolean, nullable=False)
    provider_ok: Mapped[bool] = mapped_column(Boolean, nullable=False)
    internet_ok: Mapped[bool] = mapped_column(Boolean, nullable=False)
    router_ms: Mapped[float | None] = mapped_column(Float)
    nano_ms: Mapped[float | None] = mapped_column(Float)
    provider_ms: Mapped[float | None] = mapped_column(Float)
    internet_ms: Mapped[float | None] = mapped_column(Float)
    online: Mapped[bool] = mapped_column(Boolean, nullable=False)
    break_at: Mapped[str | None] = mapped_column(String(16))


class TrafficSample(Base):
    __tablename__ = "traffic_sample"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    rx_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tx_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    uptime: Mapped[int] = mapped_column(Integer, nullable=False)
    rx_delta: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tx_delta: Mapped[int] = mapped_column(BigInteger, nullable=False)


class SpeedTestResult(Base):
    __tablename__ = "speed_test"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    download_mbps: Mapped[float] = mapped_column(Float, nullable=False)
    ping_ms: Mapped[float | None] = mapped_column(Float)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    server_location: Mapped[str | None] = mapped_column(String(128))
    client_location: Mapped[str | None] = mapped_column(String(128))


class Device(Base):
    """Every device the router has listed, so the history keeps names the router forgets."""

    __tablename__ = "device"

    mac: Mapped[str] = mapped_column(String(17), primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False, server_default="")
    last_ip: Mapped[str | None] = mapped_column(String(45))
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class DeviceSample(Base):
    """The speed of one online device at one moment; the bytes are estimated from it."""

    __tablename__ = "device_sample"
    __table_args__ = (Index("ix_device_sample_mac_date", "mac", "date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    mac: Mapped[str] = mapped_column(String(17), nullable=False)
    down_kbs: Mapped[int] = mapped_column(Integer, nullable=False)
    up_kbs: Mapped[int] = mapped_column(Integer, nullable=False)
    down_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    up_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
