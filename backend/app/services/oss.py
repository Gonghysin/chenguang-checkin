import logging
import uuid
from datetime import datetime
from functools import lru_cache

from qcloud_cos import CosConfig, CosS3Client

from app.config import settings

logger = logging.getLogger(__name__)


class COSClient:
    def __init__(self):
        self.region = settings.cos_region
        self.bucket_name = settings.cos_bucket

        if not settings.cos_secret_id or not settings.cos_secret_key:
            raise ValueError("COS_SECRET_ID and COS_SECRET_KEY must be set")

        config = CosConfig(
            Region=self.region,
            SecretId=settings.cos_secret_id,
            SecretKey=settings.cos_secret_key,
        )
        self.client = CosS3Client(config)

    def upload_file(self, file_bytes: bytes, original_filename: str) -> dict:
        ext = original_filename.split(".")[-1] if "." in original_filename else "bin"
        date_str = datetime.now().strftime("%Y-%m-%d")
        cos_key = f"submissions/{date_str}/{uuid.uuid4()}.{ext}"

        logger.info("cos_put_object_start bucket=%s region=%s key=%s size=%s", self.bucket_name, self.region, cos_key, len(file_bytes))
        try:
            self.client.put_object(
                Bucket=self.bucket_name,
                Body=file_bytes,
                Key=cos_key,
            )
        except Exception:
            logger.exception("cos_put_object_failed bucket=%s region=%s key=%s", self.bucket_name, self.region, cos_key)
            raise
        logger.info("cos_put_object_success bucket=%s region=%s key=%s", self.bucket_name, self.region, cos_key)

        file_url = f"https://{self.bucket_name}.cos.{self.region}.myqcloud.com/{cos_key}"

        return {
            "oss_key": cos_key,
            "file_url": file_url,
        }

    def get_presigned_url(self, cos_key: str, expire: int = 3600) -> str:
        """生成带签名的临时下载链接（私有 bucket 专用）"""
        url = self.client.get_presigned_url(
            Method="GET",
            Bucket=self.bucket_name,
            Key=cos_key,
            Expired=expire,
        )
        return url

    def delete_file(self, cos_key: str) -> bool:
        try:
            self.client.delete_object(Bucket=self.bucket_name, Key=cos_key)
            return True
        except Exception:
            return False


@lru_cache
def get_oss_client() -> COSClient:
    return COSClient()
