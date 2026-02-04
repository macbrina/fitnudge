import React, { useState } from "react";
import { View, Text, TextInput as RNTextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useStyles } from "@/themes/makeStyles";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { EyeClosedIcon } from "@/components/icons/eye-closed-icon";
import { EyeOpenIcon } from "@/components/icons/eye-open-icon";
import { useTheme } from "@/themes";

export interface TextInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  autoFocus?: boolean;
  error?: string;
  disabled?: boolean;
  showPasswordToggle?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: any;
  inputStyle?: any;
  labelStyle?: any;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  onBlur?: () => void;
  onFocus?: () => void;
  testID?: string;
}

const makeTextInputStyles = (tokens: any, colors: any, brandColors: any) => {
  return {
    container: {
      marginBottom: toRN(tokens.spacing[4])
    },
    label: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      fontWeight: tokens.typography.fontWeight.medium,
      color: colors.text.primary,
      marginBottom: toRN(tokens.spacing[2]),
      fontFamily: fontFamily.groteskMedium
    },
    inputContainer: {
      position: "relative" as const,
      flexDirection: "row" as const,
      alignItems: "center" as const
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: toRN(tokens.borderRadius.lg),
      paddingHorizontal: toRN(tokens.spacing[4]),
      paddingVertical: toRN(tokens.spacing[3]),
      fontSize: toRN(tokens.typography.fontSize.base),
      backgroundColor: colors.bg.card,
      color: colors.text.primary,
      fontFamily: fontFamily.groteskRegular,
      minHeight: toRN(48)
    },
    inputMultiline: {
      textAlignVertical: "top" as const,
      minHeight: toRN(80),
      paddingTop: toRN(tokens.spacing[3])
    },
    inputFocused: {
      borderColor: brandColors.primary,
      borderWidth: 1
    },
    inputError: {
      borderColor: colors.feedback.error,
      borderWidth: 2
    },
    inputDisabled: {
      backgroundColor: colors.bg.muted,
      color: colors.text.muted
    },
    leftIconContainer: {
      position: "absolute" as const,
      left: toRN(tokens.spacing[3]),
      zIndex: 1
    },
    rightIconContainer: {
      position: "absolute" as const,
      right: toRN(tokens.spacing[3]),
      zIndex: 1
    },
    passwordToggle: {
      padding: toRN(tokens.spacing[1])
    },
    errorText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.feedback.error,
      marginTop: toRN(tokens.spacing[1]),
      fontFamily: fontFamily.groteskRegular
    }
  };
};

export const TextInput: React.FC<TextInputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = "default",
  autoCapitalize = "none",
  autoCorrect = true,
  autoFocus = false,
  error,
  disabled = false,
  showPasswordToggle = false,
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  labelStyle,
  multiline = false,
  numberOfLines,
  maxLength,
  onBlur,
  onFocus,
  testID
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);
  const { colors } = useTheme();
  const styles = useStyles(makeTextInputStyles);

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };
  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const getInputStyle = () => {
    const style = [styles.input];

    if (multiline) style.push(styles.inputMultiline);
    if (isFocused) style.push(styles.inputFocused);
    if (error) style.push(styles.inputError);
    if (disabled) style.push(styles.inputDisabled);
    if (leftIcon && !multiline) style.push({ paddingLeft: toRN(40) });
    if ((rightIcon || showPasswordToggle) && !multiline) style.push({ paddingRight: toRN(40) });
    if (inputStyle) style.push(inputStyle);

    return style;
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, labelStyle]}>{label}</Text>}

      <View style={styles.inputContainer}>
        {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}

        <RNTextInput
          testID={testID}
          style={getInputStyle()}
          placeholder={placeholder}
          placeholderTextColor={disabled ? colors.text.muted : colors.text.tertiary}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          autoFocus={autoFocus}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
        />

        {showPasswordToggle && (
          <TouchableOpacity
            style={[styles.rightIconContainer, styles.passwordToggle]}
            onPress={togglePasswordVisibility}
            disabled={disabled}
          >
            {isPasswordVisible ? (
              <EyeOpenIcon size={24} color={disabled ? colors.text.muted : colors.text.secondary} />
            ) : (
              <EyeClosedIcon
                size={24}
                color={disabled ? colors.text.muted : colors.text.secondary}
              />
            )}
          </TouchableOpacity>
        )}

        {rightIcon && !showPasswordToggle && (
          <View style={styles.rightIconContainer}>{rightIcon}</View>
        )}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

export default TextInput;
