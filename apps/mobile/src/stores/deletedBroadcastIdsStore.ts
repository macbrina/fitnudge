import { create } from "zustand";

/**
 * Ids of broadcasts deleted via realtime (notifications table DELETE).
 * Controller prunes its queue by these, then clears. Only updated by realtime — never by mark-seen.
 */

interface DeletedBroadcastIdsState {
  ids: string[];
  add: (id: string) => void;
  consume: () => string[];
}

export const useDeletedBroadcastIdsStore = create<DeletedBroadcastIdsState>((set, get) => ({
  ids: [],

  add: (id) =>
    set((s) => ({
      ids: s.ids.includes(id) ? s.ids : [...s.ids, id]
    })),

  consume: () => {
    const list = [...get().ids];
    set({ ids: [] });
    return list;
  }
}));
