import { getServerClient } from "@/lib/supabase";
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
    is_featured?: boolean;
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
    is_featured: post.is_featured ?? false,
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
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "3");

  const supabase = getServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    // First, get the current post to find its categories and tags
    const { data: currentPost, error: postError } = await supabase
      .from("blog_posts")
      .select(
        `
        id,
        blog_post_categories(category_id),
        blog_post_tags(tag_id)
      `
      )
      .eq("slug", slug)
      .single();

    if (postError || !currentPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const categoryIds =
      currentPost.blog_post_categories?.map(
        (pc: { category_id: string }) => pc.category_id
      ) || [];
    const tagIds =
      currentPost.blog_post_tags?.map((pt: { tag_id: string }) => pt.tag_id) ||
      [];

    // Find related posts
    const { data: relatedPosts, error } = await supabase
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
      .eq("status", "published")
      .neq("id", currentPost.id)
      .order("published_at", { ascending: false })
      .limit(limit * 2); // Fetch more to allow for scoring

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch related posts" },
        { status: 500 }
      );
    }

    if (!relatedPosts || relatedPosts.length === 0) {
      return NextResponse.json([]);
    }

    // Score and sort by relevance (shared categories and tags)
    const scoredPosts = relatedPosts.map(
      (post: {
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
        author: {
          id: string;
          name: string;
          profile_picture_url: string | null;
        };
        blog_post_categories: Array<{ category: DbBlogCategory | null }>;
        blog_post_tags: Array<{ tag: DbBlogTag | null }>;
      }) => {
        const postCategoryIds =
          post.blog_post_categories
            ?.map((pc) => pc.category?.id)
            .filter((id): id is string => Boolean(id)) || [];
        const postTagIds =
          post.blog_post_tags
            ?.map((pt) => pt.tag?.id)
            .filter((id): id is string => Boolean(id)) || [];

        const categoryScore = postCategoryIds.filter((id) =>
          categoryIds.includes(id)
        ).length;
        const tagScore = postTagIds.filter((id) => tagIds.includes(id)).length;

        return { post, score: categoryScore * 2 + tagScore };
      }
    );

    scoredPosts.sort(
      (a: { score: number }, b: { score: number }) => b.score - a.score
    );

    const transformedPosts: BlogPost[] = scoredPosts.slice(0, limit).map(
      ({
        post,
      }: {
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
          author: {
            id: string;
            name: string;
            profile_picture_url: string | null;
          };
          blog_post_categories: Array<{ category: DbBlogCategory | null }>;
          blog_post_tags: Array<{ tag: DbBlogTag | null }>;
        };
      }) => {
        const categories =
          post.blog_post_categories
            ?.map((pc) => pc.category)
            .filter((c): c is DbBlogCategory => c !== null) || [];
        const tags =
          post.blog_post_tags
            ?.map((pt) => pt.tag)
            .filter((t): t is DbBlogTag => t !== null) || [];
        return transformPost(post, post.author, categories, tags);
      }
    );

    return NextResponse.json(transformedPosts);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch related posts" },
      { status: 500 }
    );
  }
}
