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
  Input,
  Skeleton,
} from "@fitnudge/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@fitnudge/ui";
import { StatCard } from "@/components/StatCard";
import {
  useSubscriptionsList,
  useSubscriptionsStats,
  useSubscriptionGrant,
} from "@/hooks/api/useSubscriptions";
import { ROUTES } from "@/lib/routes";
import { ChevronLeft, ChevronRight, ExternalLink, Gift } from "lucide-react";

const PLATFORM_OPTIONS = [
  { value: "ios", labelKey: "admin.subscriptions.stats_ios" },
  { value: "android", labelKey: "admin.subscriptions.stats_android" },
  { value: "admin_granted", labelKey: "admin.subscriptions.stats_admin" },
  { value: "promo", labelKey: "admin.subscriptions.stats_promo" },
];

function platformLabel(platform: string | null, t: (k: string) => string): string {
  if (!platform) return "—";
  const key = `admin.subscriptions.source_${platform}` as const;
  const fallback = platform.charAt(0).toUpperCase() + platform.slice(1).replace(/_/g, " ");
  return t(key) || fallback;
}

export function SubscriptionsView() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantDays, setGrantDays] = useState("30");

  const { data: listData, isLoading: loading, isError: listError } = useSubscriptionsList({
    page,
    per_page: perPage,
    status: statusFilter || undefined,
    platform: platformFilter || undefined,
  });

  const { data: stats, isLoading: statsLoading, isError: statsError } = useSubscriptionsStats();
  const grantMutation = useSubscriptionGrant();

  const subscriptions = listData?.subscriptions ?? [];
  const total = listData?.total ?? 0;

  useEffect(() => {
    if (listError) toast.error(t("admin.subscriptions.fetch_error"));
  }, [listError, t]);

  useEffect(() => {
    if (statsError) toast.error(t("admin.subscriptions.stats_error"));
  }, [statsError, t]);

  const handleGrant = async () => {
    const userId = grantUserId.trim();
    if (!userId) {
      toast.error("User ID is required");
      return;
    }
    const days = Math.max(1, Math.min(365, parseInt(grantDays, 10) || 30));
    try {
      await grantMutation.mutateAsync({ user_id: userId, plan_id: "premium", days });
      toast.success(t("admin.subscriptions.grant_success", { days }));
      setGrantOpen(false);
      setGrantUserId("");
      setGrantDays("30");
    } catch {
      toast.error(t("admin.subscriptions.grant_error"));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {t("admin.pages.subscriptions_description")}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-4 mb-6">
        {statsLoading ? (
          <>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </>
        ) : stats ? (
          <>
            <StatCard label={t("admin.subscriptions.stats_total")} value={stats.total_subscriptions} />
            <StatCard label={t("admin.subscriptions.stats_active")} value={stats.active_subscriptions} />
            <StatCard label={t("admin.subscriptions.stats_ios")} value={stats.by_platform?.ios ?? 0} />
            <StatCard label={t("admin.subscriptions.stats_android")} value={stats.by_platform?.android ?? 0} />
            <StatCard label={t("admin.subscriptions.stats_admin")} value={stats.by_platform?.admin_granted ?? 0} />
            <StatCard label={t("admin.subscriptions.stats_promo")} value={stats.by_platform?.promo ?? 0} />
            <StatCard label={t("admin.subscriptions.stats_cancelled")} value={stats.by_status.cancelled} />
            <StatCard label={t("admin.subscriptions.stats_mrr")} value={stats.mrr_estimate} prefix="$" />
          </>
        ) : null}
      </div>

      {/* Filters + Grant */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4 sm:items-center sm:justify-between">
        {statsLoading ? (
          <div className="flex gap-2 flex-wrap items-center">
            <Skeleton className="h-10 w-36 rounded-md" />
            <Skeleton className="h-10 w-36 rounded-md" />
            <Skeleton className="h-10 w-28 rounded-md shrink-0" />
          </div>
        ) : (
        <>
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
              {t("admin.subscriptions.filter_status")}: {t("admin.subscriptions.filter_all")}
            </option>
            <option value="active">{t("admin.subscriptions.stats_active")}</option>
            <option value="cancelled">{t("admin.subscriptions.stats_cancelled")}</option>
            <option value="expired">{t("admin.subscriptions.stats_expired")}</option>
          </select>
          <select
            value={platformFilter}
            onChange={(e) => {
              setPlatformFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
          >
            <option value="">
              {t("admin.subscriptions.filter_platform")}: {t("admin.subscriptions.filter_all")}
            </option>
            {PLATFORM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.labelKey)}
              </option>
            ))}
          </select>
        </div>
        <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
          <DialogTrigger asChild>
            <Button variant="default" size="sm" className="flex items-center gap-2 shrink-0">
              <Gift className="h-4 w-4" />
              {t("admin.subscriptions.grant")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.subscriptions.grant")}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("admin.subscriptions.grant_user_id")}
                </label>
                <Input
                  placeholder={t("admin.subscriptions.grant_user_id_placeholder")}
                  value={grantUserId}
                  onChange={(e) => setGrantUserId(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("admin.subscriptions.grant_days")}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  placeholder={t("admin.subscriptions.grant_days_placeholder")}
                  value={grantDays}
                  onChange={(e) => setGrantDays(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGrantOpen(false)}>
                {t("admin.users.cancel")}
              </Button>
              <Button onClick={handleGrant} disabled={grantMutation.isPending}>
                {grantMutation.isPending ? "Granting..." : t("admin.subscriptions.grant")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto">
        {loading ? (
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.subscriptions.col_user")}</TableHead>
                <TableHead>{t("admin.subscriptions.col_plan")}</TableHead>
                <TableHead>{t("admin.subscriptions.col_platform")}</TableHead>
                <TableHead>{t("admin.subscriptions.col_status")}</TableHead>
                <TableHead>{t("admin.subscriptions.col_expires")}</TableHead>
                <TableHead>{t("admin.subscriptions.col_created")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : subscriptions.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            {t("admin.subscriptions.empty")}
          </div>
        ) : (
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.subscriptions.col_user")}</TableHead>
                <TableHead>{t("admin.subscriptions.col_plan")}</TableHead>
                <TableHead>{t("admin.subscriptions.col_platform")}</TableHead>
                <TableHead>{t("admin.subscriptions.col_status")}</TableHead>
                <TableHead>{t("admin.subscriptions.col_expires")}</TableHead>
                <TableHead>{t("admin.subscriptions.col_created")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <Link
                      href={`${ROUTES.USERS}/${sub.user_id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {sub.user_email ?? sub.user_id}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {(sub.plan || sub.plan_id || "free").charAt(0).toUpperCase() +
                      (sub.plan || sub.plan_id || "free").slice(1)}
                  </TableCell>
                  <TableCell>{platformLabel(sub.platform, t)}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        sub.status === "active"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : sub.status === "cancelled"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                      }`}
                    >
                      {(sub.status || "").charAt(0).toUpperCase() + (sub.status || "").slice(1)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {(sub.expires_date || sub.current_period_end)
                      ? new Date(sub.expires_date || sub.current_period_end!).toLocaleDateString(
                          undefined,
                          { year: "numeric", month: "short", day: "numeric" }
                        )
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {sub.created_at
                      ? new Date(sub.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`${ROUTES.SUBSCRIPTIONS}/${sub.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-primary dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-primary"
                      title={t("admin.subscriptions.view")}
                    >
                      <ExternalLink className="h-4 w-4" />
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
              {t("admin.subscriptions.page_of", { current: page, total: totalPages })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                {t("admin.subscriptions.prev")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t("admin.subscriptions.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
