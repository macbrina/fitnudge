import React from "react";
import Svg, { Path, Circle } from "react-native-svg";

interface UserPlusIconProps {
  size?: number;
  color?: string;
}

export const UserPlusIcon: React.FC<UserPlusIconProps> = ({
  size = 24,
  color = "currentColor"
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* User circle */}
      <Circle cx="9" cy="7" r="4" stroke={color} strokeWidth="2" fill="none" />

      {/* User body */}
      <Path
        d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Plus sign */}
      <Path
        d="M16 11h6m-3-3v6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export default UserPlusIcon;
