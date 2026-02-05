import "dotenv/config";
import fs from "fs";
import path from "path";
import { ConfigContext, ExpoConfig } from "expo/config";
import {
  withPodfile,
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig
} from "expo/config-plugins";
import { parseStringPromise, Builder } from "xml2js";

const FCM_NOTIFICATION_COLOR = "com.google.firebase.messaging.default_notification_color";
const NOTIFICATION_COLOR_RESOURCE = "@color/notification_icon_color";

/**
 * Fix manifest merger conflicts:
 * 1. Firebase notification color (expo-notifications vs react-native-firebase)
 * 2. appComponentFactory (AndroidX vs old support library)
 */
function withAndroidManifestFixes(config: ExpoConfig): ExpoConfig {
  return withAndroidManifest(config, (c) => {
    const { removeMetaDataItemFromMainApplication } = AndroidConfig.Manifest;
    AndroidConfig.Manifest.ensureToolsAvailable(c.modResults);
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);

    // 1. Firebase notification color
    removeMetaDataItemFromMainApplication(app, FCM_NOTIFICATION_COLOR);
    const metaData = (app["meta-data"] ??= []);
    (metaData as Array<{ $: Record<string, string> }>).push({
      $: {
        "android:name": FCM_NOTIFICATION_COLOR,
        "android:resource": NOTIFICATION_COLOR_RESOURCE,
        "tools:replace": "android:resource"
      }
    });

    // 2. appComponentFactory (AndroidX vs com.android.support)
    // Must specify the value when using tools:replace, otherwise merger fails
    const app$ = app.$ as Record<string, string>;
    app$["android:appComponentFactory"] = "androidx.core.app.CoreComponentFactory";
    const existing = app$["tools:replace"] ?? "";
    const toAdd = "android:appComponentFactory";
    app$["tools:replace"] = existing ? `${existing},${toAdd}` : toAdd;

    return c;
  });
}

/**
 * Same fix for debug AndroidManifest.xml (generated during prebuild).
 * Patches the file after it exists to add tools:replace.
 */
function withFirebaseNotificationColorDebugFix(config: ExpoConfig): ExpoConfig {
  return withDangerousMod(config, [
    "android",
    async (c) => {
      const debugManifestPath = path.join(
        c.modRequest.platformProjectRoot,
        "app",
        "src",
        "debug",
        "AndroidManifest.xml"
      );

      if (!fs.existsSync(debugManifestPath)) return c;

      const xml = fs.readFileSync(debugManifestPath, "utf8");
      const manifest = await parseStringPromise(xml);

      const manifestAttrs = (manifest.manifest.$ ??= {});
      manifestAttrs["xmlns:tools"] ??= "http://schemas.android.com/tools";

      const application = manifest.manifest.application?.[0];
      if (!application) return c;

      const metaData = (application["meta-data"] ??= []);

      // Remove existing, add our own with tools:replace
      const filtered = metaData.filter(
        (item: { $?: { "android:name"?: string } }) =>
          item?.$?.["android:name"] !== FCM_NOTIFICATION_COLOR
      );
      metaData.length = 0;
      metaData.push(...filtered);
      metaData.push({
        $: {
          "android:name": FCM_NOTIFICATION_COLOR,
          "android:resource": NOTIFICATION_COLOR_RESOURCE,
          "tools:replace": "android:resource"
        }
      });

      // appComponentFactory (AndroidX vs com.android.support)
      // Must specify the value when using tools:replace, otherwise merger fails
      const app$ = (application.$ ??= {}) as Record<string, string>;
      app$["android:appComponentFactory"] = "androidx.core.app.CoreComponentFactory";
      const existing = app$["tools:replace"] ?? "";
      const toAdd = "android:appComponentFactory";
      app$["tools:replace"] = existing ? `${existing},${toAdd}` : toAdd;

      const builder = new Builder({
        xmldec: { version: "1.0", encoding: "utf-8" },
        renderOpts: { pretty: true, indent: "  ", newline: "\n" }
      });

      fs.writeFileSync(debugManifestPath, builder.buildObject(manifest), "utf8");
      return c;
    }
  ]);
}

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

/**
 * Exclude legacy com.android.support dependencies to fix duplicate class error
 * (checkDebugDuplicateClasses) when AndroidX and support library are both on classpath.
 */
function withExcludeSupportLibrary(config: ExpoConfig): ExpoConfig {
  return withDangerousMod(config, [
    "android",
    async (c) => {
      const buildGradlePath = path.join(c.modRequest.platformProjectRoot, "build.gradle");
      if (!fs.existsSync(buildGradlePath)) return c;

      let contents = fs.readFileSync(buildGradlePath, "utf8");
      if (contents.includes("Exclude legacy com.android.support")) return c;

      const exclusionBlock = `
// --- Exclude legacy com.android.support (fix duplicate class vs AndroidX) ---
subprojects { subproject ->
  subproject.configurations.all {
    exclude group: "com.android.support"
  }
}
// --- end fix ---
`;

      // Insert before the last apply plugin lines
      const insertPoint = contents.indexOf('apply plugin: "expo-root-project"');
      if (insertPoint !== -1) {
        contents =
          contents.slice(0, insertPoint) + exclusionBlock + "\n" + contents.slice(insertPoint);
      } else {
        contents = contents.trimEnd() + "\n" + exclusionBlock + "\n";
      }

      fs.writeFileSync(buildGradlePath, contents, "utf8");
      return c;
    }
  ]);
}

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
    withExcludeSupportLibrary,
    withRNFBNonModularHeadersFix,
    withAndroidManifestFixes,
    withFirebaseNotificationColorDebugFix,
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
