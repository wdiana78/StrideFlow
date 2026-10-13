import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..config import today
from ..db import get_db
from ..deps import admin_only, can_manage, get_commitment_in_org, get_current_user, get_project_in_org
from ..models import Commitment, Flag, FlagStatus, Measure, Project, ProjectStatus, Report, Stakeholder, Template, User
from ..schemas import (
    CommitmentIn,
    CommitmentOut,
    CommitmentUpdate,
    ProjectIn,
    ProjectListItem,
    ProjectOut,
    ProjectUpdate,
    ReportIn,
    ReportListItem,
    ReportOut,
)
from ..services import pace, rules
from ..services.audit import log
from ..services.reports import build_snapshot

router = APIRouter(tags=["projects"])


def commitment_out(c: Commitment) -> CommitmentOut:
    return CommitmentOut(
        id=c.id, project_id=c.project_id, title=c.title, unit=c.unit, measure=c.measure,
        target_value=float(c.target_value), due_on=c.due_on, stakeholder=c.stakeholder,
        pace=pace.compute(c, today()).as_dict(),
    )


def project_out(p: Project) -> ProjectOut:
    return ProjectOut(
        id=p.id, name=p.name, description=p.description, status=p.status, starts_on=p.starts_on, ends_on=p.ends_on,
        stakeholder=p.stakeholder, manager=p.manager, template=p.template,
        commitments=[commitment_out(c) for c in p.commitments],
    )


def _check_refs(db: Session, user: User, stakeholder_id=None, manager_id=None, template_id=None):
    if stakeholder_id:
        s = db.get(Stakeholder, stakeholder_id)
        if not s or s.organization_id != user.organization_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Choose a stakeholder from your organization.")
    if manager_id:
        m = db.get(User, manager_id)
        if not m or m.organization_id != user.organization_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Choose a manager from your organization.")
    if template_id:
        t = db.get(Template, template_id)
        if not t or (t.organization_id not in (None, user.organization_id)):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Template not found.")
        return t
    return None


def _check_commitment_dates(project: Project, due_on):
    if not (project.starts_on < due_on <= project.ends_on):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Due date must fall inside the project, {project.starts_on.isoformat()} to {project.ends_on.isoformat()}.",
        )


