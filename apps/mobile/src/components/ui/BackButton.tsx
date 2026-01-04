import React from "react";
import { TouchableOpacity, View, Text, ViewStyle } from "react-native";
import { ArrowBackIcon } from "@/components/icons/arrow-back-icon";
import { useTheme } from "@/themes";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toRN } from "@/lib/units";
import { tokens } from "@/themes/tokens";
import { useStyles } from "@/themes/makeStyles";
import { fontFamily } from "@/lib/fonts";
import { TextInput, TextInputProps } from "./TextInput";

interface BackButtonProps {
  onPress?: () => void;
  style?: ViewStyle;
  title?: string;
  titleCentered?: boolean;
  textInput?: TextInputProps & { position?: "left" | "right" };
  rightInput?: React.ReactNode;
}

export const BackButton: React.FC<BackButtonProps> = ({
  onPress,
  style,
  title,
  titleCentered = false,
  textInput,
  rightInput
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeBackButtonStyles);

  const hasTitle = !!title;
  const hasTextInput = !!textInput;
  const hasRightInput = !!rightInput;
  const textInputPosition = textInput?.position || "right";

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={onPress}>
          <ArrowBackIcon size={24} color={colors.text.primary} />
        </TouchableOpacity>

        {hasTitle && !titleCentered && (
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {title}
          </Text>
        )}

        {hasTextInput && textInputPosition === "left" && (
          <View style={styles.textInputContainer}>
            <TextInput {...textInput} containerStyle={styles.textInputWrapper} />
          </View>
        )}

        {hasTitle && titleCentered && (
          <View style={styles.centeredTitleContainer}>
            <Text
              style={[styles.title, styles.titleCentered]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
          </View>
        )}

        {hasTextInput && textInputPosition === "right" && (
          <View style={styles.textInputContainer}>
            <TextInput {...textInput} containerStyle={styles.textInputWrapper} />
          </View>
        )}

        {hasRightInput && <View style={styles.rightInputContainer}>{rightInput}</View>}
      </View>
    </View>
  );
};

const makeBackButtonStyles = (tokens: any, colors: any, brand: any) => {
  return {
    container: {
      paddingHorizontal: toRN(tokens.spacing[6]),
      paddingVertical: toRN(tokens.spacing[4]),
      borderBottomWidth: 1,
      borderBottomColor: colors.border.default,
      marginBottom: toRN(tokens.spacing[4])
    },
    content: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "flex-start" as const,
      gap: toRN(tokens.spacing[3]),
      position: "relative" as const
    },
    backButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.bg.muted,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      shadowColor: colors.shadow.default,
      shadowOffset: {
        width: 0,
        height: 2
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      zIndex: 2
    },
    title: {
      fontSize: toRN(tokens.typography.fontSize.lg),
      fontWeight: tokens.typography.fontWeight.bold,
      color: colors.text.primary,
      fontFamily: fontFamily.groteskBold,
      flex: 1
    },
    titleCentered: {
      flex: 0,
      textAlign: "center" as const
    },
    centeredTitleContainer: {
      position: "absolute" as const,
      left: 60, // Space for back button (48px) + gap (12px)
      right: 60, // Symmetric padding
      alignItems: "center" as const,
      justifyContent: "center" as const,
      pointerEvents: "none" as const,
      zIndex: 0
    },
    textInputContainer: {
      flex: 1,
      maxWidth: 200,
      zIndex: 1
    },
    textInputWrapper: {
      marginBottom: 0
    },
    rightInputContainer: {
      marginLeft: "auto" as const,
      zIndex: 1
    }
  };
};

export default BackButton;
