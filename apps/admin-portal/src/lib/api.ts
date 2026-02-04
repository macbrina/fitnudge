/**
 * API client for admin portal.
 * Uses Next.js API routes as proxy to admin API (avoids CORS, handles auth cookie).
 */

import { ROUTES } from "./routes";

const getBaseUrl = () => {
  if (typeof window !== "undefined") return ""; // Browser: same origin
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
};

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: string; status: number }> {
  const base = getBaseUrl();
  const url = `${base}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include",
  });

  let data: T | undefined;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      // Non-JSON response
    }
  }

  if (!res.ok) {
    const error =
      (data as { detail?: string; message?: string })?.detail ||
      (data as { detail?: string; message?: string })?.message ||
      res.statusText;
    return { error: typeof error === "string" ? error : "Request failed", status: res.status };
  }

  // 204 No Content has no body
  if (res.status === 204) {
    return { data: {} as T, status: res.status };
  }

  return { data: data as T, status: res.status };
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ access_token: string; user: { id: string; email: string; display_name?: string; role: string } }>(
      ROUTES.API_AUTH_LOGIN,
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    ),
  me: () =>
    api<{ id: string; email: string; display_name?: string; role: string }>(ROUTES.API_AUTH_ME),
  logout: () => api<{ message: string }>(ROUTES.API_AUTH_LOGOUT, { method: "POST" }),
  forgotPassword: (email: string) =>
    api<{ message: string }>(ROUTES.API_AUTH_FORGOT_PASSWORD, {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    }),
  validateResetToken: (token: string) =>
    api<{ valid: boolean }>(ROUTES.API_AUTH_RESET_PASSWORD_VALIDATE, {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  resetPassword: (token: string, newPassword: string) =>
    api<{ message: string }>(ROUTES.API_AUTH_RESET_PASSWORD, {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
    }),
};

export type UserSummary = {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  status: string;
  subscription_plan: string | null;
  subscription_source?: string | null; // paid, admin, promo
  created_at: string;
  last_active_at: string | null;
};

export type UserDetail = UserSummary & {
  timezone: string | null;
  updated_at: string | null;
  onboarding_completed: boolean;
  total_goals: number | null;
  total_checkins: number | null;
};

export type UsersListResponse = {
  users: UserSummary[];
  total: number;
  page: number;
  per_page: number;
};

export type UserStats = {
  total: number;
  by_status: { active: number; disabled: number; suspended: number };
  by_role: { admin: number; user: number };
  by_subscription: { premium: number; free: number };
};

export type UserUpdatePayload = {
  status?: "active" | "disabled" | "suspended";
  role?: "user" | "admin";
  display_name?: string;
};

export const usersApi = {
  list: (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    status?: string;
    role?: string;
    sort_by?: string;
    sort_order?: "asc" | "desc";
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page != null) searchParams.set("page", String(params.page));
    if (params?.per_page != null) searchParams.set("per_page", String(params.per_page));
    if (params?.search) searchParams.set("search", params.search);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.role) searchParams.set("role", params.role);
    if (params?.sort_by) searchParams.set("sort_by", params.sort_by);
    if (params?.sort_order) searchParams.set("sort_order", params.sort_order);
    const q = searchParams.toString();
    return api<UsersListResponse>(`${ROUTES.API_USERS}${q ? `?${q}` : ""}`);
  },
  stats: () => api<UserStats>(ROUTES.API_USERS_STATS),
  get: (id: string) => api<UserDetail>(ROUTES.apiUser(id)),
  update: (id: string, data: UserUpdatePayload) =>
    api<{ message: string; updated_fields: string[] }>(ROUTES.apiUser(id), {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  getGoals: (id: string) =>
    api<{ user_id: string; goals: unknown[] }>(ROUTES.apiUserGoals(id)),
  getActivity: (id: string, limit?: number) => {
    const q = limit != null ? `?limit=${limit}` : "";
    return api<{ user_id: string; activity: unknown[] }>(
      `${ROUTES.apiUserActivity(id)}${q}`
    );
  },
};

// Subscriptions
export type SubscriptionSummary = {
  id: string;
  user_id: string;
  user_email: string | null;
  plan_id: string;
  plan: string;
  status: string;
  platform: string | null;
  current_period_end: string | null;
  expires_date: string | null;
  created_at: string;
};

export type SubscriptionDetail = SubscriptionSummary & {
  purchase_date: string | null;
  auto_renew: boolean;
  cancel_at_period_end: boolean | null;
  product_id: string | null;
  users: { id: string; email: string; name: string | null } | null;
};

export type SubscriptionStats = {
  total_subscriptions: number;
  active_subscriptions: number;
  by_plan: { premium: number; free: number };
  by_platform: { ios: number; android: number; admin_granted?: number; promo?: number };
  by_status: { active: number; cancelled: number; expired: number };
  mrr_estimate: number;
};

export type SubscriptionsListResponse = {
  subscriptions: SubscriptionSummary[];
  total: number;
  page: number;
  per_page: number;
};

export const subscriptionsApi = {
  list: (params?: {
    page?: number;
    per_page?: number;
    status?: string;
    platform?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page != null) searchParams.set("page", String(params.page));
    if (params?.per_page != null) searchParams.set("per_page", String(params.per_page));
    if (params?.status) searchParams.set("status", params.status);
    if (params?.platform) searchParams.set("platform", params.platform);
    const q = searchParams.toString();
    return api<SubscriptionsListResponse>(
      `${ROUTES.API_SUBSCRIPTIONS}${q ? `?${q}` : ""}`
    );
  },
  stats: () => api<SubscriptionStats>(ROUTES.API_SUBSCRIPTIONS_STATS),
  get: (id: string) =>
    api<SubscriptionDetail>(ROUTES.apiSubscription(id)),
  cancel: (id: string, immediate: boolean = false) => {
    const q = immediate ? "?immediate=true" : "";
    return api<{ message: string; immediate: boolean }>(
      `${ROUTES.apiSubscriptionCancel(id)}${q}`,
      { method: "POST" }
    );
  },
  grant: (user_id: string, plan_id: string = "premium", days: number = 30) =>
    api<{ message: string; user_id: string; expires_at: string }>(
      ROUTES.API_SUBSCRIPTIONS_GRANT,
      {
        method: "POST",
        body: JSON.stringify({ user_id, plan_id, days }),
      }
    ),
};

// User Reports
export type ReportSummary = {
  id: string;
  reporter_id: string;
  reporter_email: string | null;
  reported_user_id: string;
  reported_user_email: string | null;
  reported_username: string | null;
  reason: string;
  details: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type ReportDetail = ReportSummary & {
  reporter_name: string | null;
  reported_user_name: string | null;
  reviewed_by: string | null;
};

export type ReportStats = {
  total: number;
  pending: number;
  reviewed: number;
  actioned: number;
  dismissed: number;
  by_reason: Record<string, number>;
};

export type ReportsListResponse = {
  reports: ReportSummary[];
  total: number;
  page: number;
  per_page: number;
};

export type ReportUpdatePayload = {
  status?: "pending" | "reviewed" | "actioned" | "dismissed";
  admin_notes?: string;
};

export const userReportsApi = {
  list: (params?: {
    page?: number;
    per_page?: number;
    status?: string;
    reason?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page != null) searchParams.set("page", String(params.page));
    if (params?.per_page != null) searchParams.set("per_page", String(params.per_page));
    if (params?.status) searchParams.set("status", params.status);
    if (params?.reason) searchParams.set("reason", params.reason);
    const q = searchParams.toString();
    return api<ReportsListResponse>(
      `${ROUTES.API_USER_REPORTS}${q ? `?${q}` : ""}`
    );
  },
  stats: () => api<ReportStats>(ROUTES.API_USER_REPORTS_STATS),
  get: (id: string) => api<ReportDetail>(ROUTES.apiUserReport(id)),
  update: (id: string, data: ReportUpdatePayload) =>
    api<{ message: string; updated_fields: string[] }>(ROUTES.apiUserReport(id), {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// Blog
export type BlogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  post_count: number;
};

export type BlogTag = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  post_count: number;
};

export type BlogPostAuthor = {
  id: string;
  name: string | null;
  username: string | null;
  profile_picture_url: string | null;
};

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  featured_image_url: string | null;
  is_featured: boolean;
  status: string;
  author_id: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  author: BlogPostAuthor;
  categories: Array<{ id: string; name: string; slug: string }>;
  tags: Array<{ id: string; name: string; slug: string }>;
};

export type BlogPostsListResponse = {
  posts: BlogPost[];
  total: number;
  page: number;
  per_page: number;
};

export type BlogCategoryCreatePayload = {
  name: string;
  slug: string;
  description?: string | null;
};

export type BlogCategoryUpdatePayload = {
  name?: string;
  slug?: string;
  description?: string | null;
};

export type BlogTagCreatePayload = {
  name: string;
  slug: string;
};

export type BlogTagUpdatePayload = {
  name?: string;
  slug?: string;
};

export type BlogPostCreatePayload = {
  title: string;
  content: string;
  excerpt?: string | null;
  featured_image_url?: string | null;
  is_featured?: boolean;
  status?: string;
  slug?: string | null;
  category_ids?: string[];
  tag_ids?: string[];
};

export type BlogPostUpdatePayload = {
  title?: string;
  content?: string;
  excerpt?: string | null;
  featured_image_url?: string | null;
  is_featured?: boolean;
  status?: string;
  slug?: string | null;
  category_ids?: string[];
  tag_ids?: string[];
};

export const blogApi = {
  categories: {
    list: () => api<BlogCategory[]>(ROUTES.API_BLOG_CATEGORIES),
    create: (data: BlogCategoryCreatePayload) =>
      api<BlogCategory>(ROUTES.API_BLOG_CATEGORIES, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: BlogCategoryUpdatePayload) =>
      api<BlogCategory>(ROUTES.apiBlogCategory(id), {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      api<void>(ROUTES.apiBlogCategory(id), { method: "DELETE" }),
  },
  tags: {
    list: () => api<BlogTag[]>(ROUTES.API_BLOG_TAGS),
    create: (data: BlogTagCreatePayload) =>
      api<BlogTag>(ROUTES.API_BLOG_TAGS, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: BlogTagUpdatePayload) =>
      api<BlogTag>(ROUTES.apiBlogTag(id), {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      api<void>(ROUTES.apiBlogTag(id), { method: "DELETE" }),
  },
  posts: {
    list: (params?: {
      page?: number;
      per_page?: number;
      status_filter?: string;
      category_id?: string;
      tag_id?: string;
      search?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.page != null) searchParams.set("page", String(params.page));
      if (params?.per_page != null) searchParams.set("per_page", String(params.per_page));
      if (params?.status_filter) searchParams.set("status_filter", params.status_filter);
      if (params?.category_id) searchParams.set("category_id", params.category_id);
      if (params?.tag_id) searchParams.set("tag_id", params.tag_id);
      if (params?.search) searchParams.set("search", params.search);
      const q = searchParams.toString();
      return api<BlogPostsListResponse>(
        `${ROUTES.API_BLOG_POSTS}${q ? `?${q}` : ""}`
      );
    },
    get: (id: string) => api<BlogPost>(ROUTES.apiBlogPost(id)),
    create: (data: BlogPostCreatePayload) =>
      api<BlogPost>(ROUTES.API_BLOG_POSTS, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: BlogPostUpdatePayload) =>
      api<BlogPost>(ROUTES.apiBlogPost(id), {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      api<void>(ROUTES.apiBlogPost(id), { method: "DELETE" }),
    publish: (id: string) =>
      api<{ message: string }>(`${ROUTES.apiBlogPost(id)}/publish`, {
        method: "POST",
      }),
  },
  uploadImage: async (file: File): Promise<{ data?: { url: string; filename: string }; error?: string }> => {
    const getBaseUrl = () => {
      if (typeof window !== "undefined") return "";
      return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    };
    const base = getBaseUrl();
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${base}${ROUTES.API_BLOG_UPLOAD_IMAGE}`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (data as { detail?: string })?.detail || "Upload failed";
      return { error: typeof err === "string" ? err : "Upload failed" };
    }
    return { data: data as { url: string; filename: string } };
  },
};

