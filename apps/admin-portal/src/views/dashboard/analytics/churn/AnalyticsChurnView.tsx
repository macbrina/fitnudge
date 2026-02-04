"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { useAnalyticsChurn } from "@/hooks/api/useAnalytics";
import { Card, CardContent, Button } from "@fitnudge/ui";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Download } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";

const DAYS_OPTIONS = [7, 30, 90] as const;

export function AnalyticsChurnView() {
  const { t } = useTranslation();
  const [days, setDays] = useState<number>(30);
  const { data, isLoading, error, refetch } = useAnalyticsChurn(days);

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
        {t("admin.analytics.churn_title")}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{t("admin.analytics.churn_title")}</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              data?.data &&
              exportToCsv(data.data, `churn-${days}d.csv`, ["date", "cancellations"])
            }
            disabled={!data?.data?.length}
          >
            <Download className="h-4 w-4" />
            {t("admin.analytics.export_csv")}
          </Button>
          <select
            value={String(days)}
            onChange={(e) => setDays(Number(e.target.value) as 7 | 30 | 90)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
          >
            {DAYS_OPTIONS.map((d) => (
              <option key={d} value={String(d)}>
                {d === 7
                  ? t("admin.analytics.time_range_7d")
                  : d === 30
                    ? t("admin.analytics.time_range_30d")
                    : t("admin.analytics.time_range_90d")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="h-72 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          ) : data?.data?.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.data}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-gray-200 dark:stroke-gray-700"
                  />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => v.toLocaleString()} />
                  <Tooltip formatter={(v) => (v != null ? Number(v).toLocaleString() : "")} />
                  <Bar
                    dataKey="cancellations"
                    fill="#ef4444"
                    name={t("admin.analytics.cancellations")}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
              {t("admin.analytics.empty")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
