"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@fitnudge/ui";
import {
  useBroadcastsList,
  useBroadcastCreate,
  useBroadcastUpdate,
  useBroadcastDelete,
} from "@/hooks/api/useBroadcasts";
import type { BroadcastItem } from "@/lib/api";
import { Skeleton } from "@fitnudge/ui";
import { Plus, Pencil, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

const AUDIENCE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "free", label: "Free" },
  { value: "premium", label: "Premium" },
];

const DELIVERY_OPTIONS = [
  { value: "in_app", label: "In-app" },
  { value: "push", label: "Push" },
  { value: "both", label: "Both" },
];

function formatSchedule(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt && !endsAt) return "—";
  if (startsAt && endsAt) {
    return `${new Date(startsAt).toLocaleDateString()} – ${new Date(endsAt).toLocaleDateString()}`;
  }
  if (startsAt) return `From ${new Date(startsAt).toLocaleDateString()}`;
  if (endsAt) return `Until ${new Date(endsAt).toLocaleDateString()}`;
  return "—";
}

const emptyForm = {
  title: "",
  body: "",
  image_url: "",
  cta_label: "",
  cta_url: "",
  deeplink: "",
  audience: "all",
  delivery: "in_app",
  is_active: true,
  starts_at: "",
  ends_at: "",
};

export function BroadcastsView() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useBroadcastsList({ per_page: 50 });
  const createMutation = useBroadcastCreate();
  const updateMutation = useBroadcastUpdate();
  const deleteMutation = useBroadcastDelete();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BroadcastItem | null>(null);
  const [form, setForm] = useState(emptyForm);

  const items = data?.items ?? [];

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item: BroadcastItem) => {
    setEditing(item);
    setForm({
      title: item.title,
      body: item.body,
      image_url: item.image_url ?? "",
      cta_label: item.cta_label ?? "",
      cta_url: item.cta_url ?? "",
      deeplink: item.deeplink ?? "",
      audience: item.audience,
      delivery: item.delivery,
      is_active: item.is_active,
      starts_at: item.starts_at ? item.starts_at.slice(0, 16) : "",
      ends_at: item.ends_at ? item.ends_at.slice(0, 16) : "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error(t("admin.broadcasts.title_body_required"));
      return;
    }

    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      image_url: form.image_url.trim() || undefined,
      cta_label: form.cta_label.trim() || undefined,
      cta_url: form.cta_url.trim() || undefined,
      deeplink: form.deeplink.trim() || undefined,
      audience: form.audience,
      delivery: form.delivery,
      is_active: form.is_active,
      starts_at: form.starts_at || undefined,
      ends_at: form.ends_at || undefined,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, payload });
        toast.success(t("admin.broadcasts.updated"));
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(t("admin.broadcasts.created"));
      }
      closeModal();
    } catch {
      toast.error(t("admin.broadcasts.save_failed"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("admin.broadcasts.confirm_delete"))) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t("admin.broadcasts.deleted"));
    } catch {
      toast.error(t("admin.broadcasts.delete_failed"));
    }
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
        <p className="text-red-700 dark:text-red-400">
          {t("admin.analytics.load_error")}: {(error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-gray-600 dark:text-gray-400">
          {t("admin.pages.broadcasts_description")}
        </p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t("admin.broadcasts.new")}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <Skeleton className="h-48 w-full rounded" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.broadcasts.title")}</TableHead>
                  <TableHead>{t("admin.broadcasts.audience")}</TableHead>
                  <TableHead>{t("admin.broadcasts.delivery")}</TableHead>
                  <TableHead>{t("admin.broadcasts.schedule")}</TableHead>
                  <TableHead>{t("admin.broadcasts.active")}</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>{item.audience}</TableCell>
                    <TableCell>{item.delivery}</TableCell>
                    <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                      {formatSchedule(item.starts_at, item.ends_at)}
                    </TableCell>
                    <TableCell>{item.is_active ? "✓" : "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(item.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {items.length === 0 && !isLoading && (
            <div className="py-12 text-center text-gray-500">
              {t("admin.analytics.empty")}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-lg flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {editing ? t("admin.broadcasts.edit") : t("admin.broadcasts.new")}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("admin.broadcasts.title")} *
              </label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Broadcast title"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("admin.broadcasts.body")} *
              </label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                placeholder="Message body"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("admin.broadcasts.image_url")}
              </label>
              <Input
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("admin.broadcasts.cta_label")}
                </label>
                <Input
                  value={form.cta_label}
                  onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))}
                  placeholder="Button text"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("admin.broadcasts.cta_url")}
                </label>
                <Input
                  value={form.cta_url}
                  onChange={(e) => setForm((f) => ({ ...f, cta_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("admin.broadcasts.audience")}
              </label>
              <select
                value={form.audience}
                onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              >
                {AUDIENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("admin.broadcasts.delivery")}
              </label>
              <select
                value={form.delivery}
                onChange={(e) => setForm((f) => ({ ...f, delivery: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              >
                {DELIVERY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("admin.broadcasts.starts_at")}
                </label>
                <Input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("admin.broadcasts.ends_at")}
                </label>
                <Input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="form-is-active"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="form-is-active" className="text-sm">
                {t("admin.broadcasts.active")}
              </label>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t pt-4">
            <Button variant="outline" onClick={closeModal}>
              {t("admin.app_config.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              <Save className="h-4 w-4" />
              {createMutation.isPending || updateMutation.isPending
                ? t("admin.app_config.saving")
                : t("admin.app_config.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
