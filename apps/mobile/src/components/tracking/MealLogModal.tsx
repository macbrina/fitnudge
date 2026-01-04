import React, { useState, useEffect, useMemo } from "react";
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  Animated,
  Dimensions,
  Easing,
  StatusBar,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import TextInput from "@/components/ui/TextInput";
import Button from "@/components/ui/Button";
import { ActionSheet } from "@/components/ui/ActionSheet";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { AlertOverlay, useAlertModal } from "@/contexts/AlertModalContext";
import {
  useLogMeal,
  useEstimateNutrition,
  useTodaysNutritionSummary
} from "@/hooks/api/useMealLogs";
import { useMediaPermissions } from "@/hooks/media/useMediaPermissions";
import { useUploadMedia, useDeleteMediaByUrl } from "@/hooks/api/useMedia";
import { MealTypeIcon, MEAL_TYPES } from "@/components/icons/MealTypeIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MealType, HealthRating } from "@/services/api/mealLogs";

interface MealLogModalProps {
  visible: boolean;
  onClose: () => void;
  goalId?: string;
  challengeId?: string;
  onSuccess?: () => void;
  /** Daily calorie target from the plan (defaults to 2000 if not provided) */
  calorieTarget?: number;
  /** Daily protein target in grams from the plan (defaults to 50g if not provided) */
  proteinTarget?: number;
}

// MEAL_TYPES imported from MealTypeIcons

const HEALTH_RATINGS: { key: HealthRating; color: string; label: string }[] = [
  { key: "healthy", color: "#22c55e", label: "Healthy" },
  { key: "okay", color: "#f59e0b", label: "Okay" },
  { key: "unhealthy", color: "#ef4444", label: "Unhealthy" }
];

