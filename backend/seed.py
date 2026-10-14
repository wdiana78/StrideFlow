"""Load fictional demo data. Safe to re-run: it deletes the two demo organizations first.

    python seed.py

Every person and organization here is invented. Demo password for all accounts: kept-demo-2026
"""
import json
import uuid
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

from sqlalchemy import delete, select

from app.config import today
from app.db import SessionLocal
from app.models import (
    Activity,
    ActivityStatus,
    Commitment,
    Evidence,
    EvidenceKind,
    EvidenceRequirement,
    Measure,
    Organization,
    Project,
    Role,
    Stakeholder,
    StakeholderKind,
    Template,
    User,
)
from app.security import hash_password
from app.services import rules
from app.services.audit import log
from app.templates_builtin import ensure_builtin_templates

PASSWORD = "kept-demo-2026"
DEMO_ORGS = ["Tumaini Community Network", "Mwangaza Creative Studio", "Timiza Youth Initiative", "Hatua Shoes", "Pwani Coast Stays"]


def at(d: date, hour=15) -> datetime:
    return datetime.combine(d, time(hour, 0), tzinfo=timezone.utc)


class Builder:
    def __init__(self, db, org, template):
        self.db, self.org = db, org
        self.types = {t["key"]: t for t in template.blueprint["activity_types"]}

    def activity(self, c, title, due, owner, kind, status=ActivityStatus.not_started, values=None, files=None,
                 notes=None, done_on=None, depends_on=None, refused_on=None):
        a = Activity(commitment_id=c.id, title=title, due_on=due, owner_id=owner.id, status=status,
                     depends_on_id=depends_on.id if depends_on else None)
        self.db.add(a)
        self.db.flush()
        reqs = {}
        for i, r in enumerate(self.types[kind]["requirements"]):
            req = EvidenceRequirement(activity_id=a.id, kind=EvidenceKind(r["kind"]), label=r["label"],
                                      is_required=r["required"], counts_toward_target=r["counts"], position=i)
            self.db.add(req)
            reqs[r["label"]] = req
        self.db.flush()
        when = at(done_on or min(due, today()))
        for label, v in (values or {}).items():
            self.db.add(Evidence(activity_id=a.id, requirement_id=reqs[label].id, kind=EvidenceKind.value,
                                 value_number=v, captured_by_id=owner.id, captured_at=when))
        for label, fname in (files or {}).items():
            self.db.add(Evidence(activity_id=a.id, requirement_id=reqs[label].id, kind=EvidenceKind.file,
                                 file_name=fname, file_url=None, file_size=240_000, captured_by_id=owner.id, captured_at=when))
        for label, text in (notes or {}).items():
            self.db.add(Evidence(activity_id=a.id, requirement_id=reqs[label].id, kind=EvidenceKind.note,
                                 text=text, captured_by_id=owner.id, captured_at=when))
        if status == ActivityStatus.done:
            a.completed_at = at(done_on or due, 17)
        if refused_on:
            a.completion_refused_at = at(refused_on, 16)
            log(self.db, self.org.id, owner.id, "completion_refused", "activity", a.id,
                "Completion refused. Missing: " + ", ".join(k for k, r in reqs.items() if r.is_required and k not in (values or {}) and k not in (files or {}) and k not in (notes or {})))
        log(self.db, self.org.id, owner.id, "activity_created", "activity", a.id, "Created from template")
        return a


