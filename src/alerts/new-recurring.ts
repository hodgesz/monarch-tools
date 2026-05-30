import type { MonarchClient } from "monarchmoney";
import type { AlertResult } from "./types";
import { getRecurringStreams } from "../fetchers/recurring";
import { loadBaseline, saveBaseline } from "../storage";

interface RecurringBaseline {
  streamIds: string[];
  updatedAt: string;
}

const BASELINE_FILE = "recurring-baseline.json";

export async function checkNewRecurring(
  client: MonarchClient
): Promise<AlertResult[]> {
  const streams = await getRecurringStreams(client);
  const currentIds = new Set(streams.map((s) => s.id));
  const currentMap = new Map(streams.map((s) => [s.id, s]));

  const baseline = loadBaseline<RecurringBaseline>(BASELINE_FILE);

  if (!baseline) {
    // First run — save current state, no alerts
    saveBaseline<RecurringBaseline>(BASELINE_FILE, {
      streamIds: [...currentIds],
      updatedAt: new Date().toISOString(),
    });
    return [];
  }

  const previousIds = new Set(baseline.streamIds);
  const newIds = [...currentIds].filter((id) => !previousIds.has(id));

  // Save updated baseline
  saveBaseline<RecurringBaseline>(BASELINE_FILE, {
    streamIds: [...currentIds],
    updatedAt: new Date().toISOString(),
  });

  return newIds.map((id) => {
    const stream = currentMap.get(id)!;
    return {
      type: "new-recurring" as const,
      severity: "warning" as const,
      title: `New recurring charge: ${stream.name}`,
      message: `${stream.name} — $${Math.abs(stream.amount).toFixed(2)}/${stream.frequency}`,
      data: { stream },
      fingerprint: `new-recurring:${id}`,
    };
  });
}
