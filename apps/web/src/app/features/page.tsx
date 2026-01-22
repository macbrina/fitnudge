"use client";

import { motion } from "framer-motion";
import {
  Target,
  Brain,
  Bell,
  Flame,
  Users,
  MessageSquare,
  Calendar,
  Trophy,
  Shield,
  TrendingUp,
  Mic,
  BarChart3,
  Zap,
  Sparkles,
  Check,
} from "lucide-react";
import { LandingLayout } from "@/components/layout/LandingLayout";
import { Button } from "@fitnudge/ui";
import { useTranslation } from "@/lib/i18n";

export default function FeaturesPage() {
  const { t } = useTranslation();

  const freeFeatures = [
    {
      icon: Target,
      title: t("features_page.free_features.goals.title"),
      description: t("features_page.free_features.goals.description"),
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/50",
    },
    {
      icon: Brain,
      title: t("features_page.free_features.checkins.title"),
      description: t("features_page.free_features.checkins.description"),
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-950/50",
    },
    {
      icon: Flame,
      title: t("features_page.free_features.streaks.title"),
      description: t("features_page.free_features.streaks.description"),
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950/50",
    },
    {
      icon: Bell,
      title: t("features_page.free_features.motivation.title"),
      description: t("features_page.free_features.motivation.description"),
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950/50",
    },
    {
      icon: TrendingUp,
      title: t("features_page.free_features.stats.title"),
      description: t("features_page.free_features.stats.description"),
      color: "text-teal-500",
      bgColor: "bg-teal-50 dark:bg-teal-950/50",
    },
    {
      icon: Users,
      title: t("features_page.free_features.partner.title"),
      description: t("features_page.free_features.partner.description"),
      color: "text-pink-500",
      bgColor: "bg-pink-50 dark:bg-pink-950/50",
    },
  ];

  const premiumFeatures = [
    {
      icon: Sparkles,
      title: t("features_page.premium_features.goals.title"),
      description: t("features_page.premium_features.goals.description"),
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/50",
    },
    {
      icon: MessageSquare,
      title: t("features_page.premium_features.coach.title"),
      description: t("features_page.premium_features.coach.description"),
      color: "text-indigo-500",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/50",
    },
    {
      icon: Calendar,
      title: t("features_page.premium_features.recaps.title"),
      description: t("features_page.premium_features.recaps.description"),
      color: "text-cyan-500",
      bgColor: "bg-cyan-50 dark:bg-cyan-950/50",
    },
    {
      icon: BarChart3,
      title: t("features_page.premium_features.analytics.title"),
      description: t("features_page.premium_features.analytics.description"),
      color: "text-yellow-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-950/50",
    },
    {
      icon: Zap,
      title: t("features_page.premium_features.patterns.title"),
      description: t("features_page.premium_features.patterns.description"),
      color: "text-amber-500",
      bgColor: "bg-amber-50 dark:bg-amber-950/50",
    },
    {
      icon: Bell,
      title: t("features_page.premium_features.nudging.title"),
      description: t("features_page.premium_features.nudging.description"),
      color: "text-red-500",
      bgColor: "bg-red-50 dark:bg-red-950/50",
    },
    {
      icon: Mic,
      title: t("features_page.premium_features.voice.title"),
      description: t("features_page.premium_features.voice.description"),
      color: "text-violet-500",
      bgColor: "bg-violet-50 dark:bg-violet-950/50",
    },
    {
      icon: Users,
      title: t("features_page.premium_features.partners.title"),
      description: t("features_page.premium_features.partners.description"),
      color: "text-pink-500",
      bgColor: "bg-pink-50 dark:bg-pink-950/50",
    },
    {
      icon: Bell,
      title: t("features_page.premium_features.reminders.title"),
      description: t("features_page.premium_features.reminders.description"),
      color: "text-emerald-500",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
    },
    {
      icon: Shield,
      title: t("features_page.premium_features.ad_free.title"),
      description: t("features_page.premium_features.ad_free.description"),
      color: "text-slate-500",
      bgColor: "bg-slate-50 dark:bg-slate-950/50",
    },
    {
      icon: Trophy,
      title: t("features_page.premium_features.support.title"),
      description: t("features_page.premium_features.support.description"),
      color: "text-gold-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-950/50",
    },
  ];

  return (
    <LandingLayout>
      {/* Hero Section */}
      <section className="relative w-full py-4 sm:py-6 lg:py-8">
        <div className="mx-2 sm:mx-4 bg-primary rounded-2xl sm:rounded-3xl overflow-hidden">
          <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 text-white">
            <div className="max-w-4xl mx-auto text-center">
              <motion.h1
                className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                {t("features_page.title")}
              </motion.h1>
              <motion.p
                className="text-base sm:text-lg text-blue-100 max-w-2xl mx-auto"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                {t("features_page.subtitle")}
              </motion.p>
            </div>
          </div>
        </div>
      </section>

      {/* Free Tier Features */}
      <section className="relative w-full py-4 sm:py-6 lg:py-8">
        <div className="mx-2 sm:mx-4 bg-card rounded-2xl sm:rounded-3xl">
          <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="max-w-6xl mx-auto">
              <motion.div
                className="flex items-center gap-3 mb-8"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="w-10 h-10 bg-green-100 dark:bg-green-950/50 rounded-xl flex items-center justify-center">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {t("features_page.free_tier")}
                </h2>
                <span className="px-3 py-1 bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400 text-sm font-medium rounded-full">
                  {t("features_page.free_price")}
                </span>
              </motion.div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {freeFeatures.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    className="bg-background rounded-xl p-5 sm:p-6 border border-border hover:shadow-md transition-all"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <div
                      className={`w-12 h-12 ${feature.bgColor} rounded-xl flex items-center justify-center mb-4`}
                    >
                      <feature.icon className={`h-6 w-6 ${feature.color}`} />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Premium Tier Features */}
      <section className="relative w-full py-4 sm:py-6 lg:py-8">
        <div className="mx-2 sm:mx-4 bg-secondary rounded-2xl sm:rounded-3xl">
          <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="max-w-6xl mx-auto">
              <motion.div
                className="flex items-center gap-3 mb-8"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {t("features_page.premium_tier")}
                </h2>
                <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full">
                  {t("features_page.premium_price")}
                </span>
              </motion.div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {premiumFeatures.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    className="bg-background rounded-xl p-5 sm:p-6 border border-border hover:shadow-md transition-all relative"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                    viewport={{ once: true }}
                  >
                    <div
                      className={`w-12 h-12 ${feature.bgColor} rounded-xl flex items-center justify-center mb-4`}
                    >
                      <feature.icon className={`h-6 w-6 ${feature.color}`} />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative w-full py-4 sm:py-6 lg:py-8">
        <div className="mx-2 sm:mx-4 bg-primary rounded-2xl sm:rounded-3xl overflow-hidden">
          <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16 text-white text-center">
            <motion.h2
              className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              {t("features_page.cta.title")}
            </motion.h2>
            <motion.p
              className="text-base sm:text-lg text-blue-100 mb-8 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
            >
              {t("features_page.cta.description")}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              viewport={{ once: true }}
            >
              <Button
                onClick={() => {
                  window.location.href = "/#waitlist-section";
                }}
                className="bg-white text-primary hover:bg-blue-50 px-8 py-4 rounded-full text-lg font-semibold"
                size="lg"
              >
                {t("features_page.cta.button")}
              </Button>
            </motion.div>
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
