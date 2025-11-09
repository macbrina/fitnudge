"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@fitnudge/ui";
import { LandingLayout } from "@/components/layout/LandingLayout";
import { History as HistoryIcon, InfoIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import {
  HealthCheckResult,
  HealthReport,
  HealthStatus,
  resolveApiBase,
} from "@/lib/systemHealth";
import {
  HealthStatusBadge,
  STATUS_BADGE_CLASSES,
} from "@/components/health/StatusBadge";

interface HistoryEntry {
  timestamp: string;
  status: HealthStatus;
}

type ComponentHistory = Record<string, HistoryEntry[]>;

const HISTORY_KEY = "fitnudge.health.history";
const COMPONENT_HISTORY_KEY = "fitnudge.health.component-history";
const MAX_HISTORY_POINTS = 56;

const TIMELINE_COLOR_CLASS: Record<HealthStatus, string> = {
  ok: "bg-success",
  degraded: "bg-warning",
  critical: "bg-destructive",
  not_configured: "bg-secondary",
};

const TIMELINE_HEIGHT_CLASS: Record<HealthStatus, string> = {
  ok: "h-14",
  degraded: "h-10",
  critical: "h-6",
  not_configured: "h-8",
};

const TIMELINE_OPACITY_CLASS: Record<HealthStatus, string> = {
  ok: "opacity-95",
  degraded: "opacity-95",
  critical: "opacity-95",
  not_configured: "opacity-40",
};

const COMPONENT_DISPLAY: Record<
  string,
  {
    nameKey: string;
    descriptionKeys?: Partial<Record<HealthStatus, string>>;
  }
> = {
  environment: {
    nameKey: "health.components.environment.name",
    descriptionKeys: {
      ok: "health.components.environment.descriptions.ok",
      degraded: "health.components.environment.descriptions.degraded",
      critical: "health.components.environment.descriptions.critical",
    },
  },
  supabase: {
    nameKey: "health.components.supabase.name",
    descriptionKeys: {
      ok: "health.components.supabase.descriptions.ok",
      critical: "health.components.supabase.descriptions.critical",
    },
  },
  redis: {
    nameKey: "health.components.redis.name",
    descriptionKeys: {
      ok: "health.components.redis.descriptions.ok",
      critical: "health.components.redis.descriptions.critical",
    },
  },
  celery: {
    nameKey: "health.components.celery.name",
    descriptionKeys: {
      ok: "health.components.celery.descriptions.ok",
      degraded: "health.components.celery.descriptions.degraded",
      critical: "health.components.celery.descriptions.critical",
    },
  },
  smtp: {
    nameKey: "health.components.smtp.name",
    descriptionKeys: {
      ok: "health.components.smtp.descriptions.ok",
      degraded: "health.components.smtp.descriptions.degraded",
    },
  },
  openai: {
    nameKey: "health.components.openai.name",
    descriptionKeys: {
      ok: "health.components.openai.descriptions.ok",
      not_configured: "health.components.openai.descriptions.not_configured",
    },
  },
  elevenlabs: {
    nameKey: "health.components.elevenlabs.name",
    descriptionKeys: {
      ok: "health.components.elevenlabs.descriptions.ok",
      not_configured:
        "health.components.elevenlabs.descriptions.not_configured",
    },
  },
  cloudflare_r2: {
    nameKey: "health.components.cloudflare_r2.name",
    descriptionKeys: {
      ok: "health.components.cloudflare_r2.descriptions.ok",
      not_configured:
        "health.components.cloudflare_r2.descriptions.not_configured",
    },
  },
};

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

const formatTimestamp = (
  value?: string,
  loading?: boolean,
  t?: TranslateFn
) => {
  if (loading) {
    return t ? t("health.metrics.loading_placeholder") : "—";
  }
  if (!value) return t ? t("health.labels.unknown") : "Unknown";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const formatLatency = (value?: number | null) => {
  if (value === undefined || value === null) {
    return "—";
  }
  return `${value.toFixed(2)} ms`;
};

const computeUptime = (
  history: HistoryEntry[],
  fallbackStatus?: HealthStatus
) => {
  if (history.length === 0) {
    if (!fallbackStatus) return 100;
    return fallbackStatus === "ok" || fallbackStatus === "not_configured"
      ? 100
      : 0;
  }
  const healthy = history.filter(
    (entry) => entry.status === "ok" || entry.status === "not_configured"
  ).length;
  return Math.round((healthy / history.length) * 100);
};

const loadHistory = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const saveHistory = (key: string, value: unknown) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore write failures
  }
};

