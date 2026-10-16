"""Data collection and field tracking.

Build a form, collect responses in the app, on a public link or offline on a phone, and watch them arrive live.
Existing spreadsheets come in by CSV import or by syncing a published Google Sheet.
"""
import csv
import hashlib
import io
import re
import uuid
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import erp
from ..config import get_settings, today
from ..db import get_db
from ..deps import admin_only, can_manage, get_current_user
from ..hardening import check_upload, client_ip, rate_limit
from ..models import Form, FormSubmission, Organization, Project, Role, User
from ..services import files
from ..services.audit import log

router = APIRouter(tags=["data collection"])
public = APIRouter(prefix="/public/forms", tags=["public forms"])

TYPES = {"text", "textarea", "number", "select", "multi", "yesno", "rating", "date", "gps", "photo"}
FIELD_ID = re.compile(r"^[a-z0-9_]{1,40}$")
STORED_FILE = re.compile(r"^/files/[0-9a-f]{32}\.(jpg|jpeg|png|webp)$")
MAX_IMPORT_ROWS = 5000


class ShowIf(BaseModel):
    field: str
    equals: str


class FieldDef(BaseModel):
    id: str
    label: str = Field(min_length=1, max_length=200)
    type: str
    required: bool = False
    options: list[str] = Field(default_factory=list)
    min: float | None = None
    max: float | None = None
    show_if: ShowIf | None = None

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
    target: int | None = Field(default=None, ge=1, le=1_000_000)
    collect_gps: bool = False
    fields: list[FieldDef] = Field(min_length=1, max_length=60)

    @field_validator("fields")
    @classmethod
    def vfields(cls, v):
        ids = [f.id for f in v]
        if len(set(ids)) != len(ids):
            raise ValueError("Each question needs a different id.")
        seen = set()
        for f in v:
            if f.type in ("select", "multi") and len(f.options) < 2:
                raise ValueError(f"'{f.label}' needs at least two choices.")
            if f.show_if and f.show_if.field not in seen:
                raise ValueError(f"'{f.label}' can only depend on a question that comes before it.")
            seen.add(f.id)
        return v


def visible(f: dict, data: dict) -> bool:
    cond = f.get("show_if")
    if not cond:
        return True
    v = data.get(cond["field"])
    if isinstance(v, list):
        return cond["equals"] in v
    if isinstance(v, bool):
        return cond["equals"].lower() == ("yes" if v else "no")
    return str(v) == cond["equals"] if v is not None else False


def validate_answers(fields: list[dict], data: dict) -> dict:
    out = {}
    for f in fields:
        if not visible(f, {**data, **out}):
            continue  # skipped by skip logic: never stored, never required
        v = data.get(f["id"])
        empty = v is None or v == "" or v == [] or v == {}
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
                if isinstance(v, str):
                    v = v.strip().lower()
                if v not in (True, False, "yes", "no", "y", "n", "true", "false", "1", "0"):
                    raise ValueError
                v = v in (True, "yes", "y", "true", "1")
            elif t == "select":
                match = next((o for o in f["options"] if o.lower() == str(v).strip().lower()), None)
                if match is None:
                    raise ValueError
                v = match
            elif t == "multi":
                items = v if isinstance(v, list) else [x.strip() for x in str(v).split(";") if x.strip()]
                norm = {o.lower(): o for o in f["options"]}
                if any(x.lower() not in norm for x in items):
                    raise ValueError
                v = list(dict.fromkeys(norm[x.lower()] for x in items))
            elif t == "date":
                v = date.fromisoformat(str(v)[:10]).isoformat()
            elif t == "gps":
                v = parse_gps(v)
            elif t == "photo":
                if not isinstance(v, dict) or not STORED_FILE.match(str(v.get("url", ""))):
                    raise ValueError
                v = {"url": v["url"], "name": str(v.get("name", "photo"))[:120]}
        except (ValueError, TypeError):
            raise HTTPException(422, {"message": f"Check your answer to '{f['label']}'.", "field": f["id"]})
        out[f["id"]] = v
    return out