// --- Tasks (Celery) ---
export type TaskOverview = {
  workers_online: number;
  workers: Array<{
    name: string;
    status: string;
    active_tasks: number;
    processed: number | null;
    concurrency: number | null;
  }>;
  active_tasks: number;
  scheduled_tasks: number;
  reserved_tasks: number;
};

export type TaskInfo = {
  id: string;
  name: string | null;
  state: string;
  args?: unknown[];
  kwargs?: Record<string, unknown>;
  result?: unknown;
  error?: string | null;
  traceback?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
};

export type ActiveTask = {
  worker: string;
  id: string;
  name: string;
  args?: unknown[];
  kwargs?: Record<string, unknown>;
  time_start?: number;
};

export type ScheduledTask = {
  worker: string;
  id: string;
  name: string;
  eta?: string;
  priority?: number;
};

export type TaskLogEntry = {
  id: string;
  name: string | null;
  state: "SUCCESS" | "FAILURE";
  result?: unknown;
  error?: string | null;
  traceback?: string | null;
  date_done?: string | null;
};

export type TaskLogsResponse = {
  logs: TaskLogEntry[];
  count: number;
};

export type TaskFailureEntry = {
  id: string;
  task_id: string;
  task_name: string | null;
  state: "FAILURE" | "SOFT_FAILURE";
  error_message: string;
  traceback: string | null;
  args_json: string | null;
  kwargs_json: string | null;
  created_at: string;
};

