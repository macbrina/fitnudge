from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.core.flexible_auth import get_current_user

router = APIRouter(
    redirect_slashes=False
)  # Disable redirects to preserve Authorization header


# Pydantic models
class BlogPostResponse(BaseModel):
    id: str
    title: str
    slug: str
    content: str
    excerpt: Optional[str]
    featured_image_url: Optional[str]
    status: str
    author_id: str
    published_at: Optional[str]
    created_at: str
    updated_at: str
    author: dict  # Author info
    categories: List[dict]
    tags: List[dict]


class BlogPostCreate(BaseModel):
    title: str
    content: str
    excerpt: Optional[str] = None
    featured_image_url: Optional[str] = None
    status: str = "draft"
    category_ids: List[str] = []
    tag_ids: List[str] = []


class BlogPostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    excerpt: Optional[str] = None
    featured_image_url: Optional[str] = None
    status: Optional[str] = None
    category_ids: Optional[List[str]] = None
    tag_ids: Optional[List[str]] = None


class BlogCategoryResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str]
    created_at: str
    post_count: int


class BlogTagResponse(BaseModel):
    id: str
    name: str
    slug: str
    created_at: str


class BlogCategoryCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None


class BlogTagCreate(BaseModel):
    name: str
    slug: str


# Public blog endpoints (no authentication required)
@router.get("/posts", response_model=List[BlogPostResponse])
async def get_blog_posts(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    category: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
):
    """Get published blog posts (public)"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    offset = (page - 1) * limit

    query = (
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
        .eq("status", "published")
    )

    if category:
        # Filter by category
        query = query.in_(
            "id",
            supabase.table("blog_post_categories")
            .select("post_id")
            .in_(
                "category_id",
                supabase.table("blog_categories")
                .select("id")
                .eq("slug", category)
                .execute()
                .data,
            )
            .execute()
            .data,
        )

    if tag:
        # Filter by tag
        query = query.in_(
            "id",
            supabase.table("blog_post_tags")
            .select("post_id")
            .in_(
                "tag_id",
                supabase.table("blog_tags").select("id").eq("slug", tag).execute().data,
            )
            .execute()
            .data,
        )

    if search:
        # Full-text search
        query = query.text_search("title,content,excerpt", search)

    result = (
        query.order("published_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data


@router.get("/posts/{slug}", response_model=BlogPostResponse)
async def get_blog_post(slug: str):
    """Get single blog post by slug (public)"""
    from app.core.database import get_supabase_client

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
        .eq("slug", slug)
        .eq("status", "published")
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Blog post not found"
        )

    return result.data[0]


@router.get("/categories", response_model=List[BlogCategoryResponse])
async def get_blog_categories():
    """Get blog categories with post counts"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()
    result = (
        supabase.table("blog_categories")
        .select(
            """
        *,
        post_count:blog_post_categories(count)
    """
        )
        .execute()
    )

    return result.data


@router.post("/posts/{post_id}/view")
async def track_post_view(post_id: str):
    """Track blog post view for analytics"""
    from app.core.database import get_supabase_client

    supabase = get_supabase_client()

    # Increment view count (you might want to implement this in the database)
    # For now, just return success
    return {"message": "View tracked"}


# Admin blog management endpoints (require authentication)
@router.get("/admin/posts", response_model=List[BlogPostResponse])
async def get_admin_blog_posts(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    status_filter: Optional[str] = None,
):
    """Get all blog posts for admin (including drafts)"""
    from app.core.database import get_supabase_client

    # Check if user is admin
    supabase = get_supabase_client()
    admin_check = (
        supabase.table("admin_users")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("is_active", True)
        .execute()
    )
    if not admin_check.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    offset = (page - 1) * limit
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
    """
    )

    if status_filter:
        query = query.eq("status", status_filter)

    result = (
        query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    )
    return result.data


@router.post(
    "/admin/posts", response_model=BlogPostResponse, status_code=status.HTTP_201_CREATED
)
async def create_blog_post(
    post_data: BlogPostCreate, current_user: dict = Depends(get_current_user)
):
    """Create new blog post (admin only)"""
    from app.core.database import get_supabase_client

    # Check if user is admin
    supabase = get_supabase_client()
    admin_check = (
        supabase.table("admin_users")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("is_active", True)
        .execute()
    )
    if not admin_check.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    # Generate slug from title
    import re

    slug = re.sub(r"[^a-zA-Z0-9\s-]", "", post_data.title.lower())
    slug = re.sub(r"\s+", "-", slug.strip())

    # Ensure unique slug
    original_slug = slug
    counter = 1
    while True:
        existing = supabase.table("blog_posts").select("id").eq("slug", slug).execute()
        if not existing.data:
            break
        slug = f"{original_slug}-{counter}"
        counter += 1

    post = {
        "title": post_data.title,
        "slug": slug,
        "content": post_data.content,
        "excerpt": post_data.excerpt,
        "featured_image_url": post_data.featured_image_url,
        "status": post_data.status,
        "author_id": current_user["id"],
        "published_at": (
            datetime.utcnow().isoformat() if post_data.status == "published" else None
        ),
    }

    result = supabase.table("blog_posts").insert(post).execute()
    post_id = result.data[0]["id"]

    # Add categories
    if post_data.category_ids:
        for category_id in post_data.category_ids:
            supabase.table("blog_post_categories").insert(
                {"post_id": post_id, "category_id": category_id}
            ).execute()

    # Add tags
    if post_data.tag_ids:
        for tag_id in post_data.tag_ids:
            supabase.table("blog_post_tags").insert(
                {"post_id": post_id, "tag_id": tag_id}
            ).execute()

    # Get full post with relationships
    full_post = (
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

    return full_post.data[0]


@router.put("/admin/posts/{post_id}", response_model=BlogPostResponse)
async def update_blog_post(
    post_id: str,
    post_data: BlogPostUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update blog post (admin only)"""
    from app.core.database import get_supabase_client

    # Check if user is admin
    supabase = get_supabase_client()
    admin_check = (
        supabase.table("admin_users")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("is_active", True)
        .execute()
    )
    if not admin_check.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    # Check if post exists
    existing_post = supabase.table("blog_posts").select("*").eq("id", post_id).execute()
    if not existing_post.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Blog post not found"
        )

    update_data = {
        k: v
        for k, v in post_data.dict().items()
        if v is not None and k not in ["category_ids", "tag_ids"]
    }

    if update_data:
        supabase.table("blog_posts").update(update_data).eq("id", post_id).execute()

    # Update categories if provided
    if post_data.category_ids is not None:
        # Remove existing categories
        supabase.table("blog_post_categories").delete().eq("post_id", post_id).execute()

        # Add new categories
        for category_id in post_data.category_ids:
            supabase.table("blog_post_categories").insert(
                {"post_id": post_id, "category_id": category_id}
            ).execute()

    # Update tags if provided
    if post_data.tag_ids is not None:
        # Remove existing tags
        supabase.table("blog_post_tags").delete().eq("post_id", post_id).execute()

        # Add new tags
        for tag_id in post_data.tag_ids:
            supabase.table("blog_post_tags").insert(
                {"post_id": post_id, "tag_id": tag_id}
            ).execute()

    # Get updated post
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

    return result.data[0]


