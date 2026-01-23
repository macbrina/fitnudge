"use client";

import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";

interface LandingLayoutProps {
  children: React.ReactNode;
}

export function LandingLayout({ children }: LandingLayoutProps) {
  return (
    <div className="min-h-screen bg-background w-full flex flex-col overflow-x-hidden">
      <Header />
      <main className="flex-1 pt-16 sm:pt-20 lg:pt-24">{children}</main>
      <Footer />
    </div>
  );
}
