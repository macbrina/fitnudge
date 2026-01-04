import { NudgeType } from "@/services/api/nudges";
import { NudgeEmojiType } from "@/components/icons/NudgeIcons";

/**
 * Nudge Messages Configuration
 *
 * Each nudge type has a set of predefined messages with associated emojis.
 * The emoji is the SVG icon ID stored in the database.
 */

export interface NudgeMessage {
  emoji: NudgeEmojiType;
  messageKey: string; // Translation key
  message: string; // Fallback message
}

export interface NudgeTypeConfig {
  type: NudgeType;
  labelKey: string;
  label: string;
  icon: NudgeEmojiType;
  color: string;
  messages: NudgeMessage[];
}

// Predefined messages for each nudge type
export const NUDGE_MESSAGES: Record<NudgeType, NudgeMessage[]> = {
  nudge: [
    {
      emoji: "wave",
      messageKey: "nudge.messages.nudge.hey_time",
      message: "Hey! Time to check in!"
    },
    {
      emoji: "muscle",
      messageKey: "nudge.messages.nudge.dont_forget",
      message: "Don't forget your goals today!"
    },
    {
      emoji: "target",
      messageKey: "nudge.messages.nudge.stay_on_track",
      message: "Stay on track! You've got this!"
    },
    {
      emoji: "clock",
      messageKey: "nudge.messages.nudge.friendly_reminder",
      message: "Friendly reminder to log your progress!"
    }
  ],
  cheer: [
    {
      emoji: "party",
      messageKey: "nudge.messages.cheer.amazing",
      message: "You're doing amazing!"
    },
    {
      emoji: "hands_up",
      messageKey: "nudge.messages.cheer.great_work",
      message: "Keep up the great work!"
    },
    {
      emoji: "star",
      messageKey: "nudge.messages.cheer.rockstar",
      message: "You're a rockstar!"
    },
    {
      emoji: "rocket",
      messageKey: "nudge.messages.cheer.on_fire",
      message: "You're on fire!"
    }
  ],
  milestone: [
    {
      emoji: "trophy",
      messageKey: "nudge.messages.milestone.congrats_streak",
      message: "Congrats on your streak!"
    },
    {
      emoji: "confetti",
      messageKey: "nudge.messages.milestone.achievement",
      message: "What an achievement!"
    },
    {
      emoji: "crown",
      messageKey: "nudge.messages.milestone.crushed_it",
      message: "You crushed it!"
    },
    {
      emoji: "diamond",
      messageKey: "nudge.messages.milestone.legendary",
      message: "Legendary progress!"
    }
  ],
  competitive: [
    {
      emoji: "fire",
      messageKey: "nudge.messages.competitive.catching_up",
      message: "I'm catching up to you!"
    },
    {
      emoji: "smirk",
      messageKey: "nudge.messages.competitive.beat_me",
      message: "Think you can beat me?"
    },
    {
      emoji: "fist",
      messageKey: "nudge.messages.competitive.game_on",
      message: "Game on!"
    },
    {
      emoji: "runner",
      messageKey: "nudge.messages.competitive.race",
      message: "Race you to the finish!"
    }
  ],
  custom: []
};

// Nudge type configurations
export const NUDGE_TYPE_CONFIGS: NudgeTypeConfig[] = [
  {
    type: "nudge",
    labelKey: "nudge.types.nudge",
    label: "Nudge",
    icon: "wave",
    color: "#3B82F6", // Blue
    messages: NUDGE_MESSAGES.nudge
  },
  {
    type: "cheer",
    labelKey: "nudge.types.cheer",
    label: "Cheer",
    icon: "party",
    color: "#F59E0B", // Amber
    messages: NUDGE_MESSAGES.cheer
  },
  {
    type: "milestone",
    labelKey: "nudge.types.milestone",
    label: "Milestone",
    icon: "trophy",
    color: "#10B981", // Emerald
    messages: NUDGE_MESSAGES.milestone
  },
  {
    type: "competitive",
    labelKey: "nudge.types.competitive",
    label: "Competitive",
    icon: "fire",
    color: "#EF4444", // Red
    messages: NUDGE_MESSAGES.competitive
  }
];

// Quick reaction emojis for the bottom row
export const QUICK_REACTION_EMOJIS: NudgeEmojiType[] = [
  "clap",
  "muscle",
  "fire",
  "target",
  "star",
  "trophy",
  "rocket",
  "heart",
  "hands_up",
  "crown"
];

// Get config for a specific nudge type
export function getNudgeTypeConfig(type: NudgeType): NudgeTypeConfig | undefined {
  return NUDGE_TYPE_CONFIGS.find((config) => config.type === type);
}

// Get messages for a specific nudge type
export function getNudgeMessages(type: NudgeType): NudgeMessage[] {
  return NUDGE_MESSAGES[type] || [];
}

// Get a random message for a nudge type
export function getRandomNudgeMessage(type: NudgeType): NudgeMessage | undefined {
  const messages = getNudgeMessages(type);
  if (messages.length === 0) return undefined;
  return messages[Math.floor(Math.random() * messages.length)];
}

export default NUDGE_TYPE_CONFIGS;
