import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useStyles } from "@/themes/makeStyles";
import { fontFamily } from "@/lib/fonts";
import { toRN } from "@/lib/units";

interface CheckboxProps {
  checked: boolean;
  onPress: () => void;
  label?: string;
  disabled?: boolean;
  size?: number;
  containerStyle?: any;
  labelStyle?: any;
}

const makeCheckboxStyles = (tokens: any, colors: any, brandColors: any) => {
  return {
    container: {
      flexDirection: "row" as const,
      alignItems: "center" as const
    },
    checkbox: {
      width: 20,
      height: 20,
      borderWidth: 2,
      borderColor: colors.border.default,
      borderRadius: 4,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginRight: toRN(tokens.spacing[2])
    },
    checkboxChecked: {
      backgroundColor: brandColors.primary,
      borderColor: brandColors.primary
    },
    checkboxDisabled: {
      opacity: 0.5
    },
    checkmark: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "bold" as const
    },
    label: {
      fontSize: toRN(tokens.typography.fontSize.sm),
      color: colors.text.primary,
      fontFamily: fontFamily.groteskRegular,
      flex: 1
    },
    labelDisabled: {
      color: colors.text.muted
    }
  };
};

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onPress,
  label,
  disabled = false,
  size = 20,
  containerStyle,
  labelStyle
}) => {
  const styles = useStyles(makeCheckboxStyles);

  const getCheckboxStyle = () => {
    const style = [styles.checkbox, { width: size, height: size }];
    if (checked) style.push(styles.checkboxChecked);
    if (disabled) style.push(styles.checkboxDisabled);
    return style;
  };

  const getLabelStyle = () => {
    const style = [styles.label];
    if (disabled) style.push(styles.labelDisabled);
    if (labelStyle) style.push(labelStyle);
    return style;
  };

  return (
    <TouchableOpacity
      style={[styles.container, containerStyle]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={getCheckboxStyle()}>{checked && <Text style={styles.checkmark}>✓</Text>}</View>
      {label && <Text style={getLabelStyle()}>{label}</Text>}
    </TouchableOpacity>
  );
};

export default Checkbox;
