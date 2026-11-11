from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Float, Integer, String, func
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
