"use client";

import { motion } from "framer-motion";
import {
  Brain,
  Heart,
  Target,
  Sparkles,
  Users,
  Bell,
  TrendingUp,
  Shield,
  Zap,
  CheckCircle,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { LandingLayout } from "@/components/layout/LandingLayout";
import { Button } from "@fitnudge/ui";
import { useTranslation } from "@/lib/i18n";

export default function WhyFitNudgePage() {
  const { t } = useTranslation();

  const painPoints = [
    {
      icon: XCircle,
      problem: t("why_fitnudge.pain_points.motivation.problem"),
      solution: t("why_fitnudge.pain_points.motivation.solution"),
    },
    {
      icon: XCircle,
      problem: t("why_fitnudge.pain_points.tracking.problem"),
      solution: t("why_fitnudge.pain_points.tracking.solution"),
    },
    {
      icon: XCircle,
      problem: t("why_fitnudge.pain_points.accountability.problem"),
      solution: t("why_fitnudge.pain_points.accountability.solution"),
    },
    {
      icon: XCircle,
      problem: t("why_fitnudge.pain_points.generic.problem"),
      solution: t("why_fitnudge.pain_points.generic.solution"),
    },
  ];

  const differentiators = [
    {
      icon: Brain,
      title: t("why_fitnudge.differentiators.ai.title"),
      description: t("why_fitnudge.differentiators.ai.description"),
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-950/50",
    },
    {
      icon: Target,
      title: t("why_fitnudge.differentiators.any_goal.title"),
      description: t("why_fitnudge.differentiators.any_goal.description"),
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/50",
    },
    {
      icon: Users,
      title: t("why_fitnudge.differentiators.partners.title"),
      description: t("why_fitnudge.differentiators.partners.description"),
      color: "text-pink-500",
      bgColor: "bg-pink-50 dark:bg-pink-950/50",
    },
    {
      icon: Bell,
      title: t("why_fitnudge.differentiators.nudges.title"),
      description: t("why_fitnudge.differentiators.nudges.description"),
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950/50",
    },
    {
      icon: TrendingUp,
      title: t("why_fitnudge.differentiators.insights.title"),
      description: t("why_fitnudge.differentiators.insights.description"),
      color: "text-teal-500",
      bgColor: "bg-teal-50 dark:bg-teal-950/50",
    },
    {
      icon: Heart,
      title: t("why_fitnudge.differentiators.holistic.title"),
      description: t("why_fitnudge.differentiators.holistic.description"),
      color: "text-red-500",
      bgColor: "bg-red-50 dark:bg-red-950/50",
    },
  ];

  const benefits = [
    {
      icon: Zap,
      title: t("why_fitnudge.benefits.consistency.title"),
      description: t("why_fitnudge.benefits.consistency.description"),
    },
    {
      icon: Sparkles,
      title: t("why_fitnudge.benefits.motivation.title"),
      description: t("why_fitnudge.benefits.motivation.description"),
    },
    {
      icon: Shield,
      title: t("why_fitnudge.benefits.privacy.title"),
      description: t("why_fitnudge.benefits.privacy.description"),
    },
  ];

  return (
    <LandingLayout>
      {/* Hero Section */}
      <section className="relative w-full py-4 sm:py-6 lg:py-8">
        <div className="mx-2 sm:mx-4 bg-linear-to-br from-primary via-primary to-blue-700 rounded-2xl sm:rounded-3xl overflow-hidden">
          <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24 text-white">
            <div className="max-w-4xl mx-auto text-center">
              <motion.div
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur rounded-full mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t("why_fitnudge.badge")}
                </span>
              </motion.div>

              <motion.h1
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                {t("why_fitnudge.title")}
              </motion.h1>

              <motion.p
                className="text-lg sm:text-xl text-blue-100 max-w-2xl mx-auto mb-8"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                {t("why_fitnudge.subtitle")}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                <Button
                  onClick={() => {
                    window.location.href = "/#waitlist-section";
                  }}
                  className="bg-white text-primary hover:bg-blue-50 px-8 py-4 rounded-full text-lg font-semibold"
                  size="lg"
                >
                  {t("why_fitnudge.cta_button")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="relative w-full py-4 sm:py-6 lg:py-8">
        <div className="mx-2 sm:mx-4 bg-card rounded-2xl sm:rounded-3xl">
          <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="max-w-6xl mx-auto">
              <motion.div
                className="text-center mb-12"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
                  {t("why_fitnudge.pain_points.title")}
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  {t("why_fitnudge.pain_points.subtitle")}
                </p>
              </motion.div>

              <div className="grid md:grid-cols-2 gap-6">
                {painPoints.map((point, index) => (
                  <motion.div
                    key={index}
                    className="bg-background rounded-xl p-6 border border-border"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-10 h-10 bg-red-50 dark:bg-red-950/50 rounded-full flex items-center justify-center shrink-0">
                        <XCircle className="h-5 w-5 text-red-500" />
                      </div>
                      <p className="text-foreground font-medium">
                        {point.problem}
                      </p>
                    </div>
                    <div className="flex items-start gap-4 pl-14">
                      <div className="w-10 h-10 bg-green-50 dark:bg-green-950/50 rounded-full flex items-center justify-center shrink-0 -ml-14">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      </div>
                      <p className="text-muted-foreground">{point.solution}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Differentiators Section */}
      <section className="relative w-full py-4 sm:py-6 lg:py-8">
        <div className="mx-2 sm:mx-4 bg-secondary rounded-2xl sm:rounded-3xl">
          <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="max-w-6xl mx-auto">
              <motion.div
                className="text-center mb-12"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
                  {t("why_fitnudge.differentiators.title")}
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  {t("why_fitnudge.differentiators.subtitle")}
                </p>
              </motion.div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {differentiators.map((item, index) => (
                  <motion.div
                    key={item.title}
                    className="bg-background rounded-xl p-6 border border-border hover:shadow-md transition-all"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <div
                      className={`w-12 h-12 ${item.bgColor} rounded-xl flex items-center justify-center mb-4`}
                    >
                      <item.icon className={`h-6 w-6 ${item.color}`} />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative w-full py-4 sm:py-6 lg:py-8">
        <div className="mx-2 sm:mx-4 bg-card rounded-2xl sm:rounded-3xl">
          <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="max-w-6xl mx-auto">
              <motion.div
                className="text-center mb-12"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
                  {t("why_fitnudge.benefits.title")}
                </h2>
              </motion.div>

              <div className="grid md:grid-cols-3 gap-8">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={benefit.title}
                    className="text-center"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <benefit.icon className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-muted-foreground">
                      {benefit.description}
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
              {t("why_fitnudge.cta.title")}
            </motion.h2>
            <motion.p
              className="text-base sm:text-lg text-blue-100 mb-8 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
            >
              {t("why_fitnudge.cta.description")}
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
                {t("why_fitnudge.cta.button")}
              </Button>
            </motion.div>
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
