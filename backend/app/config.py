from pydantic_settings import BaseSettings

DEFAULT_ADMIN_SESSION_SECRET = "change-this-to-a-random-secret-32-chars-minimum"


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "sqlite+aiosqlite:///./test.db"

    oss_access_key_id: str = ""
    oss_secret_access_key: str = ""
    oss_internal_endpoint: str = ""
    oss_external_endpoint: str = ""
    oss_bucket_name: str = ""
    oss_region: str = "us-east-1"

    admin_session_secret: str = DEFAULT_ADMIN_SESSION_SECRET
    admin_cookie_secure: bool | None = None
    admin_login_max_attempts: int = 5
    admin_login_window_seconds: int = 900
    admin_login_lockout_seconds: int = 900
    admin_username: str = ""
    admin_password: str = ""

    frontend_url: str = "http://localhost:5173"

    upload_max_file_size_mb: int = 8
    upload_max_files_per_submission: int = 10

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() in {"prod", "production"}

    @property
    def effective_admin_cookie_secure(self) -> bool:
        if self.admin_cookie_secure is not None:
            return self.admin_cookie_secure
        return self.is_production

    def validate_security_settings(self) -> None:
        secret = self.admin_session_secret.strip()
        if self.is_production and (
            secret == DEFAULT_ADMIN_SESSION_SECRET or len(secret) < 32
        ):
            raise ValueError(
                "ADMIN_SESSION_SECRET must be set to a random value of at least 32 characters in production"
            )
        if self.upload_max_file_size_mb <= 0:
            raise ValueError("UPLOAD_MAX_FILE_SIZE_MB must be greater than 0")
        if self.upload_max_files_per_submission <= 0:
            raise ValueError("UPLOAD_MAX_FILES_PER_SUBMISSION must be greater than 0")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
settings.validate_security_settings()
