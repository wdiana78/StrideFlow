import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import admin_only, can_manage, get_current_user
from ..models import AuditEvent, Role, Stakeholder, Template, User
from ..schemas import AuditOut, InviteIn, StakeholderIn, StakeholderOut, TemplateOut, UserOut, UserUpdate
from ..hardening import check_password
from ..security import hash_password
from ..services.audit import log

router = APIRouter(tags=["organization"])


# ----- people -----
@router.get("/users", response_model=list[UserOut])
def list_users(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(User).where(User.organization_id == user.organization_id).order_by(User.full_name)).all()


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def invite_user(body: InviteIn, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    if db.scalar(select(User).where(func.lower(User.email) == body.email.lower())):
        raise HTTPException(status.HTTP_409_CONFLICT, "Someone already uses this email.")
    check_password(body.temporary_password, body.email, body.full_name)
    u = User(organization_id=admin.organization_id, full_name=body.full_name.strip(), email=body.email.lower(),
             password_hash=hash_password(body.temporary_password), role=body.role)
    db.add(u)
    db.flush()
    log(db, admin.organization_id, admin.id, "user_invited", "user", u.id, f"Added {u.full_name} as {u.role.value}")
    db.commit()
    return u


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: uuid.UUID, body: UserUpdate, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u or u.organization_id != admin.organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Person not found.")
    if u.id == admin.id and (body.role not in (None, Role.admin) or body.is_active is False):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot remove your own admin access.")
    changes = {}
    if body.role is not None and body.role != u.role:
        changes["role"] = [u.role.value, body.role.value]
        u.role = body.role
    if body.is_active is not None and body.is_active != u.is_active:
        changes["is_active"] = [u.is_active, body.is_active]
        u.is_active = body.is_active
    if changes:
        u.token_version = (u.token_version or 0) + 1  # new role or removed access takes effect immediately, not when the token expires
        log(db, admin.organization_id, admin.id, "user_updated", "user", u.id, f"Updated {u.full_name}", changes)
    db.commit()
    return u


# ----- stakeholders -----
@router.get("/stakeholders", response_model=list[StakeholderOut])
def list_stakeholders(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Stakeholder).where(Stakeholder.organization_id == user.organization_id).order_by(Stakeholder.name)).all()


@router.post("/stakeholders", response_model=StakeholderOut, status_code=status.HTTP_201_CREATED)
def create_stakeholder(body: StakeholderIn, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    s = Stakeholder(organization_id=user.organization_id, **body.model_dump())
    db.add(s)
    db.flush()
    log(db, user.organization_id, user.id, "stakeholder_created", "stakeholder", s.id, f"Added {s.name}")
    db.commit()
    return s


@router.put("/stakeholders/{sid}", response_model=StakeholderOut)
def update_stakeholder(sid: uuid.UUID, body: StakeholderIn, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    s = db.get(Stakeholder, sid)
    if not s or s.organization_id != user.organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stakeholder not found.")
    for k, v in body.model_dump().items():
        setattr(s, k, v)
    log(db, user.organization_id, user.id, "stakeholder_updated", "stakeholder", s.id, f"Updated {s.name}")
    db.commit()
    return s


@router.delete("/stakeholders/{sid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stakeholder(sid: uuid.UUID, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    s = db.get(Stakeholder, sid)
    if not s or s.organization_id != user.organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stakeholder not found.")
    log(db, user.organization_id, user.id, "stakeholder_deleted", "stakeholder", s.id, f"Removed {s.name}")
    db.delete(s)
    db.commit()


# ----- templates -----
@router.get("/templates", response_model=list[TemplateOut])
def list_templates(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Template).where(or_(Template.organization_id.is_(None), Template.organization_id == user.organization_id)).order_by(Template.name)
    ).all()


# ----- audit -----
@router.get("/audit")
def audit_log(page: int = Query(1, ge=1), page_size: int = Query(30, ge=1, le=100),
              admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    q = select(AuditEvent).where(AuditEvent.organization_id == admin.organization_id)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.scalars(q.order_by(AuditEvent.at.desc(), AuditEvent.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [AuditOut.model_validate(r) for r in rows], "total": total, "page": page, "page_size": page_size}
