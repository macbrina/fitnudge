from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional
from app.core.flexible_auth import get_current_user

try:
    import magic

    MAGIC_AVAILABLE = True
except ImportError:
    MAGIC_AVAILABLE = False
import hashlib
import os
import tempfile
from PIL import Image
import subprocess

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


# Pydantic models
class MediaUploadResponse(BaseModel):
    id: str
    url: str
    filename: str
    file_size: int
    content_type: str
    created_at: str


class MediaDeleteResponse(BaseModel):
    message: str


@router.post(
    "/upload", response_model=MediaUploadResponse, status_code=status.HTTP_201_CREATED
)
async def upload_media(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload media file (image, video, audio)"""
    from app.core.database import get_supabase_client
    from app.core.config import settings
    import boto3
    import uuid
    import os
    from datetime import datetime

    # Read file content
    file_content = await file.read()

    # Enhanced security validation
    validation_result = await validate_file_security(file, file_content)
    if not validation_result["is_valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=validation_result["error"]
        )

    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"

    # Upload to Cloudflare R2
    try:
        s3_client = boto3.client(
            "s3",
            endpoint_url=settings.CLOUDFLARE_R2_ENDPOINT_URL,
            aws_access_key_id=settings.CLOUDFLARE_R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
            region_name="auto",
        )

        # Upload file
        s3_client.put_object(
            Bucket=settings.CLOUDFLARE_R2_BUCKET_NAME,
            Key=f"media/{current_user['id']}/{unique_filename}",
            Body=file_content,
            ContentType=file.content_type,
            ACL="public-read",
        )

        # Generate public URL
        file_url = f"{settings.CLOUDFLARE_R2_PUBLIC_URL}/media/{current_user['id']}/{unique_filename}"

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}",
        )

    # Store media record in database
    supabase = get_supabase_client()
    media_record = {
        "user_id": current_user["id"],
        "filename": file.filename,
        "file_path": f"media/{current_user['id']}/{unique_filename}",
        "url": file_url,
        "file_size": len(file_content),
        "content_type": file.content_type,
        "bucket": settings.CLOUDFLARE_R2_BUCKET_NAME,
    }

    result = supabase.table("media").insert(media_record).execute()
    media_data = result.data[0]

    return MediaUploadResponse(
        id=media_data["id"],
        url=file_url,
        filename=file.filename,
        file_size=len(file_content),
        content_type=file.content_type,
        created_at=media_data["created_at"],
    )


@router.delete("/{media_id}", response_model=MediaDeleteResponse)
async def delete_media(media_id: str, current_user: dict = Depends(get_current_user)):
    """Delete media file"""
    from app.core.database import get_supabase_client
    from app.core.config import settings
    import boto3

    supabase = get_supabase_client()

    # Get media record
    result = (
        supabase.table("media")
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

    # Delete from Cloudflare R2
    try:
        s3_client = boto3.client(
            "s3",
            endpoint_url=settings.CLOUDFLARE_R2_ENDPOINT_URL,
            aws_access_key_id=settings.CLOUDFLARE_R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
            region_name="auto",
        )

        s3_client.delete_object(
            Bucket=settings.CLOUDFLARE_R2_BUCKET_NAME, Key=media_data["file_path"]
        )

    except Exception as e:
        # Log error but don't fail the request
        print(f"Failed to delete file from R2: {str(e)}")

    # Delete from database
    supabase.table("media").delete().eq("id", media_id).execute()

    return MediaDeleteResponse(message="Media deleted successfully")


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
        supabase.table("media")
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
        supabase.table("media")
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

    # Check for malicious file signatures
    malicious_signatures = [
        b"<script",
        b"javascript:",
        b"vbscript:",
        b"data:text/html",
        b"<?php",
        b"<%",
        b"<%=",
        b"<script language=",
        b"<iframe",
        b"<object",
        b"<embed",
        b"<link",
        b"exec(",
        b"eval(",
        b"Function(",
        b"setTimeout(",
    ]

    file_content_lower = file_content.lower()
    for signature in malicious_signatures:
        if signature in file_content_lower:
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
