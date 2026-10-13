from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user
from ..hardening import check_password, client_ip, rate_limit
from ..models import Organization, Role, User
from ..schemas import LoginIn, MeOut, RegisterIn, TokenOut
from ..security import create_token, hash_password, verify_password
from ..services.audit import log

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_FAILED = 5
LOCK_MINUTES = 15
# Verifying against a real hash even for unknown emails keeps response time the same, so emails cannot be enumerated by timing.
_DUMMY_HASH = hash_password("timing-equaliser-not-a-password-1")


def token_for(user: User) -> TokenOut:
    return TokenOut(access_token=create_token(str(user.id), str(user.organization_id), user.role.value, user.token_version or 0),
                    user=MeOut.model_validate(user))


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, request: Request, db: Session = Depends(get_db)):
    rate_limit(f"register:{client_ip(request)}", 5, 3600)
    check_password(body.password, body.email, body.full_name)
    email = body.email.lower()
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists. Sign in instead.")
    org = Organization(name=body.organization_name.strip(), sector=body.sector.strip(), currency=body.currency)
    db.add(org)
    db.flush()
    user = User(organization_id=org.id, full_name=body.full_name.strip(), email=email, password_hash=hash_password(body.password), role=Role.admin)
    db.add(user)
    db.flush()
    log(db, org.id, user.id, "organization_created", "organization", org.id, f"Created {org.name}")
    db.commit()
    db.refresh(user)
    return token_for(user)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    ip = client_ip(request)
    rate_limit(f"login-ip:{ip}", 30, 300)
    rate_limit(f"login-email:{body.email.lower()}", 10, 900)
    user = db.scalar(select(User).where(func.lower(User.email) == body.email.lower()))
    now = datetime.now(timezone.utc)
    if user and user.locked_until and user.locked_until > now:
        mins = int((user.locked_until - now).total_seconds() // 60) + 1
        raise HTTPException(status.HTTP_423_LOCKED, f"Too many failed attempts. This account is locked for {mins} more minutes.")
    ok = verify_password(body.password, user.password_hash if user else _DUMMY_HASH)
    if not user or not ok:
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
    user.failed_logins, user.locked_until, user.last_login_at = 0, None, now
    log(db, user.organization_id, user.id, "login", "user", user.id, f"{user.full_name} signed in from {ip}")
    db.commit()
    return token_for(user)


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user)):
    return user


class PasswordIn(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(max_length=128)


@router.post("/password", response_model=TokenOut)
def change_password(body: PasswordIn, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rate_limit(f"password:{user.id}", 5, 900)
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password is not right.")
    check_password(body.new_password, user.email, user.full_name)
    user.password_hash = hash_password(body.new_password)
    user.token_version = (user.token_version or 0) + 1  # every other session is signed out
    log(db, user.organization_id, user.id, "password_changed", "user", user.id, f"{user.full_name} changed their password; other sessions signed out")
    db.commit()
    return token_for(user)


@router.post("/logout-everywhere", status_code=204)
def logout_everywhere(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.token_version = (user.token_version or 0) + 1
    log(db, user.organization_id, user.id, "signed_out_everywhere", "user", user.id, f"{user.full_name} signed out of every device")
    db.commit()
