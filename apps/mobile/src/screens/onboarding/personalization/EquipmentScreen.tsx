import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/lib/i18n";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { useStyles } from "@/themes/makeStyles";
import { lineHeight } from "@/themes/tokens";
import { useTheme } from "@/themes";
import PersonalizationLayout from "./PersonalizationLayout";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { AVAILABLE_EQUIPMENT } from "@/constants/personalization";

interface EquipmentScreenProps {
  onContinue: (equipment: string[]) => void;
  onBack?: () => void;
  currentStep: number;
  totalSteps: number;
}

export default function EquipmentScreen({
  onContinue,
  onBack,
  currentStep,
  totalSteps
}: EquipmentScreenProps) {
  const { available_equipment } = useOnboardingStore();
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(available_equipment || []);
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { brandColors } = useTheme();

  useEffect(() => {
    setSelectedEquipment(available_equipment || []);
  }, [available_equipment]);

  const handleToggleEquipment = (equipmentId: string) => {
    const option = AVAILABLE_EQUIPMENT.find((o) => o.value === equipmentId);

    // Check if the option has the "exclusive" property (only "none" has it)
    if (option && "exclusive" in option && option.exclusive) {
      setSelectedEquipment(["none"]);
    } else {
      setSelectedEquipment((prev) => {
        const withoutNone = prev.filter((id) => id !== "none");
        if (withoutNone.includes(equipmentId)) {
          return withoutNone.filter((id) => id !== equipmentId);
        } else {
          return [...withoutNone, equipmentId];
        }
      });
    }
  };

  const handleContinue = () => {
    const equipment = selectedEquipment.length > 0 ? selectedEquipment : ["none"];
    onContinue(equipment);
  };

  const isSelected = (equipmentId: string) => selectedEquipment.includes(equipmentId);

  return (
    <PersonalizationLayout
      currentStep={currentStep}
      totalSteps={totalSteps}
      onContinue={handleContinue}
      onBack={onBack}
      canContinue={true}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{t("onboarding.personalization.equipment.title")}</Text>

        <Text style={styles.subtitle}>{t("onboarding.personalization.equipment.subtitle")}</Text>

        <View style={styles.optionsContainer}>
          {AVAILABLE_EQUIPMENT.map((option) => {
            const selected = isSelected(option.value);
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => handleToggleEquipment(option.value)}
                activeOpacity={0.7}
                style={[
                  styles.optionCard,
                  selected && [styles.optionCardSelected, { borderColor: brandColors.primary }]
                ]}
              >
                <Text
                  style={[
                    styles.optionLabel,
                    selected && [styles.optionLabelSelected, { color: brandColors.primary }]
                  ]}
                >
                  {t(option.onboardingLabelKey)}
                </Text>

                {/* Checkbox */}
                <View
                  style={[
                    styles.checkbox,
                    selected && [
                      styles.checkboxSelected,
                      {
                        backgroundColor: brandColors.primary,
                        borderColor: brandColors.primary
                      }
                    ]
                  ]}
                >
                  {selected && <Ionicons name="checkmark" size={16} color="white" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </PersonalizationLayout>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => {
  return {
    content: {
      flex: 1,
      paddingTop: toRN(tokens.spacing[2])
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize["2xl"]),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[2]),
      fontFamily: fontFamily.groteskBold,
      lineHeight: lineHeight(tokens.typography.fontSize["2xl"], tokens.typography.lineHeight.tight)
    },
    subtitle: {
      fontSize: toRN(tokens.typography.fontSize.base),
      color: colors.text.secondary,
      marginBottom: toRN(tokens.spacing[6]),
      fontFamily: fontFamily.groteskRegular,
      lineHeight: lineHeight(tokens.typography.fontSize.base, tokens.typography.lineHeight.relaxed)
    },
    optionsContainer: {
      gap: toRN(tokens.spacing[3])
    },
    optionCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      backgroundColor: colors.bg.muted,
      borderRadius: toRN(tokens.borderRadius.xl),
      paddingVertical: toRN(tokens.spacing[5]),
      paddingHorizontal: toRN(tokens.spacing[5]),
      borderWidth: 2,
      borderColor: colors.border.subtle
    },
    optionCardSelected: {
      backgroundColor: brand.primary + "08"
    },
    optionLabel: {
      flex: 1,
      fontSize: toRN(tokens.typography.fontSize.lg),
      fontWeight: tokens.typography.fontWeight.semibold,
      color: colors.text.primary,
      fontFamily: fontFamily.groteskSemiBold
    },
    optionLabelSelected: {},
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border.default,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginLeft: toRN(tokens.spacing[3])
    },
    checkboxSelected: {}
  };
};
