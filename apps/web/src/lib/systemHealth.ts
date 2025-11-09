"use client";

export type HealthStatus = "ok" | "degraded" | "critical" | "not_configured";

export type HealthUpdateStatus = "identified" | "monitoring" | "resolved";

export interface HealthCheckResult {
  component: string;
  status: HealthStatus;
  details: string;
  latency_ms?: number | null;
  metadata?: Record<string, unknown>;
}

export interface HealthReport {
  status: HealthStatus;
  version: string;
  environment: string;
  timestamp: string;
  checks: HealthCheckResult[];
}

export interface HealthHistoryImpact {
  component: string;
  label?: string | null;
  status: HealthStatus;
  details?: string | null;
  latency_ms?: number | null;
}

export interface HealthHistoryUpdate {
  id: string;
  created_at: string;
  status: HealthUpdateStatus;
  title: string;
  description: string;
}

export interface HealthHistoryEntry {
  id: string;
  created_at: string;
  status: HealthStatus;
  environment: string;
  version?: string | null;
  summary_key: string;
  summary_params: Record<string, unknown>;
  impacted: HealthHistoryImpact[];
  updates: HealthHistoryUpdate[];
}

export const resolveApiBase = () => {
  const candidates = [
    process.env.NEXT_PUBLIC_API_BASE_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_API_ENDPOINT,
  ].filter(Boolean) as string[];

  if (candidates.length === 0) {
    return {
      root: null,
      apiV1: null,
    };
  }

  const raw = candidates[0];
  const trimmed = raw.replace(/\/$/, "");
  const apiV1 = trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
  const root = trimmed.endsWith("/api/v1")
    ? trimmed.replace(/\/api\/v1$/, "")
    : trimmed;

  return {
    root,
    apiV1,
  };
};

