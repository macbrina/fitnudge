from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Query
from pydantic import BaseModel
from typing import Optional, Literal
from app.core.flexible_auth import get_current_user
from datetime import datetime

try:
    import magic

    MAGIC_AVAILABLE = True
except ImportError:
    MAGIC_AVAILABLE = False
import hashlib
import json
import os
import tempfile
from PIL import Image
import subprocess

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header

# Media types - determines if we store in database
MediaType = Literal["post", "checkin", "profile", "other"]


# Pydantic models
class MediaUploadResponse(BaseModel):
    id: Optional[str] = None  # Only present for post media
    url: str
    filename: str
    file_size: int
    content_type: str
    duration: Optional[int] = None  # For audio/video
    created_at: str


class MediaDeleteResponse(BaseModel):
    message: str


def get_media_duration(file_content: bytes, file_extension: str) -> Optional[int]:
    """Get duration in seconds for audio/video files using ffprobe"""
    try:
        with tempfile.NamedTemporaryFile(
            suffix=file_extension, delete=False
        ) as temp_file:
            temp_file.write(file_content)
            temp_file.flush()
            temp_path = temp_file.name

        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "quiet",
                "-print_format",
                "json",
                "-show_format",
                temp_path,
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )

        os.unlink(temp_path)

        if result.returncode == 0:
            data = json.loads(result.stdout)
            duration_str = data.get("format", {}).get("duration")
            if duration_str:
                return int(float(duration_str))
    except (
        subprocess.TimeoutExpired,
        FileNotFoundError,
        json.JSONDecodeError,
        Exception,
    ):
        pass

    return None


@router.post(
    "/upload", response_model=MediaUploadResponse, status_code=status.HTTP_201_CREATED
)
async def upload_media(
    file: UploadFile = File(...),
    media_type: MediaType = Query(
        default="other", description="Type of media: post, checkin, profile, other"
    ),
    post_id: Optional[str] = Query(
        default=None, description="Post ID if media is for a post"
    ),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload media file (image, video, audio).

    - media_type='post': Stores in media_uploads table (requires post_id)
    - media_type='checkin': Just uploads to R2, URL stored in check-in's photo_urls
    - media_type='profile': Just uploads to R2
    - media_type='other': Just uploads to R2
    """
    from app.core.database import get_supabase_client
    from app.core.config import settings
    import boto3
    import uuid

    # Read file content
    file_content = await file.read()

    # Enhanced security validation
    validation_result = await validate_file_security(file, file_content)
    if not validation_result["is_valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=validation_result["error"]
        )

    detected_mime = validation_result.get("detected_mime", file.content_type)

    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1].lower()
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    r2_key = f"media/{current_user['id']}/{unique_filename}"

    # Get duration for audio/video files
    duration = None
    if detected_mime.startswith("audio/") or detected_mime.startswith("video/"):
        duration = get_media_duration(file_content, file_extension)

    # Determine file type category
    if detected_mime.startswith("image/"):
        file_type = "image"
    elif detected_mime.startswith("video/"):
        file_type = "video"
    elif detected_mime.startswith("audio/"):
        file_type = "audio"
    else:
        file_type = "other"

    # Upload to Cloudflare R2
    try:
        s3_client = boto3.client(
            "s3",
            endpoint_url=settings.CLOUDFLARE_R2_ENDPOINT_URL,
            aws_access_key_id=settings.CLOUDFLARE_R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
            region_name="auto",
        )

        s3_client.put_object(
            Bucket=settings.CLOUDFLARE_R2_BUCKET_NAME,
            Key=r2_key,
            Body=file_content,
            ContentType=detected_mime,
        )

        file_url = f"{settings.CLOUDFLARE_R2_PUBLIC_URL}/{r2_key}"

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}",
        )

    # Only store in database for post media
    media_id = None
    created_at = datetime.utcnow().isoformat() + "Z"

    if media_type == "post":
        supabase = get_supabase_client()
        media_record = {
            "user_id": current_user["id"],
            "post_id": post_id,
            "cloudflare_r2_key": r2_key,
            "cloudflare_r2_url": file_url,
            "file_type": file_type,
            "file_size": len(file_content),
            "duration": duration,
        }

        result = supabase.table("media_uploads").insert(media_record).execute()
        if result.data:
            media_id = result.data[0]["id"]
            created_at = result.data[0]["created_at"]

    return MediaUploadResponse(
        id=media_id,
        url=file_url,
        filename=file.filename,
        file_size=len(file_content),
        content_type=detected_mime,
        duration=duration,
        created_at=created_at,
    )


def extract_r2_key_from_url(url: str, public_url_base: str) -> Optional[str]:
    """Extract the R2 key from a full URL"""
    if not url or not public_url_base:
        return None

    # Remove trailing slash from base URL
    base = public_url_base.rstrip("/")

    if url.startswith(base):
        # Extract the path after the base URL
        key = url[len(base) :].lstrip("/")
        return key if key else None

    return None


@router.delete("/{media_id}", response_model=MediaDeleteResponse)
async def delete_media(media_id: str, current_user: dict = Depends(get_current_user)):
    """Delete media file by ID - for post media stored in database"""
    from app.core.database import get_supabase_client
    from app.services.tasks import delete_media_from_r2_task

    supabase = get_supabase_client()

    # Get media record
    result = (
        supabase.table("media_uploads")
        .select("*")
        .eq("id", media_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Media not found"
        )

    media_data = result.data[0]
    r2_key = media_data["cloudflare_r2_key"]

    # Delete from database immediately
    supabase.table("media_uploads").delete().eq("id", media_id).execute()

    # Queue background task to delete from Cloudflare R2
    delete_media_from_r2_task.delay(
        file_path=r2_key,
        media_id=media_id,
    )

    return MediaDeleteResponse(message="Media deleted successfully")


class MediaDeleteByUrlRequest(BaseModel):
    url: str


@router.post("/delete-by-url", response_model=MediaDeleteResponse)
async def delete_media_by_url(
    request: MediaDeleteByUrlRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Delete media file by URL - for check-in/profile media not stored in database.
    Validates that the URL belongs to the current user before deleting.
    """
    from app.core.config import settings
    from app.services.tasks import delete_media_from_r2_task

    url = request.url

    # Extract R2 key from URL
    r2_key = extract_r2_key_from_url(url, settings.CLOUDFLARE_R2_PUBLIC_URL)

    if not r2_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid media URL",
        )

    # Validate the URL belongs to this user (check user_id in path)
    expected_prefix = f"media/{current_user['id']}/"
    if not r2_key.startswith(expected_prefix):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own media",
        )

    # Queue background task to delete from Cloudflare R2
    delete_media_from_r2_task.delay(
        file_path=r2_key,
        media_id=f"url-delete-{current_user['id']}",
    )

    return MediaDeleteResponse(message="Media deletion queued")


