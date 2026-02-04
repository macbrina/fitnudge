"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { useAppConfigList, useAppConfigUpdate } from "@/hooks/api/useAppConfig";
import type { AppConfigItem } from "@/lib/api";
import { Skeleton } from "@fitnudge/ui";
import { Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_ORDER = [
  "app_store_urls",
  "external_urls",
  "social_media",
  "maintenance",
  "feature_flags",
];

function categoryLabel(category: string): string {
  return category
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function keyDisplayName(key: string, t: (k: string) => string): string {
  const label = t(`admin.app_config.key_labels.${key}`);
  return label && label !== `admin.app_config.key_labels.${key}` ? label : key;
}

function isBooleanValue(value: string): boolean {
  const v = value?.toLowerCase();
  return v === "true" || v === "false";
}

export function AppConfigView() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useAppConfigList();
  const updateMutation = useAppConfigUpdate();
  const [editing, setEditing] = useState<AppConfigItem | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(true);

  const items = data?.items ?? [];
  const byCategory = items.reduce<Record<string, AppConfigItem[]>>((acc, item) => {
    (acc[item.category] = acc[item.category] ?? []).push(item);
    return acc;
  }, {});

  const openEdit = (item: AppConfigItem) => {
    setEditing(item);
    setEditValue(
      isBooleanValue(item.value) ? item.value.toLowerCase() : item.value
    );
    setEditDescription(item.description ?? "");
    setEditIsPublic(item.is_public);
  };

  const closeEdit = () => {
    setEditing(null);
  };

  const handleSave = async () => {
    if (!editing) return;
    const valueToSave =
      editing && isBooleanValue(editing.value)
        ? editValue.toLowerCase()
        : editValue;
    try {
      await updateMutation.mutateAsync({
        key: editing.key,
        payload: {
          value: valueToSave,
          description: editDescription || undefined,
          is_public: editIsPublic,
        },
      });
      toast.success(t("admin.app_config.saved"));
      closeEdit();
    } catch {
      toast.error(t("admin.app_config.save_failed"));
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
        {t("admin.pages.app_config_description")}
      </p>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        CATEGORY_ORDER.filter((cat) => (byCategory[cat]?.length ?? 0) > 0).map(
          (category) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle>{categoryLabel(category)}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.app_config.key")}</TableHead>
                      <TableHead>{t("admin.app_config.value")}</TableHead>
                      <TableHead>{t("admin.app_config.description")}</TableHead>
                      <TableHead>{t("admin.app_config.public")}</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byCategory[category]?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {keyDisplayName(item.key, t)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={item.value}>
                          {isBooleanValue(item.value)
                            ? item.value.toLowerCase() === "true"
                              ? t("admin.app_config.true")
                              : t("admin.app_config.false")
                            : item.value || "—"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-gray-500">
                          {item.description || "—"}
                        </TableCell>
                        <TableCell>{item.is_public ? "✓" : "—"}</TableCell>
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
          )
        )
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("admin.app_config.edit")} {editing ? keyDisplayName(editing.key, t) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("admin.app_config.value")}
              </label>
              {editing && isBooleanValue(editing.value) ? (
                <select
                  value={editValue.toLowerCase()}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                >
                  <option value="true">{t("admin.app_config.true")}</option>
                  <option value="false">{t("admin.app_config.false")}</option>
                </select>
              ) : (
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="Value"
                  className="w-full"
                />
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("admin.app_config.description")}
              </label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-is-public"
                checked={editIsPublic}
                onChange={(e) => setEditIsPublic(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="edit-is-public" className="text-sm">
                {t("admin.app_config.public")}
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
              {updateMutation.isPending ? t("admin.app_config.saving") : t("admin.app_config.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
