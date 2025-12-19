import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";

interface TimerRingProps {
  timeRemaining: number;
  totalTime: number;
  isResting?: boolean;
  size?: number;
  strokeWidth?: number;
}

export function TimerRing({
  timeRemaining,
  totalTime,
  isResting = false,
  size = 200,
  strokeWidth = 12,
}: TimerRingProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();

  // Calculate progress percentage
  const progress = useMemo(() => {
    if (totalTime === 0) return 0;
    return Math.max(0, Math.min(1, timeRemaining / totalTime));
  }, [timeRemaining, totalTime]);

  // Calculate SVG circle properties
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference * (1 - progress);

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Colors based on state
  const ringColor = isResting ? colors.feedback.success : brandColors.primary;
  const ringBackgroundColor = isResting
    ? colors.feedback.success + "30"
    : brandColors.primary + "20";

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background circle */}
        <Circle
          stroke={ringBackgroundColor}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <Circle
          stroke={ringColor}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {/* Time display */}
      <View style={[styles.timeContainer, { width: size, height: size }]}>
        <Text style={[styles.timeText, isResting && styles.timeTextResting]}>
          {formatTime(timeRemaining)}
        </Text>
        <Text style={styles.totalTimeText}>/ {formatTime(totalTime)}</Text>
      </View>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    position: "relative" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  svg: {
    transform: [{ rotateZ: "0deg" }],
  },
  timeContainer: {
    position: "absolute" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  timeText: {
    fontSize: toRN(tokens.typography.fontSize["4xl"]),
    fontFamily: fontFamily.groteskBold,
    color: brand.primary,
  },
  timeTextResting: {
    color: colors.feedback.success,
  },
  totalTimeText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[1]),
  },
});
