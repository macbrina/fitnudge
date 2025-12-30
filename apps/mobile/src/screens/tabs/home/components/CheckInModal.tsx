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
import { CheckIn, CheckInMood } from "@/services/api/checkins";
import { ChallengeCheckIn } from "@/services/api/challenges";
import { useUpdateCheckIn } from "@/hooks/api/useCheckIns";
import {
  useChallengeCheckIn,
  useUpdateChallengeCheckIn,
} from "@/hooks/api/useChallenges";
import { getApiErrorDetails } from "@/services/api/errors";
import { Card } from "@/components/ui/Card";
import { ActionSheet } from "@/components/ui/ActionSheet";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { useMediaPermissions } from "@/hooks/media/useMediaPermissions";
import { useUploadMedia, useDeleteMediaByUrl } from "@/hooks/api/useMedia";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { MoodIcon, MOODS, type MoodType } from "@/components/icons/MoodIcons";

// Unified check-in data that works for both goals and challenges
type UnifiedCheckIn = {
  id: string;
  notes?: string | null;
  mood?: string | null; // Text: great, good, okay, bad, terrible
  photo_url?: string | null;
  check_in_date?: string;
  goal?: { title?: string } | null;
  challenge?: { title?: string } | null;
};

interface CheckInModalProps {
  visible: boolean;
  // For goal check-ins
  goalId?: string;
  checkIn?: CheckIn | null;
  // For challenge check-ins
  challengeId?: string;
  challengeCheckIn?: ChallengeCheckIn | null;
  // Common props
  onClose: () => void;
  onComplete?: () => void;
  isLoading?: boolean;
}

// Mood values for iteration - using imported MOODS from MoodIcons

