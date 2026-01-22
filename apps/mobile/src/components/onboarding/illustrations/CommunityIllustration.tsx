import React from "react";
import Svg, {
  Path,
  Circle,
  Rect,
  G,
  Defs,
  LinearGradient,
  Stop,
  Text,
  Image
} from "react-native-svg";

interface CommunityIllustrationProps {
  width?: number;
  height?: number;
}

export const CommunityIllustration: React.FC<CommunityIllustrationProps> = ({
  width = 280,
  height = 280
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 280 280">
      {/* <Defs>
        <LinearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#b2adf9" />
          <Stop offset="100%" stopColor="#ada9f6" />
        </LinearGradient>
      </Defs> */}

      {/* Purple rounded rectangle background */}
      <Rect x="40" y="40" width="200" height="200" fill="url(#purpleGradient)" rx="20" />

      {/* Community Image - Centered */}
      <Image
        x="70"
        y="70"
        width="140"
        height="140"
        href={require("@assetsimages/images/community.png")}
        preserveAspectRatio="xMidYMid meet"
      />

      {/* Chat-related elements around the image */}

      {/* Top - Chat bubble */}
      <G transform="translate(140, 40)">
        <Circle cx="0" cy="0" r="12" fill="#8b5cf6" />
        <Circle cx="0" cy="0" r="8" fill="#ffffff" />
        <Path d="M-4 -2 Q0 -4 4 -2 M-4 2 Q0 4 4 2" stroke="#8b5cf6" strokeWidth="1" fill="none" />
        <Path d="M-2 -4 Q-2 0 -2 4 M2 -4 Q2 0 2 4" stroke="#8b5cf6" strokeWidth="1" fill="none" />
      </G>

      {/* Left - Heart reaction */}
      <G transform="translate(40, 120)">
        <Circle cx="0" cy="0" r="10" fill="#ef4444" />
        <Path
          d="M-3 -1 C-4 -3 -6 -2 -6 0 C-6 2 -4 3 -2 1 C0 3 2 2 2 0 C2 -2 0 -3 -1 -1 C-2 -3 -4 -2 -3 -1 Z"
          fill="#ffffff"
        />
        {/* Chat bubble */}
        <Rect x="15" y="-8" width="40" height="16" fill="#8b5cf6" rx="8" />
        <Path d="M15 0 L10 5 L15 10" fill="#8b5cf6" />
      </G>

      {/* Top Right - Thumbs up reaction */}
      <G transform="translate(200, 100)">
        <Circle cx="0" cy="0" r="12" fill="#10b981" />
        <Path
          d="M-2 -6 L-2 -2 L-4 0 L-4 2 L-2 4 L0 2 L2 2 L2 0 L0 -2 L0 -6 C0 -8 -2 -8 -2 -6 Z"
          fill="#ffffff"
        />
      </G>

      {/* Bottom Right - Fire reaction */}
      <G transform="translate(220, 200)">
        <Circle cx="0" cy="0" r="12" fill="#f59e0b" />
        <Path
          d="M-1 -8 L-3 -4 L-1 -2 L1 -4 L3 -2 L1 0 L-1 2 L1 4 L-1 6 C-1 8 1 8 1 6 L3 4 L1 2 L3 0 L1 -2 L-1 0 L-3 2 L-1 4 L-3 6 L-1 8 Z"
          fill="#ffffff"
        />
      </G>

      {/* Bottom Left - Celebration emoji */}
      <G transform="translate(70, 200)">
        <Circle cx="0" cy="0" r="12" fill="#f59e0b" />
        <Circle cx="-3" cy="-3" r="1.5" fill="#ffffff" />
        <Circle cx="3" cy="-3" r="1.5" fill="#ffffff" />
        <Path d="M-3 2 Q0 4 3 2" stroke="#ffffff" strokeWidth="1" fill="none" />
        {/* Party hat */}
        <Path d="M-4 -6 L0 -8 L4 -6 L2 -4 L-2 -4 Z" fill="#ef4444" />
        {/* Confetti */}
        <Circle cx="-6" cy="-2" r="1" fill="#ef4444" />
        <Circle cx="6" cy="-1" r="1" fill="#10b981" />
        <Circle cx="-5" cy="1" r="1" fill="#8b5cf6" />
        <Circle cx="5" cy="2" r="1" fill="#f59e0b" />
      </G>

      {/* Text in speech bubbles */}
      {/* <G fill="#ffffff" fontSize="10" fontFamily="Arial">
        <Text x="35" y="5" textAnchor="middle">
          Masks
        </Text>
        <Text x="30" y="12" textAnchor="middle">
          Special effects
        </Text>
        <Text x="25" y="12" textAnchor="middle">
          Filters
        </Text>
      </G> */}
    </Svg>
  );
};

export default CommunityIllustration;
