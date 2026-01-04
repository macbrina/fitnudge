import React from "react";
import Svg, { Path, Circle, Rect } from "react-native-svg";

/**
 * Nudge Emoji Icons - Custom SVG icons for the nudge system
 *
 * These icons are mapped by ID (stored in database) to their SVG components.
 * Replace the placeholder SVGs with icons downloaded from Flaticon.
 *
 * Usage:
 * <NudgeIcon emoji="wave" size={32} />
 * <NudgeIcon emoji="fire" size={24} useOriginalColors={false} color="#FF0000" />
 */

// Nudge emoji type - the ID stored in the database
export type NudgeEmojiType =
  // Nudge type emojis
  | "wave"
  | "muscle"
  | "target"
  | "clock"
  // Cheer type emojis
  | "party"
  | "hands_up"
  | "star"
  | "rocket"
  // Milestone type emojis
  | "trophy"
  | "confetti"
  | "crown"
  | "diamond"
  // Competitive type emojis
  | "fire"
  | "smirk"
  | "fist"
  | "runner"
  // Quick reactions
  | "clap"
  | "heart"
  | "thumbs_up"
  | "lightning";

interface NudgeIconProps {
  emoji: NudgeEmojiType;
  size?: number;
  color?: string;
  useOriginalColors?: boolean;
}

interface IconComponentProps {
  size: number;
  color?: string;
}

// ============================================================
// PLACEHOLDER ICONS - Replace these with Flaticon SVGs
// ============================================================

// Wave hand icon (👋)
const WaveIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Circle cx="32" cy="32" r="28" fill={color || "#FFD93D"} />
    <Path
      d="M20 28c-2 0-4 2-4 4s2 4 4 4h8c2 0 4-2 4-4s-2-4-4-4h-8z"
      fill={color ? `${color}80` : "#E8B923"}
    />
    <Path
      d="M36 24c-2 0-4 2-4 4v12c0 2 2 4 4 4s4-2 4-4V28c0-2-2-4-4-4z"
      fill={color ? `${color}80` : "#E8B923"}
    />
  </Svg>
);

// Muscle/flexed bicep icon (💪)
const MuscleIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Circle cx="32" cy="32" r="28" fill={color || "#FFD93D"} />
    <Path
      d="M20 40c0-8 4-16 12-16s12 8 12 16"
      stroke={color ? `${color}80` : "#E8B923"}
      strokeWidth="6"
      strokeLinecap="round"
      fill="none"
    />
  </Svg>
);

// Target/bullseye icon (🎯)
const TargetIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Circle cx="32" cy="32" r="28" fill={color || "#EF4444"} />
    <Circle cx="32" cy="32" r="20" fill="#FFFFFF" />
    <Circle cx="32" cy="32" r="12" fill={color || "#EF4444"} />
    <Circle cx="32" cy="32" r="4" fill="#FFFFFF" />
  </Svg>
);

// Clock/alarm icon (⏰)
const ClockIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Circle cx="32" cy="32" r="28" fill={color || "#3B82F6"} />
    <Circle cx="32" cy="32" r="22" fill="#FFFFFF" />
    <Path
      d="M32 18v16l10 6"
      stroke={color || "#3B82F6"}
      strokeWidth="4"
      strokeLinecap="round"
      fill="none"
    />
  </Svg>
);

// Party popper icon (🎉)
const PartyIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Path d="M16 48L32 16l16 32z" fill={color || "#F59E0B"} />
    <Circle cx="20" cy="20" r="4" fill="#EF4444" />
    <Circle cx="44" cy="16" r="3" fill="#22C55E" />
    <Circle cx="48" cy="28" r="4" fill="#3B82F6" />
    <Circle cx="12" cy="32" r="3" fill="#8B5CF6" />
  </Svg>
);

// Hands up/raised hands icon (🙌)
const HandsUpIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Circle cx="32" cy="32" r="28" fill={color || "#FFD93D"} />
    <Path d="M20 36V24c0-2 2-4 4-4s4 2 4 4v12" fill={color ? `${color}80` : "#E8B923"} />
    <Path d="M36 36V24c0-2 2-4 4-4s4 2 4 4v12" fill={color ? `${color}80` : "#E8B923"} />
  </Svg>
);

