"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import { Button, Input } from "@fitnudge/ui";
import { Loading } from "@/components/Loading";
import {
  useUserReportDetail,
  useUserReportUpdate,
} from "@/hooks/api/useUserReports";
import { ROUTES } from "@/lib/routes";
import { ArrowLeft, CheckCircle, XCircle, Eye } from "lucide-react";

function reasonLabel(reason: string, t: (k: string) => string): string {
  const key = `admin.reports.reason_${reason}` as const;
  const fallback =
    reason
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) ?? reason;
  return t(key) || fallback;
}

function statusLabel(status: string, t: (k: string) => string): string {
  const key = `admin.reports.status_${status}` as const;
  const fallback = status.charAt(0).toUpperCase() + status.slice(1);
  return t(key) || fallback;
}

export function ReportDetailView({ reportId }: { reportId: string }) {
  const { t } = useTranslation();
  const [adminNotes, setAdminNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);

  const {
    data: report,
    isLoading: loading,
    isError,
  } = useUserReportDetail(reportId);
  const updateMutation = useUserReportUpdate();

  useEffect(() => {
    if (report?.admin_notes != null) {
      setAdminNotes(report.admin_notes);
    }
  }, [report?.admin_notes]);

  useEffect(() => {
    if (isError) toast.error(t("admin.reports.fetch_error"));
  }, [isError, t]);

  const handleStatusChange = async (
    status: "reviewed" | "actioned" | "dismissed"
  ) => {
    if (!report) return;
    try {
      await updateMutation.mutateAsync({
        id: report.id,
        status,
        admin_notes: adminNotes || undefined,
      });
      toast.success(t("admin.reports.update_success"));
      setNotesDirty(false);
    } catch {
      toast.error(t("admin.reports.update_error"));
    }
  };

  const handleSaveNotes = async () => {
    if (!report) return;
    try {
      await updateMutation.mutateAsync({
        id: report.id,
        admin_notes: adminNotes,
      });
      toast.success(t("admin.reports.update_success"));
      setNotesDirty(false);
    } catch {
      toast.error(t("admin.reports.update_error"));
    }
  };

  if (loading || !report) {
    return loading ? (
      <Loading label={t("admin.reports.loading")} />
    ) : (
      <div className="text-gray-500 dark:text-gray-400">
        {t("admin.reports.detail_not_found")}
      </div>
    );
  }

  return (
    <>
      <Link
        href={ROUTES.USER_REPORTS}
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("admin.reports.back_to_reports")}
      </Link>

      <div className="space-y-6">
        {/* Report details */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t("admin.reports.detail_title")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("admin.reports.col_reporter")}
              </label>
              <Link
                href={`${ROUTES.USERS}/${report.reporter_id}`}
                className="text-primary hover:underline"
              >
                {report.reporter_email ?? report.reporter_id}
              </Link>
              {report.reporter_name && (
                <span className="ml-1 text-gray-500 dark:text-gray-400">
                  ({report.reporter_name})
                </span>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("admin.reports.col_reported")}
              </label>
              <Link
                href={`${ROUTES.USERS}/${report.reported_user_id}`}
                className="text-primary hover:underline"
              >
                {report.reported_user_email ?? report.reported_user_id}
              </Link>
              {report.reported_user_name && (
                <span className="ml-1 text-gray-500 dark:text-gray-400">
                  ({report.reported_user_name})
                </span>
              )}
              {report.reported_username && (
                <span className="ml-1 text-gray-500 dark:text-gray-400">
                  @{report.reported_username}
                </span>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("admin.reports.col_reason")}
              </label>
              <p className="text-gray-900 dark:text-white">
                {reasonLabel(report.reason, t)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("admin.reports.col_status")}
              </label>
              <p className="text-gray-900 dark:text-white">
                {statusLabel(report.status, t)}
              </p>
            </div>
            {report.details && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("admin.reports.col_details")}
                </label>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                  {report.details}
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("admin.reports.col_created")}
              </label>
              <p className="text-gray-900 dark:text-white">
                {report.created_at
                  ? new Date(report.created_at).toLocaleString()
                  : "—"}
              </p>
            </div>
            {report.reviewed_at && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("admin.reports.col_reviewed")}
                </label>
                <p className="text-gray-900 dark:text-white">
                  {new Date(report.reviewed_at).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Admin notes */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("admin.reports.col_admin_notes")}
            </label>
            <div className="flex gap-2">
              <Input
                value={adminNotes}
                onChange={(e) => {
                  setAdminNotes(e.target.value);
                  setNotesDirty(true);
                }}
                placeholder={t("admin.reports.admin_notes_placeholder")}
                className="flex-1"
              />
              {notesDirty && (
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending
                    ? t("admin.users.saving")
                    : t("admin.users.save")}
                </Button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("admin.reports.actions_title")}
            </p>
            <div className="flex flex-wrap gap-2">
              {report.status === "pending" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange("reviewed")}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    {t("admin.reports.action_reviewed")}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleStatusChange("actioned")}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {t("admin.reports.action_actioned")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange("dismissed")}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    {t("admin.reports.action_dismissed")}
                  </Button>
                </>
              )}
              {report.status === "reviewed" && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleStatusChange("actioned")}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {t("admin.reports.action_actioned")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange("dismissed")}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    {t("admin.reports.action_dismissed")}
                  </Button>
                </>
              )}
              {(report.status === "actioned" || report.status === "dismissed") && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("admin.reports.already_resolved")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