def seed():
    db = SessionLocal()
    ensure_builtin_templates(db)
    for name in DEMO_ORGS:
        org = db.scalar(select(Organization).where(Organization.name == name))
        if org:
            db.execute(delete(Organization).where(Organization.id == org.id))
    db.commit()

    community = db.scalar(select(Template).where(Template.key == "community_programme", Template.organization_id.is_(None)))
    client_t = db.scalar(select(Template).where(Template.key == "client_engagement", Template.organization_id.is_(None)))

    # ---------------- Tumaini Community Network ----------------
    org = Organization(name="Tumaini Community Network", sector="Community development", currency="KES")
    db.add(org)
    db.flush()
    pw = hash_password(PASSWORD)

    def person(name, email, role):
        u = User(organization_id=org.id, full_name=name, email=email, password_hash=pw, role=role)
        db.add(u)
        return u

    admin = person("Grace Nduta", "admin@tumaini.example", Role.admin)
    achieng = person("Achieng Otieno", "achieng@tumaini.example", Role.manager)
    brian = person("Brian Mutua", "brian@tumaini.example", Role.member)
    faith = person("Faith Wanjiru", "faith@tumaini.example", Role.member)
    kevin = person("Kevin Kiprop", "kevin@tumaini.example", Role.member)
    person("Board Observer", "viewer@tumaini.example", Role.viewer)
    ubuntu = Stakeholder(organization_id=org.id, name="Ubuntu Futures Fund", kind=StakeholderKind.funder, contact_email="grants@ubuntufutures.example")
    nuru = Stakeholder(organization_id=org.id, name="Nuru Youth Foundation", kind=StakeholderKind.funder)
    agro = Stakeholder(organization_id=org.id, name="Mavuno Agro Supplies", kind=StakeholderKind.supplier)
    db.add_all([ubuntu, nuru, agro])
    db.flush()
    b = Builder(db, org, community)

    wa = Project(organization_id=org.id, template_id=community.id, stakeholder_id=ubuntu.id, manager_id=achieng.id,
                 name="Women in Agribusiness, Machakos", starts_on=date(2026, 8, 1), ends_on=date(2026, 12, 31),
                 description="Training, inputs and savings groups for 120 women farmers in four Machakos groups.")
    db.add(wa)
    db.flush()
    C = lambda **k: Commitment(project_id=wa.id, stakeholder_id=ubuntu.id, **k)  # noqa: E731
    train = C(title="Train 120 women in agribusiness", unit="women", measure=Measure.sum, target_value=120, due_on=date(2026, 11, 6))
    kits = C(title="Seed kits to 80 households", unit="households", measure=Measure.sum, target_value=80, due_on=date(2026, 11, 13))
    groups = C(title="Establish 6 savings groups", unit="groups", measure=Measure.sum, target_value=6, due_on=date(2026, 11, 27))
    review = C(title="Mid-term learning review", unit="parts", measure=Measure.activities, target_value=3, due_on=date(2026, 10, 10))
    db.add_all([train, kits, groups, review])
    db.flush()

    b.activity(train, "Recruit and register participants", date(2026, 8, 10), achieng, "task", ActivityStatus.done, done_on=date(2026, 8, 9))
    sessions = [("Session 1, Kangundo group", date(2026, 8, 15), 8, brian), ("Session 2, Matuu group", date(2026, 8, 29), 14, faith),
                ("Session 3, Mwala group", date(2026, 9, 5), 8, kevin), ("Session 4, Kangundo group", date(2026, 9, 19), 9, brian),
                ("Session 5, Yatta group", date(2026, 9, 19), 7, faith), ("Session 6, Matuu group", date(2026, 9, 26), 6, faith),
                ("Session 7, Mwala group", date(2026, 10, 3), 7, kevin), ("Session 8, Yatta group", date(2026, 10, 9), 5, faith)]
    for title, d, n, who in sessions:
        b.activity(train, title, d, who, "training_session", ActivityStatus.done, done_on=d,
                   values={"Attendance count": n}, files={"Signed attendance sheet": f"{title.split(',')[0].lower().replace(' ', '-')}-signin.jpg"})
    b.activity(train, "Session 9, Kangundo group", date(2026, 10, 11), brian, "training_session", ActivityStatus.in_progress,
               values={"Attendance count": 21}, done_on=date(2026, 10, 11), refused_on=date(2026, 10, 11),
               notes={"Session note": "Covered post-harvest storage. Three participants asked for a follow-up on hermetic bags."})
    venue = b.activity(train, "Book venue for Kangundo session", date(2026, 10, 12), brian, "task")
    b.activity(train, "Field visit, Matuu group", date(2026, 10, 16), faith, "field_visit")
    b.activity(train, "Session 10, Kangundo group", date(2026, 10, 28), brian, "training_session", depends_on=venue)
    b.activity(train, "Session 11, Matuu group", date(2026, 11, 3), faith, "training_session")

    for i, (d, n) in enumerate([(date(2026, 8, 22), 20), (date(2026, 9, 12), 22), (date(2026, 10, 2), 20)], start=1):
        b.activity(kits, f"Seed kits, batch {i}", d, faith, "distribution", ActivityStatus.done, done_on=d,
                   values={"Households reached": n}, files={"Delivery note": f"delivery-note-batch-{i}.pdf"})
    b.activity(kits, "Purchase seed kits, batch 4", date(2026, 10, 14), achieng, "purchase", ActivityStatus.in_progress,
               values={"Amount spent": 184000}, done_on=date(2026, 10, 9), refused_on=date(2026, 10, 9))
    b.activity(kits, "Seed kits, batch 4", date(2026, 10, 20), faith, "distribution")

    for i, (name, d) in enumerate([("Kangundo", date(2026, 8, 28)), ("Matuu", date(2026, 9, 10)),
                                    ("Yatta", date(2026, 9, 24)), ("Mwala", date(2026, 10, 6))], start=1):
        b.activity(groups, f"Register {name} savings group", d, kevin, "registration", ActivityStatus.done, done_on=d,
                   values={"Groups registered": 1}, files={"Registration certificate": f"{name.lower()}-certificate.pdf"})
    b.activity(groups, "Register Kivaani savings group", date(2026, 10, 24), kevin, "registration", ActivityStatus.in_progress,
               values={"Groups registered": 1}, done_on=date(2026, 10, 12))
    b.activity(groups, "Register Ekalakala savings group", date(2026, 11, 20), kevin, "registration")

    b.activity(review, "Baseline comparison", date(2026, 9, 30), achieng, "deliverable", ActivityStatus.done,
               done_on=date(2026, 9, 29), files={"Final document": "baseline-comparison.pdf"})
    b.activity(review, "Focus group summary", date(2026, 10, 10), achieng, "deliverable")
    b.activity(review, "Participant survey", date(2026, 10, 10), achieng, "deliverable")

    yd = Project(organization_id=org.id, template_id=community.id, stakeholder_id=nuru.id, manager_id=achieng.id,
                 name="Youth Digital Skills, Mlolongo", starts_on=date(2026, 9, 1), ends_on=date(2026, 12, 20),
                 description="Twelve-week digital skills course for out-of-school youth.")
    db.add(yd)
    db.flush()
    ytrain = Commitment(project_id=yd.id, stakeholder_id=nuru.id, title="Train 60 youth in digital skills", unit="youth",
                        measure=Measure.sum, target_value=60, due_on=date(2026, 12, 10))
    ycert = Commitment(project_id=yd.id, stakeholder_id=nuru.id, title="Certify 50 graduates", unit="graduates",
                       measure=Measure.sum, target_value=50, due_on=date(2026, 12, 20))
    db.add_all([ytrain, ycert])
    db.flush()
    for i, (d, n) in enumerate([(date(2026, 9, 8), 22), (date(2026, 9, 22), 19)], start=1):
        b.activity(ytrain, f"Cohort {i} intake week", d, kevin, "training_session", ActivityStatus.done, done_on=d,
                   values={"Attendance count": n}, files={"Signed attendance sheet": f"cohort-{i}-register.pdf"})
    assess = b.activity(ycert, "Final assessment, cohort 1", date(2026, 10, 12), kevin, "deliverable")
    b.activity(ycert, "Issue completion certificates, cohort 1", date(2026, 10, 24), kevin, "registration", depends_on=assess)
    b.activity(ytrain, "Cohort 3 intake week", date(2026, 11, 2), kevin, "training_session")

    log(db, org.id, admin.id, "organization_created", "organization", org.id, "Demo data loaded")
    db.commit()
    rules.evaluate_org(db, org.id, today())

    # ---------------- Mwangaza Creative Studio (contrasting example) ----------------
    org2 = Organization(name="Mwangaza Creative Studio", sector="Creative agency", currency="KES")
    db.add(org2)
    db.flush()
    lead = User(organization_id=org2.id, full_name="Wairimu Kamau", email="wairimu@mwangaza.example", password_hash=pw, role=Role.admin)
    designer = User(organization_id=org2.id, full_name="Otieno Were", email="otieno@mwangaza.example", password_hash=pw, role=Role.member)
    db.add_all([lead, designer])
    client = Stakeholder(organization_id=org2.id, name="Kilele Coffee Co.", kind=StakeholderKind.client)
    db.add(client)
    db.flush()
    camp = Project(organization_id=org2.id, template_id=client_t.id, stakeholder_id=client.id, manager_id=lead.id,
                   name="Kilele Coffee launch campaign", starts_on=date(2026, 9, 1), ends_on=date(2026, 12, 15))
    db.add(camp)
    db.flush()
    assets = Commitment(project_id=camp.id, stakeholder_id=client.id, title="Deliver 12 campaign assets", unit="assets",
                        measure=Measure.sum, target_value=12, due_on=date(2026, 11, 30))
    reports_c = Commitment(project_id=camp.id, stakeholder_id=client.id, title="Monthly status reports", unit="reports",
                           measure=Measure.activities, target_value=3, due_on=date(2026, 12, 1))
    db.add_all([assets, reports_c])
    db.flush()
    b2 = Builder(db, org2, client_t)
    b2.activity(assets, "Design round 1: brand look", date(2026, 9, 25), designer, "design_round", ActivityStatus.done,
                done_on=date(2026, 9, 25), values={"Assets delivered": 3}, files={"Approved file": "kilele-round1.pdf"},
                notes={"Client sign-off": "Approved by marketing lead on call."})
    b2.activity(assets, "Design round 2: social set", date(2026, 10, 16), designer, "design_round")
    b2.activity(reports_c, "September status report", date(2026, 10, 1), lead, "status_report", ActivityStatus.done,
                done_on=date(2026, 10, 1), files={"Report sent": "kilele-sept-status.pdf"})
    db.commit()
    rules.evaluate_org(db, org2.id, today())

    seed_case_study(db, pw)
    seed_tenants(db, pw)
    from app.apps import INDUSTRY_BY_KEY
    for o in db.scalars(select(Organization)).all():
        if o.name == "Tumaini Community Network":
            o.industry, o.installed_apps = "community", sorted(INDUSTRY_BY_KEY["community"]["apps"])
    db.commit()
    db.close()
    print("Seeded demo data. Sign in as achieng@tumaini.example /", PASSWORD)


