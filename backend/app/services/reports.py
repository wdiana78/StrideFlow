from collections import Counter
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Flag, Project
from . import pace

STATUS_WORDS = {"on_track": "On track", "at_risk": "At risk", "overdue": "Overdue", "done": "Complete"}


def _n(x: float) -> str:
    return f"{x:,.1f}".rstrip("0").rstrip(".") if x % 1 else f"{int(x):,}"


def build_snapshot(db: Session, project: Project, period_start: date, period_end: date, today: date) -> dict:
    as_of = min(period_end, today)
    rows, series = [], []
    for c in project.commitments:
        p = pace.compute(c, as_of)
        rows.append({
            "commitment_id": str(c.id),
            "title": c.title,
            "unit": c.unit,
            "target": p.target,
            "expected": p.expected,
            "actual": p.actual,
            "variance": round(p.actual - p.expected, 1),
            "status": p.status,
            "status_label": STATUS_WORDS[p.status],
            "due_on": c.due_on.isoformat(),
        })
        if c.measure.value == "sum":
            pts, d = [], project.starts_on
            while d < as_of:
                pts.append({"date": d.isoformat(), "value": pace.actual_value(c, d)})
                d += timedelta(days=7)
            pts.append({"date": as_of.isoformat(), "value": pace.actual_value(c, as_of)})
            series.append({
                "commitment_id": str(c.id), "title": c.title, "unit": c.unit, "target": p.target,
                "start": project.starts_on.isoformat(), "due_on": c.due_on.isoformat(), "points": pts,
            })

    evidence_items = []
    for c in project.commitments:
        for a in c.activities:
            for e in a.evidence:
                cd = e.captured_at.date()
                if period_start <= cd <= period_end:
                    evidence_items.append({
                        "id": str(e.id), "activity": a.title, "commitment": c.title,
                        "label": e.requirement.label if e.requirement else e.kind.value,
                        "kind": e.kind.value, "value": float(e.value_number) if e.value_number is not None else None,
                        "text": e.text, "file_name": e.file_name, "file_url": e.file_url, "date": cd.isoformat(),
                    })
    by_label = Counter(i["label"] for i in evidence_items)

    flags = db.scalars(select(Flag).where(Flag.project_id == project.id).order_by(Flag.opened_at)).all()
    issues = [
        {
            "rule": f.rule.value, "title": f.title, "detail": f.detail,
            "opened": f.opened_at.date().isoformat(), "status": f.status.value,
            "resolution": f.resolution_note,
        }
        for f in flags
        if f.rule.value in ("behind_pace", "overdue", "missing_proof", "blocked")
        and f.opened_at.date() <= period_end
        and (f.resolved_at is None or f.resolved_at.date() >= period_start)
    ]

    good = [r for r in rows if r["status"] in ("on_track", "done")]
    parts = [f"{len(good)} of {len(rows)} commitments are on track or complete."]
    for r in rows:
        if r["status"] in ("at_risk", "overdue"):
            parts.append(
                f"{r['title']} stands at {_n(r['actual'])} of {_n(r['target'])} {r['unit']} against {_n(r['expected'])} expected"
                + (" and is past its due date." if r["status"] == "overdue" else ".")
            )
    parts.append(f"{len(evidence_items)} pieces of evidence were recorded in the period.")

    return {
        "project": {"id": str(project.id), "name": project.name,
                    "starts_on": project.starts_on.isoformat(), "ends_on": project.ends_on.isoformat()},
        "stakeholder": project.stakeholder.name if project.stakeholder else None,
        "period": {"start": period_start.isoformat(), "end": period_end.isoformat(), "as_of": as_of.isoformat()},
        "summary": " ".join(parts),
        "rows": rows,
        "series": series,
        "issues": issues,
        "evidence": {"total": len(evidence_items), "by_label": [{"label": k, "count": v} for k, v in by_label.most_common()],
                     "items": evidence_items},
    }
