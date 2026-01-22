// Blog types matching database schema from 004_infrastructure.sql

export type BlogPostStatus = "draft" | "published" | "archived";

export interface BlogAuthor {
  id: string;
  name: string;
  avatar?: string;
  bio?: string;
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  created_at: string;
}

export interface BlogTag {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string; // HTML content from CKEditor or similar
  excerpt?: string;
  featured_image?: string;
  author: BlogAuthor;
  status: BlogPostStatus;
  published_at?: string;
  created_at: string;
  updated_at: string;
  categories: BlogCategory[];
  tags: BlogTag[];
  read_time?: number; // in minutes
}

export interface BlogListResponse {
  posts: BlogPost[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface BlogFilters {
  category?: string;
  tag?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// Database row types (raw from Supabase)
export interface DbBlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  featured_image_url: string | null;
  status: BlogPostStatus;
  author_id: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface DbBlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

export interface DbBlogTag {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}
