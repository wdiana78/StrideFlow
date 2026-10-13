from sqlalchemy.orm import Session

from ..models import AuditEvent


def log(db: Session, org_id, actor_id, action: str, subject_type: str, subject_id, summary: str = "", changes: dict | None = None):
    db.add(
        AuditEvent(
            organization_id=org_id,
            actor_id=actor_id,
            action=action,
            subject_type=subject_type,
            subject_id=str(subject_id),
            summary=summary,
            changes=changes or {},
        )
    )
