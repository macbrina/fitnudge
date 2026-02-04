/**
 * Admin portal navigation menu config.
 * Based on docs/ADMIN_PORTAL.md - sections and links.
 */

import {
  LayoutDashboard,
  Users,
  CreditCard,
  Flag,
  FileText,
  FolderOpen,
  Tag,
  Workflow,
  BarChart3,
  Settings,
  Megaphone,
  Wrench,
  ScrollText,
  Activity,
  AlertTriangle,
  Calendar,
  CalendarClock,
  Clock,
  List,
  TrendingUp,
  TrendingDown,
  Target,
  Repeat,
  Terminal,
  Smartphone,
  ClipboardList,
  Gift,
  Package,
} from "lucide-react";
import { ROUTES } from "./routes";
import type { LucideIcon } from "lucide-react";

export type MenuItem = {
  labelKey: string;
  href: string;
  icon?: LucideIcon;
};

export type MenuSection = {
  labelKey?: string;
  items: MenuItem[];
};

export const MENU_SECTIONS: MenuSection[] = [
  {
    items: [
      {
        labelKey: "admin.menu.overview",
        href: ROUTES.DASHBOARD_OVERVIEW,
        icon: LayoutDashboard,
      },
    ],
  },
  {
    labelKey: "admin.menu.management",
    items: [
      { labelKey: "admin.menu.users", href: ROUTES.USERS, icon: Users },
      { labelKey: "admin.menu.subscriptions", href: ROUTES.SUBSCRIPTIONS, icon: CreditCard },
      { labelKey: "admin.menu.user_reports", href: ROUTES.USER_REPORTS, icon: Flag },
      { labelKey: "admin.menu.referrals", href: ROUTES.REFERRALS, icon: Gift },
      { labelKey: "admin.menu.data_export", href: ROUTES.DATA_EXPORT, icon: FileText },
      { labelKey: "admin.menu.subscription_plans", href: ROUTES.SUBSCRIPTION_PLANS, icon: Package },
      { labelKey: "admin.menu.legal_documents", href: ROUTES.LEGAL_DOCUMENTS, icon: ScrollText },
      { labelKey: "admin.menu.deactivation_logs", href: ROUTES.DEACTIVATION_LOGS, icon: ClipboardList },
    ],
  },
  {
    labelKey: "admin.menu.content",
    items: [
      { labelKey: "admin.menu.blog_posts", href: ROUTES.BLOG_POSTS, icon: FileText },
      { labelKey: "admin.menu.blog_categories", href: ROUTES.BLOG_CATEGORIES, icon: FolderOpen },
      { labelKey: "admin.menu.blog_tags", href: ROUTES.BLOG_TAGS, icon: Tag },
    ],
  },
  {
    labelKey: "admin.menu.tasks",
    items: [
      { labelKey: "admin.menu.tasks_overview", href: ROUTES.TASKS_OVERVIEW, icon: Workflow },
      { labelKey: "admin.menu.task_logs", href: ROUTES.TASKS_LOGS, icon: Terminal },
      { labelKey: "admin.menu.task_failures", href: ROUTES.TASKS_FAILURES, icon: AlertTriangle },
      { labelKey: "admin.menu.beat_schedule", href: ROUTES.TASKS_BEAT_SCHEDULE, icon: CalendarClock },
      { labelKey: "admin.menu.workers", href: ROUTES.TASKS_WORKERS, icon: Activity },
      { labelKey: "admin.menu.active", href: ROUTES.TASKS_ACTIVE, icon: Clock },
      { labelKey: "admin.menu.scheduled", href: ROUTES.TASKS_SCHEDULED, icon: Calendar },
      { labelKey: "admin.menu.registered", href: ROUTES.TASKS_REGISTERED, icon: List },
    ],
  },
  {
    labelKey: "admin.menu.analytics",
    items: [
      { labelKey: "admin.menu.analytics_dashboard", href: ROUTES.ANALYTICS_DASHBOARD, icon: BarChart3 },
      { labelKey: "admin.menu.user_growth", href: ROUTES.ANALYTICS_USER_GROWTH, icon: TrendingUp },
      { labelKey: "admin.menu.checkin_activity", href: ROUTES.ANALYTICS_CHECKINS, icon: Target },
      { labelKey: "admin.menu.retention", href: ROUTES.ANALYTICS_RETENTION, icon: Repeat },
      { labelKey: "admin.menu.churn", href: ROUTES.ANALYTICS_CHURN, icon: TrendingDown },
    ],
  },
  {
    labelKey: "admin.menu.settings",
    items: [
      { labelKey: "admin.menu.app_config", href: ROUTES.APP_CONFIG, icon: Settings },
      { labelKey: "admin.menu.app_versions", href: ROUTES.APP_VERSIONS, icon: Smartphone },
      { labelKey: "admin.menu.broadcasts", href: ROUTES.BROADCASTS, icon: Megaphone },
      { labelKey: "admin.menu.maintenance", href: ROUTES.MAINTENANCE, icon: Wrench },
      { labelKey: "admin.menu.audit_logs", href: ROUTES.AUDIT_LOGS, icon: ScrollText },
    ],
  },
];
