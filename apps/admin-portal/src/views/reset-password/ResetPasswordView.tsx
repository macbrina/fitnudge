"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { Button, Input } from "@fitnudge/ui";
import { useAuthValidateResetToken, useAuthResetPassword } from "@/hooks/api/useAuth";
import { ROUTES } from "@/lib/routes";

export function ResetPasswordView() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const { data: tokenData, isSuccess: tokenSuccess, isLoading: tokenLoading } =
    useAuthValidateResetToken(token, !!token);
  const resetMutation = useAuthResetPassword();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError(t("admin.reset_password.passwords_no_match"));
      return;
    }
    if (password.length < 8) {
      setError(t("admin.reset_password.password_min_length"));
      return;
    }
    try {
      const res = await resetMutation.mutateAsync({ token, newPassword: password });
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(true);
    } catch {
      setError(t("admin.reset_password.password_min_length"));
    }
  };

  if (token && tokenLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-500">{t("admin.reset_password.validating")}</p>
      </div>
    );
  }

  if (!token || (token && !tokenLoading && (!tokenSuccess || !tokenData?.valid))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-8">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {t("admin.reset_password.invalid_token")}
            </h1>
            <Link href={ROUTES.FORGOT_PASSWORD}>
              <Button className="mt-4">{t("admin.reset_password.request_new")}</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-8 text-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {t("admin.reset_password.title")}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t("admin.reset_password.success_message")}
            </p>
            <Link href={ROUTES.LOGIN}>
              <Button className="w-full">{t("admin.reset_password.back_to_login")}</Button>
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
              {t("admin.reset_password.title")}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {t("admin.reset_password.subtitle")}
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
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t("admin.reset_password.password")}
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPassword(e.target.value)
                }
                placeholder={t("admin.reset_password.password_placeholder")}
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t("admin.reset_password.confirm_password")}
              </label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setConfirmPassword(e.target.value)
                }
                placeholder={t("admin.reset_password.confirm_placeholder")}
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full"
              />
            </div>

            <Button
              type="submit"
              disabled={resetMutation.isPending}
              className="w-full"
              size="lg"
            >
              {resetMutation.isPending
                ? t("admin.reset_password.resetting")
                : t("admin.reset_password.reset")}
            </Button>
          </form>

          <p className="text-center mt-6">
            <Link
              href={ROUTES.LOGIN}
              className="text-sm text-primary hover:underline"
            >
              {t("admin.reset_password.back_to_login")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
