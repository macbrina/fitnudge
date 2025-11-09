#!/usr/bin/env node

const DEFAULT_BASE_URL = "http://localhost:8000";

const resolveHealthUrl = () => {
  const explicitHealthUrl = process.env.API_HEALTH_URL;
  if (explicitHealthUrl) {
    return explicitHealthUrl;
  }

  const configuredBase =
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.EXPO_API_URL ||
    DEFAULT_BASE_URL;

  const normalized = configuredBase.replace(/\/$/, "");
  const stripped = normalized.endsWith("/api/v1")
    ? normalized.replace(/\/api\/v1$/, "")
    : normalized;

  return `${stripped}/health`;
};

const healthUrl = resolveHealthUrl();

const log = (message) => {
  process.stdout.write(`${message}\n`);
};

const fail = (message) => {
  console.error(`\n❌ ${message}`);
  console.error(
    "   Tip: export API_HEALTH_URL or EXPO_PUBLIC_API_URL if your backend runs on a different host."
  );
  process.exit(1);
};

const run = async () => {
  log(`🔍 Checking backend health at ${healthUrl} ...`);

  try {
    const response = await fetch(healthUrl, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      fail(
        `Health endpoint responded with HTTP ${response.status}. Make sure the API is running.`
      );
    }

    const payload = await response.json();
    const statusText = payload?.status ?? "unknown";
    log(`✅ Backend reachable (status: ${statusText}).`);
    process.exit(0);
  } catch (error) {
    fail(
      `Unable to reach backend (${error instanceof Error ? error.message : String(error)}). Start the API server first.`
    );
  }
};

run();
