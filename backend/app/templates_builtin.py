"""Built-in templates. Industry vocabulary and proof rules live here, not in the core model."""

R = lambda kind, label, required=True, counts=False: {"kind": kind, "label": label, "required": required, "counts": counts}  # noqa: E731

BUILTIN_TEMPLATES = [
    {
        "key": "community_programme",
        "name": "Community programme",
        "description": "Funded programmes that train, equip or organize people and report to a grantor.",
        "vocabulary": {"stakeholder": "Funder", "commitment": "Commitment", "activity": "Activity", "project": "Programme"},
        "blueprint": {
            "commitments": [
                {"title": "Train participants", "unit": "participants", "measure": "sum", "target_value": 100},
                {"title": "Deliver inputs to households", "unit": "households", "measure": "sum", "target_value": 50},
                {"title": "Mid-term learning review", "unit": "parts", "measure": "activities", "target_value": 3},
            ],
            "activity_types": [
                {"key": "training_session", "name": "Training session", "requirements": [
                    R("value", "Attendance count", counts=True), R("file", "Signed attendance sheet"), R("note", "Session note", required=False)]},
                {"key": "distribution", "name": "Distribution", "requirements": [
                    R("value", "Households reached", counts=True), R("file", "Delivery note")]},
                {"key": "field_visit", "name": "Field visit", "requirements": [R("note", "Visit report"), R("file", "Photos")]},
                {"key": "registration", "name": "Group registration", "requirements": [
                    R("value", "Groups registered", counts=True), R("file", "Registration certificate")]},
                {"key": "purchase", "name": "Purchase", "requirements": [R("file", "Receipt"), R("value", "Amount spent", required=False)]},
                {"key": "deliverable", "name": "Deliverable", "requirements": [R("file", "Final document")]},
                {"key": "task", "name": "General task", "requirements": []},
            ],
        },
    },
    {
        "key": "client_engagement",
        "name": "Client engagement",
        "description": "Agencies and service firms delivering work to a client on agreed dates.",
        "vocabulary": {"stakeholder": "Client", "commitment": "Deliverable", "activity": "Task", "project": "Engagement"},
        "blueprint": {
            "commitments": [
                {"title": "Deliver campaign assets", "unit": "assets", "measure": "sum", "target_value": 12},
                {"title": "Monthly status reports", "unit": "reports", "measure": "activities", "target_value": 3},
            ],
            "activity_types": [
                {"key": "design_round", "name": "Design round", "requirements": [
                    R("value", "Assets delivered", counts=True), R("file", "Approved file"), R("note", "Client sign-off")]},
                {"key": "review_meeting", "name": "Review meeting", "requirements": [R("note", "Meeting notes")]},
                {"key": "status_report", "name": "Status report", "requirements": [R("file", "Report sent")]},
                {"key": "task", "name": "General task", "requirements": []},
            ],
        },
    },
]


def ensure_builtin_templates(db):
    from sqlalchemy import select

    from .models import Template

    existing = {t.key for t in db.scalars(select(Template).where(Template.organization_id.is_(None))).all()}
    for t in BUILTIN_TEMPLATES:
        if t["key"] not in existing:
            db.add(Template(organization_id=None, **t))
    db.commit()
