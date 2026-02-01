"use client";

import { useTranslation } from "@/lib/i18n";
import { motion } from "framer-motion";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { useTheme } from "@/store";

export function Wellness() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  // Cache busting: increment version when you update the images
  const imageVersion = "v2"; // Change this when you update mockup images
  const mockupImage =
    theme === "dark" 
      ? `/mockups/home-dark.png?${imageVersion}` 
      : `/mockups/home-light.png?${imageVersion}`;

  const highlights = [
    t("wellness.highlights.ai_messages"),
    t("wellness.highlights.smart_reminders"),
    t("wellness.highlights.daily_checkins"),
    t("wellness.highlights.streak_tracking"),
  ];

  return (
    <section className="relative w-full py-4 sm:py-6 lg:py-8">
      {/* Background with responsive padding */}
      <div className="mx-2 sm:mx-4 bg-card rounded-2xl sm:rounded-3xl">
        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
              {/* Left side - Phone mockup */}
              <motion.div
                className="relative order-2 lg:order-1 flex justify-center"
                initial={{ opacity: 0, x: -50 }}
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
                    alt="FitNudge AI Motivation App"
                    fill
                    className="object-contain drop-shadow-2xl"
                    priority
                  />
                </motion.div>
              </motion.div>

              {/* Right side - Content */}
              <motion.div
                className="text-foreground order-1 lg:order-2"
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 lg:mb-8 leading-tight">
                  {t("wellness.title")}
                </h2>

                <div className="space-y-4 sm:space-y-6 mb-6 sm:mb-8">
                  <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
                    {t("wellness.description1")}
                  </p>
                  <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
                    {t("wellness.description2")}
                  </p>
                </div>

                {/* Highlights list */}
                <ul className="space-y-3">
                  {highlights.map((item, index) => (
                    <motion.li
                      key={index}
                      className="flex items-center gap-3 text-sm sm:text-base text-foreground"
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      viewport={{ once: true }}
                    >
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      <span>{item}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
