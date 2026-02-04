import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown } from "lucide-react-native";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { useTheme } from "@/themes";

/** Options for reminder_window_before_minutes: 0 = exact time, else minutes before */
export const REMINDER_BEFORE_OPTIONS = [0, 5, 10, 15, 20, 30, 60, 120] as const;

/** Options for checkin_prompt_delay_minutes: 0 = at reminder time, else minutes after */
export const CHECKIN_DELAY_OPTIONS = [0, 5, 10, 15, 20, 30, 60, 120] as const;

interface ReminderOptionsPickerProps {
  reminderBeforeMinutes: number;
  checkinDelayMinutes: number;
  onReminderBeforeChange: (minutes: number) => void;
  onCheckinDelayChange: (minutes: number) => void;
  label?: string;
  disabled?: boolean;
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    marginBottom: toRN(tokens.spacing[4])
  },
  label: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontWeight: tokens.typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3]),
    fontFamily: fontFamily.groteskMedium
  },
  selectRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[2]),
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  selectRowDisabled: {
    opacity: 0.5
  },
  selectLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    color: colors.text.tertiary,
    fontFamily: fontFamily.groteskMedium
  },
  selectValue: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontWeight: tokens.typography.fontWeight.medium,
    color: colors.text.primary,
    fontFamily: fontFamily.groteskMedium
  },
  selectChevron: {
    marginLeft: toRN(tokens.spacing[2])
  },
  // Bottom sheet styles
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end" as const,
    backgroundColor: "transparent"
  },
  sheetContainer: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: toRN(tokens.borderRadius["2xl"]),
    borderTopRightRadius: toRN(tokens.borderRadius["2xl"]),
    maxHeight: "60%"
  },
  sheetHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default
  },
  sheetTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontWeight: tokens.typography.fontWeight.semibold,
    color: colors.text.primary,
    fontFamily: fontFamily.groteskSemiBold
  },
  sheetClose: {
    padding: toRN(tokens.spacing[2])
  },
  sheetCloseText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontWeight: tokens.typography.fontWeight.medium,
    color: brand.primary,
    fontFamily: fontFamily.groteskMedium
  },
  optionItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  optionItemLast: {
    borderBottomWidth: 0
  },
  optionItemSelected: {
    backgroundColor: brand.primary + "10"
  },
  optionText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.groteskMedium,
    color: colors.text.primary
  },
  optionTextSelected: {
    color: brand.primary,
    fontWeight: tokens.typography.fontWeight.semibold
  },
  hintRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[1])
  },
  hintText: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    lineHeight: toRN(tokens.typography.fontSize.xs) * 1.4
  }
});

type SheetType = "reminder" | "checkin" | null;

export function ReminderOptionsPicker({
  reminderBeforeMinutes,
  checkinDelayMinutes,
  onReminderBeforeChange,
  onCheckinDelayChange,
  label,
  disabled = false
}: ReminderOptionsPickerProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { brandColors } = useTheme();
  const insets = useSafeAreaInsets();
  const [sheetType, setSheetType] = useState<SheetType>(null);

  const getReminderBeforeLabel = (mins: number) =>
    mins === 0
      ? t("goals.reminder_exact_time")
      : t("goals.reminder_minutes_before", { minutes: mins });

  const getCheckinDelayLabel = (mins: number) =>
    mins === 0
      ? t("goals.checkin_prompt_at_reminder")
      : t("goals.checkin_prompt_minutes_after", { minutes: mins });

  const handleSelectReminder = (mins: number) => {
    onReminderBeforeChange(mins);
    setSheetType(null);
  };

  const handleSelectCheckin = (mins: number) => {
    onCheckinDelayChange(mins);
    setSheetType(null);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Reminder when - select */}
      <TouchableOpacity
        style={[styles.selectRow, disabled && styles.selectRowDisabled]}
        onPress={() => !disabled && setSheetType("reminder")}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Text style={styles.selectLabel}>{t("goals.reminder_when_label")}</Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={[styles.selectValue, { color: brandColors.primary }]}>
            {getReminderBeforeLabel(reminderBeforeMinutes)}
          </Text>
          <ChevronDown size={18} color={brandColors.primary} style={styles.selectChevron} />
        </View>
      </TouchableOpacity>

      {/* Check-in prompt when - select */}
      <TouchableOpacity
        style={[styles.selectRow, disabled && styles.selectRowDisabled]}
        onPress={() => !disabled && setSheetType("checkin")}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Text style={styles.selectLabel}>{t("goals.checkin_prompt_when_label")}</Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={[styles.selectValue, { color: brandColors.primary }]}>
            {getCheckinDelayLabel(checkinDelayMinutes)}
          </Text>
          <ChevronDown size={18} color={brandColors.primary} style={styles.selectChevron} />
        </View>
      </TouchableOpacity>

      {/* Hint: keep check-in prompt on same day */}
      <View style={styles.hintRow}>
        <Ionicons name="information-circle-outline" size={14} color={brandColors.primary} />
        <Text style={styles.hintText}>{t("goals.checkin_prompt_same_day_hint")}</Text>
      </View>

      {/* Bottom sheet - Reminder when */}
      <Modal
        visible={sheetType === "reminder"}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetType(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)" }}
            activeOpacity={1}
            onPress={() => setSheetType(null)}
          />
          <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + toRN(16) }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t("goals.reminder_when_label")}</Text>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setSheetType(null)}>
                <Text style={styles.sheetCloseText}>{t("common.close")}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {REMINDER_BEFORE_OPTIONS.map((mins, idx) => {
                const isSelected = reminderBeforeMinutes === mins;
                const isLast = idx === REMINDER_BEFORE_OPTIONS.length - 1;
                return (
                  <TouchableOpacity
                    key={`before-${mins}`}
                    style={[
                      styles.optionItem,
                      isLast && styles.optionItemLast,
                      isSelected && [
                        styles.optionItemSelected,
                        { backgroundColor: brandColors.primary + "15" }
                      ]
                    ]}
                    onPress={() => handleSelectReminder(mins)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && [styles.optionTextSelected, { color: brandColors.primary }]
                      ]}
                    >
                      {getReminderBeforeLabel(mins)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bottom sheet - Check-in prompt when */}
      <Modal
        visible={sheetType === "checkin"}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetType(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)" }}
            activeOpacity={1}
            onPress={() => setSheetType(null)}
          />
          <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + toRN(16) }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t("goals.checkin_prompt_when_label")}</Text>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setSheetType(null)}>
                <Text style={styles.sheetCloseText}>{t("common.close")}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CHECKIN_DELAY_OPTIONS.map((mins, idx) => {
                const isSelected = checkinDelayMinutes === mins;
                const isLast = idx === CHECKIN_DELAY_OPTIONS.length - 1;
                return (
                  <TouchableOpacity
                    key={`delay-${mins}`}
                    style={[
                      styles.optionItem,
                      isLast && styles.optionItemLast,
                      isSelected && [
                        styles.optionItemSelected,
                        { backgroundColor: brandColors.primary + "15" }
                      ]
                    ]}
                    onPress={() => handleSelectCheckin(mins)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && [styles.optionTextSelected, { color: brandColors.primary }]
                      ]}
                    >
                      {getCheckinDelayLabel(mins)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default ReminderOptionsPicker;
