# Partner Viewing & Social Accountability

This document describes how accountability partners can view each other's goals and challenges, including privacy controls, real-time updates, and subscription gating.

## Overview

Accountability partners are users who have connected to help motivate each other. Once connected, partners can:

- View each other's active goals and challenges
- See progress, streaks, and check-in status
- Send nudges to encourage activity
- Get notified about milestones

## Partner View Mode

When a partner views their accountability partner's goals or challenges, they enter a **read-only "Partner View"** mode.

### Navigation Flow

```
PartnerDetailScreen (shows partner's dashboard)
        ↓
Partner taps on a goal or challenge card
        ↓
Navigation with query params:
  - viewMode=partner
  - partnerId=<partner_user_id>
        ↓
GoalDetailScreen or ChallengeDetailScreen loads in partner view
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

| Element                | Hidden | Reason                  |
| ---------------------- | ------ | ----------------------- |
| Check-in button        | ❌     | Only owner can check in |
| Log Meal/Water buttons | ❌     | Only owner can track    |
| Edit goal/challenge    | ❌     | Only owner can modify   |
| Leave challenge        | ❌     | Only owner can leave    |
| Rest day indicators    | ❌     | Not relevant to partner |
| No check-in message    | ❌     | Not relevant to partner |
| Tracking modals        | ❌     | Cannot interact         |

## Implementation Details

### Query Parameters

When navigating to goal/challenge detail screens in partner view:

```typescript
// Goal navigation
router.push(
  `${MOBILE_ROUTES.GOALS.DETAILS}?id=${goalId}&viewMode=partner&partnerId=${partnerUserId}`
);

// Challenge navigation
router.push(
  `${MOBILE_ROUTES.CHALLENGES.DETAILS(challengeId)}?viewMode=partner&partnerId=${partnerUserId}`
);
```

### Partner View Detection

In `GoalDetailScreen.tsx` and `ChallengeDetailScreen.tsx`:

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

Social accountability features require premium subscription. The access logic is:

| Screen                | Access Condition                                   |
| --------------------- | -------------------------------------------------- |
| `PartnersScreen`      | User has feature OR has existing partners/requests |
| `PartnerDetailScreen` | User has feature OR partner has feature            |
| `ActivityScreen`      | User has feature OR has existing nudges            |
| `FindPartnerScreen`   | User has feature                                   |

### Implementation

```typescript
// PartnersScreen
const { hasFeature } = useSubscriptionStore();
const hasPartnerFeature = hasFeature("social_accountability");
const partners = partnersData?.data || [];
const pendingRequests = pendingData?.data || [];
const hasAccess =
  hasPartnerFeature || partners.length > 0 || pendingRequests.length > 0;

// PartnerDetailScreen
const userHasFeature = hasFeature("social_accountability");
const partnerHasFeature =
  dashboard?.partner?.has_social_accountability ?? false;
const hasAccess = userHasFeature || partnerHasFeature;

// ActivityScreen
const hasPartnerFeature = hasFeature("social_accountability");
const nudges = nudgesData?.data || [];
const hasAccess = hasPartnerFeature || nudges.length > 0;
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
      onPress={() => router.push(MOBILE_ROUTES.ONBOARDING.SUBSCRIPTION)}
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
- **Competitive** - Challenge-related nudges
- **Custom** - Custom messages

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

| Type          | Icon         | Color  | Description           |
| ------------- | ------------ | ------ | --------------------- |
| `nudge`       | `hand-left`  | Blue   | General reminder      |
| `cheer`       | `heart`      | Amber  | Encouragement         |
| `milestone`   | `trophy`     | Green  | Achievement congrats  |
| `competitive` | `flame`      | Red    | Challenge competition |
| `custom`      | `chatbubble` | Purple | Custom message        |

### Navigation on Tap

When a user taps a nudge, they're navigated based on context:

```typescript
const handleNudgePress = async (nudge: Nudge) => {
  // Mark as read
  if (!nudge.is_read) {
    await markReadMutation.mutateAsync(nudge.id);
  }

  // Navigate based on context
  if (nudge.challenge_id) {
    router.push(MOBILE_ROUTES.CHALLENGES.DETAILS(nudge.challenge_id));
  } else if (nudge.goal_id) {
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
    partner: PartnerUserInfo  # Includes has_social_accountability
    partnership_id: str
    goals: List[PartnerGoalSummary]
    challenges: List[PartnerChallengeSummary]
    total_active_goals: int
    total_active_challenges: int
    overall_streak: int
    logged_today: bool
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

When a user's subscription expires and they lose `social_accountability`:

1. **Pending requests deleted** - Any partner requests they sent are removed
2. **Accepted partnerships kept** - Existing partnerships remain (graceful degradation)
3. **Feature access revoked** - They can't send new requests or access partner features
4. **Partner still works** - If the OTHER partner has the feature, access continues

### Cleanup Tasks

```python
# Daily Celery task
@celery_app.task(name="subscription.cleanup_expired_partner_requests")
def cleanup_expired_partner_requests_task():
    """Delete pending partner requests from users who lost subscription."""
    # Only deletes PENDING requests where sender lost feature
    # Accepted partnerships are kept for graceful degradation
```

## Files Modified

| File                        | Changes                                         |
| --------------------------- | ----------------------------------------------- |
| `PartnerDetailScreen.tsx`   | Navigation with viewMode, partnership guard     |
| `GoalDetailScreen.tsx`      | Partner view mode, validation, hidden actions   |
| `ChallengeDetailScreen.tsx` | Partner view mode, validation, hidden actions   |
| `ActivityScreen.tsx`        | Subscription gate for nudges/activity           |
| `realtimeService.ts`        | Dashboard cache invalidation on DELETE          |
| `en.json`                   | Partner view translations                       |
| `partners.py`               | has_social_accountability in dashboard response |
| `subscription_tasks.py`     | Partner request cleanup task                    |
| `celery_app.py`             | Scheduled cleanup task                          |

## Translation Keys

```json
{
  "partners": {
    "viewing_partner_goal": "Viewing partner's goal (read-only)",
    "viewing_partner_challenge": "Viewing partner's challenge (read-only)",
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

1. User A (premium) and User B (free) are partners
2. User A's subscription expires
3. Pending requests from A are deleted
4. A can still view B's dashboard (graceful degradation)
5. If B was also free, neither can use partner features

### Access Denied

1. User A tries to view a goal directly via deep link with viewMode=partner
2. partnerId in URL is not in their partners list
3. Alert shown: "Access Denied - You are no longer accountability partners"
4. User navigated back
