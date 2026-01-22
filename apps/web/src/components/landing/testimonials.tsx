"use client";

import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function Testimonials() {
  const { t } = useTranslation();

  const testimonials = [
    {
      name: t("testimonials.items.sarah.name"),
      role: t("testimonials.items.sarah.role"),
      avatar: "S",
      avatarBg: "bg-blue-500",
      content: t("testimonials.items.sarah.content"),
      rating: 5,
    },
    {
      name: t("testimonials.items.david.name"),
      role: t("testimonials.items.david.role"),
      avatar: "D",
      avatarBg: "bg-green-500",
      content: t("testimonials.items.david.content"),
      rating: 5,
    },
    {
      name: t("testimonials.items.emily.name"),
      role: t("testimonials.items.emily.role"),
      avatar: "E",
      avatarBg: "bg-orange-500",
      content: t("testimonials.items.emily.content"),
      rating: 5,
    },
    {
      name: t("testimonials.items.alex.name"),
      role: t("testimonials.items.alex.role"),
      avatar: "A",
      avatarBg: "bg-purple-500",
      content: t("testimonials.items.alex.content"),
      rating: 5,
    },
    {
      name: t("testimonials.items.jessica.name"),
      role: t("testimonials.items.jessica.role"),
      avatar: "J",
      avatarBg: "bg-pink-500",
      content: t("testimonials.items.jessica.content"),
      rating: 5,
    },
    {
      name: t("testimonials.items.michael.name"),
      role: t("testimonials.items.michael.role"),
      avatar: "M",
      avatarBg: "bg-teal-500",
      content: t("testimonials.items.michael.content"),
      rating: 5,
    },
  ];

  const stats = [
    { value: "50K+", label: t("testimonials.stats.active_users") },
    { value: "4.9", label: t("testimonials.stats.app_rating") },
    { value: "92%", label: t("testimonials.stats.consistency_rate") },
    { value: "2M+", label: t("testimonials.stats.check_ins") },
  ];

  return (
    <section className="relative w-full py-4 sm:py-6 lg:py-8">
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
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 sm:mb-6">
                {t("testimonials.title")}
              </h2>
              <p className="text-sm sm:text-base lg:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
                {t("testimonials.subtitle")}
              </p>
            </motion.div>

            {/* Stats */}
            <motion.div
              className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12 sm:mb-16"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
            >
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="text-center p-4 sm:p-6 bg-background rounded-xl sm:rounded-2xl border border-border"
                >
                  <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary mb-1 sm:mb-2">
                    {stat.value}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Testimonials Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={testimonial.name}
                  className="bg-background rounded-xl sm:rounded-2xl p-5 sm:p-6 border border-border shadow-sm hover:shadow-md transition-all"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Quote className="h-6 w-6 sm:h-8 sm:w-8 text-primary/20 mb-3 sm:mb-4" />
                  <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 leading-relaxed">
                    &quot;{testimonial.content}&quot;
                  </p>
                  <div className="flex items-center gap-1 mb-3 sm:mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 sm:w-12 sm:h-12 ${testimonial.avatarBg} rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base`}
                    >
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground text-sm sm:text-base">
                        {testimonial.name}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {testimonial.role}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
