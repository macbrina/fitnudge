import { Dimensions } from "react-native";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Design system base values (assuming 375x812 as base design dimensions)
const DESIGN_WIDTH = 375;
const DESIGN_HEIGHT = 812;

export const toRN = (v: number | string): number => {
  if (typeof v === "number") return v;
  const s = String(v).trim();

  // "24px" -> 24
  if (s.endsWith("px")) return parseFloat(s);

  // Tailwind-like rems (e.g., "1.5rem") -> px (RN numbers)
  if (s.endsWith("rem")) return parseFloat(s) * 16;

  // numeric strings "24" -> 24
  const n = Number(s);
  if (!Number.isNaN(n)) return n;

  // named tokens like "full" -> a very large radius
  if (s === "full") return 9999;

  // fallback: 0 to satisfy types (or throw)
  return 0;
};

/**
 * Calculate lineHeight for React Native based on fontSize and lineHeight multiplier
 * @param fontSize - The font size (can be token string like "2.25rem" or number)
 * @param lineHeightMultiplier - The lineHeight multiplier (e.g., "1.25", "1.5")
 * @returns The calculated lineHeight in pixels
 */
export const getLineHeight = (
  fontSize: number | string,
  lineHeightMultiplier: number | string
): number => {
  const fontSizePx = toRN(fontSize);
  const multiplier = parseFloat(String(lineHeightMultiplier));
  return fontSizePx * multiplier;
};

/**
 * Converts height-based values (for vertical spacing)
 */
export const toRNHeight = (value: number): number => {
  const scale = screenHeight / DESIGN_HEIGHT;
  return Math.round(value * scale);
};

/**
 * Converts width-based values (for horizontal spacing)
 */
export const toRNWidth = (value: number): number => {
  const scale = screenWidth / DESIGN_WIDTH;
  return Math.round(value * scale);
};

/**
 * Responsive font size that scales with device size
 */
export const toRNFontSize = (size: number): number => {
  const scale = Math.min(screenWidth / DESIGN_WIDTH, 1.2); // Cap scaling at 1.2x
  return Math.round(size * scale);
};

/**
 * Responsive padding/margin that adapts to device size
 */
export const toRNPadding = (value: number): number => {
  const scale = Math.min(screenWidth / DESIGN_WIDTH, 1.1); // Cap scaling at 1.1x
  return Math.round(value * scale);
};

/**
 * Get screen dimensions for responsive layouts
 */
export const getScreenDimensions = () => ({
  width: screenWidth,
  height: screenHeight,
  isSmallDevice: screenWidth < 375,
  isMediumDevice: screenWidth >= 375 && screenWidth < 414,
  isLargeDevice: screenWidth >= 414,
});

/**
 * Check if device is in landscape mode
 */
export const isLandscape = (): boolean => screenWidth > screenHeight;

/**
 * Get safe area dimensions (placeholder - would integrate with react-native-safe-area-context)
 */
export const getSafeAreaDimensions = () => ({
  top: 44, // Default iOS status bar height
  bottom: 34, // Default iOS home indicator height
  left: 0,
  right: 0,
});
