# Test Cases: Social & Challenge Features

This document contains test cases for verifying the social and challenge features in FitNudge.

---

## Table of Contents

1. [Accountability Partners](#1-accountability-partners)
2. [Social Nudges & Cheers](#2-social-nudges--cheers)
3. [Challenges](#3-challenges)
4. [Goal Activation & Deactivation](#4-goal-activation--deactivation)
5. [Challenge Creation](#5-challenge-creation)
6. [Feature Access & Limits](#6-feature-access--limits)
7. [Challenge Lifecycle (Celery Tasks)](#7-challenge-lifecycle-celery-tasks)

---

## 1. Accountability Partners

### 1.1 Search Users

| Test ID | Test Case                          | Steps                                                                          | Expected Result                                 |
| ------- | ---------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------- |
| AP-001  | Search for users with valid query  | 1. Navigate to Find Partner screen<br>2. Enter at least 2 characters in search | Users matching the query are displayed          |
| AP-002  | Search with less than 2 characters | 1. Enter 1 character in search                                                 | No search is performed, hint message shown      |
| AP-003  | Search returns existing partner    | 1. Search for a user you're already partners with                              | User shows "Partner" badge, cannot send request |
| AP-004  | Search returns pending request     | 1. Search for a user with pending request                                      | User shows "Pending" badge, cannot send request |
| AP-005  | Search excludes current user       | 1. Search for your own username                                                | Your own profile should not appear              |
| AP-006  | Empty search results               | 1. Search for a non-existent username                                          | "No users found" message displayed              |

### 1.2 Send Partner Request

| Test ID | Test Case                         | Steps                                                             | Expected Result                                     |
| ------- | --------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| AP-010  | Send partner request successfully | 1. Search for a user<br>2. Tap add button<br>3. Confirm in dialog | Success alert shown, user now shows "Pending" badge |
| AP-011  | Cannot request self               | 1. Try to send request to yourself (if possible)                  | Error: "Cannot send partner request to yourself"    |
| AP-012  | Cannot request existing partner   | 1. Tap add on existing partner                                    | Info alert: "Already partners with this user"       |
| AP-013  | Cannot duplicate request          | 1. Try to send request to user with pending request               | Info alert: "A request is already pending"          |

### 1.3 Accept/Reject Partner Request

| Test ID | Test Case              | Steps                                                    | Expected Result                                 |
| ------- | ---------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| AP-020  | Accept partner request | 1. View pending requests<br>2. Tap Accept                | Request moves to partners list, success message |
| AP-021  | Reject partner request | 1. View pending requests<br>2. Tap Decline<br>3. Confirm | Request removed from pending list               |
| AP-022  | View pending requests  | 1. Navigate to Partners screen                           | Pending section shows incoming requests         |

### 1.4 Manage Partners

| Test ID | Test Case         | Steps                                                                | Expected Result                           |
| ------- | ----------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| AP-030  | Remove partner    | 1. View partner list<br>2. Tap menu on partner<br>3. Confirm removal | Partner removed from list                 |
| AP-031  | View partner list | 1. Navigate to Partners screen                                       | All accepted partners displayed with info |
| AP-032  | Pull to refresh   | 1. Pull down on partners list                                        | List refreshes with latest data           |

---

## 2. Social Nudges & Cheers

### 2.1 Send Nudge

| Test ID | Test Case                         | Steps                                                                 | Expected Result                       |
| ------- | --------------------------------- | --------------------------------------------------------------------- | ------------------------------------- |
| NU-001  | Send nudge to partner             | 1. Find NudgeButton component<br>2. Tap nudge<br>3. Confirm in dialog | Success alert, nudge sent             |
| NU-002  | Send nudge with goal context      | 1. Send nudge from goal screen                                        | Nudge includes goal_id reference      |
| NU-003  | Send nudge with challenge context | 1. Send nudge from challenge screen                                   | Nudge includes challenge_id reference |
| NU-004  | Nudge button shows loading        | 1. Tap nudge and wait                                                 | Button shows spinner while sending    |

### 2.2 Send Cheer

| Test ID | Test Case                | Steps                                           | Expected Result                   |
| ------- | ------------------------ | ----------------------------------------------- | --------------------------------- |
| NU-010  | Send cheer on check-in   | 1. Find CheerButton on check-in<br>2. Tap cheer | Heart animates, turns filled/gold |
| NU-011  | Cannot cheer twice       | 1. Cheer on a check-in<br>2. Try to cheer again | Button disabled after first cheer |
| NU-012  | Cheer with initial state | 1. View check-in already cheered                | Button shows filled heart state   |

### 2.3 View Nudges

| Test ID | Test Case                 | Steps                                  | Expected Result                       |
| ------- | ------------------------- | -------------------------------------- | ------------------------------------- |
| NU-020  | View nudges list          | 1. Navigate to Nudges screen           | All received nudges displayed         |
| NU-021  | Unread nudges highlighted | 1. Receive new nudge<br>2. View nudges | Unread nudges have visual indicator   |
| NU-022  | Mark nudge as read        | 1. Tap on unread nudge                 | Nudge marked as read, styling changes |
| NU-023  | Mark all as read          | 1. Tap "Mark all read"                 | All nudges marked as read             |
| NU-024  | Navigate from nudge       | 1. Tap nudge with goal context         | Navigates to goal details             |
| NU-025  | Navigate to challenge     | 1. Tap nudge with challenge context    | Navigates to challenge screen         |
| NU-026  | Empty state               | 1. View nudges with no nudges          | Empty state message shown             |
| NU-027  | Time ago formatting       | 1. View nudge from 5 minutes ago       | Shows "5 minutes ago"                 |
| NU-028  | Pull to refresh           | 1. Pull down on nudges list            | List refreshes with latest nudges     |

---

## 3. Challenges

### 3.1 Join Challenge

| Test ID | Test Case                        | Steps                                                       | Expected Result                                     |
| ------- | -------------------------------- | ----------------------------------------------------------- | --------------------------------------------------- |
| CH-001  | Join public challenge            | 1. View public challenge<br>2. Tap Join                     | Successfully joined, added to participants          |
| CH-002  | Cannot join after start date     | 1. Try to join challenge that has started                   | Error: "Challenge has already started"              |
| CH-003  | Cannot join after join deadline  | 1. Try to join after join_deadline                          | Error: "Join deadline has passed"                   |
| CH-004  | Cannot join ended challenge      | 1. Try to join ended challenge                              | Error: "Challenge has ended"                        |
| CH-005  | Challenge join limit (Free)      | 1. As Free user, join 1 challenge<br>2. Try to join another | Error: "You can only join 1 challenge(s) at a time" |
| CH-006  | Challenge join limit (Starter)   | 1. As Starter, join 2 challenges<br>2. Try to join third    | Error: "You can only join 2 challenge(s) at a time" |
| CH-007  | Challenge join limit (Pro/Elite) | 1. As Pro, join 3 challenges<br>2. Try to join fourth       | Error: "You can only join 3 challenge(s) at a time" |
| CH-008  | Cannot join own challenge        | 1. Create challenge<br>2. Try to join it                    | Error or already a participant                      |

### 3.2 Leave Challenge

| Test ID | Test Case                      | Steps                                                  | Expected Result                                          |
| ------- | ------------------------------ | ------------------------------------------------------ | -------------------------------------------------------- |
| CH-010  | Leave challenge as participant | 1. View joined challenge<br>2. Tap Leave<br>3. Confirm | Removed from challenge, check-ins deleted                |
| CH-011  | Creator cannot leave           | 1. As creator, try to leave                            | Error: "Creator cannot leave. Cancel or delete instead." |

### 3.3 Cancel Challenge (Creator Only)

| Test ID | Test Case                 | Steps                                    | Expected Result                        |
| ------- | ------------------------- | ---------------------------------------- | -------------------------------------- |
| CH-020  | Cancel active challenge   | 1. As creator, tap Cancel<br>2. Confirm  | Challenge deactivated, data preserved  |
| CH-021  | Non-creator cannot cancel | 1. As participant, try to cancel         | No option available or error           |
| CH-022  | Cancel updates metadata   | 1. Cancel challenge<br>2. Check metadata | cancelled_at and cancelled_by recorded |

### 3.4 Delete Challenge (Creator Only)

| Test ID | Test Case                             | Steps                                                     | Expected Result                                          |
| ------- | ------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------- |
| CH-030  | Delete challenge with no participants | 1. Create challenge (no one joined)<br>2. Delete          | Challenge permanently removed                            |
| CH-031  | Cannot delete with participants       | 1. Create challenge with participants<br>2. Try to delete | Error: "Cannot delete challenge with other participants" |

### 3.5 Challenge Check-ins

| Test ID | Test Case                 | Steps                                        | Expected Result                               |
| ------- | ------------------------- | -------------------------------------------- | --------------------------------------------- |
| CH-040  | Check-in to challenge     | 1. View active challenge<br>2. Tap Check-in  | Check-in recorded, points updated             |
| CH-041  | View my check-ins         | 1. View challenge<br>2. See check-in history | All user's check-ins for this challenge shown |
| CH-042  | Cannot check-in after end | 1. Try to check-in to ended challenge        | Error or option not available                 |

### 3.6 Leaderboard

| Test ID | Test Case                       | Steps                                        | Expected Result               |
| ------- | ------------------------------- | -------------------------------------------- | ----------------------------- |
| CH-050  | View leaderboard                | 1. Open challenge<br>2. View leaderboard tab | Participants ranked by points |
| CH-051  | Leaderboard updates on check-in | 1. Check-in<br>2. View leaderboard           | Your rank/points updated      |
| CH-052  | Tie handling                    | 1. Two users with same points                | Both show same rank           |

---

## 4. Goal Activation & Deactivation

### 4.1 Activate Goal

| Test ID | Test Case                        | Steps                                                       | Expected Result                |
| ------- | -------------------------------- | ----------------------------------------------------------- | ------------------------------ |
| GA-001  | Activate inactive goal           | 1. View inactive goal<br>2. Tap Activate                    | Goal becomes active            |
| GA-002  | Activate respects combined limit | 1. Have max active goals + challenges<br>2. Try to activate | Error with limit message       |
| GA-003  | Activate unarchives goal         | 1. Activate archived goal                                   | Goal unarchived and activated  |

### 4.2 Deactivate Goal

| Test ID | Test Case                  | Steps                                     | Expected Result                    |
| ------- | -------------------------- | ----------------------------------------- | ---------------------------------- |
| GA-010  | Deactivate active goal     | 1. View active goal<br>2. Tap Deactivate  | Goal becomes inactive              |
| GA-011  | Deactivate to free up slot | 1. Deactivate goal<br>2. Activate another | Second goal activates successfully |

### 4.3 Delete Goal

| Test ID | Test Case                     | Steps                                                | Expected Result               |
| ------- | ----------------------------- | ---------------------------------------------------- | ----------------------------- |
| GA-020  | Delete goal without check-ins | 1. Create new goal<br>2. Delete immediately          | Goal deleted, no warning      |
| GA-021  | Delete goal with check-ins    | 1. Goal with check-ins<br>2. Try to delete           | Warning shown about data loss |
| GA-022  | Choose archive instead        | 1. See delete warning<br>2. Choose "Archive Instead" | Goal archived, not deleted    |
| GA-023  | Confirm delete with data      | 1. See delete warning<br>2. Choose "Delete Anyway"   | Goal permanently deleted      |

---

## 5. Challenge Creation

### 5.1 Create Challenge

| Test ID | Test Case                          | Steps                                                            | Expected Result                          |
| ------- | ---------------------------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| CC-001  | Create challenge successfully      | 1. Navigate to Challenges<br>2. Tap Create<br>3. Fill in details | Challenge created, user is first member  |
| CC-002  | Challenge requires all fields      | 1. Try to create without title                                   | Validation error shown                   |
| CC-003  | Challenge respects active limit    | 1. At max active limit<br>2. Try to create challenge             | Error: Active limit reached              |
| CC-004  | AI generates plan for challenge    | 1. Create challenge<br>2. Check actionable_plans                 | Plan created with challenge_id           |

### 5.2 Feature Access

| Test ID | Test Case                          | Steps                                  | Expected Result                          |
| ------- | ---------------------------------- | -------------------------------------- | ---------------------------------------- |
| CC-010  | Free user cannot create challenges | 1. As Free user, try to create         | Option not visible or feature gate error |
| CC-011  | Starter can create challenges      | 1. As Starter, create challenge        | Challenge created successfully           |

---

## 6. Feature Access & Limits

### 6.1 Goal Creation Limits

| Test ID | Test Case              | Steps                                                    | Expected Result           |
| ------- | ---------------------- | -------------------------------------------------------- | ------------------------- |
| FL-001  | Free: 1 goal limit     | 1. As Free, create 1 goal<br>2. Try to create second     | Error: Goal limit reached |
| FL-002  | Starter: 3 goals limit | 1. As Starter, create 3 goals<br>2. Try to create fourth | Error: Goal limit reached |
| FL-003  | Pro/Elite: Unlimited   | 1. As Pro, create many goals                             | No limit enforced         |

### 6.2 Active Goal/Challenge Limits

| Test ID | Test Case               | Steps                                                         | Expected Result                |
| ------- | ----------------------- | ------------------------------------------------------------- | ------------------------------ |
| FL-010  | Free: 1 active item     | 1. As Free, activate 1 goal<br>2. Try to activate another     | Error: Active limit reached    |
| FL-011  | Starter: 2 active items | 1. As Starter, have 2 active<br>2. Try to activate third      | Error: Active limit reached    |
| FL-012  | Combined counting       | 1. Have 1 active goal + 1 created challenge<br>2. Count total | Both count toward active limit |

### 6.3 Challenge Join Limits

| Test ID | Test Case                      | Steps                                                  | Expected Result                   |
| ------- | ------------------------------ | ------------------------------------------------------ | --------------------------------- |
| FL-020  | Free: 1 joined challenge       | 1. As Free, join 1 challenge<br>2. Try to join another | Error: Join limit reached         |
| FL-021  | Starter: 2 joined challenges   | 1. As Starter, join 2<br>2. Try third                  | Error: Join limit reached         |
| FL-022  | Pro/Elite: 3 joined challenges | 1. As Pro, join 3<br>2. Try fourth                     | Error: Join limit reached         |
| FL-023  | Own challenges don't count     | 1. Create 1 challenge<br>2. Join another               | Join succeeds (own doesn't count) |

### 6.4 Dynamic Feature Access

| Test ID | Test Case                           | Steps                                   | Expected Result                      |
| ------- | ----------------------------------- | --------------------------------------- | ------------------------------------ |
| FL-030  | hasFeature checks database          | 1. Check hasFeature("challenge_create") | Returns correct access based on plan |
| FL-031  | Feature value returns correct limit | 1. getFeatureValue("active_goal_limit") | Returns numeric limit for plan       |
| FL-032  | Unlimited features return null      | 1. getFeatureValue("goals") for Pro     | Returns null (unlimited)             |

---

## 7. Challenge Lifecycle (Celery Tasks)

### 7.1 Challenge Ending

| Test ID | Test Case                             | Steps                                                                        | Expected Result                   |
| ------- | ------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------- |
| CL-001  | Challenge auto-deactivates            | 1. Wait for challenge end_date to pass<br>2. Run check_ended_challenges task | Challenge is_active = false       |
| CL-002  | Final ranks calculated                | 1. Challenge ends<br>2. Check participants                                   | final_rank populated for all      |
| CL-003  | Winner notification sent              | 1. Challenge ends<br>2. Check winner's notifications                         | "You Won!" push notification      |
| CL-004  | Tie notification                      | 1. Challenge ends in tie<br>2. Check notifications                           | "It's a Tie!" message             |
| CL-005  | Completion notification (non-winners) | 1. Challenge ends<br>2. Check other participants                             | "Challenge Complete" notification |

### 7.2 Challenge Reminders

| Test ID | Test Case          | Steps                                                              | Expected Result                 |
| ------- | ------------------ | ------------------------------------------------------------------ | ------------------------------- |
| CL-010  | 3-day reminder     | 1. Challenge ends in 3 days<br>2. Run check_challenges_ending_soon | "Ending Soon" notification sent |
| CL-011  | Final day reminder | 1. Challenge ends tomorrow<br>2. Run task                          | "Final Day" notification sent   |

---

## API Endpoints Summary

### Partners API (`/partners`)

| Method | Endpoint                  | Test IDs         |
| ------ | ------------------------- | ---------------- |
| GET    | `/partners`               | AP-031           |
| GET    | `/partners/pending`       | AP-022           |
| GET    | `/partners/search?query=` | AP-001 to AP-006 |
| POST   | `/partners/request`       | AP-010 to AP-013 |
| POST   | `/partners/{id}/accept`   | AP-020           |
| POST   | `/partners/{id}/reject`   | AP-021           |
| DELETE | `/partners/{id}`          | AP-030           |

### Nudges API (`/nudges`)

| Method | Endpoint               | Test IDs         |
| ------ | ---------------------- | ---------------- |
| GET    | `/nudges`              | NU-020 to NU-028 |
| GET    | `/nudges/sent`         | -                |
| GET    | `/nudges/unread-count` | NU-021           |
| POST   | `/nudges`              | NU-001 to NU-012 |
| PATCH  | `/nudges/{id}/read`    | NU-022           |
| PATCH  | `/nudges/read-all`     | NU-023           |
| DELETE | `/nudges/{id}`         | -                |

### Challenges API (`/challenges`)

| Method | Endpoint                       | Test IDs         |
| ------ | ------------------------------ | ---------------- |
| GET    | `/challenges`                  | -                |
| GET    | `/challenges/{id}`             | -                |
| POST   | `/challenges/{id}/join`        | CH-001 to CH-008 |
| POST   | `/challenges/{id}/leave`       | CH-010, CH-011   |
| POST   | `/challenges/{id}/cancel`      | CH-020 to CH-022 |
| DELETE | `/challenges/{id}`             | CH-030, CH-031   |
| POST   | `/challenges/{id}/check-in`    | CH-040 to CH-042 |
| GET    | `/challenges/{id}/leaderboard` | CH-050 to CH-052 |

### Goals API (`/goals`)

| Method | Endpoint                 | Test IDs         |
| ------ | ------------------------ | ---------------- |
| POST   | `/goals/{id}/activate`   | GA-001 to GA-003 |
| POST   | `/goals/{id}/deactivate` | GA-010, GA-011   |
| DELETE | `/goals/{id}`            | GA-020 to GA-023 |

### Challenges API (Creation)

| Method | Endpoint      | Test IDs         |
| ------ | ------------- | ---------------- |
| POST   | `/challenges` | CC-001 to CC-011 |

---

## Test Environment Setup

### Prerequisites

1. **Backend running** with Celery worker
2. **Test users** with different subscription plans:
   - Free user
   - Starter user
   - Pro user
   - Elite user
3. **Test data**:
   - Goals with various states (active, inactive, archived)
   - Challenges (public, with participants, ended)
   - Existing partnerships

### Reset Commands

```bash
# Clear test data (if needed)
# Run from apps/api directory

# Reset Celery task state
poetry run celery -A celery_worker purge

# Restart workers
poetry run celery -A celery_worker worker --beat --loglevel=info
```

---

## Notes

- Tests marked with specific plan requirements (Free, Starter, Pro, Elite) require logging in as that subscription tier
- Challenge lifecycle tests (CL-\*) require waiting for Celery beat schedule or manual task invocation
- Time-based tests may need to manipulate dates in the database for testing
