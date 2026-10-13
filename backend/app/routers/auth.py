from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user
from ..models import Organization, Role, User
from ..schemas import LoginIn, MeOut, RegisterIn, TokenOut
from ..security import create_token, hash_password, verify_password
from ..services.audit import log

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_for(user: User) -> TokenOut:
    return TokenOut(
        access_token=create_token(str(user.id), str(user.organization_id), user.role.value),
        user=MeOut.model_validate(user),
    )


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists. Sign in instead.")
    org = Organization(name=body.organization_name.strip(), sector=body.sector.strip(), currency=body.currency)
    db.add(org)
    db.flush()
    user = User(organization_id=org.id, full_name=body.full_name.strip(), email=email,
                password_hash=hash_password(body.password), role=Role.admin)
    db.add(user)
    db.flush()
    log(db, org.id, user.id, "organization_created", "organization", org.id, f"Created {org.name}")
    db.commit()
    db.refresh(user)
    return _token_for(user)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(func.lower(User.email) == body.email.lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect.")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated by an administrator.")
    return _token_for(user)


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user)):
    return user
