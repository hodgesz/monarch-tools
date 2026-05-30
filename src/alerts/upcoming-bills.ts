import type { MonarchClient } from "monarchmoney";
import type { AlertConfig } from "../config";
import type { AlertResult } from "./types";
import { getUpcomingBills } from "../fetchers/recurring";

export async function checkUpcomingBills(
  client: MonarchClient,
  config: AlertConfig
): Promise<AlertResult[]> {
  const bills = await getUpcomingBills(client, config.thresholds.upcomingBillsDays);

  if (bills.length === 0) return [];

  const totalDue = bills.reduce((sum, b) => sum + Math.abs(b.amount), 0);

  const billList = bills
    .map((b) => `${b.date}: ${b.merchantName} — $${Math.abs(b.amount).toFixed(2)}`)
    .join("\n");

  const billIds = bills.map((b) => b.id).sort().join(",");

  return [
    {
      type: "upcoming-bill",
      severity: "info",
      title: `${bills.length} bills due in the next ${config.thresholds.upcomingBillsDays} days ($${totalDue.toFixed(2)} total)`,
      message: billList,
      data: { bills, totalDue },
      fingerprint: `upcoming-bill:${billIds}`,
    },
  ];
}
