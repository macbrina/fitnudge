import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, Platform, Modal } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useStyles } from "@/themes/makeStyles";
import { useTheme } from "@/themes";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { tokens } from "@/themes/tokens";
import { Ionicons } from "@expo/vector-icons";
import { formatReminderTime } from "@/utils/helper";

// Detect device 24-hour preference
const getDeviceIs24Hour = (): boolean => {
  try {
    // Check device locale by formatting a test time
    const testDate = new Date();
    testDate.setHours(14, 0); // 2:00 PM
    const formatted = testDate.toLocaleTimeString([], { hour: "numeric" });
    // If it contains "14" or "2" without AM/PM indicator
    return (
      formatted.includes("14") ||
      (!formatted.toLowerCase().includes("am") &&
        !formatted.toLowerCase().includes("pm") &&
        formatted.includes("2"))
    );
  } catch {
    return false; // Default to 12-hour
  }
};

interface TimePickerProps {
  value: string; // HH:MM format
  onChange: (time: string) => void;
  label?: string;
  description?: string;
  error?: string;
  disabled?: boolean;
  is24Hour?: boolean; // If not provided, will use device preference
}

const makeTimePickerStyles = (tokens: any, colors: any, brand: any) => {
  return {
    container: {
      marginBottom: toRN(tokens.spacing[4])
    },
    labelRow: {
      marginBottom: toRN(tokens.spacing[2])
    },
    label: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontFamily: fontFamily.semiBold,
      color: colors.text.primary
    },
    description: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      fontFamily: fontFamily.regular,
      color: colors.text.tertiary,
      marginTop: toRN(tokens.spacing[1])
    },
    inputContainer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: toRN(tokens.borderRadius.lg),
      backgroundColor: colors.bg.surface,
      paddingHorizontal: toRN(tokens.spacing[4]),
      paddingVertical: toRN(tokens.spacing[3]),
      minHeight: 52
    },
    inputContainerError: {
      borderColor: colors.feedback?.error || "#ef4444"
    },
    inputContainerDisabled: {
      opacity: 0.6
    },
    timeText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontFamily: fontFamily.medium,
      color: colors.text.primary
    },
    placeholderText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontFamily: fontFamily.regular,
      color: colors.text.tertiary
    },
    iconContainer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: toRN(tokens.spacing[2])
    },
    errorText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.feedback?.error || "#ef4444",
      marginTop: toRN(tokens.spacing[1]),
      fontFamily: fontFamily.regular
    },
    // iOS Modal styles
    iosModalOverlay: {
      flex: 1,
      justifyContent: "flex-end" as const,
      backgroundColor: "rgba(0, 0, 0, 0.5)"
    },
    iosPickerContainer: {
      backgroundColor: colors.bg.card,
      borderTopLeftRadius: toRN(tokens.borderRadius["2xl"]),
      borderTopRightRadius: toRN(tokens.borderRadius["2xl"]),
      paddingBottom: toRN(tokens.spacing[8])
    },
    iosPickerHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingHorizontal: toRN(tokens.spacing[4]),
      paddingVertical: toRN(tokens.spacing[3]),
      borderBottomWidth: 1,
      borderBottomColor: colors.border.default
    },
    iosPickerButton: {
      paddingHorizontal: toRN(tokens.spacing[3]),
      paddingVertical: toRN(tokens.spacing[2])
    },
    iosPickerButtonText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontFamily: fontFamily.semiBold,
      color: brand.primary
    },
    iosPickerCancelText: {
      color: colors.text.secondary
    }
  };
};

export function TimePicker({
  value,
  onChange,
  label,
  description,
  error,
  disabled = false,
  is24Hour
}: TimePickerProps) {
  const styles = useStyles(makeTimePickerStyles);
  const { colors, brandColors, isDark } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [tempTime, setTempTime] = useState<Date>(() => getDateFromTime(value));

  // Use device preference if is24Hour not explicitly set
  const effectiveIs24Hour = useMemo(() => {
    return is24Hour ?? getDeviceIs24Hour();
  }, [is24Hour]);

  // Parse HH:MM to Date object for picker
  function getDateFromTime(timeStr: string): Date {
    if (!timeStr || !timeStr.includes(":")) {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
    }

    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date();
    date.setHours(hours || 9);
    date.setMinutes(minutes || 0);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date;
  }

  // Format Date to HH:MM
  const formatTimeForStorage = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  // Format time for display (uses device locale via formatReminderTime)
  const formatTimeForDisplay = (timeStr: string): string => {
    return formatReminderTime(timeStr);
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
      if (event.type === "set" && selectedDate) {
        onChange(formatTimeForStorage(selectedDate));
      }
    } else {
      // iOS - just update temp time, don't close yet
      if (selectedDate) {
        setTempTime(selectedDate);
      }
    }
  };

  const handleIOSConfirm = () => {
    onChange(formatTimeForStorage(tempTime));
    setShowPicker(false);
  };

  const handleIOSCancel = () => {
    setTempTime(getDateFromTime(value));
    setShowPicker(false);
  };

  const openPicker = () => {
    if (!disabled) {
      setTempTime(getDateFromTime(value));
      setShowPicker(true);
    }
  };

  return (
    <View style={styles.container}>
      {(label || description) && (
        <View style={styles.labelRow}>
          {label && <Text style={styles.label}>{label}</Text>}
          {description && <Text style={styles.description}>{description}</Text>}
        </View>
      )}
      <TouchableOpacity onPress={openPicker} disabled={disabled} activeOpacity={0.7}>
        <View
          style={[
            styles.inputContainer,
            error && styles.inputContainerError,
            disabled && styles.inputContainerDisabled
          ]}
        >
          {value ? (
            <Text style={styles.timeText}>{formatTimeForDisplay(value)}</Text>
          ) : (
            <Text style={styles.placeholderText}>Select time</Text>
          )}
          <View style={styles.iconContainer}>
            <Ionicons name="time-outline" size={20} color={brandColors.primary} />
          </View>
        </View>
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Android TimePicker - shows directly */}
      {Platform.OS === "android" && showPicker && (
        <DateTimePicker
          value={getDateFromTime(value)}
          mode="time"
          is24Hour={effectiveIs24Hour}
          display="default"
          onChange={handleTimeChange}
          themeVariant={isDark ? "dark" : "light"}
        />
      )}

      {/* iOS TimePicker - shows in a modal */}
      {Platform.OS === "ios" && (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
          onRequestClose={handleIOSCancel}
        >
          <View style={styles.iosModalOverlay}>
            <TouchableOpacity style={{ flex: 1 }} onPress={handleIOSCancel} activeOpacity={1} />
            <View style={styles.iosPickerContainer}>
              <View style={styles.iosPickerHeader}>
                <TouchableOpacity style={styles.iosPickerButton} onPress={handleIOSCancel}>
                  <Text style={[styles.iosPickerButtonText, styles.iosPickerCancelText]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iosPickerButton} onPress={handleIOSConfirm}>
                  <Text style={styles.iosPickerButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempTime}
                mode="time"
                is24Hour={effectiveIs24Hour}
                display="spinner"
                onChange={handleTimeChange}
                style={{ height: 200 }}
                themeVariant={isDark ? "dark" : "light"}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

export default TimePicker;
