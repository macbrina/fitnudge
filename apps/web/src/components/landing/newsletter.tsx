"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@fitnudge/ui";
import { useTranslation } from "@/lib/i18n";

export function Newsletter() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className="relative w-full py-4 sm:py-6 lg:py-8">
      <div className="mx-2 sm:mx-4 bg-secondary rounded-2xl sm:rounded-3xl">
        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
                {t("web.blog.newsletter.title")}
              </h2>
              <p className="text-muted-foreground mb-8 text-base sm:text-lg">
                {t("web.blog.newsletter.description")}
              </p>

              {status === "success" ? (
                <div className="flex items-center justify-center gap-2 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 max-w-md mx-auto">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-green-700 dark:text-green-400 text-sm">
                    {t("web.blog.newsletter.success")}
                  </span>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto"
                >
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("web.blog.newsletter.placeholder")}
                    required
                    className="flex-1 px-4 py-3 rounded-full border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <Button
                    type="submit"
                    className="rounded-full px-8"
                    size="lg"
                    disabled={status === "loading"}
                  >
                    {status === "loading"
                      ? t("web.blog.newsletter.subscribing")
                      : t("web.blog.newsletter.subscribe")}
                  </Button>
                </form>
              )}

              {status === "error" && (
                <div className="flex items-center justify-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 max-w-md mx-auto mt-4">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="text-red-700 dark:text-red-400 text-sm">
                    {t("web.blog.newsletter.error")}
                  </span>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