export type TaskFailuresResponse = {
  failures: TaskFailureEntry[];
  count: number;
};

export const tasksApi = {
  overview: () => api<TaskOverview>(ROUTES.API_TASKS_OVERVIEW),
  recent: (params?: { limit?: number }) => {
    const q = params?.limit != null ? `?limit=${params.limit}` : "";
    return api<TaskLogsResponse>(`${ROUTES.API_TASKS_RECENT}${q}`);
  },
  failures: (params?: { limit?: number; task_name?: string }) => {
    const sp = new URLSearchParams();
    if (params?.limit != null) sp.set("limit", String(params.limit));
    if (params?.task_name) sp.set("task_name", params.task_name);
    const q = sp.toString();
    return api<TaskFailuresResponse>(`${ROUTES.API_TASKS_FAILURES}${q ? `?${q}` : ""}`);
  },
  deleteFailure: (recordId: string) =>
    api<{ message: string; id: string }>(ROUTES.apiTaskFailure(recordId), {
      method: "DELETE",
    }),
  workers: () => api<{ ping: Record<string, unknown>; stats: Record<string, unknown>; registered: Record<string, string[]>; active_queues: Record<string, unknown> }>(ROUTES.API_TASKS_WORKERS),
  active: () => api<{ count: number; tasks: ActiveTask[] }>(ROUTES.API_TASKS_ACTIVE),
  scheduled: () => api<{ count: number; tasks: ScheduledTask[] }>(ROUTES.API_TASKS_SCHEDULED),
  beatSchedule: () =>
    api<{ entries: Array<{ name: string; task: string; schedule_human: string }> }>(
      ROUTES.API_TASKS_BEAT_SCHEDULE
    ),
  registered: () => api<{ tasks: string[] }>(ROUTES.API_TASKS_REGISTERED),
  getTask: (id: string) => api<TaskInfo>(ROUTES.apiTask(id)),
  revoke: (id: string, terminate?: boolean) =>
    api<{ message: string; terminate?: boolean }>(
      `${ROUTES.apiTaskRevoke(id)}${terminate ? "?terminate=true" : ""}`,
      { method: "POST" }
    ),
  purge: (queue?: string) =>
    api<{ message: string; purged_count?: number }>(
      `${ROUTES.API_TASKS_PURGE}${queue ? `?queue=${encodeURIComponent(queue)}` : ""}`,
      { method: "POST" }
    ),
  catchup: (params?: { lookback_days?: number; start_date?: string; end_date?: string }) =>
    api<{ message: string; task_id: string; mode: string; status: string }>(
      ROUTES.API_TASKS_CATCHUP,
      { method: "POST", body: JSON.stringify(params ?? {}) }
    ),
};

