# Live Activities (iOS) — Expo prebuild-safe setup

This repo uses **Expo prebuild + Dev Client**. Do **not** hand-edit `apps/mobile/ios/` — the iOS project must be fully reproducible via `npx expo prebuild -p ios --clean`.

## How `targets/` works with @bacons/apple-targets

- **@bacons/apple-targets** is an Expo config plugin that scans `apps/mobile/targets/` for subfolders containing `expo-target.config.js` (or `expo-target.config.json`).
- When you run prebuild, the plugin generates the Xcode project and **links** each target folder (e.g. `targets/nextup-live-activity/`) into the project under a virtual `expo:targets/<folder>` group. Source files stay in `targets/`; nothing is copied into `ios/` by hand.
- The plugin also injects `extra.eas.build.experimental.ios.appExtensions` so EAS knows to build the extension. You do **not** add `appExtensions` manually in `app.json`.

Our Live Activity target:

- **Path**: `apps/mobile/targets/nextup-live-activity/`
- **Config**: `expo-target.config.js` — `type: "widget"`, `name: "NextUpLiveActivityExtension"`, `bundleIdentifier: ".nextup-live-activity"` (→ `com.fitnudge.app.nextup-live-activity`), `frameworks: ["SwiftUI", "WidgetKit", "ActivityKit"]`, `deploymentTarget: "16.1"`.
- **Source of truth**: SwiftUI/ActivityKit files live here (`Attributes.swift`, `NextUpLiveActivityWidget.swift`, `index.swift`, `Info.plist`). Any shared Swift can go in `targets/_shared/` if needed.

## Required app.json config

In `apps/mobile/app.json` (or merged via `app.config.ts`):

- **Plugins**: include `"@bacons/apple-targets"` in `expo.plugins`.
- **iOS entitlements** (main app): `com.apple.security.application-groups`: `["group.com.fitnudge.app"]` (or `group.<your bundle id>`). Do **not** add `com.apple.developer.live-activity` on the main app — it is not required for Live Activities and causes provisioning profile mismatches.
- **iOS Info.plist**: `NSSupportsLiveActivities`: `true` (this is the required switch for Live Activities, along with the extension target and Push Notifications if using remote updates).
- **Team**: `ios.appleTeamId` set so the extension can be signed.

Widget targets that support App Groups automatically mirror `ios.entitlements["com.apple.security.application-groups"]` from app.json; you can override per-target in `expo-target.config.js` if needed.

## Plugins, targets, and modules

