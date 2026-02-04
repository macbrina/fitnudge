"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import { useAlertModal } from "@/contexts/AlertModalContext";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@fitnudge/ui";
import {
  useBlogTags,
  useBlogTagCreate,
  useBlogTagUpdate,
  useBlogTagDelete,
} from "@/hooks/api/useBlog";
import type { BlogTag } from "@/lib/api";
import { Pencil, Trash2, Plus } from "lucide-react";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .trim();
}

export function BlogTagsView() {
  const { t } = useTranslation();
  const { showConfirm } = useAlertModal();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BlogTag | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const { data: tags, isLoading, isError } = useBlogTags();
  const createMutation = useBlogTagCreate();
  const updateMutation = useBlogTagUpdate();
  const deleteMutation = useBlogTagDelete();

  const resetForm = () => {
    setEditing(null);
    setName("");
    setSlug("");
    setDialogOpen(false);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (tag: BlogTag) => {
    setEditing(tag);
    setName(tag.name);
    setSlug(tag.slug);
    setDialogOpen(true);
  };

  const handleNameChange = (v: string) => {
    setName(v);
    if (!editing) setSlug(slugify(v));
  };

  const handleSubmit = async () => {
    const n = name.trim();
    const s = slug.trim();
    if (!n || !s) {
      toast.error("Name and slug are required");
      return;
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          data: { name: n, slug: s },
        });
        toast.success(t("admin.blog.tags.update_success"));
      } else {
        await createMutation.mutateAsync({ name: n, slug: s });
        toast.success(t("admin.blog.tags.create_success"));
      }
      resetForm();
    } catch {
      toast.error(
        editing
          ? t("admin.blog.tags.update_error")
          : t("admin.blog.tags.create_error")
      );
    }
  };

  const handleDelete = async (tag: BlogTag) => {
    try {
      await showConfirm({
        title: t("admin.blog.tags.delete"),
        message: t("admin.blog.tags.delete_confirm_message", { name: tag.name }),
        variant: "error",
        confirmLabel: t("admin.blog.tags.delete"),
        cancelLabel: t("admin.users.cancel"),
        onConfirm: async () => {
          await deleteMutation.mutateAsync(tag.id);
          toast.success(t("admin.blog.tags.delete_success"));
        },
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (err?.message?.includes("in use")) {
        toast.error(t("admin.blog.tags.delete_in_use"));
      } else {
        toast.error(t("admin.blog.tags.delete_error"));
      }
    }
  };

  return (
    <>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {t("admin.pages.blog_tags_description")}
      </p>

      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={openCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t("admin.blog.tags.add")}
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto">
        {isLoading ? (
          <div className="p-6">
            <Skeleton className="h-10 w-full mb-4" />
            <Skeleton className="h-10 w-full mb-4" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div className="p-12 text-center text-red-500">
            {t("admin.blog.posts.fetch_error")}
          </div>
        ) : !tags?.length ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            {t("admin.blog.tags.empty")}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.blog.tags.col_name")}</TableHead>
                <TableHead>{t("admin.blog.tags.col_slug")}</TableHead>
                <TableHead>{t("admin.blog.tags.col_posts")}</TableHead>
                <TableHead>{t("admin.blog.tags.col_actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell className="font-medium">{tag.name}</TableCell>
                  <TableCell className="text-muted-foreground">{tag.slug}</TableCell>
                  <TableCell>{tag.post_count}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(tag)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-primary dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-primary"
                        title={t("admin.blog.tags.edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(tag)}
                        disabled={deleteMutation.isPending}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-300 disabled:opacity-50"
                        title={t("admin.blog.tags.delete")}
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
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t("admin.blog.tags.edit") : t("admin.blog.tags.add")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                {t("admin.blog.tags.col_name")}
              </label>
              <Input
                placeholder={t("admin.blog.tags.name_placeholder")}
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                {t("admin.blog.tags.col_slug")}
              </label>
              <Input
                placeholder={t("admin.blog.tags.slug_placeholder")}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              {t("admin.users.cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? t("admin.blog.tags.edit") : t("admin.blog.tags.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
