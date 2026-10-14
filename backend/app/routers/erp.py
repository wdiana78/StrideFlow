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
from ..hardening import check_upload, client_ip, rate_limit
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


def _gate(key: str, user: User):
    _module(key)
    erp.require_app(user, key)


@router.get("/m/{key}")
def list_module(key: str, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _run(lambda: (_gate(key, user), erp.list_records(db, user, key, dict(request.query_params)))[1])


@router.post("/m/{key}", status_code=201)
def create_module(key: str, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _module(key)

    def go():
        erp.require_app(user, key)
        rec = erp.create_record(db, user, key, body, log)
        if key == "events":
            create_event_form(db, user, rec)
        rules.evaluate_org(db, user.organization_id, today())
        return rec
    return _run(go)


@router.get("/m/{key}/{rid}")
def get_module(key: str, rid: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _module(key)

    def go():
        erp.require_app(user, key)
        from ..models import AuditEvent
        from ..schemas import AuditOut

        rec = erp.get_record(db, user, key, rid)
        hist = db.scalars(select(AuditEvent).where(AuditEvent.organization_id == user.organization_id, AuditEvent.subject_id == str(rid))
                          .order_by(AuditEvent.at.desc(), AuditEvent.id.desc()).limit(40)).all()
        extra = {}
        if key == "events":
            from ..models import Form, FormSubmission
            f = db.scalar(select(Form).where(Form.event_id == rid))
            if f:
                extra["_form"] = {"id": str(f.id), "title": f.title, "is_public": f.is_public,
                                  "responses": db.scalar(select(func.count()).select_from(FormSubmission).where(FormSubmission.form_id == f.id))}
        return {**rec, **extra, "_history": [AuditOut.model_validate(h).model_dump(mode="json") for h in hist]}
    return _run(go)


@router.patch("/m/{key}/{rid}")
def update_module(key: str, rid: uuid.UUID, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _module(key)

    def go():
        erp.require_app(user, key)
        rec = erp.update_record(db, user, key, rid, body, log)
        rules.evaluate_org(db, user.organization_id, today())
        return rec
    return _run(go)


@router.delete("/m/{key}/{rid}", status_code=204)
def delete_module(key: str, rid: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _module(key)

    def go():
        erp.require_app(user, key)
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
        erp.require_app(user, key)
        rec = erp.transition(db, user, key, rid, body.to, body.note, log)
        rules.evaluate_org(db, user.organization_id, today())
        return rec
    return _run(go)


from ..apps import EVENT_FORM_FIELDS  # noqa: E402


def create_event_form(db: Session, user: User, event: dict):
    """Every event gets its own attendance and feedback form, with a public link, ready before the day."""
    from ..models import Form
    f = Form(organization_id=user.organization_id, event_id=uuid.UUID(event["id"]), project_id=uuid.UUID(event["project_id"]) if event.get("project_id") else None,
             title=f"{event['title']}: attendance and feedback", description="Takes one minute. No names needed.",
             fields=[{**x, "options": x.get("options", []), "min": None, "max": None} for x in EVENT_FORM_FIELDS], is_public=True, status="open", created_by_id=user.id)
    db.add(f)
    log(db, user.organization_id, user.id, "form_created", "events", event["id"], f"Attendance and feedback form created for {event['title']}")
    db.commit()
    return f


@router.post("/events/{eid}/form", status_code=201)
def add_event_form(eid: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from ..models import Form
    if user.role.value not in ("admin", "manager"):
        raise HTTPException(403, "Your role does not allow this action.")
    def go():
        erp.require_app(user, "events")
        ev = erp.get_record(db, user, "events", eid)
        existing = db.scalar(select(Form).where(Form.event_id == eid))
        f = existing or create_event_form(db, user, ev)
        return {"id": str(f.id)}
    return _run(go)


@router.get("/search")
def global_search(q: str, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rate_limit(f"search:{user.id}", 120, 60)
    if len(q.strip()) < 2:
        return []
    return erp.search(db, user, q[:80])


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
    content = await file.read(10 * 1024 * 1024 + 1)
    if not content:
        raise HTTPException(422, "That file is empty.")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(413, "Files must be 10 MB or smaller.")
    check_upload(ext, content)
    folder = Path(get_settings().upload_dir)
    folder.mkdir(parents=True, exist_ok=True)
    stored = f"{uuid.uuid4().hex}{ext}"
    (folder / stored).write_bytes(content)
    return {"name": Path(file.filename or "file").name[:200], "url": f"/files/{stored}", "size": len(content)}


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
    iv, it, bk = T["invoices"], T["items"], T["bookings"]
    stock = erp._computed(db, "items", [r.id for r in db.execute(select(it.c.id).where(it.c.organization_id == org)).all()])
    low = sum(1 for r in db.execute(select(it).where(it.c.organization_id == org)).all() if r.reorder_level is not None and stock[str(r.id)]["stock"] <= float(r.reorder_level))
    top_flags = [{"rule": f.rule.value, "title": f.title, "detail": f.detail, "severity": f.severity.value} for f in db.scalars(
        select(Flag).where(Flag.organization_id == org, Flag.status == FlagStatus.open).order_by(Flag.severity.desc(), Flag.opened_at).limit(6)).all()]
    return {
        "installed": user.organization.installed_apps or [], "industry": user.organization.industry, "top_flags": top_flags,
        "sales": {"outstanding": _sum(db, iv, "amount", iv.c.organization_id == org, iv.c.status == "sent"),
                  "paid": _sum(db, iv, "amount", iv.c.organization_id == org, iv.c.status == "paid"),
                  "overdue": db.scalar(select(func.count()).where(iv.c.organization_id == org, iv.c.status == "sent", iv.c.due_on < t0)),
                  "drafts": db.scalar(select(func.count()).where(iv.c.organization_id == org, iv.c.status == "draft"))},
        "inventory": {"items": len(stock), "low_stock": low, "units": sum(v["stock"] for v in stock.values())},
        "bookings": {"active": db.scalar(select(func.count()).where(bk.c.organization_id == org, bk.c.status.in_(["confirmed", "checked_in"]), bk.c.ends_on >= t0)),
                     "in_house": db.scalar(select(func.count()).where(bk.c.organization_id == org, bk.c.status == "checked_in")),
                     "value": _sum(db, bk, "amount", bk.c.organization_id == org, bk.c.status != "cancelled", bk.c.ends_on >= t0)},
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
    ss, sst, dn = T["site_services"], T["site_stories"], T["donations"]
    services = [{"title": r.title, "description": r.description, "icon": r.icon} for r in
                db.execute(select(ss).where(ss.c.organization_id == org_id, ss.c.published.is_(True)).order_by(ss.c.order, ss.c.title)).all()]
    proj_names = {str(p.id): p.name for p in db.scalars(select(Project).where(Project.organization_id == org_id)).all()}
    stories = [{"id": str(r.id), "title": r.title, "programme": proj_names.get(str(r.project_id)), "summary": r.summary, "body": r.body, "quote": r.quote,
                "quote_by": r.quote_by, "stat_value": r.stat_value, "stat_label": r.stat_label} for r in
               db.execute(select(sst).where(sst.c.organization_id == org_id, sst.c.published.is_(True)).order_by(sst.c.order, sst.c.title)).all()]
    raised = _sum(db, dn, "amount", dn.c.organization_id == org_id, dn.c.status == "confirmed")
    donors = db.scalar(select(func.count()).where(dn.c.organization_id == org_id, dn.c.status == "confirmed"))
    recent = [{"name": "Anonymous" if r.anonymous else r.donor_name.split()[0], "amount": float(r.amount)} for r in
              db.execute(select(dn).where(dn.c.organization_id == org_id, dn.c.status == "confirmed").order_by(dn.c.updated_at.desc()).limit(5)).all()]
    return {"organization": org.name, "slug": site.slug, "tagline": site.tagline, "intro": site.intro, "about": site.about,
            "mission": site.mission, "vision": site.vision, "founded": site.founded, "address": site.address,
            "brand": {"primary": site.brand_primary or "#0E5E6F", "accent": site.brand_accent or "#F2B33D"},
            "services": services, "stories": stories,
            "donations": {"campaign": site.donation_campaign, "goal": float(site.donation_goal or 0), "raised": raised, "donors": donors, "recent": recent},
            "projects": [{"id": k, "name": v} for k, v in proj_names.items()],
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
    website: str = ""  # honeypot


class InquiryIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    contact: str = Field(min_length=5, max_length=120)
    kind: str = "partner"
    message: str = Field(min_length=10, max_length=3000)
    website: str = ""  # honeypot


def _public_insert(db: Session, site, key: str, values: dict, summary: str):
    t = erp.TABLES[key]
    m = erp.MODULES[key]
    rid = uuid.uuid4()
    db.execute(t.insert().values(id=rid, organization_id=site.organization_id, created_by_id=None, created_at=erp.now(), updated_at=erp.now(),
                                 **{m["status"]["field"]: m["status"]["default"]}, **values))
    log(db, site.organization_id, None, f"{key}_created", key, rid, summary)
    db.commit()


@public.post("/{slug}/volunteer", status_code=201)
def volunteer_signup(slug: str, body: VolunteerIn, request: Request, db: Session = Depends(get_db)):
    rate_limit(f"public-volunteer:{client_ip(request)}", 10, 600)
    site = _site(db, slug)
    if body.website:
        return {"ok": True, "message": "Thank you. The team will call you within a week."}  # silently drop bots
    if body.interest not in {"health", "gps", "disability", "climate", "any"}:
        raise HTTPException(422, "Choose a programme.")
    _public_insert(db, site, "volunteers", {**body.model_dump(exclude={"website"}), "source": "website"}, f"Website: {body.name} applied to volunteer")
    return {"ok": True, "message": "Thank you. The team will call you within a week."}


@public.post("/{slug}/inquiry", status_code=201)
def inquiry(slug: str, body: InquiryIn, request: Request, db: Session = Depends(get_db)):
    rate_limit(f"public-inquiry:{client_ip(request)}", 10, 600)
    site = _site(db, slug)
    if body.website:
        return {"ok": True, "message": "Thank you. We have your message and will reply soon."}
    if body.kind not in {"partner", "donate", "media", "other"}:
        raise HTTPException(422, "Choose what your message is about.")
    _public_insert(db, site, "inquiries", body.model_dump(exclude={"website"}), f"Website: message from {body.name}")
    return {"ok": True, "message": "Thank you. We have your message and will reply soon."}


# ---------- donations (public) ----------
from ..services import payments  # noqa: E402


class DonationIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    contact: str = Field(min_length=5, max_length=120)
    amount: float = Field(ge=50, le=1_000_000)
    method: str = "mpesa"
    project_id: uuid.UUID | None = None
    anonymous: bool = False
    message: str = Field(default="", max_length=500)
    website: str = ""  # honeypot: real people never see or fill this


def _guard_public(request: Request, kind: str, slug: str, limit: int = 10):
    rate_limit(f"public-{kind}:{client_ip(request)}", limit, 600)


def _donation(db: Session, site, did: uuid.UUID, ref: str):
    t = erp.TABLES["donations"]
    row = db.execute(select(t).where(t.c.id == did, t.c.organization_id == site.organization_id)).first()
    # The reference acts as a receipt code: without it a donation cannot be looked up, so ids cannot be enumerated.
    if not row or row.reference != ref:
        raise HTTPException(404, "Donation not found.")
    return row


def _donation_out(row) -> dict:
    return {"id": str(row.id), "reference": row.reference, "status": row.status, "amount": float(row.amount), "method": row.method}


@public.post("/{slug}/donations", status_code=201)
def start_donation(slug: str, body: DonationIn, request: Request, db: Session = Depends(get_db)):
    _guard_public(request, "donate", slug)
    site = _site(db, slug)
    if body.website:
        raise HTTPException(422, "Something went wrong. Please try again.")
    if body.method not in ("mpesa", "card"):
        raise HTTPException(422, "Choose M-Pesa or card.")
    if body.project_id and not db.scalar(select(Project.id).where(Project.id == body.project_id, Project.organization_id == site.organization_id)):
        raise HTTPException(422, "Choose one of our programmes.")
    t = erp.TABLES["donations"]
    did = uuid.uuid4()
    ref = f"DN-{uuid.uuid4().hex[:8].upper()}"
    try:
        pay = payments.start_payment(body.method, body.contact, body.amount, ref)
    except ValueError as e:
        raise HTTPException(422, str(e))
    db.execute(t.insert().values(id=did, organization_id=site.organization_id, created_by_id=None, created_at=erp.now(), updated_at=erp.now(),
                                 donor_name=body.name.strip(), contact=body.contact.strip(), amount=body.amount, method=body.method,
                                 project_id=body.project_id, anonymous=body.anonymous, reference=ref, provider_ref=pay["provider_ref"],
                                 message=body.message.strip() or None, status="pending"))
    log(db, site.organization_id, None, "donations_created", "donations", did, f"Website: donation of {body.amount:,.0f} started ({body.method})")
    db.commit()
    return {"id": str(did), "reference": ref, "status": "pending", "mode": pay["mode"], "instructions": pay["instructions"]}


@public.get("/{slug}/donations/{did}")
def donation_status(slug: str, did: uuid.UUID, ref: str, request: Request, db: Session = Depends(get_db)):
    rate_limit(f"public-donation-status:{client_ip(request)}", 120, 600)
    return _donation_out(_donation(db, _site(db, slug), did, ref))


class SimulateIn(BaseModel):
    ref: str
    outcome: str = Field(pattern="^(success|cancel)$")


def _settle(db: Session, row, ok: bool, note: str):
    t = erp.TABLES["donations"]
    if row.status != "pending":
        return
    db.execute(t.update().where(t.c.id == row.id).values(status="confirmed" if ok else "failed", updated_at=erp.now()))
    if ok:
        erp.post_donation_income(db, dict(row._mapping))
    log(db, row.organization_id, None, f"donations_{'confirmed' if ok else 'failed'}", "donations", row.id, note)
    db.commit()


@public.post("/{slug}/donations/{did}/simulate")
def simulate_payment(slug: str, did: uuid.UUID, body: SimulateIn, request: Request, db: Session = Depends(get_db)):
    if get_settings().payments_mode != "sandbox":
        raise HTTPException(404, "Not found.")
    _guard_public(request, "simulate", slug, 20)
    site = _site(db, slug)
    row = _donation(db, site, did, body.ref)
    _settle(db, row, body.outcome == "success", f"Sandbox payment {'completed' if body.outcome == 'success' else 'cancelled'} for {row.reference}")
    return _donation_out(_donation(db, site, did, body.ref))


@router.post("/payments/mpesa/callback/{token}", include_in_schema=False)
def mpesa_callback(token: str, payload: dict, db: Session = Depends(get_db)):
    import hmac

    s = get_settings()
    if not s.mpesa_callback_token or not hmac.compare_digest(token, s.mpesa_callback_token):
        raise HTTPException(404, "Not found.")
    cb = payments.parse_mpesa_callback(payload)
    t = erp.TABLES["donations"]
    row = db.execute(select(t).where(t.c.provider_ref == cb["checkout_id"])).first()
    if row:
        ok = cb["ok"] and cb["amount"] is not None and abs(float(cb["amount"]) - float(row.amount)) < 1
        _settle(db, row, ok, f"M-Pesa {'confirmed, receipt ' + str(cb['receipt']) if ok else 'failed or amount mismatch'}")
    return {"ResultCode": 0, "ResultDesc": "Accepted"}


# ---------- grouped stats for charts ----------
@router.get("/m/{key}/stats")
def module_stats(key: str, by: str, request: Request, sum: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):  # noqa: A002
    _module(key)
    return _run(lambda: (erp.require_app(user, key), erp.stats(db, user, key, by, sum, dict(request.query_params)))[1])


# ---------- M&E analytics ----------
@router.get("/analytics")
def analytics(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org, t0, T = user.organization_id, today(), erp.TABLES
    series = []
    for p in db.scalars(select(Project).where(Project.organization_id == org, Project.status == ProjectStatus.active).order_by(Project.name)).all():
        for c in p.commitments:
            if c.measure.value != "sum":
                continue
            pts, d = [], p.starts_on
            while d < t0:
                pts.append({"date": d.isoformat(), "value": pace.actual_value(c, d)})
                d += timedelta(days=14)
            pts.append({"date": t0.isoformat(), "value": pace.actual_value(c, t0)})
            series.append({"programme": p.name, "title": c.title, "unit": c.unit, "target": float(c.target_value),
                           "start": p.starts_on.isoformat(), "due_on": c.due_on.isoformat(), "points": pts, "pace": pace.compute(c, t0).as_dict()})
    pt = T["participants"]

    def grp(col):
        return [{"label": str(k) if k is not None else "None", "count": n} for k, n in db.execute(
            select(pt.c[col], func.count()).where(pt.c.organization_id == org).group_by(pt.c[col]).order_by(func.count().desc())).all()]
    by_prog = [{"label": n or "None", "female": f, "male": m, "other": o} for n, f, m, o in db.execute(
        select(Project.name, func.count().filter(pt.c.gender == "female"), func.count().filter(pt.c.gender == "male"), func.count().filter(pt.c.gender == "other"))
        .select_from(pt).join(Project, Project.id == pt.c.project_id, isouter=True).where(pt.c.organization_id == org).group_by(Project.name)).all()]
    vh, e, b, ev = T["volunteer_hours"], T["expenses"], T["budget_lines"], T["events"]
    hours = [{"label": n or "Not linked", "value": float(h)} for n, h in db.execute(
        select(Project.name, func.sum(vh.c.hours)).select_from(vh).join(Project, Project.id == vh.c.project_id, isouter=True)
        .where(vh.c.organization_id == org).group_by(Project.name)).all()]
    spend = [{"label": c or "Other", "value": float(v)} for c, v in db.execute(
        select(b.c.category, func.sum(e.c.amount)).select_from(e).join(b, b.c.id == e.c.budget_line_id)
        .where(e.c.organization_id == org, e.c.status.in_(["approved", "paid"])).group_by(b.c.category)).all()]
    events = [{"title": r.title, "date": r.date.isoformat(), "expected": float(r.expected or 0), "attended": float(r.attended or 0)}
              for r in db.execute(select(ev).where(ev.c.organization_id == org, ev.c.status == "held").order_by(ev.c.date)).all()]
    disab = grp("disability")
    return {"today": t0.isoformat(), "series": series,
            "participants": {"gender": grp("gender"), "age_band": grp("age_band"), "ward": grp("ward"),
                             "disability": [{"label": "Yes" if d["label"] == "True" else "No", "count": d["count"]} for d in disab], "by_programme": by_prog},
            "volunteer_hours": hours, "spending_by_category": spend, "events": events}