export function CheckInModal({
  visible,
  goalId,
  checkIn,
  challengeId,
  challengeCheckIn,
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

  // Determine if this is a goal or challenge check-in
  const isChallenge = !!challengeId;
  const entityId = challengeId || goalId;

  // Normalize the check-in data to a unified format
  const normalizedCheckIn: UnifiedCheckIn | null = useMemo(() => {
    if (isChallenge && challengeCheckIn) {
      return {
        id: challengeCheckIn.id,
        notes: challengeCheckIn.notes,
        mood: challengeCheckIn.mood,
        photo_url: challengeCheckIn.photo_url,
        check_in_date: challengeCheckIn.check_in_date,
        challenge: challengeCheckIn.challenge,
      };
    } else if (!isChallenge && checkIn) {
      return {
        id: checkIn.id,
        notes: checkIn.notes,
        mood: checkIn.mood,
        photo_url: checkIn.photo_url,
        check_in_date: checkIn.check_in_date,
        goal: checkIn.goal,
      };
    }
    return null;
  }, [isChallenge, checkIn, challengeCheckIn]);

  // API hooks for goal check-ins
  const { mutate: updateGoalCheckIn, isPending: isUpdatingGoal } =
    useUpdateCheckIn();

  // API hooks for challenge check-ins
  const { mutate: createChallengeCheckIn, isPending: isCreatingChallenge } =
    useChallengeCheckIn();
  const { mutate: updateChallengeCheckIn, isPending: isUpdatingChallenge } =
    useUpdateChallengeCheckIn();

  const { mutate: uploadMedia, isPending: isUploading } = useUploadMedia();
  const { mutate: deleteMediaByUrl } = useDeleteMediaByUrl();

  const isEditing = !!normalizedCheckIn;
  const isSaving = isUpdatingGoal || isCreatingChallenge || isUpdatingChallenge;

  // Media permissions hook
  const {
    hasLibraryPermission,
    hasCameraPermission,
    requestLibraryPermission,
    requestCameraPermission,
  } = useMediaPermissions();

  // Local state
  const [notes, setNotes] = useState("");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);

  // Reset state when modal opens/closes or checkIn changes
  useEffect(() => {
    if (visible) {
      if (normalizedCheckIn) {
        setNotes(normalizedCheckIn.notes || "");
        setSelectedMood(normalizedCheckIn.mood || null);
        setSelectedPhoto(normalizedCheckIn.photo_url || null);
      } else {
        // Creating new check-in - reset to empty state
        setNotes("");
        setSelectedMood(null);
        setSelectedPhoto(null);
      }
      setUploadingPhoto(false);
    }
  }, [visible, normalizedCheckIn]);

  // Animation values - starts off-screen at the bottom
  const translateY = useMemo(() => new Animated.Value(screenHeight), []);

  // Internal visibility state to allow close animation to complete
  const [internalVisible, setInternalVisible] = useState(visible);

  // Handle modal visibility animation - slide from bottom to top
  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        mass: 1,
        stiffness: 120,
        useNativeDriver: true,
      }).start();
    } else if (internalVisible) {
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        setInternalVisible(false);
      });
    }
  }, [visible, translateY, screenHeight, internalVisible]);

  const title =
    normalizedCheckIn?.goal?.title ||
    normalizedCheckIn?.challenge?.title ||
    (isChallenge ? t("common.challenge") : t("common.goal"));

  // Handle photo selection from library
  const handlePickPhoto = async () => {
    setShowPhotoOptions(false);
    try {
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
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        handleUploadPhoto(result.assets[0].uri);
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
    setShowPhotoOptions(false);
    try {
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
        handleUploadPhoto(result.assets[0].uri);
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
    setUploadingPhoto(true);

    uploadMedia(
      { fileUri, options: { mediaType: "checkin" } },
      {
        onSuccess: (response) => {
          const uploadedUrl = response.data?.url;
          if (uploadedUrl) {
            setSelectedPhoto(uploadedUrl);
            // No toast needed - the visible photo is confirmation enough
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
          setUploadingPhoto(false);
        },
      },
    );
  };

  // Handle removing a photo
  const handleRemovePhoto = () => {
    if (selectedPhoto) {
      deleteMediaByUrl(selectedPhoto);
      setSelectedPhoto(null);
    }
  };

  const handleSave = () => {
    const checkInData = {
      notes: notes.trim() || undefined,
      mood: selectedMood || undefined,
      photo_url: selectedPhoto || undefined,
    };

    if (isChallenge && challengeId) {
      // Challenge check-in
      if (isEditing && normalizedCheckIn) {
        updateChallengeCheckIn(
          {
            challengeId,
            checkInId: normalizedCheckIn.id,
            data: checkInData,
          },
          {
            onSuccess: () => {
              showToast({
                title: t("common.success"),
                message: t("checkin.updated") || "Check-in updated!",
                variant: "success",
              });
              onComplete?.();
              onClose();
            },
            onError: (error) => {
              const errorDetails = getApiErrorDetails(error);
              showAlert({
                title: t("common.error"),
                message:
                  errorDetails.backendMessage ||
                  t("checkin.update_error") ||
                  "Failed to update check-in",
                variant: "error",
              });
            },
          },
        );
      } else {
        createChallengeCheckIn(
          {
            challengeId,
            data: checkInData,
          },
          {
            onSuccess: () => {
              showToast({
                title: t("common.success"),
                message: t("checkin.created") || "Check-in complete!",
                variant: "success",
              });
              onComplete?.();
              onClose();
            },
            onError: (error) => {
              const errorDetails = getApiErrorDetails(error);
              showAlert({
                title: t("common.error"),
                message:
                  errorDetails.backendMessage ||
                  t("checkin.create_error") ||
                  "Failed to check in",
                variant: "error",
              });
            },
          },
        );
      }
    } else if (goalId && normalizedCheckIn) {
      // Goal check-in (update only - goals create check-ins via scheduled tasks)
      updateGoalCheckIn(
        {
          checkInId: normalizedCheckIn.id,
          updates: {
            completed: true,
            notes: checkInData.notes,
            mood: checkInData.mood as CheckInMood | undefined,
            photo_url: checkInData.photo_url,
          },
        },
        {
          onSuccess: () => {
            showToast({
              title: t("common.success"),
              message: t("checkin.saved") || "Check-in saved!",
              variant: "success",
            });
            onComplete?.();
            onClose();
          },
          onError: (error) => {
            console.error("Error updating check-in:", error);
            showAlert({
              title: t("common.error"),
              message: t("checkin.update_error") || "Failed to save check-in",
              variant: "error",
              confirmLabel: t("common.ok"),
            });
          },
        },
      );
    }
  };

  const canSave = !isSaving && !isUploading && !uploadingPhoto;

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
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
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
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <SkeletonBox
                    width={60}
                    height={60}
                    borderRadius={30}
                    style={{
                      alignSelf: "center",
                      marginBottom: toRN(tokens.spacing[4]),
                    }}
                  />
                  <SkeletonBox
                    width="60%"
                    height={28}
                    borderRadius={toRN(tokens.borderRadius.md)}
                    style={{
                      alignSelf: "center",
                      marginBottom: toRN(tokens.spacing[2]),
                    }}
                  />
                  <SkeletonBox
                    width="40%"
                    height={20}
                    borderRadius={toRN(tokens.borderRadius.md)}
                    style={{ alignSelf: "center" }}
                  />
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
                  {/* Header Section */}
                  <View style={styles.headerSection}>
                    <View style={styles.checkInIcon}>
                      <Ionicons
                        name="checkmark-circle"
                        size={toRN(tokens.typography.fontSize["3xl"])}
                        color={brandColors.primary}
                      />
                    </View>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.subtitle}>
                      {normalizedCheckIn?.check_in_date ||
                        new Date().toLocaleDateString()}
                    </Text>
                  </View>

                  {/* Mood Section */}
                  <View style={styles.moodSection}>
                    <Text style={styles.sectionLabel}>
                      {t("checkin.how_feeling") || "How are you feeling?"}
                    </Text>
                    <View style={styles.moodContainer}>
                      {MOODS.map((mood) => {
                        const isSelected = selectedMood === mood.value;
                        return (
                          <TouchableOpacity
                            key={mood.value}
                            style={[
                              styles.moodButton,
                              isSelected && styles.moodButtonActive,
                            ]}
                            onPress={() =>
                              setSelectedMood(isSelected ? null : mood.value)
                            }
                            activeOpacity={0.7}
                          >
                            <MoodIcon
                              mood={mood.value as MoodType}
                              size={toRN(tokens.typography.fontSize["2xl"])}
                              selected={isSelected}
                            />
                            {isSelected && (
                              <View style={styles.moodCheck}>
                                <Ionicons
                                  name="checkmark"
                                  size={12}
                                  color={brandColors.onPrimary}
                                />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {selectedMood && (
                      <Text style={styles.moodLabel}>
                        {MOODS.find((m) => m.value === selectedMood)?.label ||
                          selectedMood}
                      </Text>
                    )}
                  </View>

                  {/* Notes Section */}
                  <Card shadow="sm" style={styles.notesCard}>
                    <Text style={styles.sectionLabel}>
                      {t("checkin.notes") || "Notes"}
                      <Text style={styles.optionalText}>
                        {" "}
                        ({t("common.optional")})
                      </Text>
                    </Text>
                    <TextInput
                      style={styles.notesInput}
                      placeholder={
                        t("checkin.notes_placeholder") || "How did it go?"
                      }
                      placeholderTextColor={colors.text.tertiary}
                      value={notes}
                      onChangeText={setNotes}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </Card>

                  {/* Photo Section */}
                  <View style={styles.photoSection}>
                    <Text style={styles.sectionLabel}>
                      {t("checkin.photo") || "Progress Photo"}
                      <Text style={styles.optionalText}>
                        {" "}
                        ({t("common.optional")})
                      </Text>
                    </Text>

                    {/* Selected Photo */}
                    {selectedPhoto && (
                      <View style={styles.photoContainer}>
                        <Image
                          source={{ uri: selectedPhoto }}
                          style={styles.photoPreview}
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          style={styles.removePhotoButton}
                          onPress={handleRemovePhoto}
                        >
                          <Ionicons
                            name="close-circle"
                            size={24}
                            color={colors.feedback.error}
                          />
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Uploading Photo */}
                    {uploadingPhoto && (
                      <View style={styles.uploadingContainer}>
                        <ActivityIndicator
                          size="small"
                          color={brandColors.primary}
                        />
                        <Text style={styles.uploadingText}>
                          {t("checkin.uploading") || "Uploading photo..."}
                        </Text>
                      </View>
                    )}

                    {/* Add Photo Button */}
                    {!selectedPhoto && !uploadingPhoto && (
                      <TouchableOpacity
                        style={styles.addPhotoButton}
                        onPress={() => setShowPhotoOptions(true)}
                        disabled={isUploading || uploadingPhoto}
                      >
                        <Ionicons
                          name="camera-outline"
                          size={toRN(tokens.typography.fontSize.xl)}
                          color={brandColors.primary}
                        />
                        <Text style={styles.addPhotoText}>
                          {t("checkin.add_photo") || "Add Photo"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

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
                        ? t("checkin.saving") || "Saving..."
                        : isEditing
                          ? t("common.save") || "Save"
                          : t("checkin.submit") || "Submit Check-in"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>

          {/* Photo Selection Action Sheet */}
          <ActionSheet
            visible={showPhotoOptions}
            title={t("checkin.add_photo") || "Add Photo"}
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
    position: "absolute" as const,
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
    flexDirection: "row" as const,
    justifyContent: "flex-end" as const,
    alignItems: "center" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[2]),
  },
  closeButton: {
    width: toRN(tokens.spacing[10]),
    height: toRN(tokens.spacing[10]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingBottom: toRN(tokens.spacing[6]),
  },
  headerSection: {
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[6]),
  },
  checkInIcon: {
    width: toRN(tokens.spacing[16]),
    height: toRN(tokens.spacing[16]),
    borderRadius: toRN(tokens.borderRadius.full),
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: toRN(tokens.spacing[3]),
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize["2xl"]),
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    textAlign: "center" as const,
    marginBottom: toRN(tokens.spacing[1]),
  },
  subtitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
    textAlign: "center" as const,
  },
  sectionLabel: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3]),
  },
  optionalText: {
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
  },
  moodSection: {
    marginBottom: toRN(tokens.spacing[6]),
  },
  moodContainer: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    gap: toRN(tokens.spacing[2]),
  },
  moodButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: toRN(tokens.borderRadius.xl),
    backgroundColor: colors.bg.muted,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    borderWidth: 2,
    borderColor: "transparent",
    position: "relative" as const,
  },
  moodButtonActive: {
    borderColor: brand.primary,
    backgroundColor: brand.primary + "10",
  },
  moodCheck: {
    position: "absolute" as const,
    top: toRN(tokens.spacing[1]),
    right: toRN(tokens.spacing[1]),
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: brand.primary,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  moodLabel: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: brand.primary,
    textAlign: "center" as const,
    marginTop: toRN(tokens.spacing[2]),
  },
  notesCard: {
    padding: toRN(tokens.spacing[4]),
    marginBottom: toRN(tokens.spacing[6]),
  },
  notesInput: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
    minHeight: toRN(tokens.spacing[20]),
    padding: toRN(tokens.spacing[3]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  photoSection: {
    marginBottom: toRN(tokens.spacing[6]),
  },
  photoContainer: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: toRN(tokens.borderRadius.xl),
    overflow: "hidden" as const,
    position: "relative" as const,
    marginTop: toRN(tokens.spacing[3]),
  },
  photoPreview: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.bg.muted,
  },
  removePhotoButton: {
    position: "absolute" as const,
    top: toRN(tokens.spacing[2]),
    right: toRN(tokens.spacing[2]),
    backgroundColor: colors.bg.canvas,
    borderRadius: toRN(tokens.borderRadius.full),
    padding: toRN(tokens.spacing[1]),
  },
  uploadingContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: toRN(tokens.spacing[2]),
    marginTop: toRN(tokens.spacing[3]),
    padding: toRN(tokens.spacing[4]),
    backgroundColor: colors.bg.muted,
    borderRadius: toRN(tokens.borderRadius.xl),
  },
  uploadingText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.secondary,
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
    marginTop: toRN(tokens.spacing[2]),
  },
  addPhotoText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.semiBold,
    color: brand.primary,
  },
  saveButton: {
    backgroundColor: brand.primary,
    paddingVertical: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginTop: toRN(tokens.spacing[4]),
  },
  saveButtonDisabled: {
    backgroundColor: colors.bg.muted,
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.bold,
    color: brand.onPrimary,
  },
  saveButtonTextDisabled: {
    color: colors.text.tertiary,
  },
});
