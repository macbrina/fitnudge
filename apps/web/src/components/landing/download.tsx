"use client";

import { useTranslation } from "@/lib/i18n";
import { motion } from "framer-motion";
import { Apple } from "lucide-react";

// Android icon component
function PlayStore({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 9.49l-2.302 2.302-8.634-8.635z" />
    </svg>
  );
}

export function Download() {
  const { t } = useTranslation();

  return (
    <section id="download" className="relative w-full py-4 sm:py-6 lg:py-8">
      <div className="mx-2 sm:mx-4 bg-primary text-white rounded-2xl sm:rounded-3xl overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 hidden sm:block overflow-hidden">
          <div className="absolute top-10 right-10 w-32 h-32 border border-white/10 rounded-full"></div>
          <div className="absolute bottom-10 left-10 w-24 h-24 border border-white/10 rounded-full"></div>
          <div className="absolute top-1/2 right-1/4 w-16 h-16 border border-white/10 rounded-full"></div>
        </div>

        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              {/* Content */}
              <motion.div
                className="text-center lg:text-left order-2 lg:order-1"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
                  {t("download.title")}
                </h2>
                <p className="text-sm sm:text-base lg:text-xl text-blue-100 mb-8 sm:mb-10 leading-relaxed max-w-xl mx-auto lg:mx-0">
                  {t("download.description")}
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  {/* App Store Button */}
                  <motion.div
                    className="flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-5 py-3 sm:px-6 sm:py-4 hover:bg-white/20 transition-all cursor-pointer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Apple className="h-8 w-8 sm:h-10 sm:w-10" />
                    <div className="text-left">
                      <div className="text-xs text-blue-100">
                        {t("download.coming_soon")}
                      </div>
                      <div className="text-sm sm:text-lg font-semibold">
                        {t("download.app_store")}
                      </div>
                    </div>
                  </motion.div>

                  {/* Google Play Button */}
                  <motion.div
                    className="flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-5 py-3 sm:px-6 sm:py-4 hover:bg-white/20 transition-all cursor-pointer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <PlayStore className="h-8 w-8 sm:h-10 sm:w-10" />
                    <div className="text-left">
                      <div className="text-xs text-blue-100">
                        {t("download.coming_soon")}
                      </div>
                      <div className="text-sm sm:text-lg font-semibold">
                        {t("download.google_play")}
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>

              {/* Phone Mockup */}
              <motion.div
                className="flex justify-center order-1 lg:order-2"
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <div className="relative w-48 h-96 sm:w-56 sm:h-[28rem] lg:w-64 lg:h-[32rem]">
                  {/* Phone frame */}
                  <div className="absolute inset-0 bg-gray-900 rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl">
                    {/* Screen */}
                    <div className="absolute inset-2 sm:inset-3 bg-gradient-to-b from-blue-600 to-blue-800 rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden">
                      {/* Status bar */}
                      <div className="h-6 sm:h-8 bg-black/20 flex items-center justify-center">
                        <div className="w-16 sm:w-20 h-4 sm:h-5 bg-black rounded-full"></div>
                      </div>
                      {/* App content mockup */}
                      <div className="p-3 sm:p-4">
                        <div className="text-center mb-4 sm:mb-6">
                          <div className="text-xs sm:text-sm text-blue-100 mb-1">
                            {t("download.phone_mockup.greeting")}
                          </div>
                          <div className="text-sm sm:text-lg font-bold">
                            {t("download.phone_mockup.ready")}
                          </div>
                        </div>
                        <div className="space-y-2 sm:space-y-3">
                          <div className="bg-white/10 backdrop-blur rounded-lg sm:rounded-xl p-2 sm:p-3">
                            <div className="text-xs text-blue-100">
                              {t("download.phone_mockup.current_streak")}
                            </div>
                            <div className="text-lg sm:text-xl font-bold">
                              {t("download.phone_mockup.streak_days")}
                            </div>
                          </div>
                          <div className="bg-white/10 backdrop-blur rounded-lg sm:rounded-xl p-2 sm:p-3">
                            <div className="text-xs text-blue-100">
                              {t("download.phone_mockup.todays_goal")}
                            </div>
                            <div className="text-sm sm:text-base font-medium">
                              {t("download.phone_mockup.morning_workout")}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
