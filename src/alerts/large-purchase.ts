import type { MonarchClient } from "monarchmoney";
import type { AlertConfig } from "../config";
import type { AlertResult } from "./types";
import { getTransactions } from "../fetchers/transactions";

export async function checkLargePurchases(
  client: MonarchClient,
  config: AlertConfig,
  since: string
): Promise<AlertResult[]> {
  const today = new Date().toISOString().split("T")[0];
  const txns = await getTransactions(client, since, today);
  const threshold = config.thresholds.largePurchase;

  const candidates = txns.filter(
    (t) =>
      Math.abs(t.amount) >= threshold &&
      t.amount < 0 &&
      t.categoryName !== "Transfer" &&
      t.categoryName !== "Credit Card Payment"
  );

  // Collapse duplicates: same date/amount/merchant/account displayName
  // (some users have multiple linked accounts that mirror the same card,
  // and pending→posted transitions change the transaction id).
  const byKey = new Map<string, (typeof candidates)[number]>();
  for (const t of candidates) {
    const key = `${t.date}|${t.amount.toFixed(2)}|${t.merchantName}|${t.accountName}`;
    if (!byKey.has(key)) byKey.set(key, t);
  }

  return [...byKey.entries()].map(([key, t]) => ({
    type: "large-purchase" as const,
    severity: "warning" as const,
    title: `Large purchase: $${Math.abs(t.amount).toFixed(2)} at ${t.merchantName}`,
    message: `${t.date} — $${Math.abs(t.amount).toFixed(2)} at ${t.merchantName} (${t.categoryName}) on ${t.accountName}`,
    data: { transaction: t },
    fingerprint: `large-purchase:${key}`,
  }));
}