const StatusTimeline = ({
  history,
  loading = false,
}: {
  history: HistoryEntry[];
  loading?: boolean;
}) => {
  const entries =
    history.length > 0
      ? history
      : Array.from({ length: MAX_HISTORY_POINTS }, (_, idx) => ({
          timestamp: `${idx}`,
          status: "not_configured" as HealthStatus,
        }));

  return (
    <div className="flex h-16 items-end gap-[3px]">
      {entries.map((entry, index) => {
        const colorClass = loading
          ? "bg-secondary"
          : TIMELINE_COLOR_CLASS[entry.status];
        const heightClass = loading
          ? "h-12"
          : TIMELINE_HEIGHT_CLASS[entry.status];
        const opacityClass = loading
          ? "opacity-80"
          : TIMELINE_OPACITY_CLASS[entry.status];

        return (
          <span
            key={`${entry.timestamp}-${index}`}
            className={`flex-1 rounded-full transition-all duration-300 ${colorClass} ${heightClass} ${opacityClass}`}
          />
        );
      })}
    </div>
  );
};

const getDisplayData = (check: HealthCheckResult, t: TranslateFn) => {
  const config = COMPONENT_DISPLAY[check.component];
  const name = config ? t(config.nameKey) : check.component.replace(/_/g, " ");
  const descriptionKey =
    config?.descriptionKeys?.[check.status] ??
    config?.descriptionKeys?.ok ??
    null;
  const description = descriptionKey ? t(descriptionKey) : check.details;
  return { name, description };
};

const ComponentCard = ({
  check,
  history,
  isLoading,
}: {
  check: HealthCheckResult;
  history: HistoryEntry[];
  isLoading?: boolean;
}) => {
  const { t } = useTranslation();
  const { name, description } = getDisplayData(check, t);
  const uptime = computeUptime(history, check.status);

  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-lg transition-all dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/20 sm:p-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {name}
              </h3>
              <HealthStatusBadge status={check.status} loading={isLoading} />
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {description || check.details}
            </p>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-300">
            <p className="font-semibold text-slate-700 dark:text-white">
              {t("health.cards.uptime", { value: uptime })}
            </p>
            <p className="text-xs">
              {t("health.cards.last_check", {
                value: formatLatency(check.latency_ms),
              })}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/60 bg-slate-100/70 p-4 shadow-inner dark:border-white/10 dark:bg-slate-900/60">
          <StatusTimeline history={history} loading={Boolean(isLoading)} />
        </div>
      </div>
    </div>
  );
};

