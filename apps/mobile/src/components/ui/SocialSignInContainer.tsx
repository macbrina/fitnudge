import React from "react";
import { View, Text } from "react-native";
import { useStyles } from "@/themes/makeStyles";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import SocialSignInButton from "./SocialSignInButton";
import { useTheme } from "@/themes";

interface SocialSignInContainerProps {
  onGooglePress?: () => void;
  onApplePress?: () => void;
  showGoogle?: boolean;
  showApple?: boolean;
  googleDisabled?: boolean;
  appleDisabled?: boolean;
  googleLoading?: boolean;
  appleLoading?: boolean;
  showDividerText?: boolean;
  containerStyle?: any;
}

const makeSocialSignInContainerStyles = (tokens: any, colors: any, brandColors: any) => {
  return {
    container: {
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[8]),
      paddingHorizontal: toRN(tokens.spacing[6])
    },
    orText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: "#9ca3af",
      fontFamily: fontFamily.groteskRegular
    }
  };
};

export const SocialSignInContainer: React.FC<SocialSignInContainerProps> = ({
  onGooglePress,
  onApplePress,
  showGoogle = true,
  showApple = true,
  googleDisabled = false,
  appleDisabled = false,
  googleLoading = false,
  appleLoading = false,
  showDividerText = true,
  containerStyle
}) => {
  const { isDark } = useTheme();
  const styles = useStyles(makeSocialSignInContainerStyles);

  const renderGoogle = showGoogle;
  const renderApple = showApple;
  const googleHandler = onGooglePress ?? (() => {});
  const appleHandler = onApplePress ?? (() => {});

  if (!renderGoogle && !renderApple) {
    return null;
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {renderGoogle && (
        <SocialSignInButton
          provider="google"
          onPress={googleHandler}
          disabled={googleDisabled}
          loading={googleLoading}
          isDark={isDark}
        />
      )}

      {renderApple && (
        <SocialSignInButton
          provider="apple"
          onPress={appleHandler}
          disabled={appleDisabled}
          loading={appleLoading}
          isDark={isDark}
        />
      )}

      {showDividerText && renderGoogle && renderApple && (
        <Text style={styles.orText}>or sign in with</Text>
      )}
    </View>
  );
};

export default SocialSignInContainer;
