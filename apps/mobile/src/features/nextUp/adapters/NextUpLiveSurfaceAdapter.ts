export type LiveSurfaceContent = {
  title: string;
  body: string;
  /** iOS Live Activity payload; optional for Android. */
  dayKey?: string;
  nextTaskId?: string;
  taskTitle?: string;
  emoji?: string | null;
  completedCount?: number;
  totalCount?: number;
  /** When true, skip banner/alert (no sound) - e.g. app open resume of same task */
  skipBanner?: boolean;
};

export interface NextUpLiveSurfaceAdapter {
  /**
   * Show or update the persistent system surface.
   * Implementations must be idempotent and tolerate repeated calls.
   */
  startOrUpdate(content: LiveSurfaceContent): Promise<void>;
  /** Remove the persistent system surface. */
  end(): Promise<void>;
}
