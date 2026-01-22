# Partner Viewing & Social Accountability

This document describes how accountability partners can view each other's goals, including privacy controls, real-time updates, and subscription gating.

## Overview

Accountability partners are users who have connected to help motivate each other. Once connected, partners can:

- View each other's active goals
- See progress, streaks, and check-in status
- Send nudges and cheers to encourage activity
- Get notified about milestones

## Partner View Mode

When a partner views their accountability partner's goals, they enter a **read-only "Partner View"** mode.

### Navigation Flow

```
PartnerDetailScreen (shows partner's dashboard)
        ↓
Partner taps on a goal card
        ↓
Navigation with query params:
  - viewMode=partner
  - partnerId=<partner_user_id>
        ↓
GoalDetailScreen loads in partner view
```

### What Partners Can See

| Element                | Visible | Notes                                      |
| ---------------------- | ------- | ------------------------------------------ |
| Title & description    | ✅      | Full visibility                            |
| Category & frequency   | ✅      | -                                          |
| Progress stats         | ✅      | Streak, completion rate, etc.              |
| Progress charts        | ✅      | Weekly/monthly views                       |
| Plan overview          | ✅      | High-level plan structure                  |
| Check-in history dates | ✅      | Can see when they checked in               |
| Partner view banner    | ✅      | Shows "Viewing partner's goal (read-only)" |

### What Partners Cannot See/Do

| Element             | Hidden | Reason                  |
| ------------------- | ------ | ----------------------- |
| Check-in button     | ❌     | Only owner can check in |
| Edit goal           | ❌     | Only owner can modify   |
| Rest day indicators | ❌     | Not relevant to partner |
| No check-in message | ❌     | Not relevant to partner |
| Tracking modals     | ❌     | Cannot interact         |

## Implementation Details

### Query Parameters

When navigating to goal detail screens in partner view:

```typescript
// Goal navigation
router.push(
  `${MOBILE_ROUTES.GOALS.DETAILS}?id=${goalId}&viewMode=partner&partnerId=${partnerUserId}`
);
```

### Partner View Detection

In `GoalDetailScreen.tsx`:

```typescript
const params = useLocalSearchParams<{
  id?: string;
  viewMode?: string;
  partnerId?: string;
}>();
const { id, viewMode, partnerId } = params;
const isPartnerView = viewMode === "partner";
```

### Partnership Validation

Before showing content, screens verify the partnership still exists:

```typescript
const { data: partnersData } = usePartners();

const isValidPartner = useMemo(() => {
  if (!isPartnerView) return true;
  if (!partnersData?.data || !partnerId) return true; // Still loading
  return partnersData.data.some(
    (p) => p.partner?.id === partnerId || p.partner_user_id === partnerId
  );
}, [partnersData?.data, partnerId, isPartnerView]);

// Navigate away if not valid
useEffect(() => {
  if (isPartnerView && partnersData?.data && !isValidPartner) {
    showAlert({
      title: t("partners.access_denied"),
      message: t("partners.not_partners_anymore"),
      variant: "error",
    });
    router.back();
  }
}, [isPartnerView, isValidPartner, partnersData?.data]);
```

### UI Conditional Rendering

Actions are hidden in partner view:

```tsx
{/* Partner View Banner */}
{isPartnerView && (
  <View style={styles.partnerBanner}>
    <Ionicons name="eye-outline" size={18} color={brandColors.primary} />
    <Text style={styles.partnerBannerText}>
      {t("partners.viewing_partner_goal")}
    </Text>
  </View>
)}

{/* Action buttons - hidden in partner view */}
{!isPartnerView && isGoalActive && isScheduledDay && (
  <Button title="Check In" onPress={handleCheckIn} />
)}

{/* Modals - not rendered in partner view */}
{!isPartnerView && (
  <>
    <CheckInModal ... />
    <MealLogModal ... />
    <HydrationModal ... />
  </>
)}
```

## Real-Time Partnership Detection

### Partnership Removal

When a partnership is removed (either user removes the other), the system:

1. **Realtime subscription** detects the DELETE on `accountability_partners` table
2. **Cache updates** remove the partner from lists
3. **Dashboard cache invalidation** triggers refetch for affected users
4. **Guards activate** - if user is on `PartnerDetailScreen`, they're navigated away

