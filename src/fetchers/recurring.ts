import type { MonarchClient } from "monarchmoney";

export interface NormalizedRecurring {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  recurringType: string;
  dayOfTheMonth?: number;
  baseDate?: string;
}

export interface UpcomingBill {
  id: string;
  merchantName: string;
  amount: number;
  date: string;
  categoryName: string;
  accountName: string;
}

export async function getRecurringStreams(
  client: MonarchClient
): Promise<NormalizedRecurring[]> {
  const raw = await client.recurring.getRecurringStreams();
  const items = Array.isArray(raw) ? raw : [];

  return items.map((item: any) => {
    const s = item.stream || item;
    return {
      id: s.id,
      name: s.name ?? "Unknown",
      amount: s.amount,
      frequency: s.frequency ?? "unknown",
      recurringType: s.recurringType ?? "expense",
      dayOfTheMonth: s.dayOfTheMonth ?? undefined,
      baseDate: s.baseDate ?? undefined,
    };
  });
}

export async function getUpcomingBills(
  client: MonarchClient,
  days: number
): Promise<UpcomingBill[]> {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);

  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const raw = await client.recurring.getUpcomingRecurringItems({
    startDate: fmt(today),
    endDate: fmt(endDate),
  });

  const items = Array.isArray(raw) ? raw : [];

  return items.map((item: any) => {
    const stream = item.stream || {};
    return {
      id: item.id ?? stream.id ?? "",
      merchantName: stream.merchant?.name ?? stream.name ?? item.name ?? "Unknown",
      amount: item.amount ?? stream.amount ?? 0,
      date: item.date ?? item.expectedDate ?? fmt(today),
      categoryName:
        item.category?.name ?? stream.category?.name ?? "Uncategorized",
      accountName:
        item.account?.displayName ?? stream.account?.displayName ?? "Unknown",
    };
  });
}
