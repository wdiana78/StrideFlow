import uuid

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .db import get_db
from .models import Activity, Commitment, Project, Role, User
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to continue.")
    try:
        payload = decode_token(creds.credentials)
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your session has expired. Sign in again.")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This account is no longer active.")
    return user


def require_roles(*roles: Role):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role does not allow this action.")
        return user

    return checker


WRITERS = (Role.admin, Role.manager)
can_manage = require_roles(Role.admin, Role.manager)
admin_only = require_roles(Role.admin)


def get_project_in_org(db: Session, project_id: uuid.UUID, user: User) -> Project:
    project = db.get(Project, project_id)
    # 404 rather than 403 so other organizations cannot probe which ids exist.
    if not project or project.organization_id != user.organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found.")
    return project


def get_commitment_in_org(db: Session, commitment_id: uuid.UUID, user: User) -> Commitment:
    c = db.get(Commitment, commitment_id)
    if not c or c.project.organization_id != user.organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commitment not found.")
    return c


def get_activity_in_org(db: Session, activity_id: uuid.UUID, user: User) -> Activity:
    a = db.get(Activity, activity_id)
    if not a or a.commitment.project.organization_id != user.organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Activity not found.")
    return a


def ensure_can_work_on(activity: Activity, user: User) -> None:
    """Managers and admins can work on anything; members only on their own activities."""
    if user.role in WRITERS:
        return
    if user.role == Role.member and activity.owner_id == user.id:
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner or a manager can change this activity.")
