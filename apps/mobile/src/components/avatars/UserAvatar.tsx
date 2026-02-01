import React from "react";
import { Image, Text, View } from "react-native";
import { fontFamily } from "@/lib/fonts";
import { AvatarImage } from "./AvatarImage";
import { isProfilePictureUrl, normalizeAvatarId } from "./avatarSources";

export interface UserAvatarProps {
  /**
   * Avatar id "1"–"32" (SVG), remote URL (http(s), e.g. Google OAuth), or null/empty.
   * Guard: if not 1–32 we treat as URL when it starts with http(s), else use initial placeholder.
   */
  profilePictureUrl: string | null | undefined;
  /** Name or username for initial fallback when no avatar/URL. */
  name?: string | null;
  size?: number;
  /** Background color for initial placeholder. */
  placeholderColor?: string;
  style?: object;
  /** Style for the avatar image/SVG (container). Ignored for URL/placeholder. */
  avatarStyle?: object;
}

export function UserAvatar({
  profilePictureUrl,
  name,
  size = 48,
  placeholderColor = "#6366F1",
  style,
  avatarStyle
}: UserAvatarProps) {
  const avatarId = normalizeAvatarId(profilePictureUrl);
  const isUrl = isProfilePictureUrl(profilePictureUrl);

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: "hidden" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const
  };

  if (avatarId) {
    return (
      <View style={[containerStyle, style]}>
        <AvatarImage avatarId={avatarId} size={size} style={avatarStyle} />
      </View>
    );
  }

  if (isUrl && profilePictureUrl) {
    return (
      <Image
        source={{ uri: profilePictureUrl }}
        style={[containerStyle, style]}
        resizeMode="cover"
      />
    );
  }

  const initial = (name?.trim().charAt(0) || "?").toUpperCase();
  return (
    <View style={[containerStyle, { backgroundColor: placeholderColor }, style]}>
      <Text
        style={{
          fontSize: size * 0.45,
          fontFamily: fontFamily.bold,
          color: "#FFFFFF"
        }}
      >
        {initial}
      </Text>
    </View>
  );
}
