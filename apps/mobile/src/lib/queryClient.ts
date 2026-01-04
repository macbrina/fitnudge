/**
 * Centralized React Query Client Configuration
 *
 * This module provides:
 * 1. A singleton QueryClient with optimized default settings
 * 2. Persistent cache using MMKV for instant data on app restart
 * 3. Cache dehydration/hydration utilities
 *
 * @see docs/PREFETCH_CACHE_STRATEGY.md for full documentation
 */

import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { Persister } from "@tanstack/react-query-persist-client";
import { createMMKV } from "react-native-mmkv";

// Initialize MMKV storage for React Query cache
// MMKV is ~30x faster than AsyncStorage for this use case
const queryStorage = createMMKV({
  id: "react-query-cache"
});

/**
 * MMKV adapter for React Query persister
 * Implements the Storage interface expected by createSyncStoragePersister
 */
const mmkvStorageAdapter = {
  getItem: (key: string): string | null => {
    const value = queryStorage.getString(key);
    return value ?? null;
  },
  setItem: (key: string, value: string): void => {
    queryStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    queryStorage.remove(key);
  }
};

/**
 * Create the storage persister for React Query
 * This enables cache persistence across app restarts
 */
export const queryPersister: Persister = createSyncStoragePersister({
  storage: mmkvStorageAdapter,
  // Throttle writes to avoid excessive disk I/O
  throttleTime: 1000,
  // Key used to store the entire dehydrated cache
  key: "REACT_QUERY_OFFLINE_CACHE"
});

/**
 * Singleton QueryClient with optimized defaults
 *
 * Cache Strategy:
 * - staleTime: How long data is considered "fresh" (no refetch on mount)
 * - gcTime: How long unused data stays in cache before garbage collection
 *
 * Default staleTime of 5 minutes means:
 * - Navigating between screens won't trigger refetches
 * - Data older than 5 minutes will refetch on component mount
 *
 * Mutations have reduced retry to fail faster for better UX with optimistic updates
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is fresh for 5 minutes - prevents refetch on navigation
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 24 hours (for offline/persistence)
      gcTime: 24 * 60 * 60 * 1000,
      // Retry failed requests 3 times with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Don't refetch when window regains focus (we handle this manually in RealtimeContext)
      refetchOnWindowFocus: false
    },
    mutations: {
      // Fail fast for mutations - optimistic updates handle instant feedback
      retry: 1
    }
  }
});

/**
 * Clear all cached data
 * Use this on logout to ensure no data leakage between users
 */
export const clearQueryCache = (): void => {
  queryClient.clear();
  queryStorage.clearAll();
};

/**
 * Get the MMKV storage instance for direct access if needed
 * (e.g., for debugging or manual cache inspection)
 */
export const getQueryStorage = () => queryStorage;