// Star icon (⭐)
const StarIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Path d="M32 8l7 18h18l-14 11 5 19-16-12-16 12 5-19L7 26h18z" fill={color || "#F59E0B"} />
  </Svg>
);

// Rocket icon (🚀)
const RocketIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Path d="M32 8c-8 8-12 24-12 32h24c0-8-4-24-12-32z" fill={color || "#EF4444"} />
    <Circle cx="32" cy="28" r="6" fill="#FFFFFF" />
    <Path d="M20 44l-4 12h8zM44 44l4 12h-8z" fill={color || "#F59E0B"} />
  </Svg>
);

// Trophy icon (🏆)
const TrophyIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Path d="M20 12h24v20c0 8-6 12-12 12s-12-4-12-12V12z" fill={color || "#F59E0B"} />
    <Rect x="28" y="44" width="8" height="8" fill={color || "#F59E0B"} />
    <Rect x="24" y="52" width="16" height="4" fill={color || "#F59E0B"} />
    <Path d="M16 12h4v8c-4 0-6-2-6-4s2-4 2-4z" fill={color ? `${color}80` : "#E8B923"} />
    <Path d="M48 12h-4v8c4 0 6-2 6-4s-2-4-2-4z" fill={color ? `${color}80` : "#E8B923"} />
  </Svg>
);

// Confetti icon (🎊)
const ConfettiIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Circle cx="16" cy="16" r="6" fill="#EF4444" />
    <Circle cx="48" cy="20" r="4" fill="#22C55E" />
    <Circle cx="32" cy="12" r="5" fill="#3B82F6" />
    <Circle cx="20" cy="44" r="4" fill="#F59E0B" />
    <Circle cx="44" cy="48" r="6" fill="#8B5CF6" />
    <Rect x="28" y="28" width="8" height="8" rx="2" fill={color || "#22C55E"} />
  </Svg>
);

// Crown icon (👑)
const CrownIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Path d="M8 48l8-32 16 16 16-16 8 32z" fill={color || "#F59E0B"} />
    <Circle cx="16" cy="16" r="4" fill={color || "#F59E0B"} />
    <Circle cx="32" cy="20" r="4" fill={color || "#F59E0B"} />
    <Circle cx="48" cy="16" r="4" fill={color || "#F59E0B"} />
  </Svg>
);

// Diamond icon (💎)
const DiamondIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Path d="M32 56L8 24l8-12h32l8 12z" fill={color || "#3B82F6"} />
    <Path d="M8 24h48L32 56z" fill={color ? `${color}CC` : "#60A5FA"} />
    <Path d="M16 12h32l8 12H8z" fill={color ? `${color}80` : "#93C5FD"} />
  </Svg>
);

// Fire/flame icon (🔥)
const FireIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Path
      d="M32 8c-4 12-16 20-16 32 0 10 8 16 16 16s16-6 16-16c0-12-12-20-16-32z"
      fill={color || "#EF4444"}
    />
    <Path
      d="M32 32c-2 6-8 10-8 16 0 5 4 8 8 8s8-3 8-8c0-6-6-10-8-16z"
      fill={color ? `${color}80` : "#F59E0B"}
    />
  </Svg>
);

// Smirk face icon (😏)
const SmirkIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Circle cx="32" cy="32" r="28" fill={color || "#FFD93D"} />
    <Circle cx="22" cy="26" r="4" fill="#333333" />
    <Circle cx="42" cy="26" r="4" fill="#333333" />
    <Path
      d="M24 42c8 6 16 2 20-2"
      stroke="#333333"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
  </Svg>
);

// Fist/fist bump icon (✊)
const FistIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Circle cx="32" cy="32" r="28" fill={color || "#FFD93D"} />
    <Rect x="20" y="24" width="24" height="20" rx="4" fill={color ? `${color}80` : "#E8B923"} />
    <Path d="M20 32h24M20 38h24" stroke={color || "#FFD93D"} strokeWidth="2" />
  </Svg>
);

