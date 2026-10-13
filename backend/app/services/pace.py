"""Progress and pace for commitments.

actual    = sum of counted evidence values on completed activities (measure "sum"),
            or number of completed activities (measure "activities").
expected  = target x (days since project start / days from project start to the commitment's due date), capped at target.
gap       = expected% - actual%, in percentage points. 15 or more = at risk.
"""
from dataclasses import asdict, dataclass
from datetime import date

from ..models import ActivityStatus, Commitment, Measure

AT_RISK_GAP = 15.0


@dataclass
class Pace:
    actual: float
    expected: float
    target: float
    actual_pct: float
    expected_pct: float
    gap_pts: float
    status: str  # on_track | at_risk | overdue | done
    done_activities: int
    total_activities: int

    def as_dict(self):
        return asdict(self)


def _done_by(activity, as_of: date) -> bool:
    return activity.status == ActivityStatus.done and (
        activity.completed_at is None or activity.completed_at.date() <= as_of
    )


def actual_value(c: Commitment, as_of: date) -> float:
    if c.measure == Measure.activities:
        return float(sum(1 for a in c.activities if _done_by(a, as_of)))
    total = 0.0
    for a in c.activities:
        if not _done_by(a, as_of):
            continue
        for e in a.evidence:
            if e.value_number is not None and e.requirement is not None and e.requirement.counts_toward_target:
                total += float(e.value_number)
    return total


def expected_value(c: Commitment, as_of: date) -> float:
    start = c.project.starts_on
    span = (c.due_on - start).days
    target = float(c.target_value)
    if span <= 0:
        return target if as_of >= c.due_on else 0.0
    elapsed = (as_of - start).days
    frac = min(max(elapsed / span, 0.0), 1.0)
    return target * frac


def compute(c: Commitment, as_of: date) -> Pace:
    target = float(c.target_value) or 1.0
    actual = actual_value(c, as_of)
    expected = expected_value(c, as_of)
    a_pct = min(actual / target * 100, 100.0)
    e_pct = min(expected / target * 100, 100.0)
    gap = round(e_pct - a_pct, 1)
    if actual >= target:
        status = "done"
    elif as_of > c.due_on:
        status = "overdue"
    elif gap >= AT_RISK_GAP:
        status = "at_risk"
    else:
        status = "on_track"
    return Pace(
        actual=round(actual, 2),
        expected=round(expected, 1),
        target=float(c.target_value),
        actual_pct=round(a_pct, 1),
        expected_pct=round(e_pct, 1),
        gap_pts=gap,
        status=status,
        done_activities=sum(1 for a in c.activities if a.status == ActivityStatus.done),
        total_activities=len(c.activities),
    )
