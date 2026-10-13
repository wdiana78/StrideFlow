from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import get_settings

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(user_id: str, org_id: str, role: str, token_version: int = 0) -> str:
    s = get_settings()
    payload = {
        "sub": user_id,
        "org": org_id,
        "role": role,
        "tv": token_version,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=s.jwt_expire_minutes),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    # Pinning the algorithm list blocks "alg: none" and algorithm-confusion attacks.
    return jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM], options={"require": ["exp", "sub"]})
