import React, { useEffect, useRef, useState } from "react";
import { Animated, View, Text, TouchableOpacity, LayoutChangeEvent } from "react-native";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes";
import { tokens } from "@/themes/tokens";

export interface SegmentedControlProps {
  options: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  style?: any;
}

export function SegmentedControl({
  options,
  selectedIndex,
  onChange,
  style
}: SegmentedControlProps) {
  const styles = useStyles(makeSegmentedControlStyles);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [segmentLayouts, setSegmentLayouts] = useState<Array<{ x: number; width: number }>>([]);

  const handleSegmentLayout = (event: LayoutChangeEvent, index: number) => {
    const { x, width } = event.nativeEvent.layout;
    setSegmentLayouts((prev) => {
      const newLayouts = [...prev];
      newLayouts[index] = { x, width };
      return newLayouts;
    });
  };

  useEffect(() => {
    const selected = segmentLayouts[selectedIndex];
    if (selected && selected.width > 0 && segmentLayouts.length === options.length) {
      const padding = toRN(tokens.spacing[1]);
      const position = selected.x - padding;

      Animated.spring(slideAnim, {
        toValue: position,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
        overshootClamping: true
      }).start();
    }
  }, [selectedIndex, segmentLayouts, options.length]);

  const selectedLayout = segmentLayouts[selectedIndex];
  const indicatorWidth = selectedLayout?.width || 0;
  const allReady = segmentLayouts.length === options.length && indicatorWidth > 0;

  return (
    <View style={[styles.wrapper, style]}>
      {/* Background container */}
      <View style={styles.container}>
        {/* Sliding indicator pill */}
        {allReady && (
          <Animated.View
            style={[
              styles.indicator,
              {
                transform: [{ translateX: slideAnim }],
                width: indicatorWidth
              }
            ]}
          />
        )}

        {/* Tab buttons */}
        {options.map((option, index) => {
          const isSelected = index === selectedIndex;
          return (
            <TouchableOpacity
              key={index}
              style={styles.tab}
              onPress={() => onChange(index)}
              onLayout={(e) => handleSegmentLayout(e, index)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.tabText, isSelected && styles.tabTextSelected]}
                numberOfLines={1}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const makeSegmentedControlStyles = (tokens: any, colors: any, brand: any) => ({
  wrapper: {
    width: "100%"
  },
  container: {
    flexDirection: "row" as const,
    height: toRN(tokens.spacing[10]),
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius["2xl"]),
    padding: toRN(tokens.spacing[1]),
    position: "relative" as const,
    overflow: "hidden" as const
  },
  indicator: {
    position: "absolute" as const,
    top: toRN(tokens.spacing[1]),
    bottom: toRN(tokens.spacing[1]),
    left: toRN(tokens.spacing[1]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.xl),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: toRN(2),
    elevation: 2
  },
  tab: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[3]),
    zIndex: 1
  },
  tabText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.tertiary
  },
  tabTextSelected: {
    fontFamily: fontFamily.groteskSemiBold,
    color: colors.text.primary
  }
});
