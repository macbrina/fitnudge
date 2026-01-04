import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import BackButton from "@/components/ui/BackButton";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { ApiError } from "@/services/api/base";
import { FitnessProfileResponse } from "@/services/api/onboarding";
import { useFitnessProfile, useUpdateFitnessProfile } from "@/hooks/api/useFitnessProfile";
import {
  FITNESS_LEVELS,
  PRIMARY_GOALS,
  CURRENT_FREQUENCIES,
  PREFERRED_LOCATIONS,
  AVAILABLE_TIMES,
  MOTIVATION_STYLES,
  BIGGEST_CHALLENGES,
  AVAILABLE_EQUIPMENT,
  BIOLOGICAL_SEX_OPTIONS,
  HYDRATION_UNITS,
  HYDRATION_TARGETS
} from "@/constants/personalization";

type ModalType =
  | "fitness_level"
  | "primary_goal"
  | "current_frequency"
  | "preferred_location"
  | "available_time"
  | "motivation_style"
  | "biggest_challenge"
  | "available_equipment"
  | "biological_sex"
  | "hydration_unit"
  | "hydration_target"
  | null;

interface MenuItem {
  id: ModalType;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
  getValue: (profile: FitnessProfileResponse | null) => string;
}

export default function PersonalizationScreen() {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert } = useAlertModal();

  // Use React Query for caching
  const { data: profile, isLoading } = useFitnessProfile();
  const updateProfileMutation = useUpdateFitnessProfile();

  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // For multi-select (equipment)
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  // For custom hydration target
  const [customHydrationTarget, setCustomHydrationTarget] = useState("");

  // Sync selectedEquipment when profile loads
  useEffect(() => {
    if (profile?.available_equipment) {
      setSelectedEquipment(profile.available_equipment);
    }
  }, [profile?.available_equipment]);

  // Track which value is being saved
  const [savingValue, setSavingValue] = useState<string | string[] | number | null>(null);

  const isSaving = updateProfileMutation.isPending;

  const updateField = async (field: string, value: string | string[] | number) => {
    if (!profile) return;

    // Track which value is being saved (for showing loading on that option)
    setSavingValue(value);

    try {
      await updateProfileMutation.mutateAsync({ [field]: value });
      // Close modal only on success
      setActiveModal(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof ApiError ? error.message : t("errors.update_failed");
      showAlert({
        title: t("common.error"),
        message: errorMessage,
        variant: "error"
      });
    } finally {
      setSavingValue(null);
    }
  };

  const getLabel = useCallback(
    (labelKey: string): string => {
      return t(labelKey) || labelKey.split(".").pop() || "";
    },
    [t]
  );

  // Menu items configuration
  const menuItems: MenuItem[] = [
    {
      id: "fitness_level",
      icon: "fitness-outline",
      labelKey: "personalization.fitness_level",
      getValue: (p) => {
        const item = FITNESS_LEVELS.find((l) => l.value === p?.fitness_level);
        return item ? getLabel(item.labelKey) : "-";
      }
    },
    {
      id: "primary_goal",
      icon: "flag-outline",
      labelKey: "personalization.primary_goal",
      getValue: (p) => {
        const item = PRIMARY_GOALS.find((g) => g.value === p?.primary_goal);
        return item ? getLabel(item.labelKey) : "-";
      }
    },
    {
      id: "current_frequency",
      icon: "calendar-outline",
      labelKey: "personalization.current_frequency",
      getValue: (p) => {
        const item = CURRENT_FREQUENCIES.find((f) => f.value === p?.current_frequency);
        return item ? getLabel(item.labelKey) : "-";
      }
    },
    {
      id: "preferred_location",
      icon: "location-outline",
      labelKey: "personalization.preferred_location",
      getValue: (p) => {
        const item = PREFERRED_LOCATIONS.find((l) => l.value === p?.preferred_location);
        return item ? getLabel(item.labelKey) : "-";
      }
    },
    {
      id: "available_time",
      icon: "time-outline",
      labelKey: "personalization.available_time",
      getValue: (p) => {
        const item = AVAILABLE_TIMES.find((t) => t.value === p?.available_time);
        return item ? getLabel(item.labelKey) : "-";
      }
    },
    {
      id: "motivation_style",
      icon: "heart-outline",
      labelKey: "personalization.motivation_style",
      getValue: (p) => {
        const item = MOTIVATION_STYLES.find((m) => m.value === p?.motivation_style);
        return item ? getLabel(item.labelKey) : "-";
      }
    },
    {
      id: "biggest_challenge",
      icon: "alert-circle-outline",
      labelKey: "personalization.biggest_challenge",
      getValue: (p) => {
        const item = BIGGEST_CHALLENGES.find((c) => c.value === p?.biggest_challenge);
        return item ? getLabel(item.labelKey) : "-";
      }
    },
    {
      id: "available_equipment",
      icon: "barbell-outline",
      labelKey: "personalization.available_equipment",
      getValue: (p) => {
        const count = p?.available_equipment?.length || 0;
        if (count === 0) return t("personalization.no_equipment") || "None selected";
        return t("personalization.equipment_count", { count }) || `${count} items`;
      }
    },
    {
      id: "biological_sex",
      icon: "person-outline",
      labelKey: "personalization.biological_sex",
      getValue: (p) => {
        const item = BIOLOGICAL_SEX_OPTIONS.find((s) => s.value === p?.biological_sex);
        return item ? getLabel(item.labelKey) : t("personalization.not_set") || "Not set";
      }
    },
    {
      id: "hydration_unit",
      icon: "water-outline",
      labelKey: "personalization.hydration_unit",
      getValue: (p) => {
        const unit = p?.hydration_unit || "ml";
        return unit === "ml" ? "Milliliters (ml)" : "Ounces (oz)";
      }
    },
    {
      id: "hydration_target",
      icon: "water-outline",
      labelKey: "personalization.hydration_target",
      getValue: (p) => {
        const target = p?.hydration_daily_target_ml || 2000;
        const unit = p?.hydration_unit || "ml";
        if (unit === "oz") {
          return `${Math.round(target / 29.5735)} oz`;
        }
        return `${(target / 1000).toFixed(1)}L (${Math.round(target / 250)} glasses)`;
      }
    }
  ];

  const renderMenuItem = (item: MenuItem) => {
    const value = item.getValue(profile ?? null);

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.menuItem}
        onPress={() => {
          if (item.id === "available_equipment") {
            setSelectedEquipment(profile?.available_equipment || []);
          }
          if (item.id === "hydration_target") {
            setCustomHydrationTarget(String(profile?.hydration_daily_target_ml || 2000));
          }
          setActiveModal(item.id);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.menuItemLeft}>
          <Text style={styles.menuItemLabel}>{t(item.labelKey)}</Text>
        </View>
        <View style={styles.menuItemRight}>
          <Text style={styles.menuItemValue} numberOfLines={1}>
            {value}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderSingleSelectModal = (
    title: string,
    options: readonly { value: string; labelKey: string; icon?: string }[],
    currentValue: string | undefined,
    field: string
  ) => (
    <Modal
      visible={activeModal === field}
      transparent
      animationType="fade"
      onRequestClose={() => !isSaving && setActiveModal(null)}
    >
      <Pressable style={styles.modalOverlay} onPress={() => !isSaving && setActiveModal(null)}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{title}</Text>

          <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
            {options.map((option) => {
              const isSelected = currentValue === option.value;
              const isSavingThis = isSaving && savingValue === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                  onPress={() => !isSaving && updateField(field, option.value)}
                  activeOpacity={0.7}
                  disabled={isSaving}
                >
                  {option.icon && (
                    <Ionicons
                      name={option.icon as any}
                      size={20}
                      color={isSelected ? brandColors.primary : colors.text.secondary}
                      style={styles.optionIcon}
                    />
                  )}
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {getLabel(option.labelKey)}
                  </Text>
                  {isSavingThis ? (
                    <ActivityIndicator size="small" color={brandColors.primary} />
                  ) : isSelected ? (
                    <Ionicons name="checkmark-circle" size={20} color={brandColors.primary} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Button
            title={t("common.cancel")}
            variant="ghost"
            size="sm"
            onPress={() => setActiveModal(null)}
            fullWidth
            style={styles.modalCloseButton}
            disabled={isSaving}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );

  const renderEquipmentModal = () => (
    <Modal
      visible={activeModal === "available_equipment"}
      transparent
      animationType="fade"
      onRequestClose={() => !isSaving && setActiveModal(null)}
    >
      <Pressable style={styles.modalOverlay} onPress={() => !isSaving && setActiveModal(null)}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{t("personalization.select_equipment")}</Text>

          <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
            {AVAILABLE_EQUIPMENT.map((equipment) => {
              const isSelected = selectedEquipment.includes(equipment.value);
              return (
                <TouchableOpacity
                  key={equipment.value}
                  style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                  onPress={() => {
                    if (equipment.value === "none") {
                      setSelectedEquipment(["none"]);
                    } else {
                      setSelectedEquipment((prev) => {
                        const filtered = prev.filter((e) => e !== "none");
                        if (isSelected) {
                          return filtered.filter((e) => e !== equipment.value);
                        }
                        return [...filtered, equipment.value];
                      });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={equipment.icon as any}
                    size={20}
                    color={isSelected ? brandColors.primary : colors.text.secondary}
                    style={styles.optionIcon}
                  />
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {getLabel(equipment.labelKey)}
                  </Text>
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.modalButtonRow}>
            <Button
              title={t("common.cancel")}
              variant="ghost"
              size="sm"
              onPress={() => setActiveModal(null)}
              flex
              disabled={isSaving}
            />
            <Button
              title={t("common.save")}
              variant="primary"
              size="sm"
              onPress={() => updateField("available_equipment", selectedEquipment)}
              loading={isSaving}
              flex
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const renderHydrationTargetModal = () => {
    const unit = profile?.hydration_unit || "ml";

    return (
      <Modal
        visible={activeModal === "hydration_target"}
        transparent
        animationType="fade"
        onRequestClose={() => !isSaving && setActiveModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => !isSaving && setActiveModal(null)}>
          <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t("personalization.daily_hydration_target")}</Text>

            <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
              {HYDRATION_TARGETS.map((target) => {
                const currentTarget = profile?.hydration_daily_target_ml || 2000;
                const isSelected = currentTarget === target.value;
                const isSavingThis = isSaving && savingValue === target.value;
                const label = unit === "ml" ? target.labelMl : target.labelOz;

                return (
                  <TouchableOpacity
                    key={target.value}
                    style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                    onPress={() => {
                      if (!isSaving) updateField("hydration_daily_target_ml", target.value);
                    }}
                    activeOpacity={0.7}
                    disabled={isSaving}
                  >
                    <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                      {label}
                    </Text>
                    {isSavingThis ? (
                      <ActivityIndicator size="small" color={brandColors.primary} />
                    ) : isSelected ? (
                      <Ionicons name="checkmark-circle" size={20} color={brandColors.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}

              {/* Custom input */}
              <View style={styles.customInputContainer}>
                <Text style={styles.customInputLabel}>
                  {t("personalization.custom_target") || "Custom target"}
                </Text>
                <View style={styles.customInputRow}>
                  <TextInput
                    style={styles.customInput}
                    value={customHydrationTarget}
                    onChangeText={setCustomHydrationTarget}
                    keyboardType="number-pad"
                    placeholder={unit === "ml" ? "2000" : "67"}
                    placeholderTextColor={colors.text.tertiary}
                    editable={!isSaving}
                  />
                  <Text style={styles.customInputUnit}>{unit}</Text>
                  <Button
                    title={t("common.apply")}
                    variant="primary"
                    size="sm"
                    loading={
                      isSaving &&
                      typeof savingValue === "number" &&
                      !HYDRATION_TARGETS.some((t) => t.value === savingValue)
                    }
                    disabled={isSaving}
                    onPress={() => {
                      const value = parseInt(customHydrationTarget, 10);
                      if (value > 0) {
                        // Convert oz to ml if needed
                        const mlValue = unit === "oz" ? Math.round(value * 29.5735) : value;
                        updateField("hydration_daily_target_ml", mlValue);
                      }
                    }}
                  />
                </View>
              </View>
            </ScrollView>

            <Button
              title={t("common.cancel")}
              variant="ghost"
              size="sm"
              disabled={isSaving}
              onPress={() => setActiveModal(null)}
              fullWidth
              style={styles.modalCloseButton}
            />
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <BackButton
          title={t("personalization.title") || "Personalization"}
          onPress={() => router.back()}
        />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Fitness Section Skeleton */}
          <View style={styles.section}>
            <SkeletonBox width={80} height={16} borderRadius={8} style={{ marginBottom: 12 }} />
            <SkeletonBox width="100%" height={350} borderRadius={16} />
          </View>
          {/* Body & Health Section Skeleton */}
          <View style={styles.section}>
            <SkeletonBox width={120} height={16} borderRadius={8} style={{ marginBottom: 12 }} />
            <SkeletonBox width="100%" height={200} borderRadius={16} />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackButton
        title={t("personalization.title") || "Personalization"}
        onPress={() => router.back()}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Fitness Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("personalization.fitness_section") || "Fitness"}
          </Text>
          <Card style={styles.menuCard}>
            {menuItems.slice(0, 7).map((item, index) => (
              <React.Fragment key={item.id}>
                {renderMenuItem(item)}
                {index < 6 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </Card>
        </View>

        {/* Equipment Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("personalization.equipment_section") || "Equipment"}
          </Text>
          <Card style={styles.menuCard}>{renderMenuItem(menuItems[7])}</Card>
        </View>

        {/* Personal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("personalization.personal_section") || "Personal"}
          </Text>
          <Card style={styles.menuCard}>{renderMenuItem(menuItems[8])}</Card>
        </View>

        {/* Hydration Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("personalization.hydration_section") || "Hydration"}
          </Text>
          <Card style={styles.menuCard}>
            {menuItems.slice(9).map((item, index) => (
              <React.Fragment key={item.id}>
                {renderMenuItem(item)}
                {index < 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </Card>
        </View>
      </ScrollView>

      {/* Modals */}
      {renderSingleSelectModal(
        t("personalization.select_fitness_level"),
        FITNESS_LEVELS,
        profile?.fitness_level,
        "fitness_level"
      )}
      {renderSingleSelectModal(
        t("personalization.select_primary_goal"),
        PRIMARY_GOALS,
        profile?.primary_goal,
        "primary_goal"
      )}
      {renderSingleSelectModal(
        t("personalization.select_frequency"),
        CURRENT_FREQUENCIES,
        profile?.current_frequency,
        "current_frequency"
      )}
      {renderSingleSelectModal(
        t("personalization.select_location"),
        PREFERRED_LOCATIONS,
        profile?.preferred_location,
        "preferred_location"
      )}
      {renderSingleSelectModal(
        t("personalization.select_time"),
        AVAILABLE_TIMES,
        profile?.available_time,
        "available_time"
      )}
      {renderSingleSelectModal(
        t("personalization.select_motivation"),
        MOTIVATION_STYLES,
        profile?.motivation_style,
        "motivation_style"
      )}
      {renderSingleSelectModal(
        t("personalization.select_challenge"),
        BIGGEST_CHALLENGES,
        profile?.biggest_challenge,
        "biggest_challenge"
      )}
      {renderSingleSelectModal(
        t("personalization.select_biological_sex"),
        BIOLOGICAL_SEX_OPTIONS,
        profile?.biological_sex,
        "biological_sex"
      )}
      {renderSingleSelectModal(
        t("personalization.select_hydration_unit"),
        HYDRATION_UNITS,
        profile?.hydration_unit,
        "hydration_unit"
      )}
      {renderEquipmentModal()}
      {renderHydrationTargetModal()}
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.canvas
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: toRN(tokens.spacing[8])
  },
  // Sections
  section: {
    marginTop: toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.tertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: toRN(tokens.spacing[2]),
    marginLeft: toRN(tokens.spacing[1])
  },
  menuCard: {
    padding: 0,
    overflow: "hidden" as const
  },
  // Menu Item
  menuItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: toRN(tokens.spacing[4])
  },
  menuItemLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    flex: 1
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: toRN(tokens.spacing[3])
  },
  menuItemLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary,
    flex: 1
  },
  menuItemRight: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2]),
    maxWidth: "50%" as const
  },
  menuItemValue: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginLeft: 52
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[4])
  },
  modalContainer: {
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.xl),
    padding: toRN(tokens.spacing[4]),
    width: "100%" as const,
    maxWidth: 380,
    maxHeight: "80%" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  modalTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  optionsList: {
    maxHeight: 350
  },
  optionItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[3]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    borderRadius: toRN(tokens.borderRadius.lg),
    marginBottom: toRN(tokens.spacing[1]),
    backgroundColor: colors.bg.canvas,
    borderWidth: 1.5,
    borderColor: "transparent"
  },
  optionItemSelected: {
    backgroundColor: `${brand.primary}10`,
    borderColor: `${brand.primary}30`
  },
  optionIcon: {
    marginRight: toRN(tokens.spacing[3])
  },
  optionLabel: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.primary
  },
  optionLabelSelected: {
    color: brand.primary,
    fontFamily: fontFamily.semiBold
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border.default,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  checkboxSelected: {
    backgroundColor: brand.primary,
    borderColor: brand.primary
  },
  modalCloseButton: {
    marginTop: toRN(tokens.spacing[3])
  },
  modalButtonRow: {
    flexDirection: "row" as const,
    gap: toRN(tokens.spacing[3]),
    marginTop: toRN(tokens.spacing[3])
  },
  // Custom input
  customInputContainer: {
    marginTop: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg)
  },
  customInputLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    marginBottom: toRN(tokens.spacing[2])
  },
  customInputRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[2])
  },
  customInput: {
    flex: 1,
    height: 40,
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.md),
    paddingHorizontal: toRN(tokens.spacing[3]),
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.default
  },
  customInputUnit: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    minWidth: 30
  }
});
