from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Role(StrEnum):
    CITIZEN = "citizen"
    ADMIN = "admin"
    COORDINATOR = "coordinator"


class IncidentStatus(StrEnum):
    REPORTED = "reported"
    VERIFIED = "verified"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    AWAITING_VERIFICATION = "awaiting_verification"
    CLOSED = "closed"
    INVALID = "invalid"


class Severity(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[Role] = mapped_column(Enum(Role, native_enum=False), default=Role.CITIZEN, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    incidents: Mapped[list["Incident"]] = relationship(back_populates="reporter")


class CoordinatorApplication(Base):
    __tablename__ = "coordinator_applications"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="ck_coordinator_application_status"),
        Index("ix_coordinator_applications_status_created", "status", "submitted_at"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    applicant_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    motivation: Mapped[str] = mapped_column(Text, nullable=False)
    experience: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_reason: Mapped[str | None] = mapped_column(Text)


class Incident(Base):
    __tablename__ = "incidents"
    __table_args__ = (
        CheckConstraint("latitude >= -90 AND latitude <= 90", name="ck_incident_latitude"),
        CheckConstraint("longitude >= -180 AND longitude <= 180", name="ck_incident_longitude"),
        CheckConstraint("people_affected >= 0", name="ck_incident_people_affected"),
        Index("ix_incidents_status_severity", "status", "severity"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    disaster_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    photo_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    photos_data: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    location_label: Mapped[str | None] = mapped_column(String(255))
    latitude: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    severity: Mapped[Severity] = mapped_column(Enum(Severity, native_enum=False), nullable=False, index=True)
    people_affected: Mapped[int | None] = mapped_column(Integer, nullable=True)
    people_trapped: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    urgent_medical: Mapped[bool] = mapped_column(default=False, nullable=False)
    immediate_needs: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    suggested_severity: Mapped[Severity | None] = mapped_column(Enum(Severity, native_enum=False))
    priority_reasons: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    priority_override_reason: Mapped[str | None] = mapped_column(Text)
    resolution_notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[IncidentStatus] = mapped_column(Enum(IncidentStatus, native_enum=False, length=32), default=IncidentStatus.REPORTED, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
    reporter: Mapped[User] = relationship(back_populates="incidents")
    history: Mapped[list["IncidentStatusHistory"]] = relationship(back_populates="incident", cascade="all, delete-orphan")

    @property
    def reporter_name(self) -> str:
        return self.reporter.name


class RescueTeam(Base):
    __tablename__ = "rescue_teams"
    __table_args__ = (
        CheckConstraint("capacity > 0", name="ck_rescue_team_capacity"),
        CheckConstraint("availability IN ('available', 'busy', 'offline')", name="ck_rescue_team_availability"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    team_name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    availability: Mapped[str] = mapped_column(String(20), default="available", nullable=False, index=True)
    coordinator_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    location_label: Mapped[str | None] = mapped_column(String(255))
    current_latitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    current_longitude: Mapped[float | None] = mapped_column(Numeric(9, 6))


class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'active_in_progress', 'completed')", name="ck_assignment_status"),
        Index("ix_assignments_incident_status", "incident_id", "status"),
        Index("ix_assignments_team_status", "team_id", "status"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id", ondelete="RESTRICT"), nullable=False, index=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("rescue_teams.id", ondelete="RESTRICT"), nullable=False, index=True)
    assigned_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    arrived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    outcome_notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False, index=True)


class Inventory(Base):
    __tablename__ = "inventory"
    __table_args__ = (UniqueConstraint("relief_center", "item_name", name="uq_inventory_center_item"), CheckConstraint("quantity >= 0", name="ck_inventory_quantity_nonnegative"))
    id: Mapped[int] = mapped_column(primary_key=True)
    relief_center: Mapped[str] = mapped_column(String(120), nullable=False)
    item_name: Mapped[str] = mapped_column(String(120), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_inventory_transaction_quantity"), CheckConstraint("transaction_type IN ('received', 'distributed')", name="ck_inventory_transaction_type"))
    id: Mapped[int] = mapped_column(primary_key=True)
    inventory_id: Mapped[int] = mapped_column(ForeignKey("inventory.id", ondelete="RESTRICT"), nullable=False, index=True)
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    recorded_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)


class IncidentStatusHistory(Base):
    __tablename__ = "incident_status_history"
    __table_args__ = (Index("ix_status_history_incident_changed", "incident_id", "changed_at"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    old_status: Mapped[IncidentStatus | None] = mapped_column(Enum(IncidentStatus, native_enum=False, length=32))
    new_status: Mapped[IncidentStatus] = mapped_column(Enum(IncidentStatus, native_enum=False, length=32), nullable=False)
    changed_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    incident: Mapped[Incident] = relationship(back_populates="history")
