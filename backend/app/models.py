import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

JsonType = JSON().with_variant(JSONB(), "postgresql")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _enum(e):
    return Enum(e, native_enum=False, length=32, values_callable=lambda x: [m.value for m in x])


class Role(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    member = "member"
    viewer = "viewer"


class StakeholderKind(str, enum.Enum):
    funder = "funder"
    client = "client"
    partner = "partner"
    supplier = "supplier"


class ProjectStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    archived = "archived"


class Measure(str, enum.Enum):
    sum = "sum"  # sum of counted evidence values
    activities = "activities"  # number of completed activities


class ActivityStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    blocked = "blocked"
    done = "done"


class EvidenceKind(str, enum.Enum):
    file = "file"
    value = "value"
    note = "note"


class FlagRule(str, enum.Enum):
    due_soon = "due_soon"
    overdue = "overdue"
    missing_proof = "missing_proof"
    behind_pace = "behind_pace"
    blocked = "blocked"
    over_budget = "over_budget"
    approval_waiting = "approval_waiting"
    expiring = "expiring"
    low_stock = "low_stock"
    report_due = "report_due"


class FlagSeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class FlagStatus(str, enum.Enum):
    open = "open"
    snoozed = "snoozed"
    resolved = "resolved"


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160))
    sector: Mapped[str] = mapped_column(String(80), default="")
    currency: Mapped[str] = mapped_column(String(3), default="KES")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(100))
    role: Mapped[Role] = mapped_column(_enum(Role), default=Role.member)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    # security
    failed_logins: Mapped[int] = mapped_column(default=0, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    token_version: Mapped[int] = mapped_column(default=0, server_default="0")  # bump to revoke every issued token
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    organization: Mapped[Organization] = relationship()


class Stakeholder(Base):
    __tablename__ = "stakeholders"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    kind: Mapped[StakeholderKind] = mapped_column(_enum(StakeholderKind))
    contact_email: Mapped[str | None] = mapped_column(String(254), nullable=True)


class Template(Base):
    __tablename__ = "templates"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )  # null = built-in
    key: Mapped[str] = mapped_column(String(60))
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    vocabulary: Mapped[dict] = mapped_column(JsonType, default=dict)
    blueprint: Mapped[dict] = mapped_column(JsonType, default=dict)


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    template_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("templates.id", ondelete="SET NULL"), nullable=True)
    stakeholder_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("stakeholders.id", ondelete="SET NULL"), nullable=True)
    manager_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    starts_on: Mapped[date] = mapped_column(Date)
    ends_on: Mapped[date] = mapped_column(Date)
    status: Mapped[ProjectStatus] = mapped_column(_enum(ProjectStatus), default=ProjectStatus.active)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    stakeholder: Mapped[Stakeholder | None] = relationship()
    manager: Mapped[User | None] = relationship()
    template: Mapped[Template | None] = relationship()
    commitments: Mapped[list["Commitment"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="Commitment.due_on"
    )


class Commitment(Base):
    __tablename__ = "commitments"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    stakeholder_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("stakeholders.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    unit: Mapped[str] = mapped_column(String(60), default="")
    measure: Mapped[Measure] = mapped_column(_enum(Measure), default=Measure.sum)
    target_value: Mapped[float] = mapped_column(Numeric(14, 2))
    due_on: Mapped[date] = mapped_column(Date)

    project: Mapped[Project] = relationship(back_populates="commitments")
    stakeholder: Mapped[Stakeholder | None] = relationship()
    activities: Mapped[list["Activity"]] = relationship(
        back_populates="commitment", cascade="all, delete-orphan", order_by="Activity.due_on"
    )


class Activity(Base):
    __tablename__ = "activities"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    commitment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("commitments.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    depends_on_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("activities.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    notes: Mapped[str] = mapped_column(Text, default="")
    due_on: Mapped[date] = mapped_column(Date)
    status: Mapped[ActivityStatus] = mapped_column(_enum(ActivityStatus), default=ActivityStatus.not_started)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completion_refused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    commitment: Mapped[Commitment] = relationship(back_populates="activities")
    owner: Mapped[User | None] = relationship()
    depends_on: Mapped["Activity | None"] = relationship(remote_side="Activity.id")
    requirements: Mapped[list["EvidenceRequirement"]] = relationship(
        back_populates="activity", cascade="all, delete-orphan", order_by="EvidenceRequirement.position"
    )
    evidence: Mapped[list["Evidence"]] = relationship(
        back_populates="activity", cascade="all, delete-orphan", order_by="Evidence.captured_at"
    )


class EvidenceRequirement(Base):
    __tablename__ = "evidence_requirements"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    activity_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("activities.id", ondelete="CASCADE"), index=True)
    kind: Mapped[EvidenceKind] = mapped_column(_enum(EvidenceKind))
    label: Mapped[str] = mapped_column(String(160))
    is_required: Mapped[bool] = mapped_column(Boolean, default=True)
    counts_toward_target: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[int] = mapped_column(default=0)

    activity: Mapped[Activity] = relationship(back_populates="requirements")


class Evidence(Base):
    __tablename__ = "evidence"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    activity_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("activities.id", ondelete="CASCADE"), index=True)
    requirement_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("evidence_requirements.id", ondelete="SET NULL"), nullable=True
    )
    kind: Mapped[EvidenceKind] = mapped_column(_enum(EvidenceKind))
    value_number: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_size: Mapped[int | None] = mapped_column(nullable=True)
    captured_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    activity: Mapped[Activity] = relationship(back_populates="evidence")
    requirement: Mapped[EvidenceRequirement | None] = relationship()
    captured_by: Mapped[User | None] = relationship()


class Flag(Base):
    __tablename__ = "flags"
    __table_args__ = (Index("ix_flags_org_status", "organization_id", "status"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    rule: Mapped[FlagRule] = mapped_column(_enum(FlagRule))
    subject_type: Mapped[str] = mapped_column(String(20))  # "activity" | "commitment"
    subject_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    severity: Mapped[FlagSeverity] = mapped_column(_enum(FlagSeverity))
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[FlagStatus] = mapped_column(_enum(FlagStatus), default=FlagStatus.open)
    title: Mapped[str] = mapped_column(String(200))
    detail: Mapped[str] = mapped_column(Text, default="")
    data: Mapped[dict] = mapped_column(JsonType, default=dict)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    snoozed_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    owner: Mapped[User | None] = relationship(foreign_keys=[owner_id])
    resolved_by: Mapped[User | None] = relationship(foreign_keys=[resolved_by_id])
    project: Mapped[Project | None] = relationship()


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    generated_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    snapshot: Mapped[dict] = mapped_column(JsonType)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    project: Mapped[Project] = relationship()
    generated_by: Mapped[User | None] = relationship()


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(BigInteger().with_variant(BigInteger, "postgresql"), primary_key=True, autoincrement=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(60))
    subject_type: Mapped[str] = mapped_column(String(20))
    subject_id: Mapped[str] = mapped_column(String(40), index=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    changes: Mapped[dict] = mapped_column(JsonType, default=dict)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    actor: Mapped[User | None] = relationship()


class Form(Base):
    """A data-collection form (survey, register, checklist) with its own field definitions."""
    __tablename__ = "forms"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    fields: Mapped[list] = mapped_column(JsonType, default=list)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="open")  # draft | open | closed
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    project: Mapped[Project | None] = relationship()


class FormSubmission(Base):
    __tablename__ = "form_submissions"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    form_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), index=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    data: Mapped[dict] = mapped_column(JsonType)
    source: Mapped[str] = mapped_column(String(10), default="app")  # app | public
    submitted_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
