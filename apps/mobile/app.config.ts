import "dotenv/config";
import { ConfigContext, ExpoConfig } from "expo/config";

const reverseClientId = (clientId: string): string => {
  return clientId.split(".").reverse().join(".");
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId =
    process.env.GOOGLE_IOS_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS ||
    "";

  const androidClientId =
    process.env.GOOGLE_ANDROID_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID ||
    "";

  const webClientId =
    process.env.GOOGLE_WEB_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    "";

  const iosUrlScheme = iosClientId ? reverseClientId(iosClientId) : "";

  const googlePluginName = "@react-native-google-signin/google-signin";

  const filteredPlugins = (config.plugins ?? []).filter((entry) => {
    if (Array.isArray(entry)) {
      return entry[0] !== googlePluginName;
    }
    return entry !== googlePluginName;
  });

  const plugins: NonNullable<ExpoConfig["plugins"]> = [
    ...filteredPlugins,
    [
      googlePluginName,
      {
        iosUrlScheme: iosUrlScheme || undefined,
        iosClientId: iosClientId || undefined,
        androidClientId: androidClientId || undefined,
        webClientId: webClientId || undefined,
      },
    ],
    "expo-sqlite", // Required for Supabase localStorage polyfill
    "expo-audio", // For workout music and sound effects
    "expo-screen-orientation", // For landscape mode in workout player
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ], // For exercise demonstration videos
    "expo-asset", // For loading assets
  ];

  return {
    ...config,
    name: config.name ?? "FitNudge",
    slug: config.slug ?? config.name?.toLowerCase() ?? "fitnudge",
    plugins,
    extra: {
      ...config.extra,
      googleSignIn: {
        iosClientId,
        androidClientId,
        webClientId,
        iosUrlScheme,
      },
    },
  };
};