// --- Analytics ---
export type DashboardStats = {
  users: { total: number; new_this_week: number; active_this_week: number };
  goals: { total: number; active: number };
  checkins: { total: number; today: number; this_week: number };
  subscriptions: { active: number; mrr: number };
  generated_at: string;
};

export type UserGrowthPoint = {
  date: string;
  new_users: number;
  cumulative: number;
};

export type UserGrowthResponse = {
  period_days: number;
  data: UserGrowthPoint[];
};

export type CheckinActivityPoint = {
  date: string;
  completed: number;
  missed: number;
  total: number;
  completion_rate: number;
};

export type CheckinActivityResponse = {
  period_days: number;
  data: CheckinActivityPoint[];
};

export type RetentionCohort = {
  week: number;
  cohort_start: string;
  cohort_size: number;
  retained: number;
  retention_rate: number;
};

export type RetentionResponse = {
  cohorts: RetentionCohort[];
  generated_at: string;
};

export type SubscriptionByPlatform = {
  by_platform: Record<string, number>;
  total: number;
};

export type MrrTrendPoint = { date: string; mrr: number; active_subscriptions: number };
export type MrrTrendResponse = { period_days: number; data: MrrTrendPoint[] };

export type ReferralAnalytics = {
  total_referrals: number;
  rewarded: number;
  conversion_rate: number;
  top_referrers: { user_id: string; email: string; name: string; referral_count: number }[];
};

