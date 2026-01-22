"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { ThemeToggle, LanguageSelector } from "../ui";
import { Button, cn } from "@fitnudge/ui";
import { ROUTES } from "@/lib/routes";
import { usePathname } from "next/navigation";
import Image from "next/image";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === ROUTES.HOME;

  const navigation = [
    { name: t("nav.why_fitnudge"), href: ROUTES.WHY_FITNUDGE },
    { name: t("nav.features"), href: ROUTES.FEATURES },
    { name: t("nav.how_it_works"), href: ROUTES.HOW_IT_WORKS },
    { name: t("nav.blog"), href: ROUTES.BLOG },
    { name: t("nav.contact"), href: ROUTES.CONTACT },
  ];

  const scrollToWaitlist = () => {
    const waitlistSection = document.getElementById("waitlist-section");
    if (waitlistSection) {
      waitlistSection.scrollIntoView({ behavior: "smooth" });
    } else {
      // If not on home page, navigate to home with anchor
      router.push("/#waitlist-section");
    }
  };

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300",
          isHome ? "bg-primary/95 backdrop-blur-sm" : "bg-primary"
        )}
      >
        <div className="w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <Link href="/" className="flex items-center">
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

            <nav className="hidden lg:flex items-center space-x-6 xl:space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-white/90 hover:text-white transition-colors text-sm xl:text-base font-medium"
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex items-center space-x-1">
                <LanguageSelector variant="light" />
                <ThemeToggle />
              </div>
              <Button
                onClick={scrollToWaitlist}
                className="bg-white text-blue-600 hover:bg-blue-50 rounded-full px-4 sm:px-6 py-2 font-semibold text-xs sm:text-sm"
                size="sm"
              >
                <span className="hidden sm:inline">
                  {t("nav.join_waitlist")}
                </span>
                <span className="sm:hidden">{t("nav.join")}</span>
              </Button>
              {/* Mobile menu button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="lg:hidden p-2 rounded-lg text-white hover:bg-white/10"
                aria-label={t("nav.toggle_menu")}
              >
                {isMenuOpen ? (
                  <X className="h-5 w-5 sm:h-6 sm:w-6" />
                ) : (
                  <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Overlay - Outside header */}
      {isMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-55"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Mobile Navigation - Slide from left - Outside header */}
      <div
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-60 w-72 bg-primary transform transition-transform duration-300 ease-in-out shadow-2xl",
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full p-6">
          {/* Close button */}
          <div className="flex justify-between items-center mb-8">
            <Link
              href="/"
              className="flex items-center"
              onClick={() => setIsMenuOpen(false)}
            >
              <Image
                src="/logo.png"
                alt="FitNudge"
                width={64}
                height={64}
                className="w-10 h-auto"
                unoptimized
              />
              <span className="text-lg font-bold text-white">FitNudge</span>
            </Link>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="p-2 rounded-lg text-white hover:bg-white/10"
              aria-label={t("nav.close_menu")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation links */}
          <nav className="flex flex-col space-y-2 flex-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-white hover:bg-white/10 transition-colors py-3 px-4 rounded-xl text-base font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Bottom section */}
          <div className="border-t border-white/10 pt-6 space-y-4">
            <div className="flex items-center justify-between px-4">
              <span className="text-white/80 text-sm">{t("nav.language")}</span>
              <LanguageSelector variant="light" />
            </div>
            <div className="flex items-center justify-between px-4">
              <span className="text-white/80 text-sm">{t("nav.theme")}</span>
              <ThemeToggle />
            </div>
            <Button
              onClick={() => {
                scrollToWaitlist();
                setIsMenuOpen(false);
              }}
              className="w-full bg-white text-blue-600 hover:bg-blue-50 rounded-full px-6 py-3 font-semibold"
              size="lg"
            >
              <span>{t("nav.join_waitlist")}</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
