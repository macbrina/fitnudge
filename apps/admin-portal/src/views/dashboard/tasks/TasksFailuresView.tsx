"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Skeleton,
} from "@fitnudge/ui";
import { useTasksFailures, useTaskFailureDelete } from "@/hooks/api/useTasks";
import { ROUTES } from "@/lib/routes";
import { useAlertModal } from "@/contexts/AlertModalContext";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react";
import type { TaskFailureEntry } from "@/lib/api";

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

function FailureRow({
  entry,
  onDelete,
  deleteTitle,
}: {
  entry: TaskFailureEntry;
  onDelete: (id: string) => void;
  deleteTitle: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasTraceback = !!entry.traceback;

  return (
    <>
      <TableRow className="group">
        <TableCell>
          <span className="font-mono text-sm text-gray-900 dark:text-white">
            {entry.task_name ?? "—"}
          </span>
        </TableCell>
        <TableCell>
          <span
            className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
              entry.state === "SOFT_FAILURE"
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
            }`}
          >
            {entry.state}
          </span>
        </TableCell>
        <TableCell className="max-w-md">
          <p className="truncate font-mono text-xs text-red-700 dark:text-red-300" title={entry.error_message}>
            {entry.error_message}
          </p>
        </TableCell>
        <TableCell className="text-xs text-gray-500 dark:text-gray-400">
          {formatTime(entry.created_at)}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Link
              href={ROUTES.apiTaskDetail(entry.task_id)}
              className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-primary dark:hover:bg-gray-700 dark:hover:text-primary"
              title="View task detail"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => onDelete(entry.id)}
              className="rounded p-1.5 text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
              title={deleteTitle}
            >
              <Trash2 className="h-4 w-4" />
            </button>
            {hasTraceback && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-primary dark:hover:bg-gray-700"
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {expanded && entry.traceback && (
        <TableRow>
          <TableCell colSpan={5} className="bg-red-50/50 dark:bg-red-950/20 p-4">
            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-red-800 dark:text-red-200 max-h-48 overflow-y-auto">
              {entry.traceback}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function escapeCsvCell(val: string): string {
  if (val.includes('"') || val.includes(",") || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function TasksFailuresView() {
  const { t } = useTranslation();
  const [taskFilter, setTaskFilter] = useState<string>("");
  const { showConfirm } = useAlertModal();
  const { data, isLoading, isError, refetch } = useTasksFailures({
    limit: 150,
    task_name: taskFilter || undefined,
  });
  const deleteMutation = useTaskFailureDelete();

  const failures = data?.failures ?? [];
  const taskNames = Array.from(
    new Set(failures.map((f) => f.task_name).filter((n): n is string => Boolean(n)))
  ).sort();

  const handleDelete = async (recordId: string) => {
    try {
      await showConfirm({
        title: t("admin.tasks.delete_failure_title"),
        message: t("admin.tasks.delete_failure_message"),
        variant: "warning",
        confirmLabel: t("admin.tasks.delete_failure"),
        cancelLabel: t("admin.users.cancel"),
        onConfirm: async () => {
          await deleteMutation.mutateAsync(recordId);
        },
      });
    } catch {
      // Cancelled
    }
  };

  const handleExportCsv = () => {
    const headers = ["task_name", "state", "error_message", "created_at"];
    const rows = failures.map((f) =>
      [
        escapeCsvCell(f.task_name ?? ""),
        escapeCsvCell(f.state),
        escapeCsvCell(f.error_message ?? ""),
        escapeCsvCell(f.created_at ?? ""),
      ].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `task-failures-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-700 dark:text-red-400 font-medium">
          {t("admin.tasks.connection_error")}
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            {t("admin.tasks.failures_title")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t("admin.tasks.failures_subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={failures.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            {t("admin.tasks.failures_export_csv")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("admin.tasks.refresh")}
          </Button>
        </div>
      </div>

      {taskNames.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">
            {t("admin.tasks.filter_by_task")}:
          </label>
          <select
            value={taskFilter}
            onChange={(e) => setTaskFilter(e.target.value)}
            className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm"
          >
            <option value="">{t("admin.tasks.filter_all")}</option>
            {taskNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : failures.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">{t("admin.tasks.failures_empty")}</p>
            <p className="text-sm mt-1">{t("admin.tasks.failures_empty_hint")}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.tasks.col_task")}</TableHead>
                <TableHead>{t("admin.tasks.col_state")}</TableHead>
                <TableHead>{t("admin.tasks.col_error")}</TableHead>
                <TableHead>{t("admin.tasks.col_created")}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {failures.map((entry) => (
                <FailureRow
                key={entry.id}
                entry={entry}
                onDelete={handleDelete}
                deleteTitle={t("admin.tasks.delete_failure")}
              />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
