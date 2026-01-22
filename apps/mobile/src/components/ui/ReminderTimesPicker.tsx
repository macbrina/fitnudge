import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, Platform, Modal, NativeModules } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useStyles } from "@/themes/makeStyles";
import { useTheme } from "@/themes";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useTranslation } from "@/lib/i18n";
import Button from "@/components/ui/Button";
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

interface ReminderTimesPickerProps {
  value: string[]; // Array of HH:MM format strings
  onChange: (times: string[]) => void;
  label?: string;
  description?: string;
  error?: string;
  disabled?: boolean;
  maxTimes?: number;
  is24Hour?: boolean; // If not provided, will use device preference
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
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
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[1])
  },
  timesList: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[3])
  },
  timeChip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: `${brand.primary}15`,
    borderRadius: toRN(tokens.borderRadius.md),
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    gap: toRN(tokens.spacing[2])
  },
  timeChipDisabled: {
    opacity: 0.5
  },
  timeText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: brand.primary
  },
  removeButton: {
    width: toRN(20),
    height: toRN(20),
    alignItems: "center" as const,
    justifyContent: "center" as const
  },
  removeText: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    color: brand.primary,
    lineHeight: toRN(tokens.typography.fontSize.xl)
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
  },
  iosPickerTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  }
});

export function ReminderTimesPicker({
  value = [],
  onChange,
  label,
  description,
  error,
  disabled = false,
  maxTimes = 5,
  is24Hour
}: ReminderTimesPickerProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { colors, brandColors, isDark } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState<Date>(() => {
    const date = new Date();
    date.setHours(9, 0, 0, 0);
    return date;
  });

  // Use device preference if is24Hour not explicitly set
  const effectiveIs24Hour = useMemo(() => {
    return is24Hour ?? getDeviceIs24Hour();
  }, [is24Hour]);

  // Format Date to HH:MM (24-hour format for backend)
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
        addTime(selectedDate);
      }
    } else {
      // iOS - just update selected time, don't add yet
      if (selectedDate) {
        setSelectedTime(selectedDate);
      }
    }
  };

  const addTime = (date: Date) => {
    const timeStr = formatTimeForStorage(date);

    // Check for duplicates
    if (value.includes(timeStr)) {
      return; // Could show an alert here
    }

    // Check max times
    if (value.length >= maxTimes) {
      return; // Could show an alert here
    }

    // Add and sort
    const newTimes = [...value, timeStr].sort();
    onChange(newTimes);
  };

  const handleIOSConfirm = () => {
    addTime(selectedTime);
    setShowPicker(false);
  };

  const handleIOSCancel = () => {
    setShowPicker(false);
  };

  const removeTime = (timeToRemove: string) => {
    if (disabled) return;
    const newTimes = value.filter((t) => t !== timeToRemove);
    onChange(newTimes);
  };

  const openPicker = () => {
    if (disabled) return;
    if (value.length >= maxTimes) return;

    // Reset to 9:00 AM as default
    const defaultTime = new Date();
    defaultTime.setHours(9, 0, 0, 0);
    setSelectedTime(defaultTime);
    setShowPicker(true);
  };

  const canAddMore = value.length < maxTimes && !disabled;

  return (
    <View style={styles.container}>
      {(label || description) && (
        <View style={styles.labelRow}>
          {label && <Text style={styles.label}>{label}</Text>}
          {description && <Text style={styles.description}>{description}</Text>}
        </View>
      )}

      {/* Existing times */}
      {value.length > 0 && (
        <View style={styles.timesList}>
          {value.map((time) => (
            <View key={time} style={[styles.timeChip, disabled && styles.timeChipDisabled]}>
              <Text style={styles.timeText}>{formatTimeForDisplay(time)}</Text>
              {!disabled && (
                <TouchableOpacity onPress={() => removeTime(time)} style={styles.removeButton}>
                  <Text style={styles.removeText}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Add Time Button */}
      <Button
        title={t("goals.create.form.add_time") || "Add Time"}
        onPress={openPicker}
        variant="outline"
        size="md"
        disabled={!canAddMore}
        leftIcon="time-outline"
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Android TimePicker - shows directly */}
      {Platform.OS === "android" && showPicker && (
        <DateTimePicker
          value={selectedTime}
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
                    {t("common.cancel") || "Cancel"}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.iosPickerTitle}>
                  {t("goals.create.form.add_time") || "Add Time"}
                </Text>
                <TouchableOpacity style={styles.iosPickerButton} onPress={handleIOSConfirm}>
                  <Text style={styles.iosPickerButtonText}>{t("common.add") || "Add"}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={selectedTime}
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

export default ReminderTimesPicker;
