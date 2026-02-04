"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { Button, Input } from "@fitnudge/ui";
import { useAuth } from "@/contexts/AuthContext";
import { ROUTES } from "@/lib/routes";

export function LoginView() {
  const { t } = useTranslation();
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError(t("errors.validation_error"));
      return;
    }
    setIsSubmitting(true);
    const { error: err } = await login(email.trim(), password);
    setIsSubmitting(false);
    if (err) {
      setError(err || t("errors.authentication_error"));
      return;
    }
    router.replace(ROUTES.DASHBOARD);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t("admin.login.title")}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {t("admin.login.subtitle")}
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
                {t("admin.login.email")}
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEmail(e.target.value)
                }
                placeholder={t("admin.login.email_placeholder")}
                autoComplete="email"
                required
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {t("admin.login.password")}
                </label>
                <Link
                  href={ROUTES.FORGOT_PASSWORD}
                  className="text-sm text-primary hover:underline"
                >
                  {t("admin.login.forgot_password")}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPassword(e.target.value)
                }
                placeholder={t("admin.login.password_placeholder")}
                autoComplete="current-password"
                required
                className="w-full"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full"
              size="lg"
            >
              {isSubmitting
                ? t("admin.login.signing_in")
                : t("admin.login.sign_in")}
            </Button>
          </form>
        </div>

        <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-6">
          {t("admin.portal_title")}
        </p>
      </div>
    </div>
  );
}
