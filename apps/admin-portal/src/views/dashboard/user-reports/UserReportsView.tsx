"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
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
import { StatCard } from "@/components/StatCard";
import {
  useUserReportsList,
  useUserReportsStats,
} from "@/hooks/api/useUserReports";
import { ROUTES } from "@/lib/routes";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { ReportSummary } from "@/lib/api";

const STATUS_OPTIONS = [
  { value: "pending", labelKey: "admin.reports.status_pending" },
  { value: "reviewed", labelKey: "admin.reports.status_reviewed" },
  { value: "actioned", labelKey: "admin.reports.status_actioned" },
  { value: "dismissed", labelKey: "admin.reports.status_dismissed" },
];

const REASON_OPTIONS = [
  {
    value: "inappropriate_username",
    labelKey: "admin.reports.reason_inappropriate_username",
  },
  { value: "harassment", labelKey: "admin.reports.reason_harassment" },
  { value: "spam", labelKey: "admin.reports.reason_spam" },
  { value: "other", labelKey: "admin.reports.reason_other" },
];

function reasonLabel(reason: string, t: (k: string) => string): string {
  const key = `admin.reports.reason_${reason}` as const;
  const fallback =
    reason.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ??
    reason;
  return t(key) || fallback;
}

function statusLabel(status: string, t: (k: string) => string): string {
  const key = `admin.reports.status_${status}` as const;
  const fallback = status.charAt(0).toUpperCase() + status.slice(1);
  return t(key) || fallback;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    case "reviewed":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "actioned":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "dismissed":
      return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";
  }
}

export function UserReportsView() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [reasonFilter, setReasonFilter] = useState<string>("");

  const {
    data: listData,
    isLoading: loading,
    isError: listError,
  } = useUserReportsList({
    page,
    per_page: perPage,
    status: statusFilter || undefined,
    reason: reasonFilter || undefined,
  });

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useUserReportsStats();

  const reports = listData?.reports ?? [];
  const total = listData?.total ?? 0;

  useEffect(() => {
    if (listError) toast.error(t("admin.reports.fetch_error"));
  }, [listError, t]);

  useEffect(() => {
    if (statsError) toast.error(t("admin.reports.stats_error"));
  }, [statsError, t]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {t("admin.pages.user_reports_description")}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {statsLoading ? (
          <>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </>
        ) : stats ? (
          <>
            <StatCard
              label={t("admin.reports.stats_total")}
              value={stats.total}
            />
            <StatCard
              label={t("admin.reports.stats_pending")}
              value={stats.pending}
            />
            <StatCard
              label={t("admin.reports.stats_reviewed")}
              value={stats.reviewed}
            />
            <StatCard
              label={t("admin.reports.stats_actioned")}
              value={stats.actioned}
            />
            <StatCard
              label={t("admin.reports.stats_dismissed")}
              value={stats.dismissed}
            />
            <StatCard
              label={t("admin.reports.stats_username")}
              value={stats.by_reason?.inappropriate_username ?? 0}
            />
          </>
        ) : null}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4 sm:items-center">
        {statsLoading ? (
          <div className="flex gap-2 flex-wrap">
            <Skeleton className="h-10 w-36 rounded-md" />
            <Skeleton className="h-10 w-36 rounded-md" />
          </div>
        ) : (
        <div className="flex gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
          >
            <option value="">
              {t("admin.reports.filter_status")}:{" "}
              {t("admin.subscriptions.filter_all")}
            </option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.labelKey)}
              </option>
            ))}
          </select>
          <select
            value={reasonFilter}
            onChange={(e) => {
              setReasonFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
          >
            <option value="">
              {t("admin.reports.filter_reason")}:{" "}
              {t("admin.subscriptions.filter_all")}
            </option>
            {REASON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.labelKey)}
              </option>
            ))}
          </select>
        </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto">
        {loading ? (
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.reports.col_reporter")}</TableHead>
                <TableHead>{t("admin.reports.col_reported")}</TableHead>
                <TableHead>{t("admin.reports.col_reason")}</TableHead>
                <TableHead>{t("admin.reports.col_status")}</TableHead>
                <TableHead>{t("admin.reports.col_created")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            {t("admin.reports.empty")}
          </div>
        ) : (
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.reports.col_reporter")}</TableHead>
                <TableHead>{t("admin.reports.col_reported")}</TableHead>
                <TableHead>{t("admin.reports.col_reason")}</TableHead>
                <TableHead>{t("admin.reports.col_status")}</TableHead>
                <TableHead>{t("admin.reports.col_created")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r: ReportSummary) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`${ROUTES.USERS}/${r.reporter_id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {r.reporter_email ?? r.reporter_id}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`${ROUTES.USERS}/${r.reported_user_id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {r.reported_user_email ?? r.reported_user_id}
                    </Link>
                    {r.reported_username && (
                      <span className="ml-1 text-gray-500 dark:text-gray-400 text-sm">
                        (@{r.reported_username})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{reasonLabel(r.reason, t)}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
                        r.status
                      )}`}
                    >
                      {statusLabel(r.status, t)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {r.created_at
                      ? new Date(r.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`${ROUTES.USER_REPORTS}/${r.id}`}
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      {t("admin.reports.view")}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("admin.reports.page_of", { current: page, total: totalPages })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                {t("admin.reports.prev")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t("admin.reports.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