// Runner icon (🏃)
const RunnerIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Circle cx="40" cy="12" r="6" fill={color || "#3B82F6"} />
    <Path
      d="M28 24l12 4v16l-8 12M40 28l8 8-4 16"
      stroke={color || "#3B82F6"}
      strokeWidth="4"
      strokeLinecap="round"
      fill="none"
    />
  </Svg>
);

// Clap/clapping hands icon (👏)
const ClapIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Circle cx="32" cy="32" r="28" fill={color || "#FFD93D"} />
    <Path
      d="M20 28c-2 4 0 8 4 10l12 8"
      stroke={color ? `${color}80` : "#E8B923"}
      strokeWidth="6"
      strokeLinecap="round"
      fill="none"
    />
    <Path
      d="M44 28c2 4 0 8-4 10l-12 8"
      stroke={color ? `${color}80` : "#E8B923"}
      strokeWidth="6"
      strokeLinecap="round"
      fill="none"
    />
  </Svg>
);

// Heart icon (❤️)
const HeartIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Path
      d="M32 56L12 36c-8-8-8-20 0-28 8-8 16-4 20 4 4-8 12-12 20-4 8 8 8 20 0 28z"
      fill={color || "#EF4444"}
    />
  </Svg>
);

// Thumbs up icon (👍)
const ThumbsUpIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Circle cx="32" cy="32" r="28" fill={color || "#FFD93D"} />
    <Path
      d="M24 44V28l8-12c2-2 6-2 6 2v6h10c2 0 4 2 4 4l-2 14c0 2-2 4-4 4H24z"
      fill={color ? `${color}80` : "#E8B923"}
    />
    <Rect x="16" y="28" width="8" height="16" rx="2" fill={color ? `${color}60` : "#D4A41C"} />
  </Svg>
);

// Lightning bolt icon (⚡)
const LightningIcon = ({ size, color }: IconComponentProps) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Path d="M36 8L16 36h12L24 56l20-28H32z" fill={color || "#F59E0B"} />
  </Svg>
);

// ============================================================
// Icon Mapping
// ============================================================

const NUDGE_ICON_MAP: Record<NudgeEmojiType, React.FC<IconComponentProps>> = {
  wave: WaveIcon,
  muscle: MuscleIcon,
  target: TargetIcon,
  clock: ClockIcon,
  party: PartyIcon,
  hands_up: HandsUpIcon,
  star: StarIcon,
  rocket: RocketIcon,
  trophy: TrophyIcon,
  confetti: ConfettiIcon,
  crown: CrownIcon,
  diamond: DiamondIcon,
  fire: FireIcon,
  smirk: SmirkIcon,
  fist: FistIcon,
  runner: RunnerIcon,
  clap: ClapIcon,
  heart: HeartIcon,
  thumbs_up: ThumbsUpIcon,
  lightning: LightningIcon
};

// ============================================================
// Main Component
// ============================================================

export function NudgeIcon({ emoji, size = 32, color, useOriginalColors = true }: NudgeIconProps) {
  const IconComponent = NUDGE_ICON_MAP[emoji];

  if (!IconComponent) {
    // Fallback to wave icon
    return <WaveIcon size={size} color={color} />;
  }

  return <IconComponent size={size} color={useOriginalColors ? undefined : color} />;
}

// Export all emoji types for iteration
export const NUDGE_EMOJI_LIST: NudgeEmojiType[] = [
  "wave",
  "muscle",
  "target",
  "clock",
  "party",
  "hands_up",
  "star",
  "rocket",
  "trophy",
  "confetti",
  "crown",
  "diamond",
  "fire",
  "smirk",
  "fist",
  "runner",
  "clap",
  "heart",
  "thumbs_up",
  "lightning"
];

// Export individual icons for direct use
export {
  WaveIcon,
  MuscleIcon,
  TargetIcon,
  ClockIcon,
  PartyIcon,
  HandsUpIcon,
  StarIcon,
  RocketIcon,
  TrophyIcon,
  ConfettiIcon,
  CrownIcon,
  DiamondIcon,
  FireIcon,
  SmirkIcon,
  FistIcon,
  RunnerIcon,
  ClapIcon,
  HeartIcon,
  ThumbsUpIcon,
  LightningIcon
};

export default NudgeIcon;