export type ChurnPoint = { date: string; cancellations: number };
export type ChurnResponse = { period_days: number; data: ChurnPoint[] };

export type EngagementStats = { dau: number; wau: number; mau: number; generated_at: string };

export type BroadcastEngagementItem = {
  broadcast_id: string;
  title: string;
  created_at: string | null;
  views: number;
  clicks: number;
};
export type BroadcastEngagementResponse = {
  broadcasts: BroadcastEngagementItem[];
  total_views: number;
};

export const analyticsApi = {
  dashboard: () => api<DashboardStats>(ROUTES.API_ANALYTICS_DASHBOARD),
  userGrowth: (days: number = 30) =>
    api<UserGrowthResponse>(`${ROUTES.API_ANALYTICS_USER_GROWTH}?days=${days}`),
  checkinActivity: (days: number = 30) =>
    api<CheckinActivityResponse>(`${ROUTES.API_ANALYTICS_CHECKINS}?days=${days}`),
  retention: () => api<RetentionResponse>(ROUTES.API_ANALYTICS_RETENTION),
  subscriptionByPlatform: () =>
    api<SubscriptionByPlatform>(ROUTES.API_ANALYTICS_SUBS_PLATFORM),
  mrrTrend: (days: number = 30) =>
    api<MrrTrendResponse>(`${ROUTES.API_ANALYTICS_MRR_TREND}?days=${days}`),
  referrals: () => api<ReferralAnalytics>(ROUTES.API_ANALYTICS_REFERRALS),
  churn: (days: number = 30) =>
    api<ChurnResponse>(`${ROUTES.API_ANALYTICS_CHURN}?days=${days}`),
  engagement: () => api<EngagementStats>(ROUTES.API_ANALYTICS_ENGAGEMENT),
  broadcastEngagement: () =>
    api<BroadcastEngagementResponse>(ROUTES.API_ANALYTICS_BROADCASTS_ENGAGEMENT),
  clearCache: () =>
    api<{ success: boolean; deleted_keys: number; message: string }>(
      ROUTES.API_ANALYTICS_CACHE,
      { method: "DELETE" }
    ),
};

export type AppConfigItem = {
  id: string;
  key: string;
  value: string;
  category: string;
  description: string | null;
  is_public: boolean;
  updated_at: string;
};