### RealtimeService Handler

```typescript
// In handleAccountabilityPartnersChange
if (payload.eventType === "DELETE") {
  // Update partner lists
  this.queryClient.setQueryData(partnersQueryKeys.list(), ...);
  this.queryClient.setQueryData(partnersQueryKeys.pending(), ...);
  this.queryClient.setQueryData(partnersQueryKeys.sent(), ...);

  // Invalidate dashboard caches for both users
  const userId = oldRecord?.user_id;
  const partnerUserId = oldRecord?.partner_user_id;
  if (userId) {
    this.queryClient.invalidateQueries({
      queryKey: partnersQueryKeys.dashboard(userId),
    });
  }
  if (partnerUserId) {
    this.queryClient.invalidateQueries({
      queryKey: partnersQueryKeys.dashboard(partnerUserId),
    });
  }
}
```

### PartnerDetailScreen Guard

```typescript
// Fetch partners list to detect if partnership is removed
const { data: partnersData } = usePartners();

const isStillPartner = useMemo(() => {
  if (!partnersData?.data || !partnerUserId) return true;
  return partnersData.data.some(
    (p) =>
      p.partner?.id === partnerUserId || p.partner_user_id === partnerUserId
  );
}, [partnersData?.data, partnerUserId]);

// Navigate away if partnership is removed
useEffect(() => {
  if (dashboard && !isStillPartner && partnersData?.data) {
    showToast({
      title: t("partners.no_longer_partners"),
      message: t("partners.partnership_removed_message"),
      variant: "info",
    });
    router.back();
  }
}, [isStillPartner, dashboard, partnersData?.data]);
```

## Subscription Gating

### Feature Access Logic

Accountability partner features use `accountability_partner_limit` for access control:

| Limit Value | Meaning                                 |
| ----------- | --------------------------------------- |
| `null`      | Unlimited partners (premium)            |
| `0`         | Feature disabled (no access)            |
| `> 0`       | Has access with that many partner slots |

| Screen                | Access Condition                                       |
| --------------------- | ------------------------------------------------------ |
| `PartnersScreen`      | User has limit > 0 OR has existing partners/requests   |
| `PartnerDetailScreen` | User has limit > 0 OR partner has limit > 0            |
| `ActivityScreen`      | User has limit > 0 OR has existing nudges              |
| `FindPartnerScreen`   | User has limit > 0 AND can send request (not at limit) |

### Implementation

All screens use the unified `usePartnerAccess` hook for consistent access checks:

```typescript
// usePartnerAccess hook (from usePartners.ts)
export const usePartnerAccess = () => {
  const { hasPartnerFeature, getPartnerLimit, openModal } = useSubscriptionStore();
  const { data: limits } = usePartnerLimits();

  // hasPartnerFeature checks if accountability_partner_limit > 0 or null (unlimited)
  const hasFeature = hasPartnerFeature();
  const limit = getPartnerLimit();

  // Use cached limits for counts (from backend)
  const acceptedCount = limits?.accepted_count ?? 0;
  const pendingSentCount = limits?.pending_sent_count ?? 0;

  // Can send if: has feature AND (unlimited OR under limit)
  const canSendRequest = (): boolean => {
    if (!hasFeature) return false;
    if (limit === null) return true; // Unlimited
    if (limit === 0) return false;   // Disabled
    return acceptedCount + pendingSentCount < limit;
  };

  return { hasFeature, limit, canSendRequest, ... };
};

// PartnersScreen
const { hasFeature: hasPartnerFeature, canSendRequest } = usePartnerAccess();
const hasAccess = hasPartnerFeature || partners.length > 0 || pendingRequests.length > 0;

// PartnerDetailScreen
const { hasFeature: userHasFeature } = usePartnerAccess();
const partnerHasFeature = dashboard?.partner?.has_partner_feature ?? false;
const hasAccess = userHasFeature || partnerHasFeature;

// ActivityScreen
const { hasFeature: hasPartnerFeature } = usePartnerAccess();
const hasAccess = hasPartnerFeature || nudges.length > 0;

// FindPartnerScreen
const { hasFeature, canSendRequest } = usePartnerAccess();
// hasFeature controls screen access, canSendRequest controls the button
```

### Subscription Store Methods

