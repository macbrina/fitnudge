import { useStyles, useTheme } from "@/themes";
import React, { useCallback, useRef, useState, useMemo } from "react";
import {
  View,
  PanResponder,
  LayoutChangeEvent,
  GestureResponderEvent,
  ViewStyle,
  Animated
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
  style
}: VolumeSliderProps) {
  const trackWidth = useRef(0);
  const trackOffsetX = useRef(0);
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();

  // Local state for smooth visual updates during drag
  const [localValue, setLocalValue] = useState(value);
  const isDraggingRef = useRef(false);

  // Sync with external value when not dragging
  const displayValue = isDraggingRef.current ? localValue : value;

  const calculateValue = useCallback((pageX: number) => {
    if (trackWidth.current === 0) return;
    const x = pageX - trackOffsetX.current;
    const newValue = Math.max(0, Math.min(1, x / trackWidth.current));
    return newValue;
  }, []);

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
    // Measure the offset of the track from the left edge of the screen
    event.target.measureInWindow((x) => {
      trackOffsetX.current = x;
    });
  }, []);

  // Clamp value between 0 and 1
  const clampedValue = Math.max(0, Math.min(1, displayValue));
  // Calculate pixel position for absolute positioning
  const thumbPosition = trackWidth.current * clampedValue;

  return (
    <View style={[styles.container, style]} onLayout={handleLayout} {...panResponder.panHandlers}>
      <View style={[styles.track, { backgroundColor: colors.border.default }]}>
        <View
          style={[
            styles.filledTrack,
            {
              backgroundColor: colors.bg.primary,
              width: `${clampedValue * 100}%`
            }
          ]}
        />
      </View>
      <View
        style={[
          styles.thumb,
          {
            backgroundColor: "#ffffff",
            left: `${clampedValue * 100}%`
          }
        ]}
      />
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    height: 44,
    justifyContent: "center",
    flex: 1
  },
  track: {
    height: 4,
    borderRadius: 2
  },
  filledTrack: {
    height: 4,
    borderRadius: 2
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
    elevation: 4
  }
});

export default VolumeSlider;
