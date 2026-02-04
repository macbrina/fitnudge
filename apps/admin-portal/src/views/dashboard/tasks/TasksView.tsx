"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import { Button, Input, Skeleton } from "@fitnudge/ui";
import { StatCard } from "@/components/StatCard";
import {
  useTasksOverview,
  useTaskPurge,
  useTaskCatchup,
} from "@/hooks/api/useTasks";
import { ROUTES } from "@/lib/routes";
import { useAlertModal } from "@/contexts/AlertModalContext";
import {
  Activity,
  AlertTriangle,
  Calendar,
  Clock,
  List,
  Search,
  Workflow,
  Zap,
  Trash2,
  Play,
  ArrowRight,
  Cpu,
  Terminal,
} from "lucide-react";

export function TasksView() {
  const { t } = useTranslation();
  const { showConfirm } = useAlertModal();
  const [taskLookupId, setTaskLookupId] = useState("");

  const { data: overview, isLoading, isError } = useTasksOverview();
  const purgeMutation = useTaskPurge();
  const catchupMutation = useTaskCatchup();

  const handlePurge = async () => {
    try {
      await showConfirm({
        title: t("admin.tasks.purge_title"),
        message: t("admin.tasks.purge_message"),
        variant: "error",
        confirmLabel: t("admin.tasks.purge"),
        cancelLabel: t("admin.users.cancel"),
        onConfirm: async () => {
          await purgeMutation.mutateAsync(undefined);
          toast.success(t("admin.tasks.purge_success"));
        },
      });
    } catch {
      toast.error(t("admin.tasks.purge_error"));
    }
  };

  const handleCatchup = async () => {
    try {
      await showConfirm({
        title: t("admin.tasks.catchup_title"),
        message: t("admin.tasks.catchup_message"),
        variant: "info",
        confirmLabel: t("admin.tasks.trigger"),
        cancelLabel: t("admin.users.cancel"),
        onConfirm: async () => {
          await catchupMutation.mutateAsync({ lookback_days: 7 });
          toast.success(t("admin.tasks.catchup_success"));
        },
      });
    } catch {
      toast.error(t("admin.tasks.catchup_error"));
    }
  };

  const handleLookup = () => {
    if (taskLookupId.trim()) {
      window.location.href = `${ROUTES.TASKS}/${taskLookupId.trim()}`;
    }
  };

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-8 text-center">
        <p className="text-red-700 dark:text-red-400 font-medium">
          {t("admin.tasks.connection_error")}
        </p>
        <p className="text-sm text-red-600 dark:text-red-500 mt-2">
          {t("admin.tasks.connection_hint")}
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {t("admin.pages.tasks_overview_description")}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </>
        ) : overview ? (
          <>
            <StatCard
              label={t("admin.tasks.workers_online")}
              value={overview.workers_online}
            />
            <StatCard
              label={t("admin.tasks.active")}
              value={overview.active_tasks}
            />
            <StatCard
              label={t("admin.tasks.scheduled")}
              value={overview.scheduled_tasks}
            />
            <StatCard
              label={t("admin.tasks.reserved")}
              value={overview.reserved_tasks}
            />
          </>
        ) : null}
      </div>

      {/* Task Lookup - Inspect success/error for any task */}
      <div className="mb-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-950 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Search className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {t("admin.tasks.lookup_title")}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("admin.tasks.lookup_hint")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. abc123-def456-..."
            value={taskLookupId}
            onChange={(e) => setTaskLookupId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            className="font-mono text-sm max-w-md"
          />
          <Button onClick={handleLookup} disabled={!taskLookupId.trim()}>
            <Search className="h-4 w-4 mr-2" />
            {t("admin.tasks.inspect")}
          </Button>
        </div>
      </div>

      {/* Quick nav + Workers */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              {t("admin.tasks.quick_actions")}
            </h3>
          </div>
          <div className="p-4 grid sm:grid-cols-2 gap-3">
            <Link
              href={ROUTES.TASKS_LOGS}
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Terminal className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white group-hover:text-primary">
                  {t("admin.menu.task_logs")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {t("admin.pages.task_logs_description")}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary shrink-0" />
            </Link>
            <Link
              href={ROUTES.TASKS_ACTIVE}
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white group-hover:text-primary">
                  {t("admin.menu.active")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {t("admin.tasks.active_desc")}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary shrink-0" />
            </Link>
            <Link
              href={ROUTES.TASKS_SCHEDULED}
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white group-hover:text-primary">
                  {t("admin.menu.scheduled")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {t("admin.tasks.scheduled_desc")}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary shrink-0" />
            </Link>
            <Link
              href={ROUTES.TASKS_WORKERS}
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                <Cpu className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white group-hover:text-primary">
                  {t("admin.menu.workers")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {t("admin.tasks.workers_desc")}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary shrink-0" />
            </Link>
            <Link
              href={ROUTES.TASKS_FAILURES}
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white group-hover:text-primary">
                  {t("admin.menu.task_failures")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {t("admin.pages.task_failures_description")}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary shrink-0" />
            </Link>
            <Link
              href={ROUTES.TASKS_REGISTERED}
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <List className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white group-hover:text-primary">
                  {t("admin.menu.registered")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {t("admin.tasks.registered_desc")}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary shrink-0" />
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Workflow className="h-4 w-4" />
              {t("admin.tasks.workers")}
            </h3>
          </div>
          <div className="p-4 max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : overview?.workers?.length ? (
              <div className="space-y-2">
                {overview.workers.map((w) => (
                  <div
                    key={w.name}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm text-gray-900 dark:text-white truncate">
                        {w.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {w.active_tasks} active
                        {w.processed != null && ` · ${w.processed} processed`}
                      </p>
                    </div>
                    <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                {t("admin.tasks.no_workers")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-6">
        <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          {t("admin.tasks.maintenance_actions")}
        </h3>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCatchup}
            disabled={catchupMutation.isPending}
            className="border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30"
          >
            <Play className="h-4 w-4 mr-2" />
            {catchupMutation.isPending
              ? t("admin.tasks.triggering")
              : t("admin.tasks.trigger_catchup")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePurge}
            disabled={purgeMutation.isPending}
            className="border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {purgeMutation.isPending
              ? t("admin.tasks.purging")
              : t("admin.tasks.purge")}
          </Button>
        </div>
      </div>
    </>
  );
}
