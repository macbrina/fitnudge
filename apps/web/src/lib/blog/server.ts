/**
 * Server-side blog utilities for generateMetadata, etc.
 */

import { getServerClient } from "@/lib/supabase";
import { getPostBySlug } from "./data";
export async function fetchBlogPostForMetadata(slug: string): Promise<{
  title: string;
  excerpt: string | null;
  featured_image_url: string | null;
} | null> {
  const supabase = getServerClient();

  if (!supabase) {
    const post = getPostBySlug(slug);
    if (!post || post.status !== "published") return null;
    return {
      title: post.title,
      excerpt: post.excerpt ?? null,
      featured_image_url: post.featured_image ?? null,
    };
  }

  const { data: post, error } = await supabase
    .from("blog_posts")
    .select("title, excerpt, featured_image_url")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !post) return null;

  return {
    title: post.title,
    excerpt: post.excerpt ?? null,
    featured_image_url: post.featured_image_url ?? null,
  };
}
