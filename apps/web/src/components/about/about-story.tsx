"use client";

import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n";

export function AboutStory() {
  const { t } = useTranslation();

  return (
    <section className="relative w-full">
      {/* Background with padding like other sections */}
      <div className="absolute inset-4 bg-card rounded-3xl"></div>
      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-8 leading-tight">
              {t("about.story.title")}
            </h2>
            <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto">
              {t("about.story.subtitle")}
            </p>

            <motion.div
              className="text-left bg-background/50 backdrop-blur-sm rounded-2xl p-8 border border-border"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t("about.story.description")}
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
