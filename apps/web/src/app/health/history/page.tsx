"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  UpdateStatusBadge,
} from "@/components/health/StatusBadge";
import { Button } from "@fitnudge/ui";
import { LandingLayout } from "@/components/layout/LandingLayout";

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "full",
});

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

type HistoryGroup = {
  label: string;
  entries: HealthHistoryEntry[];
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

const getLatestUpdate = (
  updates: HealthHistoryUpdate[]
): HealthHistoryUpdate | null => {
  if (!updates || updates.length === 0) {
    return null;
  }
  return updates[updates.length - 1];
};

export default function HealthHistoryListPage() {
  const { t } = useTranslation();
  const { apiV1 } = useMemo(resolveApiBase, []);
  const [entries, setEntries] = useState<HealthHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      if (!apiV1) {
        setError(t("health.history.missing_api"));
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiV1}/system/health/history`, {
          cache: "no-cache",
        });

        if (!response.ok) {
          throw new Error(`Status ${response.status}`);
        }

        const data = (await response.json()) as HealthHistoryEntry[];
        if (!cancelled) {
          setEntries(
            data.map((entry) => ({
              ...entry,
              updates: entry.updates ?? [],
            }))
          );
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

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [apiV1, t]);

  const grouped = useMemo<HistoryGroup[]>(() => {
    const map = new Map<string, HistoryGroup>();

    entries.forEach((entry) => {
      const created = new Date(entry.created_at);
      const key = created.toISOString().slice(0, 10);
      if (!map.has(key)) {
        map.set(key, {
          label: DATE_FORMAT.format(created),
          entries: [],
        });
      }
      map.get(key)!.entries.push(entry);
    });

    return Array.from(map.entries())
      .sort((a, b) => (a[0] > b[0] ? -1 : 1))
      .map(([, group]) => group);
  }, [entries]);

  return (
    <LandingLayout>
      <div className="w-full bg-slate-100/80 py-16 text-slate-900 transition-colors dark:bg-slate-950/90 dark:text-white">
        <div className="mx-auto w-full max-w-4xl px-6 lg:px-8">
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 shadow-sm dark:border-white/20 dark:bg-white/10 dark:text-slate-300">
                {t("health.history.title")}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white lg:text-4xl">
                {t("health.history.list_heading")}
              </h1>
              <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                {t("health.history.list_description")}
              </p>
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
            ) : grouped.length === 0 ? (
              <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 text-slate-700 shadow-lg dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
                <p className="text-sm font-medium">
                  {t("health.history.empty")}
                </p>
              </div>
            ) : (
              <div className="space-y-10">
                {grouped.map((group) => (
                  <section key={group.label} className="space-y-4">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {group.label}
                    </h2>
                    <div className="space-y-4">
                      {group.entries.map((entry) => {
                        const summary = buildSummary(entry, t);
                        const latest = getLatestUpdate(entry.updates);
                        const referenceDate = new Date(
                          latest?.created_at ?? entry.created_at
                        );
                        return (
                          <article
                            key={entry.id}
                            className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-sm transition hover:shadow-lg dark:border-white/10 dark:bg-slate-900/60"
                          >
                            <Link
                              href={`/health/history/${entry.id}`}
                              className="flex flex-col gap-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <HealthStatusBadge status={entry.status} />
                                <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  {DATE_TIME_FORMAT.format(referenceDate)} ·{" "}
                                  {formatRelativeTime(referenceDate)}
                                </span>
                              </div>
                              <div className="space-y-2">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                  {summary}
                                </h3>
                                {latest ? (
                                  <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                                    <div className="inline-flex items-center gap-2">
                                      <UpdateStatusBadge
                                        status={latest.status}
                                      />
                                      <span className="font-semibold">
                                        {latest.title}
                                      </span>
                                    </div>
                                    <p>{latest.description}</p>
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-600 dark:text-slate-300">
                                    {t("health.history.no_updates")}
                                  </p>
                                )}
                                <span className="inline-flex items-center gap-2 text-sm font-semibold text-sky-600 transition hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200">
                                  {t("health.history.view_details")}
                                </span>
                              </div>
                            </Link>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </LandingLayout>
  );
}