export type AppConfigListResponse = { items: AppConfigItem[] };

export type AuditLogItem = {
  id: string;
  admin_user_id: string | null;
  admin_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
};

export type AuditLogsListResponse = {
  items: AuditLogItem[];
  total: number;
  page: number;
  per_page: number;
};

export const auditLogsApi = {
  list: (params?: {
    page?: number;
    per_page?: number;
    admin_user_id?: string;
    resource_type?: string;
    action?: string;
    from_date?: string;
    to_date?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page != null) searchParams.set("page", String(params.page));
    if (params?.per_page != null) searchParams.set("per_page", String(params.per_page));
    if (params?.admin_user_id) searchParams.set("admin_user_id", params.admin_user_id);
    if (params?.resource_type) searchParams.set("resource_type", params.resource_type);
    if (params?.action) searchParams.set("action", params.action);
    if (params?.from_date) searchParams.set("from_date", params.from_date);
    if (params?.to_date) searchParams.set("to_date", params.to_date);
    const q = searchParams.toString();
    return api<AuditLogsListResponse>(`${ROUTES.API_AUDIT_LOGS}${q ? `?${q}` : ""}`);
  },
};

export type BroadcastItem = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  deeplink: string | null;
  source_lang: string;
  translations: Record<string, { title?: string; body?: string; cta_label?: string }> | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  audience: string;
  delivery: string;
  created_at: string;
  updated_at: string;
};

export type BroadcastsListResponse = {
  items: BroadcastItem[];
  total: number;
  page: number;
  per_page: number;
};

export type BroadcastCreatePayload = {
  title: string;
  body: string;
  image_url?: string;
  cta_label?: string;
  cta_url?: string;
  deeplink?: string;
  source_lang?: string;
  translations?: Record<string, { title?: string; body?: string; cta_label?: string }>;
  is_active?: boolean;
  starts_at?: string;
  ends_at?: string;
  audience?: string;
  delivery?: string;
};

export type BroadcastUpdatePayload = Partial<BroadcastCreatePayload>;

