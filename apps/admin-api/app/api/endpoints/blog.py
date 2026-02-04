"""
Blog Management Endpoints
Categories, tags, posts, and image upload to Cloudflare R2
"""

import os
import re
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, status, UploadFile
from pydantic import BaseModel

from app.core.admin_auth import get_current_admin, log_admin_action
from app.core.config import settings
from app.core.database import get_supabase_client, first_row

router = APIRouter(prefix="/blog", tags=["Blog"])

# --- Pydantic models ---


class BlogCategoryResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str]
    created_at: str
    post_count: int = 0


class BlogCategoryCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None


class BlogCategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None


class BlogTagResponse(BaseModel):
    id: str
    name: str
    slug: str
    created_at: str
    post_count: int = 0


class BlogTagCreate(BaseModel):
    name: str
    slug: str


class BlogTagUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None


class BlogPostResponse(BaseModel):
    id: str
    title: str
    slug: str
    content: str
    excerpt: Optional[str]
    featured_image_url: Optional[str]
    is_featured: bool = False
    status: str
    author_id: str
    published_at: Optional[str]
    created_at: str
    updated_at: str
    author: dict
    categories: List[dict]
    tags: List[dict]


class BlogPostCreate(BaseModel):
    title: str
    content: str
    excerpt: Optional[str] = None
    featured_image_url: Optional[str] = None
    is_featured: bool = False
    status: str = "draft"
    slug: Optional[str] = None  # Auto if not provided
    category_ids: List[str] = []
    tag_ids: List[str] = []


class BlogPostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    excerpt: Optional[str] = None
    featured_image_url: Optional[str] = None
    is_featured: Optional[bool] = None
    status: Optional[str] = None
    slug: Optional[str] = None
    category_ids: Optional[List[str]] = None
    tag_ids: Optional[List[str]] = None


class BlogImageUploadResponse(BaseModel):
    url: str
    filename: str


def _slugify(text: str) -> str:
    """Generate URL-safe slug from text."""
    s = re.sub(r"[^a-zA-Z0-9\s-]", "", text.lower())
    return re.sub(r"\s+", "-", s.strip())


def _transform_post(post: dict) -> dict:
    """Flatten categories/tags from join structure."""
    categories = []
    for c in post.get("categories") or []:
        if c and c.get("category"):
            categories.append(c["category"])
    tags = []
    for t in post.get("tags") or []:
        if t and t.get("tag"):
            tags.append(t["tag"])
    return {**post, "categories": categories, "tags": tags}


# --- Categories ---


@router.get("/categories", response_model=List[BlogCategoryResponse])
async def list_categories(
    current_admin: dict = Depends(get_current_admin),
):
    """List all blog categories with post counts."""
    supabase = get_supabase_client()
    result = supabase.table("blog_categories").select("*").order("name").execute()

    categories = result.data or []
    out = []
    for cat in categories:
        count_result = (
            supabase.table("blog_post_categories")
            .select("id", count="exact")
            .eq("category_id", cat["id"])
            .execute()
        )
        post_count = getattr(count_result, "count", 0) or len(count_result.data or [])
        out.append({**cat, "post_count": post_count})
    return out


@router.post(
    "/categories",
    response_model=BlogCategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_category(
    data: BlogCategoryCreate,
    current_admin: dict = Depends(get_current_admin),
):
    """Create a blog category."""
    supabase = get_supabase_client()

    # Check slug uniqueness
    existing = (
        supabase.table("blog_categories")
        .select("id")
        .eq("slug", data.slug)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A category with this slug already exists",
        )

    row = {
        "name": data.name,
        "slug": data.slug,
        "description": data.description,
    }
    result = supabase.table("blog_categories").insert(row).execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create category",
        )

    row = first_row(result.data)
    await log_admin_action(
        current_admin["id"],
        "create_blog_category",
        "blog_category",
        row["id"],
    )
    return {**row, "post_count": 0}


