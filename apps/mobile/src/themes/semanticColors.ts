// Semantic color mappings for light and dark modes
import { tokens } from "./tokens";

export const semanticLight = {
  bg: {
    canvas: tokens.colors.light.background, // #f4f5f7
    card: tokens.colors.light.secondary, // #ffffff
    primary: tokens.colors.light.primary, // #2563eb
    secondary: tokens.colors.light.secondary, // #f1f5f9
    muted: tokens.colors.light.muted, // #f8fafc
    surface: tokens.colors.light.muted, // #f8fafc
    accent: tokens.colors.light.accent, // #f1f5f9
    destructive: tokens.colors.light.destructive, // #ef4444
    success: tokens.colors.light.success, // #10b981
    warning: tokens.colors.light.warning, // #f59e0b
    overlay: "rgba(0, 0, 0, 0.5)", // Modal overlay
    overlayLight: "rgba(0, 0, 0, 0.1)", // Modal overlay
    overlayTransparent: "rgba(0, 0, 0, 0.0)" // Modal overlay
  },
  text: {
    primary: tokens.colors.light.foreground, // #0f172a
    secondary: tokens.colors.light.secondaryForeground, // #0f172a
    muted: tokens.colors.light.mutedForeground, // #f8fafc
    onPrimary: tokens.colors.light.primaryForeground, // #ffffff
    tertiary: tokens.colors.light.mutedForeground, // #64748b
    onSecondary: tokens.colors.light.secondaryForeground, // #0f172a
    onAccent: tokens.colors.light.accentForeground, // #0f172a
    onDestructive: tokens.colors.light.destructiveForeground, // #ffffff
    onSuccess: tokens.colors.light.successForeground, // #ffffff
    onWarning: tokens.colors.light.warningForeground // #ffffff
  },
  border: {
    default: tokens.colors.light.border, // #e2e8f0
    subtle: tokens.colors.light.borderSubtle, // #e2e8f0
    input: tokens.colors.light.input, // #e2e8f0
    ring: tokens.colors.light.ring // #2563eb
  },
  feedback: {
    success: tokens.colors.light.success, // #10b981
    error: tokens.colors.light.destructive, // #ef4444
    warning: tokens.colors.light.warning // #f59e0b
  },
  shadow: {
    default: "rgba(0, 0, 0, 0.1)", // Light shadow
    sm: "rgba(0, 0, 0, 0.05)", // Small shadow
    md: "rgba(0, 0, 0, 0.1)", // Medium shadow
    lg: "rgba(0, 0, 0, 0.15)", // Large shadow
    xl: "rgba(0, 0, 0, 0.2)" // Extra large shadow
  }
} as const;

export const semanticDark = {
  bg: {
    canvas: tokens.colors.dark.background, // #000000 - pure black
    card: tokens.colors.dark.secondary, // #121212 - near-black cards
    primary: tokens.colors.dark.primary, // #00a3ff - electric blue
    secondary: tokens.colors.dark.secondary, // #121212
    muted: tokens.colors.dark.muted, // #0a0a0a
    surface: tokens.colors.dark.muted, // #0a0a0a
    accent: tokens.colors.dark.accent, // #1a1a1a
    destructive: tokens.colors.dark.destructive, // #ff4757 - vibrant red
    success: tokens.colors.dark.success, // #00d68f - vibrant green
    warning: tokens.colors.dark.warning, // #ffaa00 - warm amber
    overlay: "rgba(0, 0, 0, 0.85)", // Darker overlay for pure black theme
    overlayLight: "rgba(255, 255, 255, 0.05)", // Subtle light overlay
    overlayTransparent: "rgba(0, 0, 0, 0.0)" // Transparent overlay
  },
  text: {
    primary: tokens.colors.dark.foreground, // #ffffff - pure white
    tertiary: tokens.colors.dark.mutedForeground, // #8e8e8e - neutral gray
    secondary: tokens.colors.dark.secondaryForeground, // #ffffff
    muted: tokens.colors.dark.mutedForeground, // #8e8e8e
    onPrimary: tokens.colors.dark.primaryForeground, // #ffffff
    onSecondary: tokens.colors.dark.secondaryForeground, // #ffffff
    onAccent: tokens.colors.dark.accentForeground, // #ffffff
    onDestructive: tokens.colors.dark.destructiveForeground, // #ffffff
    onSuccess: tokens.colors.dark.successForeground, // #000000
    onWarning: tokens.colors.dark.warningForeground // #000000
  },
  border: {
    default: tokens.colors.dark.border, // #2f2f2f - subtle dark border
    subtle: tokens.colors.dark.borderSubtle, // #1f1f1f - very subtle
    input: tokens.colors.dark.input, // #2f2f2f
    ring: tokens.colors.dark.ring // #00a3ff - electric blue
  },
  feedback: {
    success: tokens.colors.dark.success, // #00d68f - vibrant green
    error: tokens.colors.dark.destructive, // #ff4757 - vibrant red
    warning: tokens.colors.dark.warning // #ffaa00 - warm amber
  },
  shadow: {
    default: "rgba(0, 0, 0, 0.5)", // Deeper shadows for pure black
    sm: "rgba(0, 0, 0, 0.3)",
    md: "rgba(0, 0, 0, 0.5)",
    lg: "rgba(0, 0, 0, 0.6)",
    xl: "rgba(0, 0, 0, 0.7)"
  }
} as const;

export type SemanticColors = typeof semanticLight;