def parse_gps(v) -> dict:
    if isinstance(v, str):  # "lat, lng" from a spreadsheet
        parts = [p.strip() for p in v.replace(";", ",").split(",")]
        if len(parts) < 2:
            raise ValueError
        v = {"lat": parts[0], "lng": parts[1]}
    lat, lng = float(v["lat"]), float(v["lng"])
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise ValueError
    acc = v.get("accuracy")
    return {"lat": round(lat, 6), "lng": round(lng, 6), "accuracy": round(float(acc), 1) if acc not in (None, "") else None}


def _gps_from_fields(fields: list[dict], data: dict, explicit) -> dict | None:
    if explicit:
        try:
            return parse_gps(explicit)
        except (ValueError, TypeError, KeyError):
            raise HTTPException(422, "The location sent with this response is not valid.")
    for f in fields:
        if f["type"] == "gps" and data.get(f["id"]):
            return data[f["id"]]
    return None


def _form(db: Session, fid: uuid.UUID, user: User) -> Form:
    if "forms" not in (user.organization.installed_apps or []):
        raise HTTPException(404, "Install the Tazama app to use this.")
    f = db.get(Form, fid)
    if not f or f.organization_id != user.organization_id:
        raise HTTPException(404, "Form not found.")
    return f


def _out(db: Session, f: Form) -> dict:
    n = db.scalar(select(func.count()).select_from(FormSubmission).where(FormSubmission.form_id == f.id))
    last = db.scalar(select(func.max(FormSubmission.created_at)).where(FormSubmission.form_id == f.id))
    return {"id": str(f.id), "title": f.title, "description": f.description, "project_id": str(f.project_id) if f.project_id else None,
            "project_name": f.project.name if f.project else None, "event_id": str(f.event_id) if f.event_id else None, "is_public": f.is_public,
            "status": f.status, "fields": f.fields, "target": f.target, "collect_gps": f.collect_gps, "sheet_url": f.sheet_url,
            "sheet_synced_at": f.sheet_synced_at.isoformat() if f.sheet_synced_at else None,
            "responses": n, "last_response_at": last.isoformat() if last else None, "created_at": f.created_at.isoformat()}


def _sub_out(r: FormSubmission, names: dict) -> dict:
    return {"id": str(r.id), "data": r.data, "source": r.source, "collector": r.collector or names.get(str(r.submitted_by_id)),
            "submitted_by": names.get(str(r.submitted_by_id)), "location": r.location, "created_at": r.created_at.isoformat(),
            "captured_at": r.captured_at.isoformat() if r.captured_at else None}


def _check_project(db: Session, user: User, pid):
    if pid and not db.scalar(select(Project.id).where(Project.id == pid, Project.organization_id == user.organization_id)):
        raise HTTPException(422, "Choose a programme from your organization.")


