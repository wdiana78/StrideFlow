import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from .models import ActivityStatus, EvidenceKind, Measure, ProjectStatus, Role, StakeholderKind


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- auth / users ----------
class RegisterIn(BaseModel):
    organization_name: str = Field(min_length=2, max_length=160)
    sector: str = Field(default="", max_length=80)
    currency: str = Field(default="KES", min_length=3, max_length=3)
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("currency")
    @classmethod
    def upper(cls, v: str) -> str:
        return v.upper()


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class OrgOut(ORM):
    id: uuid.UUID
    name: str
    sector: str
    currency: str


class UserOut(ORM):
    id: uuid.UUID
    full_name: str
    email: str
    role: Role
    is_active: bool


class MeOut(UserOut):
    organization: OrgOut


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: MeOut


class InviteIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    role: Role = Role.member
    temporary_password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    role: Role | None = None
    is_active: bool | None = None


class UserMini(ORM):
    id: uuid.UUID
    full_name: str


# ---------- stakeholders / templates ----------
class StakeholderIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    kind: StakeholderKind
    contact_email: EmailStr | None = None


class StakeholderOut(ORM):
    id: uuid.UUID
    name: str
    kind: StakeholderKind
    contact_email: str | None


class TemplateOut(ORM):
    id: uuid.UUID
    key: str
    name: str
    description: str
    vocabulary: dict
    blueprint: dict


# ---------- projects / commitments ----------
class CommitmentIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    unit: str = Field(default="", max_length=60)
    measure: Measure = Measure.sum
    target_value: float = Field(gt=0)
    due_on: date
    stakeholder_id: uuid.UUID | None = None


class CommitmentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    unit: str | None = Field(default=None, max_length=60)
    target_value: float | None = Field(default=None, gt=0)
    due_on: date | None = None


class ProjectIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=4000)
    starts_on: date
    ends_on: date
    stakeholder_id: uuid.UUID | None = None
    manager_id: uuid.UUID | None = None
    template_id: uuid.UUID | None = None
    commitments: list[CommitmentIn] = Field(default_factory=list)

    @model_validator(mode="after")
    def dates(self):
        if self.ends_on <= self.starts_on:
            raise ValueError("The end date must be after the start date.")
        return self


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=4000)
    starts_on: date | None = None
    ends_on: date | None = None
    stakeholder_id: uuid.UUID | None = None
    manager_id: uuid.UUID | None = None
    status: ProjectStatus | None = None


class PaceOut(BaseModel):
    actual: float
    expected: float
    target: float
    actual_pct: float
    expected_pct: float
    gap_pts: float
    status: str
    done_activities: int
    total_activities: int


class CommitmentOut(ORM):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    unit: str
    measure: Measure
    target_value: float
    due_on: date
    stakeholder: StakeholderOut | None
    pace: PaceOut


class ProjectListItem(BaseModel):
    id: uuid.UUID
    name: str
    status: ProjectStatus
    starts_on: date
    ends_on: date
    stakeholder: StakeholderOut | None
    manager: UserMini | None
    commitments_total: int
    commitments_attention: int
    open_flags: int


class ProjectOut(ORM):
    id: uuid.UUID
    name: str
    description: str
    status: ProjectStatus
    starts_on: date
    ends_on: date
    stakeholder: StakeholderOut | None
    manager: UserMini | None
    template: TemplateOut | None
    commitments: list[CommitmentOut]


class Page(BaseModel):
    items: list
    total: int
    page: int
    page_size: int


# ---------- activities / evidence ----------
class RequirementIn(BaseModel):
    kind: EvidenceKind
    label: str = Field(min_length=1, max_length=160)
    is_required: bool = True
    counts_toward_target: bool = False


class RequirementOut(ORM):
    id: uuid.UUID
    kind: EvidenceKind
    label: str
    is_required: bool
    counts_toward_target: bool


