"""Load fictional demo data. Safe to re-run: it deletes the two demo organizations first.

    python seed.py

Every person and organization here is invented. Demo password for all accounts: kept-demo-2026
"""
from datetime import date, datetime, time, timedelta, timezone

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
DEMO_ORGS = ["Tumaini Community Network", "Mwangaza Creative Studio"]


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
    db.close()
    print("Seeded demo data. Sign in as achieng@tumaini.example /", PASSWORD)


if __name__ == "__main__":
    seed()