def seed_case_study(db, pw):
    """Timiza Youth Initiative case study, loaded from seed_data/timiza.json (shared with the web preview)."""
    data = json.loads((Path(__file__).parent / "seed_data" / "timiza.json").read_text())
    d = lambda s: date.fromisoformat(s) if s else None  # noqa: E731
    tpl = db.scalar(select(Template).where(Template.key == data["template_key"], Template.organization_id.is_(None)))
    from app.apps import INDUSTRY_BY_KEY
    org = Organization(name=data["organization"]["name"], sector=data["organization"]["sector"], currency="KES",
                       industry="community", installed_apps=sorted(INDUSTRY_BY_KEY["community"]["apps"]))
    db.add(org)
    db.flush()
    people = {}
    for u in data["users"]:
        people[u["key"]] = User(organization_id=org.id, full_name=u["name"], email=u["email"], password_hash=pw, role=Role(u["role"]))
        db.add(people[u["key"]])
    stakes = {}
    for s in data["stakeholders"]:
        stakes[s["key"]] = Stakeholder(organization_id=org.id, name=s["name"], kind=StakeholderKind(s["kind"]))
        db.add(stakes[s["key"]])
    db.flush()
    b = Builder(db, org, tpl)
    for pj in data["projects"]:
        p = Project(organization_id=org.id, template_id=tpl.id, stakeholder_id=stakes[pj["stakeholder"]].id, manager_id=people[pj["manager"]].id,
                    name=pj["name"], description=pj["description"], starts_on=d(pj["starts_on"]), ends_on=d(pj["ends_on"]))
        db.add(p)
        db.flush()
        cs = {}
        for c in pj["commitments"]:
            cs[c["key"]] = Commitment(project_id=p.id, stakeholder_id=p.stakeholder_id, title=c["title"], unit=c["unit"],
                                      measure=Measure(c["measure"]), target_value=c["target"], due_on=d(c["due"]))
            db.add(cs[c["key"]])
        db.flush()
        keyed = {}
        for a in pj["activities"]:
            act = b.activity(cs[a["c"]], a["title"], d(a["due"]), people[a["owner"]], a["kind"],
                             ActivityStatus(a.get("status", "not_started")), values=a.get("values"), files=a.get("files"),
                             notes=a.get("notes"), done_on=d(a.get("done_on")) or (d(a["due"]) if a.get("status") == "done" else None),
                             depends_on=keyed.get(a.get("depends_on")), refused_on=d(a.get("refused_on")))
            if a.get("key"):
                keyed[a["key"]] = act
    projects_by_name = {pp.name: pp for pp in db.scalars(select(Project).where(Project.organization_id == org.id)).all()}
    seed_erp(db, org, people, stakes, projects_by_name, data)
    seed_forms(db, org, people, projects_by_name, data["forms"])
    seed_event_forms(db, org, people["zawadi"])
    log(db, org.id, people["amani"].id, "organization_created", "organization", org.id, "Case study data loaded")
    db.commit()
    rules.evaluate_org(db, org.id, today())


