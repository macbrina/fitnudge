/**
 * Personalization Constants
 * Options and labels for user fitness profile settings
 *
 * labelKey: Used in settings screens (short form)
 * onboardingLabelKey: Used in onboarding flow (detailed form)
 */

// Fitness Level
export const FITNESS_LEVELS = [
  {
    value: "beginner",
    labelKey: "personalization.fitness_level_beginner",
    onboardingLabelKey: "onboarding.personalization.fitness_level.beginner.title"
  },
  {
    value: "intermediate",
    labelKey: "personalization.fitness_level_intermediate",
    onboardingLabelKey: "onboarding.personalization.fitness_level.intermediate.title"
  },
  {
    value: "advanced",
    labelKey: "personalization.fitness_level_advanced",
    onboardingLabelKey: "onboarding.personalization.fitness_level.advanced.title"
  },
  {
    value: "athlete",
    labelKey: "personalization.fitness_level_athlete",
    onboardingLabelKey: "onboarding.personalization.fitness_level.athlete.title"
  }
] as const;

// Primary Goal
export const PRIMARY_GOALS = [
  {
    value: "lose_weight",
    labelKey: "personalization.goal_lose_weight",
    onboardingLabelKey: "onboarding.personalization.primary_goal.lose_weight.title",
    icon: "flame-outline"
  },
  {
    value: "build_muscle",
    labelKey: "personalization.goal_build_muscle",
    onboardingLabelKey: "onboarding.personalization.primary_goal.build_muscle.title",
    icon: "barbell-outline"
  },
  {
    value: "stay_active",
    labelKey: "personalization.goal_stay_active",
    onboardingLabelKey: "onboarding.personalization.primary_goal.stay_active.title",
    icon: "walk-outline"
  },
  {
    value: "general_fitness",
    labelKey: "personalization.goal_general_fitness",
    onboardingLabelKey: "onboarding.personalization.primary_goal.general_fitness.title",
    icon: "fitness-outline"
  },
  {
    value: "sport_specific",
    labelKey: "personalization.goal_sport_specific",
    onboardingLabelKey: "onboarding.personalization.primary_goal.sport_specific.title",
    icon: "trophy-outline"
  }
] as const;

// Current Frequency
export const CURRENT_FREQUENCIES = [
  {
    value: "never",
    labelKey: "personalization.frequency_never",
    onboardingLabelKey: "onboarding.personalization.current_habits.never.title"
  },
  {
    value: "1-2x_week",
    labelKey: "personalization.frequency_1_2x",
    onboardingLabelKey: "onboarding.personalization.current_habits.1-2x_week.title"
  },
  {
    value: "3-4x_week",
    labelKey: "personalization.frequency_3_4x",
    onboardingLabelKey: "onboarding.personalization.current_habits.3-4x_week.title"
  },
  {
    value: "5+_week",
    labelKey: "personalization.frequency_5_plus",
    onboardingLabelKey: "onboarding.personalization.current_habits.5+_week.title"
  },
  {
    value: "daily",
    labelKey: "personalization.frequency_daily",
    onboardingLabelKey: "onboarding.personalization.current_habits.daily.title"
  }
] as const;

// Preferred Location
export const PREFERRED_LOCATIONS = [
  {
    value: "gym",
    labelKey: "personalization.location_gym",
    onboardingLabelKey: "onboarding.personalization.workout_setting.gym.title",
    icon: "business-outline"
  },
  {
    value: "home",
    labelKey: "personalization.location_home",
    onboardingLabelKey: "onboarding.personalization.workout_setting.home.title",
    icon: "home-outline"
  },
  {
    value: "outdoor",
    labelKey: "personalization.location_outdoor",
    onboardingLabelKey: "onboarding.personalization.workout_setting.outdoor.title",
    icon: "leaf-outline"
  },
  {
    value: "mix",
    labelKey: "personalization.location_mix",
    onboardingLabelKey: "onboarding.personalization.workout_setting.mix.title",
    icon: "shuffle-outline"
  },
  {
    value: "dont_know",
    labelKey: "personalization.location_dont_know",
    onboardingLabelKey: "onboarding.personalization.workout_setting.dont_know.title",
    icon: "help-circle-outline"
  }
] as const;

// Available Time
export const AVAILABLE_TIMES = [
  {
    value: "less_30min",
    labelKey: "personalization.time_less_30",
    onboardingLabelKey: "onboarding.personalization.available_time.less_30min.title"
  },
  {
    value: "30-60min",
    labelKey: "personalization.time_30_60",
    onboardingLabelKey: "onboarding.personalization.available_time.30-60min.title"
  },
  {
    value: "1-2hrs",
    labelKey: "personalization.time_1_2hrs",
    onboardingLabelKey: "onboarding.personalization.available_time.1-2hrs.title"
  },
  {
    value: "flexible",
    labelKey: "personalization.time_flexible",
    onboardingLabelKey: "onboarding.personalization.available_time.flexible.title"
  }
] as const;

