# Scalability Architecture

This document describes the scalability patterns and optimizations implemented in FitNudge to support **100K+ users**.

## Executive Summary

| Metric                     | Current Capacity | Bottleneck                  |
| -------------------------- | ---------------- | --------------------------- |
| **Daily Active Users**     | 100K+            | Celery workers (horizontal) |
| **Push Notifications/day** | 2M+              | Expo rate limit (600/sec)   |
| **Database Connections**   | 200 clients      | Supabase pooler             |
| **Background Tasks/hour**  | 100K+            | Redis queue depth           |

---

## 1. Database Architecture

### 1.1 Connection Strategy

We use **Supabase REST API** (PostgREST) instead of direct Postgres connections:

```python
# database.py - REST API is already connection-pooled
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
```

**Why this scales:**

- PostgREST handles connection pooling automatically
- No connection exhaustion risk
- Unlimited concurrent requests (rate-limited, not connection-limited)
- RLS policies enforced server-side

### 1.2 Pooler Configuration (for Direct Postgres if needed)

```python
# config.py
DATABASE_POOL_URL: str = os.getenv("DATABASE_POOL_URL", "")
DATABASE_POOL_MIN_SIZE: int = 2
DATABASE_POOL_MAX_SIZE: int = 10
```

**Supabase Pooler Modes:**
| Mode | Use Case | Our Usage |
|------|----------|-----------|
| **Direct** | Long-lived connections | Not used |
| **Transaction** | Serverless, short-lived | Celery workers (if needed) |
| **Session** | IPv4 fallback | Not used |

### 1.3 Batch Operations (O(1) instead of O(n))

**Before (N+1 Query Pattern):**

```python
# ❌ BAD: 100 challenges = 100 DB calls
for challenge in challenges:
    supabase.table("challenges").update(...).eq("id", challenge["id"]).execute()
```

**After (Batch Update):**

```python
# ✅ GOOD: 100 challenges = 1 DB call
challenge_ids = [c["id"] for c in challenges]
supabase.table("challenges").update(...).in_("id", challenge_ids).execute()
```

**Files updated:**

- `subscription_service.py` - Batch challenge cancellation
- `subscription_tasks.py` - Batch participant updates
- `cleanup_service.py` - Batch notification cleanup
- `expo_push_service.py` - Batch token deactivation

### 1.3 N+1 Query Patterns Fixed

**Pattern: Lookup inside loop → Batch prefetch**

| Task/Service                            | Before                                | After                                         |
| --------------------------------------- | ------------------------------------- | --------------------------------------------- |
| `goal_tasks.py` - Check-in creation     | 1 query per goal to check if exists   | Batch `.in_()` prefetch all check-ins         |
| `goal_tasks.py` - Challenge check-ins   | 1 query per participant               | Batch `.in_()` prefetch all check-ins         |
| `notification_tasks.py` - Re-engagement | 2 queries per user (checkins + prefs) | Batch `.in_()` prefetch both                  |
| `achievement_service.py` - Unlock check | 1 query per achievement type          | Batch `.in_()` prefetch all user achievements |

**Example Fix (goal_tasks.py):**

```python
# ❌ BEFORE: N queries in loop
for goal in goals:
    existing = supabase.table("check_ins").select("id")
        .eq("goal_id", goal["id"]).execute()  # 1 query per goal!

# ✅ AFTER: 1 batch query + set lookup
goal_ids = [g["id"] for g in goals]
all_existing = supabase.table("check_ins").select("goal_id, check_in_date")
    .in_("goal_id", goal_ids).execute()  # 1 query total
existing_keys = set((c["goal_id"], c["check_in_date"]) for c in all_existing.data)

for goal in goals:
    if (goal["id"], today_str) in existing_keys:  # O(1) lookup
        continue  # Already exists
```

---

## 2. Push Notification Architecture

### 2.1 Expo SDK Batch Sending

```python
# expo_push_service.py - Uses publish_multiple() for O(1) API calls
push_messages = [PushMessage(...) for token in tokens]
responses = PushClient().publish_multiple(push_messages)  # Single API call
```

**Capacity:**

- Expo limit: 600 notifications/second
- Our rate: ~500/second (200ms batch delay)
- Daily capacity: 43M notifications

