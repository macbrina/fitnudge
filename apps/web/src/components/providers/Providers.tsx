"use client";

import { ReactNode } from "react";
import { AppConfigProvider, ThemeProvider } from "@/store";
import { TawkChat } from "@/components/ui/TawkChat";
// import { CookieConsent } from "@/components/ui/cookie-consent";
import { FeedbackButton } from "@/components/ui/FeedbackButton";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <AppConfigProvider>
        {children}
        <FeedbackButton />
        <TawkChat />
        {/* <CookieConsent /> */}
      </AppConfigProvider>
    </ThemeProvider>
  );
}