export function MealLogModal({
  visible,
  onClose,
  goalId,
  challengeId,
  onSuccess,
  calorieTarget,
  proteinTarget
}: MealLogModalProps) {
  const styles = useStyles(makeMealLogModalStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get("window").height;
  const { showAlert, showToast } = useAlertModal();

  // Form state
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [mealName, setMealName] = useState("");
  const [mealDescription, setMealDescription] = useState("");
  const [estimatedCalories, setEstimatedCalories] = useState<number | null>(null);
  const [estimatedProtein, setEstimatedProtein] = useState<number | null>(null);
  const [healthRating, setHealthRating] = useState<HealthRating | null>(null);
  const [hasEstimated, setHasEstimated] = useState(false);

  // Photo state
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);

  // Animation values - starts off-screen at the bottom
  const translateY = useMemo(() => new Animated.Value(screenHeight), []);

  // Internal visibility state to allow close animation to complete
  const [internalVisible, setInternalVisible] = useState(visible);

  // Media permissions
  const {
    hasLibraryPermission,
    hasCameraPermission,
    requestLibraryPermission,
    requestCameraPermission
  } = useMediaPermissions();

  // Mutations
  const logMealMutation = useLogMeal();
  const estimateNutritionMutation = useEstimateNutrition();
  const { mutate: uploadMedia, isPending: isUploading } = useUploadMedia();
  const { mutate: deleteMediaByUrl } = useDeleteMediaByUrl();

  // Today's nutrition summary - use plan targets if provided
  const { data: todaySummary, refetch: refetchSummary } = useTodaysNutritionSummary(
    goalId,
    challengeId,
    calorieTarget,
    proteinTarget
  );

  // Handle modal visibility animation - slide from bottom to top
  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        mass: 1,
        stiffness: 120,
        useNativeDriver: true
      }).start();
    } else if (internalVisible) {
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true
      }).start(() => {
        setInternalVisible(false);
      });
    }
  }, [visible, translateY, screenHeight, internalVisible]);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setMealType("lunch");
      setMealName("");
      setMealDescription("");
      setEstimatedCalories(null);
      setEstimatedProtein(null);
      setHealthRating(null);
      setHasEstimated(false);
      setSelectedPhoto(null);
      setUploadingPhoto(false);
      setShowPhotoOptions(false);
    }
  }, [visible]);

  // Handle photo selection from library
  const handlePickPhoto = async () => {
    setShowPhotoOptions(false);
    try {
      let hasPermission = hasLibraryPermission;
      if (!hasPermission) {
        hasPermission = await requestLibraryPermission();
        if (!hasPermission) {
          await showAlert({
            title: t("meals.photo_permission_title") || "Photo Access Required",
            message:
              t("meals.photo_permission_message") || "Please grant access to your photo library",
            variant: "warning",
            confirmLabel: t("common.ok")
          });
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        handleUploadPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking photo:", error);
      await showAlert({
        title: t("common.error"),
        message: t("meals.photo_error") || "Failed to select photo",
        variant: "error",
        confirmLabel: t("common.ok")
      });
    }
  };

  // Handle taking a photo with camera
  const handleTakePhoto = async () => {
    setShowPhotoOptions(false);
    try {
      let hasPermission = hasCameraPermission;
      if (!hasPermission) {
        hasPermission = await requestCameraPermission();
        if (!hasPermission) {
          await showAlert({
            title: t("meals.camera_permission_title") || "Camera Access Required",
            message:
              t("meals.camera_permission_message") || "Please grant camera access to take photos",
            variant: "warning",
            confirmLabel: t("common.ok")
          });
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        handleUploadPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      await showAlert({
        title: t("common.error"),
        message: t("meals.photo_error") || "Failed to take photo",
        variant: "error",
        confirmLabel: t("common.ok")
      });
    }
  };

  // Handle photo upload
  const handleUploadPhoto = (fileUri: string) => {
    setUploadingPhoto(true);
    // Reset estimation since photo changed
    setHasEstimated(false);

    uploadMedia(
      { fileUri, options: { mediaType: "other" } },
      {
        onSuccess: (response) => {
          const uploadedUrl = response.data?.url;
          if (uploadedUrl) {
            setSelectedPhoto(uploadedUrl);
            // No toast needed - the visible photo is confirmation enough
          } else {
            showAlert({
              title: t("common.error"),
              message: t("meals.photo_error") || "Failed to upload photo",
              variant: "error",
              confirmLabel: t("common.ok")
            });
          }
        },
        onError: (error) => {
          console.error("Error uploading photo:", error);
          showAlert({
            title: t("common.error"),
            message: t("meals.photo_error") || "Failed to upload photo",
            variant: "error",
            confirmLabel: t("common.ok")
          });
        },
        onSettled: () => {
          setUploadingPhoto(false);
        }
      }
    );
  };

  // Handle removing a photo
  const handleRemovePhoto = () => {
    if (selectedPhoto) {
      deleteMediaByUrl(selectedPhoto);
      setSelectedPhoto(null);
      // Reset estimation since photo was removed
      setHasEstimated(false);
    }
  };

  const handleEstimateNutrition = async () => {
    // Need either description or photo for estimation
    if (!mealDescription.trim() && !selectedPhoto) {
      await showAlert({
        title: t("meals.description_required_title") || "Description or Photo Required",
        message:
          t("meals.description_required_message") ||
          "Please describe your meal or add a photo for AI estimation",
        variant: "warning",
        confirmLabel: t("common.ok")
      });
      return;
    }

    try {
      const result = await estimateNutritionMutation.mutateAsync({
        meal_description: mealDescription || "Analyze this meal from the photo",
        meal_name: mealName || undefined,
        photo_url: selectedPhoto || undefined // Include photo for vision analysis
      });

      setEstimatedCalories(result.estimated_calories);
      setEstimatedProtein(result.estimated_protein);
      setHealthRating(result.health_rating);
      setHasEstimated(true);

      // If AI suggested a meal name and user hasn't provided one, use it
      if (!mealName && result.suggested_name) {
        setMealName(result.suggested_name);
      }
    } catch (error) {
      await showAlert({
        title: t("common.error"),
        message: t("meals.estimate_error") || "Failed to estimate nutrition. Please try again.",
        variant: "error",
        confirmLabel: t("common.ok")
      });
    }
  };

  const handleSubmit = async () => {
    // Need at least a meal name, description, or photo for the backend to work with
    const hasContent = mealName.trim() || mealDescription.trim() || selectedPhoto;

    if (!hasContent) {
      await showAlert({
        title: t("meals.content_required_title") || "Content Required",
        message:
          t("meals.content_required_message") ||
          "Please enter a meal name, description, or add a photo",
        variant: "warning",
        confirmLabel: t("common.ok")
      });
      return;
    }

    try {
      const today = new Date().toISOString().split("T")[0];

      // Prepare final values - use existing estimates if available
      let finalCalories = estimatedCalories;
      let finalProtein = estimatedProtein;
      let finalHealthRating = healthRating;
      let finalMealName = mealName;

      // If user hasn't estimated yet but has content to estimate from, estimate first
      // This ensures optimistic updates have real values for immediate UI feedback
      const canEstimate = mealName.trim() || mealDescription.trim() || selectedPhoto;
      if (!hasEstimated && canEstimate) {
        try {
          // Build description for estimation - prioritize explicit description, then photo, then meal name
          const estimationDescription = mealDescription.trim()
            ? mealDescription
            : selectedPhoto
              ? "Analyze this meal from the photo"
              : `Estimate nutrition for: ${mealName}`;

          const result = await estimateNutritionMutation.mutateAsync({
            meal_description: estimationDescription,
            meal_name: mealName || undefined,
            photo_url: selectedPhoto || undefined
          });

          finalCalories = result.estimated_calories;
          finalProtein = result.estimated_protein;
          finalHealthRating = result.health_rating;

          // Use AI-suggested name if user didn't provide one
          if (!mealName && result.suggested_name) {
            finalMealName = result.suggested_name;
          }
        } catch (estimateError) {
          // If estimation fails, proceed with logging without estimates
          // Backend will try to estimate again as fallback
        }
      }

      // Log meal with real values (optimistic update will be accurate)
      await logMealMutation.mutateAsync({
        meal_type: mealType,
        logged_date: today,
        meal_name: finalMealName,
        meal_description: mealDescription || undefined,
        goal_id: goalId,
        challenge_id: challengeId,
        estimated_calories: finalCalories || undefined,
        estimated_protein: finalProtein || undefined,
        health_rating: finalHealthRating || undefined,
        photo_url: selectedPhoto || undefined,
        use_ai_estimation: false // Already estimated on frontend
      });

      showToast({
        title: t("common.success"),
        message: t("meals.logged_success") || "Meal logged successfully!",
        variant: "success",
        duration: 2000
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      await showAlert({
        title: t("common.error"),
        message: t("meals.log_error") || "Failed to log meal. Please try again.",
        variant: "error",
        confirmLabel: t("common.ok")
      });
    }
  };

  const isLoggingMeal = logMealMutation.isPending;
  const isEstimatingNutrition = estimateNutritionMutation.isPending;
  const isUploadingPhoto = uploadingPhoto;

  // Don't render anything if not visible
  if (!internalVisible && !visible) {
    return null;
  }

  return (
    <RNModal
      visible={internalVisible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY }]
            }
          ]}
        >
          <View
            style={[
              styles.contentContainer,
              {
                paddingTop: insets.top + toRN(tokens.spacing[4])
              }
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{t("meals.title")}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                accessibilityLabel={t("common.close")}
                accessibilityRole="button"
              >
                <Ionicons
                  name="close"
                  size={toRN(tokens.typography.fontSize["2xl"])}
                  color={colors.text.primary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Daily Progress Card */}
              <View style={styles.progressCard}>
                <Text style={styles.progressTitle}>
                  {t("meals.daily_progress") || "Today's Nutrition"}
                </Text>

                {/* Calories Progress */}
                <View style={styles.progressRow}>
                  <View style={styles.progressLabelRow}>
                    <Ionicons name="flame-outline" size={16} color={brandColors.primary} />
                    <Text style={styles.progressLabel}>{t("meals.calories") || "Calories"}</Text>
                  </View>
                  <Text style={styles.progressValue}>
                    {todaySummary?.total_calories || 0} / {todaySummary?.target_calories || 2000}
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(todaySummary?.calories_percentage || 0, 100)}%`,
                        backgroundColor:
                          (todaySummary?.calories_percentage || 0) > 100
                            ? colors.feedback.error
                            : brandColors.primary
                      }
                    ]}
                  />
                </View>
                <Text style={styles.progressSubtext}>
                  {(todaySummary?.calories_percentage || 0) > 100
                    ? `${(todaySummary?.total_calories || 0) - (todaySummary?.target_calories || 2000)} ${t("meals.over_target") || "over target"}`
                    : `${todaySummary?.calories_remaining || 2000} ${t("meals.remaining") || "remaining"}`}
                </Text>

                {/* Protein Progress */}
                <View style={[styles.progressRow, { marginTop: toRN(tokens.spacing[3]) }]}>
                  <View style={styles.progressLabelRow}>
                    <Ionicons name="barbell-outline" size={16} color={colors.feedback.success} />
                    <Text style={styles.progressLabel}>{t("meals.protein") || "Protein"}</Text>
                  </View>
                  <Text style={styles.progressValue}>
                    {todaySummary?.total_protein || 0}g / {todaySummary?.target_protein || 50}g
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(todaySummary?.protein_percentage || 0, 100)}%`,
                        backgroundColor:
                          (todaySummary?.protein_percentage || 0) > 100
                            ? colors.feedback.success
                            : colors.feedback.success
                      }
                    ]}
                  />
                </View>
                <Text style={styles.progressSubtext}>
                  {(todaySummary?.protein_percentage || 0) >= 100
                    ? `${t("meals.target_reached") || "Target reached!"} 🎉`
                    : `${todaySummary?.protein_remaining || 50}g ${t("meals.remaining") || "remaining"}`}
                </Text>

                {/* Meals logged today */}
                {(todaySummary?.meal_count || 0) > 0 && (
                  <View style={styles.mealsLoggedBadge}>
                    <Ionicons name="restaurant-outline" size={14} color={brandColors.primary} />
                    <Text style={styles.mealsLoggedText}>
                      {todaySummary?.meal_count}{" "}
                      {(todaySummary?.meal_count || 0) === 1
                        ? t("meals.meal_logged") || "meal logged"
                        : t("meals.meals_logged") || "meals logged"}{" "}
                      {t("common.today") || "today"}
                    </Text>
                  </View>
                )}
              </View>

              {/* Meal Type Selection */}
              <Text style={styles.label}>{t("meals.meal_type")}</Text>
              <View style={styles.mealTypeRow}>
                {MEAL_TYPES.map((type) => {
                  const isSelected = mealType === type.key;
                  return (
                    <TouchableOpacity
                      key={type.key}
                      style={[styles.mealTypeButton, isSelected && styles.mealTypeButtonSelected]}
                      onPress={() => setMealType(type.key)}
                    >
                      <View style={styles.mealTypeIconContainer}>
                        <MealTypeIcon type={type.key} size={24} selected={isSelected} />
                      </View>
                      <Text
                        style={[styles.mealTypeLabel, isSelected && styles.mealTypeLabelSelected]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Meal Name */}
              <TextInput
                label={t("meals.meal_name")}
                value={mealName}
                onChangeText={setMealName}
                placeholder={t("meals.meal_name_placeholder")}
                containerStyle={styles.inputContainer}
              />

              {/* Meal Description */}
              <TextInput
                label={t("meals.meal_description")}
                value={mealDescription}
                onChangeText={(text) => {
                  setMealDescription(text);
                  setHasEstimated(false);
                }}
                placeholder={t("meals.meal_description_placeholder")}
                multiline
                numberOfLines={3}
                containerStyle={styles.inputContainer}
              />

              {/* Photo Section */}
              <Text style={styles.label}>
                {t("meals.photo") || "Photo"}
                <Text style={styles.optionalText}> ({t("common.optional")})</Text>
              </Text>

              {/* Selected Photo Preview */}
              {selectedPhoto && (
                <View style={styles.photoContainer}>
                  <Image
                    source={{ uri: selectedPhoto }}
                    style={styles.photoPreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity style={styles.removePhotoButton} onPress={handleRemovePhoto}>
                    <Ionicons name="close-circle" size={24} color={colors.feedback.error} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Uploading Photo */}
              {uploadingPhoto && (
                <View style={styles.uploadingContainer}>
                  <ActivityIndicator size="small" color={brandColors.primary} />
                  <Text style={styles.uploadingText}>
                    {t("meals.uploading_photo") || "Uploading photo..."}
                  </Text>
                </View>
              )}

              {/* Add Photo Button */}
              {!selectedPhoto && !uploadingPhoto && (
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={() => setShowPhotoOptions(true)}
                  disabled={isUploading}
                >
                  <Ionicons
                    name="camera-outline"
                    size={toRN(tokens.typography.fontSize.xl)}
                    color={brandColors.primary}
                  />
                  <Text style={styles.addPhotoText}>
                    {t("meals.add_photo") || "Add Photo for Better AI Estimation"}
                  </Text>
                </TouchableOpacity>
              )}

              {/* AI Estimate Button */}
              {(mealDescription.trim() || selectedPhoto) && !hasEstimated && (
                <View style={styles.estimateSection}>
                  <Button
                    variant="outline"
                    size="md"
                    title={t("meals.estimate_nutrition") || "Estimate Nutrition with AI"}
                    leftIcon="sparkles"
                    onPress={handleEstimateNutrition}
                    disabled={isEstimatingNutrition || isUploadingPhoto}
                    loading={isEstimatingNutrition}
                    fullWidth
                    style={styles.estimateButton}
                  />
                  <Text style={styles.estimateHint}>
                    {t("meals.estimate_hint") ||
                      "Get AI-powered calorie, protein, and health estimates based on your description or photo"}
                  </Text>
                </View>
              )}

              {/* Nutrition Estimates */}
              {hasEstimated && (
                <View style={styles.estimatesContainer}>
                  <Text style={styles.estimatesTitle}>
                    {t("meals.ai_estimates") || "AI Estimates"}
                  </Text>

                  <View style={styles.estimatesRow}>
                    <View style={styles.estimateItem}>
                      <Text style={styles.estimateValue}>{estimatedCalories}</Text>
                      <Text style={styles.estimateLabel}>{t("meals.calories") || "Calories"}</Text>
                    </View>

                    <View style={styles.estimateItem}>
                      <Text style={styles.estimateValue}>{estimatedProtein}g</Text>
                      <Text style={styles.estimateLabel}>{t("meals.protein") || "Protein"}</Text>
                    </View>

                    <View style={styles.estimateItem}>
                      <View
                        style={[
                          styles.healthBadge,
                          {
                            backgroundColor:
                              HEALTH_RATINGS.find((r) => r.key === healthRating)?.color ||
                              colors.border.default
                          }
                        ]}
                      >
                        <Text style={styles.healthBadgeText}>
                          {HEALTH_RATINGS.find((r) => r.key === healthRating)?.label || ""}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Projected Daily Totals */}
                  <View style={styles.projectedTotals}>
                    <Text style={styles.projectedTitle}>
                      {t("meals.after_logging") || "After logging this meal"}
                    </Text>
                    <View style={styles.projectedRow}>
                      <Text style={styles.projectedLabel}>
                        {t("meals.calories") || "Calories"}:
                      </Text>
                      <Text style={styles.projectedValue}>
                        {(todaySummary?.total_calories || 0) + (estimatedCalories || 0)} /{" "}
                        {todaySummary?.target_calories || 2000}
                      </Text>
                    </View>
                    <View style={styles.projectedRow}>
                      <Text style={styles.projectedLabel}>{t("meals.protein") || "Protein"}:</Text>
                      <Text style={styles.projectedValue}>
                        {(todaySummary?.total_protein || 0) + (estimatedProtein || 0)}g /{" "}
                        {todaySummary?.target_protein || 50}g
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Submit Button */}
              <Button
                title={
                  isLoggingMeal
                    ? t("meals.logging") || "Logging..."
                    : t("meals.log_meal") || "Log Meal"
                }
                onPress={handleSubmit}
                disabled={
                  isLoggingMeal ||
                  isEstimatingNutrition ||
                  isUploadingPhoto ||
                  // Need at least one: meal name, description, or photo
                  !(mealName.trim() || mealDescription.trim() || selectedPhoto)
                }
                style={styles.submitButton}
                loading={isLoggingMeal}
              />
            </ScrollView>
          </View>

          {/* Photo Selection Action Sheet */}
          <ActionSheet
            visible={showPhotoOptions}
            title={t("meals.add_photo") || "Add Photo"}
            options={[
              {
                id: "camera",
                label: t("meals.take_photo") || "Take Photo",
                icon: "camera-outline",
                onPress: handleTakePhoto,
                disabled: isUploadingPhoto
              },
              {
                id: "library",
                label: t("meals.choose_from_library") || "Choose from Library",
                icon: "image-outline",
                onPress: handlePickPhoto,
                disabled: isUploadingPhoto
              }
            ]}
            onClose={() => setShowPhotoOptions(false)}
            cancelLabel={t("common.cancel")}
          />

          {/* AlertOverlay renders inside Modal so toasts/alerts appear on top */}
          <AlertOverlay visible={visible} />
        </Animated.View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

const makeMealLogModalStyles = (tokens: any, colors: any, brand: any) => ({
  keyboardView: {
    flex: 1
  },
  modalContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.canvas
  },
  contentContainer: {
    flex: 1,
    width: "100%"
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[4])
  },
  headerTitle: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary
  },
  closeButton: {
    width: toRN(tokens.spacing[10]),
    height: toRN(tokens.spacing[10]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[6])
  },
  // Daily Progress Card
  progressCard: {
    backgroundColor: colors.bg.card,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    marginBottom: toRN(tokens.spacing[5])
  },
  progressTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3]),
    textAlign: "center" as const
  },
  progressRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[1.5])
  },
  progressLabelRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: toRN(tokens.spacing[1.5])
  },
  progressLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary
  },
  progressValue: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  progressBar: {
    height: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.md),
    backgroundColor: colors.border.default,
    overflow: "hidden" as const,
    marginBottom: toRN(tokens.spacing[1])
  },
  progressFill: {
    height: "100%" as const,
    borderRadius: toRN(tokens.borderRadius.md)
  },
  progressSubtext: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  mealsLoggedBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[1.5]),
    marginTop: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[3]),
    backgroundColor: `${brand.primary}10`,
    borderRadius: toRN(tokens.borderRadius.full),
    alignSelf: "center" as const
  },
  mealsLoggedText: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: brand.primary
  },
  label: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2])
  },
  mealTypeRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: toRN(tokens.spacing[2]),
    marginBottom: toRN(tokens.spacing[4])
  },
  mealTypeButton: {
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.lg),
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.card,
    alignItems: "center" as const,
    minWidth: 64
  },
  mealTypeButtonSelected: {
    backgroundColor: brand.primary,
    borderColor: brand.primary
  },
  mealTypeIconContainer: {
    marginBottom: toRN(tokens.spacing[1])
  },
  mealTypeLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary
  },
  mealTypeLabelSelected: {
    color: brand.onPrimary
  },
  inputContainer: {
    marginBottom: toRN(tokens.spacing[4])
  },
  optionalText: {
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  // Photo styles
  photoContainer: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: toRN(tokens.borderRadius.xl),
    overflow: "hidden" as const,
    position: "relative" as const,
    marginBottom: toRN(tokens.spacing[4])
  },
  photoPreview: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.bg.muted
  },
  removePhotoButton: {
    position: "absolute" as const,
    top: toRN(tokens.spacing[2]),
    right: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.canvas,
    borderRadius: toRN(tokens.borderRadius.full),
    padding: toRN(tokens.spacing[1])
  },
  uploadingContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    padding: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.xl),
    marginBottom: toRN(tokens.spacing[4])
  },
  uploadingText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary
  },
  addPhotoButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    borderWidth: 2,
    borderColor: brand.primary,
    borderStyle: "dashed" as const,
    borderRadius: toRN(tokens.borderRadius.xl),
    backgroundColor: "transparent",
    marginBottom: toRN(tokens.spacing[4])
  },
  addPhotoText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: brand.primary
  },
  estimateSection: {
    marginBottom: toRN(tokens.spacing[4])
  },
  estimateButton: {
    borderRadius: toRN(tokens.borderRadius.lg)
  },
  estimateHint: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "center" as const,
    marginTop: toRN(tokens.spacing[2]),
    paddingHorizontal: toRN(tokens.spacing[2]),
    lineHeight: toRN(tokens.typography.fontSize.xs) * 1.5
  },
  estimatesContainer: {
    backgroundColor: colors.bg.card,
    padding: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    marginBottom: toRN(tokens.spacing[4])
  },
  estimatesTitle: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3]),
    textAlign: "center" as const
  },
  estimatesRow: {
    flexDirection: "row" as const,
    justifyContent: "space-around" as const
  },
  estimateItem: {
    alignItems: "center" as const
  },
  estimateValue: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: brand.primary
  },
  estimateLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[0.5])
  },
  healthBadge: {
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[1.5]),
    borderRadius: toRN(tokens.borderRadius.full)
  },
  healthBadgeText: {
    color: "#fff",
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold
  },
  // Projected totals after AI estimation
  projectedTotals: {
    marginTop: toRN(tokens.spacing[4]),
    paddingTop: toRN(tokens.spacing[3]),
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle
  },
  projectedTitle: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.semiBold,
    color: colors.text.secondary,
    marginBottom: toRN(tokens.spacing[2]),
    textAlign: "center" as const
  },
  projectedRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[1])
  },
  projectedLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  projectedValue: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  submitButton: {
    marginTop: toRN(tokens.spacing[2])
  }
});

export default MealLogModal;
