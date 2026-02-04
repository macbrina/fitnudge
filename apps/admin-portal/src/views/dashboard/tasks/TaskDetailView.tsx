"use client";

import { use } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@fitnudge/ui";
import {
  useTaskDetail,
  useTaskRevoke,
} from "@/hooks/api/useTasks";
import { ROUTES } from "@/lib/routes";
import { useAlertModal } from "@/contexts/AlertModalContext";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Ban,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";

type Props = {
  params: Promise<{ id: string }>;
};

function formatJson(val: unknown): string {
  if (val === null || val === undefined) return "—";
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}

export function TaskDetailView({ params }: Props) {
  const { id } = use(params);
  const { t } = useTranslation();
  const { showConfirm } = useAlertModal();
  const [tracebackExpanded, setTracebackExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: task, isLoading, isError } = useTaskDetail(id);
  const revokeMutation = useTaskRevoke();

  const handleRevoke = async () => {
    try {
      await showConfirm({
        title: t("admin.tasks.revoke_title"),
        message: t("admin.tasks.revoke_message"),
        variant: "warning",
        confirmLabel: t("admin.tasks.revoke"),
        cancelLabel: t("admin.users.cancel"),
        onConfirm: async () => {
          await revokeMutation.mutateAsync({ id, terminate: true });
          toast.success(t("admin.tasks.revoke_success"));
        },
      });
    } catch {
      toast.error(t("admin.tasks.revoke_error"));
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading && !task) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (isError || !task) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-8 text-center">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
          {t("admin.tasks.task_not_found")}
        </h2>
        <p className="text-sm text-red-600 dark:text-red-400 mb-6">
          {t("admin.tasks.task_not_found_hint")}
        </p>
        <Link href={ROUTES.TASKS}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("admin.tasks.back_to_overview")}
          </Button>
        </Link>
      </div>
    );
  }

  const isSuccess = task.state === "SUCCESS";
  const isFailure = task.state === "FAILURE";
  const isTerminal = ["SUCCESS", "FAILURE", "REVOKED"].includes(task.state);

  const stateConfig: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
    SUCCESS: {
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    },
    FAILURE: {
      icon: XCircle,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-500/10 dark:bg-red-500/20",
    },
    PENDING: {
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 dark:bg-amber-500/20",
    },
    STARTED: {
      icon: Loader2,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10 dark:bg-blue-500/20",
    },
    REVOKED: {
      icon: Ban,
      color: "text-gray-600 dark:text-gray-400",
      bg: "bg-gray-500/10 dark:bg-gray-500/20",
    },
  };

  const config = stateConfig[task.state] ?? stateConfig.PENDING;
  const StateIcon = config.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={ROUTES.TASKS}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("admin.tasks.back_to_overview")}
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyId}
              className="font-mono text-sm text-gray-600 dark:text-gray-400 hover:text-primary flex items-center gap-1"
              title={t("admin.tasks.copy_id")}
            >
              {id.slice(0, 8)}...{id.slice(-4)}
              {copied ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>
        {!isTerminal && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRevoke}
            disabled={revokeMutation.isPending}
            className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
          >
            <Ban className="h-4 w-4 mr-2" />
            {t("admin.tasks.revoke")}
          </Button>
        )}
      </div>

      {/* State + Name */}
      <div className="flex items-center gap-4 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div
          className={`p-3 rounded-xl ${config.bg} ${config.color}`}
        >
          {task.state === "STARTED" ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <StateIcon className="h-8 w-8" />
          )}
        </div>
        <div>
          <p className="font-mono text-sm text-gray-500 dark:text-gray-400">
            {task.name ?? "—"}
          </p>
          <p className={`font-semibold text-lg ${config.color}`}>
            {task.state}
          </p>
        </div>
      </div>

      {/* Success: Result output */}
      {isSuccess && task.result !== undefined && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 overflow-hidden">
          <div className="px-4 py-3 bg-emerald-500/10 dark:bg-emerald-500/20 border-b border-emerald-200/50 dark:border-emerald-900/50">
            <h3 className="font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {t("admin.tasks.result")}
            </h3>
          </div>
          <pre className="p-4 overflow-x-auto text-sm font-mono text-emerald-900 dark:text-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/30 min-h-[120px]">
            {formatJson(task.result)}
          </pre>
        </div>
      )}

      {/* Failure: Error + Traceback */}
      {isFailure && (
        <div className="space-y-4">
          {task.error && (
            <div className="rounded-2xl border border-red-200 dark:border-red-900/50 overflow-hidden">
              <div className="px-4 py-3 bg-red-500/10 dark:bg-red-500/20 border-b border-red-200/50 dark:border-red-900/50">
                <h3 className="font-semibold text-red-800 dark:text-red-200 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  {t("admin.tasks.error")}
                </h3>
              </div>
              <pre className="p-4 overflow-x-auto text-sm font-mono text-red-900 dark:text-red-100 bg-red-50/50 dark:bg-red-950/30 whitespace-pre-wrap break-words">
                {task.error}
              </pre>
            </div>
          )}
          {task.traceback && (
            <div className="rounded-2xl border border-red-200/70 dark:border-red-900/50 overflow-hidden">
              <button
                type="button"
                onClick={() => setTracebackExpanded(!tracebackExpanded)}
                className="w-full px-4 py-3 bg-red-500/10 dark:bg-red-500/20 border-b border-red-200/50 dark:border-red-900/50 flex items-center justify-between hover:bg-red-500/15 dark:hover:bg-red-500/25 transition-colors"
              >
                <h3 className="font-semibold text-red-800 dark:text-red-200 flex items-center gap-2">
                  {tracebackExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {t("admin.tasks.traceback")}
                </h3>
              </button>
              {tracebackExpanded && (
                <pre className="p-4 overflow-x-auto text-xs font-mono text-red-800 dark:text-red-200 bg-red-50/30 dark:bg-red-950/20 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                  {task.traceback}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Args & Kwargs */}
      {(task.args?.length || (task.kwargs && Object.keys(task.kwargs).length)) ? (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {t("admin.tasks.args_kwargs")}
            </h3>
          </div>
          <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900">
            {formatJson({ args: task.args ?? [], kwargs: task.kwargs ?? {} })}
          </pre>
        </div>
      ) : null}

      {/* Timing */}
      {(task.started_at || task.completed_at) && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            {t("admin.tasks.timing")}
          </h3>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            {task.started_at && (
              <p>
                {t("admin.tasks.started")}:{" "}
                {new Date(task.started_at).toLocaleString()}
              </p>
            )}
            {task.completed_at && (
              <p>
                {t("admin.tasks.completed")}:{" "}
                {new Date(task.completed_at).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
