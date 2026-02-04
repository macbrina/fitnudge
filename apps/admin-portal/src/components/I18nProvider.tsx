"use client";

import { useEffect, useState } from "react";
import { Loading } from "./Loading";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Dynamic import so i18n (react-i18next) only runs on client
    import("../lib/i18n").then(() => setReady(true));
  }, []);

  if (!ready) {
    return <Loading variant="page" />;
  }

  return <>{children}</>;
}
