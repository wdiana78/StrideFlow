"""Spec-driven ERP modules.

Every module in modules.json becomes a real PostgreSQL table (prefixed m_) with proper foreign keys, plus
validated CRUD endpoints, a status workflow with role rules, computed fields, audit history and rules
that feed the Attention list. Adding a module is a JSON change plus an Alembic migration.
"""
import json
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Numeric, String, Table, Text, Uuid, and_, func, or_, select
from sqlalchemy.orm import Session

from .db import Base
from .models import FlagRule, FlagSeverity, JsonType, Project, Stakeholder, User

SPEC = json.loads((Path(__file__).parent / "modules.json").read_text())
MODULES = {m["key"]: m for m in SPEC["modules"]}
CORE_REFS = {
    "stakeholders": (Stakeholder.__table__, "name"),
    "projects": (Project.__table__, "name"),
    "users": (User.__table__, "full_name"),
}
TYPE_COLUMNS = {
    "text": lambda: String(500), "email": lambda: String(254), "textarea": lambda: Text(),
    "number": lambda: Numeric(14, 2), "money": lambda: Numeric(14, 2), "date": lambda: Date(),
    "select": lambda: String(40), "bool": lambda: Boolean(), "file": lambda: JsonType, "color": lambda: String(9),
}


def table_name(key: str) -> str:
    return f"m_{key}"


