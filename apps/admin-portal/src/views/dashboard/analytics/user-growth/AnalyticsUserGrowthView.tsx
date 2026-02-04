"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { useAnalyticsUserGrowth } from "@/hooks/api/useAnalytics";
import { Card, CardContent, CardTitle, Button } from "@fitnudge/ui";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Download } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";

const DAYS_OPTIONS = [7, 30, 90] as const;

export function AnalyticsUserGrowthView() {
  const { t } = useTranslation();
  const [days, setDays] = useState<number>(30);
  const { data, isLoading, error, refetch } = useAnalyticsUserGrowth(days);

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
        {t("admin.pages.user_growth_description")}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <CardTitle>{t("admin.menu.user_growth")}</CardTitle>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              data?.data &&
              exportToCsv(data.data, `user-growth-${days}d.csv`, [
                "date",
                "new_users",
                "cumulative",
              ])
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
                <AreaChart data={data.data}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-gray-200 dark:stroke-gray-700"
                  />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => v.toLocaleString()} />
                  <Tooltip formatter={(v) => (v != null ? Number(v).toLocaleString() : "")} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="new_users"
                    name={t("admin.analytics.new_users")}
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    name={t("admin.analytics.cumulative")}
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                </AreaChart>
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
