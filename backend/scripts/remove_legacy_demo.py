"""M6: remove the legacy demonstration workspaces that older versions seeded into the production database.

Dry run by default. Deleting requires --confirm and the path of a pg_dump backup taken in the last 24 hours:

    pg_dump "$DATABASE_URL" -Fc -f before-m6.dump
    python scripts/remove_legacy_demo.py                                  # lists what would be deleted
    python scripts/remove_legacy_demo.py --confirm --backup before-m6.dump # deletes

A workspace is matched only when its name AND at least one of its users' emails match the legacy demo data exactly,
so a real customer that happens to share a name is never touched. Restore with pg_restore if anything is wrong.
"""
import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import func, select  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.models import Organization, User  # noqa: E402

LEGACY = {
    "Timiza Youth Initiative": "@timiza.example",
    "Tumaini Community Network": "@tumaini.example",
    "Hatua Apparel": "@hatua.example",
    "Hatua Shoes": "@hatua.example",
    "Mwangaza Creative Studio": "@mwangaza.example",
    "Pwani Hotels & Safaris": "@pwani.example",
    "Pwani Coast Stays": "@pwani.example",
}


def find(db):
    out = []
    for org in db.scalars(select(Organization).where(Organization.name.in_(LEGACY.keys()))).all():
        domain = LEGACY[org.name]
        emails = db.scalars(select(User.email).where(User.organization_id == org.id)).all()
        if emails and any(e.lower().endswith(domain) for e in emails):
            out.append((org, emails))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--confirm", action="store_true")
    ap.add_argument("--backup", help="path to a pg_dump file made in the last 24 hours")
    a = ap.parse_args()
    with SessionLocal() as db:
        found = find(db)
        if not found:
            print("No legacy demonstration workspaces found. Nothing to do.")
            return 0
        if a.confirm and (not a.backup or not os.path.isfile(a.backup) or os.path.getsize(a.backup) == 0 or time.time() - os.path.getmtime(a.backup) > 86400):
            print("Refusing: --backup must point to a non-empty pg_dump file created in the last 24 hours.", file=sys.stderr)
            return 2
        for org, emails in found:
            print(f"{'DELETE' if a.confirm else 'would delete'}: {org.name} ({org.id}), {len(emails)} users, e.g. {emails[0]}")
        if not a.confirm:
            print(f"Dry run: {len(found)} workspaces matched. Re-run with --confirm --backup <file> to delete.")
            return 0
        for org, _ in found:
            db.delete(org)  # every tenant table cascades on organization_id
        db.commit()
        left = db.scalar(select(func.count()).select_from(Organization).where(Organization.name.in_(LEGACY.keys())))
        print(f"Deleted {len(found)} workspaces. Legacy-named workspaces remaining: {left}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
