from minio import Minio
from minio.error import S3Error
from app.config import settings
import logging
import json

logger = logging.getLogger(__name__)


class MinioClient:
    def __init__(self):
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        self._bucket_ready = False

    def _ensure_bucket(self):
        """Create bucket if it doesn't exist. Called lazily on first use."""
        if self._bucket_ready:
            return
        try:
            if not self.client.bucket_exists(settings.MINIO_BUCKET):
                self.client.make_bucket(settings.MINIO_BUCKET)
                policy = {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Principal": {"AWS": "*"},
                            "Action": ["s3:GetObject"],
                            "Resource": [f"arn:aws:s3:::{settings.MINIO_BUCKET}/*"],
                        }
                    ],
                }
                self.client.set_bucket_policy(settings.MINIO_BUCKET, json.dumps(policy))
                logger.info("Created MinIO bucket: %s", settings.MINIO_BUCKET)
            else:
                logger.info("MinIO bucket already exists: %s", settings.MINIO_BUCKET)
            self._bucket_ready = True
        except Exception as e:
            logger.error("Error ensuring MinIO bucket: %s", e)
            raise

    def upload_file(self, file_data, file_name, content_type):
        """Upload file to MinIO."""
        self._ensure_bucket()
        try:
            self.client.put_object(
                settings.MINIO_BUCKET,
                file_name,
                file_data,
                length=-1,
                part_size=10 * 1024 * 1024,
                content_type=content_type,
            )
            url = f"http://{settings.MINIO_ENDPOINT}/{settings.MINIO_BUCKET}/{file_name}"
            return url
        except S3Error as e:
            logger.error("Error uploading file: %s", e)
            raise

    def delete_file(self, file_name):
        """Delete file from MinIO."""
        self._ensure_bucket()
        try:
            self.client.remove_object(settings.MINIO_BUCKET, file_name)
        except S3Error as e:
            logger.error("Error deleting file: %s", e)
            raise


minio_client = MinioClient()
