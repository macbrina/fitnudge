"use client";

import { LandingLayout } from "@/components/layout/LandingLayout";
import { Newsletter } from "@/components/landing/newsletter";
import { fetchBlogPosts, fetchCategories } from "@/lib/blog/api";
import type { BlogCategory, BlogPost } from "@/lib/blog/types";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@fitnudge/ui";
import { format } from "date-fns";
import { motion } from "framer-motion";
import Lottie from "lottie-react";
import {
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Folder,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// Empty state animation - cute illustration for no content
const EMPTY_STATE_ANIMATION_URL =
  "https://assets2.lottiefiles.com/packages/lf20_ysrn2iwp.json";

const POSTS_PER_PAGE = 6;

function formatDate(dateString: string): string {
  return format(new Date(dateString), "MMM d, yyyy");
}

function BlogCard({
  post,
  index,
  t,
}: {
  post: BlogPost;
  index: number;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      className="group bg-background rounded-2xl border border-border overflow-hidden hover:shadow-xl transition-all duration-300"
    >
      {/* Image placeholder */}
      <div className="relative h-48 bg-linear-to-br from-primary/20 to-primary/5 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center p-4">
            <Folder className="h-10 w-10 text-primary/40 mx-auto mb-2" />
            <span className="text-sm text-primary/60 font-medium">
              {post.categories[0]?.name || t("web.blog.article")}
            </span>
          </div>
        </div>
        <div className="absolute inset-0 bg-linear-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="p-6">
        {/* Categories */}
        <div className="flex flex-wrap gap-2 mb-3">
          {post.categories.slice(0, 2).map((category) => (
            <Link
              key={category.id}
              href={`/blog?category=${category.slug}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full hover:bg-primary/20 transition-colors"
            >
              {category.name}
            </Link>
          ))}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-foreground mb-3 line-clamp-2 group-hover:text-primary transition-colors">
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </h3>

        {/* Excerpt */}
        <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
          {post.excerpt}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            <span>{post.author.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatDate(post.published_at || post.created_at)}</span>
          </div>
          {post.read_time && (
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{t("web.blog.min_read", { minutes: post.read_time })}</span>
            </div>
          )}
        </div>

        {/* Read More Link */}
        <Link
          href={`/blog/${post.slug}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:gap-3 transition-all"
        >
          {t("web.blog.read_article")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </motion.article>
  );
}

function FeaturedPost({
  post,
  t,
}: {
  post: BlogPost;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="relative bg-linear-to-br from-primary to-primary/80 rounded-3xl overflow-hidden"
    >
      <div className="grid lg:grid-cols-2 gap-0">
        {/* Content */}
        <div className="p-8 sm:p-10 lg:p-12 flex flex-col justify-center">
          <div className="flex flex-wrap gap-2 mb-4">
            {post.categories.map((category) => (
              <span
                key={category.id}
                className="inline-flex items-center gap-1 text-xs font-medium text-white/90 bg-white/20 px-3 py-1 rounded-full"
              >
                {category.name}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 text-xs font-medium text-white bg-white/30 px-3 py-1 rounded-full">
              {t("web.blog.featured")}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4 leading-tight">
            {post.title}
          </h2>

          <p className="text-white/80 text-base sm:text-lg mb-6 line-clamp-3">
            {post.excerpt}
          </p>

          <div className="flex items-center gap-4 text-sm text-white/70 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
              <span>{post.author.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(post.published_at || post.created_at)}</span>
            </div>
            {post.read_time && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{t("web.blog.min", { minutes: post.read_time })}</span>
              </div>
            )}
          </div>

          <Link href={`/blog/${post.slug}`}>
            <Button
              size="lg"
              className="bg-white text-primary hover:bg-white/90 rounded-full px-8"
            >
              {t("web.blog.read_full_article")}
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
        </div>

        {/* Image placeholder */}
        <div className="hidden lg:flex items-center justify-center p-12 bg-white/5">
          <div className="text-center">
            <div className="w-32 h-32 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
              <Folder className="h-16 w-16 text-white/40" />
            </div>
            <p className="text-white/50 text-sm">
              {t("web.blog.featured_article")}
            </p>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function CategoryFilter({
  categories,
  activeCategory,
  onCategoryChange,
  t,
}: {
  categories: BlogCategory[];
  activeCategory: string | null;
  onCategoryChange: (slug: string | null) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      <button
        onClick={() => onCategoryChange(null)}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          activeCategory === null
            ? "bg-primary text-white"
            : "bg-secondary text-foreground hover:bg-secondary/80"
        }`}
      >
        {t("web.blog.all_posts")}
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onCategoryChange(category.slug)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeCategory === category.slug
              ? "bg-primary text-white"
              : "bg-secondary text-foreground hover:bg-secondary/80"
          }`}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  t,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  t: (key: string) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 mt-12">
      <Button
        variant="outline"
        size="lg"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="rounded-full px-6"
      >
        <ChevronLeft className="h-4 w-4 mr-2" />
        {t("web.blog.pagination.previous")}
      </Button>

      <div className="flex items-center gap-2">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
              currentPage === page
                ? "bg-primary text-white"
                : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
          >
            {page}
          </button>
        ))}
      </div>

      <Button
        variant="outline"
        size="lg"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="rounded-full px-6"
      >
        {t("web.blog.pagination.next")}
        <ChevronRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}

export default function BlogPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read category from URL on initial load
  const urlCategory = searchParams.get("category");

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(
    urlCategory
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emptyAnimationData, setEmptyAnimationData] = useState<any>(null);

  // Load empty state animation
  useEffect(() => {
    fetch(EMPTY_STATE_ANIMATION_URL)
      .then((res) => res.json())
      .then((data) => setEmptyAnimationData(data))
      .catch(() => {
        // Animation failed to load, will show fallback
      });
  }, []);

  // Sync activeCategory with URL changes
  useEffect(() => {
    setActiveCategory(urlCategory);
    setCurrentPage(1);
  }, [urlCategory]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // Calculate offset and limit based on page and category
        // Without category filter:
        //   - Page 1: offset=0, limit=7 (1 featured + 6 in grid)
        //   - Page 2: offset=7, limit=6
        //   - Page 3: offset=13, limit=6
        // With category filter:
        //   - Page N: offset=(N-1)*6, limit=6

        let offset: number;
        let limit: number;

        if (!activeCategory) {
          // No category filter - include featured post on page 1
          if (currentPage === 1) {
            offset = 0;
            limit = POSTS_PER_PAGE + 1; // 7 posts (1 featured + 6 grid)
          } else {
            offset = POSTS_PER_PAGE + 1 + (currentPage - 2) * POSTS_PER_PAGE; // 7 + (page-2)*6
            limit = POSTS_PER_PAGE;
          }
        } else {
          // With category filter - standard pagination
          offset = (currentPage - 1) * POSTS_PER_PAGE;
          limit = POSTS_PER_PAGE;
        }

        const [postsData, categoriesData] = await Promise.all([
          fetchBlogPosts({
            category: activeCategory || undefined,
            limit,
            offset,
          }),
          fetchCategories(),
        ]);
        setPosts(postsData.posts);

        // Calculate total pages
        // Without category: page 1 shows 7 (1+6), subsequent pages show 6
        // With category: all pages show 6
        let calculatedTotalPages: number;
        if (!activeCategory) {
          // First page has 7, rest have 6
          // If total <= 7, only 1 page needed
          // Otherwise: 1 + ceil((total - 7) / 6)
          if (postsData.total <= POSTS_PER_PAGE + 1) {
            calculatedTotalPages = 1;
          } else {
            calculatedTotalPages =
              1 +
              Math.ceil(
                (postsData.total - (POSTS_PER_PAGE + 1)) / POSTS_PER_PAGE
              );
          }
        } else {
          calculatedTotalPages = Math.ceil(postsData.total / POSTS_PER_PAGE);
        }

        setTotalPages(calculatedTotalPages > 0 ? calculatedTotalPages : 1);
        setCategories(categoriesData);
      } catch {
        // Failed to load blog data
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeCategory, currentPage]);

  // Update URL when category changes
  const handleCategoryChange = (slug: string | null) => {
    setActiveCategory(slug);
    setCurrentPage(1);

    // Update URL without full page reload
    if (slug) {
      router.push(`/blog?category=${slug}`, { scroll: false });
    } else {
      router.push("/blog", { scroll: false });
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of posts section
    window.scrollTo({ top: 400, behavior: "smooth" });
  };

  const featuredPost = posts[0];
  const otherPosts =
    currentPage === 1 && !activeCategory ? posts.slice(1) : posts;

  return (
    <LandingLayout>
      {/* Hero Section */}
      <section className="relative w-full py-4 sm:py-6 lg:py-8">
        <div className="mx-2 sm:mx-4 bg-primary rounded-2xl sm:rounded-3xl overflow-hidden">
          <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 text-white">
            <div className="text-center max-w-4xl mx-auto">
              <motion.h1
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                {t("web.blog.title")}
              </motion.h1>
              <motion.p
                className="text-base sm:text-lg md:text-xl lg:text-2xl text-blue-100 leading-relaxed max-w-2xl mx-auto"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                {t("web.blog.subtitle")}
              </motion.p>
            </div>
          </div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="relative w-full py-2 sm:py-4">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <CategoryFilter
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
              t={t}
            />
          </div>
        </div>
      </section>

      {/* Featured Post - only show on first page when no category filter */}
      {featuredPost && !activeCategory && currentPage === 1 && (
        <section className="relative w-full py-2 sm:py-4">
          <div className="mx-2 sm:mx-4">
            <div className="max-w-7xl mx-auto">
              <FeaturedPost post={featuredPost} t={t} />
            </div>
          </div>
        </section>
      )}

      {/* Blog Posts Grid */}
      <section className="relative w-full py-2 sm:py-4">
        <div className="mx-2 sm:mx-4 bg-card rounded-2xl sm:rounded-3xl">
          <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="max-w-7xl mx-auto">
              <motion.div
                className="text-center mb-10 sm:mb-12"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
                  {activeCategory
                    ? categories.find((c) => c.slug === activeCategory)?.name ||
                      t("web.blog.articles")
                    : t("web.blog.latest_articles")}
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  {t("web.blog.articles_description")}
                </p>
              </motion.div>

              {loading ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="bg-background rounded-2xl border border-border overflow-hidden animate-pulse"
                    >
                      <div className="h-48 bg-muted" />
                      <div className="p-6 space-y-4">
                        <div className="h-4 bg-muted rounded w-1/3" />
                        <div className="h-6 bg-muted rounded w-full" />
                        <div className="h-4 bg-muted rounded w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                    {otherPosts.map((post, index) => (
                      <BlogCard t={t} key={post.id} post={post} index={index} />
                    ))}
                  </div>

                  {/* Pagination */}
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    t={t}
                  />
                </>
              )}

              {!loading && posts.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-center py-12"
                >
                  {/* Lottie Animation or Fallback */}
                  <div className="w-40 h-40 sm:w-48 sm:h-48 mx-auto mb-2">
                    {emptyAnimationData ? (
                      <Lottie
                        animationData={emptyAnimationData}
                        loop={true}
                        className="w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                          <Folder className="h-10 w-10 text-primary/50" />
                        </div>
                      </div>
                    )}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
                    {t("web.blog.no_articles_found")}
                  </h3>
                  <p className="text-muted-foreground max-w-md mx-auto mb-6">
                    {activeCategory
                      ? t("web.blog.no_articles_category")
                      : t("web.blog.no_articles_empty")}
                  </p>
                  {activeCategory && (
                    <Button
                      variant="outline"
                      onClick={() => handleCategoryChange(null)}
                      className="rounded-full"
                    >
                      {t("web.blog.view_all_posts")}
                    </Button>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <Newsletter />
    </LandingLayout>
  );
}
