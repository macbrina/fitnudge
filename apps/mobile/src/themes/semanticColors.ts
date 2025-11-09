// Semantic color mappings for light and dark modes
import { tokens } from "./tokens";

export const semanticLight = {
  bg: {
    canvas: tokens.colors.light.background, // #ffffff
    card: tokens.colors.light.background, // #ffffff
    primary: tokens.colors.light.primary, // #2563eb
    secondary: tokens.colors.light.secondary, // #f1f5f9
    muted: tokens.colors.light.muted, // #f8fafc
    surface: tokens.colors.light.muted, // #f8fafc
    accent: tokens.colors.light.accent, // #f1f5f9
    destructive: tokens.colors.light.destructive, // #ef4444
    success: tokens.colors.light.success, // #10b981
    warning: tokens.colors.light.warning, // #f59e0b
    overlay: "rgba(0, 0, 0, 0.5)", // Modal overlay
  },
  text: {
    primary: tokens.colors.light.foreground, // #0f172a
    secondary: tokens.colors.light.secondaryForeground, // #0f172a
    muted: tokens.colors.light.mutedForeground, // #f8fafc
    onPrimary: tokens.colors.light.primaryForeground, // #ffffff
    onSecondary: tokens.colors.light.secondaryForeground, // #0f172a
    onAccent: tokens.colors.light.accentForeground, // #0f172a
    onDestructive: tokens.colors.light.destructiveForeground, // #ffffff
    onSuccess: tokens.colors.light.successForeground, // #ffffff
    onWarning: tokens.colors.light.warningForeground, // #ffffff
  },
  border: {
    default: tokens.colors.light.border, // #e2e8f0
    input: tokens.colors.light.input, // #e2e8f0
    ring: tokens.colors.light.ring, // #2563eb
  },
  feedback: {
    success: tokens.colors.light.success, // #10b981
    error: tokens.colors.light.destructive, // #ef4444
    warning: tokens.colors.light.warning, // #f59e0b
  },
  shadow: {
    default: "rgba(0, 0, 0, 0.1)", // Light shadow
    sm: "rgba(0, 0, 0, 0.05)", // Small shadow
    md: "rgba(0, 0, 0, 0.1)", // Medium shadow
    lg: "rgba(0, 0, 0, 0.15)", // Large shadow
    xl: "rgba(0, 0, 0, 0.2)", // Extra large shadow
  },
} as const;

export const semanticDark = {
  bg: {
    canvas: tokens.colors.dark.background, // #0f172a
    card: tokens.colors.dark.background, // #0f172a
    primary: tokens.colors.dark.primary, // #3b82f6
    secondary: tokens.colors.dark.secondary, // #1e293b
    muted: tokens.colors.dark.muted, // #1e293b
    surface: tokens.colors.dark.muted, // #1e293b
    accent: tokens.colors.dark.accent, // #1e293b
    destructive: tokens.colors.dark.destructive, // #dc2626
    success: tokens.colors.dark.success, // #34d399
    warning: tokens.colors.dark.warning, // #fbbf24
    overlay: "rgba(0, 0, 0, 0.7)", // Modal overlay
  },
  text: {
    primary: tokens.colors.dark.foreground, // #f8fafc
    secondary: tokens.colors.dark.secondaryForeground, // #f8fafc
    muted: tokens.colors.dark.mutedForeground, // #94a3b8
    onPrimary: tokens.colors.dark.primaryForeground, // #ffffff
    onSecondary: tokens.colors.dark.secondaryForeground, // #f8fafc
    onAccent: tokens.colors.dark.accentForeground, // #f8fafc
    onDestructive: tokens.colors.dark.destructiveForeground, // #ffffff
    onSuccess: tokens.colors.dark.successForeground, // #064e3b
    onWarning: tokens.colors.dark.warningForeground, // #78350f
  },
  border: {
    default: tokens.colors.dark.border, // #334155
    input: tokens.colors.dark.input, // #334155
    ring: tokens.colors.dark.ring, // #3b82f6
  },
  feedback: {
    success: tokens.colors.dark.success, // #34d399
    error: tokens.colors.dark.destructive, // #dc2626
    warning: tokens.colors.dark.warning, // #fbbf24
  },
  shadow: {
    default: "rgba(0, 0, 0, 0.3)", // Dark shadow
    sm: "rgba(0, 0, 0, 0.2)", // Small shadow
    md: "rgba(0, 0, 0, 0.3)", // Medium shadow
    lg: "rgba(0, 0, 0, 0.4)", // Large shadow
    xl: "rgba(0, 0, 0, 0.5)", // Extra large shadow
  },
} as const;

export type SemanticColors = typeof semanticLight;
