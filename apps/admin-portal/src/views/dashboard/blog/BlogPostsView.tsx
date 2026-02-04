"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Input,
  Skeleton,
} from "@fitnudge/ui";
import {
  useBlogPostsList,
  useBlogCategories,
  useBlogTags,
  useBlogPostDelete,
  useBlogPostPublish,
} from "@/hooks/api/useBlog";
import { ROUTES } from "@/lib/routes";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Send } from "lucide-react";
import type { BlogPost } from "@/lib/api";

export function BlogPostsView() {
  const { t } = useTranslation();
  const { showConfirm } = useAlertModal();
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data: listData, isLoading: loading, isError: listError } = useBlogPostsList({
    page,
    per_page: perPage,
    status_filter: statusFilter || undefined,
    category_id: categoryFilter || undefined,
    tag_id: tagFilter || undefined,
    search: search || undefined,
  });

  const { data: categories } = useBlogCategories();
  const { data: tags } = useBlogTags();
  const deleteMutation = useBlogPostDelete();
  const publishMutation = useBlogPostPublish();

  const posts = listData?.posts ?? [];
  const total = listData?.total ?? 0;

  useEffect(() => {
    if (listError) toast.error(t("admin.blog.posts.fetch_error"));
  }, [listError, t]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const handleDelete = async (post: BlogPost) => {
    try {
      await showConfirm({
        title: t("admin.blog.posts.delete"),
        message: t("admin.blog.posts.delete_confirm_message", { title: post.title }),
        variant: "error",
        confirmLabel: t("admin.blog.posts.delete"),
        cancelLabel: t("admin.users.cancel"),
        onConfirm: async () => {
          await deleteMutation.mutateAsync(post.id);
          toast.success(t("admin.blog.posts.delete_success"));
        },
      });
    } catch {
      toast.error(t("admin.blog.posts.delete_error"));
    }
  };

  const handlePublish = async (post: BlogPost) => {
    try {
      await showConfirm({
        title: t("admin.blog.posts.publish"),
        message: t("admin.blog.posts.publish_confirm_message", { title: post.title }),
        variant: "info",
        confirmLabel: t("admin.blog.posts.publish"),
        cancelLabel: t("admin.users.cancel"),
        onConfirm: async () => {
          await publishMutation.mutateAsync(post.id);
          toast.success(t("admin.blog.posts.publish_success"));
        },
      });
    } catch {
      toast.error(t("admin.blog.posts.publish_error"));
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
      published: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      archived: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    };
    const key = `admin.blog.posts.status_${status}` as const;
    return (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-gray-100"}`}
      >
        {t(key)}
      </span>
    );
  };

  return (
    <>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {t("admin.pages.blog_posts_description")}
      </p>

      <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder={t("admin.blog.posts.search_placeholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-56 shrink-0"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white shrink-0 w-full sm:w-auto min-w-[140px]"
          >
            <option value="">{t("admin.blog.posts.filter_status")}: {t("admin.subscriptions.filter_all")}</option>
            <option value="draft">{t("admin.blog.posts.status_draft")}</option>
            <option value="published">{t("admin.blog.posts.status_published")}</option>
            <option value="archived">{t("admin.blog.posts.status_archived")}</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white shrink-0 w-full sm:w-auto min-w-[140px]"
          >
            <option value="">{t("admin.blog.posts.filter_category")}: {t("admin.subscriptions.filter_all")}</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={tagFilter}
            onChange={(e) => {
              setTagFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white shrink-0 w-full sm:w-auto min-w-[140px]"
          >
            <option value="">{t("admin.blog.posts.filter_tag")}: {t("admin.subscriptions.filter_all")}</option>
            {(tags ?? []).map((tag) => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
        </div>
        <Link href={ROUTES.BLOG_NEW}>
          <Button size="sm" className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            {t("admin.blog.posts.new_post")}
          </Button>
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto">
        {loading ? (
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.blog.posts.col_title")}</TableHead>
                <TableHead>{t("admin.blog.posts.col_status")}</TableHead>
                <TableHead>{t("admin.blog.posts.col_categories")}</TableHead>
                <TableHead>{t("admin.blog.posts.col_author")}</TableHead>
                <TableHead>{t("admin.blog.posts.col_created")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            {t("admin.blog.posts.empty")}
          </div>
        ) : (
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.blog.posts.col_title")}</TableHead>
                <TableHead>{t("admin.blog.posts.col_status")}</TableHead>
                <TableHead>{t("admin.blog.posts.col_categories")}</TableHead>
                <TableHead>{t("admin.blog.posts.col_author")}</TableHead>
                <TableHead>{t("admin.blog.posts.col_created")}</TableHead>
                <TableHead>{t("admin.blog.posts.col_actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {post.title}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {statusBadge(post.status)}
                      {post.is_featured && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                          {t("admin.blog.posts.is_featured")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {post.categories.map((c) => c.name).join(", ") || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {post.author?.name ?? post.author?.username ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {new Date(post.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link
                        href={ROUTES.apiBlogPostEdit(post.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-primary dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-primary"
                        title={t("admin.blog.posts.edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      {post.status === "draft" && (
                        <button
                          type="button"
                          onClick={() => handlePublish(post)}
                          disabled={publishMutation.isPending}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-900/30 dark:hover:text-green-300 disabled:opacity-50"
                          title={t("admin.blog.posts.publish")}
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(post)}
                        disabled={deleteMutation.isPending}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300 disabled:opacity-50"
                        title={t("admin.blog.posts.delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("admin.blog.posts.page_of", {
                current: page,
                total: totalPages,
              })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                {t("admin.blog.posts.prev")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t("admin.blog.posts.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
