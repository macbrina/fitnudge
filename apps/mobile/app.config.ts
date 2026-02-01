import "dotenv/config";
import { ConfigContext, ExpoConfig } from "expo/config";
import { withPodfile } from "expo/config-plugins";

const RNFB_PODFILE_SNIPPET = `
  # --- RNFirebase non-modular header fix (Expo SDK 54 + use_frameworks) ---
  installer.pods_project.targets.each do |target|
    if target.name.start_with?("RNFB")
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
  end
  # --- end fix ---
`;

function withRNFBNonModularHeadersFix(config: ExpoConfig): ExpoConfig {
  return withPodfile(config, (c) => {
    const contents = c.modResults.contents ?? "";
    if (contents.includes("RNFirebase non-modular header fix")) return c;
    let next: string;
    if (contents.match(/post_install do \|installer\|/)) {
      next = contents.replace(
        /post_install do \|installer\|\n/,
        (m) => m + RNFB_PODFILE_SNIPPET + "\n"
      );
    } else {
      next = contents + `\npost_install do |installer|\n` + RNFB_PODFILE_SNIPPET + `\nend\n`;
    }
    c.modResults.contents = next;
    return c;
  });
}

const reverseClientId = (clientId: string): string => {
  return clientId.split(".").reverse().join(".");
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId =
    process.env.GOOGLE_IOS_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || "";

  const androidClientId =
    process.env.GOOGLE_ANDROID_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || "";

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

  // Expo's config plugin type supports functions, but ExpoConfig TS types are narrower.
  // Use `any` here so `tsc --noEmit` passes.
  const plugins: any[] = [
    ...filteredPlugins,
    withRNFBNonModularHeadersFix,
    [
      googlePluginName,
      {
        iosUrlScheme: iosUrlScheme || undefined,
        iosClientId: iosClientId || undefined,
        androidClientId: androidClientId || undefined,
        webClientId: webClientId || undefined
      }
    ],
    "expo-sqlite", // Required for Supabase localStorage polyfill
    "expo-audio", // For workout music and sound effects
    "expo-screen-orientation", // For landscape mode in workout player
    "expo-asset", // For loading assets
    [
      "react-native-video",
      {
        enableNotificationControls: true,
        androidExtensions: {
          useExoplayerRtsp: false,
          useExoplayerSmoothStreaming: false,
          useExoplayerHls: false,
          useExoplayerDash: false
        }
      }
    ]
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
        iosUrlScheme
      }
    }
  };
};