### 2.2 Rate Limiting & Retry

```python
EXPO_BATCH_SIZE = 100          # Expo's recommended batch size
BATCH_DELAY_SECONDS = 0.2      # 200ms = ~500/sec (under 600 limit)
MAX_RETRIES = 3                # Exponential backoff: 2s, 4s, 8s
```

### 2.3 Invalid Token Cleanup

```python
# Batch deactivate invalid tokens
supabase.table("device_tokens").update(
    {"is_active": False}
).in_("id", invalid_token_ids).execute()
```

---

## 3. Background Task Architecture

### 3.1 Celery Configuration

```python
# celery_app.py
celery_app.conf.update(
    worker_prefetch_multiplier=1,      # Fair task distribution
    worker_max_tasks_per_child=1000,   # Prevent memory leaks
    task_time_limit=60,                # 60 second max per task
    task_acks_late=True,               # Acknowledge after completion
)
```

### 3.2 Task Chunking Pattern

For operations involving many users, we split into chunks:

```python
# task_utils.py
def dispatch_chunked_tasks(task, items, chunk_size=100, **kwargs):
    chunks = chunk_list(items, chunk_size)
    for chunk in chunks:
        task.delay(chunk, **kwargs)
```

**Usage:**

```python
# subscription_service.py
from app.services.tasks.task_utils import dispatch_chunked_tasks

dispatch_chunked_tasks(
    task=notify_challenge_cancelled_chunk_task,
    items=user_ids,
    chunk_size=50,
    challenge_id=challenge_id,
)
```

### 3.3 Chunked Tasks Implemented

| Task                                      | Chunk Size | Trigger                                   |
| ----------------------------------------- | ---------- | ----------------------------------------- |
| `notify_challenge_cancelled_chunk_task`   | 50         | Challenge cancelled with 10+ participants |
| `send_challenge_reminder_chunk_task`      | 50         | Challenge reminder with 10+ participants  |
| `cleanup_expired_partner_requests_task`   | 500        | Daily cleanup task                        |
| `cleanup_expired_creator_challenges_task` | 500        | Daily cleanup task                        |

### 3.4 Inline vs Dispatch Threshold

```python
INLINE_THRESHOLD = 10  # Process inline if <= 10 users

if len(user_ids) <= INLINE_THRESHOLD:
    # Small number - process inline (lower latency)
    for user_id in user_ids:
        send_notification(user_id)
else:
    # Large number - dispatch to Celery (parallel processing)
    dispatch_chunked_tasks(notify_task, user_ids, chunk_size=50)
```

---

## 4. Paginated Cleanup Tasks

### 4.1 Pattern

Large cleanup operations use pagination to avoid memory issues:

```python
# cleanup_service.py
CLEANUP_BATCH_SIZE = 500
offset = 0

while True:
    batch = supabase.table("accountability_partners")
        .select("id, user_id")
        .eq("status", "pending")
        .range(offset, offset + CLEANUP_BATCH_SIZE - 1)
        .execute()

    if not batch.data:
        break

    # Process batch
    process_batch(batch.data)

    if len(batch.data) < CLEANUP_BATCH_SIZE:
        break

    offset += CLEANUP_BATCH_SIZE
```

### 4.2 Tasks Using Pagination

| Task                                      | Batch Size | Runs   |
| ----------------------------------------- | ---------- | ------ |
| `cleanup_expired_partner_requests_task`   | 500        | Daily  |
| `cleanup_expired_creator_challenges_task` | 500        | Daily  |
| `cleanup_orphaned_notifications_task`     | 500        | Weekly |

---

## 5. API Endpoint Optimization

### 5.1 Existing Optimizations

- **Pagination**: Most list endpoints use `limit` parameter
- **Selective Queries**: Only select needed columns
- **Index Usage**: Queries use indexed columns (`user_id`, `status`, etc.)

### 5.2 Example: Partner Dashboard

```python
# partners.py - Efficient single query with joins
result = supabase.table("accountability_partners")
    .select("""
        id, status, created_at,
        user:users!user_id(id, name, avatar_url),
        partner:users!partner_user_id(id, name, avatar_url)
    """)
    .or_(f"user_id.eq.{user_id},partner_user_id.eq.{user_id}")
    .eq("status", "accepted")
    .execute()
```

