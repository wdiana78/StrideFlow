"""Rules engine: turns the state of projects into flags and automatic status changes.

It is idempotent: running it twice in a row changes nothing the second time. It runs after
every write that can affect a rule, and before the attention list is read.

Rules
  due_soon       activity not started, due within 3 days               -> remind owner
  overdue        activity past due and not done                         -> owner; after 2 days escalate to project manager
                 commitment past due and below target                   -> project manager
  missing_proof  completion was refused and required proof is still absent
  blocked        activity waits on a dependency that is past due        -> activity status set to blocked
  behind_pace    commitment 15+ points behind expected-by-today         -> project manager
A manually resolved flag is not reopened for 3 days, so people can deliberately accept a risk.
"""
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import (
    Activity,
    ActivityStatus,
    Commitment,
    Flag,
    FlagRule,
    FlagSeverity,
    FlagStatus,
    Project,
    ProjectStatus,
)
from . import pace
from .audit import log

DUE_SOON_DAYS = 3
ESCALATE_AFTER_DAYS = 2
MANUAL_RESOLVE_QUIET_DAYS = 3


def missing_requirements(activity: Activity) -> list[str]:
    have = {e.requirement_id for e in activity.evidence if e.requirement_id}
    return [r.label for r in activity.requirements if r.is_required and r.id not in have]


def _fmt(d: date) -> str:
    return f"{d.day} {d.strftime('%b')}"


def _apply_status_transitions(db: Session, project: Project, today: date) -> None:
    for c in project.commitments:
        for a in c.activities:
            if a.status == ActivityStatus.done:
                continue
            dep = a.depends_on
            waiting = dep is not None and dep.status != ActivityStatus.done and dep.due_on < today
            if waiting and a.status != ActivityStatus.blocked:
                a.status = ActivityStatus.blocked
                log(db, project.organization_id, None, "auto_blocked", "activity", a.id,
                    f"Blocked: waits on '{dep.title}', which is past due")
            elif not waiting and a.status == ActivityStatus.blocked:
                a.status = ActivityStatus.in_progress if a.evidence else ActivityStatus.not_started
                log(db, project.organization_id, None, "auto_unblocked", "activity", a.id, "Unblocked: dependency cleared")


def _desired_flags(project: Project, today: date) -> dict:
    out = {}
    manager_id = project.manager_id
    for c in project.commitments:
        p = pace.compute(c, today)
        key = (FlagRule.behind_pace, "commitment", c.id)
        if p.status == "at_risk":
            out[key] = dict(
                severity=FlagSeverity.high if p.gap_pts >= 25 else FlagSeverity.medium,
                owner_id=manager_id,
                title=c.title,
                detail=f"{p.gap_pts:g} points behind: {p.actual:g} of {p.target:g} {c.unit}, {p.expected:g} expected by today.",
                data=p.as_dict(),
            )
        if p.status == "overdue":
            out[(FlagRule.overdue, "commitment", c.id)] = dict(
                severity=FlagSeverity.high,
                owner_id=manager_id,
                title=c.title,
                detail=f"Was due {_fmt(c.due_on)}; {p.actual:g} of {p.target:g} {c.unit} done.",
                data=p.as_dict(),
            )
        for a in c.activities:
            if a.status == ActivityStatus.done:
                continue
            if a.status == ActivityStatus.blocked:
                out[(FlagRule.blocked, "activity", a.id)] = dict(
                    severity=FlagSeverity.medium,
                    owner_id=a.owner_id,
                    title=a.title,
                    detail=f"Waits on '{a.depends_on.title}', due {_fmt(a.depends_on.due_on)}." if a.depends_on else "Blocked.",
                    data={"depends_on_id": str(a.depends_on_id) if a.depends_on_id else None},
                )
            elif a.due_on < today:
                days = (today - a.due_on).days
                escalated = days > ESCALATE_AFTER_DAYS and manager_id is not None
                out[(FlagRule.overdue, "activity", a.id)] = dict(
                    severity=FlagSeverity.high if escalated else FlagSeverity.medium,
                    owner_id=manager_id if escalated else a.owner_id,
                    title=a.title,
                    detail=f"Due {_fmt(a.due_on)}, {days} day{'s' if days != 1 else ''} late."
                    + (" Escalated to the project manager." if escalated else ""),
                    data={"days_late": days, "escalated": escalated, "activity_owner_id": str(a.owner_id) if a.owner_id else None},
                )
            elif a.status == ActivityStatus.not_started and (a.due_on - today).days <= DUE_SOON_DAYS:
                days = (a.due_on - today).days
                out[(FlagRule.due_soon, "activity", a.id)] = dict(
                    severity=FlagSeverity.low,
                    owner_id=a.owner_id,
                    title=a.title,
                    detail=f"Due {_fmt(a.due_on)}" + (" (today)" if days == 0 else f", in {days} day{'s' if days != 1 else ''}") + ", not started.",
                    data={"days_left": days},
                )
            missing = missing_requirements(a)
            if a.completion_refused_at and missing:
                out[(FlagRule.missing_proof, "activity", a.id)] = dict(
                    severity=FlagSeverity.medium,
                    owner_id=a.owner_id,
                    title=a.title,
                    detail="Completion refused. Missing: " + ", ".join(missing) + ".",
                    data={"missing": missing},
                )
    return out


