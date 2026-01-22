"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  Brain,
  Flame,
  MessageSquare,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@fitnudge/ui";
import { ROUTES } from "@/lib/routes";
import { useTranslation } from "@/lib/i18n";

export function Features() {
  const { t } = useTranslation();

  const features = [
    {
      icon: Brain,
      title: t("features.ai.title"),
      description: t("features.ai.description"),
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/50",
    },
    {
      icon: Target,
      title: t("features.goals.title"),
      description: t("features.goals.description"),
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950/50",
    },
    {
      icon: Bell,
      title: t("features.reminders.title"),
      description: t("features.reminders.description"),
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-950/50",
    },
    {
      icon: Flame,
      title: t("features.streaks.title"),
      description: t("features.streaks.description"),
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950/50",
    },
    {
      icon: Users,
      title: t("features.partners.title"),
      description: t("features.partners.description"),
      color: "text-pink-500",
      bgColor: "bg-pink-50 dark:bg-pink-950/50",
    },
    {
      icon: MessageSquare,
      title: t("features.coach.title"),
      description: t("features.coach.description"),
      color: "text-indigo-500",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/50",
    },
  ];

  return (
    <section id="features" className="relative w-full py-4 sm:py-6 lg:py-8">
      {/* Background with responsive padding */}
      <div className="mx-2 sm:mx-4 bg-card rounded-2xl sm:rounded-3xl">
        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="max-w-7xl mx-auto">
            <motion.div
              className="text-center mb-10 sm:mb-12 lg:mb-16"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 sm:mb-6 leading-tight">
                Everything You Need to Stay Consistent
              </h2>
              <p className="text-sm sm:text-base lg:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
                FitNudge is packed with features designed to keep you
                accountable and motivated on your journey.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  className="bg-background rounded-xl sm:rounded-2xl p-5 sm:p-6 lg:p-8 shadow-md hover:shadow-lg transition-all duration-300 border border-border"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -4 }}
                >
                  <div
                    className={`w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 ${feature.bgColor} rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-5 lg:mb-6`}
                  >
                    <feature.icon
                      className={`h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 ${feature.color}`}
                    />
                  </div>

                  <h3 className="text-base sm:text-lg lg:text-xl font-bold text-foreground mb-2 sm:mb-3 lg:mb-4">
                    {feature.title}
                  </h3>

                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* View All Features Link */}
            <motion.div
              className="text-center mt-10 sm:mt-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              viewport={{ once: true }}
            >
              <Link href={ROUTES.FEATURES}>
                <Button
                  variant="outline"
                  className="group border-primary text-primary hover:bg-primary hover:text-white px-6 sm:px-8 py-3 rounded-full text-base font-semibold"
                >
                  <span>{t("features.view_all")}</span>
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
