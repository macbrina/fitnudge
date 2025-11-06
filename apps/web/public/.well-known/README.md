# Universal Links and App Links Configuration

This directory contains the verification files required for Universal Links (iOS) and App Links (Android).

## Files

1. **apple-app-site-association** - iOS Universal Links verification
   - Must be served with `Content-Type: application/json`
   - No file extension in the URL
   - Must be accessible at: `https://fitnudge.app/.well-known/apple-app-site-association`
2. **assetlinks.json** - Android App Links verification
   - Must be served with `Content-Type: application/json`
   - Must be accessible at: `https://fitnudge.app/.well-known/assetlinks.json`

## Setup Instructions

### iOS Universal Links

1. Update `apple-app-site-association`:
   - Replace `TEAM_ID` with your Apple Developer Team ID
   - Ensure the bundle ID matches: `com.fitnudge.app`

2. Verify the file is accessible:

   ```bash
   curl https://fitnudge.app/.well-known/apple-app-site-association
   ```

3. The file should return with `Content-Type: application/json` (configured in `next.config.js`)

### Android App Links

1. Generate SHA-256 fingerprints from your signing keys:

   ```bash
   # For debug keystore
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

   # For release keystore (when ready)
   keytool -list -v -keystore /path/to/release.keystore -alias your-key-alias
   ```

2. Update `assetlinks.json`:
   - Replace `SHA256_FINGERPRINT_HERE` with your actual SHA-256 fingerprints
   - Add all fingerprints (debug and release) as separate array items

3. Verify the file is accessible:
   ```bash
   curl https://fitnudge.app/.well-known/assetlinks.json
   ```

## Testing

- iOS: Test Universal Links using Safari on a device
- Android: Use the `adb` command:
  ```bash
  adb shell am start -W -a android.intent.action.VIEW -d "https://fitnudge.app/reset-password?token=test123"
  ```

## Notes

- Both files must be served over HTTPS
- The files must be accessible without authentication
- After deployment, it may take a few hours for Apple/Google to verify the files
- Universal Links work automatically if the app is installed
- If app is not installed, the web redirect page handles store redirects
