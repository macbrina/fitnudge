"use client";

import Image from "next/image";
import { Apple, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@fitnudge/ui";

export function Download() {
  const { t } = useTranslation();

  return (
    <section id="download-section" className="relative min-h-screen w-full">
      <div className="absolute inset-4 bg-primary text-primary-foreground rounded-3xl">
        {/* Background decorative elements */}
        <div className="absolute inset-0">
          {/* Abstract geometric shapes */}
          <div className="absolute top-16 right-16 w-40 h-40 border-2 border-white/15 rounded-lg transform rotate-45"></div>
          <div className="absolute top-32 left-16 w-24 h-24 bg-white/10 rounded-full"></div>
          <div className="absolute bottom-32 right-1/3 w-32 h-32 border border-white/25 rounded-full"></div>
          <div className="absolute bottom-16 left-1/3 w-20 h-20 bg-white/5 rounded-lg transform rotate-12"></div>

          {/* Diagonal connecting lines */}
          <div className="absolute top-24 left-1/3 w-1 h-40 bg-white/20 transform rotate-45"></div>
          <div className="absolute top-48 right-1/4 w-1 h-32 bg-white/25 transform -rotate-30"></div>
          <div className="absolute bottom-24 left-1/2 w-1 h-28 bg-white/15 transform rotate-60"></div>
        </div>

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
                {t("download.title")}
              </h2>

              <p className="text-xl text-blue-100 mb-8 leading-relaxed">
                {t("download.description")}
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-4 rounded-full text-lg font-semibold">
                  <Apple className="h-6 w-6" />
                  <span>{t("download.app_store")}</span>
                </Button>

                <Button className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-4 rounded-full text-lg font-semibold">
                  <Smartphone className="h-6 w-6" />
                  <span>{t("download.google_play")}</span>
                </Button>
              </div>
            </motion.div>

            {/* Right side - Phone mockup */}
            <motion.div
              className="relative flex justify-center"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              {/* Download App Phone */}
              <motion.div
                className="relative w-64 h-[500px] bg-gray-900 rounded-3xl p-3 shadow-2xl"
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
                      alt="FitNudge Download App"
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
