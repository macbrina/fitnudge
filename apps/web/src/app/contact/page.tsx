"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Clock, Send, CheckCircle, AlertCircle } from "lucide-react";
import { LandingLayout } from "@/components/layout/LandingLayout";
import { Button } from "@fitnudge/ui";
import { useTranslation } from "@/lib/i18n";

export default function ContactPage() {
  const { t } = useTranslation();
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formState),
      });

      if (response.ok) {
        setStatus("success");
        setFormState({ name: "", email: "", subject: "", message: "" });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <LandingLayout>
      <section className="relative w-full py-4 sm:py-6 lg:py-8">
        <div className="mx-2 sm:mx-4 bg-primary rounded-2xl sm:rounded-3xl overflow-hidden">
          <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 text-white">
            <div className="max-w-4xl mx-auto text-center">
              <motion.h1
                className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                {t("contact.title")}
              </motion.h1>
              <motion.p
                className="text-base sm:text-lg text-blue-100 max-w-2xl mx-auto"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                {t("contact.subtitle")}
              </motion.p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative w-full py-4 sm:py-6 lg:py-8">
        <div className="mx-2 sm:mx-4 bg-card rounded-2xl sm:rounded-3xl">
          <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="max-w-5xl mx-auto">
              <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
                {/* Contact Info */}
                <motion.div
                  className="lg:col-span-1 space-y-6"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8 }}
                >
                  <div className="bg-background rounded-2xl p-6 border border-border">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {t("contact.info.title_email")}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-2">
                      {t("contact.info.email")}
                    </p>
                  </div>

                  <div className="bg-background rounded-2xl p-6 border border-border">
                    <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-4">
                      <Clock className="h-6 w-6 text-green-500" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {t("contact.info.title_response")}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {t("contact.info.response_time")}
                    </p>
                  </div>
                </motion.div>

                {/* Contact Form */}
                <motion.div
                  className="lg:col-span-2"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8 }}
                >
                  <form onSubmit={handleSubmit} className="bg-background rounded-2xl p-6 sm:p-8 border border-border">
                    <div className="grid sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                          {t("contact.form.name")}
                        </label>
                        <input
                          id="name"
                          type="text"
                          required
                          value={formState.name}
                          onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                          placeholder={t("contact.form.name_placeholder")}
                        />
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                          {t("contact.form.email")}
                        </label>
                        <input
                          id="email"
                          type="email"
                          required
                          value={formState.email}
                          onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                          placeholder={t("contact.form.email_placeholder")}
                        />
                      </div>
                    </div>

                    <div className="mb-4">
                      <label htmlFor="subject" className="block text-sm font-medium text-foreground mb-2">
                        {t("contact.form.subject")}
                      </label>
                      <input
                        id="subject"
                        type="text"
                        required
                        value={formState.subject}
                        onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        placeholder={t("contact.form.subject_placeholder")}
                      />
                    </div>

                    <div className="mb-6">
                      <label htmlFor="message" className="block text-sm font-medium text-foreground mb-2">
                        {t("contact.form.message")}
                      </label>
                      <textarea
                        id="message"
                        required
                        rows={5}
                        value={formState.message}
                        onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                        placeholder={t("contact.form.message_placeholder")}
                      />
                    </div>

                    {status === "success" && (
                      <div className="mb-4 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span className="text-green-700 dark:text-green-400 text-sm">
                          {t("contact.form.success")}
                        </span>
                      </div>
                    )}

                    {status === "error" && (
                      <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        <span className="text-red-700 dark:text-red-400 text-sm">
                          {t("contact.form.error")}
                        </span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={status === "loading"}
                      className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl font-semibold"
                      size="lg"
                    >
                      {status === "loading" ? (
                        <span>{t("contact.form.sending")}</span>
                      ) : (
                        <>
                          <Send className="h-5 w-5 mr-2" />
                          <span>{t("contact.form.submit")}</span>
                        </>
                      )}
                    </Button>
                  </form>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
