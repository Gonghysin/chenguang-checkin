from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./test.db"

    oss_access_key_id: str = ""
    oss_secret_access_key: str = ""
    oss_internal_endpoint: str = ""
    oss_external_endpoint: str = ""
    oss_bucket_name: str = ""
    oss_region: str = "us-east-1"

    admin_session_secret: str = "change-this-to-a-random-secret-32-chars-minimum"
    admin_username: str = ""
    admin_password: str = ""

    frontend_url: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
