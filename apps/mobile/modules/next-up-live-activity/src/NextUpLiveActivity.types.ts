export type NextUpLiveActivityPayload = {
  dayKey: string;
  nextTaskId: string;
  title: string;
  taskTitle: string;
  emoji?: string | null;
  completedCount: number;
  totalCount: number;
  /** When provided, shows the Live Activity as a banner (AlertConfiguration). Pass only when task changes. */
  bannerTitle?: string | null;
  bannerBody?: string | null;
};
