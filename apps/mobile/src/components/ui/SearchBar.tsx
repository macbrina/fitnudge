import React from "react";
import { View, TextInput, TouchableOpacity } from "react-native";
import { useStyles } from "@/themes";
import { useTheme } from "@/themes";
import { tokens } from "@/themes/tokens";
import { toRN } from "@/lib/units";
import { fontFamily } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: any;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search...",
  style,
}: SearchBarProps) {
  const styles = useStyles(makeSearchBarStyles);
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <Ionicons
        name="search"
        size={toRN(tokens.typography.fontSize.lg)}
        color={colors.text.tertiary}
        style={styles.searchIcon}
      />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText("")}
          style={styles.clearButton}
        >
          <Ionicons
            name="close-circle"
            size={toRN(tokens.typography.fontSize.base)}
            color={colors.text.tertiary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeSearchBarStyles = (tokens: any, colors: any, brand: any) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg.card,
    borderRadius: toRN(tokens.borderRadius.full),
    paddingHorizontal: toRN(tokens.spacing[4]),
    paddingVertical: toRN(tokens.spacing[3]),
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  searchIcon: {
    marginRight: toRN(tokens.spacing[2]),
  },
  input: {
    flex: 1,
    fontSize: toRN(tokens.typography.fontSize.base),
    fontFamily: fontFamily.regular,
    color: colors.text.primary,
    padding: 0,
  },
  clearButton: {
    marginLeft: toRN(tokens.spacing[2]),
    padding: toRN(tokens.spacing[1]),
  },
});
