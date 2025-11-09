import { resolveApiRootUrl } from "@/services/api/base";
import { useSystemStatusStore } from "@/stores/systemStatusStore";

interface HealthCheckResult {
  component: string;
  status: string;
  details?: string;
}

interface HealthReport {
  status: string;
  checks?: HealthCheckResult[];
  message?: string;
}

const buildReasonFromChecks = (checks: HealthCheckResult[] = []): string => {
  const problematic = checks.filter(
    (check) =>
      check.status && check.status !== "ok" && check.status !== "not_configured"
  );

  if (problematic.length === 0) {
    return "Service degraded";
  }

  return problematic
    .map((check) => {
      const name = check.component.replace(/_/g, " ");
      return `${name}: ${check.details || check.status}`;
    })
    .join(" • ");
};

export const fetchBackendHealth = async (): Promise<void> => {
  const healthUrl = `${resolveApiRootUrl()}/health`;

  try {
    const response = await fetch(healthUrl, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      useSystemStatusStore
        .getState()
        .setBackendStatus(
          response.status >= 500 ? "offline" : "degraded",
          `Health check failed (HTTP ${response.status})`
        );
      return;
    }

    const payload = (await response.json()) as HealthReport;

    switch (payload.status) {
      case "ok":
        useSystemStatusStore.getState().setBackendStatus("online", null);
        break;
      case "degraded":
        useSystemStatusStore
          .getState()
          .setBackendStatus(
            "degraded",
            buildReasonFromChecks(payload.checks ?? [])
          );
        break;
      case "critical":
        useSystemStatusStore
          .getState()
          .setBackendStatus(
            "offline",
            buildReasonFromChecks(payload.checks ?? [])
          );
        break;
      default:
        useSystemStatusStore
          .getState()
          .setBackendStatus("degraded", payload.message || "Unknown status");
    }
  } catch (error) {
    useSystemStatusStore
      .getState()
      .setBackendStatus(
        "offline",
        error instanceof Error ? error.message : "Network error"
      );
  }
};
