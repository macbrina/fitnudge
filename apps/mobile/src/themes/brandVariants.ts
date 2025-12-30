import { tokens } from "./tokens";

export type BrandName = "fitnudge";

// Simple luminance function for contrast calculation
function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;

  const rLinear =
    rsRGB <= 0.03928 ? rsRGB / 12.92 : ((rsRGB + 0.055) / 1.055) ** 2.4;
  const gLinear =
    gsRGB <= 0.03928 ? gsRGB / 12.92 : ((gsRGB + 0.055) / 1.055) ** 2.4;
  const bLinear =
    bsRGB <= 0.03928 ? bsRGB / 12.92 : ((bsRGB + 0.055) / 1.055) ** 2.4;

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

// Determine if we need light or dark text based on contrast
function getOnPrimaryColor(primaryHex: string): string {
  const luminance = getLuminance(primaryHex);
  // If luminance is less than 0.5 (dark color), use light text
  return luminance < 0.5 ? "#ffffff" : "#0f172a";
}

// User brand variant
export const brandUser = {
  primary: tokens.colors.light.primary, // #2563eb - Main brand color
  primaryHover: tokens.colors.dark.primary, // #3b82f6 - Hover state
  primaryActive: tokens.colors.light.destructive, // #ef4444 - Active state
  onPrimary: getOnPrimaryColor(tokens.colors.light.primary), // Text color on primary
  onPrimaryActive: getOnPrimaryColor(tokens.colors.light.destructive), // Text color on primary active
} as const;

// Export types
export type BrandColors = typeof brandUser;
