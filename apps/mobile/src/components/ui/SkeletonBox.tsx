import { toRN } from "@/lib/units";
import { useTheme } from "@/themes";
import React, { useEffect, useRef } from "react";
import { Animated, View, ViewStyle } from "react-native";

interface SkeletonBoxProps {
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  borderRadius?: number;
  style?: ViewStyle;
  animated?: boolean;
  duration?: number;
}

// Skeleton colors that work well on both light and dark themes
const getSkeletonColors = (isDark: boolean) => {
  if (isDark) {
    return {
      base: "#2a3342", // Dark gray-blue, visible on dark background
      highlight: "#3a4555", // Lighter gray-blue for shimmer
    };
  } else {
    return {
      base: "#e2e8f0", // Light gray, visible on white background
      highlight: "#f1f5f9", // Lighter gray for shimmer
    };
  }
};

export const SkeletonBox: React.FC<SkeletonBoxProps> = ({
  width = "100%",
  height = 20,
  borderRadius = 4,
  style,
  animated = true,
  duration = 1500,
}) => {
  const { colors, isDark } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;
  const skeletonColors = getSkeletonColors(isDark);

  useEffect(() => {
    if (animated) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: duration,
            useNativeDriver: false,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: duration,
            useNativeDriver: false,
          }),
        ]),
      );
      animation.start();

      return () => animation.stop();
    }
  }, [animated, animatedValue, duration]);

  const backgroundColor = animated
    ? animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [skeletonColors.base, skeletonColors.highlight],
      })
    : skeletonColors.base;

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor,
          borderRadius: toRN(borderRadius),
        },
        style,
      ]}
    />
  );
};

// Predefined skeleton components for common use cases
export const SkeletonText: React.FC<{
  lines?: number;
  width?: number | `${number}%`;
  height?: number;
  spacing?: number;
  style?: ViewStyle;
}> = ({ lines = 1, width = "100%", height = 16, spacing = 8, style }) => {
  return (
    <View style={style}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonBox
          key={index}
          width={width}
          height={height}
          borderRadius={4}
          style={{
            marginBottom: index < lines - 1 ? toRN(spacing) : 0,
          }}
        />
      ))}
    </View>
  );
};

export const SkeletonCard: React.FC<{
  width?: number | `${number}%`;
  height?: number;
  padding?: number;
  style?: ViewStyle;
}> = ({ width = "100%", height = 120, padding = 16, style }) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          width,
          height,
          padding: toRN(padding),
          backgroundColor: colors.bg.card,
          borderRadius: toRN(12),
          borderWidth: 1,
          borderColor: colors.border.default,
        },
        style,
      ]}
    >
      <SkeletonBox
        width="70%"
        height={20}
        borderRadius={4}
        style={{ marginBottom: toRN(8) }}
      />
      <SkeletonText lines={2} width="100%" height={14} spacing={6} />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: toRN(12),
        }}
      >
        <SkeletonBox width="30%" height={12} borderRadius={6} />
        <SkeletonBox width="25%" height={12} borderRadius={6} />
      </View>
    </View>
  );
};

export const SkeletonButton: React.FC<{
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}> = ({ width = "100%", height = 48, borderRadius = 8, style }) => {
  return (
    <SkeletonBox
      width={width}
      height={height}
      borderRadius={borderRadius}
      style={style}
    />
  );
};

export const SkeletonAvatar: React.FC<{
  size?: number;
}> = ({ size = 40 }) => {
  return <SkeletonBox width={size} height={size} borderRadius={size / 2} />;
};

export const SkeletonList: React.FC<{
  items?: number;
  itemHeight?: number;
  spacing?: number;
}> = ({ items = 3, itemHeight = 60, spacing = 12 }) => {
  return (
    <View>
      {Array.from({ length: items }).map((_, index) => (
        <SkeletonBox
          key={index}
          width="100%"
          height={itemHeight}
          borderRadius={8}
          style={{
            marginBottom: index < items - 1 ? toRN(spacing) : 0,
          }}
        />
      ))}
    </View>
  );
};
