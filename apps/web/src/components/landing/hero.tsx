"use client";

import { useTranslation } from "@/lib/i18n";
import { Button } from "@fitnudge/ui";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export function Hero() {
  const { t } = useTranslation();

  return (
    <section className="relative w-full py-4 sm:py-6 lg:py-8">
      {/* Blue background with responsive padding */}
      <div className="mx-2 sm:mx-4 bg-primary rounded-2xl sm:rounded-3xl overflow-hidden">
        {/* Mobile decorations - smaller and simpler */}
        <div className="absolute inset-0 sm:hidden overflow-hidden pointer-events-none">
          <div className="absolute top-16 left-6 w-16 h-16 border border-white/15 rounded-full"></div>
          <div className="absolute top-32 right-8 w-10 h-10 border border-white/15 rounded-full"></div>
          <div className="absolute bottom-32 left-1/4 w-8 h-8 border border-white/15 rounded-full"></div>
          <div className="absolute top-24 left-1/3 w-px h-16 bg-white/20 transform rotate-12"></div>
          <div className="absolute bottom-24 right-1/4 w-px h-12 bg-white/20 transform -rotate-12"></div>
        </div>

        {/* Tablet/Desktop decorations */}
        <div className="absolute inset-0 hidden sm:block overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-24 md:w-32 h-24 md:h-32 border border-white/20 rounded-full"></div>
          <div className="absolute top-40 right-20 w-16 md:w-24 h-16 md:h-24 border border-white/20 rounded-full"></div>
          <div className="absolute bottom-40 left-1/4 w-12 md:w-16 h-12 md:h-16 border border-white/20 rounded-full"></div>
          <div className="absolute top-32 left-1/4 w-px h-24 md:h-32 bg-white/30 transform rotate-12"></div>
          <div className="absolute top-60 right-1/3 w-px h-20 md:h-24 bg-white/30 transform -rotate-12"></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24 text-white flex items-center justify-center">
          <div className="text-center max-w-4xl mx-auto">
            <motion.h1
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight px-2"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              {t("hero.title")}
            </motion.h1>

            <motion.p
              className="text-base sm:text-lg md:text-xl lg:text-2xl text-blue-100 mb-8 sm:mb-10 leading-relaxed px-2 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              {t("hero.subtitle")}
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center px-4"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <Button
                onClick={() => {
                  const waitlistSection =
                    document.getElementById("waitlist-section");
                  if (waitlistSection) {
                    waitlistSection.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                size="lg"
                className="group bg-white hover:bg-blue-50 text-primary px-8 sm:px-10 py-4 rounded-full text-base sm:text-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl w-full sm:w-auto"
              >
                <span>{t("hero.join_waitlist")}</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>

              {/* Watch Demo button - commented out for now
              <Button
                className="group border-2 border-white text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full text-base sm:text-lg font-semibold hover:bg-white/10 transition-all duration-300 w-full sm:w-auto"
                variant="outline"
              >
                <Play className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>{t("hero.watch_demo")}</span>
              </Button>
              */}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
