import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { useTheme } from "./provider";
import { tokens, type Tokens } from "./tokens";
import { semanticLight, semanticDark, type SemanticColors } from "./semanticColors";
import { type BrandColors } from "./brandVariants";

type MakeStylesFunction = (
  tokens: Tokens,
  colors: SemanticColors | typeof semanticLight | typeof semanticDark,
  brand: BrandColors
) => any;

const styleCache = new Map<string, any>();

/**
 * Helper to create themed styles with access to tokens, semantic colors, and brand colors
 * @param stylesFn Function that receives tokens, semantic colors, and brand colors
 * @param mode Current theme mode ('light' | 'dark')
 * @param brand Current brand ('buyer' | 'vendor')
 * @returns Memoized StyleSheet styles
 */
export function makeStyles(
  stylesFn: MakeStylesFunction,
  mode: "light" | "dark",
  brand: "buyer" | "vendor",
  brandColors: BrandColors
) {
  const cacheKey = `${mode}-${brand}`;

  if (!styleCache.has(cacheKey)) {
    const semanticColors = mode === "light" ? semanticLight : semanticDark;
    const styles = stylesFn(tokens, semanticColors, brandColors);
    styleCache.set(cacheKey, StyleSheet.create(styles));
  }

  const styles = styleCache.get(cacheKey);
  if (!styles) {
    throw new Error("Style cache error: styles should exist after being set");
  }
  return styles;
}

/**
 * React hook version of makeStyles that uses theme context
 * @param stylesFn Function that receives tokens, semantic colors, and brand colors
 * @returns Memoized StyleSheet styles
 */
export function useStyles(stylesFn: MakeStylesFunction) {
  const { tokens: themeTokens, colors, brandColors } = useTheme();

  return useMemo(() => {
    const styles = stylesFn(themeTokens, colors, brandColors);
    return StyleSheet.create(styles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors, brandColors]);
}