@router.delete("/admin/posts/{post_id}")
async def delete_blog_post(
    post_id: str, current_user: dict = Depends(get_current_user)
):
    """Delete blog post (admin only)"""
    from app.core.database import get_supabase_client

    # Check if user is admin
    supabase = get_supabase_client()
    admin_check = (
        supabase.table("admin_users")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("is_active", True)
        .execute()
    )
    if not admin_check.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    # Check if post exists
    existing_post = supabase.table("blog_posts").select("*").eq("id", post_id).execute()
    if not existing_post.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Blog post not found"
        )

    supabase.table("blog_posts").delete().eq("id", post_id).execute()
    return {"message": "Blog post deleted successfully"}


@router.post("/admin/posts/{post_id}/publish")
async def publish_blog_post(
    post_id: str, current_user: dict = Depends(get_current_user)
):
    """Publish blog post (admin only)"""
    from app.core.database import get_supabase_client

    # Check if user is admin
    supabase = get_supabase_client()
    admin_check = (
        supabase.table("admin_users")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("is_active", True)
        .execute()
    )
    if not admin_check.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    # Update post status
    supabase.table("blog_posts").update(
        {"status": "published", "published_at": datetime.utcnow().isoformat()}
    ).eq("id", post_id).execute()

    return {"message": "Blog post published successfully"}


@router.get("/admin/categories", response_model=List[BlogCategoryResponse])
async def get_admin_categories(current_user: dict = Depends(get_current_user)):
    """Get blog categories for admin"""
    from app.core.database import get_supabase_client

    # Check if user is admin
    supabase = get_supabase_client()
    admin_check = (
        supabase.table("admin_users")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("is_active", True)
        .execute()
    )
    if not admin_check.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    result = supabase.table("blog_categories").select("*").execute()
    return result.data


@router.post(
    "/admin/categories",
    response_model=BlogCategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_blog_category(
    category_data: BlogCategoryCreate, current_user: dict = Depends(get_current_user)
):
    """Create blog category (admin only)"""
    from app.core.database import get_supabase_client

    # Check if user is admin
    supabase = get_supabase_client()
    admin_check = (
        supabase.table("admin_users")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("is_active", True)
        .execute()
    )
    if not admin_check.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    category = {
        "name": category_data.name,
        "slug": category_data.slug,
        "description": category_data.description,
    }

    result = supabase.table("blog_categories").insert(category).execute()
    return result.data[0]


@router.get("/admin/analytics")
async def get_blog_analytics(current_user: dict = Depends(get_current_user)):
    """Get blog analytics (admin only)"""
    from app.core.database import get_supabase_client

    # Check if user is admin
    supabase = get_supabase_client()
    admin_check = (
        supabase.table("admin_users")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("is_active", True)
        .execute()
    )
    if not admin_check.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    # Get basic analytics
    total_posts = supabase.table("blog_posts").select("id", count="exact").execute()
    published_posts = (
        supabase.table("blog_posts")
        .select("id", count="exact")
        .eq("status", "published")
        .execute()
    )
    draft_posts = (
        supabase.table("blog_posts")
        .select("id", count="exact")
        .eq("status", "draft")
        .execute()
    )

    return {
        "total_posts": total_posts.count,
        "published_posts": published_posts.count,
        "draft_posts": draft_posts.count,
        "categories_count": len(
            supabase.table("blog_categories").select("id").execute().data
        ),
    }
