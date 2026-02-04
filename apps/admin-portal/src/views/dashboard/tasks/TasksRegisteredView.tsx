"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { Input, Skeleton } from "@fitnudge/ui";
import { useTasksRegistered } from "@/hooks/api/useTasks";
import { ROUTES } from "@/lib/routes";
import { ArrowLeft, List } from "lucide-react";

export function TasksRegisteredView() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const { data, isLoading, isError } = useTasksRegistered();

  const tasks = data?.tasks ?? [];
  const filtered = search.trim()
    ? tasks.filter((name) =>
        name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : tasks;

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-8 text-center">
        <p className="text-red-700 dark:text-red-400 font-medium">
          {t("admin.tasks.connection_error")}
        </p>
      </div>
    );
  }

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
        {t("admin.pages.registered_description")}
      </p>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <>
          <div className="mb-4">
            <Input
              placeholder={t("admin.tasks.search_tasks")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
              <List className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {filtered.length} {t("admin.tasks.tasks")}
              </span>
            </div>
            <div className="p-4 max-h-[500px] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  {search
                    ? t("admin.tasks.no_matching_tasks")
                    : t("admin.tasks.no_registered")}
                </p>
              ) : (
                <div className="grid gap-1">
                  {filtered.map((taskName) => (
                    <div
                      key={taskName}
                      className="font-mono text-sm py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300"
                    >
                      {taskName}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
