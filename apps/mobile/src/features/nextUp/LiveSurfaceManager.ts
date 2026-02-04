import type { QueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";

import type { Goal } from "@/services/api/goals";
import { goalsQueryKeys } from "@/hooks/api/queryKeys";
import { checkInsQueryKeys } from "@/hooks/api/queryKeys";
import type { CheckIn } from "@/services/api/checkins";

import { AndroidOngoingNotificationAdapter } from "./adapters/AndroidOngoingNotificationAdapter";
import { IosLiveActivityAdapter } from "./adapters/IosLiveActivityAdapter";
import type { NextUpLiveSurfaceAdapter } from "./adapters/NextUpLiveSurfaceAdapter";
import { clearShownTask, loadNextUpPersistedState, persistShownTask } from "./storage";
import {
  formatLocalDateKey,
  goalToNextUpTaskWithCheckInStatus,
  resolveNextTaskIdWithLock
} from "./todayState";
import type { NextUpTask } from "./types";

type UpdateInput = {
  goals: Goal[];
  now?: Date;
};

function buildBody(task: NextUpTask, counts?: { completed: number; total: number }): string {
  const icon = "•";
  const base = `${icon} ${task.title}`;
  if (!counts) return base;
  if (counts.total <= 1) return base;
  // Keep it short; OK to omit if it feels too cramped later.
  return `${base} (${counts.completed} of ${counts.total} done)`;
}

function buildAdapter(): NextUpLiveSurfaceAdapter {
  if (Platform.OS === "android") return new AndroidOngoingNotificationAdapter();
  // iOS Live Activity is stubbed behind a flag for now
  return new IosLiveActivityAdapter();
}

class LiveSurfaceManager {
  private adapter: NextUpLiveSurfaceAdapter = buildAdapter();

  /**
   * Update from React Query cache (no extra fetch).
   * Safe to call on app start/resume and after optimistic updates.
   */
  async updateFromQueryClient(queryClient: QueryClient, now: Date = new Date()): Promise<void> {
    const cached = queryClient.getQueryData<any>(goalsQueryKeys.active());
    const goals: Goal[] = cached?.data ?? [];

    const todayKey = formatLocalDateKey(now);
    const todayCheckInsCache = queryClient.getQueryData<any>(checkInsQueryKeys.today());
    const todayCheckIns: CheckIn[] = todayCheckInsCache?.data ?? [];

    // Map goal_id -> status for today (local day key).
    const statusByGoalId = new Map<string, string>();
    for (const ci of todayCheckIns) {
      const ciDayKey = String(ci.check_in_date || "").split("T")[0];
      if (ciDayKey !== todayKey) continue;
      if (ci.goal_id) statusByGoalId.set(ci.goal_id, ci.status);
    }

    const tasksDueToday: NextUpTask[] = goals
      .map((g) => goalToNextUpTaskWithCheckInStatus(g, now, statusByGoalId.get(g.id)))
      .filter(Boolean) as NextUpTask[];

    await this.updateTasks({ tasksDueToday, now });
  }

  /**
   * Core entry point: compute deterministic TodayState, apply flicker lock, then
   * start/update/end the platform surface.
   */
  async update(input: UpdateInput): Promise<void> {
    const now = input.now ?? new Date();
    const tasksDueToday: NextUpTask[] = input.goals
      .map((g) => goalToNextUpTaskWithCheckInStatus(g, now, undefined))
      .filter(Boolean) as NextUpTask[];

    await this.updateTasks({ tasksDueToday, now });
  }

  /**
   * Update using already-normalized tasks (useful for realtime payload-driven updates).
   */
  async updateTasks(opts: { tasksDueToday: NextUpTask[]; now?: Date }): Promise<void> {
    const now = opts.now ?? new Date();
    const dayKey = formatLocalDateKey(now);

    const persisted = await loadNextUpPersistedState();

    // Day rollover: end surface + clear lock so we can recompute for the new day.
    if (persisted.shownDayKey && persisted.shownDayKey !== dayKey) {
      await this.adapter.end();
      await clearShownTask();
    }

    const state = resolveNextTaskIdWithLock({
      tasksDueToday: opts.tasksDueToday,
      lockedTaskId: persisted.shownDayKey === dayKey ? persisted.shownTaskId : null
    });

    if (!state.nextTaskId) {
      // End condition: no remaining due-today incomplete tasks.
      await this.adapter.end();
      await clearShownTask();
      return;
    }

    const nextTask = opts.tasksDueToday.find((t) => t.id === state.nextTaskId);
    if (!nextTask) {
      await this.adapter.end();
      await clearShownTask();
      return;
    }

    // Skip banner/sound when resuming same task (e.g. app open) - only alert when task actually changes
    const isSameTaskAsPersisted =
      persisted.shownDayKey === dayKey && persisted.shownTaskId === nextTask.id;

    await this.adapter.startOrUpdate({
      title: "Today's focus",
      body: buildBody(nextTask, { completed: state.completedToday, total: state.totalDueToday }),
      dayKey,
      nextTaskId: nextTask.id,
      taskTitle: nextTask.title,
      emoji: undefined,
      completedCount: state.completedToday,
      totalCount: state.totalDueToday,
      skipBanner: isSameTaskAsPersisted
    });

    await persistShownTask({ dayKey, taskId: nextTask.id });
  }

  async end(): Promise<void> {
    await this.adapter.end();
    await clearShownTask();
  }
}

export const liveSurfaceManager = new LiveSurfaceManager();