export default function HealthPage() {
  const { root } = useMemo(resolveApiBase, []);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [componentHistory, setComponentHistory] = useState<ComponentHistory>(
    {}
  );
  const [showDetails, setShowDetails] = useState(false);
  const { t } = useTranslation();
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setHistory(loadHistory<HistoryEntry[]>(HISTORY_KEY, []));
    setComponentHistory(
      loadHistory<ComponentHistory>(COMPONENT_HISTORY_KEY, {})
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    const recordHistory = (
      report: HealthReport | null,
      fallbackStatus: HealthStatus,
      fallbackMessage?: string
    ) => {
      const timestamp = report?.timestamp ?? new Date().toISOString();
      const overallStatus = report?.status ?? fallbackStatus;
      const entry: HistoryEntry = { timestamp, status: overallStatus };

      setHistory((prev) => {
        const filtered = prev.filter(
          (item) => item.timestamp !== entry.timestamp
        );
        const updated = [...filtered, entry].slice(-MAX_HISTORY_POINTS);
        saveHistory(HISTORY_KEY, updated);
        return updated;
      });

      if (report?.checks) {
        setComponentHistory((prev) => {
          const updated: ComponentHistory = { ...prev };
          report.checks.forEach((check) => {
            const historyList = updated[check.component] ?? [];
            const filteredList = historyList.filter(
              (item) => item.timestamp !== report.timestamp
            );
            updated[check.component] = [
              ...filteredList,
              {
                timestamp: report.timestamp,
                status: check.status,
              },
            ].slice(-MAX_HISTORY_POINTS);
          });
          saveHistory(COMPONENT_HISTORY_KEY, updated);
          return updated;
        });
      } else if (fallbackMessage) {
        // Record fallback status for all components when the report is missing
        setComponentHistory((prev) => {
          const updated: ComponentHistory = { ...prev };
          Object.keys(updated).forEach((component) => {
            const historyList = updated[component] ?? [];
            updated[component] = [
              ...historyList,
              { timestamp, status: fallbackStatus },
            ].slice(-MAX_HISTORY_POINTS);
          });
          saveHistory(COMPONENT_HISTORY_KEY, updated);
          return updated;
        });
      }
    };

    const fetchHealth = async () => {
      if (!root) {
        const message = t("health.error.missing_api");
        setError(message);
        setLoading(false);
        recordHistory(null, "critical", message);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${root}/health`, { cache: "no-cache" });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const errorMessage =
            payload?.detail || payload?.error || `Status ${response.status}`;
          throw new Error(errorMessage);
        }

        const data = (await response.json()) as HealthReport;
        if (!cancelled) {
          setHealth(data);
        }
        recordHistory(data, data.status);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load health status", err);
          const message =
            err instanceof Error && err.message
              ? err.message
              : t("health.error.title");
          setError(message);
          recordHistory(null, "critical", message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchHealth();
    return () => {
      cancelled = true;
    };
  }, [root, t]);

  const overallStatus: HealthStatus =
    health?.status ?? (error ? "critical" : "ok");
  const fallbackCurrentUptime = health
    ? Math.round(
        (health.checks.filter(
          (check) => check.status === "ok" || check.status === "not_configured"
        ).length /
          Math.max(health.checks.length, 1)) *
          100
      )
    : undefined;
  const uptime =
    fallbackCurrentUptime !== undefined
      ? fallbackCurrentUptime
      : computeUptime(history, overallStatus);
  const incidentComponents = health?.checks.filter(
    (check) => check.status !== "ok" && check.status !== "not_configured"
  );
  const loadingPlaceholder = t("health.metrics.loading_placeholder");
  const environmentValue = loading
    ? loadingPlaceholder
    : health?.environment || t("health.labels.unknown");
  const apiVersionValue = loading
    ? loadingPlaceholder
    : health?.version || t("health.labels.unknown");
  const backendUrl = root ?? t("health.error.default_url");

  // History list and details are handled on dedicated routes.

  const renderComponentCards = () => {
    if (!health) return null;

    return health.checks.map((check) => (
      <ComponentCard
        key={check.component}
        check={check}
        history={componentHistory[check.component] ?? []}
        isLoading={loading}
      />
    ));
  };

  return (
    <LandingLayout>
      <div className="w-full bg-slate-100/80 text-slate-900 transition-colors dark:bg-slate-950/90 dark:text-white">
        <section className="relative overflow-hidden border-y border-slate-200/60 bg-linear-to-br from-white via-sky-50 to-blue-100 py-16 text-slate-900 shadow-sm transition-colors dark:border-white/10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-white">
          <div className="pointer-events-none absolute inset-0 opacity-60 blur-3xl">
            <div className="absolute -left-32 top-10 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.35),transparent_65%)] dark:bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15),transparent_70%)]" />
            <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.28),transparent_65%)] dark:bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.18),transparent_70%)]" />
          </div>

          <div className="relative mx-auto w-full max-w-6xl px-6 lg:px-8">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-4 py-1 text-sm font-medium shadow-sm dark:border-white/20 dark:bg-white/10">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-success" />
                {t("health.badge")}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h1 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-white lg:text-5xl">
                    {t("health.title")}
                  </h1>
                  <HealthStatusBadge status={overallStatus} loading={loading} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t("health.how_we_track.button")}
                        className="rounded-full border border-slate-200/70 bg-white/70 px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white/90 hover:text-slate-900 dark:border-white/20 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
                      >
                        <InfoIcon className="mr-2 size-4" />
                        {t("health.how_we_track.button")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg space-y-4 border-slate-200 bg-white/95 text-slate-900 dark:border-white/10 dark:bg-slate-950/90 dark:text-white">
                      <DialogHeader className="gap-2 text-left">
                        <DialogTitle>
                          {t("health.how_we_track.title")}
                        </DialogTitle>
                        <DialogDescription className="text-left text-sm text-slate-600 dark:text-slate-300">
                          {t("health.how_we_track.description")}
                        </DialogDescription>
                      </DialogHeader>
                      <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
                        <li className="flex items-start gap-3">
                          <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-success" />
                          <span>{t("health.how_we_track.items.api")}</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-warning" />
                          <span>{t("health.how_we_track.items.queues")}</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-destructive" />
                          <span>
                            {t("health.how_we_track.items.third_party")}
                          </span>
                        </li>
                      </ul>
                    </DialogContent>
                  </Dialog>

                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    aria-label={t("health.history.view_button")}
                    className="rounded-full border border-slate-200/70 bg-white/70 px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white/90 hover:text-slate-900 dark:border-white/20 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
                  >
                    <Link href="/health/history">
                      <HistoryIcon className="mr-2 size-4" />
                      {t("health.history.view_button")}
                    </Link>
                  </Button>
                </div>
              </div>

              <p className="max-w-2xl text-base text-slate-700 dark:text-slate-300">
                {t("health.tagline")}
              </p>

              <div className="rounded-[28px] border border-slate-200/80 bg-white/85 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/60 sm:p-8">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        {t("health.metrics.overall_uptime")}
                      </p>
                      <p className="text-3xl font-semibold text-slate-900 dark:text-white">
                        {t("health.metrics.healthy_checks", { value: uptime })}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-6 text-sm text-slate-600 dark:text-slate-300">
                      <div>
                        <p className="uppercase tracking-wide text-xs text-slate-400 dark:text-slate-500">
                          {t("health.metrics.last_updated")}
                        </p>
                        <p>{formatTimestamp(health?.timestamp, loading, t)}</p>
                      </div>
                      <div>
                        <p className="uppercase tracking-wide text-xs text-slate-400 dark:text-slate-500">
                          {t("health.metrics.environment")}
                        </p>
                        <p className="capitalize">{environmentValue}</p>
                      </div>
                      <div>
                        <p className="uppercase tracking-wide text-xs text-slate-400 dark:text-slate-500">
                          {t("health.metrics.api_version")}
                        </p>
                        <p>{apiVersionValue}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/70 bg-slate-100/70 p-4 shadow-inner dark:border-white/10 dark:bg-slate-900/50">
                    <StatusTimeline history={history} loading={loading} />
                  </div>

                  <div className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-white">
                        {incidentComponents && incidentComponents.length > 0
                          ? t("health.cards.affected", {
                              count: incidentComponents.length,
                            })
                          : loading
                            ? t("health.incidents.loading")
                            : t("health.incidents.none")}
                      </span>
                    </div>
                    {incidentComponents && incidentComponents.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowDetails((prev) => !prev)}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-sky-600 transition hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200"
                      >
                        {showDetails
                          ? t("health.incidents.hide_details")
                          : t("health.incidents.show_details")}
                        <span aria-hidden>▾</span>
                      </button>
                    )}
                  </div>

                  {showDetails &&
                    incidentComponents &&
                    incidentComponents.length > 0 && (
                      <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {t("health.incidents.title")}
                        </p>
                        <ul className="mt-3 space-y-2">
                          {incidentComponents.map((check) => {
                            const { name } = getDisplayData(check, t);
                            return (
                              <li
                                key={check.component}
                                className="flex items-start gap-2"
                              >
                                <span
                                  className={`mt-1 inline-flex h-2 w-2 rounded-full ${STATUS_BADGE_CLASSES[check.status].dot}`}
                                />
                                <div>
                                  <p className="font-medium text-slate-900 dark:text-white">
                                    {name}
                                  </p>
                                  <p className="text-slate-600 dark:text-slate-300">
                                    {check.details ||
                                      t("health.incidents.investigating")}
                                  </p>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-8">
          {loading && (
            <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 text-slate-700 shadow-lg dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 animate-pulse rounded-full bg-primary" />
                <p className="text-sm font-medium">
                  {t("health.loading_banner")}
                </p>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-3xl border border-destructive-soft bg-destructive-soft/60 p-6 text-sm text-destructive shadow-lg">
              <div className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-3 w-3 shrink-0 rounded-full bg-destructive" />
                <div className="space-y-3">
                  <div>
                    <p className="text-base font-semibold">
                      {t("health.error.title")}
                    </p>
                    <p className="mt-1 text-sm text-destructive/90">{error}</p>
                  </div>
                  <div className="rounded-2xl border border-destructive-soft/60 bg-white/80 px-4 py-2 text-xs text-destructive dark:bg-destructive/10">
                    {t("health.error.developer_hint", { url: backendUrl })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && health && (
            <section className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {t("health.components_section.title")}
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {t("health.components_section.description")}
                </p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                {renderComponentCards()}
              </div>
            </section>
          )}
        </section>
      </div>
    </LandingLayout>
  );
}