@router.get("/forms")
def list_forms(event_id: uuid.UUID | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if "forms" not in (user.organization.installed_apps or []):
        raise HTTPException(404, "Install the Tazama app to use this.")
    q = select(Form).where(Form.organization_id == user.organization_id)
    if event_id:
        q = q.where(Form.event_id == event_id)
    return [_out(db, f) for f in db.scalars(q.order_by(Form.created_at.desc())).all()]


@router.post("/forms", status_code=201)
def create_form(body: FormIn, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    if "forms" not in (user.organization.installed_apps or []):
        raise HTTPException(404, "Install the Tazama app to use this.")
    _check_project(db, user, body.project_id)
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
    _check_project(db, user, body.project_id)
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
def submissions(fid: uuid.UUID, since: datetime | None = None, page: int = Query(1, ge=1), page_size: int = Query(1000, ge=1, le=5000),
                user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """With `since`, returns only responses that arrived after that moment, so a live view can poll cheaply."""
    f = _form(db, fid, user)
    q = select(FormSubmission).where(FormSubmission.form_id == f.id)
    if since:
        q = q.where(FormSubmission.created_at > since)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.scalars(q.order_by(FormSubmission.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    names = erp.label_of(db, "users", {r.submitted_by_id for r in rows})
    return {"total": total, "items": [_sub_out(r, names) for r in rows], "server_time": datetime.now(timezone.utc).isoformat()}


class SubmitIn(BaseModel):
    data: dict
    client_id: str | None = Field(default=None, max_length=80)
    collector: str | None = Field(default=None, max_length=120)
    location: dict | None = None
    captured_at: datetime | None = None
    website: str = ""


def _payload(body: dict) -> SubmitIn:
    # Older clients post the answers directly; newer ones wrap them with device metadata.
    return SubmitIn(**body) if isinstance(body.get("data"), dict) else SubmitIn(data=body)


def _save(db: Session, f: Form, p: SubmitIn, source: str, user: User | None) -> tuple[FormSubmission, bool]:
    if p.client_id:
        dup = db.scalar(select(FormSubmission).where(FormSubmission.form_id == f.id, FormSubmission.client_id == p.client_id))
        if dup:
            return dup, False  # the phone retried after a dropped connection: already have it
    data = validate_answers(f.fields, p.data)
    captured = p.captured_at if p.captured_at and p.captured_at <= datetime.now(timezone.utc) + timedelta(minutes=5) else None
    s = FormSubmission(form_id=f.id, organization_id=f.organization_id, data=data, source=source, submitted_by_id=user.id if user else None,
                       collector=(p.collector or "").strip()[:120] or (user.full_name if user else None), client_id=p.client_id,
                       location=_gps_from_fields(f.fields, data, p.location), captured_at=captured)
    db.add(s)
    return s, True


@router.post("/forms/{fid}/submissions", status_code=201)
def submit(fid: uuid.UUID, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == Role.viewer:
        raise HTTPException(403, "Viewers cannot submit responses.")
    f = _form(db, fid, user)
    if f.status != "open":
        raise HTTPException(409, "This form is not accepting responses.")
    s, created = _save(db, f, _payload(body), "app", user)
    db.commit()
    return {"id": str(s.id), "duplicate": not created}


@router.delete("/forms/{fid}/submissions/{sid}", status_code=204)
def delete_submission(fid: uuid.UUID, sid: uuid.UUID, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    f = _form(db, fid, user)
    s = db.get(FormSubmission, sid)
    if not s or s.form_id != f.id:
        raise HTTPException(404, "Response not found.")
    db.delete(s)
    log(db, user.organization_id, user.id, "form_response_deleted", "form", f.id, f"{user.full_name} deleted a response to '{f.title}'")
    db.commit()


# ---------- live tracker ----------
@router.get("/forms/{fid}/tracker")
def tracker(fid: uuid.UUID, by: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    f = _form(db, fid, user)
    rows = db.scalars(select(FormSubmission).where(FormSubmission.form_id == f.id).order_by(FormSubmission.created_at.desc())).all()
    t0 = today()
    day = lambda r: (r.captured_at or r.created_at).date()  # noqa: E731
    names = erp.label_of(db, "users", {r.submitted_by_id for r in rows})
    collector = lambda r: r.collector or names.get(str(r.submitted_by_id)) or "Public link"  # noqa: E731
    days = [(t0 - timedelta(days=i)) for i in range(13, -1, -1)]
    per_day = Counter(day(r) for r in rows)
    choice_fields = [x for x in f.fields if x["type"] in ("select", "yesno")]
    by = by if any(x["id"] == by for x in choice_fields) else (choice_fields[0]["id"] if choice_fields else None)
    breakdown = Counter()
    if by:
        for r in rows:
            v = r.data.get(by)
            if v is not None:
                breakdown["Yes" if v is True else "No" if v is False else str(v)] += 1
    week = sum(1 for r in rows if day(r) > t0 - timedelta(days=7))
    by_collector = Counter(collector(r) for r in rows)
    today_by = Counter(collector(r) for r in rows if day(r) >= t0)
    return {
        "server_time": datetime.now(timezone.utc).isoformat(), "total": len(rows), "today": sum(1 for r in rows if day(r) >= t0), "week": week,
        "target": f.target, "with_location": sum(1 for r in rows if r.location),
        "per_day": [{"date": d.isoformat(), "count": per_day.get(d, 0)} for d in days],
        "collectors": [{"name": n, "total": c, "today": today_by.get(n, 0)} for n, c in by_collector.most_common(12)],
        "by": by, "by_options": [{"id": x["id"], "label": x["label"]} for x in choice_fields],
        "breakdown": [{"label": k, "count": v} for k, v in breakdown.most_common(12)],
        "points": [{"lat": r.location["lat"], "lng": r.location["lng"], "collector": collector(r), "at": r.created_at.isoformat(),
                    "label": str(r.data.get(by)) if by and r.data.get(by) is not None else ""} for r in rows if r.location][:2000],
        "latest": [_sub_out(r, names) for r in rows[:12]],
    }


# ---------- import from a spreadsheet ----------
class BulkIn(BaseModel):
    rows: list[dict] = Field(min_length=1, max_length=MAX_IMPORT_ROWS)
    collector_column: str | None = None


@router.post("/forms/{fid}/import")
def bulk_import(fid: uuid.UUID, body: BulkIn, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    """Rows are already mapped to question ids by the browser. Valid rows are saved; the rest come back with reasons."""
    f = _form(db, fid, user)
    created, skipped, errors = 0, 0, []
    for i, row in enumerate(body.rows, start=1):
        key = "import:" + hashlib.sha1(repr(sorted(row.items())).encode(), usedforsecurity=False).hexdigest()
        try:
            p = SubmitIn(data={k: v for k, v in row.items() if not k.startswith("_")}, client_id=key, collector=row.get("_collector"))
            _, new = _save(db, f, p, "import", user)
            created += new
            skipped += not new
        except HTTPException as e:
            msg = e.detail["message"] if isinstance(e.detail, dict) else str(e.detail)
            errors.append({"row": i, "message": msg})
    log(db, user.organization_id, user.id, "form_imported", "form", f.id, f"{user.full_name} imported {created} responses into '{f.title}'")
    db.commit()
    return {"created": created, "skipped_duplicates": skipped, "errors": errors[:200], "failed": len(errors)}


# ---------- Google Sheets sync ----------
class SheetIn(BaseModel):
    url: str = Field(max_length=500)


def _sheet_csv_url(url: str) -> str:
    """Only Google Sheets links are fetched (no internal addresses), always as CSV."""
    u = urlparse(url.strip())
    if u.scheme != "https" or u.hostname != "docs.google.com" or not u.path.startswith("/spreadsheets/"):
        raise HTTPException(422, "Paste a Google Sheets link that starts with https://docs.google.com/spreadsheets/")
    m = re.match(r"^/spreadsheets/d/(e/)?([A-Za-z0-9_-]+)", u.path)
    if not m:
        raise HTTPException(422, "That does not look like a Google Sheets link.")
    gid = re.search(r"gid=(\d+)", url)
    if m.group(1):  # "Publish to web" link
        return f"https://docs.google.com/spreadsheets/d/e/{m.group(2)}/pub?output=csv" + (f"&gid={gid.group(1)}" if gid else "")
    return f"https://docs.google.com/spreadsheets/d/{m.group(2)}/export?format=csv" + (f"&gid={gid.group(1)}" if gid else "")


def map_columns(headers: list[str], fields: list[dict]) -> dict:
    norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())  # noqa: E731
    out = {}
    for h in headers:
        for f in fields:
            if norm(h) in (norm(f["id"]), norm(f["label"])):
                out[h] = f["id"]
                break
    return out


@router.put("/forms/{fid}/sheet")
def connect_sheet(fid: uuid.UUID, body: SheetIn, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    f = _form(db, fid, user)
    _sheet_csv_url(body.url)
    f.sheet_url = body.url.strip()
    log(db, user.organization_id, user.id, "form_sheet_connected", "form", f.id, f"{user.full_name} connected a Google Sheet to '{f.title}'")
    db.commit()
    return _out(db, f)


@router.post("/forms/{fid}/sheet-sync")
def sync_sheet(fid: uuid.UUID, request: Request, user: User = Depends(can_manage), db: Session = Depends(get_db)):
    rate_limit(f"sheet-sync:{fid}", 6, 60)
    f = _form(db, fid, user)
    if not f.sheet_url:
        raise HTTPException(409, "Connect a Google Sheet first.")
    url = _sheet_csv_url(f.sheet_url)
    try:
        with httpx.Client(timeout=15, follow_redirects=True, max_redirects=3) as c:
            r = c.get(url)
            final = urlparse(str(r.url)).hostname or ""
            if not (final == "docs.google.com" or final.endswith(".googleusercontent.com")):
                raise HTTPException(422, "The sheet link redirected somewhere unexpected.")
            if r.status_code != 200 or len(r.content) > 5 * 1024 * 1024:
                raise HTTPException(422, "Could not read the sheet. Check it is shared as 'Anyone with the link' or published to the web.")
            text = r.content.decode("utf-8-sig", errors="replace")
    except httpx.HTTPError:
        raise HTTPException(502, "Google Sheets did not respond. Try again in a minute.")
    reader = csv.DictReader(io.StringIO(text))
    mapping = map_columns(reader.fieldnames or [], f.fields)
    if not mapping:
        raise HTTPException(422, "No sheet columns match this form's questions. Use the question labels as column headers.")
    created = skipped = failed = 0
    for i, row in enumerate(reader):
        if i >= MAX_IMPORT_ROWS:
            break
        data = {mapping[h]: v for h, v in row.items() if h in mapping and v not in (None, "")}
        if not data:
            continue
        coll = next((row[h] for h in row if h and h.strip().lower() in ("collector", "enumerator", "collected by", "name of enumerator")), None)
        key = "sheet:" + hashlib.sha1(repr(sorted(row.items())).encode(), usedforsecurity=False).hexdigest()
        try:
            _, new = _save(db, f, SubmitIn(data=data, client_id=key, collector=coll), "sheet", user)
            created += new
            skipped += not new
        except HTTPException:
            failed += 1
    f.sheet_synced_at = datetime.now(timezone.utc)
    log(db, user.organization_id, user.id, "form_sheet_synced", "form", f.id, f"Google Sheet sync for '{f.title}': {created} new, {failed} could not be read")
    db.commit()
    return {"created": created, "skipped_duplicates": skipped, "failed": failed, "matched_columns": mapping, "synced_at": f.sheet_synced_at.isoformat()}


# ---------- public link (field teams without accounts) ----------
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
    return {"id": str(f.id), "title": f.title, "description": f.description, "fields": f.fields, "collect_gps": f.collect_gps,
            "organization": db.get(Organization, f.organization_id).name,
            "brand": {"primary": (site.brand_primary if site else None) or "#5B4CDB", "accent": (site.brand_accent if site else None) or "#18181B"}}


@public.post("/{fid}", status_code=201)
def public_submit(fid: uuid.UUID, body: dict, request: Request, db: Session = Depends(get_db)):
    rate_limit(f"public-form:{client_ip(request)}", 60, 600)  # a field phone may sync a backlog at once
    f = _public_form(db, fid)
    p = _payload(body)
    if p.website or body.get("website"):
        return {"ok": True}
    p.data.pop("website", None)
    s, created = _save(db, f, p, "public", None)
    db.commit()
    return {"ok": True, "id": str(s.id), "duplicate": not created}


@public.post("/{fid}/photo", status_code=201)
async def public_photo(fid: uuid.UUID, request: Request, file: UploadFile = File(...), db: Session = Depends(get_db)):
    rate_limit(f"public-photo:{client_ip(request)}", 30, 600)
    f = _public_form(db, fid)
    if not any(x["type"] == "photo" for x in f.fields):
        raise HTTPException(404, "This form does not take photos.")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        raise HTTPException(422, "Upload a JPG, PNG or WebP photo.")
    content = await file.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(413, "Photos must be 5 MB or smaller.")
    check_upload(ext, content)
    # Photos sent from a public form belong to the form's workspace and are private to it.
    name = files.save(db, content, ext, f.organization_id)
    db.commit()
    return {"name": Path(file.filename or "photo").name[:120], "url": f"/files/{name}"}
