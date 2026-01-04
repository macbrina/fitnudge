import React from "react";
import { TouchableOpacity, Text, View, ActivityIndicator } from "react-native";
import { useStyles } from "@/themes/makeStyles";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import { GoogleIcon } from "@/components/icons/google-icon";
import { AppleIcon } from "@/components/icons/apple-icon";

interface SocialSignInButtonProps {
  provider: "google" | "apple";
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: any;
}

const makeSocialSignInButtonStyles = (tokens: any, colors: any, brandColors: any) => {
  return {
    button: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      width: "100%",
      paddingVertical: toRN(tokens.spacing[4]),
      paddingHorizontal: toRN(tokens.spacing[6]),
      borderWidth: 1,
      borderRadius: toRN(tokens.borderRadius.full),
      marginBottom: toRN(tokens.spacing[6])
    },
    googleButton: {
      borderColor: "#e5e7eb",
      backgroundColor: "#ffffff"
    },
    appleButton: {
      borderColor: "#000000",
      backgroundColor: "#000000"
    },
    buttonDisabled: {
      opacity: 0.5
    },
    buttonText: {
      fontSize: toRN(tokens.typography.fontSize.base),
      marginLeft: toRN(tokens.spacing[3]),
      fontFamily: fontFamily.groteskMedium
    },
    googleButtonText: {
      color: "#374151"
    },
    appleButtonText: {
      color: "#ffffff"
    },
    iconContainer: {
      width: 20,
      height: 20,
      justifyContent: "center" as const,
      alignItems: "center" as const
    }
  };
};

export const SocialSignInButton: React.FC<SocialSignInButtonProps> = ({
  provider,
  onPress,
  disabled = false,
  loading = false,
  style
}) => {
  const styles = useStyles(makeSocialSignInButtonStyles);

  const getButtonStyle = () => {
    const buttonStyle = [styles.button];

    if (provider === "google") {
      buttonStyle.push(styles.googleButton);
    } else if (provider === "apple") {
      buttonStyle.push(styles.appleButton);
    }

    if (disabled || loading) {
      buttonStyle.push(styles.buttonDisabled);
    }

    if (style) {
      buttonStyle.push(style);
    }

    return buttonStyle;
  };

  const getButtonTextStyle = () => {
    const textStyle = [styles.buttonText];

    if (provider === "google") {
      textStyle.push(styles.googleButtonText);
    } else if (provider === "apple") {
      textStyle.push(styles.appleButtonText);
    }

    if (loading) {
      textStyle.push({ opacity: 0.8 });
    }

    return textStyle;
  };

  const getButtonText = () => {
    if (loading) {
      return provider === "google" ? "Signing in with Google..." : "Signing in with Apple...";
    }
    return provider === "google" ? "Sign in with Google" : "Sign in with Apple";
  };

  const renderIcon = () => {
    if (loading) {
      const spinnerColor = provider === "apple" ? "#ffffff" : "#374151";
      return <ActivityIndicator size="small" color={spinnerColor} />;
    }
    if (provider === "google") {
      return <GoogleIcon size={20} />;
    } else if (provider === "apple") {
      return <AppleIcon size={20} color="#ffffff" />;
    }
    return null;
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>{renderIcon()}</View>
      <Text style={getButtonTextStyle()}>{getButtonText()}</Text>
    </TouchableOpacity>
  );
};

export default SocialSignInButton;
