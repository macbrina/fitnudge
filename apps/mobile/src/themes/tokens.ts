// Design tokens for FitNudge
import { getLineHeight as calculateLineHeight } from "@/lib/units";

export const tokens = {
  colors: {
    // Light mode colors
    light: {
      background: "#ffffff",
      foreground: "#0f172a",
      primary: "#2563eb",
      primaryForeground: "#ffffff",
      secondary: "#f1f5f9",
      secondaryForeground: "#0f172a",
      muted: "#f4f5f7",
      mutedForeground: "#64748b",
      accent: "#f1f5f9",
      accentForeground: "#0f172a",
      destructive: "#ef4444",
      destructiveForeground: "#ffffff",
      success: "#10b981",
      successForeground: "#ffffff",
      warning: "#f59e0b",
      warningForeground: "#ffffff",
      border: "#e2e8f0",
      input: "#e2e8f0",
      ring: "#2563eb",
    },
    // Dark mode colors
    dark: {
      background: "#0f172a",
      foreground: "#f8fafc",
      primary: "#3b82f6",
      primaryForeground: "#ffffff",
      secondary: "#1e293b",
      secondaryForeground: "#f8fafc",
      muted: "#1e293b",
      mutedForeground: "#94a3b8",
      accent: "#1e293b",
      accentForeground: "#f8fafc",
      destructive: "#dc2626",
      destructiveForeground: "#ffffff",
      success: "#34d399",
      successForeground: "#064e3b",
      warning: "#fbbf24",
      warningForeground: "#78350f",
      border: "#334155",
      input: "#334155",
      ring: "#3b82f6",
    },
  },
  typography: {
    fontFamily: {
      sans: ["Space Grotesk", "system-ui", "sans-serif"],
      mono: ["JetBrains Mono", "monospace"],
    },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
      "5xl": "3rem",
      "6xl": "3.75rem",
    },
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
    lineHeight: {
      tight: "1.25",
      snug: "1.375",
      normal: "1.5",
      relaxed: "1.625",
      loose: "2",
    },
  },
  spacing: {
    0: "0",
    1: "0.25rem",
    1.5: "0.375rem",
    2: "0.5rem",
    3: "0.75rem",
    4: "1rem",
    5: "1.25rem",
    6: "1.5rem",
    8: "2rem",
    10: "2.5rem",
    12: "3rem",
    16: "4rem",
    20: "5rem",
    24: "6rem",
    32: "8rem",
    40: "10rem",
    48: "12rem",
    56: "14rem",
    64: "16rem",
  },
  borderRadius: {
    none: "0",
    sm: "0.125rem",
    base: "0.25rem",
    md: "0.375rem",
    lg: "0.5rem",
    xl: "0.75rem",
    "2xl": "1rem",
    "3xl": "1.5rem",
    full: "9999px",
  },
  shadows: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    base: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
    inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
    none: "none",
  },
  breakpoints: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  },
} as const;

export type Theme = "light" | "dark";
export type ColorToken = keyof typeof tokens.colors.light;
export type Tokens = typeof tokens;
export type SpacingToken = keyof typeof tokens.spacing;
export type TypographyToken = keyof typeof tokens.typography;

/**
 * Helper function to calculate lineHeight for React Native
 * Usage: lineHeight(fontSize, tokens.typography.lineHeight.tight)
 * Example: lineHeight(tokens.typography.fontSize["4xl"], tokens.typography.lineHeight.tight)
 */
export const lineHeight = (
  fontSize: number | string,
  lineHeightMultiplier: number | string
): number => {
  return calculateLineHeight(fontSize, lineHeightMultiplier);
};
