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
} from "@fitnudge/ui";
import { useReferralsList } from "@/hooks/api/useReferrals";
import { Skeleton } from "@fitnudge/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ROUTES } from "@/lib/routes";

const STATUS_OPTIONS = [
  "pending",
  "subscribed",
  "processing",
  "rewarded",
  "failed",
];

export function ReferralsView() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");

  const { data, isLoading, error } = useReferralsList({
    page,
    per_page: 20,
    status: status || undefined,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const perPage = data?.per_page ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString();
    } catch {
      return s;
    }
  };

  const formatStatus = (s: string) => {
    return s.charAt(0).toUpperCase() + s.slice(1);
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
        {t("admin.pages.referrals_description")}
      </p>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap gap-4">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            >
              <option value="">{t("admin.referrals.filter_status")}</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {formatStatus(s)}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full rounded" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.referrals.referrer")}</TableHead>
                    <TableHead>{t("admin.referrals.referred")}</TableHead>
                    <TableHead>{t("admin.referrals.status")}</TableHead>
                    <TableHead>{t("admin.referrals.bonus_days")}</TableHead>
                    <TableHead>{t("admin.referrals.rewarded_at")}</TableHead>
                    <TableHead>{t("admin.audit_logs.timestamp")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link
                          href={`${ROUTES.USERS}/${item.referrer_user_id}`}
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {item.referrer_email ?? item.referrer_user_id}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`${ROUTES.USERS}/${item.referred_user_id}`}
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {item.referred_email ?? item.referred_user_id}
                        </Link>
                      </TableCell>
                      <TableCell>{formatStatus(item.status)}</TableCell>
                      <TableCell>
                        {item.bonus_days_referrer} / {item.bonus_days_referred}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                        {item.rewarded_at
                          ? formatDate(item.rewarded_at)
                          : "—"}
                      </TableCell>
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
