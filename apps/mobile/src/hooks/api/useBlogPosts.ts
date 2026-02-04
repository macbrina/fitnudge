/**
 * Blog Posts Hook - V2
 *
 * React Query hooks for fetching blog posts from the backend API.
 */

import { useQuery } from "@tanstack/react-query";
import { blogQueryKeys } from "./queryKeys";
import { BlogPost, BlogCategory, blogService } from "@/services/api/blog";

/**
 * Hook to fetch blog posts with pagination
 */
export function useBlogPosts(params?: { page?: number; limit?: number; category?: string }) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 10;
  const category = params?.category;

  return useQuery({
    queryKey: blogQueryKeys.postsPaginated(page, limit, category),
    queryFn: async () => {
      const response = await blogService.getPosts({ page, limit, category });
      return response.data?.data ?? [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30 // 30 minutes (renamed from cacheTime in v5)
  });
}

/**
 * Hook to fetch featured blog posts
 */
export function useFeaturedBlogPosts(limit: number = 3) {
  return useQuery({
    queryKey: blogQueryKeys.featured(limit),
    queryFn: async () => {
      const response = await blogService.getFeaturedPosts(limit);
      return response.data ?? [];
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30
  });
}

/**
 * Hook to fetch blog categories
 */
export function useBlogCategories() {
  return useQuery({
    queryKey: blogQueryKeys.categories(),
    queryFn: async () => {
      const response = await blogService.getCategories();
      return response.data ?? [];
    },
    staleTime: 1000 * 60 * 60 // 1 hour - categories don't change often
  });
}

/**
 * Track blog post view (fire and forget)
 */
export function trackBlogPostView(postId: string) {
  blogService.trackView(postId);
}

// Export types for convenience
export type { BlogPost, BlogCategory };
