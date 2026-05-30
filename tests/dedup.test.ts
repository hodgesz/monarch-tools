import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AlertResult, Severity } from "../src/alerts/types";

// In-memory stand-in for the on-disk baseline store, so the dedup logic can be
// tested without touching the filesystem.
let store: Record<string, unknown> = {};

vi.mock("../src/storage", () => ({
  loadBaseline: <T>(file: string): T | undefined =>
    store[file] as T | undefined,
  saveBaseline: <T>(file: string, data: T): void => {
    store[file] = data;
  },
}));

// Imported after the mock is registered.
import { dedup, markSent } from "../src/alerts/dedup";

function alert(
  fingerprint: string,
  severity: Severity = "warning"
): AlertResult {
  return {
    type: "large-purchase",
    severity,
    title: "t",
    message: "m",
    data: {},
    fingerprint,
  };
}

describe("dedup", () => {
  beforeEach(() => {
    store = {};
  });

  it("passes through alerts that have never been sent", () => {
    const alerts = [alert("a"), alert("b")];
    expect(dedup(alerts)).toHaveLength(2);
  });

  it("suppresses an alert already sent at the same severity", () => {
    markSent([alert("a", "warning")]);
    expect(dedup([alert("a", "warning")])).toHaveLength(0);
  });

  it("allows an alert whose severity escalated", () => {
    markSent([alert("a", "warning")]);
    const result = dedup([alert("a", "critical")]);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("critical");
  });

  it("suppresses an alert whose severity de-escalated", () => {
    markSent([alert("a", "critical")]);
    expect(dedup([alert("a", "warning")])).toHaveLength(0);
  });
});
