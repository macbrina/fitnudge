/**
 * TrackingTypeStats - Smart component that renders the right stats based on tracking type
 *
 * This is a convenience component that routes to the correct stats component
 * based on the tracking type.
 */

import React from "react";
import { WorkoutProgressStats } from "./WorkoutProgressStats";
import { MealProgressStats } from "./MealProgressStats";
import { HydrationProgressStats } from "./HydrationProgressStats";

export type TrackingType = "workout" | "meal" | "hydration" | "checkin";

interface TrackingTypeStatsProps {
  entityId: string;
  entityType?: "goal" | "challenge";
  trackingType: TrackingType;
  period?: number;
}

/**
 * Renders the appropriate stats component based on tracking type
 *
 * - workout → WorkoutProgressStats
 * - meal → MealProgressStats
 * - hydration → HydrationProgressStats
 * - checkin → null (handled by existing MoodTrendMini)
 */
export function TrackingTypeStats({
  entityId,
  entityType = "goal",
  trackingType,
  period = 30,
}: TrackingTypeStatsProps) {
  switch (trackingType) {
    case "workout":
      return (
        <WorkoutProgressStats
          entityId={entityId}
          entityType={entityType}
          period={period}
        />
      );

    case "meal":
      return (
        <MealProgressStats
          entityId={entityId}
          entityType={entityType}
          period={period}
        />
      );

    case "hydration":
      return (
        <HydrationProgressStats
          entityId={entityId}
          entityType={entityType}
          period={period}
        />
      );

    case "checkin":
    default:
      // Check-in stats are handled by existing components (MoodTrendMini)
      return null;
  }
}

// Export individual components for direct use
export { WorkoutProgressStats } from "./WorkoutProgressStats";
export { MealProgressStats } from "./MealProgressStats";
export { HydrationProgressStats } from "./HydrationProgressStats";
