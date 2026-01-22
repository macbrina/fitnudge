"use client";

import { motion } from "framer-motion";
import { Sparkles, Users, Bell, Gift } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "@/lib/i18n";

export function Waitlist() {
  const { t } = useTranslation();

  // Load Tally script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://tally.so/widgets/embed.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const benefits = [
    {
      icon: Gift,
      title: t("waitlist.benefits.early_access.title"),
      description: t("waitlist.benefits.early_access.description"),
    },
    {
      icon: Sparkles,
      title: t("waitlist.benefits.founder_pricing.title"),
      description: t("waitlist.benefits.founder_pricing.description"),
    },
    {
      icon: Bell,
      title: t("waitlist.benefits.launch_updates.title"),
      description: t("waitlist.benefits.launch_updates.description"),
    },
    {
      icon: Users,
      title: t("waitlist.benefits.shape_product.title"),
      description: t("waitlist.benefits.shape_product.description"),
    },
  ];

  return (
    <section
      id="waitlist-section"
      className="relative w-full py-4 sm:py-6 lg:py-8"
    >
      <div className="mx-2 sm:mx-4 bg-linear-to-br from-primary via-blue-600 to-purple-600 text-white rounded-2xl sm:rounded-3xl overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-10 left-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
          <div className="absolute bottom-10 right-10 w-48 h-48 bg-purple-400/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-blue-300/10 rounded-full blur-2xl"></div>
        </div>

        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              {/* Left side - Content */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
                  <Sparkles className="h-4 w-4 text-yellow-300" />
                  <span className="text-sm font-medium">
                    {t("waitlist.badge")}
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
                  {t("waitlist.title")}
                </h2>

                <p className="text-sm sm:text-base lg:text-lg text-blue-100 mb-8 leading-relaxed">
                  {t("waitlist.description")}
                </p>

                {/* Benefits grid */}
                <div className="grid grid-cols-2 gap-4 sm:gap-6">
                  {benefits.map((benefit, index) => (
                    <motion.div
                      key={benefit.title}
                      className="flex items-start gap-3"
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      viewport={{ once: true }}
                    >
                      <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <benefit.icon className="h-5 w-5 text-blue-200" />
                      </div>
                      <div>
                        <div className="font-semibold text-white text-sm sm:text-base">
                          {benefit.title}
                        </div>
                        <div className="text-xs sm:text-sm text-blue-200">
                          {benefit.description}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Right side - Tally Form */}
              <motion.div
                className="relative"
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl">
                  <div className="text-center mb-6">
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                      {t("waitlist.reserve_spot")}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {t("waitlist.social_proof")}
                    </p>
                  </div>

                  {/* Tally Form Embed - Replace YOUR_FORM_ID with actual Tally form ID */}
                  <iframe
                    data-tally-src="https://tally.so/embed/Zj2oze?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1"
                    loading="lazy"
                    width="100%"
                    height="300"
                    frameBorder="0"
                    marginHeight={0}
                    marginWidth={0}
                    title="Join FitNudge Waitlist"
                    className="rounded-lg"
                  ></iframe>

                  {/* Fallback for when Tally doesn't load */}
                  <noscript>
                    <a
                      href="https://tally.so/r/Zj2oze"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("waitlist.fallback_link")}
                    </a>
                  </noscript>

                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                      <svg
                        className="h-4 w-4 text-green-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>{t("waitlist.privacy_note")}</span>
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
