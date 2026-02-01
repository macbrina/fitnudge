// Design tokens for FitNudge
import { getLineHeight as calculateLineHeight } from "@/lib/units";

export const tokens = {
  colors: {
    // Light mode colors
    light: {
      background: "#f9fafc",
      foreground: "#0f172a",
      primary: "#0066ff", // Deep electric blue for light mode
      primaryForeground: "#ffffff",
      secondary: "#ffffff",
      secondaryForeground: "#0f172a",
      muted: "#f1f5f9",
      surface: "#ffffff",
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
      borderSubtle: "#f1f5f9",
      input: "#e2e8f0",
      ring: "#0066ff"
    },
    // Dark mode colors - Pure black aesthetic with electric blue
    dark: {
      background: "#000000", // Pure black - base canvas
      foreground: "#ffffff",
      primary: "#00a3ff", // Bright electric blue for dark mode (lighter than light mode)
      primaryForeground: "#ffffff",
      secondary: "#121212", // Near-black cards/elevated surfaces
      secondaryForeground: "#ffffff",
      muted: "#0a0a0a", // Slightly elevated from pure black
      surface: "#141414",
      mutedForeground: "#8e8e8e", // Neutral gray for muted text
      accent: "#1a1a1a", // Subtle accent areas
      accentForeground: "#ffffff",
      destructive: "#ff4757", // Vibrant red for errors
      destructiveForeground: "#ffffff",
      success: "#00d68f", // Vibrant green for success
      successForeground: "#000000",
      warning: "#ffaa00", // Warm amber for warnings
      warningForeground: "#000000",
      border: "#2f2f2f", // Subtle dark border
      borderSubtle: "#1f1f1f", // Very subtle border
      input: "#2f2f2f",
      ring: "#00a3ff" // Electric blue ring
    }
  },
  typography: {
    fontFamily: {
      sans: ["Space Grotesk", "system-ui", "sans-serif"],
      mono: ["JetBrains Mono", "monospace"]
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
      "6xl": "3.75rem"
    },
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700"
    },
    lineHeight: {
      tight: "1.25",
      snug: "1.375",
      normal: "1.5",
      relaxed: "1.625",
      loose: "2"
    }
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
    22: "5.5rem",
    24: "6rem",
    28: "7rem",
    32: "8rem",
    40: "10rem",
    48: "12rem",
    56: "14rem",
    64: "16rem"
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
    full: "9999px"
  },
  shadows: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    base: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
    inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
    none: "none"
  },
  breakpoints: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px"
  }
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
