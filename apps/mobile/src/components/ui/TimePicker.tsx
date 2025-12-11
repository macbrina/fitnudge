import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useStyles } from "@/themes/makeStyles";
import { useTheme } from "@/themes";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { tokens } from "@/themes/tokens";
import { Ionicons } from "@expo/vector-icons";

interface TimePickerProps {
  value: string; // HH:MM format
  onChange: (time: string) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
}

const makeTimePickerStyles = (tokens: any, colors: any, brand: any) => {
  return {
    container: {
      marginBottom: toRN(tokens.spacing[4]),
    },
    label: {
      fontSize: toRN(tokens.typography.fontSize.base),
      fontWeight: tokens.typography.fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[2]),
      fontFamily: fontFamily.groteskSemiBold,
    },
    inputContainer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: toRN(tokens.borderRadius.lg),
      backgroundColor: colors.bg.surface,
      paddingHorizontal: toRN(tokens.spacing[4]),
      paddingVertical: toRN(tokens.spacing[3]),
      minHeight: 48,
    },
    inputContainerFocused: {
      borderColor: brand.primary,
      borderWidth: 2,
    },
    inputContainerError: {
      borderColor: colors.error || "#ef4444",
    },
    input: {
      flex: 1,
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.primary,
      fontFamily: fontFamily.groteskMedium,
      padding: 0,
    },
    iconButton: {
      padding: toRN(tokens.spacing[2]),
      marginLeft: toRN(tokens.spacing[2]),
    },
    errorText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.error || "#ef4444",
      marginTop: toRN(tokens.spacing[1]),
      fontFamily: fontFamily.groteskRegular,
    },
  };
};

export function TimePicker({
  value,
  onChange,
  label,
  error,
  disabled = false,
}: TimePickerProps) {
  const styles = useStyles(makeTimePickerStyles);
  const { colors, brandColors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Parse HH:MM to Date object for picker
  const getDateFromTime = (timeStr: string): Date => {
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
  };

  // Format Date to HH:MM
  const formatTime = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }

    if (selectedDate) {
      const timeStr = formatTime(selectedDate);
      onChange(timeStr);
    }
  };

  const handleTextChange = (text: string) => {
    // Allow only digits and colon
    const cleaned = text.replace(/[^\d:]/g, "");

    // Auto-format as user types
    if (cleaned.length <= 2) {
      // Just hours
      onChange(cleaned);
    } else if (cleaned.length === 3 && !cleaned.includes(":")) {
      // Insert colon: "123" -> "12:3"
      onChange(`${cleaned.slice(0, 2)}:${cleaned.slice(2)}`);
    } else if (cleaned.length <= 5) {
      // HH:MM format
      const parts = cleaned.split(":");
      if (parts[0] && parseInt(parts[0]) > 23) {
        parts[0] = "23";
      }
      if (parts[1] && parseInt(parts[1]) > 59) {
        parts[1] = "59";
      }
      onChange(cleaned);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Validate and format on blur
    if (value) {
      const parts = value.split(":");
      if (parts.length === 2) {
        const hours = String(parseInt(parts[0] || "0")).padStart(2, "0");
        const minutes = String(parseInt(parts[1] || "0")).padStart(2, "0");
        const formatted = `${hours}:${minutes}`;
        if (formatted !== value) {
          onChange(formatted);
        }
      }
    }
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          error && styles.inputContainerError,
          disabled && { opacity: 0.6 },
        ]}
      >
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleTextChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          placeholder="09:00"
          placeholderTextColor={colors.text.tertiary}
          keyboardType="numeric"
          maxLength={5}
          editable={!disabled}
        />
        {Platform.OS === "ios" && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowPicker(true)}
            disabled={disabled}
          >
            <Ionicons
              name="time-outline"
              size={24}
              color={brandColors.primary}
            />
          </TouchableOpacity>
        )}
        {Platform.OS === "android" && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowPicker(true)}
            disabled={disabled}
          >
            <Ionicons
              name="time-outline"
              size={24}
              color={brandColors.primary}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {showPicker && (
        <DateTimePicker
          value={getDateFromTime(value)}
          mode="time"
          is24Hour={true}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleTimeChange}
        />
      )}
      {Platform.OS === "android" && showPicker && (
        <DateTimePicker
          value={getDateFromTime(value)}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
}
