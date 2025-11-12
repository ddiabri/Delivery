from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings"""

    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/delivery_db"

    # Security
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Business logic
    TAX_RATE: float = 0.08

    # CORS
    CORS_ORIGINS: List[str] = ["*"]  # In production, set specific origins
    ENVIRONMENT: str = "development"  # development, staging, production

    # API
    API_VERSION: str = "v1"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
