import { getServerClient } from "@/lib/supabase";
import { getPostBySlug } from "@/lib/blog/data";
import type { BlogPost, DbBlogCategory, DbBlogTag } from "@/lib/blog/types";
import { NextRequest, NextResponse } from "next/server";

// Transform database row to BlogPost format
function transformPost(
  post: {
    id: string;
    title: string;
    slug: string;
    content: string;
    excerpt: string | null;
    featured_image_url: string | null;
    status: string;
    published_at: string | null;
    created_at: string;
    updated_at: string;
  },
  author: { id: string; name: string; profile_picture_url: string | null },
  categories: DbBlogCategory[],
  tags: DbBlogTag[]
): BlogPost {
  const wordCount = post.content.split(/\s+/).length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    content: post.content,
    excerpt: post.excerpt || undefined,
    featured_image: post.featured_image_url || undefined,
    status: post.status as "draft" | "published" | "archived",
    published_at: post.published_at || undefined,
    created_at: post.created_at,
    updated_at: post.updated_at,
    read_time: readTime,
    author: {
      id: author.id,
      name: author.name || "Anonymous",
      avatar: author.profile_picture_url || undefined,
    },
    categories: categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description || undefined,
      created_at: cat.created_at,
    })),
    tags: tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      created_at: tag.created_at,
    })),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const supabase = getServerClient();

  // Supabase not configured
  if (!supabase) {
    const post = getPostBySlug(slug);
    if (!post || post.status !== "published") {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    return NextResponse.json(post);
  }

  try {
    const { data: post, error } = await supabase
      .from("blog_posts")
      .select(
        `
        *,
        author:users!author_id(id, name, profile_picture_url),
        blog_post_categories(
          category:blog_categories(*)
        ),
        blog_post_tags(
          tag:blog_tags(*)
        )
      `
      )
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (error || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const categories =
      post.blog_post_categories
        ?.map((pc: { category: DbBlogCategory | null }) => pc.category)
        .filter(
          (c: DbBlogCategory | null): c is DbBlogCategory => c !== null
        ) || [];
    const tags =
      post.blog_post_tags
        ?.map((pt: { tag: DbBlogTag | null }) => pt.tag)
        .filter((t: DbBlogTag | null): t is DbBlogTag => t !== null) || [];

    const transformedPost = transformPost(post, post.author, categories, tags);

    return NextResponse.json(transformedPost);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch post" },
      { status: 500 }
    );
  }
}
