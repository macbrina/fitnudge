## Android Mode B — Server-driven “Next up” ongoing notification (FCM + Notifee)

This documents the Android equivalent of iOS Mode B: the backend can **start/update/end** an Android ongoing notification **even when the app is not opened**, using **FCM data messages** and a **background handler**.

### What’s implemented

- **Mobile**
  - Background FCM handler (data-only) → updates a stable Notifee notification ID.
  - Notification settings:
    - `ongoing: true`
    - `autoCancel: false`
    - stable ID `next-up-ongoing` (updates replace; no stacking)
  - Safety:
    - invalid payloads are ignored
    - if `completedCount >= totalCount`, notification is ended / not shown
- **Backend**
  - Stores Android FCM tokens in Supabase table `nextup_fcm_devices`
  - Sends `start|update|end` pushes on:
    - daily pending check-ins precreated
    - check-in status changes
    - all due-today tasks done (end)

---

## Firebase setup (Android)

### 1) Create Firebase project + Android app

1. Go to Firebase Console → create/select project.
2. Add an **Android app** with package name:
   - `com.fitnudge.app`
3. Download `google-services.json`.

### 2) Add `google-services.json` to the repo

Place it at:

- `apps/mobile/google-services.json`

Make sure it is included in your build config (Expo reads this for RNFirebase).

### 2b) (Recommended) Also add the iOS service file (since RNFirebase is installed)

Even if you’re implementing Android Mode B, we installed `@react-native-firebase/app`, which also expects the iOS service file during iOS prebuild/build.

1. Firebase Console → Project settings → Your apps → **Add app** → iOS
2. Bundle ID:
   - `com.fitnudge.app`
3. Download `GoogleService-Info.plist`
4. Place it at:
   - `apps/mobile/GoogleService-Info.plist`

Make sure Expo config points to it:

- `apps/mobile/app.json` → `expo.ios.googleServicesFile = "./GoogleService-Info.plist"`

### 3) Rebuild the Dev Client

Any time you add/update `google-services.json` or native deps, rebuild:

```bash
cd apps/mobile
rm -rf ios android
npx expo prebuild --no-install
eas build -p android --profile development
```

---

## Backend setup (FCM sender)

### 1) Create a Firebase service account

Firebase Console → Project settings → Service accounts → **Generate new private key**.

This produces a JSON file (server-side only).

### 2) Configure the API environment variables

Set:

- `FCM_SERVICE_ACCOUNT_JSON` = the full JSON contents (string) of the service account key

Do **not** put this in the mobile app.

---

## How the push message looks (FCM data-only)

The backend sends **data messages**:

- `type=nextup`
- `action=start|update|end`
- plus:
  - `dayKey`
  - `nextTaskId`
  - `taskTitle`
  - `completedCount`
  - `totalCount`

Invalid messages are ignored by the handler.

---

## Android notification behavior

The notification uses:

- Channel ID: `next-up`
- Notification ID: `next-up-ongoing` (stable)
- `ongoing: true`
- `autoCancel: false`

---

## Testing on a physical device

### Preconditions

- Install the **Android Dev Client** built by EAS.
- Ensure the device has a working Google Play Services environment (real device recommended).

### Test cases

1. **App killed**
   - Force stop the app.
   - Trigger a check-in update from another device/web or by hitting the backend debug endpoint (if you add one).
   - Confirm the ongoing notification updates.

2. **Reboot**
   - Reboot device.
   - Ensure FCM token registration runs again when the app is opened.

3. **Doze**
   - Doze can delay background delivery. For reliable testing:
     - temporarily disable battery optimizations for the app
     - or expect delays under aggressive OEM power management

---

## Common issues

- **No notification shows**
  - `google-services.json` missing/wrong package name
  - device has no Play Services
  - Notifee permissions missing (Android 13+ requires `POST_NOTIFICATIONS`)
- **Backend can’t send**
  - `FCM_SERVICE_ACCOUNT_JSON` missing/invalid
  - token not registered in `nextup_fcm_devices`
