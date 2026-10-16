import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..config import get_settings, today
from ..db import get_db
from ..deps import (
    WRITERS,
    can_manage,
    ensure_can_work_on,
    get_activity_in_org,
    get_commitment_in_org,
    get_current_user,
)
from ..models import (
    Activity,
    ActivityStatus,
    AuditEvent,
    Commitment,
    Evidence,
    EvidenceKind,
    EvidenceRequirement,
    Project,
    User,
)
from ..schemas import ActivityIn, ActivityOut, ActivityRow, ActivityUpdate, AuditOut, EvidenceIn, EvidenceOut
from ..services import pace, rules
from ..hardening import check_upload
from ..services import files
from ..services.audit import log

router = APIRouter(tags=["activities"])

MAX_UPLOAD = 10 * 1024 * 1024
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt"}


def _row(a: Activity) -> ActivityRow:
    have = {e.requirement_id for e in a.evidence}
    need = [r for r in a.requirements if r.is_required]
    c = a.commitment
    return ActivityRow(
        id=a.id, title=a.title, due_on=a.due_on, status=a.status, owner=a.owner, commitment_id=c.id,
        commitment_title=c.title, project_id=c.project_id, project_name=c.project.name,
        proof_have=sum(1 for r in need if r.id in have), proof_need=len(need),
    )


def activity_detail(db: Session, a: Activity) -> ActivityOut:
    history = db.scalars(
        select(AuditEvent).where(AuditEvent.subject_type == "activity", AuditEvent.subject_id == str(a.id))
        .order_by(AuditEvent.at.desc(), AuditEvent.id.desc()).limit(50)
    ).all()
    c = a.commitment
    return ActivityOut(
        id=a.id, title=a.title, notes=a.notes, due_on=a.due_on, status=a.status, completed_at=a.completed_at,
        completion_refused_at=a.completion_refused_at, owner=a.owner,
        depends_on={"id": str(a.depends_on.id), "title": a.depends_on.title, "status": a.depends_on.status.value,
                    "due_on": a.depends_on.due_on.isoformat()} if a.depends_on else None,
        commitment={"id": str(c.id), "title": c.title, "unit": c.unit, "pace": pace.compute(c, today()).as_dict()},
        project={"id": str(c.project.id), "name": c.project.name},
        requirements=a.requirements, evidence=[EvidenceOut.model_validate(e) for e in a.evidence],
        missing=rules.missing_requirements(a), history=[AuditOut.model_validate(h) for h in history],
    )


def _check_owner(db: Session, user: User, owner_id):
    if owner_id:
        o = db.get(User, owner_id)
        if not o or o.organization_id != user.organization_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Choose an owner from your organization.")


def _check_dependency(db: Session, a_project_id, activity_id, depends_on_id):
    if not depends_on_id:
        return
    if depends_on_id == activity_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "An activity cannot depend on itself.")
    dep = db.get(Activity, depends_on_id)
    if not dep or dep.commitment.project_id != a_project_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "It can only depend on an activity in the same project.")
    seen, cur = set(), dep
    while cur is not None:  # walk the chain to refuse cycles
        if cur.id == activity_id or cur.id in seen:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "That dependency would create a loop.")
        seen.add(cur.id)
        cur = cur.depends_on


@router.get("/activities")
def list_activities(
    project_id: uuid.UUID | None = None,
    commitment_id: uuid.UUID | None = None,
    owner: str | None = Query(None, description="'me' or a user id"),
    state: str = Query("open", pattern="^(open|done|all|overdue|blocked)$"),
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Activity).join(Commitment).join(Project).where(Project.organization_id == user.organization_id)
    if project_id:
        stmt = stmt.where(Commitment.project_id == project_id)
    if commitment_id:
        stmt = stmt.where(Activity.commitment_id == commitment_id)
    if owner == "me":
        stmt = stmt.where(Activity.owner_id == user.id)
    elif owner:
        try:
            stmt = stmt.where(Activity.owner_id == uuid.UUID(owner))
        except ValueError:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "owner must be 'me' or a user id.")
    if state == "open":
        stmt = stmt.where(Activity.status != ActivityStatus.done)
    elif state == "done":
        stmt = stmt.where(Activity.status == ActivityStatus.done)
    elif state == "overdue":
        stmt = stmt.where(Activity.status != ActivityStatus.done, Activity.due_on < today())
    elif state == "blocked":
        stmt = stmt.where(Activity.status == ActivityStatus.blocked)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Activity.title.ilike(like), Commitment.title.ilike(like)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(Activity.due_on, Activity.title).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [_row(a) for a in rows], "total": total, "page": page, "page_size": page_size}


