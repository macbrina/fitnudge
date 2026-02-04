"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Input,
} from "@fitnudge/ui";
import { useDeactivationLogsList } from "@/hooks/api/useDeactivationLogs";
import { exportToCsv } from "@/lib/exportCsv";
import { Skeleton } from "@fitnudge/ui";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { ROUTES } from "@/lib/routes";

const REASON_OPTIONS = [
  "subscription_expired",
  "subscription_expired_cleanup",
  "billing_issue",
  "manual",
  "transfer",
];

export function DeactivationLogsView() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data, isLoading, error } = useDeactivationLogsList({
    page,
    per_page: 20,
    user_id: userId.trim() || undefined,
    reason: reason || undefined,
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const perPage = data?.per_page ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const handleExportClick = () => {
    if (items.length === 0 && total === 0) return;
    fetch(
      `/api/subscription-deactivation-logs?export_csv=true&per_page=5000${userId ? `&user_id=${encodeURIComponent(userId)}` : ""}${reason ? `&reason=${encodeURIComponent(reason)}` : ""}${fromDate ? `&from_date=${fromDate}` : ""}${toDate ? `&to_date=${toDate}` : ""}`,
      { credentials: "include" }
    )
      .then((r) => r.json())
      .then((d) => {
        const rows = (d?.items ?? []).map((i: { id: string; user_id: string; user_email: string | null; previous_plan: string; new_plan: string; goals_deactivated: number; deactivation_reason: string; created_at: string }) => ({
          id: i.id,
          user_id: i.user_id,
          user_email: i.user_email ?? "",
          previous_plan: i.previous_plan,
          new_plan: i.new_plan,
          goals_deactivated: i.goals_deactivated,
          deactivation_reason: i.deactivation_reason,
          created_at: i.created_at,
        }));
        exportToCsv(rows, `deactivation-logs-${new Date().toISOString().slice(0, 10)}.csv`);
      })
      .catch(() => {});
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString();
    } catch {
      return s;
    }
  };

  const formatReason = (r: string) => {
    return r.replace(/_/g, " ");
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
        <p className="text-red-700 dark:text-red-400">
          {t("admin.analytics.load_error")}: {(error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-gray-600 dark:text-gray-400">
        {t("admin.pages.deactivation_logs_description")}
      </p>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap gap-4">
            <Input
              placeholder={t("admin.deactivation_logs.filter_user_id")}
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setPage(1);
              }}
              className="max-w-xs"
            />
            <select
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            >
              <option value="">{t("admin.deactivation_logs.filter_reason")}</option>
              {REASON_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {formatReason(r)}
                </option>
              ))}
            </select>
            <Input
              type="date"
              placeholder="From"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="max-w-[140px]"
            />
            <Input
              type="date"
              placeholder="To"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="max-w-[140px]"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportClick}
              disabled={total === 0}
            >
              <Download className="h-4 w-4" />
              {t("admin.analytics.export_csv")}
            </Button>
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full rounded" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.deactivation_logs.user")}</TableHead>
                    <TableHead>{t("admin.deactivation_logs.previous_plan")}</TableHead>
                    <TableHead>{t("admin.deactivation_logs.new_plan")}</TableHead>
                    <TableHead>{t("admin.deactivation_logs.goals_deactivated")}</TableHead>
                    <TableHead>{t("admin.deactivation_logs.reason")}</TableHead>
                    <TableHead>{t("admin.audit_logs.timestamp")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link
                          href={`${ROUTES.USERS}/${item.user_id}`}
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {item.user_email ?? item.user_id}
                        </Link>
                      </TableCell>
                      <TableCell>{item.previous_plan}</TableCell>
                      <TableCell>{item.new_plan}</TableCell>
                      <TableCell>{item.goals_deactivated}</TableCell>
                      <TableCell>{formatReason(item.deactivation_reason)}</TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(item.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {items.length === 0 && !isLoading && (
                <div className="py-12 text-center text-gray-500">
                  {t("admin.analytics.empty")}
                </div>
              )}

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    {t("admin.audit_logs.page_of", {
                      page,
                      total: totalPages,
                      count: total,
                    })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