ASSETS = Path(__file__).resolve().parent.parent / "assets" / "timiza"


def stored_asset(name: str) -> dict:
    """Copy a bundled image into the uploads folder under a stable random-looking name the file route accepts."""
    import hashlib
    import shutil
    from app.config import get_settings

    src = ASSETS / name
    ext = src.suffix.lower()
    stored = hashlib.md5(name.encode()).hexdigest() + ext
    folder = Path(get_settings().upload_dir)
    folder.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, folder / stored)
    return {"name": name, "url": f"/files/{stored}", "size": src.stat().st_size}


WARDS = ["Sokoni", "Mnarani", "Tezo", "Matsangoni", "Watamu", "Jaribuni", "Ganze", "Kaloleni", "Malindi Town", "Mtwapa"]


class Lcg:
    """Tiny deterministic generator, mirrored in the web preview so both produce the same registry."""
    def __init__(self, seed=20261013):
        self.s = seed

    def next(self):
        self.s = (self.s * 1103515245 + 12345) % 2147483648
        return self.s / 2147483648


def participants_for(spec: dict) -> list[dict]:
    rng, out, n = Lcg(), [], 0
    for project, count in spec.items():
        for _ in range(count):
            n += 1
            r1, r2, r3, r4, r5 = (rng.next() for _ in range(5))
            gender = "female" if r1 < 0.58 else "male" if r1 < 0.97 else "other"
            ages = ["15-19", "20-24", "25-35", "10-14", "36+"] if project != "Climate Change" else ["10-14", "15-19", "20-24", "25-35", "36+"]
            age = ages[0] if r2 < 0.4 else ages[1] if r2 < 0.7 else ages[2] if r2 < 0.88 else ages[3] if r2 < 0.96 else ages[4]
            disability = r3 < (0.6 if project == "Disability Inclusion" else 0.06)
            enrolled = date(2026, 7, 1) + timedelta(days=int(r5 * 100))
            out.append({"code": f"TYI-{n:04d}", "project_id": project, "gender": gender, "age_band": age, "ward": WARDS[int(r4 * len(WARDS))],
                        "disability": disability, "consent": True, "enrolled_on": enrolled.isoformat()})
    return out


