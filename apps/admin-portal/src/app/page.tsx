"use client";

import { useTranslation } from "react-i18next";

export default function AdminPortal() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          {t("admin.title")}
        </h1>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">{t("admin.dashboard")}</h2>
          <p className="text-gray-600">{t("admin.welcome_message")}</p>
        </div>
      </div>
    </div>
  );
}
