import type { MonarchClient } from "monarchmoney";
import type { WeeklySummaryData, WarehouseInsights } from "../email/templates";
import { getTransactions } from "../fetchers/transactions";
import { getBudgetStatus } from "../fetchers/budgets";
import {
  incomeBreakdown,
  momByCategory,
  rollingAverageByCategory,
  topMerchants,
  subscriptionCandidates,
} from "../warehouse/queries";

export async function buildWeeklySummary(
  client: MonarchClient
): Promise<WeeklySummaryData> {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const todayStr = now.toISOString().split("T")[0];
  const weekAgoStr = weekAgo.toISOString().split("T")[0];
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // Same period last month
  const lastMonthNow = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    now.getDate()
  );
  const lastMonthStart = `${lastMonthNow.getFullYear()}-${String(lastMonthNow.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMonthSameDay = lastMonthNow.toISOString().split("T")[0];

  const [weekTxns, budget, currentMonthTxns, lastMonthTxns] = await Promise.all(
    [
      getTransactions(client, weekAgoStr, todayStr),
      getBudgetStatus(client, monthStart),
      getTransactions(client, monthStart, todayStr),
      getTransactions(client, lastMonthStart, lastMonthSameDay),
    ]
  );

  // Top spending categories this week
  const catSpending = new Map<string, { name: string; amount: number }>();
  for (const t of weekTxns) {
    if (t.amount >= 0) continue; // skip income
    const existing = catSpending.get(t.categoryName) || {
      name: t.categoryName,
      amount: 0,
    };
    existing.amount += t.amount;
    catSpending.set(t.categoryName, existing);
  }
  const topSpendingCategories = [...catSpending.values()]
    .sort((a, b) => a.amount - b.amount) // most negative first
    .slice(0, 8);

  // Month comparison
  const currentSpent = currentMonthTxns
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + t.amount, 0);
  const lastSpent = lastMonthTxns
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + t.amount, 0);
  const pctChange =
    lastSpent !== 0
      ? ((currentSpent - lastSpent) / Math.abs(lastSpent)) * 100
      : 0;

  const weekSpent = weekTxns
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + t.amount, 0);

  return {
    weekStartDate: weekAgoStr,
    weekEndDate: todayStr,
    budgetProgress: budget.categories,
    topSpendingCategories,
    weekTransactionCount: weekTxns.length,
    weekTotalSpent: weekSpent,
    monthComparison: {
      currentMonthSpent: currentSpent,
      lastMonthSamePoint: lastSpent,
      percentChange: pctChange,
    },
    warehouse: buildWarehouseInsights(),
  };
}

function buildWarehouseInsights(): WarehouseInsights | undefined {
  try {
    const income = incomeBreakdown();
    if (income.length === 0) return undefined;

    const mom = momByCategory()
      .filter((r) => Math.abs(r.delta_abs) >= 50)
      .slice(0, 8)
      .map((r) => ({
        category: r.category_name,
        current: r.current_amount,
        prior: r.prior_amount,
        deltaAbs: r.delta_abs,
        deltaPct: r.delta_pct,
      }));

    const rolling = rollingAverageByCategory()
      .filter(
        (r) =>
          r.months_observed >= 2 &&
          r.variance_pct !== null &&
          Math.abs(r.variance_pct) >= 25 &&
          r.avg_monthly >= 100
      )
      .slice(0, 8)
      .map((r) => ({
        category: r.category_name,
        avgMonthly: r.avg_monthly,
        currentAmount: r.current_amount,
        variancePct: r.variance_pct,
      }));

    const merchants = topMerchants({ limit: 10 }).map((m) => ({
      name: m.merchant_name,
      total: m.total_spent,
      count: m.txn_count,
    }));

    const subs = subscriptionCandidates();
    const monthsObserved = new Set(income.map((r) => r.month)).size || 1;
    const subscriptionMonthlyTotal =
      subs.reduce((sum, s) => sum + s.total_spent, 0) / monthsObserved;

    return {
      incomeByMonth: income.map((r) => ({
        month: r.month,
        paychecks: r.paychecks,
        otherIncome: r.other_income,
        trueIncome: r.true_income,
      })),
      momTopMovers: mom,
      rollingAverageOutliers: rolling,
      topMerchants: merchants,
      subscriptionCandidates: subs.slice(0, 15).map((s) => ({
        name: s.merchant_name,
        avgAmount: s.avg_amount,
        totalSpent: s.total_spent,
        chargeCount: s.txn_count,
      })),
      subscriptionMonthlyTotal,
    };
  } catch (err) {
    console.warn(
      "Warehouse insights unavailable:",
      (err as Error).message ?? err
    );
    return undefined;
  }
}
