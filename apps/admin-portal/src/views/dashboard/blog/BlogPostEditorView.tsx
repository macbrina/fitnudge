"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import { Button, Input } from "@fitnudge/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@fitnudge/ui";
import { BlogEditor } from "@/components/blog/BlogEditor";
import {
  useBlogPost,
  useBlogPostCreate,
  useBlogPostUpdate,
  useBlogCategories,
  useBlogCategoryCreate,
  useBlogTags,
  useBlogTagCreate,
} from "@/hooks/api/useBlog";
import { ROUTES } from "@/lib/routes";
import { ArrowLeft, ImagePlus, Plus, X } from "lucide-react";
import { blogApi } from "@/lib/api";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .trim();
}

type Props = {
  postId?: string | null;
};

export function BlogPostEditorView({ postId }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const isEdit = !!postId;

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
  const [isFeatured, setIsFeatured] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [featuredImageUrl, setFeaturedImageUrl] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [featuredImageFile, setFeaturedImageFile] = useState<File | null>(null);
  const [featuredImagePreview, setFeaturedImagePreview] = useState<string>("");

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySlug, setNewCategorySlug] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const featuredImageInputRef = useRef<HTMLInputElement>(null);

  const { data: post, isLoading: loadingPost } = useBlogPost(postId ?? null, isEdit);
  const { data: categories } = useBlogCategories();
  const { data: tags } = useBlogTags();
  const createMutation = useBlogPostCreate();
  const updateMutation = useBlogPostUpdate();
  const tagCreateMutation = useBlogTagCreate();
  const categoryCreateMutation = useBlogCategoryCreate();

  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setSlug(post.slug);
      setStatus(post.status as "draft" | "published" | "archived");
      setIsFeatured(post.is_featured ?? false);
      setExcerpt(post.excerpt ?? "");
      setContent(post.content);
      setFeaturedImageUrl(post.featured_image_url ?? "");
      setCategoryIds(post.categories.map((c) => c.id));
      setTagIds(post.tags.map((t) => t.id));
    }
  }, [post]);

  const handleTitleChange = (v: string) => {
    setTitle(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const handleFeaturedImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeaturedImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setFeaturedImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    const tTrim = title.trim();
    const sTrim = slug.trim();
    if (!tTrim || !sTrim) {
      toast.error("Title and slug are required");
      return;
    }

    let featuredUrl = featuredImageUrl;
    if (featuredImageFile) {
      const { data, error } = await blogApi.uploadImage(featuredImageFile);
      if (error) {
        toast.error(error);
        return;
      }
      featuredUrl = data?.url ?? "";
    }

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          id: postId!,
          data: {
            title: tTrim,
            slug: sTrim,
            status,
            is_featured: isFeatured,
            excerpt: excerpt || null,
            content,
            featured_image_url: featuredUrl || null,
            category_ids: categoryIds,
            tag_ids: tagIds,
          },
        });
        toast.success(t("admin.blog.posts.update_success"));
      } else {
        await createMutation.mutateAsync({
          title: tTrim,
          slug: sTrim,
          status,
          is_featured: isFeatured,
          excerpt: excerpt || null,
          content,
          featured_image_url: featuredUrl || null,
          category_ids: categoryIds,
          tag_ids: tagIds,
        });
        toast.success(t("admin.blog.posts.create_success"));
      }
      router.push(ROUTES.BLOG_POSTS);
    } catch {
      toast.error(
        isEdit ? t("admin.blog.posts.update_error") : t("admin.blog.posts.create_error")
      );
    }
  };

  const addTag = async (name: string) => {
    const n = name.trim().toLowerCase();
    if (!n) return;
    const existing = tags?.find((t) => t.name.toLowerCase() === n || t.slug === slugify(n));
    if (existing) {
      if (!tagIds.includes(existing.id)) setTagIds((prev) => [...prev, existing.id]);
    } else {
      try {
        const created = await tagCreateMutation.mutateAsync({
          name: n,
          slug: slugify(n),
        });
        setTagIds((prev) => [...prev, created.id]);
      } catch {
        toast.error(t("admin.blog.tags.create_error"));
      }
    }
    setTagInput("");
  };

  const removeTag = (id: string) => {
    setTagIds((prev) => prev.filter((x) => x !== id));
  };

  const handleNewCategoryNameChange = (v: string) => {
    setNewCategoryName(v);
    setNewCategorySlug(slugify(v));
  };

  const handleAddCategory = async () => {
    const n = newCategoryName.trim();
    const s = newCategorySlug.trim();
    if (!n || !s) {
      toast.error("Name and slug are required");
      return;
    }
    try {
      const created = await categoryCreateMutation.mutateAsync({
        name: n,
        slug: s,
        description: newCategoryDescription || null,
      });
      setCategoryIds((prev) => [...prev, created.id]);
      setCategoryDialogOpen(false);
      setNewCategoryName("");
      setNewCategorySlug("");
      setNewCategoryDescription("");
      toast.success(t("admin.blog.categories.create_success"));
    } catch {
      toast.error(t("admin.blog.categories.create_error"));
    }
  };

  if (isEdit && loadingPost) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-muted rounded w-1/3" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  return (
    <>
      <Link
        href={ROUTES.BLOG_POSTS}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("admin.blog.posts.back_to_posts")}
      </Link>

      <div className="space-y-6 max-w-4xl">
        <div>
          <label className="block text-sm font-medium mb-2">{t("admin.blog.posts.col_title")}</label>
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Post title"
            className="text-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Slug</label>
          <Input
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            placeholder="url-slug"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">{t("admin.blog.posts.col_status")}</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "draft" | "published" | "archived")}
            className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          >
            <option value="draft">{t("admin.blog.posts.status_draft")}</option>
            <option value="published">{t("admin.blog.posts.status_published")}</option>
            <option value="archived">{t("admin.blog.posts.status_archived")}</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium">{t("admin.blog.posts.is_featured")}</span>
          </label>
          <span className="text-xs text-muted-foreground">
            {t("admin.blog.posts.is_featured_hint")}
          </span>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">{t("admin.blog.posts.featured_image")}</label>
          <div className="flex gap-4 items-start">
            {(featuredImagePreview || featuredImageUrl) && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- blob URLs from file preview require img */}
                <img
                  src={featuredImagePreview || featuredImageUrl}
                  alt="Featured"
                  className="w-48 h-32 object-cover rounded-lg border"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFeaturedImageFile(null);
                    setFeaturedImagePreview("");
                    setFeaturedImageUrl("");
                    if (featuredImageInputRef.current) {
                      featuredImageInputRef.current.value = "";
                    }
                  }}
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 shadow"
                  title={t("admin.blog.posts.remove_image")}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label className="inline-flex cursor-pointer">
                <input
                  ref={featuredImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFeaturedImageChange}
                  className="sr-only"
                />
                <span className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800">
                  <ImagePlus className="h-4 w-4" />
                  {t("admin.blog.posts.choose_file")}
                </span>
              </label>
              {!featuredImagePreview && !featuredImageUrl && (
                <span className="text-sm text-muted-foreground">
                  {t("admin.blog.posts.no_image")}
                </span>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Excerpt</label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Short summary for SEO and previews"
            rows={3}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Content</label>
          <BlogEditor content={content} onChange={setContent} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">{t("admin.blog.posts.col_categories")}</label>
          {!categories?.length ? (
            <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4 text-sm text-muted-foreground">
              {t("admin.blog.categories.empty")}{" "}
              {t("admin.blog.categories.add_inline_hint")}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 mt-2">
            {(categories ?? []).map((c) => (
              <label key={c.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={categoryIds.includes(c.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCategoryIds((prev) => [...prev, c.id]);
                    } else {
                      setCategoryIds((prev) => prev.filter((x) => x !== c.id));
                    }
                  }}
                />
                <span>{c.name}</span>
              </label>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCategoryDialogOpen(true)}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              {t("admin.blog.categories.add")}
            </Button>
          </div>
        </div>

        <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.blog.categories.add")}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("admin.blog.categories.col_name")}
                </label>
                <Input
                  placeholder={t("admin.blog.categories.name_placeholder")}
                  value={newCategoryName}
                  onChange={(e) => handleNewCategoryNameChange(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("admin.blog.categories.col_slug")}
                </label>
                <Input
                  placeholder={t("admin.blog.categories.slug_placeholder")}
                  value={newCategorySlug}
                  onChange={(e) => setNewCategorySlug(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("admin.blog.categories.col_description")}
                </label>
                <Input
                  placeholder={t("admin.blog.categories.description_placeholder")}
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                {t("admin.users.cancel")}
              </Button>
              <Button
                onClick={handleAddCategory}
                disabled={categoryCreateMutation.isPending}
              >
                {t("admin.blog.categories.add")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div>
          <label className="block text-sm font-medium mb-2">{t("admin.blog.posts.col_tags")}</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tagIds.map((id) => {
              const tag = tags?.find((t) => t.id === id);
              return tag ? (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 bg-secondary px-2 py-1 rounded text-sm"
                >
                  {tag.name}
                  <button type="button" onClick={() => removeTag(id)} className="hover:text-red-600">
                    ×
                  </button>
                </span>
              ) : null;
            })}
          </div>
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
              placeholder="Type tag and press Enter"
              className="max-w-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addTag(tagInput)}
            >
              Add
            </Button>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            onClick={() => handleSubmit()}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {t("admin.blog.posts.save")}
          </Button>
        </div>
      </div>
    </>
  );
}
