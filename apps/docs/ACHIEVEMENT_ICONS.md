# Achievement Icons - Flaticon Search Guide

Use [Flaticon](https://www.flaticon.com/) to find icons for each achievement. Search for the suggested terms and download as **PNG (256px or 512px)**.

## Storage Location

**Cloudflare R2 CDN:** `https://media.fitnudge.app/badges/`

## Naming Convention

Save icons as: `{badge_key}.png` (e.g., `first_workout.png`)
Upload to: Cloudflare R2 bucket at `/badges/{badge_key}.png`

The database stores the full URL: `https://media.fitnudge.app/badges/{badge_key}.png`

---

## Workout Count Milestones

| Badge Key       | Badge Name         | Suggested Flaticon Search                            | Notes                            |
| --------------- | ------------------ | ---------------------------------------------------- | -------------------------------- |
| `first_workout` | First Workout      | `first medal`, `start fitness`, `number one badge`   | Simple "1" or first place ribbon |
| `workout_10`    | Getting Stronger   | `muscle growth`, `strength`, `flexing arm`           | Bicep/muscle icon                |
| `workout_25`    | Fitness Enthusiast | `fitness lover`, `heart dumbbell`, `passion gym`     | Heart + dumbbell combo           |
| `workout_50`    | Dedicated Athlete  | `athlete medal`, `sports trophy`, `dedication`       | Gold medal or trophy             |
| `workout_100`   | Fitness Legend     | `legend crown`, `champion trophy`, `gold star badge` | Crown or legendary badge         |

---

## Perfect Workout (No Skips)

| Badge Key            | Badge Name    | Suggested Flaticon Search                             | Notes                                  |
| -------------------- | ------------- | ----------------------------------------------------- | -------------------------------------- |
| `perfect_workout`    | Flawless      | `perfect checkmark`, `diamond badge`, `flawless star` | Diamond or perfect checkmark           |
| `perfect_workout_5`  | Perfectionist | `perfectionist`, `excellence badge`, `five stars`     | Multiple stars or perfection symbol    |
| `perfect_workout_10` | Excellence    | `excellence award`, `premium badge`, `mastery`        | Crown with laurel or excellence emblem |

---

## Time-Based Achievements

| Badge Key       | Badge Name          | Suggested Flaticon Search                             | Notes                         |
| --------------- | ------------------- | ----------------------------------------------------- | ----------------------------- |
| `early_bird`    | Early Bird          | `early bird`, `sunrise`, `morning workout`, `rooster` | Bird with sun or sunrise      |
| `night_owl`     | Night Owl           | `night owl`, `moon workout`, `owl`                    | Owl or moon icon              |
| `lunch_warrior` | Lunch Break Warrior | `lunch break`, `clock workout`, `midday sun`          | Clock with sun or lunch break |

---

## Duration Achievements

| Badge Key          | Badge Name       | Suggested Flaticon Search                                   | Notes                             |
| ------------------ | ---------------- | ----------------------------------------------------------- | --------------------------------- |
| `marathon_session` | Marathon Session | `marathon`, `stopwatch`, `long run`, `timer badge`          | Stopwatch or running figure       |
| `endurance_master` | Endurance Master | `endurance`, `stamina`, `long distance`, `infinity fitness` | Infinity symbol or endurance icon |

---

## Streak Achievements (Workout-Specific)

| Badge Key           | Badge Name       | Suggested Flaticon Search                                | Notes                            |
| ------------------- | ---------------- | -------------------------------------------------------- | -------------------------------- |
| `workout_streak_3`  | Three Day Focus  | `three days`, `calendar streak`, `fire 3`                | Flame with "3" or 3-day calendar |
| `workout_streak_7`  | Week of Gains    | `week streak`, `7 days`, `fire calendar`, `weekly flame` | Flame with "7" or week calendar  |
| `workout_streak_14` | Two Week Warrior | `two weeks`, `14 days`, `warrior badge`, `shield flame`  | Shield with flame                |
| `workout_streak_30` | Month of Iron    | `month streak`, `30 days`, `iron badge`, `metal flame`   | Iron/metal themed flame          |

---

## Program Progression

| Badge Key          | Badge Name        | Suggested Flaticon Search                                   | Notes                         |
| ------------------ | ----------------- | ----------------------------------------------------------- | ----------------------------- |
| `program_week_2`   | Level Up          | `level up`, `progress arrow`, `upgrade badge`               | Arrow pointing up             |
| `program_week_3`   | Building Momentum | `momentum`, `speed lines`, `rocket progress`                | Rocket or momentum lines      |
| `program_week_4`   | Almost There      | `almost done`, `finish line`, `target close`                | Target nearly hit             |
| `program_complete` | Program Graduate  | `graduation cap`, `diploma badge`, `completion certificate` | Graduation cap or certificate |

---

## Weekly Consistency

| Badge Key          | Badge Name       | Suggested Flaticon Search                           | Notes                          |
| ------------------ | ---------------- | --------------------------------------------------- | ------------------------------ |
| `weekly_warrior_3` | Weekly Warrior   | `warrior shield`, `3 workouts`, `weekly badge`      | Shield with checkmarks         |
| `weekly_warrior_5` | Fitness Fanatic  | `fanatic badge`, `5 workouts`, `fire passion`       | Fire with enthusiasm           |
| `weekly_warrior_7` | Seven Day Strong | `7 day challenge`, `full week`, `complete calendar` | Full week calendar with checks |

---

## General Streaks & Check-ins (Legacy)

| Badge Key       | Badge Name           | Suggested Flaticon Search                           | Notes                     |
| --------------- | -------------------- | --------------------------------------------------- | ------------------------- |
| `first_checkin` | Getting Started      | `start flag`, `begin journey`, `first step`         | Starting flag or footstep |
| `streak_3`      | Three Day Streak     | `3 day flame`, `fire streak`, `hot streak`          | Small flame               |
| `streak_7`      | Week Warrior         | `week warrior`, `7 day fire`, `warrior`             | Warrior helmet or shield  |
| `streak_30`     | Month Master         | `month master`, `30 day crown`, `master badge`      | Crown or master symbol    |
| `streak_100`    | Century Club         | `100 badge`, `century`, `hundred medal`             | "100" badge or diamond    |
| `checkins_50`   | Consistency Champion | `champion badge`, `consistency`, `trophy star`      | Trophy with star          |
| `checkins_100`  | Hundred Hero         | `hero badge`, `100 hero`, `superhero`               | Hero cape or emblem       |
| `first_goal`    | Goal Setter          | `goal target`, `aim badge`, `bullseye`              | Target/bullseye           |
| `perfect_week`  | Perfect Week         | `perfect calendar`, `7 checkmarks`, `complete week` | Calendar with all checks  |

---

## Icon Style Guidelines

1. **Color Scheme by Rarity:**
   - Common: Gray/Silver tones (#6B7280, #9CA3AF)
   - Rare: Blue tones (#3B82F6, #60A5FA)
   - Epic: Purple tones (#8B5CF6, #A78BFA)
   - Legendary: Gold/Orange tones (#F59E0B, #FBBF24)

2. **Style Recommendations:**
   - Use filled (not outline) icons for better visibility
   - Choose icons with consistent line thickness
   - Prefer icons without text (numbers are OK)
   - Look for "badge", "medal", or "award" style frames

3. **Flaticon Filters:**
   - Style: `Flat` or `Lineal color`
   - Color: Match rarity colors above
   - Premium: Many free options available, but premium icons are often higher quality

4. **File Format:**
   - Download as PNG at 256x256 or 512x512
   - Transparent background preferred

---

## Implementation Checklist

- [ ] Download all 28 achievement icons from Flaticon
- [ ] Name files as `{badge_key}.png` (e.g., `first_workout.png`)
- [ ] Upload to Cloudflare R2 bucket at `/badges/`
- [x] Migration adds `badge_icon` column with CDN URLs
- [x] AchievementUnlockedScreen renders Image from CDN URL
- [x] Fallback to Ionicons if image fails to load
- [ ] Test all achievements display correctly
