"""Database tables.

Incident = one real-world problem (a ticket). Report = one citizen's message about it.
Many reports can point to one incident after duplicate merging.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

ACTIVE_STATUSES = ("received", "review", "assigned", "in_progress", "escalated")
TERMINAL_STATUSES = ("closed", "rejected", "merged")


def utcnow() -> datetime:
    """Naive UTC timestamp (SQLite does not keep time zones)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str] = mapped_column(String(20), index=True)
    department: Mapped[str] = mapped_column(String(20), index=True)
    status: Mapped[str] = mapped_column(String(20), default="received", index=True)

    lat: Mapped[Optional[float]] = mapped_column(Float)
    lon: Mapped[Optional[float]] = mapped_column(Float)
    gps_accuracy_m: Mapped[Optional[float]] = mapped_column(Float)
    address: Mapped[Optional[str]] = mapped_column(String(300))

    is_sos: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    sos_area_id: Mapped[Optional[int]] = mapped_column(Integer)  # first SOS in the same small area

    severity: Mapped[int] = mapped_column(Integer, default=1)
    vulnerable: Mapped[bool] = mapped_column(Boolean, default=False)
    people_count: Mapped[int] = mapped_column(Integer, default=0)
    report_count: Mapped[int] = mapped_column(Integer, default=0)
    priority: Mapped[float] = mapped_column(Float, default=0.0)
    escalation_level: Mapped[int] = mapped_column(Integer, default=0)

    needs_review: Mapped[bool] = mapped_column(Boolean, default=False)
    review_reason: Mapped[Optional[str]] = mapped_column(String(300))
    possible_duplicate_of: Mapped[Optional[int]] = mapped_column(Integer)
    merged_into: Mapped[Optional[int]] = mapped_column(Integer)

    best_photo_path: Mapped[Optional[str]] = mapped_column(String(300))
    best_photo_sharpness: Mapped[Optional[float]] = mapped_column(Float)
    resolution_photo_path: Mapped[Optional[str]] = mapped_column(String(300))

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    sla_due_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    reports: Mapped[list["Report"]] = relationship(back_populates="incident", order_by="Report.id")
    events: Mapped[list["StatusEvent"]] = relationship(back_populates="incident", order_by="StatusEvent.id")

    @property
    def ticket_code(self) -> str:
        return f"SS-{self.id:04d}"


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Same ID is used for the app upload, the SMS and the mesh copy of one report,
    # so a report that arrives through two channels is counted once.
    client_report_id: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True)
    incident_id: Mapped[Optional[int]] = mapped_column(ForeignKey("incidents.id"), index=True)

    channel: Mapped[str] = mapped_column(String(10))  # app | sms | mesh | voice
    phone: Mapped[Optional[str]] = mapped_column(String(20), index=True)
    relayed_by: Mapped[Optional[str]] = mapped_column(String(20))

    lat: Mapped[Optional[float]] = mapped_column(Float)
    lon: Mapped[Optional[float]] = mapped_column(Float)
    gps_accuracy_m: Mapped[Optional[float]] = mapped_column(Float)
    location_source: Mapped[str] = mapped_column(String(10), default="gps")  # gps | text | none
    captured_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    address: Mapped[Optional[str]] = mapped_column(String(300))

    category: Mapped[str] = mapped_column(String(20))
    subtype: Mapped[Optional[str]] = mapped_column(String(40))
    severity: Mapped[int] = mapped_column(Integer, default=1)
    people_count: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[Optional[str]] = mapped_column(Text)
    battery_pct: Mapped[Optional[int]] = mapped_column(Integer)

    is_sos: Mapped[bool] = mapped_column(Boolean, default=False)
    is_mocked: Mapped[bool] = mapped_column(Boolean, default=False)

    photo_path: Mapped[Optional[str]] = mapped_column(String(300))
    photo_sha256: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    phash: Mapped[Optional[str]] = mapped_column(String(32), index=True)
    sharpness: Mapped[Optional[float]] = mapped_column(Float)
    embedding: Mapped[Optional[list]] = mapped_column(JSON)
    integrity: Mapped[str] = mapped_column(String(10), default="unsigned")  # verified | unsigned | failed

    dedup_decision: Mapped[str] = mapped_column(String(20), default="new")
    dedup_detail: Mapped[Optional[str]] = mapped_column(String(300))

    incident: Mapped[Optional[Incident]] = relationship(back_populates="reports")


class StatusEvent(Base):
    """Every change is logged, so the public can see what was done and when."""

    __tablename__ = "status_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    status: Mapped[str] = mapped_column(String(20))
    note: Mapped[Optional[str]] = mapped_column(String(500))
    actor: Mapped[str] = mapped_column(String(40), default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    incident: Mapped[Incident] = relationship(back_populates="events")


class OutboxMessage(Base):
    """Every SMS the system sends. In demo mode this table *is* the SMS log."""

    __tablename__ = "outbox"

    id: Mapped[int] = mapped_column(primary_key=True)
    to_phone: Mapped[str] = mapped_column(String(20), index=True)
    body: Mapped[str] = mapped_column(Text)
    incident_id: Mapped[Optional[int]] = mapped_column(Integer, index=True)
    delivered: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Citizen(Base):
    """Registered before a cyclone so officials know who needs help to evacuate first."""

    __tablename__ = "citizens"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(80))
    village: Mapped[Optional[str]] = mapped_column(String(80))
    lat: Mapped[Optional[float]] = mapped_column(Float)
    lon: Mapped[Optional[float]] = mapped_column(Float)
    household_size: Mapped[int] = mapped_column(Integer, default=1)
    needs: Mapped[list] = mapped_column(JSON, default=list)  # elderly, pregnant, disabled, infant, dialysis, bedridden
    medical_notes: Mapped[Optional[str]] = mapped_column(String(300))
    family_contacts: Mapped[list] = mapped_column(JSON, default=list)
    consent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Alert(Base):
    """Early warning shown in the citizen app (typed by the control room or imported from a CAP feed)."""

    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    level: Mapped[str] = mapped_column(String(10), default="orange")  # red | orange | yellow
    hazard: Mapped[str] = mapped_column(String(40), default="Cyclone")
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    message_te: Mapped[Optional[str]] = mapped_column(Text)
    area_name: Mapped[Optional[str]] = mapped_column(String(200))
    center_lat: Mapped[Optional[float]] = mapped_column(Float)  # no centre = whole state
    center_lon: Mapped[Optional[float]] = mapped_column(Float)
    radius_km: Mapped[Optional[float]] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(20), default="manual")  # manual | cap
    cap_identifier: Mapped[Optional[str]] = mapped_column(String(200), unique=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
