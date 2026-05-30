import type { MonarchClient } from "monarchmoney";
import type { DailyDigestData } from "../email/templates";
import { getTransactions } from "../fetchers/transactions";
import { getBudgetStatus } from "../fetchers/budgets";
import { getUpcomingBills } from "../fetchers/recurring";
import { getCashflowSummary } from "../fetchers/cashflow";

export async function buildDailyDigest(
  client: MonarchClient
): Promise<DailyDigestData> {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [rawTxns, budget, cashflow, bills] = await Promise.all([
    getTransactions(client, yesterdayStr, yesterdayStr),
    getBudgetStatus(client, monthStart),
    getCashflowSummary(client, monthStart, todayStr),
    getUpcomingBills(client, 7),
  ]);

  // Transfers are wealth-neutral; show them as positive/green so incoming
  // transfers to checking don't look like expenses. Credit Card Payments
  // stay red as real outflows from checking.
  const txns = rawTxns.map((t) =>
    t.categoryName === "Transfer" ? { ...t, amount: Math.abs(t.amount) } : t
  );

  // Top budget categories closest to or over their limit
  const budgetHighlights = budget.categories
    .filter((c) => c.plannedAmount > 0)
    .sort((a, b) => b.percentUsed - a.percentUsed)
    .slice(0, 5);

  const billTotal = bills.reduce((s, b) => s + Math.abs(b.amount), 0);

  return {
    date: todayStr,
    yesterdayTransactions: txns,
    monthToDateSpending: cashflow.expenses,
    monthToDateIncome: cashflow.income,
    budgetHighlights,
    upcomingBillCount: bills.length,
    upcomingBillTotal: billTotal,
  };
}
