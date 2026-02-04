"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@fitnudge/ui";
import { SidebarToggleIcon } from "@/components/SidebarToggleIcon";
import { MENU_SECTIONS } from "@/lib/menu";
import { ROUTES } from "@/lib/routes";
import { useSidebar } from "@/contexts/SidebarContext";
import { useTranslation } from "@/lib/i18n";

export const SIDEBAR_WIDTH = 260;

export function Sidebar() {
  const { collapsed, toggle } = useSidebar();
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <>
      {/* Sidebar overlay when expanded (for mobile/click-outside - optional) */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={toggle}
          aria-hidden
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-full flex flex-col",
          "bg-zinc-950 border-r border-zinc-800/80",
          "transition-all duration-300 ease-in-out",
          collapsed ? "w-0 overflow-hidden" : "w-[260px] shadow-xl"
        )}
        style={{ minWidth: collapsed ? 0 : SIDEBAR_WIDTH }}
      >
        {/* Logo + toggle when menu open */}
        {!collapsed && (
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 px-3 py-3 gap-3">
            <Link href={ROUTES.DASHBOARD} className="flex items-center min-w-0">
              <Image
                src="/logo.png"
                alt={t("admin.sidebar.logo_alt")}
                width={64}
                height={64}
                className="w-8 h-8 sm:w-10 sm:h-10 shrink-0"
                unoptimized
              />
              <span className="text-base sm:text-lg font-bold text-white truncate ml-2">
                {t("admin.sidebar.logo_alt")}
              </span>
            </Link>
            <button
              type="button"
              onClick={toggle}
              className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
              aria-label={t("admin.sidebar.close")}
            >
              <SidebarToggleIcon collapsed={false} />
            </button>
          </div>
        )}

        {/* Scrollable menu */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4">
          {MENU_SECTIONS.map((section, idx) => (
            <div key={idx} className="mb-6 last:mb-0">
              {section.labelKey && (
                <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {t(section.labelKey)}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== ROUTES.DASHBOARD &&
                      pathname.startsWith(item.href));
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                          isActive
                            ? "bg-zinc-800/80 text-white font-medium"
                            : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                        )}
                      >
                        {Icon && (
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isActive ? "text-zinc-200" : "text-zinc-500"
                            )}
                          />
                        )}
                        <span className="truncate">{t(item.labelKey)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
