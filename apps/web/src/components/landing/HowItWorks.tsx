"use client";

import { Target, Brain, TrendingUp, ArrowRight } from "lucide-react";
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
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-950/50",
    },
    {
      step: "02",
      icon: Brain,
      title: t("how_it_works.steps.get_motivation.title"),
      description: t("how_it_works.steps.get_motivation.description"),
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-950/50",
    },
    {
      step: "03",
      icon: TrendingUp,
      title: t("how_it_works.steps.track_progress.title"),
      description: t("how_it_works.steps.track_progress.description"),
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-950/50",
    },
  ];

  return (
    <section id="how-it-works" className="relative w-full py-4 sm:py-6 lg:py-8">
      <div className="mx-2 sm:mx-4 bg-card rounded-2xl sm:rounded-3xl">
        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="max-w-6xl mx-auto">
            <motion.div
              className="text-center mb-10 sm:mb-12 lg:mb-16"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 sm:mb-6">
                {t("how_it_works.title")}
              </h2>
              <p className="text-sm sm:text-base lg:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
                {t("how_it_works.subtitle")}
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-3 gap-6 sm:gap-8 lg:gap-12">
              {steps.map((step, index) => (
                <motion.div
                  key={step.step}
                  className="relative text-center"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.2 }}
                  viewport={{ once: true }}
                >
                  {/* Connection arrow - hidden on mobile, only between items */}
                  {index < steps.length - 1 && (
                    <div className="hidden sm:block absolute top-12 -right-4 lg:-right-6 z-10">
                      <ArrowRight className="h-6 w-6 lg:h-8 lg:w-8 text-muted-foreground/30" />
                    </div>
                  )}

                  <motion.div
                    className={`w-16 h-16 sm:w-18 sm:h-18 lg:w-20 lg:h-20 ${step.bgColor} ${step.color} rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6`}
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <step.icon className="h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10" />
                  </motion.div>

                  <div className="mb-2 sm:mb-4">
                    <span className="text-4xl sm:text-5xl lg:text-6xl font-bold text-muted-foreground/20">
                      {step.step}
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground mb-2 sm:mb-4">
                    {step.title}
                  </h3>

                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed px-2">
                    {step.description}
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