@router.post("/activities", response_model=ActivityOut, status_code=status.HTTP_201_CREATED)
def create_activity(body: ActivityIn, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    c = get_commitment_in_org(db, body.commitment_id, user)
    _check_owner(db, user, body.owner_id)
    if not (c.project.starts_on <= body.due_on <= c.project.ends_on):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Due date must fall inside the project dates.")
    a = Activity(commitment_id=c.id, title=body.title.strip(), notes=body.notes, due_on=body.due_on, owner_id=body.owner_id)
    db.add(a)
    db.flush()
    _check_dependency(db, c.project_id, a.id, body.depends_on_id)
    a.depends_on_id = body.depends_on_id
    reqs = body.requirements
    if reqs is None and body.activity_type and c.project.template:
        types = {t["key"]: t for t in c.project.template.blueprint.get("activity_types", [])}
        t = types.get(body.activity_type)
        if not t:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown activity type for this template.")
        reqs = [{"kind": r["kind"], "label": r["label"], "is_required": r["required"], "counts_toward_target": r["counts"]}
                for r in t["requirements"]]
    for i, r in enumerate(reqs or []):
        data = r if isinstance(r, dict) else r.model_dump()
        db.add(EvidenceRequirement(activity_id=a.id, position=i, **data))
    log(db, user.organization_id, user.id, "activity_created", "activity", a.id, f"Created by {user.full_name}")
    db.commit()
    rules.evaluate_org(db, user.organization_id, today())
    db.refresh(a)
    return activity_detail(db, a)


@router.get("/activities/{aid}", response_model=ActivityOut)
def get_activity(aid: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return activity_detail(db, get_activity_in_org(db, aid, user))


@router.patch("/activities/{aid}", response_model=ActivityOut)
def update_activity(aid: uuid.UUID, body: ActivityUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a = get_activity_in_org(db, aid, user)
    ensure_can_work_on(a, user)
    data = body.model_dump(exclude_unset=True)
    if user.role not in WRITERS and set(data) - {"status", "notes"}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Members can change status and notes only.")
    if "owner_id" in data:
        _check_owner(db, user, data["owner_id"])
    if "depends_on_id" in data:
        _check_dependency(db, a.commitment.project_id, a.id, data["depends_on_id"])
    if "status" in data and a.status in (ActivityStatus.done, ActivityStatus.blocked):
        raise HTTPException(status.HTTP_409_CONFLICT, f"This activity is {a.status.value.replace('_', ' ')}; its status is managed for you.")
    changes = {}
    for k, v in data.items():
        old = getattr(a, k)
        if old != v and not (k == "status" and getattr(old, "value", old) == v):
            changes[k] = [str(getattr(old, "value", old)), str(v)]
            setattr(a, k, ActivityStatus(v) if k == "status" else v)
    if changes:
        log(db, user.organization_id, user.id, "activity_updated", "activity", a.id,
            f"{user.full_name} changed " + ", ".join(changes), changes)
    db.commit()
    rules.evaluate_org(db, user.organization_id, today())
    db.refresh(a)
    return activity_detail(db, a)


@router.delete("/activities/{aid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(aid: uuid.UUID, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    a = get_activity_in_org(db, aid, user)
    log(db, user.organization_id, user.id, "activity_deleted", "activity", a.id, f"Deleted {a.title}")
    for dependent in db.scalars(select(Activity).where(Activity.depends_on_id == a.id)).all():
        dependent.depends_on_id = None
    db.delete(a)
    db.commit()
    rules.evaluate_org(db, user.organization_id, today())


@router.post("/activities/{aid}/complete")
def complete_activity(aid: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a = get_activity_in_org(db, aid, user)
    ensure_can_work_on(a, user)
    if a.status == ActivityStatus.done:
        raise HTTPException(status.HTTP_409_CONFLICT, "This activity is already complete.")
    if a.depends_on and a.depends_on.status != ActivityStatus.done:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Finish '{a.depends_on.title}' first; this activity depends on it.")
    before = pace.compute(a.commitment, today())
    missing = rules.missing_requirements(a)
    if missing:
        a.completion_refused_at = datetime.now(timezone.utc)
        log(db, user.organization_id, user.id, "completion_refused", "activity", a.id,
            "Completion refused. Missing: " + ", ".join(missing))
        db.commit()
        rules.evaluate_org(db, user.organization_id, today())
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT,
                            {"message": "Attach the required proof before completing.", "missing": missing})
    a.status = ActivityStatus.done
    a.completed_at = datetime.now(timezone.utc)
    log(db, user.organization_id, user.id, "activity_completed", "activity", a.id, f"Marked complete by {user.full_name}")
    db.commit()
    result = rules.evaluate_org(db, user.organization_id, today())
    db.refresh(a)
    after = pace.compute(a.commitment, today())
    return {"activity": activity_detail(db, a), "pace_before": before.as_dict(), "pace_after": after.as_dict(),
            "flags_closed": result["closed"]}


@router.post("/activities/{aid}/reopen", response_model=ActivityOut)
def reopen_activity(aid: uuid.UUID, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    a = get_activity_in_org(db, aid, user)
    if a.status != ActivityStatus.done:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only completed activities can be reopened.")
    a.status, a.completed_at = ActivityStatus.in_progress, None
    log(db, user.organization_id, user.id, "activity_reopened", "activity", a.id, f"Reopened by {user.full_name}")
    db.commit()
    rules.evaluate_org(db, user.organization_id, today())
    db.refresh(a)
    return activity_detail(db, a)


# ----- evidence -----
def _requirement(a: Activity, requirement_id, kind: EvidenceKind) -> EvidenceRequirement | None:
    if requirement_id is None:
        return None
    r = next((r for r in a.requirements if r.id == requirement_id), None)
    if not r:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "That proof item does not belong to this activity.")
    if r.kind != kind:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"'{r.label}' expects a {r.kind.value}, not a {kind.value}.")
    return r


def _after_evidence(db: Session, a: Activity, user: User, summary: str):
    if a.status == ActivityStatus.not_started:
        a.status = ActivityStatus.in_progress
    log(db, user.organization_id, user.id, "evidence_added", "activity", a.id, summary)
    db.commit()
    rules.evaluate_org(db, user.organization_id, today())
    db.refresh(a)


@router.post("/activities/{aid}/evidence", response_model=ActivityOut, status_code=status.HTTP_201_CREATED)
def add_evidence(aid: uuid.UUID, body: EvidenceIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a = get_activity_in_org(db, aid, user)
    ensure_can_work_on(a, user)
    if a.status == ActivityStatus.done:
        raise HTTPException(status.HTTP_409_CONFLICT, "Reopen the activity before changing its proof.")
    kind = EvidenceKind(body.kind)
    r = _requirement(a, body.requirement_id, kind)
    existing = next((e for e in a.evidence if r and e.requirement_id == r.id), None)
    if existing:  # one value or note per proof item: replace it
        existing.value_number, existing.text = body.value_number, body.text
        existing.captured_by_id, existing.captured_at = user.id, datetime.now(timezone.utc)
    else:
        db.add(Evidence(activity_id=a.id, requirement_id=r.id if r else None, kind=kind,
                        value_number=body.value_number, text=body.text, captured_by_id=user.id))
    label = r.label if r else kind.value
    shown = f"{body.value_number:g}" if body.value_number is not None else "note"
    _after_evidence(db, a, user, f"{user.full_name} recorded {label}: {shown}")
    return activity_detail(db, a)


@router.post("/activities/{aid}/evidence/file", response_model=ActivityOut, status_code=status.HTTP_201_CREATED)
async def upload_evidence(
    aid: uuid.UUID,
    file: UploadFile = File(...),
    requirement_id: uuid.UUID | None = Form(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    a = get_activity_in_org(db, aid, user)
    ensure_can_work_on(a, user)
    if a.status == ActivityStatus.done:
        raise HTTPException(status.HTTP_409_CONFLICT, "Reopen the activity before changing its proof.")
    r = _requirement(a, requirement_id, EvidenceKind.file)
    ext = Path(file.filename or "").suffix.lower()
    content = await file.read(MAX_UPLOAD + 1)
    if len(content) > MAX_UPLOAD:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Files must be 10 MB or smaller.")
    if not content:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "That file is empty.")
    check_upload(ext, content)
    stored = files.save(db, content, ext, user.organization_id, user.id)
    db.add(Evidence(activity_id=a.id, requirement_id=r.id if r else None, kind=EvidenceKind.file,
                    file_name=Path(file.filename or "file").name[:200], file_url=f"/files/{stored}", file_size=len(content), captured_by_id=user.id))
    _after_evidence(db, a, user, f"{user.full_name} attached {file.filename}")
    return activity_detail(db, a)


@router.delete("/evidence/{eid}", response_model=ActivityOut)
def delete_evidence(eid: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    e = db.get(Evidence, eid)
    if not e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evidence not found.")
    a = get_activity_in_org(db, e.activity_id, user)
    ensure_can_work_on(a, user)
    if a.status == ActivityStatus.done:
        raise HTTPException(status.HTTP_409_CONFLICT, "Reopen the activity before removing its proof.")
    name = e.file_name or (e.requirement.label if e.requirement else e.kind.value)
    db.delete(e)
    log(db, user.organization_id, user.id, "evidence_removed", "activity", a.id, f"{user.full_name} removed {name}")
    db.commit()
    rules.evaluate_org(db, user.organization_id, today())
    db.refresh(a)
    return activity_detail(db, a)
