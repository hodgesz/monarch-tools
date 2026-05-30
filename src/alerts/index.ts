import type { MonarchClient } from "monarchmoney";
import type { AlertConfig } from "../config";
import type { AlertResult } from "./types";
import { checkLargePurchases } from "./large-purchase";
import { checkBudgetStatus } from "./budget-status";
import { checkUpcomingBills } from "./upcoming-bills";
import { checkNewRecurring } from "./new-recurring";
import { checkAnomalies } from "./anomaly";

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export async function runAllAlerts(
  client: MonarchClient,
  config: AlertConfig
): Promise<AlertResult[]> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const since = yesterday.toISOString().split("T")[0];

  const results = await Promise.all([
    checkLargePurchases(client, config, since).catch((e) => {
      console.error("Large purchase check failed:", e.message);
      return [] as AlertResult[];
    }),
    checkBudgetStatus(client, config).catch((e) => {
      console.error("Budget status check failed:", e.message);
      return [] as AlertResult[];
    }),
    checkUpcomingBills(client, config).catch((e) => {
      console.error("Upcoming bills check failed:", e.message);
      return [] as AlertResult[];
    }),
    checkNewRecurring(client).catch((e) => {
      console.error("New recurring check failed:", e.message);
      return [] as AlertResult[];
    }),
    checkAnomalies(client, config).catch((e) => {
      console.error("Anomaly check failed:", e.message);
      return [] as AlertResult[];
    }),
  ]);

  return results
    .flat()
    .sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
    );
}

export type { AlertResult } from "./types";
