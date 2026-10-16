"""Stored files: one place that writes uploads and records which workspace owns them.

Files are private to their workspace unless they were uploaded for a public website page. The storage backend is
local disk today; an object-storage backend can replace `_write`/`path_for` without changing callers.
"""
import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import StoredFile


def _folder() -> Path:
    p = Path(get_settings().upload_dir)
    p.mkdir(parents=True, exist_ok=True)
    return p


def path_for(name: str) -> Path:
    return _folder() / name


def save(db: Session, content: bytes, ext: str, organization_id, user_id=None, public: bool = False, name: str | None = None) -> str:
    """Write the bytes, record ownership, and return the stored name (used in URLs as /files/<name>)."""
    stored = name or f"{uuid.uuid4().hex}{ext}"
    path_for(stored).write_bytes(content)
    row = db.get(StoredFile, stored)
    if row is None:
        db.add(StoredFile(name=stored, organization_id=organization_id, uploaded_by_id=user_id, public=public, size=len(content)))
        db.flush()  # so a second save of the same name in this transaction finds it
    else:  # re-seeding the same asset
        row.organization_id, row.public, row.size = organization_id, public, len(content)
    return stored
