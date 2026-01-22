import React, { useCallback, useRef, useState, useMemo } from "react";
import { View, Text, PanResponder, LayoutChangeEvent, ViewStyle } from "react-native";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";

interface MacroSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onValueChange: (value: number) => void;
  style?: ViewStyle;
}

export function MacroSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onValueChange,
  style
}: MacroSliderProps) {
  const trackWidth = useRef(0);
  const trackOffsetX = useRef(0);
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();

  // Ensure value is at least min
  const safeValue = Math.max(value, min);

  const [localValue, setLocalValue] = useState(safeValue);
  const isDraggingRef = useRef(false);

  // Sync with external value when not dragging
  React.useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalValue(Math.max(value, min));
    }
  }, [value, min]);

  const displayValue = isDraggingRef.current ? localValue : safeValue;

  const valueToPercent = useCallback(
    (val: number) => {
      if (max === min) return 0;
      return ((val - min) / (max - min)) * 100;
    },
    [min, max]
  );

  const percentToValue = useCallback(
    (percent: number) => {
      const raw = min + (percent / 100) * (max - min);
      // Round to step, but ensure we don't go below min
      const stepped = Math.round(raw / step) * step;
      return Math.max(stepped, min);
    },
    [min, max, step]
  );

  const calculateValue = useCallback(
    (pageX: number) => {
      if (trackWidth.current === 0) return undefined;
      const x = pageX - trackOffsetX.current;
      const percent = Math.max(0, Math.min(100, (x / trackWidth.current) * 100));
      return percentToValue(percent);
    },
    [percentToValue]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          isDraggingRef.current = true;
          const newValue = calculateValue(evt.nativeEvent.pageX);
          if (newValue !== undefined) {
            setLocalValue(newValue);
            onValueChange(newValue);
          }
        },
        onPanResponderMove: (evt) => {
          const newValue = calculateValue(evt.nativeEvent.pageX);
          if (newValue !== undefined) {
            setLocalValue(newValue);
            onValueChange(newValue);
          }
        },
        onPanResponderRelease: () => {
          isDraggingRef.current = false;
        },
        onPanResponderTerminate: () => {
          isDraggingRef.current = false;
        }
      }),
    [calculateValue, onValueChange]
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    trackWidth.current = event.nativeEvent.layout.width;
    event.target.measureInWindow((x) => {
      trackOffsetX.current = x;
    });
  }, []);

  const percent = valueToPercent(displayValue);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {displayValue}
          {unit}
        </Text>
      </View>
      <View style={styles.sliderContainer} onLayout={handleLayout} {...panResponder.panHandlers}>
        <View style={[styles.track, { backgroundColor: colors.border.default }]}>
          <View
            style={[
              styles.filledTrack,
              {
                backgroundColor: colors.text.primary,
                width: `${percent}%`
              }
            ]}
          />
        </View>
        <View
          style={[
            styles.thumb,
            {
              backgroundColor: brandColors.primary,
              borderColor: brandColors.primary,
              left: `${percent}%`
            }
          ]}
        />
      </View>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    marginBottom: toRN(tokens.spacing[3])
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[1])
  },
  label: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  },
  value: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  sliderContainer: {
    height: 28,
    justifyContent: "center" as const
  },
  track: {
    height: 3,
    borderRadius: 1.5
  },
  filledTrack: {
    height: 3,
    borderRadius: 1.5
  },
  thumb: {
    position: "absolute" as const,
    width: 12,
    height: 12,
    borderRadius: 3,
    marginLeft: -6,
    borderWidth: 0
  }
});

export default MacroSlider;
