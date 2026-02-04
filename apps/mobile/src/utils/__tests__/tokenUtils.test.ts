import { decodeJwtPayload, isTokenExpiringSoon, isTokenExpired } from "../tokenUtils";

/**
 * Create a minimal valid JWT for testing (header.payload.signature)
 * Payload is base64url encoded JSON with exp claim
 */
function createTestToken(payload: Record<string, unknown>): string {
  const toBase64Url = (s: string) =>
    Buffer.from(s, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const sig = toBase64Url("sig");
  return `${header}.${payloadB64}.${sig}`;
}

describe("decodeJwtPayload", () => {
  it("decodes valid JWT and returns payload", () => {
    const token = createTestToken({ exp: 1234567890 });
    const result = decodeJwtPayload(token);
    expect(result).toEqual({ exp: 1234567890 });
  });

  it("returns null for malformed token (wrong part count)", () => {
    expect(decodeJwtPayload("a.b")).toBeNull();
    expect(decodeJwtPayload("a")).toBeNull();
    expect(decodeJwtPayload("a.b.c.d")).toBeNull();
  });

  it("returns null for invalid base64", () => {
    expect(decodeJwtPayload("a.!!!.c")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(decodeJwtPayload("")).toBeNull();
  });

  it("handles payload without exp", () => {
    const token = createTestToken({ sub: "user123" });
    const result = decodeJwtPayload(token);
    expect(result).toEqual({ sub: "user123" });
  });
});

describe("isTokenExpiringSoon", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns true when token expires within buffer (5 min default)", () => {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60; // 1 min from now
    jest.setSystemTime(now * 1000);
    const token = createTestToken({ exp });
    expect(isTokenExpiringSoon(token)).toBe(true);
  });

  it("returns false when token expires well in future", () => {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // 1 hour
    jest.setSystemTime(now * 1000);
    const token = createTestToken({ exp });
    expect(isTokenExpiringSoon(token)).toBe(false);
  });

  it("returns true when custom buffer and exp within buffer", () => {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 120; // 2 min from now
    jest.setSystemTime(now * 1000);
    const token = createTestToken({ exp });
    expect(isTokenExpiringSoon(token, 300)).toBe(true); // 5 min buffer
  });

  it("returns false when token has no exp", () => {
    const token = createTestToken({});
    expect(isTokenExpiringSoon(token)).toBe(false);
  });
});

describe("isTokenExpired", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns true when exp is in the past", () => {
    const now = Math.floor(Date.now() / 1000);
    const exp = now - 60; // 1 min ago
    jest.setSystemTime(now * 1000);
    const token = createTestToken({ exp });
    expect(isTokenExpired(token)).toBe(true);
  });

  it("returns false when exp is in the future", () => {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60;
    jest.setSystemTime(now * 1000);
    const token = createTestToken({ exp });
    expect(isTokenExpired(token)).toBe(false);
  });

  it("returns false when token has no exp", () => {
    const token = createTestToken({});
    expect(isTokenExpired(token)).toBe(false);
  });
});
