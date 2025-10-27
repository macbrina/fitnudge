"use client";

import { useTranslation } from "@/lib/i18n";
import { motion } from "framer-motion";
import Image from "next/image";

export function Wellness() {
  const { t } = useTranslation();

  return (
    <section className="relative min-h-screen w-full">
      {/* Background with padding like hero */}
      <div className="absolute inset-4 bg-card rounded-3xl"></div>
      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 pt-24 pb-20 flex items-center justify-center min-h-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center w-full">
          {/* Left side - Phone mockups */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            {/* Body Composition Phone */}
            <motion.div
              className="relative w-64 h-[500px] bg-gray-900 rounded-4xl p-3 shadow-2xl mx-auto"
              animate={{ y: [-10, 10, -10] }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <div className="w-full h-full bg-white dark:bg-gray-900 rounded-3xl overflow-hidden">
                <div className="relative w-full h-full">
                  <Image
                    src="/iphone-mockup1.png"
                    alt="FitNudge AI Motivation App"
                    fill
                    className="object-cover rounded-3xl"
                    priority
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right side - Content */}
          <motion.div
            className="text-foreground"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">
              {t("wellness.title")}
            </h2>

            <div className="space-y-6 mb-8">
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t("wellness.description1")}
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t("wellness.description2")}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
