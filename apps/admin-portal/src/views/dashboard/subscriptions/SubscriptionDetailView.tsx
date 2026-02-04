"use client";

import { useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@fitnudge/ui";
import { Loading } from "@/components/Loading";
import {
  useSubscriptionDetail,
  useSubscriptionCancel,
} from "@/hooks/api/useSubscriptions";
import { ROUTES } from "@/lib/routes";
import { ArrowLeft, AlertTriangle } from "lucide-react";

function platformLabel(
  platform: string | null,
  t: (k: string) => string
): string {
  if (!platform) return "—";
  const key = `admin.subscriptions.source_${platform}` as const;
  const fallback =
    platform.charAt(0).toUpperCase() + platform.slice(1).replace(/_/g, " ");
  return t(key) || fallback;
}

const CANCELABLE_PLATFORMS = ["promo", "admin_granted"];

export function SubscriptionDetailView({
  subscriptionId,
}: {
  subscriptionId: string;
}) {
  const { t } = useTranslation();
  const {
    data: subscription,
    isLoading: loading,
    isError,
  } = useSubscriptionDetail(subscriptionId);
  const cancelMutation = useSubscriptionCancel();

  useEffect(() => {
    if (isError) toast.error(t("admin.subscriptions.fetch_error"));
  }, [isError, t]);

  const canCancel =
    subscription &&
    subscription.status === "active" &&
    subscription.platform &&
    CANCELABLE_PLATFORMS.includes(subscription.platform);

  const handleCancel = async (immediate: boolean) => {
    if (!subscription) return;
    try {
      await cancelMutation.mutateAsync({ id: subscription.id, immediate });
      toast.success(t("admin.subscriptions.cancel_success"));
    } catch {
      toast.error(t("admin.subscriptions.cancel_error"));
    }
  };

  if (loading || !subscription) {
    return loading ? (
      <Loading label={t("admin.subscriptions.loading")} />
    ) : (
      <div className="text-gray-500 dark:text-gray-400">
        {t("admin.subscriptions.detail_not_found")}
      </div>
    );
  }

  const user = subscription.users;

  return (
    <>
      <Link
        href={ROUTES.SUBSCRIPTIONS}
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("admin.subscriptions.back_to_subscriptions")}
      </Link>

      <div className="space-y-6">
        {/* Subscription details */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t("admin.subscriptions.detail_title")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("admin.subscriptions.col_user")}
              </label>
              <Link
                href={`${ROUTES.USERS}/${subscription.user_id}`}
                className="text-primary hover:underline"
              >
                {user?.email ?? subscription.user_id}
              </Link>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("admin.subscriptions.col_plan")}
              </label>
              <p className="text-gray-900 dark:text-white">
                {(subscription.plan || "free").charAt(0).toUpperCase() +
                  (subscription.plan || "free").slice(1)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("admin.subscriptions.col_platform")}
              </label>
              <p className="text-gray-900 dark:text-white">
                {platformLabel(subscription.platform, t)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("admin.subscriptions.col_status")}
              </label>
              <p className="text-gray-900 dark:text-white">
                {(subscription.status || "").charAt(0).toUpperCase() +
                  (subscription.status || "").slice(1)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("admin.subscriptions.col_expires")}
              </label>
              <p className="text-gray-900 dark:text-white">
                {subscription.expires_date || subscription.current_period_end
                  ? new Date(
                      subscription.expires_date ||
                        subscription.current_period_end!
                    ).toLocaleString()
                  : "—"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("admin.subscriptions.auto_renew")}
              </label>
              <p className="text-gray-900 dark:text-white">
                {subscription.auto_renew ? "Yes" : "No"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("admin.subscriptions.cancel_at_period_end_label")}
              </label>
              <p className="text-gray-900 dark:text-white">
                {subscription.cancel_at_period_end ? "Yes" : "No"}
              </p>
            </div>
          </div>

          {/* Cancel actions - only for promo/admin_granted */}
          {canCancel ? (
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
              <div className="flex gap-2">
                {!subscription.cancel_at_period_end && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCancel(false)}
                    disabled={cancelMutation.isPending}
                  >
                    {t("admin.subscriptions.cancel_at_end")}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleCancel(true)}
                  disabled={cancelMutation.isPending}
                >
                  {t("admin.subscriptions.cancel_immediate")}
                </Button>
              </div>
            </div>
          ) : subscription.status === "active" && subscription.platform ? (
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{t("admin.subscriptions.cancel_disabled_hint")}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
