import uuid
from datetime import date, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import erp
from ..config import get_settings, today
from ..db import get_db
from ..deps import get_current_user
from ..models import Activity, ActivityStatus, Commitment, Flag, FlagStatus, Organization, Project, ProjectStatus, Stakeholder, StakeholderKind, User
from ..services import pace, rules
from ..services.audit import log

router = APIRouter(tags=["erp"])
public = APIRouter(prefix="/public", tags=["public portfolio"])


def _module(key: str) -> dict:
    if key not in erp.MODULES:
        raise HTTPException(404, "Unknown module.")
    return erp.MODULES[key]


def _run(fn):
    try:
        return fn()
    except erp.ErpError as e:
        detail = e.message
        return JSONResponse(status_code=e.status, content={"detail": detail, "errors": [{"field": e.field, "message": detail}] if e.field else []})


class TransitionIn(BaseModel):
    to: str
    note: str | None = Field(default=None, max_length=2000)


@router.get("/modules")
def modules_spec(user: User = Depends(get_current_user)):
    return erp.SPEC


@router.get("/m/{key}")
def list_module(key: str, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _module(key)
    return _run(lambda: erp.list_records(db, user, key, dict(request.query_params)))


@router.post("/m/{key}", status_code=201)
def create_module(key: str, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _module(key)

    def go():
        rec = erp.create_record(db, user, key, body, log)
        rules.evaluate_org(db, user.organization_id, today())
        return rec
    return _run(go)


@router.get("/m/{key}/{rid}")
def get_module(key: str, rid: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _module(key)

    def go():
        from ..models import AuditEvent
        from ..schemas import AuditOut

        rec = erp.get_record(db, user, key, rid)
        hist = db.scalars(select(AuditEvent).where(AuditEvent.organization_id == user.organization_id, AuditEvent.subject_id == str(rid))
                          .order_by(AuditEvent.at.desc(), AuditEvent.id.desc()).limit(40)).all()
        return {**rec, "_history": [AuditOut.model_validate(h).model_dump(mode="json") for h in hist]}
    return _run(go)


@router.patch("/m/{key}/{rid}")
def update_module(key: str, rid: uuid.UUID, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _module(key)

    def go():
        rec = erp.update_record(db, user, key, rid, body, log)
        rules.evaluate_org(db, user.organization_id, today())
        return rec
    return _run(go)


@router.delete("/m/{key}/{rid}", status_code=204)
def delete_module(key: str, rid: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _module(key)

    def go():
        erp.delete_record(db, user, key, rid, log)
        db.query(Flag).filter(Flag.subject_id == rid).delete()
        db.commit()
        rules.evaluate_org(db, user.organization_id, today())
        return None
    out = _run(go)
    return out


@router.post("/m/{key}/{rid}/transition")
def transition_module(key: str, rid: uuid.UUID, body: TransitionIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _module(key)

    def go():
        rec = erp.transition(db, user, key, rid, body.to, body.note, log)
        rules.evaluate_org(db, user.organization_id, today())
        return rec
    return _run(go)


@router.get("/options/{ref}")
def ref_options(ref: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if ref not in erp.CORE_REFS and ref not in erp.MODULES:
        raise HTTPException(404, "Unknown list.")
    return erp.options(db, user, ref)


@router.get("/approvals")
def approvals(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return erp.approvals(db, user)


ALLOWED = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt"}


@router.post("/uploads", status_code=201)
async def upload(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(422, "Upload a photo, PDF, Word, Excel, CSV or text file.")
    content = await file.read()
    if not content:
        raise HTTPException(422, "That file is empty.")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(413, "Files must be 10 MB or smaller.")
    folder = Path(get_settings().upload_dir)
    folder.mkdir(parents=True, exist_ok=True)
    stored = f"{uuid.uuid4().hex}{ext}"
    (folder / stored).write_bytes(content)
    return {"name": file.filename, "url": f"/files/{stored}", "size": len(content)}


# ---------- organization overview ----------
def _sum(db, t, col, *where):
    return float(db.scalar(select(func.coalesce(func.sum(t.c[col]), 0)).where(*where)) or 0)


@router.get("/dashboard")
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org, t0 = user.organization_id, today()
    rules.evaluate_org(db, org, t0)
    T = erp.TABLES
    projects = db.scalars(select(Project).where(Project.organization_id == org, Project.status == ProjectStatus.active).order_by(Project.name)).all()
    programmes, statuses = [], []
    for p in projects:
        cs = [{"id": str(c.id), "title": c.title, "unit": c.unit, "due_on": c.due_on.isoformat(), "pace": pace.compute(c, t0).as_dict()} for c in p.commitments]
        statuses += [c["pace"]["status"] for c in cs]
        programmes.append({"id": str(p.id), "name": p.name, "commitments": cs})
    g, e, b, inc = T["grants"], T["expenses"], T["budget_lines"], T["income"]
    awarded = _sum(db, g, "amount", g.c.organization_id == org, g.c.stage.in_(["awarded", "reporting", "closed"]))
    pipeline = _sum(db, g, "amount", g.c.organization_id == org, g.c.stage.in_(["prospect", "drafting", "submitted"]))
    received = _sum(db, inc, "amount", inc.c.organization_id == org)
    spent = _sum(db, e, "amount", e.c.organization_id == org, e.c.status.in_(["approved", "paid"]))
    budget = _sum(db, b, "amount", b.c.organization_id == org)
    month_start = t0.replace(day=1)
    months = []
    for i in range(5, -1, -1):
        y, mth = month_start.year, month_start.month - i
        while mth <= 0:
            mth += 12
            y -= 1
        start = date(y, mth, 1)
        end = date(y + (mth == 12), (mth % 12) + 1, 1)
        months.append({"month": start.isoformat(), "spent": _sum(db, e, "amount", e.c.organization_id == org,
                                                                 e.c.status.in_(["approved", "paid"]), e.c.spent_on >= start, e.c.spent_on < end)})
    v, vh, pt, ev = T["volunteers"], T["volunteer_hours"], T["participants"], T["events"]
    by_gender = dict(db.execute(select(pt.c.gender, func.count()).where(pt.c.organization_id == org).group_by(pt.c.gender)).all())
    upcoming = erp.serialize(db, "events", db.execute(select(ev).where(ev.c.organization_id == org, ev.c.status == "planned", ev.c.date >= t0)
                                                      .order_by(ev.c.date).limit(6)).all())
    reports_due = erp.serialize(db, "grants", db.execute(select(g).where(g.c.organization_id == org, g.c.stage.in_(["awarded", "reporting"]),
                                                                         g.c.next_report_due.is_not(None)).order_by(g.c.next_report_due).limit(5)).all())
    open_flags = db.scalar(select(func.count()).select_from(Flag).where(Flag.organization_id == org, Flag.status == FlagStatus.open))
    return {
        "today": t0.isoformat(),
        "programmes": programmes,
        "commitments": {"total": len(statuses), "on_track": statuses.count("on_track") + statuses.count("done"),
                        "at_risk": statuses.count("at_risk"), "overdue": statuses.count("overdue")},
        "finance": {"awarded": awarded, "pipeline": pipeline, "received": received, "budget": budget, "spent": spent,
                    "used_pct": round(spent / budget * 100, 1) if budget else 0, "months": months},
        "people": {"volunteers_active": db.scalar(select(func.count()).where(v.c.organization_id == org, v.c.status == "active")),
                   "volunteer_applicants": db.scalar(select(func.count()).where(v.c.organization_id == org, v.c.status == "applicant")),
                   "hours_this_month": _sum(db, vh, "hours", vh.c.organization_id == org, vh.c.worked_on >= month_start),
                   "participants": sum(by_gender.values()), "participants_by_gender": by_gender},
        "open_flags": open_flags,
        "approvals_waiting": len(erp.approvals(db, user)),
        "upcoming_events": upcoming,
        "reports_due": reports_due,
    }


@router.get("/finance/summary")
def finance_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = user.organization_id
    g, b = erp.TABLES["grants"], erp.TABLES["budget_lines"]
    lines = erp.serialize(db, "budget_lines", db.execute(select(b).where(b.c.organization_id == org).order_by(b.c.name)).all())
    with_lines = {ln["grant_id"] for ln in lines if ln.get("grant_id")}
    grants = [gr for gr in erp.serialize(db, "grants", db.execute(select(g).where(g.c.organization_id == org).order_by(g.c.title)).all())
              if gr["id"] in with_lines or gr["stage"] in ("awarded", "reporting", "closed")]
    out = []
    for gr in grants + [{"id": None, "title": "Not linked to a grant", "amount": 0}]:
        ls = [ln for ln in lines if ln.get("grant_id") == gr["id"]]
        if not ls and gr["id"] is None:
            continue
        budget = sum(ln["amount"] or 0 for ln in ls)
        spent = sum(ln["spent"] for ln in ls)
        out.append({"grant": gr, "budget": budget, "spent": spent, "remaining": budget - spent,
                    "used_pct": round(spent / budget * 100, 1) if budget else 0, "lines": ls})
    return out


@router.get("/calendar")
def calendar(start: date, end: date, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if (end - start).days > 120:
        raise HTTPException(422, "Choose a range of up to four months.")
    org, T, items = user.organization_id, erp.TABLES, []
    ev = T["events"]
    for r in erp.serialize(db, "events", db.execute(select(ev).where(ev.c.organization_id == org, ev.c.date.between(start, end))).all()):
        items.append({"date": r["date"], "kind": "event", "title": r["title"], "detail": r.get("venue") or "", "status": r["status"], "link": f"/app/m/events/{r['id']}"})
    acts = db.scalars(select(Activity).join(Commitment).join(Project).where(Project.organization_id == org, Activity.due_on.between(start, end))).all()
    for a in acts:
        items.append({"date": a.due_on.isoformat(), "kind": "activity", "title": a.title, "detail": a.commitment.project.name,
                      "status": a.status.value, "link": f"/app/activities/{a.id}"})
    g = T["grants"]
    for r in erp.serialize(db, "grants", db.execute(select(g).where(g.c.organization_id == org, g.c.next_report_due.between(start, end))).all()):
        items.append({"date": r["next_report_due"], "kind": "report", "title": f"Report due: {r['title']}", "detail": r.get("funder_id_label") or "", "status": r["stage"], "link": f"/app/m/grants/{r['id']}"})
    for r in erp.serialize(db, "grants", db.execute(select(g).where(g.c.organization_id == org, g.c.deadline.between(start, end))).all()):
        items.append({"date": r["deadline"], "kind": "report", "title": f"Application deadline: {r['title']}", "detail": r.get("funder_id_label") or "", "status": r["stage"], "link": f"/app/m/grants/{r['id']}"})
    lv = T["leave_requests"]
    for r in erp.serialize(db, "leave_requests", db.execute(select(lv).where(lv.c.organization_id == org, lv.c.status != "declined", lv.c.starts_on <= end, lv.c.ends_on >= start)).all()):
        items.append({"date": max(r["starts_on"], start.isoformat()), "kind": "leave", "title": f"{r['user_id_label']} on leave to {r['ends_on']}", "detail": r["kind"], "status": r["status"], "link": f"/app/m/leave_requests/{r['id']}"})
    items.sort(key=lambda i: (i["date"], i["kind"]))
    return items


# ---------- public portfolio (no sign-in) ----------
def _site(db: Session, slug: str):
    s = erp.TABLES["site_settings"]
    row = db.execute(select(s).where(func.lower(s.c.slug) == slug.lower())).first()
    if not row:
        raise HTTPException(404, "This organization has no public page.")
    return row


@public.get("/{slug}")
def portfolio(slug: str, db: Session = Depends(get_db)):
    site = _site(db, slug)
    org_id, t0 = site.organization_id, today()
    org = db.get(Organization, org_id)
    T = erp.TABLES
    sp, st = T["site_programmes"], T["site_team"]
    programmes = []
    for r in db.execute(select(sp).where(sp.c.organization_id == org_id, sp.c.published.is_(True)).order_by(sp.c.order, sp.c.title)).all():
        results = []
        if site.show_impact and r.project_id:
            p = db.get(Project, r.project_id)
            results = [{"title": c.title, "unit": c.unit, "target": float(c.target_value), "actual": pace.compute(c, t0).actual} for c in p.commitments] if p else []
        programmes.append({"id": str(r.id), "title": r.title, "summary": r.summary, "focus": r.focus, "results": results})
    team = [{"name": r.name, "role": r.role, "bio": r.bio, "photo": r.photo} for r in
            db.execute(select(st).where(st.c.organization_id == org_id, st.c.published.is_(True)).order_by(st.c.order, st.c.name)).all()]
    partners = [s.name for s in db.scalars(select(Stakeholder).where(Stakeholder.organization_id == org_id, Stakeholder.kind == StakeholderKind.partner).order_by(Stakeholder.name)).all()]
    impact = None
    if site.show_impact:
        pt, ev, vh = T["participants"], T["events"], T["volunteer_hours"]
        evidence = 0
        for p in db.scalars(select(Project).where(Project.organization_id == org_id)).all():
            for c in p.commitments:
                evidence += sum(len(a.evidence) for a in c.activities)
        impact = {
            "people_reached": int(sum(pace.compute(c, t0).actual for p in db.scalars(select(Project).where(Project.organization_id == org_id)).all()
                                      for c in p.commitments if c.measure.value == "sum" and any(w in (c.unit or "") for w in ("people", "young", "youth", "participants", "educators", "leaders")))),
            "activities_done": db.scalar(select(func.count()).select_from(Activity).join(Commitment).join(Project)
                                         .where(Project.organization_id == org_id, Activity.status == ActivityStatus.done)),
            "events_held": db.scalar(select(func.count()).where(ev.c.organization_id == org_id, ev.c.status == "held")),
            "volunteer_hours": _sum(db, vh, "hours", vh.c.organization_id == org_id),
            "participants_registered": db.scalar(select(func.count()).where(pt.c.organization_id == org_id)),
            "evidence_items": evidence,
            "as_of": t0.isoformat(),
        }
    return {"organization": org.name, "slug": site.slug, "tagline": site.tagline, "intro": site.intro, "about": site.about,
            "location": site.location, "contact_email": site.contact_email, "phone": site.phone,
            "social": {"facebook": site.facebook, "twitter": site.twitter, "instagram": site.instagram},
            "programmes": programmes, "team": team, "partners": partners, "impact": impact}


class VolunteerIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=7, max_length=30)
    email: EmailStr | None = None
    ward: str = Field(default="", max_length=80)
    interest: str = "any"
    skills: str = Field(default="", max_length=300)


class InquiryIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    contact: str = Field(min_length=5, max_length=120)
    kind: str = "partner"
    message: str = Field(min_length=10, max_length=3000)


def _public_insert(db: Session, site, key: str, values: dict, summary: str):
    t = erp.TABLES[key]
    m = erp.MODULES[key]
    rid = uuid.uuid4()
    db.execute(t.insert().values(id=rid, organization_id=site.organization_id, created_by_id=None, created_at=erp.now(), updated_at=erp.now(),
                                 **{m["status"]["field"]: m["status"]["default"]}, **values))
    log(db, site.organization_id, None, f"{key}_created", key, rid, summary)
    db.commit()


@public.post("/{slug}/volunteer", status_code=201)
def volunteer_signup(slug: str, body: VolunteerIn, db: Session = Depends(get_db)):
    site = _site(db, slug)
    if body.interest not in {"health", "gps", "disability", "climate", "any"}:
        raise HTTPException(422, "Choose a programme.")
    _public_insert(db, site, "volunteers", {**body.model_dump(), "source": "website"}, f"Website: {body.name} applied to volunteer")
    return {"ok": True, "message": "Thank you. The team will call you within a week."}


@public.post("/{slug}/inquiry", status_code=201)
def inquiry(slug: str, body: InquiryIn, db: Session = Depends(get_db)):
    site = _site(db, slug)
    if body.kind not in {"partner", "donate", "media", "other"}:
        raise HTTPException(422, "Choose what your message is about.")
    _public_insert(db, site, "inquiries", body.model_dump(), f"Website: message from {body.name}")
    return {"ok": True, "message": "Thank you. We have your message and will reply soon."}
