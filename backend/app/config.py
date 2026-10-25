from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://relief:change-me@localhost:5432/disaster_relief"
    jwt_secret_key: str = ""
    access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:5173"
    environment: str = "development"
    geocoding_search_url: str = "https://nominatim.openstreetmap.org/search"
    geocoding_reverse_url: str = "https://nominatim.openstreetmap.org/reverse"
    dispatch_top_k: int = Field(default=3, ge=1, le=100)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
