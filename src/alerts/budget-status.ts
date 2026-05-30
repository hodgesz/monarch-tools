import type { MonarchClient } from "monarchmoney";
import type { AlertConfig } from "../config";
import type { AlertResult } from "./types";
import { getBudgetStatus } from "../fetchers/budgets";

export async function checkBudgetStatus(
  client: MonarchClient,
  config: AlertConfig
): Promise<AlertResult[]> {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const budget = await getBudgetStatus(client, monthStart);
  const alerts: AlertResult[] = [];

  for (const cat of budget.categories) {
    if (cat.plannedAmount <= 0) continue;

    if (cat.percentUsed >= config.thresholds.budgetExceededPercent) {
      alerts.push({
        type: "budget-exceeded",
        severity: "critical",
        title: `${cat.categoryIcon} ${cat.categoryName} over budget`,
        message: `Spent $${cat.actualAmount.toFixed(2)} of $${cat.plannedAmount.toFixed(2)} budget (${cat.percentUsed.toFixed(0)}%)`,
        data: { category: cat },
        fingerprint: `budget-exceeded:${cat.categoryId}:${monthStart}`,
      });
    } else if (cat.percentUsed >= config.thresholds.budgetWarningPercent) {
      alerts.push({
        type: "budget-warning",
        severity: "warning",
        title: `${cat.categoryIcon} ${cat.categoryName} approaching budget`,
        message: `Spent $${cat.actualAmount.toFixed(2)} of $${cat.plannedAmount.toFixed(2)} budget (${cat.percentUsed.toFixed(0)}%) — $${cat.remainingAmount.toFixed(2)} remaining`,
        data: { category: cat },
        fingerprint: `budget-warning:${cat.categoryId}:${monthStart}`,
      });
    }
  }

  return alerts;
}