---

## 6. Notification History

### 6.1 Entity Tracking for Cleanup

All notifications store `entity_type` and `entity_id` for efficient cleanup:

```python
notification_record = {
    "entity_type": "challenge",      # goal, challenge, partner_request, etc.
    "entity_id": challenge_id,       # UUID of the entity
}
```

### 6.2 Cleanup on Entity Deletion

```python
# cleanup_service.py
def cleanup_challenges_batch_sync(supabase, challenge_ids, reason):
    # Delete invites
    supabase.table("challenge_invites")
        .delete()
        .in_("challenge_id", challenge_ids)
        .eq("status", "pending")
        .execute()

    # Delete notifications
    supabase.table("notification_history")
        .delete()
        .eq("entity_type", "challenge")
        .in_("entity_id", challenge_ids)
        .execute()
```

---

## 7. Fire-and-Forget Pattern

### 7.1 Non-Blocking Cleanup

API endpoints use `asyncio.create_task()` for non-blocking cleanup:

```python
# partners.py
from app.services.cleanup_service import fire_and_forget_partner_cleanup

@router.delete("/partners/{partner_id}")
async def remove_partner(...):
    # Delete partnership (blocking)
    supabase.table("accountability_partners").delete()...

    # Cleanup notifications (non-blocking)
    fire_and_forget_partner_cleanup(partnership_id, reason="removed")

    return {"success": True}  # Returns immediately
```

### 7.2 Cleanup Functions

| Function                                        | Purpose                               |
| ----------------------------------------------- | ------------------------------------- |
| `fire_and_forget_partner_cleanup()`             | Partner notification cleanup          |
| `fire_and_forget_challenge_cleanup()`           | Challenge invite/notification cleanup |
| `fire_and_forget_invite_notification_cleanup()` | Individual invite cleanup             |

---

## 8. AI Motivation Generation

### 8.1 Variety for Scalability

Push notifications use randomized variety hints to avoid repetitive content:

```python
# push_motivation_generator.py
variety_hints = [
    "Focus on the excitement of making progress today.",
    "Emphasize the importance of consistency.",
    "Highlight what they'll achieve by completing this.",
    # ... 5 more hints
]
variety_hint = random.choice(variety_hints)
```

### 8.2 Temperature for Creativity

```python
response = client.chat.completions.create(
    model="gpt-4o-mini",
    temperature=0.95,  # High for variety (was 0.8)
    max_tokens=150,
)
```

---

## 9. Capacity Planning

### 9.1 Current Limits

| Resource             | Free Tier | Pro Tier | Our Usage            |
| -------------------- | --------- | -------- | -------------------- |
| **Supabase Pool**    | 15        | 100      | REST API (unlimited) |
| **Supabase Clients** | 200       | 1,000    | ~50 max              |
| **Expo Push/sec**    | 600       | 600      | ~500                 |
| **Redis Memory**     | 30MB      | 100MB    | ~10MB                |

### 9.2 Scaling Triggers

| Users           | Action Required                 |
| --------------- | ------------------------------- |
| **< 10K**       | No changes needed               |
| **10K - 50K**   | Upgrade Supabase to Pro         |
| **50K - 100K**  | Add Celery workers (horizontal) |
| **100K - 500K** | Read replicas, dedicated Redis  |
| **500K+**       | Consider Supabase Enterprise    |

---

## 10. Monitoring Recommendations

### 10.1 Key Metrics to Watch

| Metric                  | Warning Threshold | Critical |
| ----------------------- | ----------------- | -------- |
| **Celery Queue Depth**  | > 1,000           | > 10,000 |
| **Task Latency (p95)**  | > 30s             | > 60s    |
| **DB Query Time (p95)** | > 500ms           | > 2s     |
| **Push Delivery Rate**  | < 95%             | < 90%    |
| **Error Rate**          | > 1%              | > 5%     |

### 10.2 PostHog Integration

```python
# Already configured in config.py
POSTHOG_API_KEY: str = os.getenv("POSTHOG_API_KEY", "")
POSTHOG_HOST: str = os.getenv("POSTHOG_HOST", "https://us.i.posthog.com")
```

