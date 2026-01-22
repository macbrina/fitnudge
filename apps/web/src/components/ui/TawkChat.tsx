"use client";

import { useEffect } from "react";
import { useAppConfig } from "@/store";

// Tawk.to API type declaration
declare global {
  interface Window {
    Tawk_API?: Record<string, unknown>;
    Tawk_LoadStart?: Date;
  }
}

/**
 * Tawk.to Live Chat Widget
 *
 * Loads the Tawk.to chat script and displays the chat widget.
 * Uses the tawk_chat_url from app_config to determine the widget ID.
 */
export function TawkChat() {
  const { config } = useAppConfig();

  useEffect(() => {
    // Extract widget path from the tawk_chat_url
    // Format: https://tawk.to/chat/{propertyId}/{widgetId}
    const tawkUrl = config.tawk_chat_url;
    if (!tawkUrl) return;

    // Parse the URL to get property and widget IDs
    const match = tawkUrl.match(/tawk\.to\/chat\/([^/]+)\/([^/]+)/);
    if (!match) {
      return;
    }

    const propertyId = match[1];
    const widgetId = match[2];

    // Check if script is already loaded
    if (document.getElementById("tawk-script")) {
      return;
    }

    // Initialize Tawk.to API
    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();

    // Create and inject the script
    const script = document.createElement("script");
    script.id = "tawk-script";
    script.async = true;
    script.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
    script.charset = "UTF-8";
    script.setAttribute("crossorigin", "*");

    const firstScript = document.getElementsByTagName("script")[0];
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }

    // Cleanup on unmount
    return () => {
      const existingScript = document.getElementById("tawk-script");
      if (existingScript) {
        existingScript.remove();
      }
      // Clean up Tawk API
      delete window.Tawk_API;
      delete window.Tawk_LoadStart;
    };
  }, [config.tawk_chat_url]);

  // This component doesn't render anything visible
  // The Tawk.to widget is injected into the DOM by the script
  return null;
}
