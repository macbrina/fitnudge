"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { Button, Input } from "@fitnudge/ui";
import { useAuthForgotPassword } from "@/hooks/api/useAuth";
import { ROUTES } from "@/lib/routes";

export function ForgotPasswordView() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const forgotMutation = useAuthForgotPassword();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError(t("errors.validation_error"));
      return;
    }
    try {
      const res = await forgotMutation.mutateAsync(email.trim());
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.validation_error"));
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-8 text-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {t("admin.forgot_password.title")}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t("admin.forgot_password.success_message")}
            </p>
            <Link href={ROUTES.LOGIN}>
              <Button className="w-full">{t("admin.forgot_password.back_to_login")}</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t("admin.forgot_password.title")}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {t("admin.forgot_password.subtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t("admin.forgot_password.email")}
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEmail(e.target.value)
                }
                placeholder={t("admin.forgot_password.email_placeholder")}
                autoComplete="email"
                required
                className="w-full"
              />
            </div>

            <Button
              type="submit"
              disabled={forgotMutation.isPending}
              className="w-full"
              size="lg"
            >
              {forgotMutation.isPending
                ? t("admin.forgot_password.sending")
                : t("admin.forgot_password.send_link")}
            </Button>
          </form>

          <p className="text-center mt-6">
            <Link
              href={ROUTES.LOGIN}
              className="text-sm text-primary hover:underline"
            >
              {t("admin.forgot_password.back_to_login")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