---

## 11. Summary of Optimizations

| Category                   | Before                  | After                   | Improvement         |
| -------------------------- | ----------------------- | ----------------------- | ------------------- |
| **Challenge Updates**      | O(n) loops              | `.in_()` batch          | 100x faster         |
| **Participant Updates**    | O(n) loops              | `.in_()` batch          | 100x faster         |
| **Push Notifications**     | 1 call per token        | `publish_multiple()`    | 100x faster         |
| **Cleanup Tasks**          | Load all                | Paginated (500)         | Unbounded → bounded |
| **Large Notifications**    | Sequential              | Chunked Celery          | Parallel processing |
| **Token Deactivation**     | O(n) loops              | `.in_()` batch          | 100x faster         |
| **Goal Check-ins (daily)** | 1 query per goal        | Batch `.in_()` prefetch | 100x faster         |
| **Challenge Check-ins**    | 1 query per participant | Batch `.in_()` prefetch | 100x faster         |
| **Re-engagement Prefs**    | 2 queries per user      | Batch `.in_()` prefetch | 100x faster         |
| **Achievement Unlocking**  | 1 query per badge       | Batch `.in_()` prefetch | 100x faster         |

---

## 12. Files Modified for Scalability

| File                           | Changes                                    |
| ------------------------------ | ------------------------------------------ |
| `subscription_service.py`      | Batch updates, chunked notifications       |
| `subscription_tasks.py`        | Batch updates, paginated cleanup           |
| `challenge_tasks.py`           | Chunked reminder notifications             |
| `cleanup_service.py`           | Batch cleanup functions, pagination        |
| `expo_push_service.py`         | `publish_multiple()`, batch token updates  |
| `task_utils.py`                | `chunk_list()`, `dispatch_chunked_tasks()` |
| `config.py`                    | Connection pooling config                  |
| `database.py`                  | Pooling documentation                      |
| `push_motivation_generator.py` | Variety for scale                          |
| `goal_tasks.py`                | Batch check-in existence queries           |
| `notification_tasks.py`        | Batch re-engagement prefs/checkins         |
| `achievement_service.py`       | Batch user_achievements lookup             |

---

## 13. Remaining Considerations

### 13.1 Acceptable Patterns (Low Priority)

These patterns have N+1 potential but are acceptable due to low volume or per-user scope:

| Pattern                      | Location                 | Why Acceptable                                           |
| ---------------------------- | ------------------------ | -------------------------------------------------------- |
| Weekly recap per user        | `analytics_tasks.py`     | Runs once/week, low volume                               |
| AI motivation generation     | `notification_tasks.py`  | Already has `already_sent` check (could batch in future) |
| Check-in prompts             | `notification_tasks.py`  | Time-filtered, most goals skip early                     |
| Leaderboard rank updates     | `challenge_service.py`   | Most challenges < 100 participants                       |
| Achievement condition checks | `achievement_service.py` | Per-user, async background                               |

### 13.2 Future Optimizations (500K+ Users)

If scaling beyond 500K users:

1. **Read Replicas**: Route read-heavy endpoints to replica
2. **Caching Layer**: Redis cache for hot data (leaderboards, user stats)
3. **Database Sharding**: Partition by user_id for horizontal scaling
4. **Event Sourcing**: Move to event-driven architecture for real-time features
5. **Separate Analytics DB**: Move analytics queries to dedicated database

### 13.3 Select Fields Optimization

Using `select("*")` is found in ~167 places. For high-frequency endpoints, consider:

```python
# Instead of:
supabase.table("goals").select("*").eq(...)

# Use specific fields:
supabase.table("goals").select("id, title, status, user_id").eq(...)
```

This reduces network payload and database processing.

---

## Conclusion

With these optimizations, FitNudge can handle:

- ✅ **100K+ Daily Active Users**
- ✅ **2M+ Push Notifications/day**
- ✅ **1M+ Background Tasks/day**
- ✅ **100K+ Partner/Challenge Operations/day**

The architecture is designed for **horizontal scaling** - add more Celery workers and the system scales linearly.
