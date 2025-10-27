"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@fitnudge/ui";

export function Tracker() {
  const { t } = useTranslation();

  return (
    <section className="relative min-h-screen w-full pt-24">
      <div className="absolute inset-4 bg-primary text-primary-foreground rounded-3xl">
        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 pt-24 pb-20 flex items-center justify-center min-h-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left side - Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">
                {t("tracker.title")}
              </h2>

              <p className="text-xl text-blue-100 mb-8 leading-relaxed">
                {t("tracker.description")}
              </p>

              <Button
                onClick={() => {
                  const downloadSection =
                    document.getElementById("download-section");
                  if (downloadSection) {
                    downloadSection.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="bg-white text-blue-600 hover:bg-blue-50 rounded-full px-8 py-4 text-lg font-semibold"
                size="lg"
              >
                <span>{t("tracker.cta")}</span>
                <ArrowRight className="h-5 w-5" />
              </Button>
            </motion.div>

            {/* Right side - Phone mockup */}
            <motion.div
              className="relative flex justify-center"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              {/* Dashboard Phone */}
              <motion.div
                className="relative w-64 h-[500px] bg-gray-900 rounded-4xl p-3 shadow-2xl"
                animate={{ y: [-10, 10, -10] }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <div className="w-full h-full bg-white rounded-3xl overflow-hidden">
                  <div className="relative w-full h-full">
                    <Image
                      src="/images/55941.jpg"
                      alt="FitNudge Progress Tracker"
                      fill
                      className="object-cover rounded-3xl"
                      priority
                    />
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
