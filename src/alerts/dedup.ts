import { loadBaseline, saveBaseline } from "../storage";
import type { AlertResult, Severity } from "./types";

interface SentEntry {
  fingerprint: string;
  severity: Severity;
  sentAt: string; // ISO timestamp
}

interface SentAlerts {
  entries: SentEntry[];
}

const SENT_FILE = "sent-alerts.json";
const EXPIRY_DAYS = 35; // keep entries ~1 month, covers monthly budget cycles

/**
 * Filters out alerts that have already been sent.
 *
 * Rules:
 * - Same fingerprint + same or lower severity → suppress
 * - Same fingerprint but higher severity (e.g. warning → critical) → allow (escalation)
 * - Entries older than EXPIRY_DAYS are pruned automatically
 */
export function dedup(alerts: AlertResult[]): AlertResult[] {
  const stored = loadBaseline<SentAlerts>(SENT_FILE);
  const cutoff = Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000;

  // Prune expired entries
  const active = (stored?.entries ?? []).filter(
    (e) => new Date(e.sentAt).getTime() > cutoff
  );

  const sentMap = new Map<string, SentEntry>();
  for (const entry of active) {
    sentMap.set(entry.fingerprint, entry);
  }

  const SEVERITY_RANK: Record<string, number> = {
    info: 0,
    warning: 1,
    critical: 2,
  };

  return alerts.filter((alert) => {
    const prev = sentMap.get(alert.fingerprint);
    if (!prev) return true;

    // Allow if severity escalated
    const prevRank = SEVERITY_RANK[prev.severity] ?? 0;
    const currRank = SEVERITY_RANK[alert.severity] ?? 0;
    return currRank > prevRank;
  });
}

/**
 * Record that these alerts have been sent so future runs skip them.
 */
export function markSent(alerts: AlertResult[]): void {
  const stored = loadBaseline<SentAlerts>(SENT_FILE);
  const cutoff = Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000;

  const active = (stored?.entries ?? []).filter(
    (e) => new Date(e.sentAt).getTime() > cutoff
  );

  const sentMap = new Map<string, SentEntry>();
  for (const entry of active) {
    sentMap.set(entry.fingerprint, entry);
  }

  // Upsert new entries
  const now = new Date().toISOString();
  for (const alert of alerts) {
    sentMap.set(alert.fingerprint, {
      fingerprint: alert.fingerprint,
      severity: alert.severity,
      sentAt: now,
    });
  }

  saveBaseline<SentAlerts>(SENT_FILE, {
    entries: [...sentMap.values()],
  });
}
