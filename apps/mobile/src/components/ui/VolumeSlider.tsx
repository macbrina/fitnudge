import { useStyles, useTheme } from "@/themes";
import React, { useCallback, useRef } from "react";
import {
  View,
  PanResponder,
  StyleSheet,
  LayoutChangeEvent,
  GestureResponderEvent,
  ViewStyle,
} from "react-native";

interface VolumeSliderProps {
  value: number; // 0-1
  onValueChange: (value: number) => void;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
  style?: ViewStyle;
}

export function VolumeSlider({
  value,
  onValueChange,
  minimumTrackTintColor = "#007AFF",
  maximumTrackTintColor = "#E0E0E0",
  thumbTintColor = "#FFFFFF",
  style,
}: VolumeSliderProps) {
  const trackWidth = useRef(0);
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();

  const calculateValue = useCallback(
    (evt: GestureResponderEvent) => {
      if (trackWidth.current === 0) return;
      const x = evt.nativeEvent.locationX;
      const newValue = Math.max(0, Math.min(1, x / trackWidth.current));
      onValueChange(newValue);
    },
    [onValueChange]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: calculateValue,
      onPanResponderMove: calculateValue,
    })
  ).current;

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    trackWidth.current = event.nativeEvent.layout.width;
  }, []);

  // Clamp value between 0 and 1
  const clampedValue = Math.max(0, Math.min(1, value));

  return (
    <View
      style={[styles.container, style]}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      <View style={[styles.track, { backgroundColor: colors.border.default }]}>
        <View
          style={[
            styles.filledTrack,
            {
              backgroundColor: colors.bg.primary,
              width: `${clampedValue * 100}%`,
            },
          ]}
        />
      </View>
      <View
        style={[
          styles.thumb,
          {
            backgroundColor: colors.bg.secondary,
            left: `${clampedValue * 100}%`,
          },
        ]}
      />
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    height: 44,
    justifyContent: "center",
    flex: 1,
  },
  track: {
    height: 4,
    borderRadius: 2,
  },
  filledTrack: {
    height: 4,
    borderRadius: 2,
  },
  thumb: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 14,
    marginLeft: -14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default VolumeSlider;
