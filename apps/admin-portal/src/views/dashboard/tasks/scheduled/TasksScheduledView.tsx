"use client";

import { useTranslation } from "@/lib/i18n";

export function TasksScheduledView() {
  const { t } = useTranslation();
  return (
    <>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        {t("admin.pages.scheduled_description")}
      </p>
    </>
  );
}
