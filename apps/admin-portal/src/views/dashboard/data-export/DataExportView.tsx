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
import {
  useDataExportList,
  useDataExportRequest,
  useDataExportRetry,
} from "@/hooks/api/useDataExport";
import { Skeleton } from "@fitnudge/ui";
import { ChevronLeft, ChevronRight, Copy, Download, RotateCcw } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { toast } from "sonner";

const STATUS_OPTIONS = ["pending", "processing", "completed", "failed"];

export function DataExportView() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [requestEmail, setRequestEmail] = useState("");

  const { data, isLoading, error } = useDataExportList({
    page,
    per_page: 20,
    status: status || undefined,
  });
  const requestMutation = useDataExportRequest();
  const retryMutation = useDataExportRetry();

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("admin.data_export.copied"));
  };

  const handleRequest = async () => {
    const email = requestEmail.trim().toLowerCase();
    if (!email) {
      toast.error(t("admin.data_export.email_required"));
      return;
    }
    try {
      await requestMutation.mutateAsync(email);
      toast.success(t("admin.data_export.request_initiated"));
      setRequestEmail("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await retryMutation.mutateAsync(id);
      toast.success(t("admin.data_export.retry_initiated"));
    } catch (e) {
      toast.error((e as Error).message);
    }
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
        {t("admin.pages.data_export_description")}
      </p>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            >
              <option value="">{t("admin.data_export.filter_status")}</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {formatStatus(s)}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <Input
                type="email"
                value={requestEmail}
                onChange={(e) => setRequestEmail(e.target.value)}
                placeholder={t("admin.data_export.email_placeholder")}
                className="w-64"
              />
              <Button
                variant="outline"
                onClick={handleRequest}
                disabled={requestMutation.isPending || !requestEmail.trim()}
              >
                <Download className="h-4 w-4" />
                {t("admin.data_export.request_for_user")}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full rounded" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.data_export.user")}</TableHead>
                    <TableHead>{t("admin.data_export.status")}</TableHead>
                    <TableHead>{t("admin.audit_logs.timestamp")}</TableHead>
                    <TableHead>{t("admin.data_export.completed_at")}</TableHead>
                    <TableHead>{t("admin.data_export.download_url")}</TableHead>
                    <TableHead className="w-24" />
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
                          {item.email}
                        </Link>
                      </TableCell>
                      <TableCell>{formatStatus(item.status)}</TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(item.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                        {item.completed_at
                          ? formatDate(item.completed_at)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {item.download_url ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => copyToClipboard(item.download_url!)}
                            title={item.download_url}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {(item.status === "failed" ||
                          item.status === "pending") && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleRetry(item.id)}
                            disabled={retryMutation.isPending}
                            title={t("admin.data_export.retry")}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
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
