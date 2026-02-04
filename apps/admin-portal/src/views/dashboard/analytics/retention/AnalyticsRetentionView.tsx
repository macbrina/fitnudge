"use client";

import { useTranslation } from "@/lib/i18n";
import { useAnalyticsRetention } from "@/hooks/api/useAnalytics";
import {
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Button,
} from "@fitnudge/ui";
import { Download } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";

export function AnalyticsRetentionView() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useAnalyticsRetention();

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
        <p className="text-red-700 dark:text-red-400">
          {t("admin.analytics.load_error")}: {(error as Error).message}
        </p>
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-2 rounded-md bg-red-100 px-3 py-1.5 text-sm text-red-800 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900"
          onClick={() => refetch()}
        >
          {t("admin.analytics.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-gray-600 dark:text-gray-400">
        {t("admin.pages.retention_description")}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{t("admin.menu.retention")}</h2>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            data?.cohorts &&
            exportToCsv(
              data.cohorts.map((c) => ({
                week: c.week,
                cohort_start: c.cohort_start,
                cohort_size: c.cohort_size,
                retained: c.retained,
                retention_rate: c.retention_rate,
              })),
              "retention-cohorts.csv"
            )
          }
          disabled={!data?.cohorts?.length}
        >
          <Download className="h-4 w-4" />
          {t("admin.analytics.export_csv")}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="h-48 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          ) : data?.cohorts?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.analytics.cohort_week")}</TableHead>
                  <TableHead>{t("admin.analytics.cohort_start")}</TableHead>
                  <TableHead>{t("admin.analytics.cohort_size")}</TableHead>
                  <TableHead>{t("admin.analytics.retained")}</TableHead>
                  <TableHead>{t("admin.analytics.retention_rate")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.cohorts.map((c) => (
                  <TableRow key={c.week}>
                    <TableCell>
                      {c.week} {t("admin.analytics.weeks_ago")}
                    </TableCell>
                    <TableCell>{c.cohort_start}</TableCell>
                    <TableCell>{c.cohort_size.toLocaleString()}</TableCell>
                    <TableCell>{c.retained.toLocaleString()}</TableCell>
                    <TableCell>{c.retention_rate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-48 items-center justify-center text-gray-500 dark:text-gray-400">
              {t("admin.analytics.empty")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
