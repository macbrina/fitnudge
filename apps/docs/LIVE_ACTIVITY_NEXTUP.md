# Next Up: Live Activity (iOS) – Mode A vs Mode B

## Overview

The "Today's focus" surface shows the user's next due-today goal/task. On iOS it is implemented as a **Live Activity** (ActivityKit). Updates can be driven in two ways:

- **Mode A (in-app)**: App running → React Query + Supabase Realtime → `liveSurfaceManager.updateFromQueryClient()` → native `startActivity`/`updateActivity`/`endActivity`. Works when the app is in foreground or background with an active Realtime connection.

- **Mode B (server-driven, killed-app support)**: Backend computes "next up" and sends **APNs pushes with `push-type: liveactivity`** to start/update/end the Live Activity. Does **not** use Expo push notifications; those cannot update a Live Activity. Topic must be `<bundleId>.push-type.liveactivity` (e.g. `com.fitnudge.app.push-type.liveactivity`).

Mode B is required when the app is **killed**: Realtime and React Query are not available, so the only way to update the Lock Screen / Dynamic Island is via ActivityKit remote push.

### iOS version vs deployment target

- **Deployment target**: **17.2** (app runs on iOS 17.2+). This ensures push-to-start is available on all supported devices, so Mode B can **start** the Live Activity when the app is killed.
- **Push-to-start token**: Available on 17.2+ (same as deployment target).
- **Activity push token**: When the user starts a Live Activity in-app (or via push-to-start), we get `activity_push_token` and register it; the backend can then send **update** and **end** via Mode B.

---

## Mode B pipeline (already implemented)

### 1. iOS registers tokens with backend

- **Push-to-start token** (iOS 17.2+): Used to **start** a Live Activity remotely when the app is not running. Obtained from `Activity<NextUpAttributes>.pushToStartTokenUpdates` and sent to the backend via `POST /live-activity/push-to-start-token`.
- **Activity push token**: Emitted when an activity is **running** (started in-app or via push-to-start). Used to **update** or **end** that activity remotely. Sent via `POST /live-activity/activity-push-token`.

The mobile app does this in `useLiveActivityRegistration` (and the native module observes token updates). Tokens are stored in `live_activity_devices` (user_id, device_id, platform, push_to_start_token, activity_push_token, timezone, etc.).

### 2. Backend computes "next up" and sends APNs

- **Service**: `app.services.live_activity_service`
  - `compute_next_up_payload_for_user(user_id, timezone, locked_task_id, locked_day_key)` reads goals + today’s check-ins from the DB and returns the same deterministic "next up" payload as the client (NextUpPayload).
  - `refresh_live_activity_for_user(user_id)` loads all iOS devices for the user from `live_activity_devices`, computes next up per device timezone, then:
    - If no next task → send **end** (if `activity_push_token`), clear lock.
    - Else if payload hash unchanged → skip (dedupe).
    - Else if `activity_push_token` → send **update**.
    - Else if `push_to_start_token` → send **start** (push-to-start; used when app is killed and we never got an activity push token).

- **APNs**: `ActivityKitAPNsClient` uses token auth (JWT), `apns-push-type: liveactivity`, and `apns-topic: ACTIVITYKIT_APNS_TOPIC` (must be `<bundleId>.push-type.liveactivity`). No Expo push; this is raw APNs to the ActivityKit topic.

### 3. When the backend triggers a refresh

- **Check-ins**: After create/update check-in (API), `refresh_live_activity_for_user_task.delay(user_id)` is enqueued (see `app.api.v1.endpoints.checkins`).
- **Goal/precreate**: After precreate check-ins in `goal_tasks`, `refresh_live_activity_for_user_task.delay(uid)` is enqueued for each affected user.

So whenever a check-in is created or updated via the API (or via precreate), the backend recomputes "next up" and sends start/update/end via APNs to all registered iOS devices. On **iOS 17.2+**, **app killed** is covered: the device has already registered `push_to_start_token` on a previous run; when a check-in is created (e.g. from another device or API), the backend sends **start** to that token and the Live Activity appears on the Lock Screen. On **16.2–17.1**, no push_to_start_token is registered, so Mode B cannot start the activity when the app is killed (only update/end if we have activity_push_token from an in-app start).

---

## Mode A (fallback)

- When Live Activities are disabled, not allowed, or tokens are missing, the backend cannot drive the surface; the app uses **Mode A** only (in-app updates via Realtime + `updateFromQueryClient` when the app is running).
- When the app is running and has an activity, it also uploads `activity_push_token` so the backend can send **update**/ **end** via Mode B (e.g. when the user checks in from the web); both modes can coexist.

---

## Summary

| Scenario                                           | Mode   | How it updates                                                                                                                   |
| -------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| App open, user creates check-in in app             | A + B  | Mutation updates cache → `updateFromQueryClient` (Mode A). API triggers `refresh_live_activity_for_user_task` (Mode B).          |
| App open, check-in created elsewhere (e.g. web)    | A + B  | Realtime updates cache → `updateFromQueryClient` (Mode A). API (or precreate) triggers task → APNs update (Mode B).              |
| App killed, check-in created (API or other device) | B only | Backend sends **start** to `push_to_start_token` → Live Activity starts. (Deployment target 17.2 so push-to-start is available.) |

Expo push notifications are **not** used for Live Activity; they are separate (e.g. reminder notifications). Live Activity updates use **APNs with `apns-push-type: liveactivity`** and topic `<bundleId>.push-type.liveactivity` only.