def seed_erp(db, org, people, stakes, projects, data):
    """Insert the case study's ERP records, resolving references by key."""
    from app import erp

    keys: dict[str, uuid.UUID] = {}
    order = ["site_settings", "site_programmes", "site_team", "site_services", "site_stories", "site_gallery", "site_partners", "donations", "grants", "income", "budget_lines", "expenses", "vendors", "purchase_requests",
             "items", "stock_moves", "assets", "volunteers", "volunteer_hours", "leave_requests", "events", "documents", "inquiries",
             "meetings", "decisions"]
    records = dict(data["erp"])
    records["participants"] = participants_for(data["participants"])
    order.append("participants")
    order.sort(key=lambda k: ["site_settings", "site_programmes", "site_team", "site_services", "site_stories", "site_gallery", "site_partners", "grants", "donations", "income", "budget_lines", "vendors", "expenses",
                              "purchase_requests", "items", "stock_moves", "assets", "volunteers", "volunteer_hours", "leave_requests",
                              "events", "documents", "inquiries", "meetings", "decisions", "participants"].index(k))
    stamp = datetime.now(timezone.utc)
    for key in order:
        m, t = erp.MODULES[key], erp.TABLES[key]
        fields = {f["key"]: f for f in m["fields"]}
        for rec in records.get(key, []):
            values = {}
            for k, v in rec.items():
                if k.startswith("_") or k not in fields:
                    continue
                f = fields[k]
                if f["type"] == "ref":
                    ref = f["ref"]
                    v = (people[v].id if ref == "users" else stakes[v].id if ref == "stakeholders" else projects[v].id if ref == "projects" else keys[v])
                elif f["type"] == "date":
                    v = date.fromisoformat(v)
                elif f["type"] == "file":
                    v = stored_asset(v["asset"]) if "asset" in v else {"name": v["name"], "url": "", "size": None}
                values[k] = v
            rid = uuid.uuid4()
            created = stamp - timedelta(days=rec.get("_age_days", 6))
            by = people[rec["_by"]].id if rec.get("_by") else people["zawadi"].id
            if m.get("status"):
                values[m["status"]["field"]] = rec.get("_status", m["status"]["default"])
            db.execute(t.insert().values(id=rid, organization_id=org.id, created_by_id=by, created_at=created, updated_at=created, **values))
            if rec.get("_key"):
                keys[rec["_key"]] = rid
    db.flush()


