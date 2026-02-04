"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { Skeleton } from "@fitnudge/ui";
import { useTasksWorkers } from "@/hooks/api/useTasks";
import { ROUTES } from "@/lib/routes";
import { ArrowLeft, Cpu, CheckCircle } from "lucide-react";

export function TasksWorkersView() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useTasksWorkers();

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-8 text-center">
        <p className="text-red-700 dark:text-red-400 font-medium">
          {t("admin.tasks.connection_error")}
        </p>
      </div>
    );
  }

  const workers = data?.ping ? Object.keys(data.ping) : [];
  const stats = data?.stats ?? {};
  const registered = data?.registered ?? {};

  return (
    <>
      <Link
        href={ROUTES.TASKS}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-primary mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("admin.tasks.back_to_overview")}
      </Link>

      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {t("admin.pages.workers_description")}
      </p>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : workers.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-12 text-center">
          <Cpu className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {t("admin.tasks.no_workers")}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t("admin.tasks.no_workers_hint")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {workers.map((workerName) => {
            const workerStats = (stats[workerName] ?? {}) as Record<string, unknown>;
            const workerTasks = registered[workerName] ?? [];
            const pool = (workerStats.pool ?? {}) as Record<string, unknown>;
            const total = (workerStats.total ?? {}) as Record<string, unknown>;

            return (
              <div
                key={workerName}
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden"
              >
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-mono font-medium text-gray-900 dark:text-white">
                      {workerName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {pool["max-concurrency"] != null &&
                        `Concurrency: ${pool["max-concurrency"]}`}
                      {total["tasks.task_completed"] != null &&
                        ` · Processed: ${total["tasks.task_completed"]}`}
                    </p>
                  </div>
                </div>
                {workerTasks.length > 0 && (
                  <div className="p-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      {t("admin.tasks.registered_tasks")} ({workerTasks.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {workerTasks.slice(0, 20).map((taskName) => (
                        <span
                          key={taskName}
                          className="font-mono text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                        >
                          {taskName}
                        </span>
                      ))}
                      {workerTasks.length > 20 && (
                        <span className="text-xs text-gray-500">
                          +{workerTasks.length - 20} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
