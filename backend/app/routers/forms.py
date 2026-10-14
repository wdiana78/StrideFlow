"""Data collection: build a form, collect responses in the app or through a public link, analyse them."""
import re
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import admin_only, can_manage, get_current_user
from ..hardening import client_ip, rate_limit
from ..models import Form, FormSubmission, Project, Role, User
from ..services.audit import log
from .. import erp

router = APIRouter(tags=["data collection"])
public = APIRouter(prefix="/public/forms", tags=["public forms"])

TYPES = {"text", "textarea", "number", "select", "multi", "yesno", "rating", "date"}
FIELD_ID = re.compile(r"^[a-z0-9_]{1,40}$")


class FieldDef(BaseModel):
    id: str
    label: str = Field(min_length=1, max_length=200)
    type: str
    required: bool = False
    options: list[str] = Field(default_factory=list)
    min: float | None = None
    max: float | None = None

    @field_validator("id")
    @classmethod
    def vid(cls, v):
        if not FIELD_ID.match(v):
            raise ValueError("Question ids use lowercase letters, numbers and underscores.")
        return v

    @field_validator("type")
    @classmethod
    def vtype(cls, v):
        if v not in TYPES:
            raise ValueError("Unknown question type.")
        return v

    @field_validator("options")
    @classmethod
    def vopts(cls, v):
        if len(v) > 30 or any(len(o) > 100 or not o.strip() for o in v):
            raise ValueError("Up to 30 choices of up to 100 characters.")
        return [o.strip() for o in v]


class FormIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=2000)
    project_id: uuid.UUID | None = None
    is_public: bool = False
    status: str = Field(default="open", pattern="^(draft|open|closed)$")
    fields: list[FieldDef] = Field(min_length=1, max_length=60)

    @field_validator("fields")
    @classmethod
    def vfields(cls, v):
        ids = [f.id for f in v]
        if len(set(ids)) != len(ids):
            raise ValueError("Each question needs a different id.")
        for f in v:
            if f.type in ("select", "multi") and len(f.options) < 2:
                raise ValueError(f"'{f.label}' needs at least two choices.")
        return v


def validate_answers(fields: list[dict], data: dict) -> dict:
    out = {}
    for f in fields:
        v = data.get(f["id"])
        empty = v is None or v == "" or v == []
        if empty:
            if f.get("required"):
                raise HTTPException(422, {"message": f"Answer '{f['label']}'.", "field": f["id"]})
            continue
        t = f["type"]
        try:
            if t in ("text", "textarea"):
                v = str(v).strip()[: 200 if t == "text" else 4000]
            elif t == "number":
                v = float(v)
                if (f.get("min") is not None and v < f["min"]) or (f.get("max") is not None and v > f["max"]):
                    raise ValueError
            elif t == "rating":
                v = int(v)
                if not 1 <= v <= 5:
                    raise ValueError
            elif t == "yesno":
                if v not in (True, False, "yes", "no"):
                    raise ValueError
                v = v in (True, "yes")
            elif t == "select":
                if v not in f["options"]:
                    raise ValueError
            elif t == "multi":
                if not isinstance(v, list) or any(x not in f["options"] for x in v):
                    raise ValueError
                v = list(dict.fromkeys(v))
            elif t == "date":
                v = date.fromisoformat(str(v)[:10]).isoformat()
        except (ValueError, TypeError):
            raise HTTPException(422, {"message": f"Check your answer to '{f['label']}'.", "field": f["id"]})
        out[f["id"]] = v
    return out


def _need_forms_app(user: User):
    if "forms" not in (user.organization.installed_apps or []):
        raise HTTPException(404, "Install the Data collection app to use this.")


def _form(db: Session, fid: uuid.UUID, user: User) -> Form:
    _need_forms_app(user)
    f = db.get(Form, fid)
    if not f or f.organization_id != user.organization_id:
        raise HTTPException(404, "Form not found.")
    return f


def _out(db: Session, f: Form) -> dict:
    n = db.scalar(select(func.count()).select_from(FormSubmission).where(FormSubmission.form_id == f.id))
    last = db.scalar(select(func.max(FormSubmission.created_at)).where(FormSubmission.form_id == f.id))
    return {"id": str(f.id), "title": f.title, "description": f.description, "project_id": str(f.project_id) if f.project_id else None,
            "project_name": f.project.name if f.project else None, "event_id": str(f.event_id) if f.event_id else None, "is_public": f.is_public, "status": f.status, "fields": f.fields,
            "responses": n, "last_response_at": last.isoformat() if last else None, "created_at": f.created_at.isoformat()}