- **Plugins** — Only **@bacons/apple-targets** is used for the Live Activity **target**. It is listed in `expo.plugins` in `app.json`. No custom plugin or `plugins/live-activities/ios` templates; all target wiring comes from `targets/nextup-live-activity/expo-target.config.js`.
- **Targets ↔ plugin** — The only link to `targets/` is inside **@bacons/apple-targets**: it globs `targets/*/expo-target.config.js` (or `.json`) and links each folder to Xcode.
- **Modules** — The app uses the Expo module `next-up-live-activity` under `apps/mobile/modules/next-up-live-activity/` for the JS ↔ native bridge (start/update/end activity, push-to-start token). **No `package.json` dependency**: Expo’s autolinking **defaults to `nativeModulesDir: "./modules"`**, so it discovers that folder automatically (same as expo-apple-targets demos). The app imports via path alias `local:next-up-live-activity` (see `babel.config.js` and `tsconfig.json`).
- **Targets vs modules** — **targets/** = Live Activity **UI** (Swift in `targets/nextup-live-activity/`), built as an app extension. **modules/** = **bridge** so JS can call ActivityKit. They share the same data shape (e.g. `NextUpAttributes`) but are not connected by config.

## Clean prebuild and regenerate `ios/`

From `apps/mobile/`:

```bash
rm -rf ios
npx expo prebuild -p ios --clean
```

You should see:

- The widget target linked from `targets/nextup-live-activity/` (in Xcode under `expo:targets/nextup-live-activity` or similar).
- Main app Info.plist: `NSSupportsLiveActivities` = true.
- Main app entitlements: `com.apple.security.application-groups` (no `com.apple.developer.live-activity` on the main app).

## EAS build commands

- **Dev client (development)**:
  ```bash
  cd apps/mobile
  eas build -p ios --profile development
  ```
- **Production**:
  ```bash
  cd apps/mobile
  eas build -p ios --profile production
  ```

Any change to `targets/nextup-live-activity/` or the Expo module requires a **new iOS build** (dev client or production).

## Provisioning profile and Live Activity entitlement

If you see:

- `Signing for "NextUpLiveActivityExtension" requires a development team`
- `Provisioning profile ... doesn't include the com.apple.developer.live-activity entitlement`

**For the live-activity entitlement error**: The main app does **not** need `com.apple.developer.live-activity` for Live Activities. If that entitlement is in `app.json` → `ios.entitlements`, remove it. Live Activities only require `NSSupportsLiveActivities` in Info.plist plus the extension target (and Push Notifications if using remote updates).

**For other profile/signing issues**: EAS may reuse existing provisioning profiles. If the extension target or team wasn’t set when the profile was created, delete the relevant profiles in Apple Developer → Profiles, then run `eas credentials -p ios` and choose not to reuse.

**Fix (do in order)**:

1. In [Apple Developer → Profiles](https://developer.apple.com/account/resources/profiles/list), delete the Ad Hoc (and if needed Development) profiles for `com.fitnudge.app` and `com.fitnudge.app.nextup-live-activity`.
2. In `apps/mobile`: run `eas credentials -p ios`. When asked to reuse a provisioning profile, choose **No** and let EAS create new ones.
3. Run `eas build -p ios --profile development` again.

Also ensure `ios.appleTeamId` is set in `app.json`. If a freshly created profile still doesn’t include the entitlement, check the App ID: [Identifiers](https://developer.apple.com/account/resources/identifiers/list) → `com.fitnudge.app` → Edit → enable **Live Activities** (or Push Notifications if your account bundles it there).

## Backend APNs (Mode B: server-driven push-to-start)

For Live Activity to appear without opening the app (iOS 17.2+), the server sends APNs payloads to start/update/end. The API uses these env vars (see `apps/api/app/core/config.py`):

| Env var                        | Purpose                                                |
| ------------------------------ | ------------------------------------------------------ |
| `ACTIVITYKIT_APNS_TEAM_ID`     | Apple Developer Team ID (Membership)                   |
| `ACTIVITYKIT_APNS_KEY_ID`      | APNs Auth Key ID (Keys → your key)                     |
| `ACTIVITYKIT_APNS_PRIVATE_KEY` | Full `.p8` file contents (BEGIN/END PRIVATE KEY)       |
| `ACTIVITYKIT_APNS_TOPIC`       | `com.fitnudge.app.push-type.liveactivity`              |
| `ACTIVITYKIT_APNS_USE_SANDBOX` | `true` for dev/internal builds, `false` for production |

Create an APNs Auth Key in Apple Developer → Keys, enable **Apple Push Notifications service (APNs)**, download the `.p8` once and store it securely. Set `ACTIVITYKIT_APNS_PRIVATE_KEY` with the full key text (preserve newlines or use `\n` and unescape on the server if needed).

## Validate on device

1. Install the dev client from EAS, then run `npx expo start --dev-client`.
2. **Mode A (app-alive)**: With the app open, start/update/end the Live Activity from the app and confirm it appears on Lock Screen / Dynamic Island.
3. **Mode B (push-to-start)**: With the app closed (or in background), trigger a server-driven start; the Live Activity should appear without opening the app (iOS 17.2+). Confirm update and end via server as well.

Optional: Download the `.ipa` from EAS, unzip, and run `codesign -d --entitlements :-` on the main `.app` to confirm `com.apple.developer.live-activity` is present.

## How to make changes safely

- **Do**: edit `apps/mobile/targets/nextup-live-activity/` (Swift, `expo-target.config.js`, `Info.plist`) and `apps/mobile/modules/next-up-live-activity/` (Expo module). Do **not** add the module to `package.json`; Expo autolinking discovers `./modules` by default.
- **Do not**: edit anything under `apps/mobile/ios/` directly; those changes are overwritten by the next `expo prebuild`.

## References

- [EvanBacon/expo-apple-targets](https://github.com/EvanBacon/expo-apple-targets) — Config plugin for Widget / Live Activity targets; keeps source in `targets/` and prebuild-safe.
- [Expo React Native: Live Activity & Home Screen Widgets for iOS](https://medium.com/@kiyo07/expo-react-native-live-activity-home-screen-widgets-for-ios-9beada26a2b4)
- [tarikfp/expo-live-activity-timer](https://github.com/tarikfp/expo-live-activity-timer) — Demo using Expo Modules and apple-targets.
