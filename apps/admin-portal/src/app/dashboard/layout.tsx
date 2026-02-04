"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@fitnudge/ui";
import { useTranslation } from "@/lib/i18n";
import { SIDEBAR_WIDTH } from "@/components/Sidebar";
import { SidebarToggleIcon } from "@/components/SidebarToggleIcon";
import { getPageTitleKey } from "@/lib/routes";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { collapsed, toggle } = useSidebar();
  const { t } = useTranslation();
  const pageTitleKey = getPageTitleKey(pathname);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />

      {/* Main content - full width when closed, offset when sidebar open */}
      <main
        className="min-h-screen transition-[margin] duration-300 ease-in-out"
        style={{
          marginLeft: collapsed ? 0 : SIDEBAR_WIDTH,
        }}
      >
        {/* Top header bar - toggle on left only when sidebar closed */}
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
          {collapsed && (
            <button
              type="button"
              onClick={toggle}
              className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label={t("admin.sidebar.open")}
            >
              <SidebarToggleIcon collapsed={true} />
            </button>
          )}
          <h1 className="flex-1 min-w-0 text-lg font-semibold text-gray-900 dark:text-white">
            {t(pageTitleKey)}
          </h1>
          <div className="flex shrink-0 items-center gap-4">
            <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
              {user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              {t("common.logout")}
            </Button>
          </div>
        </header>

        {/* Scrollable page content */}
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DashboardShell>{children}</DashboardShell>
    </SidebarProvider>
  );
}
