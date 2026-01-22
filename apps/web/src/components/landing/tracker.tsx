"use client";

import Image from "next/image";
import { ArrowRight, TrendingUp, Calendar, Award } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@fitnudge/ui";
import { useTheme } from "@/store";

export function Tracker() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const mockupImage =
    theme === "dark"
      ? "/mockups/analytics-dark.png"
      : "/mockups/analytics-light.png";

  const stats = [
    { icon: TrendingUp, label: t("tracker.stats.track_progress") },
    { icon: Calendar, label: t("tracker.stats.daily_checkins") },
    { icon: Award, label: t("tracker.stats.achievements") },
  ];

  return (
    <section className="relative w-full py-4 sm:py-6 lg:py-8">
      <div className="mx-2 sm:mx-4 bg-primary text-primary-foreground rounded-2xl sm:rounded-3xl overflow-hidden">
        {/* Background decorative elements - hidden on mobile */}
        <div className="absolute inset-0 hidden md:block overflow-hidden">
          <div className="absolute top-20 right-20 w-32 h-32 border border-white/10 rounded-full"></div>
          <div className="absolute bottom-20 left-20 w-24 h-24 border border-white/10 rounded-full"></div>
        </div>

        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
              {/* Left side - Content */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 lg:mb-8 leading-tight">
                  {t("tracker.title")}
                </h2>

                <p className="text-sm sm:text-base lg:text-xl text-blue-100 mb-6 sm:mb-8 leading-relaxed">
                  {t("tracker.description")}
                </p>

                {/* Stats cards */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
                  {stats.map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      className="bg-white/10 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 text-center"
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      viewport={{ once: true }}
                    >
                      <stat.icon className="h-5 w-5 sm:h-6 sm:w-6 mx-auto mb-1 sm:mb-2 text-blue-200" />
                      <div className="text-xs sm:text-sm font-medium text-white">
                        {stat.label}
                      </div>
                    </motion.div>
                  ))}
                </div>

                <Button
                  onClick={() => {
                    const waitlistSection =
                      document.getElementById("waitlist-section");
                    if (waitlistSection) {
                      waitlistSection.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                  className="bg-white text-blue-600 hover:bg-blue-50 rounded-full px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-lg font-semibold w-full sm:w-auto"
                  size="lg"
                >
                  <span>{t("tracker.join_waitlist")}</span>
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </motion.div>

              {/* Right side - Phone mockup */}
              <motion.div
                className="relative flex justify-center order-first lg:order-last"
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <motion.div
                  className="relative w-48 sm:w-56 md:w-64 h-[380px] sm:h-[440px] md:h-[500px]"
                  animate={{ y: [-8, 8, -8] }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <Image
                    src={mockupImage}
                    alt="FitNudge Progress Tracker"
                    fill
                    className="object-contain drop-shadow-2xl"
                    priority
                  />
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
