"use client";

import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { CookieConsent } from "@/components/ui/cookie-consent";

interface LandingLayoutProps {
  children: React.ReactNode;
}

export function LandingLayout({ children }: LandingLayoutProps) {
  return (
    <div className="min-h-screen bg-background w-full flex flex-col">
      <Header />
      <main className="flex-1 min-h-screen h-screen pt-12 sm:pt-16 lg:pt-20">
        {children}
      </main>
        <Footer />
      <CookieConsent />
    </div>
  );
}
