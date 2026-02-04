"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
} from "@fitnudge/ui";
import { useAppConfigList, useAppConfigUpdate } from "@/hooks/api/useAppConfig";
import { Skeleton } from "@fitnudge/ui";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MAINTENANCE_KEYS = {
  enabled: "maintenance_enabled",
  title: "maintenance_title",
  message: "maintenance_message",
  image_url: "maintenance_image_url",
  cta_label: "maintenance_cta_label",
  cta_url: "maintenance_cta_url",
  bypass_user_ids: "maintenance_bypass_user_ids",
} as const;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseBypassIds(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string");
    }
  } catch {
    // Fallback: treat as comma-separated
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function formatBypassIds(ids: string[]): string {
  return JSON.stringify(ids);
}

export function MaintenanceView() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useAppConfigList();
  const updateMutation = useAppConfigUpdate();

  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [bypassInput, setBypassInput] = useState("");

  const items = useMemo(() => data?.items ?? [], [data?.items]);

  useEffect(() => {
    if (items.length > 0) {
      const configMap = Object.fromEntries(items.map((i) => [i.key, i.value]));
      setEnabled(configMap[MAINTENANCE_KEYS.enabled] === "true");
      setTitle(configMap[MAINTENANCE_KEYS.title] ?? "");
      setMessage(configMap[MAINTENANCE_KEYS.message] ?? "");
      setImageUrl(configMap[MAINTENANCE_KEYS.image_url] ?? "");
      setCtaLabel(configMap[MAINTENANCE_KEYS.cta_label] ?? "");
      setCtaUrl(configMap[MAINTENANCE_KEYS.cta_url] ?? "");
      const bypassIds = parseBypassIds(configMap[MAINTENANCE_KEYS.bypass_user_ids] ?? "[]");
      setBypassInput(bypassIds.join(", "));
    }
  }, [items]);

  const validateBypassIds = (): string[] => {
    const parts = bypassInput.split(",").map((s) => s.trim()).filter(Boolean);
    const invalid: string[] = [];
    const valid: string[] = [];
    for (const p of parts) {
      if (UUID_REGEX.test(p)) {
        valid.push(p);
      } else {
        invalid.push(p);
      }
    }
    if (invalid.length > 0) {
      toast.error(t("admin.maintenance.invalid_uuids", { ids: invalid.join(", ") }));
      return [];
    }
    return valid;
  };

  const handleSave = async () => {
    const bypassIds = validateBypassIds();
    if (bypassIds.length === 0 && bypassInput.trim()) return; // validation failed

    const updates = [
      { key: MAINTENANCE_KEYS.enabled, value: enabled ? "true" : "false" },
      { key: MAINTENANCE_KEYS.title, value: title },
      { key: MAINTENANCE_KEYS.message, value: message },
      { key: MAINTENANCE_KEYS.image_url, value: imageUrl },
      { key: MAINTENANCE_KEYS.cta_label, value: ctaLabel },
      { key: MAINTENANCE_KEYS.cta_url, value: ctaUrl },
      { key: MAINTENANCE_KEYS.bypass_user_ids, value: formatBypassIds(bypassIds) },
    ];

    try {
      for (const { key, value } of updates) {
        await updateMutation.mutateAsync({ key, payload: { value } });
      }
      toast.success(t("admin.maintenance.saved"));
    } catch {
      toast.error(t("admin.maintenance.save_failed"));
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
        {t("admin.pages.maintenance_description")}
      </p>

      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.maintenance.enabled")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="maintenance-enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300"
              />
              <label htmlFor="maintenance-enabled" className="text-sm font-medium">
                {enabled
                  ? "Maintenance mode is ON — users will see the maintenance screen"
                  : "Maintenance mode is OFF"}
              </label>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("admin.maintenance.title")}
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="We'll be back soon"
                className="w-full"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("admin.maintenance.message")}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="We're performing scheduled maintenance. Please check back shortly."
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("admin.maintenance.image_url")}
              </label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://... (optional)"
                className="w-full"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("admin.maintenance.cta_label")}
              </label>
              <Input
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="Optional CTA button label"
                className="w-full"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("admin.maintenance.cta_url")}
              </label>
              <Input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://... (optional)"
                className="w-full"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {t("admin.maintenance.bypass_user_ids")}
              </label>
              <textarea
                value={bypassInput}
                onChange={(e) => setBypassInput(e.target.value)}
                placeholder="uuid1, uuid2, ..."
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800"
              />
              <p className="mt-1 text-xs text-gray-500">
                {t("admin.maintenance.bypass_help")}
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {updateMutation.isPending ? t("admin.app_config.saving") : t("admin.app_config.save")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
