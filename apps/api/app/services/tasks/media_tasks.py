"""
Media Tasks

Celery tasks for media file operations like R2 storage deletion.
"""

from typing import Dict, Any
from app.services.tasks.base import celery_app, logger


@celery_app.task(
    name="delete_media_from_r2",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def delete_media_from_r2_task(
    self,
    file_path: str,
    media_id: str,
) -> Dict[str, Any]:
    """
    Celery task to delete media file from Cloudflare R2 in the background.

    Args:
        self: Celery task instance (for retry mechanism)
        file_path: The file path in R2 bucket (e.g., "media/user_id/filename.jpg")
        media_id: The media record ID (for logging)

    Returns:
        Dict with success status
    """
    from app.core.config import settings

    try:
        import boto3

        s3_client = boto3.client(
            "s3",
            endpoint_url=settings.CLOUDFLARE_R2_ENDPOINT_URL,
            aws_access_key_id=settings.CLOUDFLARE_R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
            region_name="auto",
        )

        s3_client.delete_object(
            Bucket=settings.CLOUDFLARE_R2_BUCKET_NAME,
            Key=file_path,
        )

        print(f"✅ [MEDIA] Deleted from R2: {file_path} (media_id: {media_id})")

        return {"success": True, "media_id": media_id, "file_path": file_path}

    except Exception as e:
        print(
            f"❌ [MEDIA] Failed to delete from R2: {file_path} "
            f"(media_id: {media_id}, error: {e}, retry: {self.request.retries})"
        )

        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)

        return {"success": False, "error": str(e), "media_id": media_id}
