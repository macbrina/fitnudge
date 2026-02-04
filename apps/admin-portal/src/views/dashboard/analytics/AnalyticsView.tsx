"use client";

import {
  useAnalyticsBroadcastEngagement,
  useAnalyticsClearCache,
  useAnalyticsDashboard,
  useAnalyticsEngagement,
  useAnalyticsMrrTrend,
  useAnalyticsReferrals,
  useAnalyticsSubscriptionByPlatform,
} from "@/hooks/api/useAnalytics";
import { useTranslation } from "@/lib/i18n";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@fitnudge/ui";
import {
  Activity,
  CheckSquare,
  CreditCard,
  DollarSign,
  Loader2,
  RefreshCw,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

export function AnalyticsView() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useAnalyticsDashboard();
  const platformData = useAnalyticsSubscriptionByPlatform();
  const mrrData = useAnalyticsMrrTrend(30);
  const engagementData = useAnalyticsEngagement();
  const referralsData = useAnalyticsReferrals();
  const broadcastEngagement = useAnalyticsBroadcastEngagement();
  const clearCache = useAnalyticsClearCache();

  const handleClearCache = async () => {
    try {
      await clearCache.mutateAsync();
      toast.success(t("admin.analytics.cache_cleared"));
      refetch();
    } catch {
      toast.error(t("admin.analytics.cache_clear_failed"));
    }
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
        <p className="text-red-700 dark:text-red-400">
          {t("admin.analytics.load_error")}: {(error as Error).message}
        </p>
        <Button className="mt-2" variant="secondary" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
          {t("admin.analytics.retry")}
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <p className="text-gray-600 dark:text-gray-400">
          {t("admin.pages.analytics_dashboard_description")}
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="mt-2 h-8 w-16 rounded bg-gray-200 dark:bg-gray-700" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    {
      title: t("admin.analytics.users"),
      value: data.users.total.toLocaleString(),
      subtext: t("admin.analytics.new_this_week", {
        count: data.users.new_this_week,
      }),
      icon: Users,
    },
    {
      title: t("admin.analytics.goals"),
      value: data.goals.total.toLocaleString(),
      subtext: t("admin.analytics.active_goals", { count: data.goals.active }),
      icon: Target,
    },
    {
      title: t("admin.analytics.checkins"),
      value: data.checkins.total.toLocaleString(),
      subtext: t("admin.analytics.this_week", {
        count: data.checkins.this_week,
      }),
      icon: CheckSquare,
    },
    {
      title: t("admin.analytics.subscriptions"),
      value: data.subscriptions.active.toLocaleString(),
      subtext: t("admin.analytics.active_subs"),
      icon: CreditCard,
    },
    {
      title: t("admin.analytics.mrr"),
      value: `$${data.subscriptions.mrr.toFixed(2)}`,
      subtext: t("admin.analytics.monthly_revenue"),
      icon: DollarSign,
    },
  ];

  const platformChartData = platformData.data?.by_platform
    ? Object.entries(platformData.data.by_platform)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-gray-600 dark:text-gray-400">
          {t("admin.pages.analytics_dashboard_description")}
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleClearCache}
          disabled={clearCache.isPending}
        >
          {clearCache.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {t("admin.analytics.clear_cache")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="pt-6">
              <div className="flex items-start">
                <div className="rounded bg-gray-100 p-2 dark:bg-gray-800">
                  <stat.icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div className="ml-3 truncate">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {stat.title}
                  </p>
                  <p className="text-xl font-semibold tabular-nums">
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {stat.subtext}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Engagement (DAU/WAU/MAU) */}
      {engagementData.data && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-gray-500" />
              <CardTitle>{t("admin.analytics.engagement_title")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t("admin.analytics.dau")}
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  {engagementData.data.dau.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t("admin.analytics.wau")}
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  {engagementData.data.wau.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t("admin.analytics.mau")}
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  {engagementData.data.mau.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Subscription by platform */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.analytics.subs_by_platform")}</CardTitle>
          </CardHeader>
          <CardContent>
            {platformChartData.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={platformChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={80}
                      paddingAngle={2}
                      label={({ name, percent }) =>
                        `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                    >
                      {platformChartData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) =>
                        v != null ? Number(v).toLocaleString() : ""
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center text-gray-500">
                {t("admin.analytics.empty")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Referrals summary */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.analytics.referrals_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {referralsData.data ? (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t("admin.analytics.total_referrals")}
                  </p>
                  <p className="font-semibold tabular-nums">
                    {referralsData.data.total_referrals}
                  </p>
                </div>
                <div className="flex justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t("admin.analytics.rewarded")}
                  </p>
                  <p className="font-semibold tabular-nums">
                    {referralsData.data.rewarded}
                  </p>
                </div>
                <div className="flex justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t("admin.analytics.conversion_rate")}
                  </p>
                  <p className="font-semibold tabular-nums">
                    {referralsData.data.conversion_rate}%
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center text-gray-500">
                {referralsData.isLoading
                  ? t("admin.analytics.loading")
                  : t("admin.analytics.empty")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Broadcast engagement */}
      {broadcastEngagement.data?.broadcasts?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.analytics.broadcast_engagement")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="py-2 text-left">
                      {t("admin.analytics.broadcast_title")}
                    </th>
                    <th className="py-2 text-right">
                      {t("admin.analytics.views")}
                    </th>
                    <th className="py-2 text-right">
                      {t("admin.analytics.clicks")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {broadcastEngagement.data.broadcasts.map((b) => (
                    <tr
                      key={b.broadcast_id}
                      className="border-b dark:border-gray-700/50"
                    >
                      <td className="py-2">{b.title || b.broadcast_id}</td>
                      <td className="text-right">{b.views}</td>
                      <td className="text-right">{b.clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* MRR trend */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.analytics.mrr_trend")}</CardTitle>
        </CardHeader>
        <CardContent>
          {mrrData.data?.data?.length ? (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mrrData.data.data}>
                  <defs>
                    <linearGradient
                      id="mrrGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-gray-200 dark:stroke-gray-700"
                  />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    formatter={(v) =>
                      v != null
                        ? [`$${Number(v).toFixed(2)}`, "MRR"]
                        : ["", "MRR"]
                    }
                    labelFormatter={(label) => label}
                  />
                  <Area
                    type="monotone"
                    dataKey="mrr"
                    stroke="#3b82f6"
                    fill="url(#mrrGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-gray-500">
              {mrrData.isLoading
                ? t("admin.analytics.loading")
                : t("admin.analytics.empty")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
