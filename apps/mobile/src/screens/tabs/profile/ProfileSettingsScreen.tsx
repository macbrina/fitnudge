import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/lib/i18n";
import { useStyles, useTheme } from "@/themes";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import BackButton from "@/components/ui/BackButton";
import { useUpdateProfile } from "@/hooks/api/useUser";
import { useAlertModal } from "@/contexts/AlertModalContext";
import { ApiError } from "@/services/api/base";
import { PROFILE_AVATARS } from "@/constants/general";

export default function ProfileSettingsScreen() {
  const styles = useStyles(makeStyles);
  const { colors, brandColors } = useTheme();
  const { user, updateUser } = useAuthStore();
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert } = useAlertModal();

  const updateProfileMutation = useUpdateProfile();

  // Form states
  const [name, setName] = useState(user?.name || "");
  const [username, setUsername] = useState(user?.username || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);

  // Track if form has changes
  const [hasChanges, setHasChanges] = useState(false);

  // Validation errors
  const [nameError, setNameError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  useEffect(() => {
    // Check if any field has changed
    const changed =
      name !== (user?.name || "") ||
      username !== (user?.username || "") ||
      bio !== (user?.bio || "") ||
      (selectedAvatar !== null && selectedAvatar !== user?.profile_picture_url);

    setHasChanges(changed);
  }, [name, username, bio, selectedAvatar, user]);

  const validateName = (value: string): boolean => {
    if (!value.trim()) {
      setNameError(t("profile_settings.name_required"));
      return false;
    }
    if (value.trim().length < 2) {
      setNameError(t("profile_settings.name_too_short"));
      return false;
    }
    setNameError(null);
    return true;
  };

  const validateUsername = (value: string): boolean => {
    if (!value.trim()) {
      setUsernameError(t("errors.username_required"));
      return false;
    }
    if (value.trim().length < 3) {
      setUsernameError(t("errors.username_too_short"));
      return false;
    }
    // Only allow letters, numbers, and underscores
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      setUsernameError(t("errors.username_invalid"));
      return false;
    }
    setUsernameError(null);
    return true;
  };

  const handleSave = async () => {
    // Validate all fields
    const isNameValid = validateName(name);
    const isUsernameValid = validateUsername(username);

    if (!isNameValid || !isUsernameValid) {
      return;
    }

    try {
      const updateData: Record<string, string> = {};

      if (name !== user?.name) {
        updateData.name = name.trim();
      }
      if (username !== user?.username) {
        updateData.username = username.trim().toLowerCase();
      }
      if (bio !== user?.bio) {
        updateData.bio = bio.trim();
      }
      if (selectedAvatar && selectedAvatar !== user?.profile_picture_url) {
        updateData.profile_picture_url = selectedAvatar;
      }

      if (Object.keys(updateData).length === 0) {
        router.back();
        return;
      }

      const response = await updateProfileMutation.mutateAsync(updateData);

      if (response.data) {
        updateUser(response.data);
        await showAlert({
          title: t("common.success"),
          message: t("profile_settings.update_success"),
          variant: "success"
        });
        router.back();
      } else if (response.error) {
        // Check for specific errors
        if (response.error.includes("username")) {
          setUsernameError(t("errors.username_already_taken"));
        } else {
          await showAlert({
            title: t("common.error"),
            message: response.error,
            variant: "error"
          });
        }
      }
    } catch (error: unknown) {
      console.error("Update profile error:", error);
      const errorMessage = error instanceof ApiError ? error.message : t("errors.generic_error");
      await showAlert({
        title: t("common.error"),
        message: errorMessage,
        variant: "error"
      });
    }
  };

  const getCurrentAvatarDisplay = () => {
    const avatarId = selectedAvatar || user?.profile_picture_url;
    const avatar = PROFILE_AVATARS.find((a) => a.id === avatarId);
    if (avatar) {
      return avatar;
    }
    // Default avatar
    return { id: "default", icon: "person-circle", color: brandColors.primary };
  };

  const currentAvatar = getCurrentAvatarDisplay();

  return (
    <View style={styles.container}>
      <BackButton title={t("profile_settings.title")} onPress={() => router.back()} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Photo Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={[styles.avatarContainer, { backgroundColor: `${currentAvatar.color}20` }]}
              onPress={() => setAvatarModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name={currentAvatar.icon as any} size={60} color={currentAvatar.color} />
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>{t("profile_settings.tap_to_change_photo")}</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            <Card style={styles.formCard}>
              {/* Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("profile_settings.name_label")}</Text>
                <TextInput
                  style={[styles.input, nameError && styles.inputError]}
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (nameError) validateName(text);
                  }}
                  onBlur={() => validateName(name)}
                  placeholder={t("profile_settings.name_placeholder")}
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="words"
                />
                {nameError && <Text style={styles.errorText}>{nameError}</Text>}
              </View>

              {/* Username Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("profile_settings.username_label")}</Text>
                <View style={styles.usernameInputContainer}>
                  <Text style={styles.usernamePrefix}>@</Text>
                  <TextInput
                    style={[styles.usernameInput, usernameError && styles.inputError]}
                    value={username}
                    onChangeText={(text) => {
                      const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, "");
                      setUsername(cleaned);
                      if (usernameError) validateUsername(cleaned);
                    }}
                    onBlur={() => validateUsername(username)}
                    placeholder={t("profile_settings.username_placeholder")}
                    placeholderTextColor={colors.text.tertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {usernameError && <Text style={styles.errorText}>{usernameError}</Text>}
              </View>

              {/* Bio Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {t("profile_settings.bio_label")}{" "}
                  <Text style={styles.optional}>({t("common.optional")})</Text>
                </Text>
                <TextInput
                  style={[styles.input, styles.bioInput]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder={t("profile_settings.bio_placeholder")}
                  placeholderTextColor={colors.text.tertiary}
                  multiline
                  numberOfLines={3}
                  maxLength={160}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{bio.length}/160</Text>
              </View>
            </Card>
          </View>

          {/* Save Button */}
          <View style={styles.buttonSection}>
            <Button
              title={t("common.save")}
              onPress={handleSave}
              loading={updateProfileMutation.isPending}
              disabled={!hasChanges || updateProfileMutation.isPending}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Avatar Selection Modal */}
      <Modal visible={avatarModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setAvatarModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t("profile_settings.choose_avatar")}</Text>
            <View style={styles.modalCloseButton} />
          </View>

          <FlatList
            data={PROFILE_AVATARS}
            numColumns={4}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.avatarGrid}
            columnWrapperStyle={styles.avatarRow}
            renderItem={({ item }) => {
              const isSelected =
                item.id === selectedAvatar ||
                (selectedAvatar === null && item.id === user?.profile_picture_url);
              return (
                <TouchableOpacity
                  style={[
                    styles.avatarOption,
                    { backgroundColor: `${item.color}20` },
                    isSelected && styles.avatarOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedAvatar(item.id);
                    setAvatarModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name={item.icon as any} size={36} color={item.color} />
                  {isSelected && (
                    <View style={styles.avatarCheckmark}>
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  keyboardView: {
    flex: 1
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: toRN(tokens.spacing[8])
  },
  // Avatar Section
  avatarSection: {
    alignItems: "center" as const,
    paddingVertical: toRN(tokens.spacing[6])
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    position: "relative" as const
  },
  avatarEditBadge: {
    position: "absolute" as const,
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: brand.primary,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    borderWidth: 2,
    borderColor: colors.bg.canvas
  },
  avatarHint: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    marginTop: toRN(tokens.spacing[2])
  },
  // Form Section
  formSection: {
    paddingHorizontal: toRN(tokens.spacing[4])
  },
  formCard: {
    padding: toRN(tokens.spacing[4])
  },
  inputGroup: {
    marginBottom: toRN(tokens.spacing[4])
  },
  label: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    marginBottom: toRN(tokens.spacing[1.5])
  },
  optional: {
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary
  },
  input: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
    backgroundColor: colors.bg.canvas,
    borderRadius: toRN(tokens.borderRadius.lg),
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: toRN(tokens.spacing[3]),
    paddingVertical: toRN(tokens.spacing[3])
  },
  inputError: {
    borderColor: colors.feedback.error
  },
  bioInput: {
    minHeight: 80,
    paddingTop: toRN(tokens.spacing[3])
  },
  charCount: {
    fontSize: toRN(tokens.typography.fontSize.xs),
    fontFamily: fontFamily.regular,
    color: colors.text.tertiary,
    textAlign: "right" as const,
    marginTop: toRN(tokens.spacing[1])
  },
  usernameInputContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: colors.bg.canvas,
    borderRadius: toRN(tokens.borderRadius.lg),
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  usernamePrefix: {
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.medium,
    color: colors.text.tertiary,
    paddingLeft: toRN(tokens.spacing[3])
  },
  usernameInput: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
    paddingHorizontal: toRN(tokens.spacing[2]),
    paddingVertical: toRN(tokens.spacing[3]),
    borderWidth: 0
  },
  errorText: {
    fontSize: toRN(tokens.typography.fontSize.sm),
    fontFamily: fontFamily.regular,
    color: colors.feedback.error,
    marginTop: toRN(tokens.spacing[1])
  },
  // Button Section
  buttonSection: {
    paddingHorizontal: toRN(tokens.spacing[4]),
    marginTop: toRN(tokens.spacing[4])
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg.canvas
  },
  modalHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: "center" as const,
    alignItems: "center" as const
  },
  modalTitle: {
    fontSize: toRN(tokens.typography.fontSize.lg),
    fontFamily: fontFamily.semiBold,
    color: colors.text.primary
  },
  avatarGrid: {
    padding: toRN(tokens.spacing[4])
  },
  avatarRow: {
    justifyContent: "space-between" as const,
    marginBottom: toRN(tokens.spacing[3])
  },
  avatarOption: {
    width: "22%" as any,
    aspectRatio: 1,
    borderRadius: toRN(tokens.borderRadius.xl),
    justifyContent: "center" as const,
    alignItems: "center" as const,
    position: "relative" as const
  },
  avatarOptionSelected: {
    borderWidth: 2,
    borderColor: brand.primary
  },
  avatarCheckmark: {
    position: "absolute" as const,
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: brand.primary,
    justifyContent: "center" as const,
    alignItems: "center" as const
  }
});
