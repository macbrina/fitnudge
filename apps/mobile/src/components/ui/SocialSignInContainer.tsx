import React from "react";
import { View, Text } from "react-native";
import { useStyles } from "@/themes/makeStyles";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";
import SocialSignInButton from "./SocialSignInButton";

interface SocialSignInContainerProps {
  onGooglePress: () => void;
  onApplePress: () => void;
  showOrText?: boolean;
  containerStyle?: any;
}

const makeSocialSignInContainerStyles = (
  tokens: any,
  colors: any,
  brandColors: any
) => {
  return {
    container: {
      alignItems: "center" as const,
      marginBottom: toRN(tokens.spacing[8]),
      paddingHorizontal: toRN(tokens.spacing[6]),
    },
    orText: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: "#9ca3af",
      fontFamily: fontFamily.groteskRegular,
    },
  };
};

export const SocialSignInContainer: React.FC<SocialSignInContainerProps> = ({
  onGooglePress,
  onApplePress,
  showOrText = true,
  containerStyle,
}) => {
  const styles = useStyles(makeSocialSignInContainerStyles);

  return (
    <View style={[styles.container, containerStyle]}>
      <SocialSignInButton provider="google" onPress={onGooglePress} />

      <SocialSignInButton provider="apple" onPress={onApplePress} />

      {showOrText && <Text style={styles.orText}>or sign in with</Text>}
    </View>
  );
};

export default SocialSignInContainer;
