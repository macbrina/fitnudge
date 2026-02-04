import { getServerClient } from "@/lib/supabase";
import type {
  BlogListResponse,
  BlogPost,
  DbBlogPost,
  DbBlogCategory,
  DbBlogTag,
} from "@/lib/blog/types";
import { NextRequest, NextResponse } from "next/server";

const POSTS_PER_PAGE = 6;

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
  const page = parseInt(searchParams.get("page") || "1");

  const supabase = getServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  const defaultAuthor = {
    id: "",
    name: "Anonymous",
    profile_picture_url: null as string | null,
  };

  function mapToBlogPost(post: PostWithRelations): BlogPost {
    const categories =
      post.blog_post_categories
        ?.map((pc) => pc.category)
        .filter((c): c is DbBlogCategory => c !== null) || [];
    const tags =
      post.blog_post_tags
        ?.map((pt) => pt.tag)
        .filter((t): t is DbBlogTag => t !== null) || [];
    const author = post.author ?? defaultAuthor;
    return transformPost(post, author, categories, tags);
  }

  try {
    const hasCategoryOrTagOrSearch = !!(category || tag || search);

    // Featured-aware pagination: only when no category/tag/search filter
    if (!hasCategoryOrTagOrSearch) {
      const { data: featuredRow } = await supabase
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
        .eq("is_featured", true)
        .limit(1)
        .maybeSingle();

      const hasFeatured = !!featuredRow;
      const featuredPost = featuredRow ? mapToBlogPost(featuredRow as PostWithRelations) : null;

      const { count: totalCount } = await supabase
        .from("blog_posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "published");

      const total = totalCount ?? 0;

      if (page === 1) {
        const gridLimit = POSTS_PER_PAGE;
        const excludeId = featuredPost?.id;

        const gridQuery = supabase
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
          .order("published_at", { ascending: false });

        if (excludeId) {
          gridQuery.neq("id", excludeId);
        }

        const { data: gridRows } = await gridQuery.range(0, gridLimit - 1);

        const gridPosts = (gridRows || []).map((p) => mapToBlogPost(p as PostWithRelations));

        const posts = hasFeatured && featuredPost
          ? [featuredPost, ...gridPosts]
          : gridPosts;

        const totalPages = hasFeatured
          ? total <= 7
            ? 1
            : 1 + Math.ceil((total - 7) / POSTS_PER_PAGE)
          : Math.ceil(total / POSTS_PER_PAGE);

        const response: BlogListResponse = {
          posts,
          total,
          page: 1,
          per_page: hasFeatured ? 7 : 6,
          total_pages: Math.max(1, totalPages),
          has_featured: hasFeatured,
        };
        return NextResponse.json(response);
      }

      const pageOffset = (page - 1) * POSTS_PER_PAGE;
      const excludeId = featuredPost?.id;

      let listQuery = supabase
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
          { count: "exact" }
        )
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (excludeId) {
        listQuery = listQuery.neq("id", excludeId);
      }

      const { data: listRows, count: listCount } = await listQuery.range(
        pageOffset,
        pageOffset + POSTS_PER_PAGE - 1
      );

      const posts = (listRows || []).map((p) => mapToBlogPost(p as PostWithRelations));
      const totalPages = hasFeatured
        ? Math.ceil((total - 1) / POSTS_PER_PAGE)
        : Math.ceil(total / POSTS_PER_PAGE);

      const response: BlogListResponse = {
        posts,
        total,
        page,
        per_page: POSTS_PER_PAGE,
        total_pages: Math.max(1, totalPages),
        has_featured: hasFeatured,
      };
      return NextResponse.json(response);
    }

    // With category/tag/search: standard pagination, no featured
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
        { count: "exact" }
      )
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (search) {
      query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: posts, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch posts", details: error.message },
        { status: 500 },
      );
    }

    let transformedPosts: BlogPost[] = (posts as PostWithRelations[]).map(mapToBlogPost);

    if (category) {
      transformedPosts = transformedPosts.filter((post) =>
        post.categories.some((cat) => cat.slug === category)
      );
    }
    if (tag) {
      transformedPosts = transformedPosts.filter((post) =>
        post.tags.some((t) => t.slug === tag)
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
