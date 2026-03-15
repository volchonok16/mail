from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://mailuser:mailpass@postgres:5432/maildb"
    
    # MinIO
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "avatars"
    MINIO_SECURE: bool = False
    
    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # SMTP Settings (для приёма писем)
    SMTP_HOST: str = "0.0.0.0"
    SMTP_PORT: int = 25
    SMTP_SUBMISSION_PORT: int = 587
    SMTP_SSL_PORT: int = 465
    # TLS для порта 587 (Submission). Если не заданы — генерируется self-signed для разработки.
    SMTP_TLS_CERT_FILE: Optional[str] = None  # путь к cert.pem
    SMTP_TLS_KEY_FILE: Optional[str] = None  # путь к key.pem
    # Sync DB URL для SMTP-auth (порт 587). Если не задан — из DATABASE_URL (postgresql вместо asyncpg).
    DATABASE_URL_SYNC: Optional[str] = None
    
    # SMTP Relay (для отправки на внешние адреса)
    SMTP_RELAY_ENABLED: bool = False
    SMTP_RELAY_HOST: Optional[str] = None  # например: smtp.sendgrid.net
    SMTP_RELAY_PORT: int = 587
    SMTP_RELAY_USER: Optional[str] = None
    SMTP_RELAY_PASSWORD: Optional[str] = None
    SMTP_RELAY_USE_TLS: bool = True
    # Использовать SendGrid HTTP API вместо SMTP (порт 443, не блокируется на сервере)
    SENDGRID_USE_API: bool = True
    
    # IMAP Settings
    IMAP_HOST: str = "0.0.0.0"
    IMAP_PORT: int = 143
    IMAP_SSL_PORT: int = 993
    
    # Domain
    MAIL_DOMAIN: str = "alexol.io"
    
    # Default Admin
    DEFAULT_ADMIN_EMAIL: str = "admin@alexol.io"
    DEFAULT_ADMIN_PASSWORD: str = "Gord078134Alexol!9256"
    
    class Config:
        env_file = ".env"

settings = Settings()

