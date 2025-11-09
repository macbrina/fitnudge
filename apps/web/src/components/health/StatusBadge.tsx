"use client";

import { useTranslation } from "@/lib/i18n";
import type { HealthStatus, HealthUpdateStatus } from "@/lib/systemHealth";

export const STATUS_LABEL_KEYS: Record<HealthStatus, string> = {
  ok: "health.status.operational",
  degraded: "health.status.degraded",
  critical: "health.status.critical",
  not_configured: "health.status.not_configured",
};

export const STATUS_BADGE_CLASSES: Record<
  HealthStatus,
  { container: string; dot: string }
> = {
  ok: {
    container: "border border-success-soft bg-success-soft text-success",
    dot: "bg-success",
  },
  degraded: {
    container: "border border-warning-soft bg-warning-soft text-warning",
    dot: "bg-warning",
  },
  critical: {
    container:
      "border border-destructive-soft bg-destructive-soft text-destructive",
    dot: "bg-destructive",
  },
  not_configured: {
    container: "border border-secondary bg-secondary-soft text-secondary",
    dot: "bg-secondary",
  },
};

export const UPDATE_STATUS_CLASSES: Record<
  HealthUpdateStatus,
  { container: string; dot: string; labelKey: string }
> = {
  identified: {
    container: "border border-warning-soft bg-warning-soft text-warning",
    dot: "bg-warning",
    labelKey: "health.history.update_status.identified",
  },
  monitoring: {
    container: "border border-secondary bg-secondary-soft text-secondary",
    dot: "bg-secondary",
    labelKey: "health.history.update_status.monitoring",
  },
  resolved: {
    container: "border border-success-soft bg-success-soft text-success",
    dot: "bg-success",
    labelKey: "health.history.update_status.resolved",
  },
};

export function HealthStatusBadge({
  status,
  loading = false,
}: {
  status: HealthStatus;
  loading?: boolean;
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-secondary-soft bg-secondary-soft px-3 py-1 text-sm font-medium text-secondary">
        <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-secondary" />
        {t("health.status.checking")}
      </span>
    );
  }

  const badgeStyle = STATUS_BADGE_CLASSES[status];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${badgeStyle.container}`}
    >
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${badgeStyle.dot}`}
      />
      {t(STATUS_LABEL_KEYS[status])}
    </span>
  );
}

export function UpdateStatusBadge({ status }: { status: HealthUpdateStatus }) {
  const { t } = useTranslation();
  const config = UPDATE_STATUS_CLASSES[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.container}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {t(config.labelKey)}
    </span>
  );
}