class ActivityIn(BaseModel):
    commitment_id: uuid.UUID
    title: str = Field(min_length=2, max_length=200)
    notes: str = Field(default="", max_length=4000)
    due_on: date
    owner_id: uuid.UUID | None = None
    depends_on_id: uuid.UUID | None = None
    activity_type: str | None = None  # template activity type key; copies its proof requirements
    requirements: list[RequirementIn] | None = None


class ActivityUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    notes: str | None = Field(default=None, max_length=4000)
    due_on: date | None = None
    owner_id: uuid.UUID | None = None
    depends_on_id: uuid.UUID | None = None
    status: Literal["not_started", "in_progress"] | None = None


class EvidenceIn(BaseModel):
    requirement_id: uuid.UUID | None = None
    kind: Literal["value", "note"]
    value_number: float | None = None
    text: str | None = Field(default=None, max_length=8000)

    @model_validator(mode="after")
    def check(self):
        if self.kind == "value" and self.value_number is None:
            raise ValueError("Enter a number.")
        if self.kind == "value" and self.value_number is not None and self.value_number < 0:
            raise ValueError("The number cannot be negative.")
        if self.kind == "note" and not (self.text or "").strip():
            raise ValueError("Write the note before saving it.")
        return self


class EvidenceOut(ORM):
    id: uuid.UUID
    requirement_id: uuid.UUID | None
    kind: EvidenceKind
    value_number: float | None
    text: str | None
    file_name: str | None
    file_url: str | None
    file_size: int | None
    captured_by: UserMini | None
    captured_at: datetime


class ActivityRow(BaseModel):
    id: uuid.UUID
    title: str
    due_on: date
    status: ActivityStatus
    owner: UserMini | None
    commitment_id: uuid.UUID
    commitment_title: str
    project_id: uuid.UUID
    project_name: str
    proof_have: int
    proof_need: int


class AuditOut(ORM):
    id: int
    action: str
    subject_type: str
    subject_id: str
    summary: str
    changes: dict
    at: datetime
    actor: UserMini | None


class ActivityOut(BaseModel):
    id: uuid.UUID
    title: str
    notes: str
    due_on: date
    status: ActivityStatus
    completed_at: datetime | None
    completion_refused_at: datetime | None
    owner: UserMini | None
    depends_on: dict | None
    commitment: dict
    project: dict
    requirements: list[RequirementOut]
    evidence: list[EvidenceOut]
    missing: list[str]
    history: list[AuditOut]


# ---------- flags ----------
class FlagOut(ORM):
    id: uuid.UUID
    rule: str
    subject_type: str
    subject_id: uuid.UUID
    severity: str
    status: str
    title: str
    detail: str
    data: dict
    opened_at: datetime
    snoozed_until: date | None
    resolved_at: datetime | None
    resolution_note: str | None
    owner: UserMini | None
    resolved_by: UserMini | None
    project_id: uuid.UUID | None
    project_name: str | None = None


class ResolveIn(BaseModel):
    note: str = Field(min_length=3, max_length=2000)


class SnoozeIn(BaseModel):
    days: int = Field(ge=1, le=30)


class ReassignIn(BaseModel):
    owner_id: uuid.UUID


class FollowUpIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    due_on: date
    owner_id: uuid.UUID | None = None


# ---------- reports ----------
class ReportIn(BaseModel):
    period_start: date
    period_end: date

    @model_validator(mode="after")
    def order(self):
        if self.period_end < self.period_start:
            raise ValueError("The period must end after it starts.")
        return self


class ReportOut(ORM):
    id: uuid.UUID
    project_id: uuid.UUID
    period_start: date
    period_end: date
    created_at: datetime
    generated_by: UserMini | None
    snapshot: dict


class ReportListItem(ORM):
    id: uuid.UUID
    project_id: uuid.UUID
    period_start: date
    period_end: date
    created_at: datetime
    generated_by: UserMini | None
