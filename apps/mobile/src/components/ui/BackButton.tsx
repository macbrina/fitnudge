import React from "react";
import { TouchableOpacity, View } from "react-native";
import { ArrowBackIcon } from "@/components/icons/arrow-back-icon";
import { useTheme } from "@/themes";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toRN } from "@/lib/units";
import { tokens } from "@/themes/tokens";

interface BackButtonProps {
  onPress?: () => void;
  style?: any;
}

export const BackButton: React.FC<BackButtonProps> = ({ onPress, style }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        {
          paddingTop: insets.top + toRN(tokens.spacing[4]),
          paddingHorizontal: toRN(tokens.spacing[6]),
          paddingBottom: toRN(tokens.spacing[4]),
        },
        style,
      ]}
    >
      <TouchableOpacity
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.bg.muted,
          justifyContent: "center",
          alignItems: "center",
          shadowColor: colors.shadow.default,
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
        onPress={onPress}
      >
        <ArrowBackIcon size={24} color={colors.text.primary} />
      </TouchableOpacity>
    </View>
  );
};

export default BackButton;
