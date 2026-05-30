import type { MonarchClient } from "monarchmoney";
import type { AlertConfig } from "../config";
import type { AlertResult } from "./types";
import { getBudgetStatus } from "../fetchers/budgets";

export async function checkAnomalies(
  client: MonarchClient,
  config: AlertConfig
): Promise<AlertResult[]> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // Get current month and prior 3 months
  const months = [currentMonth];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
    );
  }

  const [current, ...priorMonths] = await Promise.all(
    months.map((m) => getBudgetStatus(client, m))
  );

  // Build 3-month average by category
  const avgMap = new Map<string, { avg: number; name: string; icon: string }>();
  for (const cat of current.categories) {
    const priorAmounts = priorMonths
      .map((pm) => pm.categories.find((c) => c.categoryId === cat.categoryId))
      .filter(Boolean)
      .map((c) => c!.actualAmount);

    if (priorAmounts.length === 0) continue;
    const avg = priorAmounts.reduce((s, a) => s + a, 0) / priorAmounts.length;
    avgMap.set(cat.categoryId, {
      avg,
      name: cat.categoryName,
      icon: cat.categoryIcon,
    });
  }

  const alerts: AlertResult[] = [];
  const multiplier = config.thresholds.anomalyMultiplier;

  for (const cat of current.categories) {
    const prior = avgMap.get(cat.categoryId);
    if (!prior || prior.avg <= 0) continue;

    if (cat.actualAmount > prior.avg * multiplier) {
      const pctOver = ((cat.actualAmount / prior.avg - 1) * 100).toFixed(0);
      alerts.push({
        type: "anomaly",
        severity: "warning",
        title: `${cat.categoryIcon} ${cat.categoryName} spending unusual`,
        message: `$${cat.actualAmount.toFixed(2)} this month vs $${prior.avg.toFixed(2)} average — ${pctOver}% above normal`,
        data: {
          categoryId: cat.categoryId,
          current: cat.actualAmount,
          average: prior.avg,
        },
        fingerprint: `anomaly:${cat.categoryId}:${currentMonth}`,
      });
    }
  }

  return alerts;
}
