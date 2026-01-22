import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { fontFamily } from "@/lib/fonts";
import { useStyles } from "@/themes";
import { toRN } from "@/lib";

interface CaloriesRingProps {
  consumed: number;
  target: number;
  size?: number;
  strokeWidth?: number;
}

export function CaloriesRing({
  consumed,
  target,
  size = 180,
  strokeWidth = 10
}: CaloriesRingProps) {
  // Simple calculation: Calories left = target - consumed
  const caloriesLeft = target - consumed;
  const isOver = caloriesLeft < 0;
  const displayValue = Math.abs(Math.round(caloriesLeft));
  const styles = useStyles(makeStyles);

  // Calculate progress percentage (consumed / target)
  const progressPercent = target > 0 ? Math.min((consumed / target) * 100, 100) : 0;

  // Ring calculations
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Progress stroke length
  const progressStroke = (progressPercent / 100) * circumference;
  const remainingStroke = circumference - progressStroke;

  // Colors
  const trackColor = "#E5E7EB"; // Light gray for remaining
  const progressColor = isOver ? "#EF4444" : "#10B981"; // Red if over, Green if within

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* SVG Ring */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Background track (gray) */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress arc */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${progressStroke} ${remainingStroke}`}
          strokeDashoffset={circumference / 4} // Start from top
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>

      {/* Center content - positioned absolutely over the SVG */}
      <View style={styles.centerContent}>
        <Text style={[styles.caloriesValue, isOver && styles.overValue]}>{displayValue}</Text>
        <Text style={[styles.caloriesLabel, isOver && styles.overLabel]}>
          {isOver ? "Calories over" : "Calories left"}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    alignItems: "center",
    justifyContent: "center"
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center"
  },
  caloriesValue: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.secondary
  },
  overValue: {
    color: colors.feedback.error
  },
  caloriesLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[2])
  },
  overLabel: {
    color: colors.feedback.error
  }
});

export default CaloriesRing;
