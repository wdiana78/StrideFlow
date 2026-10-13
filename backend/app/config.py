from datetime import date
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://kept:kept@localhost:5432/kept"
    jwt_secret: str = "change-me-in-production"
    jwt_expire_minutes: int = 480
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
    # Optional fixed "today" (YYYY-MM-DD) so demos and tests are reproducible.
    kept_today: date | None = None

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
    return s


def today() -> date:
    s = get_settings()
    return s.kept_today or date.today()
