/**
 * Admin API base URL for server-side proxy routes.
 * Used by Next.js API routes to forward requests to the Admin API (FastAPI).
 */

export function getAdminApiUrl(): string {
  return process.env.ADMIN_API_URL || "http://localhost:8001";
}