@router.get("/forms")
def list_forms(event_id: uuid.UUID | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _need_forms_app(user)
    q = select(Form).where(Form.organization_id == user.organization_id)
    if event_id:
        q = q.where(Form.event_id == event_id)
    return [_out(db, f) for f in db.scalars(q.order_by(Form.created_at.desc())).all()]


def _unused_list_forms(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return [_out(db, f) for f in db.scalars(select(Form).where(Form.organization_id == user.organization_id).order_by(Form.created_at.desc())).all()]


@router.post("/forms", status_code=201)
def create_form(body: FormIn, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    _need_forms_app(user)
    if body.project_id and not db.scalar(select(Project.id).where(Project.id == body.project_id, Project.organization_id == user.organization_id)):
        raise HTTPException(422, "Choose a programme from your organization.")
    f = Form(organization_id=user.organization_id, created_by_id=user.id, **body.model_dump(exclude={"fields"}), fields=[x.model_dump() for x in body.fields])
    db.add(f)
    db.flush()
    log(db, user.organization_id, user.id, "form_created", "form", f.id, f"{user.full_name} created form '{f.title}'")
    db.commit()
    return _out(db, f)


@router.get("/forms/{fid}")
def get_form(fid: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _out(db, _form(db, fid, user))


@router.put("/forms/{fid}")
def update_form(fid: uuid.UUID, body: FormIn, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    f = _form(db, fid, user)
    if body.project_id and not db.scalar(select(Project.id).where(Project.id == body.project_id, Project.organization_id == user.organization_id)):
        raise HTTPException(422, "Choose a programme from your organization.")
    for k, v in body.model_dump(exclude={"fields"}).items():
        setattr(f, k, v)
    f.fields = [x.model_dump() for x in body.fields]
    log(db, user.organization_id, user.id, "form_updated", "form", f.id, f"{user.full_name} updated form '{f.title}'")
    db.commit()
    return _out(db, f)


@router.delete("/forms/{fid}", status_code=204)
def delete_form(fid: uuid.UUID, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    f = _form(db, fid, user)
    log(db, user.organization_id, user.id, "form_deleted", "form", f.id, f"{user.full_name} deleted form '{f.title}' and its responses")
    db.delete(f)
    db.commit()


@router.get("/forms/{fid}/submissions")
def submissions(fid: uuid.UUID, page: int = Query(1, ge=1), page_size: int = Query(1000, ge=1, le=5000),
                user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    f = _form(db, fid, user)
    q = select(FormSubmission).where(FormSubmission.form_id == f.id)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.scalars(q.order_by(FormSubmission.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    names = erp.label_of(db, "users", {r.submitted_by_id for r in rows})
    return {"total": total, "items": [{"id": str(r.id), "data": r.data, "source": r.source, "submitted_by": names.get(str(r.submitted_by_id)),
                                       "created_at": r.created_at.isoformat()} for r in rows]}


@router.post("/forms/{fid}/submissions", status_code=201)
def submit(fid: uuid.UUID, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == Role.viewer:
        raise HTTPException(403, "Viewers cannot submit responses.")
    f = _form(db, fid, user)
    if f.status != "open":
        raise HTTPException(409, "This form is not accepting responses.")
    s = FormSubmission(form_id=f.id, organization_id=f.organization_id, data=validate_answers(f.fields, body), source="app", submitted_by_id=user.id)
    db.add(s)
    db.commit()
    return {"id": str(s.id)}


@router.delete("/forms/{fid}/submissions/{sid}", status_code=204)
def delete_submission(fid: uuid.UUID, sid: uuid.UUID, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    f = _form(db, fid, user)
    s = db.get(FormSubmission, sid)
    if not s or s.form_id != f.id:
        raise HTTPException(404, "Response not found.")
    db.delete(s)
    log(db, user.organization_id, user.id, "form_response_deleted", "form", f.id, f"{user.full_name} deleted a response to '{f.title}'")
    db.commit()


def _public_form(db: Session, fid: uuid.UUID) -> Form:
    f = db.get(Form, fid)
    if not f or not f.is_public or f.status != "open":
        raise HTTPException(404, "This form is not available.")
    return f


@public.get("/{fid}")
def public_form(fid: uuid.UUID, db: Session = Depends(get_db)):
    f = _public_form(db, fid)
    st = erp.TABLES["site_settings"]
    site = db.execute(select(st).where(st.c.organization_id == f.organization_id)).first()
    from ..models import Organization
    return {"id": str(f.id), "title": f.title, "description": f.description, "fields": f.fields, "organization": db.get(Organization, f.organization_id).name,
            "brand": {"primary": (site.brand_primary if site else None) or "#2C3D9B", "accent": (site.brand_accent if site else None) or "#F2B33D"}}


@public.post("/{fid}", status_code=201)
def public_submit(fid: uuid.UUID, body: dict, request: Request, db: Session = Depends(get_db)):
    rate_limit(f"public-form:{client_ip(request)}", 20, 600)
    f = _public_form(db, fid)
    if body.pop("website", ""):
        return {"ok": True}
    db.add(FormSubmission(form_id=f.id, organization_id=f.organization_id, data=validate_answers(f.fields, body), source="public"))
    db.commit()
    return {"ok": True}
