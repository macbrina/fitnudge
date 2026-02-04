"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Skeleton,
} from "@fitnudge/ui";
import { useTasksBeatSchedule } from "@/hooks/api/useTasks";
import { ROUTES } from "@/lib/routes";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export function TasksBeatScheduleView() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useTasksBeatSchedule();

  const entries = data?.entries ?? [];

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-700 dark:text-red-400 font-medium">
          {t("admin.tasks.connection_error")}
        </p>
        <Link href={ROUTES.TASKS}>
          <p className="text-sm text-primary hover:underline mt-2">
            {t("admin.tasks.back_to_overview")}
          </p>
        </Link>
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
        {t("admin.pages.beat_schedule_description")}
      </p>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.tasks.beat_schedule_col_name")}</TableHead>
                <TableHead className="font-mono text-xs">{t("admin.tasks.beat_schedule_col_task")}</TableHead>
                <TableHead>{t("admin.tasks.beat_schedule_col_schedule")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.name}>
                  <TableCell>
                    <span className="font-mono text-sm text-gray-900 dark:text-white">
                      {entry.name}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-gray-600 dark:text-gray-400">
                    {entry.task}
                  </TableCell>
                  <TableCell className="text-gray-600 dark:text-gray-400">
                    {entry.schedule_human}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
