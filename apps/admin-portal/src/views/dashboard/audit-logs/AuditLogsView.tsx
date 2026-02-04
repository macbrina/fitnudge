"use client";

import React, { useState } from "react";
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
import { useAuditLogsList } from "@/hooks/api/useAuditLogs";
import { exportToCsv } from "@/lib/exportCsv";
import { Skeleton } from "@fitnudge/ui";
import { Download, ChevronLeft, ChevronRight, Expand } from "lucide-react";

export function AuditLogsView() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [resourceType, setResourceType] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data, isLoading, error } = useAuditLogsList({
    page,
    per_page: 20,
    resource_type: resourceType || undefined,
    action: actionFilter || undefined,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const perPage = data?.per_page ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const handleExport = () => {
    if (items.length === 0) return;
    const rows = items.map((i) => ({
      id: i.id,
      created_at: i.created_at,
      admin_email: i.admin_email ?? "",
      action: i.action,
      resource_type: i.resource_type,
      resource_id: i.resource_id ?? "",
      old_values: JSON.stringify(i.old_values ?? {}),
      new_values: JSON.stringify(i.new_values ?? {}),
    }));
    exportToCsv(rows, `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString();
    } catch {
      return s;
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
        {t("admin.pages.audit_logs_description")}
      </p>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap gap-4">
            <Input
              placeholder={t("admin.audit_logs.filter_resource_type")}
              value={resourceType}
              onChange={(e) => {
                setResourceType(e.target.value);
                setPage(1);
              }}
              className="max-w-xs"
            />
            <Input
              placeholder={t("admin.audit_logs.filter_action")}
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="max-w-xs"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={items.length === 0}
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
                    <TableHead>{t("admin.audit_logs.timestamp")}</TableHead>
                    <TableHead>{t("admin.audit_logs.admin")}</TableHead>
                    <TableHead>{t("admin.audit_logs.action")}</TableHead>
                    <TableHead>{t("admin.audit_logs.resource_type")}</TableHead>
                    <TableHead>{t("admin.audit_logs.resource_id")}</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <React.Fragment key={item.id}>
                      <TableRow>
                        <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(item.created_at)}
                        </TableCell>
                        <TableCell>{item.admin_email ?? "—"}</TableCell>
                        <TableCell>{item.action}</TableCell>
                        <TableCell>{item.resource_type}</TableCell>
                        <TableCell className="max-w-32 truncate font-mono text-xs">
                          {item.resource_id ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              setExpandedRow(expandedRow === item.id ? null : item.id)
                            }
                          >
                            <Expand className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedRow === item.id && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-gray-50 dark:bg-gray-900/50">
                            <div className="space-y-2 p-4 text-xs">
                              {item.old_values && Object.keys(item.old_values).length > 0 && (
                                <div>
                                  <span className="font-medium">Old values:</span>
                                  <pre className="mt-1 overflow-auto rounded bg-gray-100 p-2 dark:bg-gray-800">
                                    {JSON.stringify(item.old_values, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {item.new_values && Object.keys(item.new_values).length > 0 && (
                                <div>
                                  <span className="font-medium">New values:</span>
                                  <pre className="mt-1 overflow-auto rounded bg-gray-100 p-2 dark:bg-gray-800">
                                    {JSON.stringify(item.new_values, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {(!item.old_values || Object.keys(item.old_values).length === 0) &&
                                (!item.new_values || Object.keys(item.new_values).length === 0) && (
                                  <p className="text-gray-500">No details</p>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
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
