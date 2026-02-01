import { EventEmitter } from "expo-modules-core";

const noop = () => {};
const dummy = {
  areActivitiesEnabled: (): boolean => false,
  startActivity: (
    _dayKey: string,
    _nextTaskId: string,
    _title: string,
    _taskTitle: string,
    _emoji: string | null,
    _completedCount: number,
    _totalCount: number,
    _bannerTitle: string | null,
    _bannerBody: string | null
  ): boolean => false,
  updateActivity: (
    _dayKey: string,
    _nextTaskId: string,
    _title: string,
    _taskTitle: string,
    _emoji: string | null,
    _completedCount: number,
    _totalCount: number,
    _bannerTitle: string | null,
    _bannerBody: string | null
  ): void => noop(),
  endActivity: (): void => noop(),
  getPushToStartToken: (): Promise<string | null> => Promise.resolve(null as string | null)
};

export default dummy;
export const emitter: InstanceType<typeof EventEmitter> = new EventEmitter(dummy as any);
