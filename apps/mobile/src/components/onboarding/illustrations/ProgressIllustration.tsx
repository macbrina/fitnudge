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

interface ProgressIllustrationProps {
  width?: number;
  height?: number;
}

export const ProgressIllustration: React.FC<ProgressIllustrationProps> = ({
  width = 280,
  height = 280
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 280 280">
      <Defs>
        <LinearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#afabf8" />
          <Stop offset="100%" stopColor="#d1cffa" />
        </LinearGradient>
      </Defs>

      {/* Purple rounded rectangle background */}
      <Rect x="40" y="40" width="200" height="200" fill="url(#purpleGradient)" rx="20" />

      {/* Progress Image - Centered */}
      <Image
        x="70"
        y="70"
        width="140"
        height="140"
        href={require("@assetsimages/images/progress.png")}
        preserveAspectRatio="xMidYMid meet"
      />

      {/* Stars around progress */}
      <G fill="#fbbf24">
        <Path d="M100 100 L105 95 L110 100 L105 105 Z" />
        <Path d="M180 80 L185 75 L190 80 L185 85 Z" />
        <Path d="M80 180 L85 175 L90 180 L85 185 Z" />
        <Path d="M200 200 L205 195 L210 200 L205 205 Z" />
        <Path d="M120 60 L125 55 L130 60 L125 65 Z" />
        <Path d="M160 220 L165 215 L170 220 L165 225 Z" />
      </G>

      {/* Progress-related elements around the image */}

      {/* Top Right - Progress Chart */}
      <G transform="translate(210, 100)">
        <Circle cx="0" cy="0" r="20" fill="#3b82f6" />
        <Circle cx="0" cy="0" r="15" fill="#ffffff" />
        {/* Chart bars */}
        <Rect x="-8" y="-5" width="3" height="8" fill="#10b981" />
        <Rect x="-3" y="-2" width="3" height="5" fill="#f59e0b" />
        <Rect x="2" y="-8" width="3" height="11" fill="#ef4444" />
        <Rect x="7" y="-6" width="3" height="9" fill="#8b5cf6" />
      </G>

      {/* Mid Left - Calendar/Streak */}
      <G transform="translate(60, 140)">
        <Circle cx="0" cy="0" r="20" fill="#10b981" />
        <Circle cx="0" cy="0" r="15" fill="#ffffff" />
        {/* Calendar */}
        <Rect x="-8" y="-6" width="16" height="12" fill="#e5e7eb" rx="2" />
        <Rect x="-8" y="-6" width="16" height="3" fill="#ef4444" />
        <Circle cx="-4" cy="2" r="1" fill="#10b981" />
        <Circle cx="0" cy="2" r="1" fill="#10b981" />
        <Circle cx="4" cy="2" r="1" fill="#10b981" />
      </G>

      {/* Bottom Right - Trophy/Achievement */}
      <G transform="translate(220, 210)">
        <Circle cx="0" cy="0" r="20" fill="#f59e0b" />
        <Circle cx="0" cy="0" r="15" fill="#ffffff" />
        {/* Trophy */}
        <Rect x="-6" y="-8" width="12" height="8" fill="#fbbf24" rx="2" />
        <Rect x="-4" y="0" width="8" height="6" fill="#fbbf24" />
        <Circle cx="-3" cy="-4" r="1" fill="#ef4444" />
        <Circle cx="3" cy="-4" r="1" fill="#ef4444" />
      </G>
    </Svg>
  );
};

export default ProgressIllustration;
