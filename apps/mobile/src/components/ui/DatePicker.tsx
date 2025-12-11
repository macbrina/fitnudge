import React, { useState } from "react";
import { View, Text, TouchableOpacity, Platform, Modal } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useStyles } from "@/themes/makeStyles";
import { useTheme } from "@/themes";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { tokens } from "@/themes/tokens";
import { Ionicons } from "@expo/vector-icons";

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
  description?: string;
  error?: string;
  disabled?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
}

const makeDatePickerStyles = (tokens: any, colors: any, brand: any) => {
  return {
    container: {
      marginBottom: toRN(tokens.spacing[4]),
    },
    labelRow: {
      marginBottom: toRN(tokens.spacing[2]),
    },
    label: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontFamily: fontFamily.semiBold,
      color: colors.text.primary,
    },
    description: {
      fontSize: toRN(tokens.typography.fontSize.xs),
      fontFamily: fontFamily.regular,
      color: colors.text.tertiary,
      marginTop: toRN(tokens.spacing[1]),
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
      minHeight: 52,
    },
    inputContainerError: {
      borderColor: colors.feedback?.error || "#ef4444",
    },
    inputContainerDisabled: {
      opacity: 0.6,
    },
    dateText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontFamily: fontFamily.medium,
      color: colors.text.primary,
    },
    iconContainer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: toRN(tokens.spacing[2]),
    },
    errorText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.feedback?.error || "#ef4444",
      marginTop: toRN(tokens.spacing[1]),
      fontFamily: fontFamily.regular,
    },
    // iOS Modal styles
    iosModalOverlay: {
      flex: 1,
      justifyContent: "flex-end" as const,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    iosPickerContainer: {
      backgroundColor: colors.bg.card,
      borderTopLeftRadius: toRN(tokens.borderRadius["2xl"]),
      borderTopRightRadius: toRN(tokens.borderRadius["2xl"]),
      paddingBottom: toRN(tokens.spacing[8]),
    },
    iosPickerHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingHorizontal: toRN(tokens.spacing[4]),
      paddingVertical: toRN(tokens.spacing[3]),
      borderBottomWidth: 1,
      borderBottomColor: colors.border.default,
    },
    iosPickerButton: {
      paddingHorizontal: toRN(tokens.spacing[3]),
      paddingVertical: toRN(tokens.spacing[2]),
    },
    iosPickerButtonText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontFamily: fontFamily.semiBold,
      color: brand.primary,
    },
    iosPickerCancelText: {
      color: colors.text.secondary,
    },
  };
};

export function DatePicker({
  value,
  onChange,
  label,
  description,
  error,
  disabled = false,
  minimumDate,
  maximumDate,
}: DatePickerProps) {
  const styles = useStyles(makeDatePickerStyles);
  const { colors, brandColors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(value);

  // Format date for display
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
      if (event.type === "set" && selectedDate) {
        onChange(selectedDate);
      }
    } else {
      // iOS - just update temp date, don't close yet
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  };

  const handleIOSConfirm = () => {
    onChange(tempDate);
    setShowPicker(false);
  };

  const handleIOSCancel = () => {
    setTempDate(value);
    setShowPicker(false);
  };

  const openPicker = () => {
    if (!disabled) {
      setTempDate(value);
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
      <TouchableOpacity
        onPress={openPicker}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.inputContainer,
            error && styles.inputContainerError,
            disabled && styles.inputContainerDisabled,
          ]}
        >
          <Text style={styles.dateText}>{formatDate(value)}</Text>
          <View style={styles.iconContainer}>
            <Ionicons
              name="calendar-outline"
              size={20}
              color={brandColors.primary}
            />
          </View>
        </View>
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Android DatePicker - shows directly */}
      {Platform.OS === "android" && showPicker && (
        <DateTimePicker
          value={value}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}

      {/* iOS DatePicker - shows in a modal */}
      {Platform.OS === "ios" && (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
          onRequestClose={handleIOSCancel}
        >
          <View style={styles.iosModalOverlay}>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={handleIOSCancel}
              activeOpacity={1}
            />
            <View style={styles.iosPickerContainer}>
              <View style={styles.iosPickerHeader}>
                <TouchableOpacity
                  style={styles.iosPickerButton}
                  onPress={handleIOSCancel}
                >
                  <Text
                    style={[
                      styles.iosPickerButtonText,
                      styles.iosPickerCancelText,
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iosPickerButton}
                  onPress={handleIOSConfirm}
                >
                  <Text style={styles.iosPickerButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                style={{ height: 200 }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
