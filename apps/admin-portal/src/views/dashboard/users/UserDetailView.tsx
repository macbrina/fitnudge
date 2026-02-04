"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import { Button, Input } from "@fitnudge/ui";
import { Loading } from "@/components/Loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@fitnudge/ui";
import { useUserDetail, useUserGoals, useUserActivity, useUserUpdate } from "@/hooks/api/useUsers";
import { useDataExportRequest } from "@/hooks/api/useDataExport";
import { ROUTES } from "@/lib/routes";
import { ArrowLeft, Download } from "lucide-react";

export function UserDetailView({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [editMode, setEditMode] = useState(false);
  const [editStatus, setEditStatus] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [error, setError] = useState("");

  const { data: user, isLoading: loading, isError } = useUserDetail(userId);
  const { data: goalsData } = useUserGoals(userId);
  const { data: activityData } = useUserActivity(userId);
  const updateMutation = useUserUpdate();
  const requestExportMutation = useDataExportRequest();

  const goals = goalsData?.goals ?? [];
  const activity = activityData?.activity ?? [];

  useEffect(() => {
    if (user) {
      setEditStatus(user.status);
      setEditRole(user.role);
      setEditDisplayName(user.display_name ?? "");
    }
  }, [user]);

  useEffect(() => {
    if (isError) toast.error(t("admin.users.user_fetch_error"));
  }, [isError, t]);

  const handleSave = async () => {
    if (!user) return;
    setError("");
    try {
      await updateMutation.mutateAsync({
        id: user.id,
        data: {
          status: editStatus as "active" | "disabled" | "suspended",
          role: editRole as "user" | "admin",
          display_name: editDisplayName || undefined,
        },
      });
      toast.success(t("admin.users.update_success"));
      setEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      toast.error(t("admin.users.update_error"));
    }
  };

  if (loading || !user) {
    return loading ? (
      <Loading label={t("admin.users.loading")} />
    ) : (
      <div className="text-gray-500 dark:text-gray-400">{t("admin.users.user_not_found")}</div>
    );
  }

  return (
    <>
      <Link
        href={ROUTES.USERS}
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("admin.users.back_to_users")}
      </Link>

      <div className="space-y-6">
        {/* Profile card */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t("admin.users.profile")}
          </h3>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("admin.users.email_label")}
              </label>
              <p className="text-gray-900 dark:text-white">{user.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("admin.users.col_name")}
              </label>
              {editMode ? (
                <Input
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                />
              ) : (
                <p className="text-gray-900 dark:text-white">
                  {user.display_name || "—"}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("admin.users.col_status")}
              </label>
              {editMode ? (
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white w-full"
                >
                  <option value="active">{t("admin.users.status_active")}</option>
                  <option value="disabled">{t("admin.users.status_disabled")}</option>
                  <option value="suspended">{t("admin.users.status_suspended")}</option>
                </select>
              ) : (
                <p className="text-gray-900 dark:text-white">
                  {user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : "—"}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("admin.users.col_role")}
              </label>
              {editMode ? (
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white w-full"
                >
                  <option value="user">{t("admin.users.role_user")}</option>
                  <option value="admin">{t("admin.users.role_admin")}</option>
                </select>
              ) : (
                <p className="text-gray-900 dark:text-white">
                  {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "—"}
                </p>
              )}
            </div>
            {!editMode && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("admin.users.col_plan")}
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {(() => {
                      const p = user.subscription_plan || "free";
                      const label = p.charAt(0).toUpperCase() + p.slice(1);
                      const src = user.subscription_source;
                      const srcLabel = src
                        ? ` (${t(`admin.users.source_${src}`)})`
                        : "";
                      return `${label}${srcLabel}`;
                    })()}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("admin.users.onboarding")}
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {user.onboarding_completed ? t("admin.users.completed") : t("admin.users.incomplete")}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("admin.users.goals_checkins")}
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {user.total_goals ?? 0} goals, {user.total_checkins ?? 0} check-ins
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("admin.users.last_active")}
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {user.last_active_at
                      ? new Date(user.last_active_at).toLocaleString()
                      : "—"}
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="mt-4">
            {editMode ? (
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? t("admin.users.saving") : t("admin.users.save")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditMode(false);
                    setEditStatus(user.status);
                    setEditRole(user.role);
                    setEditDisplayName(user.display_name ?? "");
                  }}
                >
                  {t("admin.users.cancel")}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button onClick={() => setEditMode(true)}>{t("admin.users.edit_user")}</Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await requestExportMutation.mutateAsync(user.email);
                      toast.success(t("admin.data_export.request_initiated"));
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                  disabled={requestExportMutation.isPending}
                >
                  <Download className="h-4 w-4" />
                  {t("admin.data_export.request")}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Goals */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t("admin.users.goals_title")} ({goals.length})
          </h3>
          {goals.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {t("admin.users.no_goals")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.users.col_title")}</TableHead>
                  <TableHead>{t("admin.users.col_frequency")}</TableHead>
                  <TableHead>{t("admin.users.col_status")}</TableHead>
                  <TableHead>{t("admin.users.col_streak")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(goals as Array<{ title?: string; frequency_type?: string; status?: string; current_streak?: number }>).map((g, i) => (
                  <TableRow key={i}>
                    <TableCell>{g.title ?? "—"}</TableCell>
                    <TableCell>
                      {g.frequency_type ? g.frequency_type.charAt(0).toUpperCase() + g.frequency_type.slice(1) : "—"}
                    </TableCell>
                    <TableCell>
                      {g.status ? g.status.charAt(0).toUpperCase() + g.status.slice(1) : "—"}
                    </TableCell>
                    <TableCell>{g.current_streak ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Activity */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t("admin.users.activity_title")} ({activity.length})
          </h3>
          {activity.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {t("admin.users.no_checkins")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.users.col_date")}</TableHead>
                  <TableHead>{t("admin.users.col_completed")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(activity as Array<{ check_in_date?: string; completed?: boolean }>).map((a, i) => (
                  <TableRow key={i}>
                    <TableCell>{a.check_in_date ?? "—"}</TableCell>
                    <TableCell>{a.completed ? t("admin.users.yes") : t("admin.users.no")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </>
  );
}
