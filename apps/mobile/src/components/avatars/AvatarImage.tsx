import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getAvatarSource } from "./avatarSources";

export interface AvatarImageProps {
  /** Avatar id "1"–"32" (matches assets/avatars/avatar-N.svg). */
  avatarId: string | null | undefined;
  size?: number;
  /** Optional background color when using fallback icon. */
  fallbackColor?: string;
  style?: object;
}

const DEFAULT_SIZE = 48;
const FALLBACK_AVATAR_ID = "1";

export function AvatarImage({
  avatarId,
  size = DEFAULT_SIZE,
  fallbackColor = "#94A3B8",
  style
}: AvatarImageProps) {
  const id = avatarId ?? FALLBACK_AVATAR_ID;
  const Source = getAvatarSource(id);

  if (Source) {
    return (
      <View style={[{ width: size, height: size }, style]}>
        <Source width={size} height={size} />
      </View>
    );
  }

  return (
    <View
      style={[{ width: size, height: size, justifyContent: "center", alignItems: "center" }, style]}
    >
      <Ionicons name="person-circle" size={size} color={fallbackColor} />
    </View>
  );
}
