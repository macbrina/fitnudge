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
// import { Image } from "react-native";

interface AICoachIllustrationProps {
  width?: number;
  height?: number;
}

export const AICoachIllustration: React.FC<AICoachIllustrationProps> = ({
  width = 280,
  height = 280
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 280 280">
      {/* <Defs>
        <LinearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#d1cffb" />
          <Stop offset="100%" stopColor="#dedcfc" />
        </LinearGradient>
      </Defs> */}

      {/* Purple rounded rectangle background */}
      <Rect x="40" y="40" width="200" height="200" fill="url(#purpleGradient)" rx="20" />

      {/* AI Motivation Image - Centered */}
      <Image
        x="50"
        y="70"
        width="180"
        height="180"
        href={require("@assetsimages/images/ai-motivation.png")}
        preserveAspectRatio="xMidYMid meet"
      />

      {/* Floating UI elements around the image */}

      {/* Globe icon above */}
      <G transform="translate(140, 40)">
        <Circle cx="0" cy="0" r="12" fill="#10b981" />
        <Circle cx="0" cy="0" r="8" fill="#ffffff" />
        <Path d="M-4 -2 Q0 -4 4 -2 M-4 2 Q0 4 4 2" stroke="#10b981" strokeWidth="1" fill="none" />
        <Path d="M-2 -4 Q-2 0 -2 4 M2 -4 Q2 0 2 4" stroke="#10b981" strokeWidth="1" fill="none" />
      </G>

      {/* Smiley face with speech bubble */}
      <G transform="translate(40, 120)">
        <Circle cx="0" cy="0" r="10" fill="#10b981" />
        <Circle cx="-3" cy="-2" r="1.5" fill="#ffffff" />
        <Circle cx="3" cy="-2" r="1.5" fill="#ffffff" />
        <Path d="M-3 2 Q0 4 3 2" stroke="#ffffff" strokeWidth="1" fill="none" />
        {/* Speech bubble */}
        <Rect x="15" y="-8" width="40" height="16" fill="#ffffff" rx="8" />
        <Path d="M15 0 L10 5 L15 10" fill="#ffffff" />
      </G>

      {/* Special effects speech bubble */}
      <G transform="translate(200, 100)">
        <Rect x="0" y="0" width="60" height="20" fill="#ffffff" rx="10" />
      </G>

      {/* Filters speech bubble */}
      <G transform="translate(200, 200)">
        <Rect x="0" y="0" width="50" height="20" fill="#ffffff" rx="10" />
      </G>

      {/* Skull with heart eyes */}
      <G transform="translate(50, 200)">
        <Circle cx="0" cy="0" r="12" fill="#f59e0b" />
        <Circle cx="-4" cy="-3" r="2" fill="#ef4444" />
        <Circle cx="4" cy="-3" r="2" fill="#ef4444" />
        <Path d="M-3 2 Q0 4 3 2" stroke="#1f2937" strokeWidth="1" fill="none" />
      </G>

      {/* Abstract geometric shapes in background */}
      <G opacity="0.3">
        <Rect x="60" y="60" width="20" height="20" fill="#ffffff" rx="4" />
        <Circle cx="220" cy="80" r="8" fill="#ffffff" />
        <Path d="M80 220 L90 210 L100 220 L90 230 Z" fill="#ffffff" />
      </G>
    </Svg>
  );
};

export default AICoachIllustration;
