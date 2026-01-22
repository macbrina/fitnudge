// Blog API functions - fetches from API routes
import type { BlogPost, BlogListResponse, BlogFilters, BlogCategory, BlogTag } from "./types";

const API_BASE = "/api/blog";

export async function fetchBlogPosts(filters?: BlogFilters): Promise<BlogListResponse> {
  const params = new URLSearchParams();
  if (filters?.category) params.set("category", filters.category);
  if (filters?.tag) params.set("tag", filters.tag);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.offset !== undefined) params.set("offset", String(filters.offset));

  const url = `${API_BASE}/posts${params.toString() ? `?${params}` : ""}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error("Failed to fetch blog posts");
  }
  
  return response.json();
}

export async function fetchBlogPost(slug: string): Promise<BlogPost | null> {
  const response = await fetch(`${API_BASE}/posts/${slug}`);
  
  if (response.status === 404) {
    return null;
  }
  
  if (!response.ok) {
    throw new Error("Failed to fetch blog post");
  }
  
  return response.json();
}

export async function fetchCategories(): Promise<BlogCategory[]> {
  const response = await fetch(`${API_BASE}/categories`);
  
  if (!response.ok) {
    throw new Error("Failed to fetch categories");
  }
  
  return response.json();
}

export async function fetchTags(): Promise<BlogTag[]> {
  const response = await fetch(`${API_BASE}/tags`);
  
  if (!response.ok) {
    throw new Error("Failed to fetch tags");
  }
  
  return response.json();
}

export async function fetchRelatedPosts(slug: string, limit: number = 3): Promise<BlogPost[]> {
  const response = await fetch(`${API_BASE}/posts/${slug}/related?limit=${limit}`);
  
  if (!response.ok) {
    throw new Error("Failed to fetch related posts");
  }
  
  return response.json();
}
