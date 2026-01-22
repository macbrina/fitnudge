/**
 * Dummy data for Analytics Charts (Premium Feature Preview)
 *
 * Used to show blurred chart previews for free users
 * Real data is computed from check-ins for premium users
 */

// Weekly consistency by day of week (Mon-Sun)
export const DUMMY_WEEKLY_CONSISTENCY = [
  { day: "Mon", percentage: 85 },
  { day: "Tue", percentage: 72 },
  { day: "Wed", percentage: 90 },
  { day: "Thu", percentage: 68 },
  { day: "Fri", percentage: 45 },
  { day: "Sat", percentage: 78 },
  { day: "Sun", percentage: 82 }
];

// Streak history over time (last 12 weeks)
export const DUMMY_STREAK_HISTORY = [
  { week: "W1", streak: 3 },
  { week: "W2", streak: 5 },
  { week: "W3", streak: 7 },
  { week: "W4", streak: 4 },
  { week: "W5", streak: 8 },
  { week: "W6", streak: 12 },
  { week: "W7", streak: 6 },
  { week: "W8", streak: 14 },
  { week: "W9", streak: 10 },
  { week: "W10", streak: 18 },
  { week: "W11", streak: 15 },
  { week: "W12", streak: 21 }
];

// Goal completion rates (10 goals for testing layout)
export const DUMMY_GOAL_COMPARISON = [
  { title: "Work out", completion: 0.78, color: "#FF6B6B" },
  { title: "Read", completion: 0.92, color: "#4ECDC4" },
  { title: "Meditate", completion: 0.65, color: "#9B59B6" },
  { title: "Water", completion: 0.85, color: "#3498DB" },
  { title: "Sleep 8h", completion: 0.71, color: "#F39C12" },
  { title: "No sugar", completion: 0.45, color: "#E74C3C" },
  { title: "Walk 10k", completion: 0.88, color: "#2ECC71" },
  { title: "Journal", completion: 0.62, color: "#9B59B6" },
  { title: "Stretch", completion: 0.55, color: "#1ABC9C" },
  { title: "Cold shower", completion: 0.33, color: "#34495E" }
];

// Monthly trend (last 6 months)
export const DUMMY_MONTHLY_TREND = [
  { month: "Aug", percentage: 62 },
  { month: "Sep", percentage: 68 },
  { month: "Oct", percentage: 75 },
  { month: "Nov", percentage: 72 },
  { month: "Dec", percentage: 80 },
  { month: "Jan", percentage: 85 }
];

// Skip reasons distribution
export const DUMMY_SKIP_REASONS = [
  { reason: "work", count: 12, percentage: 35, color: "#FF6B6B", label: "Work" },
  { reason: "tired", count: 8, percentage: 24, color: "#4ECDC4", label: "Tired" },
  { reason: "sick", count: 4, percentage: 12, color: "#9B59B6", label: "Sick" },
  { reason: "schedule", count: 6, percentage: 18, color: "#F39C12", label: "Schedule" },
  { reason: "other", count: 4, percentage: 11, color: "#95A5A6", label: "Other" }
];

// Mood trend (last 30 days sample)
export const DUMMY_MOOD_TREND = [
  { date: "2025-01-01", mood: "good", mood_score: 2, label: "Jan 1" },
  { date: "2025-01-03", mood: "amazing", mood_score: 3, label: "Jan 3" },
  { date: "2025-01-05", mood: "tough", mood_score: 1, label: "Jan 5" },
  { date: "2025-01-07", mood: "good", mood_score: 2, label: "Jan 7" },
  { date: "2025-01-09", mood: "good", mood_score: 2, label: "Jan 9" },
  { date: "2025-01-11", mood: "amazing", mood_score: 3, label: "Jan 11" },
  { date: "2025-01-13", mood: "amazing", mood_score: 3, label: "Jan 13" },
  { date: "2025-01-15", mood: "good", mood_score: 2, label: "Jan 15" },
  { date: "2025-01-17", mood: "tough", mood_score: 1, label: "Jan 17" },
  { date: "2025-01-19", mood: "good", mood_score: 2, label: "Jan 19" }
];

// Color palette for charts
export const CHART_COLORS = {
  primary: "#6366F1",
  secondary: "#22C55E",
  tertiary: "#F59E0B",
  quaternary: "#EC4899",
  quinary: "#06B6D4",
  bars: ["#6366F1", "#818CF8", "#A5B4FC", "#C7D2FE", "#E0E7FF", "#6366F1", "#818CF8"]
};