// Motivation Style
export const MOTIVATION_STYLES = [
  {
    value: "tough_love",
    labelKey: "personalization.motivation_tough_love",
    onboardingLabelKey: "onboarding.personalization.motivation_style.tough_love.title",
    icon: "flash-outline"
  },
  {
    value: "gentle_encouragement",
    labelKey: "personalization.motivation_gentle",
    onboardingLabelKey: "onboarding.personalization.motivation_style.gentle_encouragement.title",
    icon: "heart-outline"
  },
  {
    value: "data_driven",
    labelKey: "personalization.motivation_data",
    onboardingLabelKey: "onboarding.personalization.motivation_style.data_driven.title",
    icon: "analytics-outline"
  },
  {
    value: "accountability_buddy",
    labelKey: "personalization.motivation_buddy",
    onboardingLabelKey: "onboarding.personalization.motivation_style.accountability_buddy.title",
    icon: "people-outline"
  }
] as const;

// Biggest Challenge
export const BIGGEST_CHALLENGES = [
  {
    value: "time_management",
    labelKey: "personalization.challenge_time",
    onboardingLabelKey: "onboarding.personalization.biggest_challenge.time_management.title"
  },
  {
    value: "lack_of_motivation",
    labelKey: "personalization.challenge_motivation",
    onboardingLabelKey: "onboarding.personalization.biggest_challenge.lack_of_motivation.title"
  },
  {
    value: "not_knowing_what_to_do",
    labelKey: "personalization.challenge_not_knowing",
    onboardingLabelKey: "onboarding.personalization.biggest_challenge.not_knowing_what_to_do.title"
  },
  {
    value: "consistency",
    labelKey: "personalization.challenge_consistency",
    onboardingLabelKey: "onboarding.personalization.biggest_challenge.consistency.title"
  },
  {
    value: "accountability",
    labelKey: "personalization.challenge_accountability",
    onboardingLabelKey: "onboarding.personalization.biggest_challenge.accountability.title"
  },
  {
    value: "injury_concerns",
    labelKey: "personalization.challenge_injury",
    onboardingLabelKey: "onboarding.personalization.biggest_challenge.injury_concerns.title"
  }
] as const;

// Available Equipment
// Note: Onboarding only uses a subset of equipment options
export const AVAILABLE_EQUIPMENT = [
  {
    value: "none",
    labelKey: "personalization.equipment_none",
    onboardingLabelKey: "onboarding.personalization.equipment.none.title",
    icon: "close-circle-outline",
    exclusive: true
  },
  {
    value: "resistance_band",
    labelKey: "personalization.equipment_resistance_band",
    onboardingLabelKey: "onboarding.personalization.equipment.resistance_band.title",
    icon: "resize-outline"
  },
  {
    value: "dumbbell",
    labelKey: "personalization.equipment_dumbbell",
    onboardingLabelKey: "onboarding.personalization.equipment.dumbbell.title",
    icon: "barbell-outline"
  },
  {
    value: "kettlebell",
    labelKey: "personalization.equipment_kettlebell",
    onboardingLabelKey: "onboarding.personalization.equipment.kettlebell.title",
    icon: "fitness-outline"
  },
  {
    value: "pull_up_bar",
    labelKey: "personalization.equipment_pull_up_bar",
    onboardingLabelKey: "onboarding.personalization.equipment.pull_up_bar.title",
    icon: "arrow-up-outline"
  },
  {
    value: "yoga_mat",
    labelKey: "personalization.equipment_yoga_mat",
    onboardingLabelKey: "onboarding.personalization.equipment.yoga_mat.title",
    icon: "body-outline"
  },
  {
    value: "barbell",
    labelKey: "personalization.equipment_barbell",
    onboardingLabelKey: "onboarding.personalization.equipment.barbell.title",
    icon: "barbell-outline"
  },
  {
    value: "bench",
    labelKey: "personalization.equipment_bench",
    onboardingLabelKey: "onboarding.personalization.equipment.bench.title",
    icon: "bed-outline"
  },
  {
    value: "cable_machine",
    labelKey: "personalization.equipment_cable_machine",
    onboardingLabelKey: "onboarding.personalization.equipment.cable_machine.title",
    icon: "git-pull-request-outline"
  },
  {
    value: "treadmill",
    labelKey: "personalization.equipment_treadmill",
    onboardingLabelKey: "onboarding.personalization.equipment.treadmill.title",
    icon: "walk-outline"
  },
  {
    value: "stationary_bike",
    labelKey: "personalization.equipment_bike",
    onboardingLabelKey: "onboarding.personalization.equipment.stationary_bike.title",
    icon: "bicycle-outline"
  },
  {
    value: "rowing_machine",
    labelKey: "personalization.equipment_rowing",
    onboardingLabelKey: "onboarding.personalization.equipment.rowing_machine.title",
    icon: "boat-outline"
  },
  {
    value: "foam_roller",
    labelKey: "personalization.equipment_foam_roller",
    onboardingLabelKey: "onboarding.personalization.equipment.foam_roller.title",
    icon: "ellipse-outline"
  },
  {
    value: "jump_rope",
    labelKey: "personalization.equipment_jump_rope",
    onboardingLabelKey: "onboarding.personalization.equipment.jump_rope.title",
    icon: "pulse-outline"
  },
  {
    value: "medicine_ball",
    labelKey: "personalization.equipment_medicine_ball",
    onboardingLabelKey: "onboarding.personalization.equipment.medicine_ball.title",
    icon: "ellipse-outline"
  }
] as const;

