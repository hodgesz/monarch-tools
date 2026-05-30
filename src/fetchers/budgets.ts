import type { MonarchClient } from "monarchmoney";

export interface BudgetCategoryStatus {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  plannedAmount: number;
  actualAmount: number;
  remainingAmount: number;
  percentUsed: number;
}

export interface BudgetMonthSummary {
  month: string;
  categories: BudgetCategoryStatus[];
  totalIncome: { actual: number; planned: number };
  totalExpenses: { actual: number; planned: number };
  totalFixedExpenses: { actual: number; planned: number };
  totalFlexibleExpenses: { actual: number; planned: number };
}

function extractTotals(t: any): { actual: number; planned: number } {
  return {
    actual: t?.actualAmount ?? 0,
    planned: t?.plannedAmount ?? 0,
  };
}

export async function getBudgetStatus(
  client: MonarchClient,
  month: string // YYYY-MM-DD (first of month)
): Promise<BudgetMonthSummary> {
  // Parse date parts manually to avoid timezone issues
  const [year, mon] = month.split("-").map(Number);
  const lastDayOfMonth = new Date(year, mon, 0).getDate();
  const endDate = `${year}-${String(mon).padStart(2, "0")}-${String(lastDayOfMonth).padStart(2, "0")}`;

  const raw: any = await client.budgets.getBudgets({
    startDate: month,
    endDate,
  });

  // Build category ID → name/icon lookup from categoryGroups
  const categoryMap = new Map<string, { name: string; icon: string }>();
  for (const group of raw.categoryGroups || []) {
    for (const cat of group.categories || []) {
      categoryMap.set(cat.id, { name: cat.name, icon: cat.icon ?? "" });
    }
  }

  // Parse per-category budget data
  const categories: BudgetCategoryStatus[] = [];
  for (const entry of raw.budgetData?.monthlyAmountsByCategory || []) {
    const catId = entry.category?.id;
    if (!catId) continue;

    const info = categoryMap.get(catId) || { name: "Unknown", icon: "" };
    const monthData = entry.monthlyAmounts?.[0]; // single month requested
    if (!monthData) continue;

    const planned = Math.abs(monthData.plannedCashFlowAmount ?? 0);
    const actual = Math.abs(monthData.actualAmount ?? 0);

    // Skip categories with no budget set and no spending
    if (planned === 0 && actual === 0) continue;

    categories.push({
      categoryId: catId,
      categoryName: info.name,
      categoryIcon: info.icon,
      plannedAmount: planned,
      actualAmount: actual,
      remainingAmount: monthData.remainingAmount ?? planned - actual,
      percentUsed: planned > 0 ? (actual / planned) * 100 : actual > 0 ? Infinity : 0,
    });
  }

  // Parse totals
  const totals = raw.budgetData?.totalsByMonth?.[0] ?? {};

  return {
    month,
    categories,
    totalIncome: extractTotals(totals.totalIncome),
    totalExpenses: extractTotals(totals.totalExpenses),
    totalFixedExpenses: extractTotals(totals.totalFixedExpenses),
    totalFlexibleExpenses: extractTotals(totals.totalFlexibleExpenses),
  };
}
