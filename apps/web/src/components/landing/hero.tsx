"use client";

import { ArrowRight, Play } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@fitnudge/ui";

export function Hero() {
  const { t } = useTranslation();

  return (
    <section className="relative min-h-screen w-full">
      {/* Blue background with padding */}
      <div className="absolute inset-4 bg-primary rounded-3xl">
        {/* Background decorative elements */}
        <div className="absolute inset-0">
          {/* Abstract white lines */}
          <div className="absolute top-20 left-10 w-32 h-32 border border-white/20 rounded-full"></div>
          <div className="absolute top-40 right-20 w-24 h-24 border border-white/20 rounded-full"></div>
          <div className="absolute bottom-40 left-1/4 w-16 h-16 border border-white/20 rounded-full"></div>

          {/* Connecting lines */}
          <div className="absolute top-32 left-1/4 w-px h-32 bg-white/30 transform rotate-12"></div>
          <div className="absolute top-60 right-1/3 w-px h-24 bg-white/30 transform -rotate-12"></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 pt-24 pb-20 text-white flex items-center justify-center min-h-full">
          <div className="text-center max-w-4xl mx-auto">
            <motion.h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              {t("hero.title")}
            </motion.h1>

            <motion.p
              className="text-xl md:text-2xl text-blue-100 mb-12 leading-relaxed"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              {t("hero.subtitle")}
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-6 justify-center"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <Button
                onClick={() => {
                  const downloadSection =
                    document.getElementById("download-section");
                  if (downloadSection) {
                    downloadSection.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="group bg-blue-500 hover:bg-blue-400 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 shadow-lg"
              >
                <span>{t("hero.download_free")}</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>

              <Button
                className="group border-2 border-white text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-white/10 transition-all duration-300"
                variant="outline"
              >
                <Play className="h-5 w-5" />
                <span>{t("hero.watch_demo")}</span>
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