@router.get("/my-media")
async def get_my_media(
    current_user: dict = Depends(get_current_user),
    page: int = 1,
    limit: int = 20,
):
    """Get current user's uploaded media"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    offset = (page - 1) * limit

    result = (
        supabase.table("media_uploads")
        .select("*")
        .eq("user_id", current_user["id"])
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return result.data


# Additional media utilities
@router.post("/upload-multiple")
async def upload_multiple_media(
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload multiple media files at once"""
    if len(files) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 10 files allowed per request",
        )

    uploaded_files = []
    errors = []

    for file in files:
        try:
            # Use the single upload logic
            response = await upload_media(file, current_user)
            uploaded_files.append(response)
        except Exception as e:
            errors.append({"filename": file.filename, "error": str(e)})

    return {
        "uploaded_files": uploaded_files,
        "errors": errors,
        "total_uploaded": len(uploaded_files),
        "total_errors": len(errors),
    }


@router.get("/{media_id}")
async def get_media_info(media_id: str, current_user: dict = Depends(get_current_user)):
    """Get media file information"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    result = (
        supabase.table("media_uploads")
        .select("*")
        .eq("id", media_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Media not found"
        )

    return result.data[0]


async def validate_file_security(file: UploadFile, file_content: bytes) -> dict:
    """Comprehensive file security validation"""

    # File size validation
    max_size = 10 * 1024 * 1024  # 10MB
    if len(file_content) > max_size:
        return {"is_valid": False, "error": "File size exceeds 10MB limit"}

    # MIME type validation using python-magic
    if MAGIC_AVAILABLE:
        try:
            detected_mime = magic.from_buffer(file_content, mime=True)
        except Exception:
            detected_mime = file.content_type
    else:
        detected_mime = file.content_type

    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "video/mp4",
        "video/quicktime",
        "video/x-msvideo",
        "audio/mpeg",
        "audio/wav",
        "audio/mp4",
        "audio/aac",
    }

    if detected_mime not in allowed_types:
        return {
            "is_valid": False,
            "error": f"File type {detected_mime} not allowed. Allowed types: {', '.join(allowed_types)}",
        }

    # File extension validation
    allowed_extensions = {
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".mp4",
        ".mov",
        ".avi",
        ".mp3",
        ".wav",
        ".m4a",
        ".aac",
    }

    file_extension = os.path.splitext(file.filename)[1].lower()
    if file_extension not in allowed_extensions:
        return {
            "is_valid": False,
            "error": f"File extension {file_extension} not allowed",
        }

    # Check file header for malicious content (only first 1KB to avoid false positives in binary data)
    # Binary image/video/audio data can contain random byte sequences that match text patterns
    file_header = file_content[:1024].lower()
    malicious_signatures = [
        b"<script",
        b"javascript:",
        b"vbscript:",
        b"data:text/html",
        b"<?php",
        b"<%",
    ]

    for signature in malicious_signatures:
        if signature in file_header:
            return {
                "is_valid": False,
                "error": "File contains potentially malicious content",
            }

    # Image-specific validation
    if detected_mime.startswith("image/"):
        try:
            with tempfile.NamedTemporaryFile() as temp_file:
                temp_file.write(file_content)
                temp_file.flush()

                # Validate image with PIL
                with Image.open(temp_file.name) as img:
                    # Check image dimensions
                    if img.width > 4096 or img.height > 4096:
                        return {
                            "is_valid": False,
                            "error": "Image dimensions too large (max 4096x4096)",
                        }

                    # Check for embedded scripts in EXIF data
                    if hasattr(img, "_getexif") and img._getexif():
                        exif = img._getexif()
                        for tag, value in exif.items():
                            if isinstance(value, str) and any(
                                script in value.lower()
                                for script in ["<script", "javascript:", "vbscript:"]
                            ):
                                return {
                                    "is_valid": False,
                                    "error": "Image contains potentially malicious EXIF data",
                                }
        except Exception as e:
            return {"is_valid": False, "error": f"Invalid image file: {str(e)}"}

    # Video-specific validation
    elif detected_mime.startswith("video/"):
        try:
            with tempfile.NamedTemporaryFile(suffix=file_extension) as temp_file:
                temp_file.write(file_content)
                temp_file.flush()

                # Use ffprobe to validate video (if available)
                try:
                    result = subprocess.run(
                        [
                            "ffprobe",
                            "-v",
                            "quiet",
                            "-print_format",
                            "json",
                            "-show_format",
                            "-show_streams",
                            temp_file.name,
                        ],
                        capture_output=True,
                        text=True,
                        timeout=10,
                    )

                    if result.returncode != 0:
                        return {"is_valid": False, "error": "Invalid video file format"}
                except (subprocess.TimeoutExpired, FileNotFoundError):
                    # ffprobe not available, skip validation
                    pass
        except Exception as e:
            return {"is_valid": False, "error": f"Invalid video file: {str(e)}"}

    # Calculate file hash for duplicate detection
    file_hash = hashlib.sha256(file_content).hexdigest()

    # Check for duplicate files (optional)
    # This could be implemented to prevent storage of duplicate files

    return {
        "is_valid": True,
        "detected_mime": detected_mime,
        "file_hash": file_hash,
        "file_size": len(file_content),
    }


async def scan_file_for_malware(file_content: bytes) -> dict:
    """Scan file for malware using ClamAV (if available)"""
    try:
        with tempfile.NamedTemporaryFile() as temp_file:
            temp_file.write(file_content)
            temp_file.flush()

            # Use ClamAV to scan file
            result = subprocess.run(
                ["clamscan", "--no-summary", "--infected", temp_file.name],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 1:  # Infected
                return {"is_clean": False, "threat": result.stdout.strip()}
            else:
                return {"is_clean": True, "threat": None}
    except (subprocess.TimeoutExpired, FileNotFoundError):
        # ClamAV not available or timeout
        return {
            "is_clean": True,  # Assume clean if scanner not available
            "threat": None,
        }
    except Exception:
        return {"is_clean": True, "threat": None}  # Assume clean on error