def _build_tables() -> dict[str, Table]:
    tables = {}
    for m in SPEC["modules"]:
        cols = [
            Column("id", Uuid, primary_key=True, default=uuid.uuid4),
            Column("organization_id", Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
            Column("created_by_id", Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            Column("created_at", DateTime(timezone=True), nullable=False),
            Column("updated_at", DateTime(timezone=True), nullable=False),
        ]
        if m.get("status"):
            cols.append(Column(m["status"]["field"], String(40), nullable=False, index=True))
        for f in m["fields"]:
            if f["type"] == "ref":
                target = f["ref"] if f["ref"] in CORE_REFS else table_name(f["ref"])
                cols.append(Column(f["key"], Uuid, ForeignKey(f"{target}.id", ondelete="RESTRICT" if f.get("required") else "SET NULL"),
                                   nullable=True, index=True))
            else:
                cols.append(Column(f["key"], TYPE_COLUMNS[f["type"]](), nullable=True))
        tables[m["key"]] = Table(table_name(m["key"]), Base.metadata, *cols)
    return tables


TABLES = _build_tables()


class ErpError(Exception):
    def __init__(self, status: int, message: str, field: str | None = None):
        super().__init__(message)
        self.status, self.message, self.field = status, message, field


def now():
    return datetime.now(timezone.utc)


def _plain(v):
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    if isinstance(v, uuid.UUID):
        return str(v)
    return v


def label_of(db: Session, ref: str, ids) -> dict:
    ids = [i for i in ids if i]
    if not ids:
        return {}
    if ref in CORE_REFS:
        t, col = CORE_REFS[ref]
    else:
        t, col = TABLES[ref], MODULES[ref].get("title_field", "id")
    return {str(r[0]): str(r[1]) if r[1] is not None else "" for r in db.execute(select(t.c.id, t.c[col]).where(t.c.id.in_(ids))).all()}


# ---------- computed fields ----------
def _computed(db: Session, key: str, ids: list) -> dict:
    if not ids:
        return {}
    out = {str(i): {} for i in ids}
    if key == "budget_lines":
        e, b = TABLES["expenses"], TABLES["budget_lines"]
        spent = dict(db.execute(select(e.c.budget_line_id, func.coalesce(func.sum(e.c.amount), 0))
                                .where(e.c.budget_line_id.in_(ids), e.c.status.in_(["approved", "paid"])).group_by(e.c.budget_line_id)).all())
        for bid, amount in db.execute(select(b.c.id, b.c.amount).where(b.c.id.in_(ids))).all():
            s, a = float(spent.get(bid, 0)), float(amount or 0)
            out[str(bid)] = {"spent": s, "remaining": a - s, "used_pct": round(s / a * 100, 1) if a else 0}
    elif key == "items":
        mv = TABLES["stock_moves"]
        rows = db.execute(select(mv.c.item_id, mv.c.direction, func.sum(mv.c.quantity)).where(mv.c.item_id.in_(ids))
                          .group_by(mv.c.item_id, mv.c.direction)).all()
        for i in ids:
            out[str(i)] = {"stock": 0.0}
        for item_id, direction, q in rows:
            out[str(item_id)]["stock"] += float(q) * (1 if direction == "in" else -1)
    elif key == "customers":
        inv = TABLES["invoices"]
        for i in ids:
            out[str(i)] = {"billed": 0.0, "outstanding": 0.0}
        for cid, status, amt in db.execute(select(inv.c.customer_id, inv.c.status, func.sum(inv.c.amount)).where(inv.c.customer_id.in_(ids))
                                           .group_by(inv.c.customer_id, inv.c.status)).all():
            if status != "void":
                out[str(cid)]["billed"] += float(amt)
            if status == "sent":
                out[str(cid)]["outstanding"] += float(amt)
    elif key == "volunteers":
        vh = TABLES["volunteer_hours"]
        for vid, h in db.execute(select(vh.c.volunteer_id, func.sum(vh.c.hours)).where(vh.c.volunteer_id.in_(ids)).group_by(vh.c.volunteer_id)).all():
            out[str(vid)] = {"hours": float(h)}
        for i in ids:
            out[str(i)].setdefault("hours", 0.0)
    return out


def serialize(db: Session, key: str, rows) -> list[dict]:
    m = MODULES[key]
    rows = [dict(r._mapping) for r in rows]
    labels = {}
    for f in m["fields"]:
        if f["type"] == "ref":
            labels[f["key"]] = label_of(db, f["ref"], {r[f["key"]] for r in rows})
    comp = _computed(db, key, [r["id"] for r in rows]) if m.get("computed") else {}
    users = label_of(db, "users", {r["created_by_id"] for r in rows})
    out = []
    for r in rows:
        d = {k: _plain(v) for k, v in r.items()}
        for fk, lab in labels.items():
            d[f"{fk}_label"] = lab.get(d.get(fk) or "", None)
        d["created_by_label"] = users.get(d.get("created_by_id") or "")
        d["_title"] = str(d.get(m.get("title_field")) or "") or m["singular"]
        d.update(comp.get(d["id"], {}))
        out.append(d)
    return out


# ---------- validation ----------
EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
SAFE_URL = re.compile(r"^(/files/[0-9a-f]{32}\.[a-z]{2,5}|)$")


def _coerce(db: Session, org_id, m: dict, f: dict, v):
    if v in (None, ""):
        return None
    t = f["type"]
    try:
        if t in ("number", "money"):
            v = float(v)
            if t == "money" and v < 0:
                raise ErpError(422, f"{f['label']} cannot be negative.", f["key"])
            if "min" in f and v < f["min"]:
                raise ErpError(422, f"{f['label']} must be at least {f['min']:g}.", f["key"])
            if "max" in f and v > f["max"]:
                raise ErpError(422, f"{f['label']} must be at most {f['max']:g}.", f["key"])
            return v
        if t == "date":
            return date.fromisoformat(str(v)[:10])
        if t == "bool":
            return bool(v)
        if t == "select":
            if str(v) not in [o[0] for o in f["options"]]:
                raise ErpError(422, f"Choose a valid {f['label'].lower()}.", f["key"])
            return str(v)
        if t == "email":
            if not EMAIL.match(str(v)):
                raise ErpError(422, "Enter a valid email address.", f["key"])
            return str(v).strip().lower()
        if t == "color":
            if not COLOR.match(str(v)):
                raise ErpError(422, f"{f['label']} must be a colour like #0E5E6F.", f["key"])
            return str(v).upper()
        if t == "file":
            # Only accept references to files this API stored, never arbitrary URLs (blocks javascript: and phishing links).
            if not isinstance(v, dict) or not v.get("url") or not SAFE_URL.match(str(v["url"])):
                raise ErpError(422, f"Upload a file for {f['label'].lower()}.", f["key"])
            return {"name": str(v.get("name", "file"))[:200], "url": str(v["url"]), "size": v.get("size")}
        if t == "ref":
            rid = uuid.UUID(str(v))
            target, _ = CORE_REFS[f["ref"]] if f["ref"] in CORE_REFS else (TABLES[f["ref"]], None)
            ok = db.execute(select(target.c.id).where(target.c.id == rid, target.c.organization_id == org_id)).first()
            if not ok:
                raise ErpError(422, f"Choose a {f['label'].lower()} from your organization.", f["key"])
            return rid
        v = str(v).strip()
        if t == "text" and len(v) > 500:
            raise ErpError(422, f"{f['label']} is too long.", f["key"])
        return v
    except (ValueError, TypeError):
        raise ErpError(422, f"{f['label']} is not valid.", f["key"])


def _validate(db: Session, org_id, m: dict, data: dict, existing: dict | None, record_id=None) -> dict:
    known = {f["key"]: f for f in m["fields"] if not f.get("hidden")}  # hidden fields are system-only: no mass assignment
    clean = {}
    for k, v in data.items():
        if k in known:
            clean[k] = _coerce(db, org_id, m, known[k], v)
    merged = {**(existing or {}), **clean}
    for f in known.values():
        if f.get("required") and merged.get(f["key"]) in (None, ""):
            raise ErpError(422, f"{f['label']} is required.", f["key"])
        if f.get("after") and merged.get(f["key"]) and merged.get(f["after"]) and merged[f["key"]] < merged[f["after"]]:
            raise ErpError(422, f"{f['label']} must be on or after {known[f['after']]['label'].lower()}.", f["key"])
        if f.get("unique") and f["key"] in clean and clean[f["key"]]:
            t = TABLES[m["key"]]
            q = select(t.c.id).where(t.c.organization_id == org_id, func.lower(t.c[f["key"]]) == str(clean[f["key"]]).lower())
            if record_id:
                q = q.where(t.c.id != record_id)
            if db.execute(q).first():
                raise ErpError(409, f"That {f['label'].lower()} is already used.", f["key"])
    ov = m.get("no_overlap")
    if ov and merged.get(ov["resource"]) and merged.get(ov["start"]) and merged.get(ov["end"]):
        t = TABLES[m["key"]]
        st = m.get("status")
        if not (st and existing and existing.get(st["field"]) in ov["ignore_status"]):
            q = select(t).where(t.c.organization_id == org_id, t.c[ov["resource"]] == merged[ov["resource"]],
                                t.c[ov["start"]] <= merged[ov["end"]], t.c[ov["end"]] >= merged[ov["start"]])
            if st:
                q = q.where(t.c[st["field"]].not_in(ov["ignore_status"]))
            if record_id:
                q = q.where(t.c.id != record_id)
            clash = db.execute(q).first()
            if clash:
                title = getattr(clash, m["title_field"])
                raise ErpError(409, f"Already booked by {title} from {clash._mapping[ov['start']].strftime('%d %b')} to {clash._mapping[ov['end']].strftime('%d %b')}. Choose other dates.", ov["start"])
    if m.get("single") and existing is None:
        t = TABLES[m["key"]]
        if db.execute(select(t.c.id).where(t.c.organization_id == org_id)).first():
            raise ErpError(409, f"{m['label']} already exist. Edit them instead.")
    return clean


# ---------- operations ----------
def _role_ok(user, roles):
    return user.role.value in roles


def list_records(db: Session, user, key: str, params: dict) -> dict:
    m, t = MODULES[key], TABLES[key]
    q = select(t).where(t.c.organization_id == user.organization_id)
    if params.get("q"):
        like = f"%{params['q'].strip()}%"
        cols = [t.c[f["key"]] for f in m["fields"] if f.get("search")]
        if cols:
            q = q.where(or_(*[c.ilike(like) for c in cols]))
    st = m.get("status")
    if st and params.get("status"):
        q = q.where(t.c[st["field"]] == params["status"])
    for f in m["fields"]:
        v = params.get(f["key"])
        if f.get("filter") and v not in (None, ""):
            if f["type"] == "bool":
                q = q.where(t.c[f["key"]] == (v in ("true", "1", True)))
            elif f["type"] == "ref":
                q = q.where(t.c[f["key"]] == (None if v == "none" else uuid.UUID(v)))
            elif f["type"] in ("text", "email"):
                q = q.where(t.c[f["key"]].ilike(f"%{v}%"))
            else:
                q = q.where(t.c[f["key"]] == v)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    sort = params.get("sort") or ("created_at" if not m.get("title_field") else None)
    valid = {f["key"] for f in m["fields"] if f["type"] not in ("file", "ref")} | {"created_at", "updated_at"} | ({st["field"]} if st else set())
    sort_col = t.c[sort] if sort in valid else t.c.created_at
    order = sort_col.asc() if params.get("dir") == "asc" else sort_col.desc()
    page, size = max(int(params.get("page", 1)), 1), min(max(int(params.get("page_size", 25)), 1), 200)
    rows = db.execute(q.order_by(order.nulls_last(), t.c.id).offset((page - 1) * size).limit(size)).all()
    return {"items": serialize(db, key, rows), "total": total, "page": page, "page_size": size}


def get_record(db: Session, user, key: str, rid) -> dict:
    t = TABLES[key]
    row = db.execute(select(t).where(t.c.id == rid, t.c.organization_id == user.organization_id)).first()
    if not row:
        raise ErpError(404, f"{MODULES[key]['singular']} not found.")
    return serialize(db, key, [row])[0]


def create_record(db: Session, user, key: str, data: dict, log) -> dict:
    m, t = MODULES[key], TABLES[key]
    if not _role_ok(user, m["create"]):
        raise ErpError(403, "Your role does not allow this action.")
    for f in m["fields"]:  # sensible defaults
        if f.get("default_me") and not data.get(f["key"]):
            data[f["key"]] = str(user.id)
    clean = _validate(db, user.organization_id, m, data, None)
    values = {**clean, "id": uuid.uuid4(), "organization_id": user.organization_id, "created_by_id": user.id, "created_at": now(), "updated_at": now()}
    if m.get("status"):
        values[m["status"]["field"]] = m["status"]["default"]
    db.execute(t.insert().values(**values))
    title = clean.get(m.get("title_field")) or m["singular"]
    log(db, user.organization_id, user.id, f"{key}_created", key, values["id"], f"{user.full_name} added {m['singular'].lower()}: {title}")
    db.commit()
    return get_record(db, user, key, values["id"])


def update_record(db: Session, user, key: str, rid, data: dict, log) -> dict:
    m, t = MODULES[key], TABLES[key]
    if not _role_ok(user, m["edit"]):
        raise ErpError(403, "Your role does not allow this action.")
    row = db.execute(select(t).where(t.c.id == rid, t.c.organization_id == user.organization_id)).first()
    if not row:
        raise ErpError(404, f"{m['singular']} not found.")
    existing = dict(row._mapping)
    clean = _validate(db, user.organization_id, m, data, existing, rid)
    changes = {k: [str(_plain(existing.get(k))), str(_plain(v))] for k, v in clean.items() if existing.get(k) != v}
    if changes:
        db.execute(t.update().where(t.c.id == rid).values(**clean, updated_at=now()))
        labels = {f["key"]: f["label"] for f in m["fields"]}
        log(db, user.organization_id, user.id, f"{key}_updated", key, rid,
            f"{user.full_name} changed " + ", ".join(labels.get(k, k).lower() for k in changes), changes)
        db.commit()
    return get_record(db, user, key, rid)


def delete_record(db: Session, user, key: str, rid, log):
    from sqlalchemy.exc import IntegrityError

    m, t = MODULES[key], TABLES[key]
    if not _role_ok(user, m["delete"]):
        raise ErpError(403, "Your role does not allow this action.")
    rec = get_record(db, user, key, rid)
    try:
        db.execute(t.delete().where(t.c.id == rid))
        log(db, user.organization_id, user.id, f"{key}_deleted", key, rid, f"{user.full_name} deleted {m['singular'].lower()}: {rec['_title']}")
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ErpError(409, f"Other records still use this {m['singular'].lower()}. Remove or reassign them first.")


def transition(db: Session, user, key: str, rid, to: str, note: str | None, log) -> dict:
    m, t = MODULES[key], TABLES[key]
    st = m.get("status")
    if not st:
        raise ErpError(400, "This record has no workflow.")
    row = db.execute(select(t).where(t.c.id == rid, t.c.organization_id == user.organization_id)).first()
    if not row:
        raise ErpError(404, f"{m['singular']} not found.")
    rec = dict(row._mapping)
    cur = rec[st["field"]]
    tr = next((x for x in st["transitions"] if x["to"] == to and cur in x["from"]), None)
    if not tr:
        raise ErpError(409, f"Cannot move from {dict(st['options']).get(cur, cur)} to {dict(st['options']).get(to, to)}.")
    if not _role_ok(user, tr["roles"]):
        raise ErpError(403, "Your role does not allow this step.")
    if tr.get("not_creator") and rec.get("created_by_id") == user.id:
        raise ErpError(403, "Someone else must approve what you submitted.")
    if tr.get("note") and not (note or "").strip():
        raise ErpError(422, "Add a short note explaining this.", "note")
    for need in tr.get("requires", []):
        if not rec.get(need):
            label = next(f["label"] for f in m["fields"] if f["key"] == need)
            raise ErpError(422, f"Set {label.lower()} first.", need)
    if key == "events" and to == "held" and rec.get("attended") is None:
        from .models import Form, FormSubmission  # attendance comes straight from the event's own form
        fid = db.scalar(select(Form.id).where(Form.event_id == rid))
        if fid:
            n = db.scalar(select(func.count()).select_from(FormSubmission).where(FormSubmission.form_id == fid))
            if n:
                db.execute(t.update().where(t.c.id == rid).values(attended=n))
                rec["attended"] = n
    for f in m["fields"]:
        if to in f.get("required_for", []) and not rec.get(f["key"]):
            raise ErpError(422, f"{f['label']} is required before this can be {dict(st['options'])[to].lower()}.", f["key"])
    db.execute(t.update().where(t.c.id == rid).values(**{st["field"]: to, "updated_at": now()}))
    if key == "donations" and to == "confirmed":
        post_donation_income(db, rec, user.id)
    if key == "invoices" and to == "paid":
        post_invoice_income(db, rec, user.id)
    labels = dict(st["options"])
    log(db, user.organization_id, user.id, f"{key}_{to}", key, rid,
        f"{user.full_name}: {labels.get(cur)} → {labels.get(to)}" + (f". Note: {note.strip()}" if note and note.strip() else ""),
        {st["field"]: [cur, to], "note": note})
    db.commit()
    return get_record(db, user, key, rid)


def options(db: Session, user, ref: str) -> list[dict]:
    if ref in CORE_REFS:
        t, col = CORE_REFS[ref]
        q = select(t.c.id, t.c[col]).where(t.c.organization_id == user.organization_id)
        if ref == "users":
            q = q.where(t.c.is_active.is_(True))
    else:
        t, col = TABLES[ref], MODULES[ref].get("title_field")
        q = select(t.c.id, t.c[col]).where(t.c.organization_id == user.organization_id)
    return [{"id": str(i), "label": str(lab or "")} for i, lab in db.execute(q.order_by(t.c[col])).all()]


def approvals(db: Session, user) -> list[dict]:
    out = []
    for key, m in MODULES.items():
        st = m.get("status")
        if not st:
            continue
        steps = [x for x in st["transitions"] if x.get("not_creator") and _role_ok(user, x["roles"])]
        if not steps:
            continue
        waiting = set().union(*[set(x["from"]) for x in steps])
        t = TABLES[key]
        rows = db.execute(select(t).where(t.c.organization_id == user.organization_id, t.c[st["field"]].in_(waiting),
                                          or_(t.c.created_by_id.is_(None), t.c.created_by_id != user.id)).order_by(t.c.created_at)).all()
        for r in serialize(db, key, rows):
            r["_module"] = key
            r["_actions"] = [{"to": x["to"], "label": x["label"], "note": bool(x.get("note"))} for x in steps if r[st["field"]] in x["from"]]
            out.append(r)
    return out


# ---------- rules feeding Attention ----------
def desired_flags(db: Session, org_id, today: date) -> dict:
    out = {}

    def put(rule, key, rid, severity, owner, title, detail, project_id=None, data=None):
        out[(FlagRule(rule), key, rid)] = dict(severity=FlagSeverity(severity), owner_id=owner, title=title, detail=detail,
                                               data=data or {}, project_id=project_id)

    b = TABLES["budget_lines"]
    lines = db.execute(select(b).where(b.c.organization_id == org_id)).all()
    comp = _computed(db, "budget_lines", [r.id for r in lines])
    for r in lines:
        c = comp[str(r.id)]
        if r.amount and c["spent"] > float(r.amount):
            put("over_budget", "budget_lines", r.id, "high", r.created_by_id, r.name,
                f"Spent {c['spent']:,.0f} of {float(r.amount):,.0f} budgeted ({c['used_pct']:g}%).", r.project_id, c)
        elif r.amount and c["used_pct"] >= 90:
            put("over_budget", "budget_lines", r.id, "medium", r.created_by_id, r.name,
                f"{c['used_pct']:g}% used: {c['remaining']:,.0f} left.", r.project_id, c)

    waited = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc) - timedelta(days=3)
    for key, field, waiting in (("expenses", "status", "submitted"), ("purchase_requests", "status", "submitted"), ("leave_requests", "status", "pending")):
        t = TABLES[key]
        for r in db.execute(select(t).where(t.c.organization_id == org_id, t.c[field] == waiting, t.c.created_at < waited)).all():
            days = (today - r.created_at.date()).days
            title = getattr(r, MODULES[key]["title_field"]) or MODULES[key]["singular"]
            if key == "leave_requests":
                title = f"{label_of(db, 'users', [r.user_id]).get(str(r.user_id), 'Staff')}: {r.kind} leave"
            put("approval_waiting", key, r.id, "medium", None, str(title), f"{MODULES[key]['singular']} waiting {days} days for approval.")

    inv = TABLES["invoices"]
    for r in db.execute(select(inv).where(inv.c.organization_id == org_id, inv.c.status == "sent", inv.c.due_on < today)).all():
        days = (today - r.due_on).days
        put("invoice_overdue", "invoices", r.id, "high" if days > 14 else "medium", r.created_by_id, f"Invoice {r.number}",
            f"KES {float(r.amount):,.0f} unpaid, {days} days past due.", r.project_id)

    d = TABLES["documents"]
    for r in db.execute(select(d).where(d.c.organization_id == org_id, d.c.expires_on.is_not(None), d.c.expires_on <= today + timedelta(days=30))).all():
        days = (r.expires_on - today).days
        put("expiring", "documents", r.id, "high" if days < 0 else "medium", r.owner_id, r.title,
            f"Expired {-days} days ago." if days < 0 else f"Expires in {days} days, on {r.expires_on.strftime('%d %b %Y')}.")

    items = TABLES["items"]
    rows = db.execute(select(items).where(items.c.organization_id == org_id)).all()
    stock = _computed(db, "items", [r.id for r in rows])
    for r in rows:
        s = stock[str(r.id)]["stock"]
        if r.reorder_level is not None and s <= float(r.reorder_level):
            put("low_stock", "items", r.id, "high" if s <= 0 else "medium", r.created_by_id, r.name,
                f"{s:g} {r.unit or ''} left; reorder at {float(r.reorder_level):g}.".replace("  ", " "))

    g = TABLES["grants"]
    for r in db.execute(select(g).where(g.c.organization_id == org_id, g.c.stage.in_(["awarded", "reporting"]),
                                        g.c.next_report_due.is_not(None), g.c.next_report_due <= today + timedelta(days=14))).all():
        days = (r.next_report_due - today).days
        put("report_due", "grants", r.id, "high" if days < 0 else "medium", r.owner_id, r.title,
            f"Report overdue by {-days} days." if days < 0 else f"Report due in {days} days, {r.next_report_due.strftime('%d %b')}.", r.project_id)
        if r.deadline is not None:
            pass
    for r in db.execute(select(g).where(g.c.organization_id == org_id, g.c.stage.in_(["prospect", "drafting"]),
                                        g.c.deadline.is_not(None), g.c.deadline <= today + timedelta(days=10))).all():
        days = (r.deadline - today).days
        put("report_due", "grants", r.id, "high" if days < 3 else "medium", r.owner_id, r.title,
            f"Application deadline passed {-days} days ago." if days < 0 else f"Application due in {days} days, {r.deadline.strftime('%d %b')}.", r.project_id)
    return out


def post_donation_income(db: Session, donation: dict, actor_id=None):
    """A confirmed donation becomes an Income record, so finance never re-types it."""
    inc = TABLES["income"]
    name = "Anonymous donor" if donation.get("anonymous") else donation.get("donor_name")
    method = donation.get("method") if donation.get("method") in ("mpesa", "bank", "cash") else "bank"
    db.execute(inc.insert().values(id=uuid.uuid4(), organization_id=donation["organization_id"], created_by_id=actor_id, created_at=now(), updated_at=now(),
                                   source=f"Donation: {name}", amount=donation["amount"], received_on=date.today(), method=method,
                                   reference=donation.get("reference"), notes=donation.get("message")))


def post_invoice_income(db: Session, inv: dict, actor_id=None):
    customer = label_of(db, "customers", [inv["customer_id"]]).get(str(inv["customer_id"]), "Customer")
    t = TABLES["income"]
    db.execute(t.insert().values(id=uuid.uuid4(), organization_id=inv["organization_id"], created_by_id=actor_id, created_at=now(), updated_at=now(),
                                 source=f"Invoice {inv['number']}: {customer}", amount=inv["amount"], received_on=date.today(), method="bank",
                                 reference=inv["number"], notes=inv.get("description")))


def require_app(user, key: str) -> None:
    app = MODULES[key].get("app")
    installed = set(user.organization.installed_apps or [])
    if app and app not in installed:
        from .apps import APPS
        name = next((a["name"] for a in APPS if a["key"] == app), app)
        raise ErpError(404, f"Install the {name} app to use this.")


def search(db: Session, user, q: str) -> list[dict]:
    """One search box across every installed app."""
    from .models import Activity, Commitment, Project
    like = f"%{q.strip()}%"
    installed = set(user.organization.installed_apps or [])
    out = []
    for key, m in MODULES.items():
        if m.get("app") not in installed:
            continue
        cols = [TABLES[key].c[f["key"]] for f in m["fields"] if f.get("search")]
        if not cols:
            continue
        t = TABLES[key]
        for r in db.execute(select(t).where(t.c.organization_id == user.organization_id, or_(*[c.ilike(like) for c in cols])).limit(5)).all():
            out.append({"kind": m["singular"], "app": m.get("app"), "title": str(getattr(r, m["title_field"]) or m["singular"]), "link": f"/app/m/{key}/{r.id}"})
    if "projects" in installed:
        for p in db.scalars(select(Project).where(Project.organization_id == user.organization_id, Project.name.ilike(like)).limit(5)).all():
            out.append({"kind": "Project", "app": "projects", "title": p.name, "link": f"/app/projects/{p.id}"})
        for a in db.scalars(select(Activity).join(Commitment).join(Project).where(Project.organization_id == user.organization_id, Activity.title.ilike(like)).limit(8)).all():
            out.append({"kind": "Activity", "app": "projects", "title": a.title, "link": f"/app/activities/{a.id}"})
    return out[:40]


def stats(db: Session, user, key: str, by: str, sum_field: str | None, params: dict) -> list[dict]:
    m, t = MODULES[key], TABLES[key]
    fields = {f["key"]: f for f in m["fields"]}
    st = m.get("status")
    if by not in fields and not (st and by == st["field"]):
        raise ErpError(422, "Choose a field to group by.")
    if sum_field and (sum_field not in fields or fields[sum_field]["type"] not in ("number", "money")):
        raise ErpError(422, "Choose a number field to add up.")
    q = select(t.c[by], func.count(), func.coalesce(func.sum(t.c[sum_field]), 0) if sum_field else func.count()).where(t.c.organization_id == user.organization_id)
    for f in m["fields"]:
        v = params.get(f["key"])
        if f.get("filter") and v not in (None, "") and f["key"] != by:
            q = q.where(t.c[f["key"]] == (uuid.UUID(v) if f["type"] == "ref" else (v in ("true", "1")) if f["type"] == "bool" else v))
    rows = db.execute(q.group_by(t.c[by])).all()
    f = fields.get(by)
    if f and f["type"] == "ref":
        labels = label_of(db, f["ref"], [r[0] for r in rows])
        lab = lambda v: labels.get(str(v), "None") if v else "None"  # noqa: E731
    elif f and f["type"] == "select":
        opts = dict(f["options"])
        lab = lambda v: opts.get(v, v or "None")  # noqa: E731
    elif f and f["type"] == "bool":
        lab = lambda v: "Yes" if v else "No"  # noqa: E731
    elif st and by == st["field"]:
        opts = dict(st["options"])
        lab = lambda v: opts.get(v, v)  # noqa: E731
    else:
        lab = lambda v: str(v) if v is not None else "None"  # noqa: E731
    out = [{"key": _plain(r[0]), "label": lab(r[0]), "count": int(r[1]), "sum": float(r[2])} for r in rows]
    return sorted(out, key=lambda r: -r["count"])