// Biological Sex
export const BIOLOGICAL_SEX_OPTIONS = [
  {
    value: "male",
    labelKey: "personalization.sex_male",
    onboardingLabelKey: "onboarding.personalization.biological_sex.male.title",
    icon: "male-outline"
  },
  {
    value: "female",
    labelKey: "personalization.sex_female",
    onboardingLabelKey: "onboarding.personalization.biological_sex.female.title",
    icon: "female-outline"
  },
  {
    value: "prefer_not_to_say",
    labelKey: "personalization.sex_prefer_not",
    onboardingLabelKey: "onboarding.personalization.biological_sex.prefer_not_to_say.title",
    icon: "remove-circle-outline"
  }
] as const;

// Hydration Unit
export const HYDRATION_UNITS = [
  { value: "ml", labelKey: "personalization.hydration_ml" },
  { value: "oz", labelKey: "personalization.hydration_oz" }
] as const;

// Hydration Targets (in ml)
export const HYDRATION_TARGETS = [
  { value: 1500, labelMl: "1.5L (6 glasses)", labelOz: "50 oz" },
  { value: 2000, labelMl: "2L (8 glasses)", labelOz: "67 oz" },
  { value: 2500, labelMl: "2.5L (10 glasses)", labelOz: "84 oz" },
  { value: 3000, labelMl: "3L (12 glasses)", labelOz: "100 oz" },
  { value: 3500, labelMl: "3.5L (14 glasses)", labelOz: "118 oz" },
  { value: 4000, labelMl: "4L (16 glasses)", labelOz: "135 oz" }
] as const;

// Helper functions
export const getFitnessLevelByValue = (value: string) =>
  FITNESS_LEVELS.find((l) => l.value === value);

export const getPrimaryGoalByValue = (value: string) =>
  PRIMARY_GOALS.find((g) => g.value === value);

export const getFrequencyByValue = (value: string) =>
  CURRENT_FREQUENCIES.find((f) => f.value === value);

export const getLocationByValue = (value: string) =>
  PREFERRED_LOCATIONS.find((l) => l.value === value);

export const getTimeByValue = (value: string) => AVAILABLE_TIMES.find((t) => t.value === value);

export const getMotivationByValue = (value: string) =>
  MOTIVATION_STYLES.find((m) => m.value === value);

export const getChallengeByValue = (value: string) =>
  BIGGEST_CHALLENGES.find((c) => c.value === value);

export const getEquipmentByValue = (value: string) =>
  AVAILABLE_EQUIPMENT.find((e) => e.value === value);

export const getBiologicalSexByValue = (value: string) =>
  BIOLOGICAL_SEX_OPTIONS.find((s) => s.value === value);

export const getHydrationUnitByValue = (value: string) =>
  HYDRATION_UNITS.find((u) => u.value === value);

export const getHydrationTargetByValue = (value: number) =>
  HYDRATION_TARGETS.find((t) => t.value === value);

// Type exports
export type FitnessLevel = (typeof FITNESS_LEVELS)[number]["value"];
export type PrimaryGoal = (typeof PRIMARY_GOALS)[number]["value"];
export type CurrentFrequency = (typeof CURRENT_FREQUENCIES)[number]["value"];
export type PreferredLocation = (typeof PREFERRED_LOCATIONS)[number]["value"];
export type AvailableTime = (typeof AVAILABLE_TIMES)[number]["value"];
export type MotivationStyle = (typeof MOTIVATION_STYLES)[number]["value"];
export type BiggestChallenge = (typeof BIGGEST_CHALLENGES)[number]["value"];
export type EquipmentItem = (typeof AVAILABLE_EQUIPMENT)[number]["value"];
export type BiologicalSex = (typeof BIOLOGICAL_SEX_OPTIONS)[number]["value"];
export type HydrationUnit = (typeof HYDRATION_UNITS)[number]["value"];
