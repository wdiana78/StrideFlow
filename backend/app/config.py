from datetime import date
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://kept:kept@localhost:5432/kept"
    # Server secret for signing short-lived values (OAuth state in Phase 6). Sessions are opaque database tokens, not JWTs.
    jwt_secret: str = "change-me-in-production"
    environment: str = "development"  # set to "production" on Render
    payments_mode: str = "sandbox"  # "sandbox" simulates M-Pesa; "mpesa" calls Safaricom Daraja
    mpesa_env: str = "sandbox"  # Daraja environment: sandbox | production
    mpesa_consumer_key: str = ""
    mpesa_consumer_secret: str = ""
    mpesa_shortcode: str = ""
    mpesa_passkey: str = ""
    mpesa_callback_url: str = ""  # https://<api>/api/payments/mpesa/callback/<mpesa_callback_token>
    mpesa_callback_token: str = ""
    cors_origins: str = "http://localhost:5173"
    upload_dir: str = "uploads"
    # production | demo | development. Demo tooling refuses to run in production; production refuses demo workspaces.
    app_mode: str = "development"
    # Sessions: an HttpOnly cookie for browsers (plus a CSRF cookie), or the same opaque token as a Bearer header for API clients.
    session_idle_minutes: int = 480
    session_max_days: int = 30
    cookie_secure: bool | None = None  # defaults to True in production
    cookie_samesite: str = "lax"
    # Links in emails (password reset, invitations) point here.
    app_url: str = "http://localhost:5173"
    # Email: "log" writes messages to the server log (development); "smtp" sends through SMTP_* settings.
    email_transport: str = "log"
    email_from: str = "StrideFlow <no-reply@strideflow.local>"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    # Optional fixed "today" (YYYY-MM-DD) so demos and tests are reproducible.
    kept_today: date | None = None

    @field_validator("kept_today", "cookie_secure", mode="before")
    @classmethod
    def empty_date_is_unset(cls, v):
        # "KEPT_TODAY=" in an env file means "not set", not a startup failure.
        return None if isinstance(v, str) and not v.strip() else v

    @property
    def sqlalchemy_url(self) -> str:
        url = self.database_url
        # Render and Heroku hand out postgres:// URLs; SQLAlchemy needs the driver named.
        if url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://"):]
        return url

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.environment == "production":
        # Fail closed: never run production with a guessable signing key or wide-open CORS.
        if len(s.jwt_secret) < 32 or "change-me" in s.jwt_secret or "dev-only" in s.jwt_secret:
            raise RuntimeError("JWT_SECRET must be a random value of at least 32 characters in production.")
        if any(o == "*" for o in s.cors_list):
            raise RuntimeError("CORS_ORIGINS cannot be '*' in production.")
        if s.kept_today:
            raise RuntimeError("KEPT_TODAY is for demos only; unset it in production.")
        if s.app_mode != "production":
            raise RuntimeError("ENVIRONMENT=production requires APP_MODE=production.")
        if s.email_transport == "log":
            raise RuntimeError("EMAIL_TRANSPORT=log would hide password-reset and invitation emails in production; configure SMTP.")
    return s


def today() -> date:
    s = get_settings()
    return s.kept_today or date.today()


def cookie_secure() -> bool:
    s = get_settings()
    return s.cookie_secure if s.cookie_secure is not None else s.environment == "production"
