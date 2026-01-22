"use client";

import { useEffect, useState } from "react";
import { LandingLayout } from "@/components/layout/LandingLayout";
import { useTranslation } from "@/lib/i18n";
import { fetchLegalDocument, type LegalDocument } from "@/store/legalDocuments";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Shield, Calendar, AlertCircle } from "lucide-react";
import Link from "next/link";
import parse from "html-react-parser";

export default function PrivacyPolicyPage() {
  const { t } = useTranslation();
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDocument() {
      try {
        const doc = await fetchLegalDocument("privacy_policy");
        setDocument(doc);
        if (!doc) {
          setError(t("legal.not_available"));
        }
      } catch {
        setError(t("legal.load_error"));
      } finally {
        setLoading(false);
      }
    }

    loadDocument();
  }, [t]);

  return (
    <LandingLayout>
      <div className="min-h-screen bg-background">
        {/* Header Section */}
        <section className="relative w-full py-12 sm:py-16 lg:py-20 bg-linear-to-b from-primary/5 to-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Shield className="h-4 w-4" />
                <span>{t("legal.legal_document")}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
                {t("legal.privacy_policy")}
              </h1>
              {document && (
                <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {t("legal.last_updated")}:{" "}
                      {format(
                        new Date(document.effective_date),
                        "MMMM d, yyyy"
                      )}
                    </span>
                  </div>
                  <span className="text-muted-foreground/50">•</span>
                  <span>
                    {t("legal.version")} {document.version}
                  </span>
                </div>
              )}
            </motion.div>
          </div>
        </section>

        {/* Content Section */}
        <section className="relative w-full py-8 sm:py-12">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <p className="text-muted-foreground">{t("common.loading")}</p>
                </div>
              </div>
            ) : error ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20"
              >
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {t("legal.unavailable_title")}
                </h2>
                <p className="text-muted-foreground mb-6">{error}</p>
                <Link
                  href="/contact"
                  className="text-primary hover:underline font-medium"
                >
                  {t("legal.contact_for_help")}
                </Link>
              </motion.div>
            ) : document ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-card rounded-2xl border border-border p-6 sm:p-8 lg:p-12 shadow-sm"
              >
                {/* Legal document content */}
                <div
                  className="legal-content prose prose-gray dark:prose-invert max-w-none
                    prose-headings:font-semibold prose-headings:text-foreground
                    prose-h1:text-2xl prose-h1:mt-8 prose-h1:mb-4
                    prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3
                    prose-h3:text-lg prose-h3:mt-4 prose-h3:mb-2
                    prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:my-3
                    prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-foreground prose-strong:font-semibold
                    [&_a]:text-primary [&_a]:underline [&_a:hover]:text-primary/80
                    [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-4 [&_ul]:ml-4
                    [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-4 [&_ol]:ml-4
                    [&_li]:text-muted-foreground [&_li]:my-1 [&_li]:ml-2
                    [&_table]:w-full [&_table]:border-collapse [&_table]:my-6 [&_table]:border [&_table]:border-border
                    [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground
                    [&_td]:border [&_td]:border-border [&_td]:p-3 [&_td]:text-muted-foreground
                    [&_thead]:bg-muted/50
                    [&_tr]:border-b [&_tr]:border-border
                    [&_div]:my-1"
                >
                  {parse(document.content)}
                </div>
              </motion.div>
            ) : null}

            {/* Footer Links */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-8 text-center text-sm text-muted-foreground"
            >
              <p>
                {t("legal.also_see")}:{" "}
                <Link
                  href="/terms-of-service"
                  className="text-primary hover:underline"
                >
                  {t("legal.terms_of_service")}
                </Link>
              </p>
            </motion.div>
          </div>
        </section>
      </div>
    </LandingLayout>
  );
}
