from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "production"
    DEBUG: bool = False
    SERVER_IP: str = "127.0.0.1"
    CONTROL_PORT: int = 7080
    HTTP_PORT: int = 80
    HTTPS_PORT: int = 443

    # Modular Feature Toggles (Easily enable/disable components)
    ENABLE_WEBMAIL: bool = True
    ENABLE_CLAMAV: bool = True
    ENABLE_RSPAMD: bool = True
    ENABLE_FAIL2BAN: bool = True
    ENABLE_BACKUPS: bool = True
    ENABLE_ALIASES: bool = True
    ENABLE_DIAGNOSTICS: bool = True

    # Security & Auth
    SECRET_KEY: str = Field(default="dev-secret-key-change-in-production-1234567890")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # PostgreSQL
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "mailuser"
    POSTGRES_PASSWORD: str = "supersecurepassword123"
    POSTGRES_DB: str = "corpmail"

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = "supersecureredispassword123"

    # Mail Engine
    PRIMARY_HOSTNAME: str = "mail.bootstrap.local"
    DEFAULT_QUOTA_MB: int = 5120
    VMAIL_DIR: str = "/var/mail-platform/vmail"
    DKIM_DIR: str = "/var/mail-platform/dkim"
    SSL_DIR: str = "/var/mail-platform/ssl"
    BACKUP_DIR: str = "/var/mail-platform/backups"

    # CORS
    CORS_ORIGINS: List[str] = ["*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def async_database_url(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def sync_database_url(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def redis_url(self) -> str:
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/0"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"


settings = Settings()
