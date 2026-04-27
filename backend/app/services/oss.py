import logging
import mimetypes
import uuid
from datetime import datetime
from functools import lru_cache

from botocore.config import Config
from botocore.session import get_session

from app.config import settings

logger = logging.getLogger(__name__)


class OSSClient:
    def __init__(self):
        self.bucket_name = settings.oss_bucket_name.strip()
        self.internal_endpoint = settings.oss_internal_endpoint.strip().rstrip("/")
        self.external_endpoint = settings.oss_external_endpoint.strip().rstrip("/")
        self.region = settings.oss_region

        if not settings.oss_access_key_id or not settings.oss_secret_access_key:
            raise ValueError("OSS_ACCESS_KEY_ID and OSS_SECRET_ACCESS_KEY must be set")
        if not self.bucket_name or not self.internal_endpoint or not self.external_endpoint:
            raise ValueError("OSS_BUCKET_NAME, OSS_INTERNAL_ENDPOINT and OSS_EXTERNAL_ENDPOINT must be set")

        self.client = self._create_client(self.internal_endpoint)
        self.public_client = self._create_client(self.external_endpoint)

    def _create_client(self, endpoint_url: str):
        session = get_session()
        return session.create_client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=settings.oss_access_key_id,
            aws_secret_access_key=settings.oss_secret_access_key,
            region_name=self.region,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )

    def upload_file(self, file_bytes: bytes, original_filename: str, object_key: str | None = None) -> dict:
        ext = original_filename.split(".")[-1] if "." in original_filename else "bin"
        date_str = datetime.now().strftime("%Y-%m-%d")
        if object_key is None:
            object_key = f"submissions/{date_str}/{uuid.uuid4()}.{ext}"
        content_type = mimetypes.guess_type(original_filename)[0] or "application/octet-stream"

        logger.info(
            "oss_put_object_start bucket=%s endpoint=%s key=%s size=%s",
            self.bucket_name,
            self.internal_endpoint,
            object_key,
            len(file_bytes),
        )
        try:
            self.client.put_object(
                Bucket=self.bucket_name,
                Body=file_bytes,
                Key=object_key,
                ContentType=content_type,
            )
        except Exception:
            logger.exception(
                "oss_put_object_failed bucket=%s endpoint=%s key=%s",
                self.bucket_name,
                self.internal_endpoint,
                object_key,
            )
            raise
        logger.info("oss_put_object_success bucket=%s key=%s", self.bucket_name, object_key)

        file_url = f"{self.external_endpoint}/{self.bucket_name}/{object_key}"

        return {
            "oss_key": object_key,
            "file_url": file_url,
        }

    def get_presigned_url(self, object_key: str, expire: int = 3600) -> str:
        return self.public_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket_name, "Key": object_key},
            ExpiresIn=expire,
        )

    def delete_file(self, object_key: str) -> bool:
        try:
            self.client.delete_object(Bucket=self.bucket_name, Key=object_key)
            return True
        except Exception:
            logger.exception("oss_delete_object_failed bucket=%s key=%s", self.bucket_name, object_key)
            return False


@lru_cache
def get_oss_client() -> OSSClient:
    return OSSClient()
