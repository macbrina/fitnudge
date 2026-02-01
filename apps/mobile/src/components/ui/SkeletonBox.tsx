import { toRN } from "@/lib/units";
import { useTheme } from "@/themes";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from "react-native-svg";

interface SkeletonBoxProps {
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  borderRadius?: number;
  style?: ViewStyle;
  animated?: boolean;
  duration?: number;
  /** When true, renders outer wavy skeleton + inner wavy skeleton (different color) for contrast */
  inner?: boolean;
  /** Padding for inner skeleton when inner=true */
  innerPadding?: number;
  children?: React.ReactNode;
}

// Skeleton colors that work well on both light and dark themes
const getSkeletonColors = (isDark: boolean) => {
  if (isDark) {
    return {
      base: "#2a3342",
      highlight: "#3a4555",
      innerBase: "#1e2633",
      innerHighlight: "#2d3748"
    };
  }
  return {
    base: "#e2e8f0",
    highlight: "#f1f5f9",
    innerBase: "#cbd5e1",
    innerHighlight: "#e2e8f0"
  };
};

/** Shimmer bar - gradient that sweeps across (wavy effect) */
function ShimmerOverlay({
  width,
  height,
  colors,
  animated,
  duration
}: {
  width: number;
  height: number;
  colors: { base: string; highlight: string };
  animated: boolean;
  duration: number;
}) {
  const translateX = useRef(new Animated.Value(-width)).current;
  const gradientIdRef = useRef(`shimmer-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (animated && width > 0) {
      translateX.setValue(-width);
      const animation = Animated.loop(
        Animated.timing(translateX, {
          toValue: width,
          duration,
          useNativeDriver: true
        })
      );
      animation.start();
      return () => animation.stop();
    }
  }, [animated, duration, translateX, width]);

  if (width <= 0 || height <= 0) return null;

  const shimmerWidth = width * 0.6;
  const gradientId = gradientIdRef.current;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}
      pointerEvents="none"
    >
      <Svg width={shimmerWidth} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
        <Defs>
          <SvgLinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={colors.base} stopOpacity="1" />
            <Stop offset="30%" stopColor={colors.highlight} stopOpacity="1" />
            <Stop offset="70%" stopColor={colors.highlight} stopOpacity="1" />
            <Stop offset="100%" stopColor={colors.base} stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>
        <Rect x={0} y={0} width={shimmerWidth} height={height} fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

export const SkeletonBox: React.FC<SkeletonBoxProps> = ({
  width = "100%",
  height = 20,
  borderRadius = 4,
  style,
  animated = true,
  duration = 1500,
  inner = false,
  innerPadding = 8,
  children
}) => {
  const { isDark } = useTheme();
  const [layout, setLayout] = React.useState({ width: 0, height: 0 });
  const skeletonColors = getSkeletonColors(isDark);

  const innerLayout = inner
    ? {
        width: Math.max(0, layout.width - innerPadding * 2),
        height: Math.max(0, layout.height - innerPadding * 2)
      }
    : { width: 0, height: 0 };

  const pad = inner && children ? Number(toRN(innerPadding)) || 8 : 0;

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius: toRN(borderRadius),
          backgroundColor: skeletonColors.base,
          overflow: "hidden"
        },
        style,
        // Padding last so it can't be overridden – children flow inside padded content area (same as Card)
        pad > 0 && { paddingHorizontal: pad, paddingVertical: pad }
      ]}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setLayout({ width: w, height: h });
      }}
    >
      {/* Outer wavy shimmer */}
      <ShimmerOverlay
        width={layout.width}
        height={layout.height}
        colors={{ base: skeletonColors.base, highlight: skeletonColors.highlight }}
        animated={animated}
        duration={duration}
      />

      {/* Inner skeleton (different color, also wavy) - for contrast */}
      {inner && innerLayout.width > 0 && innerLayout.height > 0 && (
        <View
          style={{
            position: "absolute",
            left: toRN(innerPadding),
            top: toRN(innerPadding),
            right: toRN(innerPadding),
            bottom: toRN(innerPadding),
            borderRadius: toRN(Math.max(0, borderRadius - 2)),
            backgroundColor: skeletonColors.innerBase,
            overflow: "hidden"
          }}
        >
          <ShimmerOverlay
            width={innerLayout.width}
            height={innerLayout.height}
            colors={{
              base: skeletonColors.innerBase,
              highlight: skeletonColors.innerHighlight
            }}
            animated={animated}
            duration={duration}
          />
        </View>
      )}

      {/* Children in normal flow – root has padding so they're inset (same as Card) */}
      {children}
    </View>
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
            marginBottom: index < lines - 1 ? toRN(spacing) : 0
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
  return (
    <SkeletonBox
      width={width}
      height={height}
      borderRadius={12}
      inner
      innerPadding={padding}
      style={style}
    >
      <SkeletonBox width="70%" height={20} borderRadius={4} style={{ marginBottom: toRN(8) }} />
      <SkeletonText lines={2} width="100%" height={14} spacing={6} />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: toRN(12)
        }}
      >
        <SkeletonBox width="30%" height={12} borderRadius={6} />
        <SkeletonBox width="25%" height={12} borderRadius={6} />
      </View>
    </SkeletonBox>
  );
};

export const SkeletonButton: React.FC<{
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}> = ({ width = "100%", height = 48, borderRadius = 8, style }) => {
  return <SkeletonBox width={width} height={height} borderRadius={borderRadius} style={style} />;
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
            marginBottom: index < items - 1 ? toRN(spacing) : 0
          }}
        />
      ))}
    </View>
  );
};
