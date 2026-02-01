"use client";

import Link from "next/link";
import { Facebook, Twitter, Instagram, Linkedin, Heart } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { ROUTES } from "@/lib/routes";
import { useAppConfig } from "@/store";
import Image from "next/image";

// TikTok icon component
function TikTok({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

export function Footer() {
  const { t } = useTranslation();
  const { config } = useAppConfig();

  const footerLinks = {
    about: [
      { name: t("footer.why_fitnudge"), href: ROUTES.WHY_FITNUDGE },
      { name: t("footer.about"), href: ROUTES.ABOUT },
      { name: t("footer.blog"), href: ROUTES.BLOG },
    ],
    help: [
      {
        name: t("footer.help_center"),
        href: config.help_center_url,
        external: true,
      },
      { name: t("footer.contact"), href: ROUTES.CONTACT },
      {
        name: t("footer.system_status"),
        href: ROUTES.HEALTH,
        external: true,
      },
    ],
    legal: [
      { name: t("footer.privacy"), href: ROUTES.PRIVACY },
      { name: t("footer.terms"), href: ROUTES.TERMS },
    ],
  };

  // Use dynamic social links from app_config store
  const socialLinks = [
    { name: "TikTok", href: config.social_tiktok, icon: TikTok },
    { name: "Instagram", href: config.social_instagram, icon: Instagram },
    { name: "Twitter", href: config.social_twitter, icon: Twitter },
    { name: "Facebook", href: config.social_facebook, icon: Facebook },
    { name: "LinkedIn", href: config.social_linkedin, icon: Linkedin },
  ];

  return (
    <footer className="bg-gray-900 text-white relative overflow-hidden">
      {/* Large F background - hidden on mobile */}
      {/* <div className="absolute top-0 right-0 text-[12rem] lg:text-[16rem] font-bold text-gray-800/10 -mt-12 -mr-8 hidden md:block select-none pointer-events-none">
        F
      </div> */}

      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto">
          {/* Main footer content */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
            {/* Logo and description */}
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center mb-4 sm:mb-6">
                <Image
                  src="/logo.png"
                  alt="FitNudge"
                  width={64}
                  height={64}
                  className="w-10 sm:w-12 h-auto"
                  unoptimized
                />
                <span className="text-lg sm:text-xl lg:text-2xl font-bold text-white">
                  FitNudge
                </span>
              </Link>
              <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-xs">
                {t("footer.description")}
              </p>
              {/* Social links - mobile and tablet */}
              <div className="flex items-center gap-3 md:hidden">
                {socialLinks.map((social) => (
                  <Link
                    key={social.name}
                    href={social.href}
                    className="w-10 h-10 bg-gray-800 hover:bg-primary rounded-full flex items-center justify-center transition-colors duration-200"
                    aria-label={social.name}
                  >
                    <social.icon className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            </div>

            {/* About */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold mb-4 sm:mb-6 text-white">
                {t("footer.about")}
              </h3>
              <ul className="space-y-2 sm:space-y-3">
                {footerLinks.about.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-gray-400 hover:text-white text-sm transition-colors duration-200"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Help */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold mb-4 sm:mb-6 text-white">
                {t("footer.support")}
              </h3>
              <ul className="space-y-2 sm:space-y-3">
                {footerLinks.help.map((link) =>
                  "external" in link && link.external ? (
                    <li key={link.name}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-white text-sm transition-colors duration-200"
                      >
                        {link.name}
                      </a>
                    </li>
                  ) : (
                    <li key={link.name}>
                      <Link
                        href={link.href}
                        className="text-gray-400 hover:text-white text-sm transition-colors duration-200"
                      >
                        {link.name}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold mb-4 sm:mb-6 text-white">
                {t("footer.legal")}
              </h3>
              <ul className="space-y-2 sm:space-y-3">
                {footerLinks.legal.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-gray-400 hover:text-white text-sm transition-colors duration-200"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom section */}
          <div className="border-t border-gray-800 mt-10 sm:mt-12 pt-6 sm:pt-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-gray-400 text-xs sm:text-sm text-center sm:text-left">
                © {new Date().getFullYear()} FitNudge. {t("footer.rights")}
              </div>

              {/* Social links - desktop */}
              <div className="hidden md:flex items-center gap-2">
                {socialLinks.map((social) => (
                  <Link
                    key={social.name}
                    href={social.href}
                    className="w-9 h-9 bg-gray-800 hover:bg-primary rounded-full flex items-center justify-center transition-colors duration-200"
                    aria-label={social.name}
                  >
                    <social.icon className="h-4 w-4" />
                  </Link>
                ))}
              </div>

              <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-400">
                <span>{t("footer.made_with")}</span>
                <Heart className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 fill-red-500" />
                <span>{t("footer.for_goal_achievers")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
