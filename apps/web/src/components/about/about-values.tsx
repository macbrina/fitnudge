"use client";

import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { Shield, Users, Lightbulb, Heart } from "lucide-react";

export function AboutValues() {
  const { t } = useTranslation();

  const values = [
    {
      icon: Shield,
      title: t("about.values.privacy.title"),
      description: t("about.values.privacy.description"),
      color: "text-blue-500",
      bgColor: "bg-blue-50",
    },
    {
      icon: Users,
      title: t("about.values.community.title"),
      description: t("about.values.community.description"),
      color: "text-green-500",
      bgColor: "bg-green-50",
    },
    {
      icon: Lightbulb,
      title: t("about.values.innovation.title"),
      description: t("about.values.innovation.description"),
      color: "text-purple-500",
      bgColor: "bg-purple-50",
    },
    {
      icon: Heart,
      title: t("about.values.empathy.title"),
      description: t("about.values.empathy.description"),
      color: "text-pink-500",
      bgColor: "bg-pink-50",
    },
  ];

  return (
    <section className="relative min-h-screen w-full">
      {/* Background with padding like other sections */}
      <div className="absolute inset-4 bg-card rounded-3xl"></div>
      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-8 leading-tight">
              {t("about.values.title")}
            </h2>
            <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto">
              {t("about.values.subtitle")}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                className="bg-background rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-border"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
              >
                <div
                  className={`w-16 h-16 ${value.bgColor} rounded-full flex items-center justify-center mb-6`}
                >
                  <value.icon className={`h-8 w-8 ${value.color}`} />
                </div>

                <h3 className="text-xl font-bold text-foreground mb-4">
                  {value.title}
                </h3>

                <p className="text-muted-foreground leading-relaxed">
                  {value.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
