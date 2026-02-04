"use client";

import { formatCompact } from "@/lib/helper";

type StatCardProps = {
  label: string;
  value: number;
  prefix?: string;
  /** Use compact format (1k, 1.21k, 10M). Default true for stats. */
  compact?: boolean;
};

/**
 * Stat card for dashboard metrics. Handles overflow: long labels truncate with
 * ellipsis, values use min-w-0 so they don't push layout.
 */
export function StatCard({ label, value, prefix, compact = true }: StatCardProps) {
  const formatted =
    typeof value === "number"
      ? compact
        ? formatCompact(value)
        : value % 1 !== 0
          ? value.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : value.toLocaleString()
      : String(value);

  return (
    <div className="min-w-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <p
        className="text-sm text-gray-500 dark:text-gray-400 truncate"
        title={label}
      >
        {label}
      </p>
      <p
        className="text-2xl font-semibold text-gray-900 dark:text-white mt-1 truncate"
        title={`${prefix ?? ""}${formatted}`}
      >
        {prefix ?? ""}
        {formatted}
      </p>
    </div>
  );
}
