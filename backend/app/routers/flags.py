import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import today
from ..db import get_db
from ..deps import can_manage, get_current_user
from ..models import Activity, Commitment, EvidenceKind, EvidenceRequirement, Flag, FlagStatus, User
from ..schemas import FlagOut, FollowUpIn, ReassignIn, ResolveIn, SnoozeIn
from ..services import rules
from ..services.audit import log

router = APIRouter(prefix="/flags", tags=["attention"])

SEVERITY_RANK = {"high": 0, "medium": 1, "low": 2}


def flag_out(f: Flag) -> FlagOut:
    out = FlagOut.model_validate(f)
    out.project_name = f.project.name if f.project else None
    return out


def _get(db: Session, fid: uuid.UUID, user: User) -> Flag:
    f = db.get(Flag, fid)
    if not f or f.organization_id != user.organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Flag not found.")
    return f


@router.get("")
def list_flags(
    state: str = Query("open", pattern="^(open|snoozed|resolved)$"),
    mine: bool = False,
    rule: str | None = None,
    project_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rules.evaluate_org(db, user.organization_id, today())
    stmt = select(Flag).where(Flag.organization_id == user.organization_id, Flag.status == FlagStatus(state))
    if mine:
        stmt = stmt.where(Flag.owner_id == user.id)
    if rule:
        stmt = stmt.where(Flag.rule == rule)
    if project_id:
        stmt = stmt.where(Flag.project_id == project_id)
    flags = db.scalars(stmt).all()
    if state == "resolved":
        flags.sort(key=lambda f: f.resolved_at, reverse=True)
        flags = flags[:100]
    else:
        flags.sort(key=lambda f: (SEVERITY_RANK[f.severity.value], f.opened_at))
    counts = {}
    for f in db.scalars(select(Flag).where(Flag.organization_id == user.organization_id, Flag.status == FlagStatus.open)).all():
        counts[f.rule.value] = counts.get(f.rule.value, 0) + 1
    return {"items": [flag_out(f) for f in flags], "counts": counts, "evaluated_at": datetime.now(timezone.utc)}


@router.get("/{fid}/history")
def flag_history(fid: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from ..models import AuditEvent
    from ..schemas import AuditOut

    f = _get(db, fid, user)
    ids = [str(f.id), str(f.subject_id)]
    rows = db.scalars(select(AuditEvent).where(AuditEvent.subject_id.in_(ids)).order_by(AuditEvent.at.desc()).limit(30)).all()
    return [AuditOut.model_validate(r) for r in rows]


@router.post("/{fid}/resolve", response_model=FlagOut)
def resolve(fid: uuid.UUID, body: ResolveIn, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    f = _get(db, fid, user)
    if f.status == FlagStatus.resolved:
        raise HTTPException(status.HTTP_409_CONFLICT, "This flag is already resolved.")
    f.status, f.resolved_at, f.resolved_by_id, f.resolution_note = FlagStatus.resolved, datetime.now(timezone.utc), user.id, body.note
    log(db, user.organization_id, user.id, "flag_resolved", "flag", f.id, f"{user.full_name} resolved: {body.note}")
    db.commit()
    return flag_out(f)


@router.post("/{fid}/snooze", response_model=FlagOut)
def snooze(fid: uuid.UUID, body: SnoozeIn, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    f = _get(db, fid, user)
    if f.status == FlagStatus.resolved:
        raise HTTPException(status.HTTP_409_CONFLICT, "Resolved flags cannot be snoozed.")
    f.status, f.snoozed_until = FlagStatus.snoozed, today() + timedelta(days=body.days)
    log(db, user.organization_id, user.id, "flag_snoozed", "flag", f.id, f"Snoozed {body.days} days by {user.full_name}")
    db.commit()
    return flag_out(f)


@router.post("/{fid}/reassign", response_model=FlagOut)
def reassign(fid: uuid.UUID, body: ReassignIn, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    f = _get(db, fid, user)
    new_owner = db.get(User, body.owner_id)
    if not new_owner or new_owner.organization_id != user.organization_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Choose someone in your organization.")
    f.owner_id = new_owner.id
    if f.subject_type == "activity":  # the work moves with the flag
        a = db.get(Activity, f.subject_id)
        if a:
            a.owner_id = new_owner.id
            log(db, user.organization_id, user.id, "activity_reassigned", "activity", a.id, f"Reassigned to {new_owner.full_name}")
    log(db, user.organization_id, user.id, "flag_reassigned", "flag", f.id, f"Reassigned to {new_owner.full_name}")
    db.commit()
    return flag_out(f)


@router.post("/{fid}/follow-up", status_code=status.HTTP_201_CREATED)
def follow_up(fid: uuid.UUID, body: FollowUpIn, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    f = _get(db, fid, user)
    if f.subject_type == "commitment":
        commitment = db.get(Commitment, f.subject_id)
    else:
        src = db.get(Activity, f.subject_id)
        commitment = src.commitment if src else None
    if not commitment:
        raise HTTPException(status.HTTP_409_CONFLICT, "The item this flag was about no longer exists.")
    p = commitment.project
    if not (p.starts_on <= body.due_on <= p.ends_on):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Due date must fall inside the project dates.")
    a = Activity(commitment_id=commitment.id, title=body.title.strip(), due_on=body.due_on,
                 owner_id=body.owner_id or f.owner_id, notes=f"Follow-up to flag: {f.title}")
    db.add(a)
    db.flush()
    db.add(EvidenceRequirement(activity_id=a.id, kind=EvidenceKind.note, label="What was done", is_required=True, position=0))
    log(db, user.organization_id, user.id, "activity_created", "activity", a.id, f"Follow-up created from flag '{f.title}'")
    log(db, user.organization_id, user.id, "follow_up_added", "flag", f.id, f"Follow-up: {a.title}")
    db.commit()
    rules.evaluate_org(db, user.organization_id, today())
    return {"activity_id": str(a.id)}