def answers_for(form: dict, rng: "Lcg", i: int) -> tuple[dict, str]:
    """Deterministic, realistic responses (mirrored in the web preview)."""
    def pick(weights):
        r, acc = rng.next() * sum(weights), 0.0
        for k, w in enumerate(weights):
            acc += w
            if r < acc:
                return k
        return len(weights) - 1
    out = {}
    for f in form["fields"]:
        t = f["type"]
        if t == "select":
            out[f["id"]] = f["options"][pick(f["w"])]
        elif t == "rating":
            out[f["id"]] = pick(f["w"]) + 1
        elif t == "yesno":
            out[f["id"]] = rng.next() < f["p"]
        elif t == "multi":
            out[f["id"]] = [o for o, w in zip(f["options"], f["w"]) if rng.next() < w]
        elif t == "number":
            out[f["id"]] = int(f["min"] + rng.next() * (f["max"] - f["min"]))
        elif t in ("text", "textarea"):
            v = f["samples"][i % len(f["samples"])]
            if v:
                out[f["id"]] = v
    day = (date(2026, 7, 1) + timedelta(days=int(rng.next() * 104))).isoformat()
    return out, day


def seed_forms(db, org, people, projects, forms):
    from app.models import Form, FormSubmission

    rng = Lcg(77)
    for spec in forms:
        fields = [{k: v for k, v in f.items() if k in ("id", "label", "type", "required", "options", "min", "max")} for f in spec["fields"]]
        for f in fields:
            f.setdefault("required", False)
            f.setdefault("options", [])
        form = Form(organization_id=org.id, project_id=projects[spec["project"]].id, title=spec["title"], description=spec["description"],
                    fields=fields, is_public=spec["is_public"], status="open", created_by_id=people["zawadi"].id)
        db.add(form)
        db.flush()
        submitters = [people["baraka"].id, people["neema"].id, people["juma"].id]
        for i in range(spec["n"]):
            data, day = answers_for(spec, rng, i)
            when = datetime.fromisoformat(day + "T10:00:00+00:00")
            db.add(FormSubmission(form_id=form.id, organization_id=org.id, data=data, source="public" if spec["is_public"] else "app",
                                  submitted_by_id=None if spec["is_public"] else submitters[i % 3], created_at=when))
    db.flush()


EVENT_GEN = {"gender": [55, 42, 3], "age": [6, 44, 30, 15, 5], "heard": [30, 28, 10, 14, 12, 6], "rating": [2, 4, 14, 38, 42]}


