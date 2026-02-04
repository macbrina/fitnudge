/**
 * JWT token utilities (pure functions, testable).
 * Used by API base service for token expiration checks.
 */

/**
 * Decode JWT payload without verification (just to read expiration).
 * JWTs are base64url encoded: header.payload.signature
 */
export function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/** Check if token expires within the buffer time (seconds) */
export function isTokenExpiringSoon(token: string, bufferSeconds: number = 5 * 60): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = payload.exp - now;
  return expiresIn <= bufferSeconds;
}

/** Check if token is already expired */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now;
}
