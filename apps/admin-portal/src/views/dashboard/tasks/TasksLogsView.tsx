"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { Button, Input } from "@fitnudge/ui";
import { useTasksRecent } from "@/hooks/api/useTasks";
import { ROUTES } from "@/lib/routes";
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Terminal,
  Zap,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";
import type { TaskLogEntry } from "@/lib/api";

type Filter = "all" | "success" | "error";

function formatJson(val: unknown): string {
  if (val === null || val === undefined) return "—";
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function LogEntry({
  entry,
  defaultExpanded,
  copyIdTitle,
}: {
  entry: TaskLogEntry;
  defaultExpanded?: boolean;
  copyIdTitle: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const [copied, setCopied] = useState(false);
  const isSuccess = entry.state === "SUCCESS";

  const copyId = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(entry.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const hasExpandable =
    (isSuccess && entry.result != null) ||
    (!isSuccess && (entry.error || entry.traceback));

  return (
    <div
      className={`
        group rounded-lg border transition-all
        ${
          isSuccess
            ? "border-emerald-500/30 bg-emerald-950/20 dark:bg-emerald-950/30 hover:border-emerald-500/50"
            : "border-red-500/30 bg-red-950/20 dark:bg-red-950/30 hover:border-red-500/50"
        }
      `}
    >
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => hasExpandable && setExpanded(!expanded)}
      >
        <div
          className={`
            mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded
            ${isSuccess ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}
          `}
        >
          {isSuccess ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-sm font-medium text-white">
              {entry.name ?? "—"}
            </span>
            <span className="text-gray-400 dark:text-gray-500">·</span>
            <button
              type="button"
              onClick={copyId}
              className="inline-flex items-center gap-1 font-mono text-xs text-gray-500 dark:text-gray-400 hover:text-primary"
              title={copyIdTitle}
            >
              {entry.id.slice(0, 8)}…{entry.id.slice(-4)}
              {copied ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3 opacity-60" />
              )}
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatTime(entry.date_done)}
            </span>
          </div>
          {!expanded && (
            <p
              className={`
                mt-1 truncate font-mono text-xs
                ${isSuccess ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}
              `}
            >
              {(() => {
                const text = isSuccess
                  ? typeof entry.result === "string"
                    ? entry.result
                    : formatJson(entry.result)
                  : (entry.error ?? "");
                return text.length > 80 ? `${text.slice(0, 80)}…` : text;
              })()}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={ROUTES.apiTaskDetail(entry.id)}
            onClick={(e) => e.stopPropagation()}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-primary dark:hover:bg-gray-700 dark:hover:text-primary"
            title="View full details"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
          {hasExpandable && (
            <span className="text-gray-400">
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>
          )}
        </div>
      </div>
      {expanded && hasExpandable && (
        <div
          className={`
            border-t px-4 pb-4 pt-2
            ${isSuccess ? "border-emerald-500/20" : "border-red-500/20"}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {isSuccess && entry.result != null && (
            <pre className="overflow-x-auto rounded bg-black/30 p-3 font-mono text-xs text-emerald-100 dark:bg-black/40">
              {formatJson(entry.result)}
            </pre>
          )}
          {!isSuccess && entry.error && (
            <pre className="overflow-x-auto rounded bg-black/30 p-3 font-mono text-xs text-red-200 dark:bg-black/40 whitespace-pre-wrap break-words">
              {entry.error}
            </pre>
          )}
          {!isSuccess && entry.traceback && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300">
                Traceback
              </summary>
              <pre className="mt-2 overflow-x-auto rounded bg-black/30 p-3 font-mono text-xs text-red-200/90 dark:bg-black/40 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                {entry.traceback}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export function TasksLogsView() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { data, isLoading, isError, refetch, isFetching } = useTasksRecent(80, {
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const logs = data?.logs ?? [];
  const statusFiltered =
    filter === "all"
      ? logs
      : filter === "success"
        ? logs.filter((l) => l.state === "SUCCESS")
        : logs.filter((l) => l.state === "FAILURE");
  const searchLower = search.trim().toLowerCase();
  const filtered = searchLower
    ? statusFiltered.filter((l) =>
        (l.name ?? "").toLowerCase().includes(searchLower)
      )
    : statusFiltered;

  const successCount = logs.filter((l) => l.state === "SUCCESS").length;
  const errorCount = logs.filter((l) => l.state === "FAILURE").length;

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-700 dark:text-red-400 font-medium">
          {t("admin.tasks.connection_error")}
        </p>
        <p className="text-sm text-red-600 dark:text-red-500 mt-2">
          {t("admin.tasks.connection_hint")}
        </p>
        <Link href={ROUTES.TASKS}>
          <Button variant="outline" className="mt-4">
            {t("admin.tasks.back_to_overview")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Terminal className="h-5 w-5 text-amber-500" />
            {t("admin.tasks.logs_title")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t("admin.tasks.logs_subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            {t("admin.tasks.logs_auto_refresh")}
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
            />
            {t("admin.tasks.refresh")}
          </Button>
        </div>
      </div>

      {/* Search + Filter tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Input
          placeholder={t("admin.tasks.logs_search_placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="font-mono max-w-xs"
        />
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-800 p-1 bg-gray-50 dark:bg-gray-900">
          {(["all", "success", "error"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`
                rounded-md px-3 py-1.5 text-sm font-medium transition
                ${
                  filter === f
                    ? "bg-white dark:bg-gray-800 text-primary shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }
              `}
            >
              {f === "all" && t("admin.tasks.filter_all")}
              {f === "success" && (
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-emerald-500" />
                  {t("admin.tasks.filter_success")} ({successCount})
                </span>
              )}
              {f === "error" && (
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                  {t("admin.tasks.filter_error")} ({errorCount})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Log stream */}
      <div
        className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-[#0f172a] dark:bg-[#0a0f1a] overflow-hidden"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      >
        <div className="border-b border-gray-700/50 px-4 py-2 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <div className="h-2 w-2 rounded-full bg-amber-500" />
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span className="ml-2 font-mono text-xs text-gray-500">
            fitnudge-task-logs
          </span>
        </div>
        <div className="p-4 space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <RefreshCw className="h-8 w-8 animate-spin mr-2" />
              {t("admin.tasks.logs_loading")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Terminal className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">{t("admin.tasks.logs_empty")}</p>
              <p className="text-sm mt-1">{t("admin.tasks.logs_empty_hint")}</p>
            </div>
          ) : (
            filtered.map((entry) => (
              <LogEntry
                key={entry.id}
                entry={entry}
                copyIdTitle={t("admin.tasks.copy_id")}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
