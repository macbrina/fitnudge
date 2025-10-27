"use client";

import { Target, Brain, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n";

export function HowItWorks() {
  const { t } = useTranslation();

  const steps = [
    {
      step: "01",
      icon: Target,
      title: t("how_it_works.steps.set_goal.title"),
      description: t("how_it_works.steps.set_goal.description"),
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      step: "02",
      icon: Brain,
      title: t("how_it_works.steps.get_motivation.title"),
      description: t("how_it_works.steps.get_motivation.description"),
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      step: "03",
      icon: TrendingUp,
      title: t("how_it_works.steps.track_progress.title"),
      description: t("how_it_works.steps.track_progress.description"),
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
  ];

  return (
    <section className="relative min-h-screen w-full">
      <div className="absolute inset-4 bg-card rounded-3xl">
        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 pt-24 pb-20 flex flex-col items-center justify-center min-h-full">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              {t("how_it_works.title")}
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              {t("how_it_works.subtitle")}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.step}
                className="text-center"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                viewport={{ once: true }}
              >
                <motion.div
                  className={`w-20 h-20 ${step.bgColor} ${step.color} rounded-full flex items-center justify-center mx-auto mb-6`}
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                >
                  <step.icon className="h-10 w-10" />
                </motion.div>

                <div className="mb-4">
                  <span className="text-6xl font-bold text-gray-200">
                    {step.step}
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-foreground mb-4">
                  {step.title}
                </h3>

                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
