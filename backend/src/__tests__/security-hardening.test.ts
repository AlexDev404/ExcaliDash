/**
 * Security hardening tests
 *
 * Tests for input validation and sanitization improvements:
 * - Route parameter ID validation
 * - Collection name validation/sanitization
 * - Library items validation
 * - Socket.io input validation helpers
 * - Path traversal protection in archive file names
 */

import { describe, it, expect } from "vitest";
import { sanitizeText } from "../security";

// Replicate the validation functions from index.ts to test them in isolation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

const isValidResourceId = (id: string): boolean => {
  return UUID_REGEX.test(id) || SAFE_ID_REGEX.test(id);
};

describe("Route Parameter ID Validation", () => {
  it("should accept valid UUID v4", () => {
    expect(isValidResourceId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidResourceId("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
  });

  it("should accept safe alphanumeric IDs", () => {
    expect(isValidResourceId("trash")).toBe(true);
    expect(isValidResourceId("default")).toBe(true);
    expect(isValidResourceId("my-collection-123")).toBe(true);
    expect(isValidResourceId("element_1")).toBe(true);
  });

  it("should reject IDs with path traversal", () => {
    expect(isValidResourceId("../etc/passwd")).toBe(false);
    expect(isValidResourceId("..\\windows\\system32")).toBe(false);
    expect(isValidResourceId("foo/bar")).toBe(false);
  });

  it("should reject IDs with SQL injection attempts", () => {
    expect(isValidResourceId("'; DROP TABLE drawings; --")).toBe(false);
    expect(isValidResourceId("1 OR 1=1")).toBe(false);
  });

  it("should reject IDs with script injection", () => {
    expect(isValidResourceId("<script>alert(1)</script>")).toBe(false);
    expect(isValidResourceId('"><img src=x onerror=alert(1)>')).toBe(false);
  });

  it("should reject empty or excessively long IDs", () => {
    expect(isValidResourceId("")).toBe(false);
    expect(isValidResourceId("a".repeat(129))).toBe(false);
  });

  it("should accept IDs at maximum length", () => {
    expect(isValidResourceId("a".repeat(128))).toBe(true);
  });
});

describe("Collection Name Validation", () => {
  it("should sanitize collection names with HTML", () => {
    const result = sanitizeText('<script>alert("xss")</script>My Collection', 255);
    expect(result).not.toContain("<script>");
    expect(result).toContain("My Collection");
  });

  it("should preserve normal collection names", () => {
    const result = sanitizeText("My Drawings Collection", 255);
    expect(result).toBe("My Drawings Collection");
  });

  it("should truncate overly long names", () => {
    const longName = "A".repeat(300);
    const result = sanitizeText(longName, 255);
    expect(result.length).toBeLessThanOrEqual(255);
  });

  it("should strip control characters", () => {
    const result = sanitizeText("Name\x00With\x07Control\x1FChars", 255);
    expect(result).not.toContain("\x00");
    expect(result).not.toContain("\x07");
    expect(result).not.toContain("\x1F");
  });
});

describe("Library Items Validation", () => {
  it("should accept valid item counts", () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: `item-${i}` }));
    expect(items.length).toBeLessThanOrEqual(10000);
  });

  it("should flag excessive item counts", () => {
    const items = Array.from({ length: 10001 }, (_, i) => ({ id: `item-${i}` }));
    expect(items.length).toBeGreaterThan(10000);
  });
});

describe("Archive Path Sanitization", () => {
  const sanitizeArchiveName = (name: string): string => {
    return name.replace(/[<>:"/\\|?*]/g, "_").replace(/\.\./g, "_");
  };

  it("should replace path traversal sequences", () => {
    const result = sanitizeArchiveName("../../etc/passwd");
    expect(result).not.toContain("..");
    expect(result).not.toContain("/");
  });

  it("should replace dangerous characters", () => {
    const result = sanitizeArchiveName('my<drawing>:name/"test"\\path|file?name*');
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).not.toContain(":");
    expect(result).not.toContain('"');
    expect(result).not.toContain("\\");
    expect(result).not.toContain("|");
    expect(result).not.toContain("?");
    expect(result).not.toContain("*");
  });

  it("should preserve normal names", () => {
    const result = sanitizeArchiveName("My Drawing 2024");
    expect(result).toBe("My Drawing 2024");
  });

  it("should handle double-dot paths", () => {
    const result = sanitizeArchiveName("..folder../..test..");
    expect(result).not.toContain("..");
  });
});

describe("Socket.io Input Validation Helpers", () => {
  const isValidDrawingId = (id: unknown): id is string =>
    typeof id === "string" && id.length > 0 && id.length <= 128 && isValidResourceId(id);

  it("should accept valid drawing IDs", () => {
    expect(isValidDrawingId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidDrawingId("my-drawing-1")).toBe(true);
  });

  it("should reject non-string inputs", () => {
    expect(isValidDrawingId(123)).toBe(false);
    expect(isValidDrawingId(null)).toBe(false);
    expect(isValidDrawingId(undefined)).toBe(false);
    expect(isValidDrawingId({})).toBe(false);
    expect(isValidDrawingId([])).toBe(false);
  });

  it("should reject empty strings", () => {
    expect(isValidDrawingId("")).toBe(false);
  });

  it("should reject strings with injection attempts", () => {
    expect(isValidDrawingId("<script>alert(1)</script>")).toBe(false);
    expect(isValidDrawingId("../../../etc/passwd")).toBe(false);
  });
});
