export interface FitnessProfile {
  biological_sex?: string; // 'male', 'female', 'prefer_not_to_say'
  fitness_level: string;
  primary_goal: string;
  current_frequency: string;
  preferred_location: string;
  available_time: string;
  motivation_style: string;
  biggest_challenge: string;
  available_equipment?: string[];
}

// Equipment options for onboarding
export type EquipmentType =
  | "none"
  | "resistance_band"
  | "dumbbell"
  | "kettlebell"
  | "pull_up_bar"
  | "yoga_mat"
  | "barbell"
  | "bench"
  | "cable_machine";
