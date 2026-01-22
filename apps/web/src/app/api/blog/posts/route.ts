import { getServerClient } from "@/lib/supabase";
import type {
  BlogListResponse,
  BlogPost,
  DbBlogPost,
  DbBlogCategory,
  DbBlogTag,
} from "@/lib/blog/types";
import { NextRequest, NextResponse } from "next/server";

// Type for Supabase joined post result
interface PostWithRelations extends DbBlogPost {
  author: { id: string; name: string; profile_picture_url: string | null };
  blog_post_categories: Array<{ category: DbBlogCategory | null }>;
  blog_post_tags: Array<{ tag: DbBlogTag | null }>;
}

// Transform database row to BlogPost format
function transformPost(
  post: DbBlogPost,
  author: { id: string; name: string; profile_picture_url: string | null },
  categories: DbBlogCategory[],
  tags: DbBlogTag[],
): BlogPost {
  // Estimate read time based on content length (average 200 words per minute)
  const wordCount = post.content.split(/\s+/).length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    content: post.content,
    excerpt: post.excerpt || undefined,
    featured_image: post.featured_image_url || undefined,
    status: post.status,
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get("category");
  const tag = searchParams.get("tag");
  const search = searchParams.get("search");
  const limit = parseInt(searchParams.get("limit") || "10");
  const offset = parseInt(searchParams.get("offset") || "0");

  const supabase = getServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  try {
    // Build the query for posts
    let query = supabase
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
      `,
        { count: "exact" },
      )
      .eq("status", "published")
      .order("published_at", { ascending: false });

    // Filter by category - need to filter after fetch for nested relations
    // Filter by tag - need to filter after fetch for nested relations

    // Search in title and excerpt
    if (search) {
      query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: posts, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch posts", details: error.message },
        { status: 500 },
      );
    }

    // Transform posts
    let transformedPosts: BlogPost[] = (posts as PostWithRelations[]).map(
      (post) => {
        const categories =
          post.blog_post_categories
            ?.map((pc) => pc.category)
            .filter((c): c is DbBlogCategory => c !== null) || [];
        const tags =
          post.blog_post_tags
            ?.map((pt) => pt.tag)
            .filter((t): t is DbBlogTag => t !== null) || [];

        return transformPost(post, post.author, categories, tags);
      },
    );

    // Filter by category (client-side filtering for nested relation)
    if (category) {
      transformedPosts = transformedPosts.filter((post) =>
        post.categories.some((cat) => cat.slug === category),
      );
    }

    // Filter by tag (client-side filtering for nested relation)
    if (tag) {
      transformedPosts = transformedPosts.filter((post) =>
        post.tags.some((t) => t.slug === tag),
      );
    }

    const response: BlogListResponse = {
      posts: transformedPosts,
      total: count || transformedPosts.length,
      page: 1,
      per_page: limit,
      total_pages: Math.ceil((count || transformedPosts.length) / limit),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 },
    );
  }
}
