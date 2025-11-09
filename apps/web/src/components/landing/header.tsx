"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { ThemeToggle } from "../ui";
import { Button, cn } from "@fitnudge/ui";
import { ROUTES } from "@/lib/routes";
import { usePathname } from "next/navigation";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t } = useTranslation();
  const pathname = usePathname();
  const isHome = pathname === ROUTES.HOME;

  const navigation = [
    { name: t("nav.features"), href: ROUTES.FEATURES },
    { name: t("nav.how_it_works"), href: ROUTES.HOW_IT_WORKS },
    { name: t("nav.blog"), href: ROUTES.BLOG },
    { name: t("nav.contact"), href: ROUTES.CONTACT },
  ];

  return (
    <header
      className={cn(
        "absolute top-0 left-0 right-0 z-30 w-full",
        !isHome && "bg-primary"
      )}
    >
      <div className="w-full px-8 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-lg flex items-center justify-center">
              <span className="text-primary font-bold text-sm sm:text-lg">
                F
              </span>
            </div>
            <span className="text-xl sm:text-2xl font-bold text-white">
              FitNudge
            </span>
          </div>

          <nav className="hidden md:flex items-center space-x-6 lg:space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-white hover:text-blue-200 transition-colors text-sm lg:text-base"
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <ThemeToggle />
            <Button
              onClick={() => {
                const downloadSection =
                  document.getElementById("download-section");
                if (downloadSection) {
                  downloadSection.scrollIntoView({ behavior: "smooth" });
                }
              }}
              className="bg-white text-blue-600 hover:bg-blue-50 rounded-full px-3 sm:px-6 py-2 font-semibold text-sm sm:text-base"
              size="sm"
            >
              <span className="hidden sm:inline">{t("nav.download")}</span>
              <span className="sm:hidden">{t("nav.download")}</span>
            </Button>
            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-lg text-white hover:bg-white/10"
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

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-white/20 animate-in slide-in-from-left duration-300">
            <nav className="flex flex-col space-y-4">
              {navigation.map((item, index) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-white hover:text-blue-200 transition-colors py-2 text-base animate-in slide-in-from-left duration-300"
                  style={{ animationDelay: `${index * 100}ms` }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <div
                className="flex flex-col space-y-2 pt-4 animate-in slide-in-from-left duration-300"
                style={{ animationDelay: `${navigation.length * 100}ms` }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm">{t("nav.theme")}</span>
                  <ThemeToggle />
                </div>
                <Button
                  onClick={() => {
                    const downloadSection =
                      document.getElementById("download-section");
                    if (downloadSection) {
                      downloadSection.scrollIntoView({ behavior: "smooth" });
                    }
                    setIsMenuOpen(false);
                  }}
                  className="bg-white text-blue-600 hover:bg-blue-50 rounded-full px-6 py-3 font-semibold text-center"
                  size="lg"
                >
                  <span>{t("nav.download")}</span>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
