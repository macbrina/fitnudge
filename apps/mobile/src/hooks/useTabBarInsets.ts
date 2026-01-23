import { createContext, useContext } from "react";

// Height of floating tab bar (without safe area)
export const TAB_BAR_BASE_HEIGHT = 70;

// Context for tab bar insets
interface TabBarInsetsContextValue {
  bottom: number;
}

export const TabBarInsetsContext = createContext<TabBarInsetsContextValue>({ bottom: 0 });

/**
 * Hook to get the bottom padding needed for content to clear the floating tab bar.
 * Use this in ScrollView contentContainerStyle: { paddingBottom: tabBarInsets.bottom }
 *
 * @example
 * const tabBarInsets = useTabBarInsets();
 * <ScrollView contentContainerStyle={{ paddingBottom: tabBarInsets.bottom }}>
 */
export function useTabBarInsets() {
  return useContext(TabBarInsetsContext);
}