def seed_event_forms(db, org, creator):
    """Every event gets its attendance and feedback form; held events already have responses."""
    from app import erp
    from app.models import Form, FormSubmission
    from app.routers.erp import EVENT_FORM_FIELDS

    rng = Lcg(99)
    t = erp.TABLES["events"]
    for ev in db.execute(select(t).where(t.c.organization_id == org.id).order_by(t.c.date, t.c.title)).all():
        form = Form(organization_id=org.id, event_id=ev.id, project_id=ev.project_id, title=f"{ev.title}: attendance and feedback",
                    description="Takes one minute. No names needed.", fields=[{**x, "options": x.get("options", []), "min": None, "max": None} for x in EVENT_FORM_FIELDS],
                    is_public=True, status="open" if ev.status == "planned" else "closed", created_by_id=creator.id)
        db.add(form)
        db.flush()
        n = min(int(ev.attended or 0), 60) if ev.status == "held" else 0
        for i in range(n):
            data = answers_for({"fields": [
                {"id": "gender", "type": "select", "options": EVENT_FORM_FIELDS[0]["options"], "w": EVENT_GEN["gender"]},
                {"id": "age", "type": "select", "options": EVENT_FORM_FIELDS[1]["options"], "w": EVENT_GEN["age"]},
                {"id": "ward", "type": "text", "samples": WARDS},
                {"id": "heard", "type": "select", "options": EVENT_FORM_FIELDS[3]["options"], "w": EVENT_GEN["heard"]},
                {"id": "rating", "type": "rating", "w": EVENT_GEN["rating"]},
                {"id": "again", "type": "yesno", "p": 0.9}]}, rng, i)[0]
            db.add(FormSubmission(form_id=form.id, organization_id=org.id, data=data, source="public",
                                  created_at=datetime.fromisoformat(ev.date.isoformat() + "T16:00:00+00:00")))
    db.flush()


def seed_tenants(db, pw):
    """Other industries on the same platform: an agency, a shoe brand, a guesthouse."""
    from app import erp
    from app.apps import INDUSTRY_BY_KEY

    spec = json.loads((Path(__file__).parent / "seed_data" / "tenants.json").read_text())
    for t in spec["tenants"]:
        org = db.scalar(select(Organization).where(Organization.name == t["organization"]["name"]))
        if not org:
            org = Organization(name=t["organization"]["name"], sector=t["organization"]["sector"], currency="KES")
            db.add(org)
            db.flush()
        if not (t.get("existing") and org.installed_apps):
            org.industry, org.installed_apps = t["industry"], sorted(INDUSTRY_BY_KEY[t["industry"]]["apps"])
        people = {}
        if t.get("admin"):
            people["admin"] = User(organization_id=org.id, full_name=t["admin"]["name"], email=t["admin"]["email"], password_hash=pw, role=Role.admin)
            db.add(people["admin"])
        for u in t.get("users", []):
            people[u["key"]] = User(organization_id=org.id, full_name=u["name"], email=u["email"], password_hash=pw, role=Role(u["role"]))
            db.add(people[u["key"]])
        db.flush()
        owner = people.get("admin") or db.scalar(select(User).where(User.organization_id == org.id, User.role == Role.admin))
        keys = {}
        records = {"site_settings": [t["site_settings"]], "site_services": t.get("site_services", []), "site_stories": t.get("site_stories", []), **t.get("modules", {})}
        order = ["site_settings", "site_services", "site_stories", "vendors", "customers", "items", "stock_moves", "resources", "invoices", "bookings", "events"]
        for key in [k for k in order if k in records]:
            m, tbl = erp.MODULES[key], erp.TABLES[key]
            fields = {f["key"]: f for f in m["fields"]}
            for rec in records[key]:
                values = {}
                for k, v in rec.items():
                    if k.startswith("_") or k not in fields:
                        continue
                    f = fields[k]
                    values[k] = keys[v] if f["type"] == "ref" else date.fromisoformat(v) if f["type"] == "date" else v
                rid = uuid.uuid4()
                if m.get("status"):
                    values[m["status"]["field"]] = rec.get("_status", m["status"]["default"])
                now = datetime.now(timezone.utc) - timedelta(days=5)
                db.execute(tbl.insert().values(id=rid, organization_id=org.id, created_by_id=owner.id, created_at=now, updated_at=now, **values))
                if rec.get("_key"):
                    keys[rec["_key"]] = rid
        seed_event_forms(db, org, owner)
        db.commit()
        rules.evaluate_org(db, org.id, today())


if __name__ == "__main__":
    seed()