def evaluate_org(db: Session, org_id: uuid.UUID, today: date) -> dict:
    projects = db.scalars(
        select(Project)
        .where(Project.organization_id == org_id, Project.status == ProjectStatus.active)
        .options(
            selectinload(Project.commitments)
            .selectinload(Commitment.activities)
            .selectinload(Activity.evidence),
            selectinload(Project.commitments).selectinload(Commitment.activities).selectinload(Activity.requirements),
        )
    ).all()

    desired: dict = {}
    for p in projects:
        _apply_status_transitions(db, p, today)
        for key, val in _desired_flags(p, today).items():
            desired[key] = {**val, "project_id": p.id}

    from .. import erp  # module-level rules (finance, inventory, documents, approvals, grants)

    for key, val in erp.desired_flags(db, org_id, today).items():
        desired[key] = val

    existing = db.scalars(select(Flag).where(Flag.organization_id == org_id)).all()
    live = {(f.rule, f.subject_type, f.subject_id): f for f in existing if f.status != FlagStatus.resolved}
    quiet_since = datetime.now(timezone.utc) - timedelta(days=MANUAL_RESOLVE_QUIET_DAYS)
    recently_accepted = {
        (f.rule, f.subject_type, f.subject_id)
        for f in existing
        if f.status == FlagStatus.resolved and f.resolved_by_id is not None and f.resolved_at and f.resolved_at > quiet_since
    }

    opened = closed = 0
    for key, val in desired.items():
        f = live.get(key)
        if f:
            f.severity, f.owner_id, f.title, f.detail, f.data = val["severity"], val["owner_id"], val["title"], val["detail"], val["data"]
            if f.status == FlagStatus.snoozed and f.snoozed_until and f.snoozed_until <= today:
                f.status, f.snoozed_until = FlagStatus.open, None
        elif key not in recently_accepted:
            rule, stype, sid = key
            f = Flag(organization_id=org_id, rule=rule, subject_type=stype, subject_id=sid, status=FlagStatus.open, **val)
            db.add(f)
            db.flush()
            log(db, org_id, None, "flag_opened", "flag", f.id, f"{rule.value}: {val['title']}")
            opened += 1

    for key, f in live.items():
        if key not in desired:
            f.status = FlagStatus.resolved
            f.resolved_at = datetime.now(timezone.utc)
            f.resolution_note = "Closed automatically: the condition no longer applies."
            log(db, org_id, None, "flag_auto_resolved", "flag", f.id, f"{f.rule.value}: {f.title}")
            closed += 1

    db.commit()
    return {"opened": opened, "closed": closed, "open_total": len(desired)}
