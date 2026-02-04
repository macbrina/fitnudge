"use client";

import { useTranslation } from "@/lib/i18n";

export function DashboardView() {
  const { t } = useTranslation();

  return (
    <>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        {t("admin.pages.overview_description")}
      </p>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h3 className="font-medium text-gray-900 dark:text-white mb-2">
          Quick stats
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Dashboard content coming soon. Navigate to Users, Subscriptions, or
          Tasks from the sidebar.
        </p>
      </div>
    </>
  );
}
