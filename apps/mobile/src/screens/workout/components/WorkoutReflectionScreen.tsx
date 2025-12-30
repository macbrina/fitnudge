import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Animated,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useStyles, useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { useTranslation } from "@/lib/i18n";
import { useMediaPermissions } from "@/hooks/media/useMediaPermissions";
import { useUploadMedia } from "@/hooks/api/useMedia";
import { ActionSheet } from "@/components/ui/ActionSheet";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { MoodIcon, MOODS, MoodType } from "@/components/icons/MoodIcons";

export interface WorkoutReflectionData {
  mood?: string;
  notes?: string;
  photo_url?: string;
}

interface WorkoutReflectionScreenProps {
  onContinue: (data: WorkoutReflectionData | null) => void;
  onSkip: () => void;
}

export function WorkoutReflectionScreen({
  onContinue,
  onSkip,
}: WorkoutReflectionScreenProps) {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { showAlert, showToast } = useAlertModal();

  // State
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);

  // Media permissions
  const {
    hasLibraryPermission,
    hasCameraPermission,
    requestLibraryPermission,
    requestCameraPermission,
  } = useMediaPermissions();

  // Upload hook
  const { mutateAsync: uploadMedia } = useUploadMedia();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Handle photo selection
  const handlePickPhoto = async () => {
    let hasPermission = hasLibraryPermission;
    if (!hasPermission) {
      hasPermission = await requestLibraryPermission();
    }

    if (!hasPermission) {
      showAlert({
        title: t("common.permission_required") || "Permission Required",
        message:
          t("common.photo_library_permission") ||
          "Please allow access to your photo library",
        variant: "warning",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    let hasPermission = hasCameraPermission;
    if (!hasPermission) {
      hasPermission = await requestCameraPermission();
    }

    if (!hasPermission) {
      showAlert({
        title: t("common.permission_required") || "Permission Required",
        message:
          t("common.camera_permission") || "Please allow access to your camera",
        variant: "warning",
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    setIsUploading(true);
    try {
      const uploadResult = await uploadMedia({
        fileUri: uri,
        options: {
          mediaType: "checkin",
        },
      });

      if (uploadResult?.data?.url) {
        setPhotoUrl(uploadResult.data.url);
        showToast({
          title: t("common.success") || "Success",
          message: t("common.photo_uploaded") || "Photo uploaded",
          variant: "success",
        });
      }
    } catch (error) {
      console.error("Failed to upload photo:", error);
      showAlert({
        title: t("common.error") || "Error",
        message: t("common.upload_failed") || "Failed to upload photo",
        variant: "error",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl(null);
  };

  const handleContinue = () => {
    // Only include data if something was entered
    if (!selectedMood && !notes.trim() && !photoUrl) {
      onContinue(null);
      return;
    }

    onContinue({
      mood: selectedMood || undefined,
      notes: notes.trim() || undefined,
      photo_url: photoUrl || undefined,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + toRN(24) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              marginTop: insets.top + toRN(20),
            },
          ]}
        >
          <Text style={styles.title}>
            {t("completion.reflection.title") || "How was your workout?"}
          </Text>
          <Text style={styles.subtitle}>
            {t("completion.reflection.subtitle") ||
              "Take a moment to reflect (optional)"}
          </Text>
        </Animated.View>

        {/* Mood Selection */}
        <Animated.View
          style={[
            styles.section,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <Text style={styles.sectionTitle}>
            {t("completion.reflection.mood_label") || "How do you feel?"}
          </Text>
          <View style={styles.moodContainer}>
            {MOODS.map((mood) => {
              const isSelected = selectedMood === mood.value;
              return (
                <TouchableOpacity
                  key={mood.value}
                  style={[
                    styles.moodOption,
                    isSelected && styles.moodOptionSelected,
                  ]}
                  onPress={() =>
                    setSelectedMood(isSelected ? null : mood.value)
                  }
                  activeOpacity={0.7}
                >
                  <MoodIcon
                    mood={mood.value as MoodType}
                    size={32}
                    selected={isSelected}
                  />
                  <Text
                    style={[
                      styles.moodLabel,
                      isSelected && styles.moodLabelSelected,
                    ]}
                  >
                    {t(`checkin.mood.${mood.value}`) || mood.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* Notes Section */}
        <Animated.View
          style={[
            styles.section,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <Text style={styles.sectionTitle}>
            {t("completion.reflection.notes_label") || "Any notes?"}
          </Text>
          <TextInput
            style={styles.notesInput}
            placeholder={
              t("completion.reflection.notes_placeholder") ||
              "How did the workout feel? Any observations..."
            }
            placeholderTextColor={colors.text.tertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Animated.View>

        {/* Photo Section */}
        <Animated.View
          style={[
            styles.section,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <Text style={styles.sectionTitle}>
            {t("completion.reflection.photo_label") || "Add a photo"}
          </Text>

          {photoUrl ? (
            <View style={styles.photoPreviewContainer}>
              <Image source={{ uri: photoUrl }} style={styles.photoPreview} />
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={handleRemovePhoto}
              >
                <Ionicons name="close-circle" size={28} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addPhotoButton}
              onPress={() => setShowPhotoOptions(true)}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color={brandColors.primary} />
              ) : (
                <>
                  <Ionicons
                    name="camera-outline"
                    size={32}
                    color={colors.text.tertiary}
                  />
                  <Text style={styles.addPhotoText}>
                    {t("completion.reflection.add_photo") || "Tap to add photo"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Buttons */}
        <View style={styles.buttonsContainer}>
          <Pressable style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>
              {t("common.continue") || "Continue"}
            </Text>
          </Pressable>

          <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipButtonText}>
              {t("common.skip") || "Skip"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Photo Options Action Sheet */}
      <ActionSheet
        visible={showPhotoOptions}
        onClose={() => setShowPhotoOptions(false)}
        title={t("checkin.photo_options") || "Add Photo"}
        options={[
          {
            id: "take-photo",
            label: t("checkin.take_photo") || "Take Photo",
            icon: "camera",
            onPress: () => {
              setShowPhotoOptions(false);
              handleTakePhoto();
            },
          },
          {
            id: "choose-library",
            label: t("checkin.choose_from_library") || "Choose from Library",
            icon: "image",
            onPress: () => {
              setShowPhotoOptions(false);
              handlePickPhoto();
            },
          },
        ]}
      />
    </KeyboardAvoidingView>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: toRN(tokens.spacing[5]),
  },
  header: {
    marginBottom: toRN(tokens.spacing[6]),
  },
  title: {
    fontSize: toRN(tokens.typography.fontSize["3xl"]),
    fontFamily: fontFamily.groteskBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[2]),
  },
  subtitle: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
  },
  section: {
    marginBottom: toRN(tokens.spacing[6]),
  },
  sectionTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary,
    marginBottom: toRN(tokens.spacing[3]),
  },
  moodContainer: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
  },
  moodOption: {
    alignItems: "center" as const,
    padding: toRN(tokens.spacing[2]),
    borderRadius: toRN(tokens.borderRadius.lg),
    minWidth: toRN(60),
    gap: toRN(tokens.spacing[1]),
  },
  moodOptionSelected: {
    backgroundColor: brand.primary + "20",
    borderWidth: 2,
    borderColor: brand.primary,
  },
  moodLabel: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
  },
  moodLabelSelected: {
    color: brand.primary,
    fontFamily: fontFamily.semiBold,
  },
  notesInput: {
    backgroundColor: colors.bg.secondary,
    borderRadius: toRN(tokens.borderRadius.lg),
    padding: toRN(tokens.spacing[4]),
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
    minHeight: toRN(120),
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  addPhotoButton: {
    backgroundColor: colors.bg.secondary,
    borderRadius: toRN(tokens.borderRadius.lg),
    borderWidth: 2,
    borderColor: colors.border.subtle,
    borderStyle: "dashed" as const,
    padding: toRN(tokens.spacing[6]),
    alignItems: "center" as const,
    justifyContent: "center" as const,
    minHeight: toRN(120),
  },
  addPhotoText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[2]),
  },
  photoPreviewContainer: {
    position: "relative" as const,
    borderRadius: toRN(tokens.borderRadius.lg),
    overflow: "hidden" as const,
  },
  photoPreview: {
    width: "100%",
    height: toRN(200),
    borderRadius: toRN(tokens.borderRadius.lg),
  },
  removePhotoButton: {
    position: "absolute" as const,
    top: toRN(tokens.spacing[2]),
    right: toRN(tokens.spacing[2]),
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: toRN(14),
  },
  buttonsContainer: {
    marginTop: "auto" as const,
    paddingTop: toRN(tokens.spacing[4]),
    gap: toRN(tokens.spacing[3]),
  },
  continueButton: {
    width: "100%",
    paddingVertical: toRN(tokens.spacing[4]),
    borderRadius: toRN(tokens.borderRadius.xl),
    backgroundColor: brand.primary,
    alignItems: "center" as const,
  },
  continueButtonText: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.bold,
    color: "#FFFFFF",
  },
  skipButton: {
    width: "100%",
    paddingVertical: toRN(tokens.spacing[3]),
    alignItems: "center" as const,
  },
  skipButtonText: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
  },
});

export default WorkoutReflectionScreen;