```typescript
// subscriptionStore.ts
hasPartnerFeature: () => {
  // Returns true if accountability_partner_limit is null (unlimited) or > 0
  return get().hasFeature("accountability_partner_limit");
},

getPartnerLimit: () => {
  // Returns: null (unlimited), 0 (disabled), or number (limit)
  const partnerFeature = features.features_list.find(
    (f) => f.feature_key === "accountability_partner_limit"
  );
  return partnerFeature?.feature_value ?? 1; // Free tier default: 1
},

canSendPartnerRequest: (acceptedCount, pendingSentCount) => {
  if (!get().hasPartnerFeature()) return false;
  const limit = get().getPartnerLimit();
  if (limit === null) return true;  // Unlimited
  if (limit === 0) return false;    // Disabled
  return acceptedCount + pendingSentCount < limit;
}
```

### Premium Gate UI

When access is denied, a premium gate is shown:

```tsx
const renderPremiumGate = () => (
  <View style={styles.premiumGate}>
    <Ionicons name="lock-closed" size={48} color={brandColors.primary} />
    <Text style={styles.premiumTitle}>
      {t("partners.premium_required_title")}
    </Text>
    <Text style={styles.premiumDescription}>
      {t("partners.premium_required_description")}
    </Text>
    <Button
      title={t("common.upgrade")}
      onPress={() => openSubscriptionModal())}
    />
  </View>
);
```

## Activity Screen (Nudges)

The `ActivityScreen` shows nudges and cheers that partners send to each other.

### What It Shows

- **Nudges** - Reminders to stay on track
- **Cheers** - Encouragement messages
- **Milestones** - Celebrations when partner hits goals

### Access Logic

```typescript
const { hasFeature } = useSubscriptionStore();
const hasPartnerFeature = hasFeature("social_accountability");
const nudges = nudgesData?.data || [];

// User can access if they have the feature OR have existing nudges
const hasAccess = hasPartnerFeature || nudges.length > 0;

if (!isLoading && !hasAccess) {
  return renderPremiumGate();
}
```

### Graceful Degradation

If a user previously had partners and received nudges, but their subscription expired:

- They can still **view** their existing nudges
- They **cannot** send new nudges (handled by backend)
- They see a premium gate only if they have NO nudges at all

### Nudge Types

| Type        | Icon        | Color | Description          |
| ----------- | ----------- | ----- | -------------------- |
| `nudge`     | `hand-left` | Blue  | General reminder     |
| `cheer`     | `heart`     | Amber | Encouragement        |
| `celebrate` | `trophy`    | Green | Achievement congrats |

### Navigation on Tap

When a user taps a nudge, they're navigated based on context:

```typescript
const handleNudgePress = async (nudge: Nudge) => {
  // Mark as read
  if (!nudge.is_read) {
    await markReadMutation.mutateAsync(nudge.id);
  }

  // Navigate based on context
  if (nudge.goal_id) {
    router.push(`${MOBILE_ROUTES.GOALS.DETAILS}?id=${nudge.goal_id}`);
  } else if (nudge.partnership_id) {
    router.push(MOBILE_ROUTES.PROFILE.PARTNERS);
  }
};
```

## Backend Integration

### Partner Dashboard Endpoint

The backend returns partner data with feature status:

```python
# GET /partners/{partner_user_id}/dashboard
class PartnerDashboard(BaseModel):
    partner: PartnerUserInfo  # Includes has_partner_feature
    partnership_id: str
    goals: List[PartnerGoalSummary]
    total_active_goals: int
    overall_streak: int
    logged_today: bool

# Partner feature check (in partners.py)
partner_limit = await get_user_feature_value(
    supabase, partner_user_id, "accountability_partner_limit"
)
partner_has_feature = partner_limit is None or partner_limit > 0
```

### Partnership Verification

The backend verifies partnership before returning data:

```python
# Verify there's an accepted partnership
partnership = (
    supabase.table("accountability_partners")
    .select("id, created_at")
    .eq("status", "accepted")
    .or_(
        f"and(user_id.eq.{user_id},partner_user_id.eq.{partner_user_id}),"
        f"and(user_id.eq.{partner_user_id},partner_user_id.eq.{user_id})"
    )
    .maybe_single()
    .execute()
)

if not partnership.data:
    raise HTTPException(status_code=403, detail="Not partners")
```

