"use client";

import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { CookieConsent } from "@/components/ui/cookie-consent";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background w-full flex flex-col">
      <Header />
      <main className="flex-1 min-h-screen h-screen">{children}</main>
      <Footer />
      <CookieConsent />
    </div>
  );
}
