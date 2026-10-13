from datetime import date
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://kept:kept@localhost:5432/kept"
    jwt_secret: str = "change-me-in-production"
    jwt_expire_minutes: int = 720
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
    return Settings()


def today() -> date:
    s = get_settings()
    return s.kept_today or date.today()