@router.put("/categories/{category_id}", response_model=BlogCategoryResponse)
async def update_category(
    category_id: str,
    data: BlogCategoryUpdate,
    current_admin: dict = Depends(get_current_admin),
):
    """Update a blog category."""
    supabase = get_supabase_client()

    existing = (
        supabase.table("blog_categories")
        .select("*")
        .eq("id", category_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        return {**first_row(existing.data), "post_count": 0}

    if "slug" in update_data:
        dup = (
            supabase.table("blog_categories")
            .select("id")
            .eq("slug", update_data["slug"])
            .neq("id", category_id)
            .execute()
        )
        if dup.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A category with this slug already exists",
            )

    supabase.table("blog_categories").update(update_data).eq("id", category_id).execute()
    result = supabase.table("blog_categories").select("*").eq("id", category_id).execute()
    count_result = (
        supabase.table("blog_post_categories")
        .select("id", count="exact")
        .eq("category_id", category_id)
        .execute()
    )
    post_count = getattr(count_result, "count", 0) or len(count_result.data or [])

    await log_admin_action(current_admin["id"], "update_blog_category", "blog_category", category_id)
    return {**first_row(result.data), "post_count": post_count}


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """Delete a blog category."""
    supabase = get_supabase_client()

    existing = (
        supabase.table("blog_categories")
        .select("id")
        .eq("id", category_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    # Check if used by posts
    used = (
        supabase.table("blog_post_categories")
        .select("id")
        .eq("category_id", category_id)
        .limit(1)
        .execute()
    )
    if used.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category is in use by posts. Remove it from posts first.",
        )

    supabase.table("blog_categories").delete().eq("id", category_id).execute()
    await log_admin_action(current_admin["id"], "delete_blog_category", "blog_category", category_id)


# --- Tags ---


@router.get("/tags", response_model=List[BlogTagResponse])
async def list_tags(
    current_admin: dict = Depends(get_current_admin),
):
    """List all blog tags with post counts."""
    supabase = get_supabase_client()
    result = supabase.table("blog_tags").select("*").order("name").execute()

    tags = result.data or []
    out = []
    for tag in tags:
        count_result = (
            supabase.table("blog_post_tags")
            .select("id", count="exact")
            .eq("tag_id", tag["id"])
            .execute()
        )
        post_count = getattr(count_result, "count", 0) or len(count_result.data or [])
        out.append({**tag, "post_count": post_count})
    return out


@router.post(
    "/tags",
    response_model=BlogTagResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_tag(
    data: BlogTagCreate,
    current_admin: dict = Depends(get_current_admin),
):
    """Create a blog tag."""
    supabase = get_supabase_client()

    existing = (
        supabase.table("blog_tags")
        .select("id")
        .eq("slug", data.slug)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A tag with this slug already exists",
        )

    row = {"name": data.name, "slug": data.slug}
    result = supabase.table("blog_tags").insert(row).execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create tag",
        )

    row = first_row(result.data)
    await log_admin_action(current_admin["id"], "create_blog_tag", "blog_tag", row["id"])
    return {**row, "post_count": 0}


@router.put("/tags/{tag_id}", response_model=BlogTagResponse)
async def update_tag(
    tag_id: str,
    data: BlogTagUpdate,
    current_admin: dict = Depends(get_current_admin),
):
    """Update a blog tag."""
    supabase = get_supabase_client()

    existing = (
        supabase.table("blog_tags")
        .select("*")
        .eq("id", tag_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found",
        )

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        return {**first_row(existing.data), "post_count": 0}

    if "slug" in update_data:
        dup = (
            supabase.table("blog_tags")
            .select("id")
            .eq("slug", update_data["slug"])
            .neq("id", tag_id)
            .execute()
        )
        if dup.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A tag with this slug already exists",
            )

    supabase.table("blog_tags").update(update_data).eq("id", tag_id).execute()
    result = supabase.table("blog_tags").select("*").eq("id", tag_id).execute()
    count_result = (
        supabase.table("blog_post_tags")
        .select("id", count="exact")
        .eq("tag_id", tag_id)
        .execute()
    )
    post_count = getattr(count_result, "count", 0) or len(count_result.data or [])

    await log_admin_action(current_admin["id"], "update_blog_tag", "blog_tag", tag_id)
    return {**first_row(result.data), "post_count": post_count}


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """Delete a blog tag."""
    supabase = get_supabase_client()

    existing = (
        supabase.table("blog_tags")
        .select("id")
        .eq("id", tag_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found",
        )

    used = (
        supabase.table("blog_post_tags")
        .select("id")
        .eq("tag_id", tag_id)
        .limit(1)
        .execute()
    )
    if used.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tag is in use by posts. Remove it from posts first.",
        )

    supabase.table("blog_tags").delete().eq("id", tag_id).execute()
    await log_admin_action(current_admin["id"], "delete_blog_tag", "blog_tag", tag_id)


# --- Posts ---


@router.get("/posts", response_model=dict)
async def list_posts(
    current_admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    status_filter: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    tag_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """List blog posts with pagination and filters."""
    supabase = get_supabase_client()
    offset = (page - 1) * per_page

    query = supabase.table("blog_posts").select(
        """
        *,
        author:users(id, name, username, profile_picture_url),
        categories:blog_post_categories(
            category:blog_categories(id, name, slug)
        ),
        tags:blog_post_tags(
            tag:blog_tags(id, name, slug)
        )
    """,
        count="exact",
    )

    if status_filter:
        query = query.eq("status", status_filter)
    if category_id:
        post_ids = (
            supabase.table("blog_post_categories")
            .select("post_id")
            .eq("category_id", category_id)
            .execute()
        )
        ids = [p["post_id"] for p in (post_ids.data or [])]
        if not ids:
            return {"posts": [], "total": 0, "page": page, "per_page": per_page}
        query = query.in_("id", ids)
    if tag_id:
        post_ids = (
            supabase.table("blog_post_tags")
            .select("post_id")
            .eq("tag_id", tag_id)
            .execute()
        )
        ids = [p["post_id"] for p in (post_ids.data or [])]
        if not ids:
            return {"posts": [], "total": 0, "page": page, "per_page": per_page}
        query = query.in_("id", ids)
    if search:
        query = query.or_(f"title.ilike.%{search}%,excerpt.ilike.%{search}%")

    result = (
        query.order("created_at", desc=True)
        .range(offset, offset + per_page - 1)
        .execute()
    )

    posts = [_transform_post(p) for p in (result.data or [])]
    total = getattr(result, "count", 0) or len(result.data or [])

    return {"posts": posts, "total": total, "page": page, "per_page": per_page}


@router.get("/posts/{post_id}", response_model=BlogPostResponse)
async def get_post(
    post_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """Get a single blog post."""
    supabase = get_supabase_client()
    result = (
        supabase.table("blog_posts")
        .select(
            """
            *,
            author:users(id, name, username, profile_picture_url),
            categories:blog_post_categories(
                category:blog_categories(id, name, slug)
            ),
            tags:blog_post_tags(
                tag:blog_tags(id, name, slug)
            )
        """
        )
        .eq("id", post_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )
    return _transform_post(first_row(result.data))


@router.post(
    "/posts",
    response_model=BlogPostResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_post(
    data: BlogPostCreate,
    current_admin: dict = Depends(get_current_admin),
):
    """Create a blog post."""
    supabase = get_supabase_client()

    slug = data.slug or _slugify(data.title)
    original_slug = slug
    counter = 1
    while True:
        existing = supabase.table("blog_posts").select("id").eq("slug", slug).execute()
        if not existing.data:
            break
        slug = f"{original_slug}-{counter}"
        counter += 1

    post = {
        "title": data.title,
        "slug": slug,
        "content": data.content,
        "excerpt": data.excerpt,
        "featured_image_url": data.featured_image_url,
        "is_featured": data.is_featured,
        "status": data.status,
        "author_id": current_admin["id"],
        "published_at": (
            datetime.utcnow().isoformat() if data.status == "published" else None
        ),
    }

    result = supabase.table("blog_posts").insert(post).execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create post",
        )
    post_id = first_row(result.data)["id"]

    for cid in data.category_ids:
        supabase.table("blog_post_categories").insert(
            {"post_id": post_id, "category_id": cid}
        ).execute()
    for tid in data.tag_ids:
        supabase.table("blog_post_tags").insert(
            {"post_id": post_id, "tag_id": tid}
        ).execute()

    await log_admin_action(current_admin["id"], "create_blog_post", "blog_post", post_id)

    full = (
        supabase.table("blog_posts")
        .select(
            """
            *,
            author:users(id, name, username, profile_picture_url),
            categories:blog_post_categories(
                category:blog_categories(id, name, slug)
            ),
            tags:blog_post_tags(
                tag:blog_tags(id, name, slug)
            )
        """
        )
        .eq("id", post_id)
        .execute()
    )
    return _transform_post(first_row(full.data))


@router.put("/posts/{post_id}", response_model=BlogPostResponse)
async def update_post(
    post_id: str,
    data: BlogPostUpdate,
    current_admin: dict = Depends(get_current_admin),
):
    """Update a blog post."""
    supabase = get_supabase_client()

    existing = (
        supabase.table("blog_posts")
        .select("*")
        .eq("id", post_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    # Use exclude_unset so we can distinguish "not sent" from "sent as null" (for clearing featured_image_url)
    raw = data.model_dump(exclude_unset=True)
    update_data = {k: v for k, v in raw.items() if k not in ("category_ids", "tag_ids")}

    # When featured_image_url changes, delete old image from R2
    if "featured_image_url" in update_data:
        old_url = first_row(existing.data).get("featured_image_url")
        new_url = update_data["featured_image_url"]
        if old_url and old_url != new_url:
            _delete_r2_image_if_ours(old_url)

    if "slug" in update_data:
        dup = (
            supabase.table("blog_posts")
            .select("id")
            .eq("slug", update_data["slug"])
            .neq("id", post_id)
            .execute()
        )
        if dup.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A post with this slug already exists",
            )

    if "status" in update_data and update_data["status"] == "published":
        if not first_row(existing.data).get("published_at"):
            update_data["published_at"] = datetime.utcnow().isoformat()

    if update_data:
        supabase.table("blog_posts").update(update_data).eq("id", post_id).execute()

    if data.category_ids is not None:
        supabase.table("blog_post_categories").delete().eq("post_id", post_id).execute()
        for cid in data.category_ids:
            supabase.table("blog_post_categories").insert(
                {"post_id": post_id, "category_id": cid}
            ).execute()

    if data.tag_ids is not None:
        supabase.table("blog_post_tags").delete().eq("post_id", post_id).execute()
        for tid in data.tag_ids:
            supabase.table("blog_post_tags").insert(
                {"post_id": post_id, "tag_id": tid}
            ).execute()

    await log_admin_action(current_admin["id"], "update_blog_post", "blog_post", post_id)

    full = (
        supabase.table("blog_posts")
        .select(
            """
            *,
            author:users(id, name, username, profile_picture_url),
            categories:blog_post_categories(
                category:blog_categories(id, name, slug)
            ),
            tags:blog_post_tags(
                tag:blog_tags(id, name, slug)
            )
        """
        )
        .eq("id", post_id)
        .execute()
    )
    return _transform_post(first_row(full.data))


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """Delete a blog post and its featured image from R2."""
    supabase = get_supabase_client()

    existing = (
        supabase.table("blog_posts")
        .select("id, featured_image_url")
        .eq("id", post_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    # Delete featured image from R2 before removing the row
    _delete_r2_image_if_ours(first_row(existing.data).get("featured_image_url"))

    supabase.table("blog_posts").delete().eq("id", post_id).execute()
    await log_admin_action(current_admin["id"], "delete_blog_post", "blog_post", post_id)


@router.post("/posts/{post_id}/publish")
async def publish_post(
    post_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """Publish a post (set status to published)."""
    supabase = get_supabase_client()

    existing = (
        supabase.table("blog_posts")
        .select("id, published_at")
        .eq("id", post_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    published_at = (
        first_row(existing.data).get("published_at")
        or datetime.utcnow().isoformat()
    )
    supabase.table("blog_posts").update(
        {"status": "published", "published_at": published_at}
    ).eq("id", post_id).execute()

    await log_admin_action(current_admin["id"], "publish_blog_post", "blog_post", post_id)
    return {"message": "Post published"}


# --- Image upload & delete ---

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB


def _delete_r2_image_if_ours(url: Optional[str]) -> None:
    """Delete image from R2 if URL is from our bucket. Silently no-op if not configured or external URL."""
    if not url or not settings.CLOUDFLARE_PUBLIC_URL or not settings.CLOUDFLARE_BUCKET_NAME:
        return
    base = settings.CLOUDFLARE_PUBLIC_URL.rstrip("/")
    if not url.startswith(base + "/"):
        return  # External URL, not our R2
    r2_key = url[len(base) + 1 :].split("?")[0].lstrip("/")
    if not r2_key or not r2_key.startswith("blog/"):
        return
    try:
        import boto3

        s3 = boto3.client(
            "s3",
            endpoint_url=settings.cloudflare_r2_endpoint_url,
            aws_access_key_id=settings.CLOUDFLARE_ACCESS_KEY_ID,
            aws_secret_access_key=settings.CLOUDFLARE_SECRET_ACCESS_KEY,
            region_name="auto",
        )
        s3.delete_object(Bucket=settings.CLOUDFLARE_BUCKET_NAME, Key=r2_key)
    except Exception:
        pass  # Log in prod; don't fail the request


async def _validate_image(file: UploadFile, content: bytes) -> tuple[bool, str]:
    """Validate image file. Returns (is_valid, error_message)."""
    if len(content) > MAX_IMAGE_SIZE:
        return False, "Image must be under 5MB"
    mime = file.content_type or ""
    if mime not in ALLOWED_IMAGE_TYPES:
        return False, f"Invalid image type. Allowed: jpeg, png, gif, webp"
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        return False, "Invalid file extension"
    return True, ""


@router.post("/upload-image", response_model=BlogImageUploadResponse)
async def upload_blog_image(
    file: UploadFile = File(...),
    current_admin: dict = Depends(get_current_admin),
):
    """Upload an image for blog (featured or inline). Returns URL."""
    if not settings.CLOUDFLARE_ACCOUNT_ID or not settings.CLOUDFLARE_PUBLIC_URL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image upload is not configured. Set Cloudflare R2 env vars.",
        )

    content = await file.read()
    valid, err = await _validate_image(file, content)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err,
        )

    ext = os.path.splitext(file.filename or "image.jpg")[1].lower() or ".jpg"
    unique = str(uuid.uuid4())
    r2_key = f"blog/{current_admin['id']}/{unique}{ext}"

    try:
        import boto3

        s3 = boto3.client(
            "s3",
            endpoint_url=settings.cloudflare_r2_endpoint_url,
            aws_access_key_id=settings.CLOUDFLARE_ACCESS_KEY_ID,
            aws_secret_access_key=settings.CLOUDFLARE_SECRET_ACCESS_KEY,
            region_name="auto",
        )
        s3.put_object(
            Bucket=settings.CLOUDFLARE_BUCKET_NAME,
            Key=r2_key,
            Body=content,
            ContentType=file.content_type or "image/jpeg",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}",
        )

    url = f"{settings.CLOUDFLARE_PUBLIC_URL.rstrip('/')}/{r2_key}"
    return BlogImageUploadResponse(url=url, filename=file.filename or "image.jpg")
