export const MOTIVATION_STYLES = [
  {
    value: "supportive",
    labelKey: "onboarding.motivation_style.supportive.title",
    descriptionKey: "onboarding.motivation_style.supportive.description",
    emoji: "🤗"
  },
  {
    value: "tough_love",
    labelKey: "onboarding.motivation_style.tough_love.title",
    descriptionKey: "onboarding.motivation_style.tough_love.description",
    emoji: "💪"
  },
  {
    value: "calm",
    labelKey: "onboarding.motivation_style.calm.title",
    descriptionKey: "onboarding.motivation_style.calm.description",
    emoji: "🧘"
  }
] as const;

export type MotivationStyle = (typeof MOTIVATION_STYLES)[number]["value"];
