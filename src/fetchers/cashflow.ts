import type { MonarchClient } from "monarchmoney";

export interface NormalizedCashflow {
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
}

export async function getCashflowSummary(
  client: MonarchClient,
  startDate?: string,
  endDate?: string
): Promise<NormalizedCashflow> {
  const raw: any = await client.cashflow.getCashflowSummary(
    startDate && endDate ? { startDate, endDate } : undefined
  );

  return {
    income: raw.sumIncome ?? 0,
    expenses: raw.sumExpense ?? 0,
    savings: raw.savings ?? 0,
    savingsRate: raw.savingsRate ?? 0,
  };
}
