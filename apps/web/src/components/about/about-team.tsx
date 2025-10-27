"use client";

import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { Github, Linkedin, Twitter } from "lucide-react";

export function AboutTeam() {
  const { t } = useTranslation();

  const team = [
    {
      name: t("about.team.founder.name"),
      role: t("about.team.founder.role"),
      bio: t("about.team.founder.bio"),
      image: "/team/founder.jpg",
      social: {
        twitter: "https://twitter.com/fitnudge",
        linkedin: "https://linkedin.com/company/fitnudge",
        github: "https://github.com/fitnudge",
      },
    },
    {
      name: t("about.team.cto.name"),
      role: t("about.team.cto.role"),
      bio: t("about.team.cto.bio"),
      image: "/team/cto.jpg",
      social: {
        twitter: "https://twitter.com/fitnudge",
        linkedin: "https://linkedin.com/company/fitnudge",
        github: "https://github.com/fitnudge",
      },
    },
    {
      name: t("about.team.designer.name"),
      role: t("about.team.designer.role"),
      bio: t("about.team.designer.bio"),
      image: "/team/designer.jpg",
      social: {
        twitter: "https://twitter.com/fitnudge",
        linkedin: "https://linkedin.com/company/fitnudge",
        github: "https://github.com/fitnudge",
      },
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
                {t("about.team.title")}
              </h2>
              <p className="text-xl text-blue-100 mb-12 max-w-3xl mx-auto">
                {t("about.team.subtitle")}
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {team.map((member, index) => (
                <motion.div
                  key={member.name}
                  className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 text-center"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.2 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -5 }}
                >
                  <div className="w-24 h-24 bg-white/20 rounded-full mx-auto mb-6 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">
                    {member.name}
                  </h3>
                  <p className="text-blue-100 mb-4">{member.role}</p>
                  <p className="text-blue-100/80 text-sm leading-relaxed mb-6">
                    {member.bio}
                  </p>

                  <div className="flex justify-center space-x-4">
                    <a
                      href={member.social.twitter}
                      className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                      <Twitter className="h-4 w-4 text-white" />
                    </a>
                    <a
                      href={member.social.linkedin}
                      className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                      <Linkedin className="h-4 w-4 text-white" />
                    </a>
                    <a
                      href={member.social.github}
                      className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                      <Github className="h-4 w-4 text-white" />
                    </a>
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
