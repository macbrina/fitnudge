# Feature Documentation

This directory contains detailed documentation for each feature in the FitNudge fitness motivation app. Each document explains how the feature works, its API endpoints, database structure, and integration details.

## Features Overview

### Core MVP Features

1. **[User Onboarding & Goal Setup](01-onboarding-goal-setup.md)**
   - Personalization flow
   - AI goal suggestions
   - Goal creation with dynamic limits
   - Active goal management

2. **[Check-In System](02-check-in-system.md)**
   - Daily check-ins
   - Mood tracking
   - Progress photos
   - Automatic achievement unlocking

3. **[Progress Tracking](03-progress-tracking.md)**
   - Goal statistics
   - Habit chains visualization
   - Streak calculation
   - Progress photos timeline

4. **[AI Motivation & Smart Reminders](04-ai-motivation-reminders.md)**
   - AI-generated motivational messages
   - Smart reminder scheduling
   - Timezone handling
   - Custom reminder messages

5. **[Social Feed](05-social-feed.md)**
   - Combined AI and community feed
   - Text and voice posts
   - Like & cheer system
   - Comments and following

6. **[Achievement Badges](06-achievement-badges.md)**
   - Automatic badge unlocking
   - Streak and check-in achievements
   - Achievement statistics
   - Badge gallery

7. **[Weekly Recaps](07-weekly-recaps.md)**
   - AI-generated weekly summaries
   - Progress statistics
   - Motivational insights
   - Scheduled generation

8. **[Community Challenges](08-community-challenges.md)**
   - Challenge creation and joining
   - Leaderboard tracking
   - Progress updates
   - Challenge types

9. **[Habit Chains](09-habit-chains.md)**
   - Visual streak visualization
   - Automatic chain updates
   - Database trigger-based
   - Calendar display

10. **[Social Accountability](10-social-accountability.md)**
    - Goal sharing with permissions
    - Accountability partners
    - Collaborative progress tracking

11. **[Meal Tracking](11-meal-tracking.md)**
    - Meal logging with nutrition data
    - Daily nutrition summaries
    - Photo attachments
    - Goal association

12. **[AI Progress Reflections](12-ai-progress-reflections.md)**
    - Premium deep analysis (Pro/Elite only)
    - Weekly and monthly reflections
    - Actionable coaching recommendations
    - Pattern analysis

## Document Structure

Each feature document includes:

- **Overview**: High-level description of the feature
- **Features**: Detailed breakdown of feature components
- **API Endpoints**: All relevant endpoints with request/response examples
- **Database Tables**: Database schema and relationships
- **Implementation Details**: Code structure and key files
- **Flow Diagrams**: Visual representation of feature workflows
- **Frontend Integration**: Mobile app components and screens

## Related Documentation

- **[API Specification](../API-Spec.md)**: Complete API endpoint reference
- **[Data Models](../DataModels.md)**: Database schema documentation
- **[Architecture](../Architecture.md)**: System architecture and design patterns
- **[Project Overview](../ProjectOverview.md)**: Product vision and feature roadmap

## Quick Reference

### API Endpoints by Feature

| Feature        | Main Endpoints                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| Onboarding     | `POST /onboarding/profile`, `GET /onboarding/suggested-goals`                                                 |
| Goals          | `POST /goals`, `GET /goals`, `PUT /goals/{id}`, `DELETE /goals/{id}`                                          |
| Check-Ins      | `POST /check-ins`, `GET /check-ins`, `GET /check-ins/stats`                                                   |
| Progress       | `GET /goals/{id}/stats`, `GET /goals/{id}/habit-chains`                                                       |
| Motivation     | `POST /motivation/generate`, `POST /motivation/schedule`                                                      |
| Social         | `GET /social/feed`, `POST /social/posts`, `POST /social/posts/{id}/like`                                      |
| Achievements   | `GET /achievements/types`, `GET /achievements/me`, `POST /achievements/check`                                 |
| Recaps         | `GET /recaps/weekly`                                                                                          |
| Challenges     | `GET /challenges`, `POST /challenges/{id}/join`, `GET /challenges/{id}/leaderboard`                           |
| Accountability | `POST /social-accountability/goals/{id}/share`, `POST /social-accountability/accountability-partners/request` |
| Meals          | `POST /meals`, `GET /meals/nutrition/summary/{date}`                                                          |
| Reflections    | `GET /progress-reflections/weekly`, `GET /progress-reflections/monthly`                                       |

### Database Tables by Feature

| Feature        | Main Tables                                                     |
| -------------- | --------------------------------------------------------------- |
| Onboarding     | `user_fitness_profiles`, `goals`                                |
| Check-Ins      | `check_ins`, `progress_photos`                                  |
| Progress       | `habit_chains`                                                  |
| Motivation     | `motivations`                                                   |
| Social         | `posts`, `comments`, `likes`, `follows`, `feed_preferences`     |
| Achievements   | `achievement_types`, `user_achievements`                        |
| Challenges     | `challenges`, `challenge_participants`, `challenge_leaderboard` |
| Accountability | `goal_shares`, `accountability_partners`                        |
| Meals          | `meal_logs`, `daily_nutrition_summaries`                        |

## Contributing

When adding new features:

1. Create a new markdown file following the naming convention: `XX-feature-name.md`
2. Follow the document structure used in existing files
3. Include API endpoints, database tables, and implementation details
4. Add flow diagrams for complex workflows
5. Update this README with the new feature

## Notes

- All features are documented based on current implementation
- API endpoints may evolve; refer to [API-Spec.md](../API-Spec.md) for latest details
- Database schema may change; refer to [DataModels.md](../DataModels.md) for current schema
- Frontend integration details are at the screen/component level
