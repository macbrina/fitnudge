"use client";

import Link from "next/link";
import { Facebook, Twitter, Instagram, Linkedin } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { ROUTES } from "@/lib/routes";

export function Footer() {
  const { t } = useTranslation();

  const footerLinks = {
    about: [
      { name: t("footer.why_fitnudge"), href: ROUTES.WHY_FITNUDGE },
      { name: t("footer.about"), href: ROUTES.ABOUT },
      { name: t("footer.blog"), href: ROUTES.BLOG },
    ],
    help: [
      { name: t("footer.faqs"), href: ROUTES.FAQS },
      { name: t("footer.contact"), href: ROUTES.CONTACT },
    ],
    legal: [
      { name: t("footer.privacy"), href: ROUTES.PRIVACY },
      { name: t("footer.terms"), href: ROUTES.TERMS },
      { name: t("footer.cookies"), href: ROUTES.COOKIES },
    ],
  };

  return (
    <footer className="bg-gray-900 text-white py-16 relative overflow-hidden">
      {/* Large F background */}
      <div className="absolute top-0 right-0 text-9xl font-bold text-gray-800 opacity-10 -mt-8 -mr-8">
        F
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-4 gap-12">
          {/* Logo */}
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-3 mb-8">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">
                  F
                </span>
              </div>
              <span className="text-2xl font-bold text-primary-foreground">
                FitNudge
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              {t("footer.description")}
            </p>
          </div>

          {/* About */}
          <div>
            <h3 className="text-lg font-semibold mb-6">{t("footer.about")}</h3>
            <ul className="space-y-3">
              {footerLinks.about.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-primary-foreground transition-colors duration-200"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help */}
          <div>
            <h3 className="text-lg font-semibold mb-6">
              {t("footer.support")}
            </h3>
            <ul className="space-y-3">
              {footerLinks.help.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-primary-foreground transition-colors duration-200"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-primary-foreground transition-colors duration-200"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom section */}
        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-muted-foreground text-sm mb-4 md:mb-0">
              © {new Date().getFullYear()} FitNudge. {t("footer.rights")}
            </div>

            <div className="flex items-center space-x-4">
              <Link
                href={ROUTES.FACEBOOK}
                className="text-muted-foreground hover:text-primary-foreground transition-colors duration-200"
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </Link>
              <Link
                href={ROUTES.TWITTER}
                className="text-muted-foreground hover:text-primary-foreground transition-colors duration-200"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </Link>
              <Link
                href={ROUTES.INSTAGRAM}
                className="text-muted-foreground hover:text-primary-foreground transition-colors duration-200"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </Link>
              <Link
                href={ROUTES.LINKEDIN}
                className="text-muted-foreground hover:text-primary-foreground transition-colors duration-200"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
