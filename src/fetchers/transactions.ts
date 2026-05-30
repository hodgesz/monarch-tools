import type { MonarchClient } from "monarchmoney";

export interface NormalizedTransaction {
  id: string;
  date: string;
  amount: number; // negative = expense, positive = income
  merchantName: string;
  categoryName: string;
  categoryId: string;
  accountName: string;
  isRecurring: boolean;
  needsReview: boolean;
  notes: string | null;
}

export async function getTransactions(
  client: MonarchClient,
  startDate: string,
  endDate: string
): Promise<NormalizedTransaction[]> {
  const all: NormalizedTransaction[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const result = await client.transactions.getTransactions({
      startDate,
      endDate,
      limit,
      offset,
    });

    const page = result as any;
    const txns: any[] = page.transactions || [];

    for (const t of txns) {
      all.push({
        id: t.id,
        date: t.date,
        amount: t.amount,
        merchantName:
          t.merchant?.name ?? t.merchantName ?? t.plaidName ?? "Unknown",
        categoryName: t.category?.name ?? "Uncategorized",
        categoryId: t.category?.id ?? "",
        accountName: t.account?.displayName ?? "Unknown",
        isRecurring: t.isRecurring ?? false,
        needsReview: t.needsReview ?? false,
        notes: t.notes ?? null,
      });
    }

    if (!page.hasMore || txns.length < limit) break;
    offset += limit;
  }

  return all;
}