@router.get("/projects")
def list_projects(
    q: str | None = None,
    status_: ProjectStatus | None = Query(None, alias="status"),
    sort: str = Query("ends_on", pattern="^(name|ends_on|starts_on|attention)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Project).where(Project.organization_id == user.organization_id)
    if status_:
        stmt = stmt.where(Project.status == status_)
    else:
        stmt = stmt.where(Project.status != ProjectStatus.archived)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.outerjoin(Stakeholder, Project.stakeholder_id == Stakeholder.id).where(
            or_(Project.name.ilike(like), Stakeholder.name.ilike(like))
        )
    projects = db.scalars(stmt).all()
    open_counts = dict(
        db.execute(
            select(Flag.project_id, func.count()).where(Flag.organization_id == user.organization_id, Flag.status == FlagStatus.open)
            .group_by(Flag.project_id)
        ).all()
    )
    items = []
    t = today()
    for p in projects:
        statuses = [pace.compute(c, t).status for c in p.commitments]
        items.append(ProjectListItem(
            id=p.id, name=p.name, status=p.status, starts_on=p.starts_on, ends_on=p.ends_on,
            stakeholder=p.stakeholder, manager=p.manager, commitments_total=len(statuses),
            commitments_attention=sum(1 for s in statuses if s in ("at_risk", "overdue")),
            open_flags=open_counts.get(p.id, 0),
        ))
    key = {
        "name": lambda i: i.name.lower(),
        "ends_on": lambda i: i.ends_on,
        "starts_on": lambda i: i.starts_on,
        "attention": lambda i: (-i.open_flags, i.name.lower()),
    }[sort]
    items.sort(key=key)
    total = len(items)
    start = (page - 1) * page_size
    return {"items": items[start:start + page_size], "total": total, "page": page, "page_size": page_size}


@router.post("/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(body: ProjectIn, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    template = _check_refs(db, user, body.stakeholder_id, body.manager_id, body.template_id)
    p = Project(
        organization_id=user.organization_id, name=body.name.strip(), description=body.description,
        starts_on=body.starts_on, ends_on=body.ends_on, stakeholder_id=body.stakeholder_id,
        manager_id=body.manager_id or user.id, template_id=body.template_id,
    )
    db.add(p)
    db.flush()
    commitments = body.commitments
    if not commitments and template:
        commitments = [CommitmentIn(due_on=body.ends_on, **c) for c in template.blueprint.get("commitments", [])]
    for c in commitments:
        _check_commitment_dates(p, c.due_on)
        db.add(Commitment(project_id=p.id, stakeholder_id=c.stakeholder_id or body.stakeholder_id,
                          **c.model_dump(exclude={"stakeholder_id"})))
    log(db, user.organization_id, user.id, "project_created", "project", p.id, f"Created {p.name}")
    db.commit()
    db.refresh(p)
    rules.evaluate_org(db, user.organization_id, today())
    return project_out(p)


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return project_out(get_project_in_org(db, project_id, user))


@router.patch("/projects/{project_id}", response_model=ProjectOut)
def update_project(project_id: uuid.UUID, body: ProjectUpdate, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    p = get_project_in_org(db, project_id, user)
    data = body.model_dump(exclude_unset=True)
    _check_refs(db, user, data.get("stakeholder_id"), data.get("manager_id"))
    new_start, new_end = data.get("starts_on", p.starts_on), data.get("ends_on", p.ends_on)
    if new_end <= new_start:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The end date must be after the start date.")
    changes = {}
    for k, v in data.items():
        old = getattr(p, k)
        if old != v:
            changes[k] = [str(old), str(v)]
            setattr(p, k, v)
    if changes:
        log(db, user.organization_id, user.id, "project_updated", "project", p.id, f"Updated {p.name}", changes)
    db.commit()
    rules.evaluate_org(db, user.organization_id, today())
    db.refresh(p)
    return project_out(p)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: uuid.UUID, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    p = get_project_in_org(db, project_id, user)
    log(db, user.organization_id, user.id, "project_deleted", "project", p.id, f"Deleted {p.name}")
    db.query(Flag).filter(Flag.project_id == p.id).delete()
    db.delete(p)
    db.commit()


# ----- commitments -----
@router.post("/projects/{project_id}/commitments", response_model=CommitmentOut, status_code=status.HTTP_201_CREATED)
def add_commitment(project_id: uuid.UUID, body: CommitmentIn, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    p = get_project_in_org(db, project_id, user)
    _check_refs(db, user, body.stakeholder_id)
    _check_commitment_dates(p, body.due_on)
    c = Commitment(project_id=p.id, stakeholder_id=body.stakeholder_id or p.stakeholder_id, **body.model_dump(exclude={"stakeholder_id"}))
    db.add(c)
    db.flush()
    log(db, user.organization_id, user.id, "commitment_created", "commitment", c.id, f"Added commitment {c.title}")
    db.commit()
    rules.evaluate_org(db, user.organization_id, today())
    db.refresh(c)
    return commitment_out(c)


@router.patch("/commitments/{cid}", response_model=CommitmentOut)
def update_commitment(cid: uuid.UUID, body: CommitmentUpdate, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    c = get_commitment_in_org(db, cid, user)
    data = body.model_dump(exclude_unset=True)
    if "due_on" in data:
        _check_commitment_dates(c.project, data["due_on"])
    changes = {k: [str(getattr(c, k)), str(v)] for k, v in data.items() if getattr(c, k) != v}
    for k, v in data.items():
        setattr(c, k, v)
    if changes:
        log(db, user.organization_id, user.id, "commitment_updated", "commitment", c.id, f"Updated {c.title}", changes)
    db.commit()
    rules.evaluate_org(db, user.organization_id, today())
    db.refresh(c)
    return commitment_out(c)


@router.delete("/commitments/{cid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_commitment(cid: uuid.UUID, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    c = get_commitment_in_org(db, cid, user)
    log(db, user.organization_id, user.id, "commitment_deleted", "commitment", c.id, f"Deleted {c.title}")
    db.delete(c)
    db.commit()
    rules.evaluate_org(db, user.organization_id, today())


# ----- reports -----
@router.post("/projects/{project_id}/reports", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def generate_report(project_id: uuid.UUID, body: ReportIn, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    p = get_project_in_org(db, project_id, user)
    rules.evaluate_org(db, user.organization_id, today())
    snap = build_snapshot(db, p, body.period_start, body.period_end, today())
    snap["organization"] = user.organization.name
    snap["generated_by"] = user.full_name
    r = Report(project_id=p.id, period_start=body.period_start, period_end=body.period_end, generated_by_id=user.id, snapshot=snap)
    db.add(r)
    db.flush()
    log(db, user.organization_id, user.id, "report_generated", "report", r.id,
        f"Report for {p.name}, {body.period_start} to {body.period_end}")
    db.commit()
    db.refresh(r)
    return r


@router.get("/projects/{project_id}/reports", response_model=list[ReportListItem])
def project_reports(project_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = get_project_in_org(db, project_id, user)
    return db.scalars(select(Report).where(Report.project_id == p.id).order_by(Report.created_at.desc())).all()


@router.get("/reports", response_model=list[ReportListItem])
def all_reports(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Report).join(Project).where(Project.organization_id == user.organization_id).order_by(Report.created_at.desc())
    ).all()


@router.get("/reports/{report_id}", response_model=ReportOut)
def get_report(report_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = db.get(Report, report_id)
    if not r or r.project.organization_id != user.organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found.")
    return r
