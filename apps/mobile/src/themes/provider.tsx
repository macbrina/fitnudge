import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
import { StatusBar, useColorScheme } from "react-native";
import { tokens, type Tokens } from "./tokens";
import {
  semanticLight,
  semanticDark,
  type SemanticColors,
} from "./semanticColors";
import { type BrandName, brandUser, type BrandColors } from "./brandVariants";
import { storageUtil } from "@/utils/storageUtil";

type Preference = "light" | "dark";

interface ThemeContextValue {
  // Current resolved values
  mode: "light" | "dark";
  preference: Preference;
  brand: BrandName;
  isDark: boolean;
  isSystem: boolean;

  // Theme values
  tokens: typeof tokens;
  colors: SemanticColors;
  brandColors: BrandColors;

  // Setters
  setPreference: (preference: Preference) => void;
  setIsSystem: (isSystem: boolean) => void;
  setBrand: (brand: BrandName) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEYS = {
  THEME_PREFERENCE: "@theme_preference",
  BRAND: "@brand",
  IS_SYSTEM: "@is_system",
} as const;

interface ThemeProviderProps {
  children: React.ReactNode;
  initialBrand: BrandName;
}

export function ThemeProvider({ children, initialBrand }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();

  // State
  const [preference, setPreferenceState] = useState<Preference>("light");
  const [brand, setBrandState] = useState<BrandName>(initialBrand);
  const [isSystem, setIsSystemState] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persisted preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const [storedPreference, storedBrand, storedIsSystem] =
          await Promise.all([
            storageUtil.getItem(STORAGE_KEYS.THEME_PREFERENCE),
            storageUtil.getItem(STORAGE_KEYS.BRAND),
            storageUtil.getItem(STORAGE_KEYS.IS_SYSTEM),
          ]);

        if (storedPreference) {
          setPreferenceState(storedPreference as Preference);
        }
        if (storedBrand) {
          setBrandState(storedBrand as BrandName);
        }
        if (storedIsSystem) {
          setIsSystemState(storedIsSystem as unknown as boolean);
        }
      } catch (error) {
        console.warn("Failed to load theme preferences:", error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadPreferences();
  }, []);

  // Persist preference changes
  const setPreference = async (newPreference: Preference) => {
    setPreferenceState(newPreference);
    try {
      await storageUtil.setItem(STORAGE_KEYS.THEME_PREFERENCE, newPreference);
    } catch (error) {
      console.warn("Failed to save theme preference:", error);
    }
  };

  // Persist isSystem changes
  const setIsSystem = async (newIsSystem: boolean) => {
    setIsSystemState(newIsSystem);
    try {
      await storageUtil.setItem(STORAGE_KEYS.IS_SYSTEM, newIsSystem);
    } catch (error) {
      console.warn("Failed to save isSystem:", error);
    }
  };

  // Persist brand changes
  const setBrand = async (newBrand: BrandName) => {
    setBrandState(newBrand);
    try {
      await storageUtil.setItem(STORAGE_KEYS.BRAND, newBrand);
    } catch (error) {
      console.warn("Failed to save brand:", error);
    }
  };

  // Resolve current mode
  const mode = useMemo(() => {
    if (isSystem) {
      return systemColorScheme || "light";
    }
    return preference;
  }, [preference, systemColorScheme, isSystem]);

  const isDark = mode === "dark";

  // Get semantic colors based on mode
  const colors = useMemo(() => {
    return mode === "light" ? semanticLight : semanticDark;
  }, [mode]);

  // Get brand colors
  const brandColors = useMemo(() => {
    return brandUser;
  }, [brand]);

  // Sync StatusBar with theme
  useEffect(() => {
    StatusBar.setBarStyle(isDark ? "light-content" : "dark-content");
  }, [isDark]);

  // Context value
  const value = useMemo(
    () => ({
      mode,
      preference,
      brand,
      isDark,
      isSystem,
      tokens,
      colors,
      brandColors,
      setPreference,
      setIsSystem,
      setBrand,
    }),
    [mode, preference, brand, isDark, isSystem, colors, brandColors],
  );

  // Don't render until preferences are loaded to prevent flash
  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={value as ThemeContextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook to use theme context
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Hook to create themed styles
export function useThemedStyles<T extends Record<string, any>>(
  stylesFn: (tokens: Tokens, colors: SemanticColors, brand: BrandColors) => T,
): T {
  const { tokens: themeTokens, colors, brandColors } = useTheme();

  return useMemo(() => {
    const styles = stylesFn(themeTokens, colors, brandColors);
    return styles as T;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeTokens, colors, brandColors]);
}
