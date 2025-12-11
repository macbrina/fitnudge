import React, { useEffect, useMemo, useState } from "react";
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Easing,
  StatusBar,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CheckIn } from "@/services/api/checkins";
import { useUpdateCheckIn } from "@/hooks/api/useCheckIns";
import { Card } from "@/components/ui/Card";
import { ActionSheet } from "@/components/ui/ActionSheet";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useMediaPermissions } from "@/hooks/media/useMediaPermissions";
import { useUploadMedia, useDeleteMediaByUrl } from "@/hooks/api/useMedia";
import { useAlertModal } from "@/contexts/AlertModalContext";

interface CheckInModalProps {
  visible: boolean;
  checkIn?: CheckIn | null; // Optional when loading
  onClose: () => void;
  onComplete?: () => void;
  isLoading?: boolean; // Show skeleton while loading check-in data
}

// Mood emoji mapping
const MOOD_EMOJIS = ["😞", "😐", "😊", "😄", "🤩"];
const MOOD_LABELS = ["Very Low", "Low", "Neutral", "Good", "Excellent"];

export function CheckInModal({
  visible,
  checkIn,
  onClose,
  onComplete,
  isLoading = false,
}: CheckInModalProps) {
  const styles = useStyles(makeCheckInModalStyles);
  const { colors, brandColors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get("window").height;
  const { showAlert, showConfirm, showToast } = useAlertModal();

  const { mutate: updateCheckIn, isPending: isSaving } = useUpdateCheckIn();
  const { mutate: uploadMedia, isPending: isUploading } = useUploadMedia();
  const { mutate: deleteMediaByUrl } = useDeleteMediaByUrl();

  // Media permissions hook
  const {
    hasLibraryPermission,
    hasCameraPermission,
    requestLibraryPermission,
    requestCameraPermission,
  } = useMediaPermissions();

  // Local state
  const [completed, setCompleted] = useState<boolean | null>(null);
  const [reflection, setReflection] = useState(checkIn?.reflection || "");
  const [selectedMood, setSelectedMood] = useState<number | null>(
    checkIn?.mood || null
  );
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>(
    checkIn?.photo_urls || []
  );
  const [uploadingPhotos, setUploadingPhotos] = useState<string[]>([]);

  // Reset state when modal opens/closes or checkIn changes
  useEffect(() => {
    if (visible && checkIn) {
      setCompleted(checkIn.completed ?? null);
      setReflection(checkIn.reflection || "");
      setSelectedMood(checkIn.mood || null);
      setSelectedPhotos(checkIn.photo_urls || []);
      setUploadingPhotos([]);
    }
  }, [visible, checkIn]);

  // Animation values - starts off-screen at the bottom
  const translateY = useMemo(() => new Animated.Value(screenHeight), []);

  // Internal visibility state to allow close animation to complete
  const [internalVisible, setInternalVisible] = useState(visible);

  // Handle modal visibility animation - slide from bottom to top
  useEffect(() => {
    if (visible) {
      // Show modal immediately, then animate in
      setInternalVisible(true);
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        mass: 1,
        stiffness: 120,
        useNativeDriver: true,
      }).start();
    } else if (internalVisible) {
      // Animate out, then hide modal
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        // Only hide modal after animation completes
        setInternalVisible(false);
      });
    }
  }, [visible, translateY, screenHeight, internalVisible]);

  const goalTitle = checkIn?.goal?.title || t("common.goal");

  // Handle photo selection from library
  const handlePickPhoto = async () => {
    try {
      // Request permission if needed
      let hasPermission = hasLibraryPermission;
      if (!hasPermission) {
        hasPermission = await requestLibraryPermission();
        if (!hasPermission) {
          await showConfirm({
            title: t("checkin.photo_permission_title"),
            message: t("checkin.photo_permission_message"),
            variant: "warning",
            confirmLabel: t("checkin.grant_access"),
            cancelLabel: t("common.cancel"),
          });
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        handleUploadPhoto(asset.uri);
      }
    } catch (error) {
      console.error("Error picking photo:", error);
      await showAlert({
        title: t("common.error"),
        message: t("checkin.photo_upload_error") || "Failed to select photo",
        variant: "error",
        confirmLabel: t("common.ok"),
      });
    }
  };

  // Handle taking a photo with camera
  const handleTakePhoto = async () => {
    try {
      // Request permission if needed
      let hasPermission = hasCameraPermission;
      if (!hasPermission) {
        hasPermission = await requestCameraPermission();
        if (!hasPermission) {
          await showConfirm({
            title: t("checkin.photo_permission_title"),
            message: t("checkin.photo_permission_message"),
            variant: "warning",
            confirmLabel: t("checkin.grant_access"),
            cancelLabel: t("common.cancel"),
          });
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        handleUploadPhoto(asset.uri);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      await showAlert({
        title: t("common.error"),
        message: t("checkin.photo_upload_error") || "Failed to take photo",
        variant: "error",
        confirmLabel: t("common.ok"),
      });
    }
  };

  // Handle photo upload
  const handleUploadPhoto = (fileUri: string) => {
    // Add to uploading list
    setUploadingPhotos((prev) => [...prev, fileUri]);

    uploadMedia(
      { fileUri, options: { mediaType: "checkin" } },
      {
        onSuccess: (response) => {
          const uploadedUrl = response.data?.url;
          if (uploadedUrl) {
            setSelectedPhotos((prev) => [...prev, uploadedUrl]);
            showToast({
              title: t("common.success"),
              message:
                t("checkin.photo_upload_success") ||
                "Photo uploaded successfully",
              variant: "success",
              duration: 2000,
            });
          } else {
            showAlert({
              title: t("common.error"),
              message:
                t("checkin.photo_upload_error") || "Failed to upload photo",
              variant: "error",
              confirmLabel: t("common.ok"),
            });
          }
        },
        onError: (error) => {
          console.error("Error uploading photo:", error);
          showAlert({
            title: t("common.error"),
            message:
              t("checkin.photo_upload_error") || "Failed to upload photo",
            variant: "error",
            confirmLabel: t("common.ok"),
          });
        },
        onSettled: () => {
          setUploadingPhotos((prev) => prev.filter((uri) => uri !== fileUri));
        },
      }
    );
  };

  // Handle removing a photo
  const handleRemovePhoto = (photoUrl: string) => {
    // Remove from UI immediately
    setSelectedPhotos((prev) => prev.filter((url) => url !== photoUrl));

    // Delete from Cloudflare R2 in background (fire and forget)
    deleteMediaByUrl(photoUrl);
  };

  // Show photo selection options - using state for action sheet
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);

  const handleAddPhoto = () => {
    setShowPhotoOptions(true);
  };

  const handleSave = () => {
    if (completed === null || !checkIn?.id) return;

    updateCheckIn(
      {
        checkInId: checkIn?.id,
        updates: {
          completed,
          reflection: reflection.trim() || undefined,
          mood: selectedMood || undefined,
          photo_urls: selectedPhotos.length > 0 ? selectedPhotos : undefined,
        },
      },
      {
        onSuccess: () => {
          onComplete?.();
          onClose();
        },
        onError: (error) => {
          console.error("Error updating check-in:", error);
          // TODO: Show error toast
        },
      }
    );
  };

  const canSave =
    completed !== null &&
    !isSaving &&
    !isUploading &&
    uploadingPhotos.length === 0;

  // Don't render anything if not visible (after close animation completes)
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
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Full Screen Modal Content */}
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          <View
            style={[
              styles.contentContainer,
              {
                paddingTop: insets.top + toRN(tokens.spacing[4]),
                paddingBottom: insets.bottom + toRN(tokens.spacing[4]),
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
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
              {/* Loading Skeleton */}
              {isLoading || !checkIn ? (
                <View style={styles.loadingContainer}>
                  {/* Goal icon skeleton */}
                  <View style={styles.goalContext}>
                    <SkeletonBox
                      width={60}
                      height={60}
                      borderRadius={30}
                      style={{
                        alignSelf: "center",
                        marginBottom: toRN(tokens.spacing[4]),
                      }}
                    />
                    {/* Question skeleton */}
                    <SkeletonBox
                      width="80%"
                      height={28}
                      borderRadius={toRN(tokens.borderRadius.md)}
                      style={{
                        alignSelf: "center",
                        marginBottom: toRN(tokens.spacing[2]),
                      }}
                    />
                    <SkeletonBox
                      width="60%"
                      height={28}
                      borderRadius={toRN(tokens.borderRadius.md)}
                      style={{ alignSelf: "center" }}
                    />
                  </View>

                  {/* Yes/No buttons skeleton */}
                  <View
                    style={[
                      styles.yesNoContainer,
                      { marginTop: toRN(tokens.spacing[6]) },
                    ]}
                  >
                    <SkeletonBox
                      width="48%"
                      height={56}
                      borderRadius={toRN(tokens.borderRadius.xl)}
                    />
                    <SkeletonBox
                      width="48%"
                      height={56}
                      borderRadius={toRN(tokens.borderRadius.xl)}
                    />
                  </View>

                  {/* Loading indicator */}
                  <View
                    style={{
                      alignItems: "center",
                      marginTop: toRN(tokens.spacing[8]),
                    }}
                  >
                    <ActivityIndicator
                      size="large"
                      color={brandColors.primary}
                    />
                    <Text
                      style={[
                        styles.loadingText,
                        { marginTop: toRN(tokens.spacing[3]) },
                      ]}
                    >
                      {t("common.loading") || "Loading..."}
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  {/* Goal Context */}
                  <View style={styles.goalContext}>
                    <View style={styles.goalIcon}>
                      <Ionicons
                        name="flag"
                        size={toRN(tokens.typography.fontSize["3xl"])}
                        color={brandColors.primary}
                      />
                    </View>
                    {/* Question */}
                    <Text style={styles.question}>
                      {t("checkin.did_you_complete", { goal: goalTitle })}
                    </Text>
                    {/* <Text style={styles.goalTitle}>{goalTitle}</Text> */}
                  </View>

                  {/* Yes/No Buttons */}
                  <View style={styles.yesNoContainer}>
                    <TouchableOpacity
                      style={[
                        styles.yesNoButton,
                        styles.yesButton,
                        completed === true && styles.yesButtonActive,
                      ]}
                      onPress={() => setCompleted(true)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.yesNoText,
                          completed === true && styles.yesNoTextActive,
                        ]}
                      >
                        {t("common.yes")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.yesNoButton,
                        styles.noButton,
                        completed === false && styles.noButtonActive,
                      ]}
                      onPress={() => setCompleted(false)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.yesNoText,
                          completed === false && styles.yesNoTextActive,
                        ]}
                      >
                        {t("common.no")}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Optional Fields - Show after Yes/No selection */}
                  {completed !== null && (
                    <View style={styles.optionalFields}>
                      {/* Reflection */}
                      <Card shadow="sm" style={styles.reflectionCard}>
                        <Text style={styles.optionalLabel}>
                          {t("checkin.reflection_label")}
                          <Text style={styles.optionalText}>
                            {" "}
                            ({t("common.optional")})
                          </Text>
                        </Text>
                        <TextInput
                          style={styles.reflectionInput}
                          placeholder={t("checkin.reflection_placeholder")}
                          placeholderTextColor={colors.text.tertiary}
                          value={reflection}
                          onChangeText={setReflection}
                          multiline
                          numberOfLines={4}
                          textAlignVertical="top"
                        />
                      </Card>

                      {/* Mood Rating */}
                      <View style={styles.moodSection}>
                        <Text style={styles.optionalLabel}>
                          {t("checkin.mood_label")}
                          <Text style={styles.optionalText}>
                            {" "}
                            ({t("common.optional")})
                          </Text>
                        </Text>
                        <View style={styles.moodContainer}>
                          {MOOD_EMOJIS.map((emoji, index) => {
                            const moodValue = index + 1;
                            const isSelected = selectedMood === moodValue;
                            return (
                              <TouchableOpacity
                                key={moodValue}
                                style={[
                                  styles.moodButton,
                                  isSelected && styles.moodButtonActive,
                                ]}
                                onPress={() =>
                                  setSelectedMood(isSelected ? null : moodValue)
                                }
                                activeOpacity={0.7}
                              >
                                <Text style={styles.moodEmoji}>{emoji}</Text>
                                {isSelected && (
                                  <View style={styles.moodCheck}>
                                    <Ionicons
                                      name="checkmark"
                                      size={16}
                                      color={brandColors.primary}
                                    />
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        {selectedMood && (
                          <Text style={styles.moodLabel}>
                            {MOOD_LABELS[selectedMood - 1]}
                          </Text>
                        )}
                      </View>

                      {/* Progress Photo Section */}
                      <View style={styles.photoSection}>
                        <Text style={styles.optionalLabel}>
                          {t("checkin.photo_label")}
                          <Text style={styles.optionalText}>
                            {" "}
                            ({t("common.optional")})
                          </Text>
                        </Text>

                        {/* Selected Photos Grid */}
                        {selectedPhotos.length > 0 && (
                          <View style={styles.photosGrid}>
                            {selectedPhotos.map((photoUrl, index) => (
                              <View key={index} style={styles.photoContainer}>
                                <Image
                                  source={{ uri: photoUrl }}
                                  style={styles.photoPreview}
                                  resizeMode="cover"
                                />
                                <TouchableOpacity
                                  style={styles.removePhotoButton}
                                  onPress={() => handleRemovePhoto(photoUrl)}
                                >
                                  <Ionicons
                                    name="close-circle"
                                    size={24}
                                    color={colors.feedback.error}
                                  />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Uploading Photos */}
                        {uploadingPhotos.length > 0 && (
                          <View style={styles.uploadingContainer}>
                            <ActivityIndicator
                              size="small"
                              color={brandColors.primary}
                            />
                            <Text style={styles.uploadingText}>
                              Uploading photo...
                            </Text>
                          </View>
                        )}

                        {/* Add Photo Button */}
                        <TouchableOpacity
                          style={styles.addPhotoButton}
                          onPress={handleAddPhoto}
                          disabled={isUploading || uploadingPhotos.length > 0}
                        >
                          <Ionicons
                            name="camera-outline"
                            size={toRN(tokens.typography.fontSize.xl)}
                            color={brandColors.primary}
                          />
                          <Text style={styles.addPhotoText}>
                            {t("checkin.add_photo")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Save Button */}
                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      !canSave && styles.saveButtonDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={!canSave}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.saveButtonText,
                        !canSave && styles.saveButtonTextDisabled,
                      ]}
                    >
                      {isSaving
                        ? t("checkin.saving")
                        : t("checkin.save_checkin")}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>

          {/* Photo Selection Action Sheet */}
          <ActionSheet
            visible={showPhotoOptions}
            title={t("checkin.add_photo")}
            options={[
              {
                id: "camera",
                label: t("checkin.take_photo") || "Take Photo",
                icon: "camera-outline",
                onPress: handleTakePhoto,
              },
              {
                id: "library",
                label:
                  t("checkin.choose_from_library") || "Choose from Library",
                icon: "image-outline",
                onPress: handlePickPhoto,
              },
            ]}
            onClose={() => setShowPhotoOptions(false)}
            cancelLabel={t("common.cancel")}
          />
        </Animated.View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

const makeCheckInModalStyles = (tokens: any, colors: any, brand: any) => ({
  keyboardView: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.canvas,
  },
  contentContainer: {
    flex: 1,
    width: "100%",
  },
  loadingContainer: {
    flex: 1,
    paddingHorizontal: toRN(tokens.spacing[4]),
  },
  loadingText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    textAlign: "center" as const,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[2]),
  },
  closeButton: {
    width: toRN(tokens.spacing[10]),
    height: toRN(tokens.spacing[10]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[6]),
  },
  goalContext: {
    alignItems: "center",
  },
  goalIcon: {
    width: toRN(tokens.spacing[16]),
    height: toRN(tokens.spacing[16]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: toRN(tokens.spacing[3]),
  },
  goalTitle: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    textAlign: "center",
  },
  question: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: toRN(tokens.spacing[6]),
    lineHeight: toRN(tokens.typography.fontSize["2xl"]) * 1.3,
  },
  yesNoContainer: {
    flexDirection: "row",
    gap: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[8]),
  },
  yesNoButton: {
    flex: 1,
    paddingVertical: toRN(tokens.spacing[5]),
    borderRadius: toRN(tokens.borderRadius.xl),
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  yesButton: {
    borderColor: colors.feedback.success,
    backgroundColor: "transparent",
  },
  yesButtonActive: {
    backgroundColor: colors.feedback.success,
  },
  noButton: {
    borderColor: colors.feedback.error,
    backgroundColor: "transparent",
  },
  noButtonActive: {
    backgroundColor: colors.feedback.error,
  },
  yesNoText: {
    fontSize: toRN(tokens.typography.fontSize.xl),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
  },
  yesNoTextActive: {
    color: "#FFFFFF",
  },
  optionalFields: {
    gap: toRN(tokens.spacing[6]),
    marginBottom: toRN(tokens.spacing[6]),
  },
  reflectionCard: {
    padding: toRN(tokens.spacing[4]),
  },
  optionalLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3]),
  },
  optionalText: {
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  reflectionInput: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
    minHeight: toRN(tokens.spacing[20]),
    padding: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  moodSection: {
    marginTop: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.card,
    padding: toRN(tokens.spacing[4]),
  },
  moodContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[3]),
  },
  moodButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: toRN(tokens.borderRadius.xl),
    backgroundColor: colors.bg.muted,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
    position: "relative",
  },
  moodButtonActive: {
    borderColor: brand.primary,
    backgroundColor: colors.bg.subtle,
  },
  moodEmoji: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
  },
  moodCheck: {
    position: "absolute",
    top: toRN(tokens.spacing[1]),
    right: toRN(tokens.spacing[1]),
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: brand.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  moodLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: toRN(tokens.spacing[2]),
  },
  saveButton: {
    backgroundColor: brand.primary,
    paddingVertical: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    justifyContent: "center",
    alignItems: "center",
    marginTop: toRN(tokens.spacing[4]),
  },
  saveButtonDisabled: {
    backgroundColor: colors.bg.muted,
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.bold,
    color: "#FFFFFF",
  },
  saveButtonTextDisabled: {
    color: colors.text.tertiary,
  },
  photoSection: {
    marginTop: toRN(tokens.spacing[4]),
  },
  photosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: toRN(tokens.spacing[3]),
    marginTop: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[3]),
  },
  photoContainer: {
    width:
      (Dimensions.get("window").width -
        toRN(tokens.spacing[8]) * 2 -
        toRN(tokens.spacing[3])) /
      3,
    aspectRatio: 1,
    borderRadius: toRN(tokens.borderRadius.lg),
    overflow: "hidden",
    position: "relative",
  },
  photoPreview: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.bg.muted,
  },
  removePhotoButton: {
    position: "absolute",
    top: toRN(tokens.spacing[1]),
    right: toRN(tokens.spacing[1]),
    backgroundColor: colors.bg.canvas,
    borderRadius: toRN(tokens.borderRadius.full),
    padding: toRN(tokens.spacing[1]),
  },
  uploadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[3]),
    marginBottom: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  uploadingText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  addPhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[4]),
    paddingHorizontal: toRN(tokens.spacing[4]),
    borderWidth: 2,
    borderColor: brand.primary,
    borderStyle: "dashed",
    borderRadius: toRN(tokens.borderRadius.xl),
    backgroundColor: "transparent",
    marginTop: toRN(tokens.spacing[2]),
  },
  addPhotoText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: brand.primary,
  },
});
