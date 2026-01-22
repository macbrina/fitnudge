"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import {
  HealthHistoryEntry,
  HealthHistoryUpdate,
  HealthStatus,
  resolveApiBase,
} from "@/lib/systemHealth";
import {
  HealthStatusBadge,
  STATUS_BADGE_CLASSES,
  STATUS_LABEL_KEYS,
  UpdateStatusBadge,
} from "@/components/health/StatusBadge";
import { Button } from "@fitnudge/ui";
import { LandingLayout } from "@/components/layout/LandingLayout";

const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const RELATIVE_FORMAT = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

const MILLISECONDS_IN = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
};

const formatRelativeTime = (date: Date) => {
  const diff = Date.now() - date.getTime();
  if (Math.abs(diff) < MILLISECONDS_IN.minute) {
    return RELATIVE_FORMAT.format(0, "minute");
  }
  if (Math.abs(diff) < MILLISECONDS_IN.hour) {
    const minutes = Math.round(diff / MILLISECONDS_IN.minute);
    return RELATIVE_FORMAT.format(-minutes, "minute");
  }
  if (Math.abs(diff) < MILLISECONDS_IN.day) {
    const hours = Math.round(diff / MILLISECONDS_IN.hour);
    return RELATIVE_FORMAT.format(-hours, "hour");
  }
  const days = Math.round(diff / MILLISECONDS_IN.day);
  return RELATIVE_FORMAT.format(-days, "day");
};

const buildSummary = (
  entry: HealthHistoryEntry,
  t: ReturnType<typeof useTranslation>["t"]
) => {
  const params: Record<string, string | number> = {};
  const raw = entry.summary_params || {};

  if (typeof raw.component === "string" && raw.component.length > 0) {
    params.component = t(`health.components.${raw.component}.name`, {
      defaultValue: raw.component.replace(/_/g, " "),
    });
  }

  if (typeof raw.status === "string" && raw.status.length > 0) {
    params.status = t(`health.status.${raw.status as HealthStatus}`, {
      defaultValue: raw.status,
    });
  }

  if (typeof raw.count === "number") {
    params.count = raw.count;
  } else if (entry.impacted?.length) {
    params.count = entry.impacted.length;
  }

  return t(entry.summary_key, params);
};

const sortedUpdates = (updates: HealthHistoryUpdate[]) =>
  [...(updates ?? [])].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

export default function HealthHistoryDetailPage() {
  const { t } = useTranslation();
  const { apiV1 } = useMemo(resolveApiBase, []);
  const params = useParams<{ id?: string }>();
  const [entry, setEntry] = useState<HealthHistoryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadEntry = async () => {
      if (!apiV1) {
        setError(t("health.history.missing_api"));
        setLoading(false);
        return;
      }

      if (!params?.id || params.id === "undefined") {
        setError(t("health.history.detail_not_found"));
        setEntry(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${apiV1}/system/health/history/${params.id}`,
          {
            cache: "no-cache",
          }
        );

        if (response.status === 404) {
          if (!cancelled) {
            setError(t("health.history.detail_not_found"));
            setEntry(null);
          }
          return;
        }

        if (!response.ok) {
          throw new Error(`Status ${response.status}`);
        }

        const data = (await response.json()) as HealthHistoryEntry;
        if (!cancelled) {
          setEntry({
            ...data,
            updates: data.updates ?? [],
          });
        }
      } catch {
        if (!cancelled) {
          setError(t("health.history.error"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadEntry();

    return () => {
      cancelled = true;
    };
  }, [apiV1, params?.id, t]);

  const summary = entry ? buildSummary(entry, t) : "";
  const reportedAt = entry ? new Date(entry.created_at) : null;
  const updates = entry ? sortedUpdates(entry.updates) : [];
  const latestUpdate = updates.length > 0 ? updates[updates.length - 1] : null;

  return (
    <LandingLayout>
      <div className="w-full bg-slate-100/80 py-16 text-slate-900 transition-colors dark:bg-slate-950/90 dark:text-white">
        <div className="mx-auto w-full max-w-3xl px-6 lg:px-8">
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="inline-flex items-center gap-2 text-sm font-semibold text-sky-600 transition hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200"
              >
                <Link href="/health" className="flex items-center gap-2">
                  <ArrowLeft className="size-4" />
                  {t("health.history.back_to_status")}
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100"
              >
                <Link
                  href="/health/history"
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="size-4" />
                  {t("health.history.back_to_history")}
                </Link>
              </Button>
            </div>

            {loading ? (
              <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 text-slate-700 shadow-lg dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 animate-pulse rounded-full bg-primary" />
                  <p className="text-sm font-medium">
                    {t("health.history.loading")}
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="rounded-3xl border border-destructive-soft bg-destructive-soft/60 p-6 text-sm text-destructive shadow-lg">
                {error}
              </div>
            ) : entry ? (
              <div className="space-y-8">
                <section className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-lg dark:border-white/10 dark:bg-slate-900/60">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <HealthStatusBadge status={entry.status} />
                      {reportedAt && (
                        <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {t("health.history.detail_reported", {
                            value: DATE_TIME_FORMAT.format(reportedAt),
                          })}{" "}
                          · {formatRelativeTime(reportedAt)}
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
                        {summary}
                      </h1>
                      {latestUpdate ? (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {latestUpdate.description}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {t("health.history.no_updates")}
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-lg dark:border-white/10 dark:bg-slate-900/60">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {t("health.history.detail_impacted")}
                  </h2>
                  {entry.impacted && entry.impacted.length > 0 ? (
                    <ul className="mt-4 space-y-3">
                      {entry.impacted.map((impact, idx) => {
                        const statusClasses =
                          STATUS_BADGE_CLASSES[impact.status];
                        const componentLabel = t(
                          `health.components.${impact.component}.name`,
                          {
                            defaultValue:
                              impact.label ??
                              impact.component.replace(/_/g, " "),
                          }
                        );
                        return (
                          <li
                            key={`${impact.component}-${idx}`}
                            className="flex flex-col gap-2 rounded-xl border border-slate-200/60 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-900/50"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                {componentLabel}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses.container}`}
                              >
                                <span
                                  className={`inline-block h-1.5 w-1.5 rounded-full ${statusClasses.dot}`}
                                />
                                {t(STATUS_LABEL_KEYS[impact.status])}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              {impact.details?.length
                                ? impact.details
                                : t("health.history.no_details")}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                      {t("health.history.detail_no_impacted")}
                    </p>
                  )}
                </section>

                <section className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-lg dark:border-white/10 dark:bg-slate-900/60">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {t("health.history.detail_updates")}
                    </h2>
                    {updates.length > 0 && (
                      <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {t("health.history.detail_update_count", {
                          count: updates.length,
                        })}
                      </span>
                    )}
                  </div>
                  {updates.length > 0 ? (
                    <ul className="mt-4 space-y-4">
                      {updates.map((update) => {
                        const updateDate = new Date(update.created_at);
                        return (
                          <li
                            key={update.id}
                            className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-900/50"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <UpdateStatusBadge status={update.status} />
                              <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                {DATE_TIME_FORMAT.format(updateDate)} ·{" "}
                                {formatRelativeTime(updateDate)}
                              </span>
                            </div>
                            <div className="mt-2 space-y-1">
                              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                {update.title}
                              </h3>
                              <p className="text-sm text-slate-600 dark:text-slate-300">
                                {update.description}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                      {t("health.history.no_updates")}
                    </p>
                  )}
                </section>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </LandingLayout>
  );
}
