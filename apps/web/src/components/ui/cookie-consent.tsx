"use client";

import { useEffect } from "react";

/**
 * CookieYes Cookie Consent Banner
 *
 * This component loads the CookieYes script which handles:
 * - Cookie consent banner display
 * - User preference management
 * - Cookie categorization (necessary, analytics, marketing, etc.)
 * - GDPR/CCPA compliance
 *
 * The script is loaded in the head for optimal performance.
 */
export function CookieConsent() {
  useEffect(() => {
    // Check if script is already loaded
    if (document.getElementById("cookieyes")) {
      return;
    }

    // Create and inject the CookieYes script
    const script = document.createElement("script");
    script.id = "cookieyes";
    script.type = "text/javascript";
    script.src =
      "https://cdn-cookieyes.com/client_data/4b7652c727fe86847247f7c975584099/script.js";

    // Insert at the beginning of head for early loading
    const head = document.head || document.getElementsByTagName("head")[0];
    if (head.firstChild) {
      head.insertBefore(script, head.firstChild);
    } else {
      head.appendChild(script);
    }

    // Cleanup on unmount (though typically this won't unmount)
    return () => {
      const existingScript = document.getElementById("cookieyes");
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  // CookieYes injects its own UI, so we don't render anything
  return null;
}