## Subscription Expiry Handling

### When Subscription Expires

When a user's subscription expires and `accountability_partner_limit` changes:

1. **Pending requests deleted** - Any partner requests they sent are removed
2. **Accepted partnerships kept** - Existing partnerships remain (graceful degradation)
3. **Limit enforced** - They can't send new requests if at or over their new limit
4. **Partner still works** - If the OTHER partner has the feature, access continues

### Limit Values by Plan

| Plan    | `accountability_partner_limit` |
| ------- | ------------------------------ |
| Free    | `1` (1 partner)                |
| Premium | `null` (unlimited)             |

### Cleanup Tasks

```python
# Daily Celery task
@celery_app.task(name="subscription.cleanup_expired_partner_requests")
def cleanup_expired_partner_requests_task():
    """Delete pending partner requests from users who lost subscription."""
    # Only deletes PENDING requests where sender's limit is now 0
    # Accepted partnerships are kept for graceful degradation
```

### Request Validation (Backend)

```python
# In send_partner_request (partners.py)
partner_limit = await get_user_feature_value(
    supabase, user_id, "accountability_partner_limit"
)

# If limit is 0, user doesn't have the feature
if partner_limit is not None and partner_limit == 0:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Accountability partner feature requires a subscription",
    )

# Count accepted + pending sent against limit
if partner_limit is not None and total_count >= partner_limit:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Partner limit reached ({partner_limit}). Upgrade for more.",
    )
```

## Files Modified

| File                      | Changes                                             |
| ------------------------- | --------------------------------------------------- |
| `PartnerDetailScreen.tsx` | Navigation with viewMode, partnership guard         |
| `GoalDetailScreen.tsx`    | Partner view mode, validation, hidden actions       |
| `realtimeService.ts`      | Dashboard cache invalidation on DELETE              |
| `en.json`                 | Partner view translations                           |
| `partners.py`             | `accountability_partner_limit` checks, limit gating |
| `subscription_tasks.py`   | Partner request cleanup task                        |
| `celery_app.py`           | Scheduled cleanup task                              |
| `subscriptionStore.ts`    | `hasPartnerFeature`, `getPartnerLimit` methods      |
| `usePartners.ts`          | `usePartnerAccess` unified hook                     |

## Translation Keys

```json
{
  "partners": {
    "viewing_partner_goal": "Viewing partner's goal (read-only)",
    "access_denied": "Access Denied",
    "not_partners_anymore": "You are no longer accountability partners",
    "no_longer_partners": "Partnership Ended",
    "partnership_removed_message": "You are no longer accountability partners",
    "premium_title": "Accountability Partners",
    "premium_description": "Connect with accountability partners...",
    "premium_required_title": "Premium Feature",
    "premium_required_description": "To access accountability partner features..."
  },
  "activity": {
    "premium_title": "Partner Activity",
    "premium_description": "See nudges and cheers from your accountability partners...",
    "unread_count": "{{count}} unread",
    "mark_all_read": "Mark all read"
  }
}
```

## Testing Scenarios

### Partner View Flow

1. User A and User B are partners
2. User A opens PartnerDetailScreen for User B
3. User A taps on one of B's goals
4. GoalDetailScreen opens with partner banner, no action buttons

### Partnership Removal

1. User A is viewing User B's PartnerDetailScreen
2. User B removes User A as partner (on their device)
3. Realtime event triggers on User A's device
4. User A sees toast "Partnership Ended" and is navigated back

### Subscription Expiry

1. User A (premium, unlimited partners) and User B (free, 1 partner) are partners
2. User A's subscription expires → limit changes from `null` to `1`
3. Pending requests from A are deleted (if A was over the new limit)
4. A can still view B's dashboard (graceful degradation - existing partnerships kept)
5. Both A and B now have limit of 1, so they can keep their partnership but can't add more

### Partner Limit Enforcement

1. User A (free, limit=1) has 1 accepted partner
2. User A tries to send a new partner request
3. Backend returns 403: "Partner limit reached (1). Upgrade for more."
4. Frontend shows upgrade prompt via `canSendRequest` check

### Access Denied

1. User A tries to view a goal directly via deep link with viewMode=partner
2. partnerId in URL is not in their partners list
3. Alert shown: "Access Denied - You are no longer accountability partners"
4. User navigated back
