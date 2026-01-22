/**
 * Blog API Service - V2
 *
 * Fetches published blog posts for display in the mobile app.
 * Blog posts open externally via in-app browser (LinkText component).
 */

import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

// ==========================================
// TYPES (matches backend blog_posts schema)
// ==========================================

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface BlogTag {
  id: string;
  name: string;
  slug: string;
}

export interface BlogAuthor {
  id: string;
  name: string;
  profile_picture_url?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  featured_image_url?: string;
  status: "draft" | "published" | "archived";
  author: BlogAuthor;
  published_at: string;
  created_at: string;
  updated_at: string;
  categories: BlogCategory[];
  tags: BlogTag[];
  // Reading time estimate (calculated from content length)
  reading_time_minutes?: number;
  // View count for popular posts
  view_count?: number;
}

export interface BlogPostsResponse {
  data: BlogPost[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface BlogCategoriesResponse {
  data: BlogCategory[];
}

// ==========================================
// BLOG SERVICE CLASS
// ==========================================

class BlogService extends BaseApiService {
  /**
   * Get published blog posts with pagination
   */
  async getPosts(params?: {
    page?: number;
    limit?: number;
    category?: string;
  }): Promise<ApiResponse<BlogPostsResponse>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.category) queryParams.append("category", params.category);

    const url = queryParams.toString()
      ? `${ROUTES.BLOG.POSTS}?${queryParams.toString()}`
      : ROUTES.BLOG.POSTS;

    return this.get<BlogPostsResponse>(url);
  }

  /**
   * Get featured blog posts (most recent, high engagement)
   */
  async getFeaturedPosts(limit: number = 5): Promise<ApiResponse<BlogPost[]>> {
    return this.get<BlogPost[]>(`${ROUTES.BLOG.POSTS}?limit=${limit}&featured=true`);
  }

  /**
   * Get blog categories
   */
  async getCategories(): Promise<ApiResponse<BlogCategory[]>> {
    return this.get<BlogCategory[]>(ROUTES.BLOG.CATEGORIES);
  }

  /**
   * Track blog post view (fire and forget)
   */
  async trackView(postId: string): Promise<void> {
    try {
      await this.post(ROUTES.BLOG.TRACK_VIEW(postId), {});
    } catch {
      // Silently fail - analytics shouldn't block UX
    }
  }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

export const blogService = new BlogService();