export const broadcastsApi = {
  list: (params?: {
    page?: number;
    per_page?: number;
    is_active?: boolean;
    audience?: string;
    delivery?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page != null) searchParams.set("page", String(params.page));
    if (params?.per_page != null) searchParams.set("per_page", String(params.per_page));
    if (params?.is_active != null) searchParams.set("is_active", String(params.is_active));
    if (params?.audience) searchParams.set("audience", params.audience);
    if (params?.delivery) searchParams.set("delivery", params.delivery);
    const q = searchParams.toString();
    return api<BroadcastsListResponse>(`${ROUTES.API_BROADCASTS}${q ? `?${q}` : ""}`);
  },
  get: (id: string) => api<BroadcastItem>(ROUTES.apiBroadcast(id)),
  create: (payload: BroadcastCreatePayload) =>
    api<BroadcastItem>(ROUTES.API_BROADCASTS, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, payload: BroadcastUpdatePayload) =>
    api<BroadcastItem>(ROUTES.apiBroadcast(id), {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  delete: (id: string) =>
    api<{ message: string }>(ROUTES.apiBroadcast(id), { method: "DELETE" }),
};

export const appConfigApi = {
  list: () => api<AppConfigListResponse>(ROUTES.API_APP_CONFIG),
  get: (key: string) =>
    api<AppConfigItem>(ROUTES.apiAppConfigKey(key)),
  update: (key: string, payload: { value: string; description?: string; is_public?: boolean }) =>
    api<AppConfigItem>(ROUTES.apiAppConfigKey(key), {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
};

// App Versions
export type AppVersionItem = {
  id: string;
  platform: string;
  latest_version: string;
  minimum_version: string;
  release_notes: string | null;
  store_url: string | null;
  force_update: boolean;
  created_at: string;
  updated_at: string;
};

export type AppVersionListResponse = { items: AppVersionItem[] };

export type AppVersionUpdatePayload = {
  latest_version?: string;
  minimum_version?: string;
  release_notes?: string | null;
  store_url?: string | null;
  force_update?: boolean;
};

export const appVersionsApi = {
  list: () => api<AppVersionListResponse>(ROUTES.API_APP_VERSIONS),
  get: (platform: string) =>
    api<AppVersionItem>(ROUTES.apiAppVersion(platform)),
  update: (platform: string, payload: AppVersionUpdatePayload) =>
    api<AppVersionItem>(ROUTES.apiAppVersion(platform), {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
};

// Deactivation Logs
export type DeactivationLogItem = {
  id: string;
  user_id: string;
  user_email: string | null;
  previous_plan: string;
  new_plan: string;
  goals_deactivated: number;
  deactivation_reason: string;
  deactivated_goal_ids: unknown[] | null;
  created_at: string;
};

export type DeactivationLogsListResponse = {
  items: DeactivationLogItem[];
  total: number;
  page: number;
  per_page: number;
};

export const deactivationLogsApi = {
  list: (params?: {
    page?: number;
    per_page?: number;
    user_id?: string;
    reason?: string;
    from_date?: string;
    to_date?: string;
    export_csv?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page != null) searchParams.set("page", String(params.page));
    if (params?.per_page != null)
      searchParams.set("per_page", String(params.per_page));
    if (params?.user_id) searchParams.set("user_id", params.user_id);
    if (params?.reason) searchParams.set("reason", params.reason);
    if (params?.from_date) searchParams.set("from_date", params.from_date);
    if (params?.to_date) searchParams.set("to_date", params.to_date);
    if (params?.export_csv) searchParams.set("export_csv", "true");
    const q = searchParams.toString();
    return api<DeactivationLogsListResponse>(
      `${ROUTES.API_DEACTIVATION_LOGS}${q ? `?${q}` : ""}`
    );
  },
};

// Referrals
export type ReferralItem = {
  id: string;
  referrer_user_id: string;
  referrer_email: string | null;
  referred_user_id: string;
  referred_email: string | null;
  status: string;
  bonus_days_referrer: number;
  bonus_days_referred: number;
  rewarded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReferralsListResponse = {
  items: ReferralItem[];
  total: number;
  page: number;
  per_page: number;
};

export const referralsApi = {
  list: (params?: {
    page?: number;
    per_page?: number;
    status?: string;
    referrer_user_id?: string;
    referred_user_id?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page != null) searchParams.set("page", String(params.page));
    if (params?.per_page != null)
      searchParams.set("per_page", String(params.per_page));
    if (params?.status) searchParams.set("status", params.status);
    if (params?.referrer_user_id)
      searchParams.set("referrer_user_id", params.referrer_user_id);
    if (params?.referred_user_id)
      searchParams.set("referred_user_id", params.referred_user_id);
    const q = searchParams.toString();
    return api<ReferralsListResponse>(
      `${ROUTES.API_REFERRALS}${q ? `?${q}` : ""}`
    );
  },
};

// Data Export
export type DataExportItem = {
  id: string;
  user_id: string;
  email: string;
  status: string;
  error_message: string | null;
  download_url: string | null;
  expires_at: string | null;
  created_at: string;
  completed_at: string | null;
};

export type DataExportListResponse = {
  items: DataExportItem[];
  total: number;
  page: number;
  per_page: number;
};

export type DataExportRequestResponse = {
  success: boolean;
  message: string;
  export_id?: string;
};

export const dataExportApi = {
  list: (params?: {
    page?: number;
    per_page?: number;
    status?: string;
    user_id?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page != null) searchParams.set("page", String(params.page));
    if (params?.per_page != null)
      searchParams.set("per_page", String(params.per_page));
    if (params?.status) searchParams.set("status", params.status);
    if (params?.user_id) searchParams.set("user_id", params.user_id);
    const q = searchParams.toString();
    return api<DataExportListResponse>(
      `${ROUTES.API_DATA_EXPORT}${q ? `?${q}` : ""}`
    );
  },
  get: (id: string) => api<DataExportItem>(ROUTES.apiDataExport(id)),
  request: (email: string) =>
    api<DataExportRequestResponse>(ROUTES.API_DATA_EXPORT_REQUEST, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  retry: (id: string) =>
    api<{ message: string; export_id: string }>(ROUTES.apiDataExportRetry(id), {
      method: "POST",
    }),
};

// Subscription Plans
export type SubscriptionPlanItem = {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  active_goal_limit: number;
  tier: number;
  is_popular: boolean;
  has_trial: boolean;
  trial_days: number | null;
  is_active: boolean;
  sort_order: number;
  product_id_ios_monthly: string | null;
  product_id_ios_annual: string | null;
  product_id_android_monthly: string | null;
  product_id_android_annual: string | null;
  exit_offer_enabled: boolean;
  exit_offer_monthly_price: number | null;
  exit_offer_annual_price: number | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionPlanListResponse = {
  items: SubscriptionPlanItem[];
};

export type SubscriptionPlanUpdatePayload = Partial<
  Omit<SubscriptionPlanItem, "id" | "created_at" | "updated_at">
>;

export const subscriptionPlansApi = {
  list: () =>
    api<SubscriptionPlanListResponse>(ROUTES.API_SUBSCRIPTION_PLANS),
  get: (id: string) =>
    api<SubscriptionPlanItem>(ROUTES.apiSubscriptionPlan(id)),
  update: (id: string, payload: SubscriptionPlanUpdatePayload) =>
    api<SubscriptionPlanItem>(ROUTES.apiSubscriptionPlan(id), {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
};

// Plan Features
export type PlanFeatureItem = {
  id: string;
  plan_id: string;
  feature_key: string;
  feature_name: string;
  feature_description: string | null;
  feature_value: number | null;
  is_enabled: boolean;
  sort_order: number;
  ai_description: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanFeaturesListResponse = {
  items: PlanFeatureItem[];
};

export type PlanFeatureUpdatePayload = {
  feature_name?: string;
  feature_description?: string | null;
  feature_value?: number | null;
  is_enabled?: boolean;
  sort_order?: number;
  ai_description?: string | null;
};

export const planFeaturesApi = {
  listByPlan: (planId: string) =>
    api<PlanFeaturesListResponse>(ROUTES.apiPlanFeaturesByPlan(planId)),
  update: (id: string, payload: PlanFeatureUpdatePayload) =>
    api<PlanFeatureItem>(ROUTES.apiPlanFeature(id), {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
};

// Legal Documents
export type LegalDocumentItem = {
  id: string;
  type: string;
  version: string;
  title: string;
  content: string;
  summary: string | null;
  effective_date: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

export type LegalDocumentListResponse = {
  items: LegalDocumentItem[];
};

export type LegalDocumentCreatePayload = {
  type: "terms_of_service" | "privacy_policy" | "cookie_policy";
  version: string;
  title: string;
  content: string;
  summary?: string | null;
  effective_date: string;
  is_current?: boolean;
};

export type LegalDocumentUpdatePayload = {
  version?: string;
  title?: string;
  content?: string;
  summary?: string | null;
  effective_date?: string;
  is_current?: boolean;
};

export const legalDocumentsApi = {
  list: (params?: { type?: string }) => {
    const q = params?.type ? `?type=${encodeURIComponent(params.type)}` : "";
    return api<LegalDocumentListResponse>(
      `${ROUTES.API_LEGAL_DOCUMENTS}${q}`
    );
  },
  get: (id: string) => api<LegalDocumentItem>(ROUTES.apiLegalDocument(id)),
  create: (payload: LegalDocumentCreatePayload) =>
    api<LegalDocumentItem>(ROUTES.API_LEGAL_DOCUMENTS, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, payload: LegalDocumentUpdatePayload) =>
    api<LegalDocumentItem>(ROUTES.apiLegalDocument(id), {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  setCurrent: (id: string) =>
    api<LegalDocumentItem>(ROUTES.apiLegalDocumentSetCurrent(id), {
      method: "POST",
    }),
  delete: (id: string) =>
    api<{ message: string }>(ROUTES.apiLegalDocument(id), {
      method: "DELETE",
    }),
};
