"""Opaque, revocable sessions. The token is shown to the client once; only its SHA-256 hash is stored."""
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Request, Response
from sqlalchemy import update
from sqlalchemy.orm import Session

from ..config import cookie_secure, get_settings
from ..models import AuthSession, User

COOKIE = "sf_session"
CSRF_COOKIE = "sf_csrf"
CSRF_HEADER = "x-csrf-token"


def digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def start(db: Session, user: User, request: Request, response: Response) -> str:
    s = get_settings()
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    db.add(AuthSession(user_id=user.id, token_hash=digest(token), created_at=now, last_seen_at=now, expires_at=now + timedelta(days=s.session_max_days),
                       ip=(request.client.host if request.client else None), user_agent=(request.headers.get("user-agent") or "")[:200]))
    common = {"secure": cookie_secure(), "samesite": s.cookie_samesite, "path": "/", "max_age": s.session_max_days * 86400}
    response.set_cookie(COOKIE, token, httponly=True, **common)
    # Readable by the page so it can echo it in the X-CSRF-Token header (double-submit protection).
    response.set_cookie(CSRF_COOKIE, secrets.token_urlsafe(24), httponly=False, **common)
    return token


def clear_cookies(response: Response) -> None:
    for name in (COOKIE, CSRF_COOKIE):
        response.delete_cookie(name, path="/")


def resolve(db: Session, token: str) -> AuthSession | None:
    sess = db.query(AuthSession).filter(AuthSession.token_hash == digest(token)).first()
    if not sess or sess.revoked_at:
        return None
    now = datetime.now(timezone.utc)
    idle = timedelta(minutes=get_settings().session_idle_minutes)
    if sess.expires_at <= now or sess.last_seen_at + idle <= now:
        return None
    if (now - sess.last_seen_at).total_seconds() > 60:  # sliding idle window, written at most once a minute
        sess.last_seen_at = now
        db.commit()
    return sess


def revoke(db: Session, sess_id: uuid.UUID) -> None:
    db.execute(update(AuthSession).where(AuthSession.id == sess_id).values(revoked_at=datetime.now(timezone.utc)))


def revoke_all(db: Session, user_id: uuid.UUID, except_id: uuid.UUID | None = None) -> None:
    q = update(AuthSession).where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
    if except_id:
        q = q.where(AuthSession.id != except_id)
    db.execute(q.values(revoked_at=datetime.now(timezone.utc)))
