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
  useAppVersionsList,
  useAppVersionUpdate,
} from "@/hooks/api/useAppVersions";
import type { AppVersionItem } from "@/lib/api";
import { Skeleton } from "@fitnudge/ui";
import { Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";

function platformLabel(platform: string): string {
  return platform === "ios" ? "iOS" : platform === "android" ? "Android" : platform;
}

export function AppVersionsView() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useAppVersionsList();
  const updateMutation = useAppVersionUpdate();
  const [editing, setEditing] = useState<AppVersionItem | null>(null);
  const [form, setForm] = useState({
    latest_version: "",
    minimum_version: "",
    release_notes: "",
    store_url: "",
    force_update: false,
  });

  const items = data?.items ?? [];

  const openEdit = (item: AppVersionItem) => {
    setEditing(item);
    setForm({
      latest_version: item.latest_version,
      minimum_version: item.minimum_version,
      release_notes: item.release_notes ?? "",
      store_url: item.store_url ?? "",
      force_update: item.force_update,
    });
  };

  const closeEdit = () => {
    setEditing(null);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!form.latest_version.trim() || !form.minimum_version.trim()) {
      toast.error(t("admin.app_versions.version_required"));
      return;
    }
    try {
      await updateMutation.mutateAsync({
        platform: editing.platform,
        payload: {
          latest_version: form.latest_version.trim(),
          minimum_version: form.minimum_version.trim(),
          release_notes: form.release_notes.trim() || undefined,
          store_url: form.store_url.trim() || undefined,
          force_update: form.force_update,
        },
      });
      toast.success(t("admin.app_versions.saved"));
      closeEdit();
    } catch {
      toast.error(t("admin.app_versions.save_failed"));
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
    <div className="space-y-8">
      <p className="text-gray-600 dark:text-gray-400">
        {t("admin.pages.app_versions_description")}
      </p>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.app_versions.platform")}</TableHead>
                  <TableHead>{t("admin.app_versions.latest_version")}</TableHead>
                  <TableHead>{t("admin.app_versions.minimum_version")}</TableHead>
                  <TableHead>{t("admin.app_versions.force_update")}</TableHead>
                  <TableHead>{t("admin.app_versions.release_notes")}</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {platformLabel(item.platform)}
                    </TableCell>
                    <TableCell>{item.latest_version}</TableCell>
                    <TableCell>{item.minimum_version}</TableCell>
                    <TableCell>{item.force_update ? "✓" : "—"}</TableCell>
                    <TableCell className="max-w-xs truncate" title={item.release_notes ?? ""}>
                      {item.release_notes || "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("admin.app_versions.edit")}{" "}
              {editing ? platformLabel(editing.platform) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("admin.app_versions.latest_version")}
              </label>
              <Input
                value={form.latest_version}
                onChange={(e) =>
                  setForm((f) => ({ ...f, latest_version: e.target.value }))
                }
                placeholder="1.2.0"
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("admin.app_versions.minimum_version")}
              </label>
              <Input
                value={form.minimum_version}
                onChange={(e) =>
                  setForm((f) => ({ ...f, minimum_version: e.target.value }))
                }
                placeholder="1.0.0"
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("admin.app_versions.release_notes")}
              </label>
              <Input
                value={form.release_notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, release_notes: e.target.value }))
                }
                placeholder={t("admin.app_versions.release_notes_placeholder")}
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("admin.app_versions.store_url")}
              </label>
              <Input
                value={form.store_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, store_url: e.target.value }))
                }
                placeholder="https://..."
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-force-update"
                checked={form.force_update}
                onChange={(e) =>
                  setForm((f) => ({ ...f, force_update: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="edit-force-update" className="text-sm">
                {t("admin.app_versions.force_update")}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit}>
              <X className="h-4 w-4" />
              {t("admin.app_config.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              <Save className="h-4 w-4" />
              {updateMutation.isPending
                ? t("admin.app_config.saving")
                : t("admin.app_config.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
