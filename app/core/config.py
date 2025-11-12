from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings"""

    DATABASE_URL: str = "postgresql://user:password@localhost:5432/delivery_db"
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Tax rate (default 8%)
    TAX_RATE: float = 0.08

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
