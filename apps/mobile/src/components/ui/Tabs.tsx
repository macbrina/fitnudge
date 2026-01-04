import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  LayoutChangeEvent
} from "react-native";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";

export interface TabItem {
  id: string;
  label: string;
  badge?: number; // Optional badge count
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  selectedId: string;
  onChange: (id: string) => void;
  variant?: "default" | "pills" | "underline";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  scrollable?: boolean;
  style?: any;
}

export function Tabs({
  tabs,
  selectedId,
  onChange,
  variant = "default",
  size = "md",
  fullWidth = false,
  scrollable = false,
  style
}: TabsProps) {
  const styles = useStyles((tokens, colors, brand) =>
    makeTabsStyles(tokens, colors, brand, variant, size, fullWidth)
  );
  const { colors, brandColors } = useTheme();

  // Animated indicator for underline variant
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [tabLayouts, setTabLayouts] = useState<Array<{ x: number; width: number }>>([]);

  const handleTabLayout = (event: LayoutChangeEvent, index: number) => {
    const { x, width } = event.nativeEvent.layout;
    setTabLayouts((prev) => {
      const newLayouts = [...prev];
      newLayouts[index] = { x, width };
      return newLayouts;
    });
  };

  // Animate indicator when selection changes (underline variant)
  useEffect(() => {
    if (variant === "underline") {
      const selectedIndex = tabs.findIndex((tab) => tab.id === selectedId);
      const selected = tabLayouts[selectedIndex];

      if (selected && selected.width > 0 && tabLayouts.length === tabs.length) {
        Animated.timing(slideAnim, {
          toValue: selected.x,
          duration: 250,
          useNativeDriver: true
        }).start();
      }
    }
  }, [selectedId, tabLayouts, variant, tabs, slideAnim]);

  const renderTab = (tab: TabItem, index: number) => {
    const isSelected = tab.id === selectedId;

    return (
      <TouchableOpacity
        key={tab.id}
        style={[styles.tab, isSelected && styles.tabSelected, fullWidth && styles.tabFullWidth]}
        onPress={() => onChange(tab.id)}
        activeOpacity={0.7}
        onLayout={(e) => handleTabLayout(e, index)}
      >
        {tab.icon && <View style={styles.tabIcon}>{tab.icon}</View>}
        <Text style={[styles.tabText, isSelected && styles.tabTextSelected]}>{tab.label}</Text>
        {tab.badge !== undefined && tab.badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{tab.badge > 99 ? "99+" : tab.badge}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const selectedIndex = tabs.findIndex((tab) => tab.id === selectedId);
  const selectedLayout = tabLayouts[selectedIndex];

  const containerContent = (
    <View style={[styles.container, style]}>
      <View style={styles.tabsRow}>{tabs.map((tab, index) => renderTab(tab, index))}</View>

      {/* Animated indicator for underline variant */}
      {variant === "underline" && selectedLayout && (
        <Animated.View
          style={[
            styles.indicator,
            {
              width: selectedLayout.width,
              transform: [{ translateX: slideAnim }]
            }
          ]}
        />
      )}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {containerContent}
      </ScrollView>
    );
  }

  return containerContent;
}

const makeTabsStyles = (
  tokens: any,
  colors: any,
  brand: any,
  variant: TabsProps["variant"],
  size: TabsProps["size"],
  fullWidth: boolean
) => {
  // Size-based values
  const sizeConfig = {
    sm: {
      fontSize: tokens.typography.fontSize.sm,
      paddingVertical: tokens.spacing[2],
      paddingHorizontal: tokens.spacing[3],
      gap: tokens.spacing[1]
    },
    md: {
      fontSize: tokens.typography.fontSize.base,
      paddingVertical: tokens.spacing[3],
      paddingHorizontal: tokens.spacing[4],
      gap: tokens.spacing[2]
    },
    lg: {
      fontSize: tokens.typography.fontSize.lg,
      paddingVertical: tokens.spacing[4],
      paddingHorizontal: tokens.spacing[5],
      gap: tokens.spacing[3]
    }
  }[size!];

  const baseStyles: any = {
    container: {
      position: "relative" as const
    },
    scrollContainer: {
      paddingHorizontal: toRN(tokens.spacing[4])
    },
    tabsRow: {
      flexDirection: "row" as const,
      gap: toRN(sizeConfig.gap)
    },
    tab: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingVertical: toRN(sizeConfig.paddingVertical),
      paddingHorizontal: toRN(sizeConfig.paddingHorizontal),
      gap: toRN(tokens.spacing[2])
    },
    tabFullWidth: {
      flex: 1,
      justifyContent: "center" as const
    },
    tabIcon: {
      marginRight: toRN(tokens.spacing[1])
    },
    tabText: {
      fontSize: toRN(sizeConfig.fontSize),
      fontFamily: fontFamily.medium,
      color: colors.text.secondary
    },
    tabTextSelected: {
      fontFamily: fontFamily.semiBold,
      color: brand.primary
    },
    badge: {
      backgroundColor: brand.primary,
      borderRadius: toRN(tokens.borderRadius.full),
      paddingHorizontal: toRN(tokens.spacing[2]),
      paddingVertical: toRN(tokens.spacing[0.5]),
      marginLeft: toRN(tokens.spacing[1]),
      minWidth: toRN(tokens.spacing[5]),
      alignItems: "center" as const,
      justifyContent: "center" as const
    },
    badgeText: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      fontFamily: fontFamily.semiBold,
      color: colors.text.onPrimary
    }
  };

  // Variant-specific styles
  if (variant === "default") {
    return {
      ...baseStyles,
      tab: {
        ...baseStyles.tab,
        backgroundColor: colors.bg.card,
        borderRadius: toRN(tokens.borderRadius.lg), // Squared corners
        borderWidth: 1,
        borderColor: colors.border.default
      },
      tabSelected: {
        backgroundColor: brand.primary + "15",
        borderColor: brand.primary
      }
    };
  }

  if (variant === "pills") {
    return {
      ...baseStyles,
      tab: {
        ...baseStyles.tab,
        backgroundColor: colors.bg.card,
        borderRadius: toRN(tokens.borderRadius.full) // Fully rounded
      },
      tabSelected: {
        backgroundColor: brand.primary
      },
      tabText: {
        ...baseStyles.tabText,
        color: colors.text.secondary
      },
      tabTextSelected: {
        fontFamily: fontFamily.semiBold,
        color: colors.text.onPrimary
      }
    };
  }

  if (variant === "underline") {
    return {
      ...baseStyles,
      container: {
        ...baseStyles.container,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default
      },
      tab: {
        ...baseStyles.tab,
        backgroundColor: "transparent"
      },
      tabSelected: {
        backgroundColor: "transparent"
      },
      indicator: {
        position: "absolute" as const,
        bottom: 0,
        height: 2,
        backgroundColor: brand.primary
      }
    };
  }

  return baseStyles;
};
