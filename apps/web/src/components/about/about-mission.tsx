"use client";

import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { Target, Brain, Heart } from "lucide-react";

export function AboutMission() {
  const { t } = useTranslation();

  const missionPoints = [
    {
      icon: Target,
      title: t("about.mission.points.consistency.title"),
      description: t("about.mission.points.consistency.description"),
    },
    {
      icon: Brain,
      title: t("about.mission.points.ai.title"),
      description: t("about.mission.points.ai.description"),
    },
    {
      icon: Heart,
      title: t("about.mission.points.community.title"),
      description: t("about.mission.points.community.description"),
    },
  ];

  return (
    <section className="relative min-h-screen w-full">
      {/* Background with padding like other sections */}
      <div className="absolute inset-4 bg-primary text-primary-foreground rounded-3xl">
        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 pt-24 pb-20">
          <div className="max-w-7xl mx-auto">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-8 leading-tight">
                {t("about.mission.title")}
              </h2>
              <p className="text-xl text-blue-100 mb-12 max-w-3xl mx-auto">
                {t("about.mission.subtitle")}
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {missionPoints.map((point, index) => (
                <motion.div
                  key={point.title}
                  className="text-center"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.2 }}
                  viewport={{ once: true }}
                >
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <point.icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">
                    {point.title}
                  </h3>
                  <p className="text-blue-100 leading-relaxed">
                    {point.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
