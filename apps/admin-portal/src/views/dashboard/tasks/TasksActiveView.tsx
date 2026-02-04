"use client";

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
import { useTasksActive, useTaskRevoke } from "@/hooks/api/useTasks";
import { ROUTES } from "@/lib/routes";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { ArrowLeft, ExternalLink, Ban } from "lucide-react";

export function TasksActiveView() {
  const { t } = useTranslation();
  const { showConfirm } = useAlertModal();
  const { data, isLoading, isError } = useTasksActive();
  const revokeMutation = useTaskRevoke();

  const handleRevoke = async (taskId: string) => {
    try {
      await showConfirm({
        title: t("admin.tasks.revoke_title"),
        message: t("admin.tasks.revoke_message"),
        variant: "warning",
        confirmLabel: t("admin.tasks.revoke"),
        cancelLabel: t("admin.users.cancel"),
        onConfirm: async () => {
          await revokeMutation.mutateAsync({ id: taskId, terminate: true });
          toast.success(t("admin.tasks.revoke_success"));
        },
      });
    } catch {
      toast.error(t("admin.tasks.revoke_error"));
    }
  };

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-8 text-center">
        <p className="text-red-700 dark:text-red-400 font-medium">
          {t("admin.tasks.connection_error")}
        </p>
      </div>
    );
  }

  const tasks = data?.tasks ?? [];

  return (
    <>
      <Link
        href={ROUTES.TASKS}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-primary mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("admin.tasks.back_to_overview")}
      </Link>

      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {t("admin.pages.active_description")}
      </p>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <p className="font-medium">{t("admin.tasks.no_active")}</p>
            <p className="text-sm mt-1">{t("admin.tasks.no_active_hint")}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.tasks.col_task")}</TableHead>
                <TableHead>{t("admin.tasks.col_worker")}</TableHead>
                <TableHead>{t("admin.tasks.col_id")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <span className="font-mono text-sm">
                      {task.name ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {task.worker}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={ROUTES.apiTaskDetail(task.id)}
                      className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {task.id.slice(0, 8)}...
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevoke(task.id)}
                      disabled={revokeMutation.isPending}
                      className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                    >
                      <Ban className="h-3 w-3 mr-1" />
                      {t("admin.tasks.revoke")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
