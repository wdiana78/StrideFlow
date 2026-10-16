"""Accounts: registration, sign-in and sign-out, password change and reset, invitations."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..deps import admin_only, current_session, get_current_user
from ..hardening import check_password, client_ip, rate_limit
from ..models import Invitation, Organization, PasswordResetToken, Role, User
from ..schemas import LoginIn, MeOut, RegisterIn, SessionOut
from ..security import hash_password, verify_password
from ..services import email, sessions
from ..services.audit import log

router = APIRouter(prefix="/auth", tags=["auth"])
invites = APIRouter(tags=["invitations"])

MAX_FAILED = 5
LOCK_MINUTES = 15
RESET_MINUTES = 30
INVITE_DAYS = 7
# Verifying against a real hash even for unknown emails keeps response time the same, so emails cannot be enumerated by timing.
_DUMMY_HASH = hash_password("timing-equaliser-not-a-password-1")


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _signed_in(db: Session, user: User, request: Request, response: Response) -> SessionOut:
    sessions.start(db, user, request, response)
    db.commit()
    db.refresh(user)
    return SessionOut(user=MeOut.model_validate(user))


# ---------- registration ----------
@router.post("/register", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, request: Request, response: Response, db: Session = Depends(get_db)):
    ip = client_ip(request)
    # Mistakes are not punished: only abusive volumes of attempts, and only successful sign-ups, are limited.
    rate_limit(f"register-any:{ip}", 60, 3600)
    rate_limit(f"register-ok:{ip}", 10, 3600, consume=False)
    check_password(body.password, body.email, body.full_name)
    email_addr = body.email.lower()
    if db.scalar(select(User).where(func.lower(User.email) == email_addr)):
        raise HTTPException(status.HTTP_409_CONFLICT, {"message": "An account with this email already exists. Sign in instead.", "field": "email"})
    org = Organization(name=body.organization_name.strip(), sector="", currency=body.currency, kind="customer")
    db.add(org)
    db.flush()
    user = User(organization_id=org.id, full_name=body.full_name.strip(), email=email_addr, password_hash=hash_password(body.password), role=Role.admin)
    db.add(user)
    db.flush()
    from .apps import setup_new_org
    setup_new_org(db, org, body.capabilities, body.template)
    log(db, org.id, user.id, "organization_created", "organization", org.id, f"Created {org.name}")
    rate_limit(f"register-ok:{ip}", 10, 3600)
    return _signed_in(db, user, request, response)


# ---------- sign in and out ----------
@router.post("/login", response_model=SessionOut)
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    ip = client_ip(request)
    rate_limit(f"login-ip:{ip}", 30, 300)
    rate_limit(f"login-email:{body.email.lower()}", 10, 900)
    user = db.scalar(select(User).where(func.lower(User.email) == body.email.lower()))
    now = datetime.now(timezone.utc)
    if user and user.locked_until and user.locked_until > now:
        mins = int((user.locked_until - now).total_seconds() // 60) + 1
        raise HTTPException(status.HTTP_423_LOCKED, f"Too many failed attempts. This account is locked for {mins} more minutes.")
    ok = verify_password(body.password, (user.password_hash if user and user.password_hash else _DUMMY_HASH))
    if not user or not ok or not user.password_hash:
        if user:
            user.failed_logins = (user.failed_logins or 0) + 1
            if user.failed_logins >= MAX_FAILED:
                user.locked_until = now + timedelta(minutes=LOCK_MINUTES)
                user.failed_logins = 0
                log(db, user.organization_id, None, "account_locked", "user", user.id, f"Account locked after {MAX_FAILED} failed sign-ins from {ip}")
            else:
                log(db, user.organization_id, None, "login_failed", "user", user.id, f"Failed sign-in from {ip}")
            db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect.")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated by an administrator.")
    if get_settings().app_mode == "production" and user.organization.kind != "customer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect.")
    if body.site_slug:
        from .. import erp
        st = erp.TABLES["site_settings"]
        site_org = db.scalar(select(st.c.organization_id).where(func.lower(st.c.slug) == body.site_slug.lower()))
        if site_org != user.organization_id:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect.")
    user.failed_logins, user.locked_until, user.last_login_at = 0, None, now
    log(db, user.organization_id, user.id, "login", "user", user.id, f"{user.full_name} signed in from {ip}")
    return _signed_in(db, user, request, response)


@router.post("/logout", status_code=204)
def logout(response: Response, sess=Depends(current_session), db: Session = Depends(get_db)):
    sessions.revoke(db, sess.id)
    db.commit()
    sessions.clear_cookies(response)


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user)):
    return user


class PasswordIn(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(max_length=128)


@router.post("/password", response_model=SessionOut)
def change_password(body: PasswordIn, sess=Depends(current_session), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rate_limit(f"password:{user.id}", 5, 900)
    if not user.password_hash or not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, {"message": "Your current password is not right.", "field": "current_password"})
    check_password(body.new_password, user.email, user.full_name)
    user.password_hash = hash_password(body.new_password)
    sessions.revoke_all(db, user.id, except_id=sess.id)  # every other device is signed out
    log(db, user.organization_id, user.id, "password_changed", "user", user.id, f"{user.full_name} changed their password; other sessions signed out")
    db.commit()
    return SessionOut(user=MeOut.model_validate(user))


@router.post("/logout-everywhere", status_code=204)
def logout_everywhere(response: Response, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sessions.revoke_all(db, user.id)
    log(db, user.organization_id, user.id, "signed_out_everywhere", "user", user.id, f"{user.full_name} signed out of every device")
    db.commit()
    sessions.clear_cookies(response)


# ---------- password reset ----------
class ResetRequestIn(BaseModel):
    email: EmailStr


class ResetConfirmIn(BaseModel):
    token: str = Field(min_length=20, max_length=100)
    new_password: str = Field(max_length=128)


RESET_REPLY = {"message": "If an account exists for that email, we have sent a link to reset the password. It expires in 30 minutes."}


@router.post("/password-reset", status_code=202)
def request_reset(body: ResetRequestIn, request: Request, db: Session = Depends(get_db)):
    rate_limit(f"reset-ip:{client_ip(request)}", 10, 3600)
    rate_limit(f"reset-email:{body.email.lower()}", 3, 3600)
    user = db.scalar(select(User).where(func.lower(User.email) == body.email.lower()))
    if user and user.is_active and (user.organization.kind == "customer" or get_settings().app_mode != "production"):
        token = secrets.token_urlsafe(32)
        db.add(PasswordResetToken(user_id=user.id, token_hash=_hash(token), expires_at=datetime.now(timezone.utc) + timedelta(minutes=RESET_MINUTES)))
        log(db, user.organization_id, None, "password_reset_requested", "user", user.id, f"Password reset requested from {client_ip(request)}")
        db.commit()
        link = f"{get_settings().app_url.rstrip('/')}/reset-password?token={token}"
        email.send(user.email, "Reset your StrideFlow password",
                   f"Hello {user.full_name.split(' ')[0]},\n\nUse this link to choose a new password. It works once and expires in {RESET_MINUTES} minutes:\n\n{link}\n\n"
                   "If you did not ask for this, you can ignore this email; your password has not changed.\n\nStrideFlow")
    # Same answer whether or not the account exists, so this cannot be used to discover emails.
    return RESET_REPLY


@router.post("/password-reset/confirm")
def confirm_reset(body: ResetConfirmIn, request: Request, db: Session = Depends(get_db)):
    rate_limit(f"reset-confirm:{client_ip(request)}", 20, 3600)
    row = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == _hash(body.token)))
    now = datetime.now(timezone.utc)
    if not row or row.used_at or row.expires_at <= now:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link has expired or was already used. Ask for a new one.")
    user = db.get(User, row.user_id)
    check_password(body.new_password, user.email, user.full_name)
    user.password_hash = hash_password(body.new_password)
    user.failed_logins, user.locked_until = 0, None
    row.used_at = now
    sessions.revoke_all(db, user.id)
    log(db, user.organization_id, None, "password_reset", "user", user.id, f"{user.full_name} reset their password; all sessions signed out")
    db.commit()
    return {"message": "Your password has been changed. Sign in with your new password."}


# ---------- invitations ----------
class InvitationIn(BaseModel):
    email: EmailStr
    full_name: str = Field(default="", max_length=120)
    role: Role = Role.member


def _invite_out(i: Invitation) -> dict:
    now = datetime.now(timezone.utc)
    state = "accepted" if i.accepted_at else "revoked" if i.revoked_at else "expired" if i.expires_at <= now else "pending"
    return {"id": str(i.id), "email": i.email, "full_name": i.full_name, "role": i.role.value, "state": state,
            "created_at": i.created_at.isoformat(), "expires_at": i.expires_at.isoformat()}


@invites.get("/invitations")
def list_invitations(admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    rows = db.scalars(select(Invitation).where(Invitation.organization_id == admin.organization_id).order_by(Invitation.created_at.desc())).all()
    return [_invite_out(i) for i in rows]


@invites.post("/invitations", status_code=201)
def invite(body: InvitationIn, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    rate_limit(f"invite:{admin.organization_id}", 50, 3600)
    addr = body.email.lower()
    if db.scalar(select(User).where(func.lower(User.email) == addr)):
        raise HTTPException(status.HTTP_409_CONFLICT, {"message": "Someone with this email already has a StrideFlow account.", "field": "email"})
    now = datetime.now(timezone.utc)
    for old in db.scalars(select(Invitation).where(Invitation.organization_id == admin.organization_id, func.lower(Invitation.email) == addr,
                                                   Invitation.accepted_at.is_(None), Invitation.revoked_at.is_(None))).all():
        old.revoked_at = now  # a new invitation replaces any earlier one
    token = secrets.token_urlsafe(32)
    inv = Invitation(organization_id=admin.organization_id, email=addr, full_name=body.full_name.strip(), role=body.role, token_hash=_hash(token),
                     invited_by_id=admin.id, expires_at=now + timedelta(days=INVITE_DAYS))
    db.add(inv)
    log(db, admin.organization_id, admin.id, "invitation_sent", "user", None, f"{admin.full_name} invited {addr} as {body.role.value}")
    db.commit()
    link = f"{get_settings().app_url.rstrip('/')}/accept-invitation?token={token}"
    email.send(addr, f"You are invited to {admin.organization.name} on StrideFlow",
               f"{admin.full_name} has invited you to join {admin.organization.name} on StrideFlow as {body.role.value}.\n\n"
               f"Accept the invitation and choose your password here (the link expires in {INVITE_DAYS} days):\n\n{link}\n\nStrideFlow")
    return _invite_out(inv)


@invites.delete("/invitations/{iid}", status_code=204)
def revoke_invitation(iid: str, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    inv = db.scalar(select(Invitation).where(Invitation.id == iid, Invitation.organization_id == admin.organization_id))
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found.")
    inv.revoked_at = datetime.now(timezone.utc)
    log(db, admin.organization_id, admin.id, "invitation_revoked", "user", None, f"{admin.full_name} revoked the invitation for {inv.email}")
    db.commit()


def _open_invitation(db: Session, token: str) -> Invitation:
    inv = db.scalar(select(Invitation).where(Invitation.token_hash == _hash(token)))
    if not inv or inv.revoked_at or inv.accepted_at or inv.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This invitation has expired or is no longer valid. Ask your administrator to send a new one.")
    return inv


@router.get("/invitations/{token}")
def invitation_details(token: str, request: Request, db: Session = Depends(get_db)):
    rate_limit(f"invite-view:{client_ip(request)}", 30, 600)
    inv = _open_invitation(db, token)
    return {"organization": inv.organization.name, "email": inv.email, "full_name": inv.full_name, "role": inv.role.value}


class AcceptIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(max_length=128)


@router.post("/invitations/{token}/accept", response_model=SessionOut, status_code=201)
def accept_invitation(token: str, body: AcceptIn, request: Request, response: Response, db: Session = Depends(get_db)):
    rate_limit(f"invite-accept:{client_ip(request)}", 20, 3600)
    inv = _open_invitation(db, token)
    if db.scalar(select(User).where(func.lower(User.email) == inv.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists. Sign in instead.")
    check_password(body.password, inv.email, body.full_name)
    user = User(organization_id=inv.organization_id, full_name=body.full_name.strip(), email=inv.email, password_hash=hash_password(body.password), role=inv.role)
    db.add(user)
    inv.accepted_at = datetime.now(timezone.utc)
    db.flush()
    log(db, inv.organization_id, user.id, "invitation_accepted", "user", user.id, f"{user.full_name} joined as {inv.role.value}")
    return _signed_in(db, user, request, response)
