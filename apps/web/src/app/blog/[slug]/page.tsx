"use client";

import { LandingLayout } from "@/components/layout/LandingLayout";
import { fetchBlogPost, fetchRelatedPosts } from "@/lib/blog/api";
import type { BlogPost } from "@/lib/blog/types";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@fitnudge/ui";
import { format } from "date-fns";
import { motion } from "framer-motion";
import parse from "html-react-parser";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Copy,
  Facebook,
  Linkedin,
  Tag,
  Twitter,
  User,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

function formatDate(dateString: string): string {
  return format(new Date(dateString), "MMM d, yyyy");
}

function ShareButtons({
  post,
  t,
}: {
  post: BlogPost;
  t: (key: string) => string;
}) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      post.title
    )}&url=${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      url
    )}`,
    linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(
      url
    )}&title=${encodeURIComponent(post.title)}`,
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {t("web.blog.share.title")}:
      </span>
      <div className="flex gap-2">
        <a
          href={shareLinks.twitter}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-full bg-secondary hover:bg-primary hover:text-white transition-colors"
          aria-label={t("web.blog.share.twitter")}
        >
          <Twitter className="h-4 w-4" />
        </a>
        <a
          href={shareLinks.facebook}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-full bg-secondary hover:bg-primary hover:text-white transition-colors"
          aria-label={t("web.blog.share.facebook")}
        >
          <Facebook className="h-4 w-4" />
        </a>
        <a
          href={shareLinks.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-full bg-secondary hover:bg-primary hover:text-white transition-colors"
          aria-label={t("web.blog.share.linkedin")}
        >
          <Linkedin className="h-4 w-4" />
        </a>
        <button
          onClick={handleCopy}
          className="p-2 rounded-full bg-secondary hover:bg-primary hover:text-white transition-colors"
          aria-label={t("web.blog.share.copy_link")}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function RelatedPostCard({
  post,
  t,
}: {
  post: BlogPost;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block bg-background rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all"
    >
      <div className="h-32 bg-linear-to-br from-primary/20 to-primary/5 flex items-center justify-center">
        <span className="text-sm text-primary/60 font-medium">
          {post.categories[0]?.name || t("web.blog.article")}
        </span>
      </div>
      <div className="p-4">
        <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
          {post.title}
        </h4>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{t("web.blog.min_read", { minutes: post.read_time })}</span>
        </div>
      </div>
    </Link>
  );
}

export default function BlogPostPage() {
  const { t } = useTranslation();
  const params = useParams();
  const slug = params.slug as string;

  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPost() {
      try {
        setLoading(true);
        const postData = await fetchBlogPost(slug);

        if (!postData) {
          setError(t("web.blog.error.post_not_found"));
          return;
        }

        setPost(postData);

        // Fetch related posts
        const related = await fetchRelatedPosts(slug, 3);
        setRelatedPosts(related);
      } catch {
        setError(t("web.blog.error.failed_to_load"));
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      loadPost();
    }
  }, [slug, t]);

  if (loading) {
    return (
      <LandingLayout>
        <section className="relative w-full py-8 sm:py-12 lg:py-16">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto animate-pulse">
              <div className="h-8 bg-muted rounded w-1/4 mb-8" />
              <div className="h-12 bg-muted rounded w-3/4 mb-4" />
              <div className="h-6 bg-muted rounded w-1/2 mb-8" />
              <div className="space-y-4">
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </div>
            </div>
          </div>
        </section>
      </LandingLayout>
    );
  }

  if (error || !post) {
    return (
      <LandingLayout>
        <section className="relative w-full py-16 sm:py-24 lg:py-32">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-3xl font-bold text-foreground mb-4">
                {t("web.blog.error.not_found_title")}
              </h1>
              <p className="text-muted-foreground mb-8">
                {t("web.blog.error.not_found_description")}
              </p>
              <Link href="/blog">
                <Button className="rounded-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t("web.blog.back_to_blog")}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </LandingLayout>
    );
  }

  return (
    <LandingLayout>
      {/* Back Link */}
      <section className="relative w-full pt-4 sm:pt-6">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("web.blog.back_to_blog")}
            </Link>
          </div>
        </div>
      </section>

      {/* Article Header */}
      <section className="relative w-full py-6 sm:py-8 lg:py-12">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Categories & Tags */}
              <div className="flex flex-wrap gap-2 mb-6">
                {post.categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/blog?category=${category.slug}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full hover:bg-primary/20 transition-colors"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
                {post.title}
              </h1>

              {/* Excerpt */}
              {post.excerpt && (
                <p className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed">
                  {post.excerpt}
                </p>
              )}

              {/* Author & Meta */}
              <div className="flex flex-wrap items-center justify-between gap-6 pb-8 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {post.author.name}
                    </p>
                    {post.author.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {post.author.bio}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {formatDate(post.published_at || post.created_at)}
                    </span>
                  </div>
                  {post.read_time && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>
                        {t("web.blog.min_read", { minutes: post.read_time })}
                      </span>
                    </div>
                  )}
                </div>

                <div className="ml-auto">
                  <ShareButtons post={post} t={t} />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Article Content */}
      <section className="relative w-full py-4 sm:py-6 lg:py-8">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="blog-content"
            >
              {parse(post.content)}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Tags */}
      {post.tags.length > 0 && (
        <section className="relative w-full py-4 sm:py-6">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-wrap items-center gap-3 pt-8 border-t border-border">
                <Tag className="h-4 w-4 text-muted-foreground" />
                {post.tags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/blog?tag=${tag.slug}`}
                    className="text-sm text-muted-foreground hover:text-primary bg-secondary px-3 py-1 rounded-full transition-colors"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="relative w-full py-8 sm:py-12 lg:py-16">
          <div className="mx-2 sm:mx-4 bg-card rounded-2xl sm:rounded-3xl">
            <div className="w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
              <div className="max-w-7xl mx-auto">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-8 text-center">
                  {t("web.blog.related_articles")}
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {relatedPosts.map((relatedPost) => (
                    <RelatedPostCard
                      key={relatedPost.id}
                      post={relatedPost}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="relative w-full py-4 sm:py-6 lg:py-8">
        <div className="mx-2 sm:mx-4 bg-primary rounded-2xl sm:rounded-3xl">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">
                {t("web.blog.cta.title")}
              </h2>
              <p className="text-blue-100 mb-8 max-w-2xl mx-auto text-base sm:text-lg">
                {t("web.blog.cta.description")}
              </p>
              <Link href="/#waitlist-section">
                <Button
                  size="lg"
                  className="bg-white text-primary hover:bg-white/90 rounded-full px-8"
                >
                  {t("web.blog.cta.button")}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
