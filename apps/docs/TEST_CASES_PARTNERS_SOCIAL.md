# Test Cases: Partners & Social Features

This document contains test cases for verifying the accountability partner and social features in FitNudge.

---

## Table of Contents

1. [Accountability Partners](#1-accountability-partners)
2. [Nudges & Cheers](#2-nudges--cheers)
3. [Partner Blocking & Reporting](#3-partner-blocking--reporting)
4. [Goal Management](#4-goal-management)
5. [Feature Access & Limits](#5-feature-access--limits)

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

## 2. Nudges & Cheers

### 2.1 Send Nudge

| Test ID | Test Case                    | Steps                                                                 | Expected Result                    |
| ------- | ---------------------------- | --------------------------------------------------------------------- | ---------------------------------- |
| NU-001  | Send nudge to partner        | 1. Find NudgeButton component<br>2. Tap nudge<br>3. Confirm in dialog | Success alert, nudge sent          |
| NU-002  | Send nudge with goal context | 1. Send nudge from goal screen                                        | Nudge includes goal_id reference   |
| NU-003  | Nudge button shows loading   | 1. Tap nudge and wait                                                 | Button shows spinner while sending |

### 2.2 Send Cheer

| Test ID | Test Case                | Steps                                           | Expected Result                   |
| ------- | ------------------------ | ----------------------------------------------- | --------------------------------- |
| NU-010  | Send cheer on check-in   | 1. Find CheerButton on check-in<br>2. Tap cheer | Heart animates, turns filled/gold |
| NU-011  | Cannot cheer twice       | 1. Cheer on a check-in<br>2. Try to cheer again | Button disabled after first cheer |
| NU-012  | Cheer with initial state | 1. View check-in already cheered                | Button shows filled heart state   |

### 2.3 Cheer Back from Notification

| Test ID | Test Case                | Steps                                                              | Expected Result                     |
| ------- | ------------------------ | ------------------------------------------------------------------ | ----------------------------------- |
| NU-015  | Cheer back action button | 1. Receive partner check-in notification<br>2. Tap "👏 Cheer Back" | Cheer sent without opening app      |
| NU-016  | Cheer back updates UI    | 1. Cheer back from notification<br>2. Open app                     | Partner's check-in shows your cheer |

### 2.4 View Nudges

| Test ID | Test Case                 | Steps                                  | Expected Result                       |
| ------- | ------------------------- | -------------------------------------- | ------------------------------------- |
| NU-020  | View nudges list          | 1. Navigate to Notifications screen    | All received nudges displayed         |
| NU-021  | Unread nudges highlighted | 1. Receive new nudge<br>2. View nudges | Unread nudges have visual indicator   |
| NU-022  | Mark nudge as read        | 1. Tap on unread nudge                 | Nudge marked as read, styling changes |
| NU-023  | Navigate from nudge       | 1. Tap nudge with goal context         | Navigates to goal details             |
| NU-024  | Empty state               | 1. View nudges with no nudges          | Empty state message shown             |
| NU-025  | Time ago formatting       | 1. View nudge from 5 minutes ago       | Shows "5 minutes ago"                 |
| NU-026  | Pull to refresh           | 1. Pull down on nudges list            | List refreshes with latest nudges     |

---

## 3. Partner Blocking & Reporting

### 3.1 Block Partner

| Test ID | Test Case                    | Steps                                                | Expected Result                   |
| ------- | ---------------------------- | ---------------------------------------------------- | --------------------------------- |
| BL-001  | Block partner from list      | 1. View partner<br>2. Tap menu<br>3. Select Block    | Partner removed, added to blocked |
| BL-002  | Blocked user cannot interact | 1. Block user<br>2. User tries to send request       | Request fails, user sees blocked  |
| BL-003  | View blocked partners        | 1. Navigate to Blocked Partners screen               | List of blocked users displayed   |
| BL-004  | Unblock partner              | 1. View blocked list<br>2. Tap Unblock<br>3. Confirm | User removed from blocked list    |
| BL-005  | Optimistic unblock           | 1. Tap unblock                                       | UI updates immediately before API |

### 3.2 Report User

| Test ID | Test Case                     | Steps                                                          | Expected Result                   |
| ------- | ----------------------------- | -------------------------------------------------------------- | --------------------------------- |
| RP-001  | Report inappropriate username | 1. View user<br>2. Tap Report<br>3. Select reason<br>4. Submit | Report submitted, success message |
| RP-002  | Report with details           | 1. Select "Other" reason<br>2. Add details                     | Details included in report        |
| RP-003  | Cannot report twice           | 1. Report user<br>2. Try to report again                       | Error or disabled option          |

---

## 4. Goal Management

### 4.1 Create Goal

| Test ID | Test Case                 | Steps                                                | Expected Result                     |
| ------- | ------------------------- | ---------------------------------------------------- | ----------------------------------- |
| GA-001  | Create goal from template | 1. Tap Create Goal<br>2. Select template<br>3. Save  | Goal created with template settings |
| GA-002  | Create custom goal        | 1. Tap Create Goal<br>2. Enter custom details        | Goal created with custom settings   |
| GA-003  | Goal limit (Free)         | 1. As Free user with 1 goal<br>2. Try to create more | Error: Goal limit reached           |
| GA-004  | Unlimited goals (Premium) | 1. As Premium user<br>2. Create multiple goals       | No limit enforced                   |

### 4.2 Goal Check-in

| Test ID | Test Case                  | Steps                                             | Expected Result                       |
| ------- | -------------------------- | ------------------------------------------------- | ------------------------------------- |
| GA-010  | Check-in Yes               | 1. Open goal<br>2. Tap Check-in<br>3. Select Yes  | Check-in recorded, streak updated     |
| GA-011  | Check-in No                | 1. Select No with skip reason                     | Check-in recorded, streak reset       |
| GA-012  | Check-in Rest Day          | 1. Select Rest Day                                | Check-in recorded, streak preserved   |
| GA-013  | Check-in with voice note   | 1. Record voice note<br>2. Submit check-in        | Voice note uploaded and saved         |
| GA-014  | Check-in from notification | 1. Tap Yes/No/Rest Day on push notification       | Check-in recorded without opening app |
| GA-015  | Cannot check-in twice      | 1. Check-in for today<br>2. Try to check-in again | Error: Already checked in today       |

### 4.3 Goal Settings

| Test ID | Test Case            | Steps                                            | Expected Result            |
| ------- | -------------------- | ------------------------------------------------ | -------------------------- |
| GA-020  | Edit goal            | 1. Open goal<br>2. Tap Edit<br>3. Change details | Goal updated               |
| GA-021  | Change reminder time | 1. Edit goal<br>2. Change reminder times         | New reminders scheduled    |
| GA-022  | Pause goal           | 1. Open goal<br>2. Tap Pause                     | Goal paused, no reminders  |
| GA-023  | Archive goal         | 1. Open goal<br>2. Tap Archive                   | Goal archived, not visible |
| GA-024  | Delete goal          | 1. Open goal<br>2. Tap Delete<br>3. Confirm      | Goal permanently deleted   |

---

## 5. Feature Access & Limits

### 5.1 Free vs Premium Features

| Test ID | Test Case                 | Steps                                      | Expected Result             |
| ------- | ------------------------- | ------------------------------------------ | --------------------------- |
| FL-001  | Free: 1 goal limit        | 1. As Free, create 1 goal<br>2. Try second | Error: Goal limit reached   |
| FL-002  | Free: No partners         | 1. As Free, try to add partner             | Upgrade prompt shown        |
| FL-003  | Free: Template motivation | 1. Check-in as Free user                   | Template response shown     |
| FL-004  | Premium: Unlimited goals  | 1. As Premium, create many goals           | No limit enforced           |
| FL-005  | Premium: AI motivation    | 1. Check-in as Premium user                | AI-generated response shown |
| FL-006  | Premium: Voice notes      | 1. As Premium, record voice note           | Voice note saved            |
| FL-007  | Premium: Analytics        | 1. As Premium, view Analytics              | Charts displayed            |
| FL-008  | Free: Analytics locked    | 1. As Free, view Analytics                 | Blurred with upgrade prompt |

### 5.2 Subscription Changes

| Test ID | Test Case              | Steps                               | Expected Result                   |
| ------- | ---------------------- | ----------------------------------- | --------------------------------- |
| FL-010  | Upgrade to Premium     | 1. As Free, purchase Premium        | All features unlocked immediately |
| FL-011  | Downgrade from Premium | 1. As Premium, subscription expires | Features locked, 1 goal limit     |
| FL-012  | Grace period           | 1. Subscription in grace period     | Premium features still available  |

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
| POST   | `/partners/{id}/block`    | BL-001, BL-002   |
| DELETE | `/partners/{id}`          | AP-030           |

### Blocked Partners API

| Method | Endpoint                 | Test IDs       |
| ------ | ------------------------ | -------------- |
| GET    | `/partners/blocked`      | BL-003         |
| POST   | `/partners/{id}/unblock` | BL-004, BL-005 |

### Reports API

| Method | Endpoint             | Test IDs         |
| ------ | -------------------- | ---------------- |
| POST   | `/users/{id}/report` | RP-001 to RP-003 |

### Nudges API (`/nudges`)

| Method | Endpoint               | Test IDs         |
| ------ | ---------------------- | ---------------- |
| GET    | `/nudges`              | NU-020 to NU-026 |
| GET    | `/nudges/unread-count` | NU-021           |
| POST   | `/nudges`              | NU-001 to NU-003 |
| POST   | `/nudges/cheer`        | NU-010 to NU-016 |
| PATCH  | `/nudges/{id}/read`    | NU-022           |

### Goals API (`/goals`)

| Method | Endpoint              | Test IDs         |
| ------ | --------------------- | ---------------- |
| GET    | `/goals`              | GA-001 to GA-004 |
| POST   | `/goals`              | GA-001 to GA-004 |
| GET    | `/goals/{id}`         | -                |
| PUT    | `/goals/{id}`         | GA-020, GA-021   |
| DELETE | `/goals/{id}`         | GA-024           |
| POST   | `/goals/{id}/pause`   | GA-022           |
| POST   | `/goals/{id}/archive` | GA-023           |

### Check-ins API (`/check-ins`)

| Method | Endpoint                | Test IDs         |
| ------ | ----------------------- | ---------------- |
| GET    | `/check-ins`            | -                |
| POST   | `/check-ins`            | GA-010 to GA-015 |
| POST   | `/check-ins/{id}/voice` | GA-013           |

---

## Test Environment Setup

### Prerequisites

1. **Backend running** with Celery worker
2. **Test users** with different subscription plans:
   - Free user
   - Premium user
3. **Test data**:
   - Goals with various states (active, paused, archived)
   - Existing partnerships
   - Check-in history

### Reset Commands

```bash
# Run from apps/api directory

# Reset Celery task state
poetry run celery -A celery_worker purge

# Restart workers
poetry run celery -A celery_worker worker --beat --loglevel=info
```

---

## Notes

- Tests marked with specific plan requirements (Free, Premium) require logging in as that subscription tier
- Notification action button tests (NU-015, GA-014) require testing on a physical device
- Voice note tests (GA-013) require microphone permissions
