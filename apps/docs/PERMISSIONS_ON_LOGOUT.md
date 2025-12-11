# Permissions Behavior on Logout

## Overview

When a user logs out (especially when account is deleted/not found), `storageUtil.clearAll()` is called. This document explains what happens to system permissions.

## System Permissions (Cannot Be Revoked)

**System permissions are OS-level and CANNOT be revoked programmatically:**

- ✅ **Notification Permissions** - Granted at OS level, persist after logout
- ✅ **Camera Permissions** - Granted at OS level, persist after logout
- ✅ **Media Library Permissions** - Granted at OS level, persist after logout

**Why?** These are security settings managed by the operating system. Apps cannot revoke them - only the user can via Settings.

## What Gets Cleared

### Storage Keys (AsyncStorage)

- `HAS_SEEN_NOTIFICATION_PERMISSION` - Flag reset, app will re-check
- `NOTIFICATION_PREFERENCES` - User preferences cleared
- `NOTIFICATION_SOFT_PROMPT_SHOWN` - Soft prompt flag reset
- All other user data and preferences

### Notification Service

- ✅ All scheduled local notifications cancelled
- ✅ Device unregistered from backend (FCM token removed)
- ✅ In-memory permission status reset to `"undetermined"`

### Media Permissions

- ✅ **Nothing stored** - Media permissions are checked directly from OS each time
- ✅ `useMediaPermissions` hook checks OS on mount, no storage involved

## Behavior After Logout

### Notification Permissions

1. **OS permission remains granted** (cannot be revoked)
2. **App's stored status reset** to `"undetermined"`
3. **On next use**: App will check OS permission status
4. **If granted**: App can use notifications immediately
5. **If denied**: App will need to request again

### Camera/Media Permissions

1. **OS permission remains granted** (cannot be revoked)
2. **No storage involved** - checked from OS each time
3. **On next use**: `ImagePicker.getCameraPermissionsAsync()` checks OS
4. **If granted**: Works immediately
5. **If denied**: User must grant in Settings

## Security Considerations

### For New User on Same Device

If a new user logs in on the same device after logout:

- ✅ **Notification permission**: Still granted (if previous user granted it)
- ✅ **Camera permission**: Still granted (if previous user granted it)
- ✅ **Media permission**: Still granted (if previous user granted it)

**This is expected behavior** - permissions are device-level, not account-level.

### Best Practice

The app should:

1. ✅ Check permission status from OS on each use
2. ✅ Not assume permissions based on storage
3. ✅ Request permissions when needed (if not already granted)
4. ✅ Handle permission denial gracefully

## Code References

- **Notification Service**: `apps/mobile/src/services/notifications/notificationService.ts`
  - `clearAllNotificationData()` - Resets status to "undetermined"
- **Media Permissions**: `apps/mobile/src/hooks/media/useMediaPermissions.ts`
  - Checks OS directly via `ImagePicker.getCameraPermissionsAsync()`
  - No storage involved

- **Storage Clear**: `apps/mobile/src/utils/storageUtil.ts`
  - `clearAll()` - Clears all storage keys
  - Calls `notificationService.clearAllNotificationData()`

## Summary

**System permissions persist after logout** - this is by design and cannot be changed. The app handles this by:

- Resetting stored permission flags
- Checking OS permission status on each use
- Not assuming permissions based on previous state

This ensures a clean slate for new users while respecting OS-level security settings.
