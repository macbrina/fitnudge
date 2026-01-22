# Fixing react-native-google-mobile-ads in pnpm Monorepo

This document explains how we resolved the issue of `react-native-google-mobile-ads` not working in a pnpm monorepo with Expo SDK 54 and React Native 0.81.

## The Problem

When using `react-native-google-mobile-ads` in a pnpm monorepo, the native module would compile but fail at runtime with:

```
Invariant Violation: View config getter callback for component 
`RNGoogleMobileAdsBannerView` must be a function (received `undefined`).
```

### Symptoms

1. Native code compiled successfully (`.mm` files were processed)
2. Codegen was generated correctly (`RNGoogleMobileAdsSpec` folder existed)
3. `UIManager.getViewManagerConfig("RNGoogleMobileAdsBannerView")` returned `undefined`
4. The class symbol was NOT in the final binary (verified with `nm` command)

### Root Cause

pnpm's default behavior creates a nested `node_modules` structure with symlinks:

```
node_modules/
  react-native-google-mobile-ads → .pnpm/react-native-google-mobile-ads@16.0.1.../
  .pnpm/
    react-native-google-mobile-ads@16.0.1.../
      node_modules/
        react-native-google-mobile-ads/   ← actual files here
```

This caused:
1. CocoaPods to resolve the pod from the symlinked path
2. React Native's autolinking to use a different path resolution
3. The native module to compile but not link properly into the final app binary

## The Solution

### 1. Configure pnpm to use hoisted node_modules

Create or update `.npmrc` in the monorepo root:

```ini
# Use hoisted node_modules structure for better native module compatibility
# This fixes CocoaPods failing to resolve source files through pnpm symlinks
node-linker=hoisted
```

This creates a flat `node_modules` structure similar to npm:

```
node_modules/
  react-native-google-mobile-ads/   ← actual files directly here
    ios/
    android/
    package.json
```

### 2. Enable autolinking module resolution (Expo SDK 54+)

Add to `app.json`:

```json
{
  "expo": {
    "experiments": {
      "autolinkingModuleResolution": true
    }
  }
}
```

This ensures Metro bundler and native autolinking use consistent path resolution.

### 3. Clean rebuild

After making these changes:

```bash
# Remove all node_modules
rm -rf node_modules apps/*/node_modules packages/*/node_modules

# Reinstall with pnpm
pnpm install

# Clean iOS build
cd apps/mobile
rm -rf ios/Pods ios/Podfile.lock ios/build

# Rebuild
npx expo prebuild --clean
npx expo run:ios
```

## Why This Works

1. **`node-linker=hoisted`**: Creates a flat `node_modules` structure that CocoaPods and React Native's autolinking expect. No symlink chains to break path resolution.

2. **`autolinkingModuleResolution`**: Forces Metro to resolve modules the same way autolinking does, preventing mismatches between JS and native module registration.

## Debugging Commands

If you encounter similar issues, use these commands to debug:

```bash
# Check if module is directly in node_modules (not symlinked)
ls -la node_modules/react-native-google-mobile-ads

# Find where the app binary is installed on simulator
xcrun simctl get_app_container booted com.your.app.id

# Check if symbols are in the binary
nm "$(xcrun simctl get_app_container booted com.your.app.id)/YourApp" | grep -i "BannerView"

# Check Manifest.lock for pod paths
cat ios/Pods/Manifest.lock | grep -A 3 "RNGoogleMobileAds"

# Check if framework is being embedded
grep "RNGoogleMobileAds" ios/Pods/Target\ Support\ Files/Pods-YourApp/Pods-YourApp-frameworks.sh
```

## Configuration Files

### .npmrc
```ini
node-linker=hoisted
```

### pnpm-workspace.yaml
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### app.json (relevant sections)
```json
{
  "expo": {
    "newArchEnabled": true,
    "experiments": {
      "autolinkingModuleResolution": true
    },
    "plugins": [
      ["expo-build-properties", {
        "ios": { "useFrameworks": "static" }
      }],
      ["react-native-google-mobile-ads", {
        "androidAppId": "ca-app-pub-xxx~yyy",
        "iosAppId": "ca-app-pub-xxx~zzz"
      }]
    ]
  }
}
```

## Other Approaches We Tried (That Didn't Work)

1. **`shamefully-hoist=true`** - Still had symlink issues
2. **Switching to yarn workspaces with nohoist** - Caused Metro transformer issues
3. **Patching the podspec with absolute paths** - CocoaPods rejects absolute paths in source_files
4. **Disabling New Architecture** - Conflicted with react-native-reanimated v4

## References

- [Expo Monorepo Documentation](https://docs.expo.dev/guides/monorepos/)
- [pnpm node-linker setting](https://pnpm.io/npmrc#node-linker)
- [react-native-google-mobile-ads](https://github.com/invertase/react-native-google-mobile-ads)

## Environment

- Expo SDK: 54
- React Native: 0.81.5
- pnpm: 9.0.0
- react-native-google-mobile-ads: 16.0.1
- New Architecture: Enabled
