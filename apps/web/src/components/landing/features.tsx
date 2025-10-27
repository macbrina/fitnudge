"use client";

import { useTranslation } from "@/lib/i18n";
import { motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  Brain,
  Shield,
  Star,
  Target,
  Users,
} from "lucide-react";

export function Features() {
  const { t } = useTranslation();

  const features = [
    {
      icon: Brain,
      title: t("features.ai.title"),
      description: t("features.ai.description"),
      color: "text-blue-500",
      bgColor: "bg-blue-50",
    },
    {
      icon: Target,
      title: t("features.goals.title"),
      description: t("features.goals.description"),
      color: "text-green-500",
      bgColor: "bg-green-50",
    },
    {
      icon: Bell,
      title: t("features.reminders.title"),
      description: t("features.reminders.description"),
      color: "text-purple-500",
      bgColor: "bg-purple-50",
    },
    {
      icon: BarChart3,
      title: t("features.analytics.title"),
      description: t("features.analytics.description"),
      color: "text-orange-500",
      bgColor: "bg-orange-50",
    },
    {
      icon: Users,
      title: t("features.community.title"),
      description: t("features.community.description"),
      color: "text-pink-500",
      bgColor: "bg-pink-50",
    },
    {
      icon: Shield,
      title: t("features.privacy.title"),
      description: t("features.privacy.description"),
      color: "text-indigo-500",
      bgColor: "bg-indigo-50",
    },
  ];

  return (
    <section className="relative w-full">
      {/* Background with padding like other sections */}
      <div className="absolute inset-4 bg-card rounded-3xl"></div>
      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <div className="max-w-7xl mx-auto">
          {/* Decorative star */}
          <div className="flex justify-end mb-8">
            <Star className="h-8 w-8 text-yellow-400" />
          </div>

          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-8 leading-tight">
              {t("features.title")}
            </h2>
            <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              {t("features.subtitle")}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-12">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="bg-background rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-border"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
              >
                <div
                  className={`w-16 h-16 ${feature.bgColor} rounded-full flex items-center justify-center mb-6`}
                >
                  <feature.icon className={`h-8 w-8 ${feature.color}`} />
                </div>

                <h3 className="text-xl font-bold text-foreground mb-4">
                  {feature.title}
                </h3>

                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
