import { getDb } from "./db";

// Default analysis window: post-cleanup era only.
// Pre-2026 data is unreliable due to recategorization churn.
export const DEFAULT_START_DATE = "2026-01-01";

export interface QueryOpts {
  startDate?: string;
  endDate?: string;
  includeTransfers?: boolean;
  includeHidden?: boolean;
}

function resolveOpts(opts: QueryOpts = {}) {
  return {
    startDate: opts.startDate ?? DEFAULT_START_DATE,
    endDate: opts.endDate ?? new Date().toISOString().split("T")[0],
    includeTransfers: opts.includeTransfers ?? false,
    includeHidden: opts.includeHidden ?? false,
  };
}

/**
 * Patterns that get mis-tagged as income in Monarch:
 *   - Credit card payments ("Payment Thank You - Web") — intra-account transfer
 *   - Self-transfers (the account holder's own name as merchant) — moving money
 *     between own accounts. Set MONARCH_ACCOUNT_HOLDER to your name to filter these.
 *   - ATM check deposits that double-count alongside the cash move
 */
function buildIncomeNoiseSql(): string {
  const clauses = [
    `(t.merchant_name = 'Payment' AND (t.description LIKE 'Payment Thank%' OR t.original_description LIKE 'Payment Thank%'))`,
    `t.merchant_name = 'ATM Check Deposit'`,
  ];
  // Self-transfers show up under the account holder's name as the merchant.
  // Use a bound parameter so the name never has to be hardcoded here.
  const holder = (process.env.MONARCH_ACCOUNT_HOLDER ?? "").trim();
  if (holder) clauses.push(`t.merchant_name = @accountHolder`);
  return `(\n  ${clauses.join("\n  OR ")}\n)`;
}

const INCOME_NOISE_SQL = buildIncomeNoiseSql();

// Bound params required by INCOME_NOISE_SQL. Empty unless an account holder is
// configured, so queries that don't reference the noise filter stay unaffected.
const ACCOUNT_HOLDER = (process.env.MONARCH_ACCOUNT_HOLDER ?? "").trim();
const NOISE_PARAMS: Record<string, string> = ACCOUNT_HOLDER
  ? { accountHolder: ACCOUNT_HOLDER }
  : {};

function expenseFilterSql(includeTransfers: boolean, includeHidden: boolean) {
  const parts: string[] = [
    "t.deleted_at IS NULL",
    "t.amount < 0", // expenses only
    "t.date BETWEEN @startDate AND @endDate",
  ];
  if (!includeTransfers) {
    parts.push(
      "COALESCE(c.group_type, '') != 'transfer'",
      "COALESCE(c.name, '') NOT IN ('Transfer', 'Credit Card Payment', 'Balance Adjustments')"
    );
  }
  if (!includeHidden) parts.push("t.is_hidden = 0");
  return parts.join(" AND ");
}

// ---- Rollups ----

export interface MonthlyCategoryRow {
  month: string;           // YYYY-MM
  category_id: string;
  category_name: string;
  group_name: string | null;
  total_expense: number;   // positive dollars
  txn_count: number;
}

export function monthlySpendByCategory(opts: QueryOpts = {}): MonthlyCategoryRow[] {
  const o = resolveOpts(opts);
  const db = getDb();
  return db
    .prepare(
      `SELECT
         substr(t.date, 1, 7) AS month,
         t.category_id,
         c.name AS category_name,
         c.group_name AS group_name,
         ROUND(SUM(-t.amount), 2) AS total_expense,
         COUNT(*) AS txn_count
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE ${expenseFilterSql(o.includeTransfers, o.includeHidden)}
       GROUP BY month, t.category_id
       ORDER BY month, total_expense DESC`
    )
    .all(o) as MonthlyCategoryRow[];
}

export interface MonthlyTotalRow {
  month: string;
  total_expense: number;
  total_income: number;
  net: number;
  txn_count: number;
}

export function monthlyTotals(opts: QueryOpts = {}): MonthlyTotalRow[] {
  const o = resolveOpts(opts);
  const db = getDb();
  const transferFilter = o.includeTransfers
    ? ""
    : `AND COALESCE(c.group_type, '') != 'transfer'`;
  const hiddenFilter = o.includeHidden ? "" : "AND t.is_hidden = 0";
  return db
    .prepare(
      `SELECT
         substr(t.date, 1, 7) AS month,
         ROUND(SUM(CASE WHEN t.amount < 0 THEN -t.amount ELSE 0 END), 2) AS total_expense,
         ROUND(SUM(CASE
           WHEN t.amount > 0 AND NOT ${INCOME_NOISE_SQL} THEN t.amount
           ELSE 0 END), 2) AS total_income,
         ROUND(SUM(CASE
           WHEN NOT ${INCOME_NOISE_SQL} THEN -t.amount
           ELSE 0 END), 2) AS net,
         COUNT(*) AS txn_count
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.deleted_at IS NULL
         AND t.date BETWEEN @startDate AND @endDate
         ${transferFilter}
         ${hiddenFilter}
       GROUP BY month
       ORDER BY month`
    )
    .all({ ...o, ...NOISE_PARAMS }) as MonthlyTotalRow[];
}

// ---- Month-over-month ----

export interface MoMRow {
  category_id: string;
  category_name: string;
  current_month: string;
  current_amount: number;
  prior_month: string;
  prior_amount: number;
  delta_abs: number;
  delta_pct: number | null;
}

/** Compare the last full or in-progress month to the one before it. */
export function momByCategory(opts: QueryOpts = {}): MoMRow[] {
  const rows = monthlySpendByCategory(opts);
  if (rows.length === 0) return [];

  const months = Array.from(new Set(rows.map((r) => r.month))).sort();
  if (months.length < 2) return [];

  const current = months[months.length - 1];
  const prior = months[months.length - 2];

  const byCat = new Map<
    string,
    { name: string; current: number; prior: number }
  >();

  for (const r of rows) {
    if (r.month !== current && r.month !== prior) continue;
    const entry = byCat.get(r.category_id) ?? {
      name: r.category_name,
      current: 0,
      prior: 0,
    };
    if (r.month === current) entry.current = r.total_expense;
    else entry.prior = r.total_expense;
    byCat.set(r.category_id, entry);
  }

  const result: MoMRow[] = [];
  for (const [id, v] of byCat) {
    const delta = v.current - v.prior;
    result.push({
      category_id: id,
      category_name: v.name,
      current_month: current,
      current_amount: v.current,
      prior_month: prior,
      prior_amount: v.prior,
      delta_abs: Math.round(delta * 100) / 100,
      delta_pct: v.prior > 0 ? Math.round((delta / v.prior) * 1000) / 10 : null,
    });
  }

  result.sort((a, b) => Math.abs(b.delta_abs) - Math.abs(a.delta_abs));
  return result;
}

// ---- Rolling average ----

export interface RollingAvgRow {
  category_id: string;
  category_name: string;
  months_observed: number;
  avg_monthly: number;
  current_month: string;
  current_amount: number;
  variance_pct: number | null; // (current - avg) / avg * 100
}

/**
 * Average monthly spend per category over the observed window, plus
 * how this month is tracking vs that average.
 */
export function rollingAverageByCategory(opts: QueryOpts = {}): RollingAvgRow[] {
  const rows = monthlySpendByCategory(opts);
  if (rows.length === 0) return [];

  const months = Array.from(new Set(rows.map((r) => r.month))).sort();
  const current = months[months.length - 1];
  const priorMonths = months.slice(0, -1);

  const byCat = new Map<
    string,
    { name: string; monthly: Map<string, number> }
  >();
  for (const r of rows) {
    const entry = byCat.get(r.category_id) ?? {
      name: r.category_name,
      monthly: new Map(),
    };
    entry.monthly.set(r.month, r.total_expense);
    byCat.set(r.category_id, entry);
  }

  const result: RollingAvgRow[] = [];
  for (const [id, v] of byCat) {
    const priorAmounts = priorMonths
      .map((m) => v.monthly.get(m) ?? 0)
      .filter((_, i) => v.monthly.has(priorMonths[i]));
    const monthsObserved = priorAmounts.length;
    if (monthsObserved === 0) continue;

    const avg =
      priorAmounts.reduce((sum, n) => sum + n, 0) / monthsObserved;
    const currentAmount = v.monthly.get(current) ?? 0;
    result.push({
      category_id: id,
      category_name: v.name,
      months_observed: monthsObserved,
      avg_monthly: Math.round(avg * 100) / 100,
      current_month: current,
      current_amount: Math.round(currentAmount * 100) / 100,
      variance_pct:
        avg > 0 ? Math.round(((currentAmount - avg) / avg) * 1000) / 10 : null,
    });
  }

  result.sort((a, b) => b.avg_monthly - a.avg_monthly);
  return result;
}

// ---- Budget burn rate ----

export interface BurnRateRow {
  category_id: string;
  category_name: string;
  planned: number;
  actual_so_far: number;
  pct_used: number;
  pct_month_elapsed: number;
  projected_month_end: number;
  projected_overage: number;
  on_pace: boolean;
}

/**
 * Project month-end spend by linearly extrapolating the actual-to-date
 * rate, using the latest budget snapshot for the given month.
 */
export function budgetBurnRate(
  month?: string
): BurnRateRow[] {
  const db = getDb();
  const today = new Date();
  const monthStart =
    month ??
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const [year, mon] = monthStart.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const dayOfMonth = Math.min(today.getDate(), lastDay);
  const pctElapsed = dayOfMonth / lastDay;

  // Use the latest snapshot per (month, category_id).
  const snapshots = db
    .prepare(
      `SELECT s.category_id, s.category_name, s.planned_amount, s.actual_amount
       FROM budget_snapshots s
       INNER JOIN (
         SELECT category_id, MAX(captured_at) AS latest
         FROM budget_snapshots
         WHERE month = ?
         GROUP BY category_id
       ) latest_s
         ON latest_s.category_id = s.category_id
        AND latest_s.latest = s.captured_at
       WHERE s.month = ?
         AND s.planned_amount > 0`
    )
    .all(monthStart, monthStart) as Array<{
    category_id: string;
    category_name: string;
    planned_amount: number;
    actual_amount: number;
  }>;

  return snapshots
    .map((s) => {
      const projected =
        pctElapsed > 0
          ? (s.actual_amount / pctElapsed)
          : s.actual_amount;
      return {
        category_id: s.category_id,
        category_name: s.category_name,
        planned: Math.round(s.planned_amount * 100) / 100,
        actual_so_far: Math.round(s.actual_amount * 100) / 100,
        pct_used:
          Math.round((s.actual_amount / s.planned_amount) * 1000) / 10,
        pct_month_elapsed: Math.round(pctElapsed * 1000) / 10,
        projected_month_end: Math.round(projected * 100) / 100,
        projected_overage:
          Math.round((projected - s.planned_amount) * 100) / 100,
        on_pace: projected <= s.planned_amount,
      };
    })
    .sort((a, b) => b.projected_overage - a.projected_overage);
}

// ---- Top merchants ----

export interface MerchantRow {
  merchant_name: string;
  total_spent: number;
  txn_count: number;
  avg_amount: number;
  first_seen: string;
  last_seen: string;
}

export function topMerchants(
  opts: QueryOpts & { limit?: number } = {}
): MerchantRow[] {
  const o = resolveOpts(opts);
  const limit = opts.limit ?? 25;
  const db = getDb();
  return db
    .prepare(
      `SELECT
         COALESCE(t.merchant_name, 'Unknown') AS merchant_name,
         ROUND(SUM(-t.amount), 2) AS total_spent,
         COUNT(*) AS txn_count,
         ROUND(AVG(-t.amount), 2) AS avg_amount,
         MIN(t.date) AS first_seen,
         MAX(t.date) AS last_seen
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE ${expenseFilterSql(o.includeTransfers, o.includeHidden)}
       GROUP BY merchant_name
       ORDER BY total_spent DESC
       LIMIT ?`
    )
    .all({ ...o }, limit) as MerchantRow[];
}

// ---- Income (noise-filtered) ----

export interface IncomeBreakdownRow {
  month: string;
  gross_income: number;     // raw positive-amount sum, pre-filter
  noise_filtered: number;   // noise amount we removed
  true_income: number;      // gross - noise
  paychecks: number;        // Paychecks category only
  other_income: number;     // clean non-paycheck income
  paycheck_count: number;
}

export function incomeBreakdown(opts: QueryOpts = {}): IncomeBreakdownRow[] {
  const o = resolveOpts(opts);
  const db = getDb();
  return db
    .prepare(
      `SELECT
         substr(t.date, 1, 7) AS month,
         ROUND(SUM(t.amount), 2) AS gross_income,
         ROUND(SUM(CASE WHEN ${INCOME_NOISE_SQL} THEN t.amount ELSE 0 END), 2) AS noise_filtered,
         ROUND(SUM(CASE WHEN ${INCOME_NOISE_SQL} THEN 0 ELSE t.amount END), 2) AS true_income,
         ROUND(SUM(CASE
           WHEN c.name = 'Paychecks' AND NOT ${INCOME_NOISE_SQL} THEN t.amount
           ELSE 0 END), 2) AS paychecks,
         ROUND(SUM(CASE
           WHEN c.name != 'Paychecks' AND COALESCE(c.group_type,'') = 'income' AND NOT ${INCOME_NOISE_SQL} THEN t.amount
           ELSE 0 END), 2) AS other_income,
         SUM(CASE WHEN c.name = 'Paychecks' AND NOT ${INCOME_NOISE_SQL} THEN 1 ELSE 0 END) AS paycheck_count
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.deleted_at IS NULL
         AND t.amount > 0
         AND t.date BETWEEN @startDate AND @endDate
         AND t.is_hidden = 0
       GROUP BY month
       ORDER BY month`
    )
    .all({ ...o, ...NOISE_PARAMS }) as IncomeBreakdownRow[];
}

// ---- Recurring / subscription discovery ----

export interface SubscriptionCandidate {
  merchant_name: string;
  txn_count: number;
  total_spent: number;
  avg_amount: number;
  stddev_amount: number;
  cv: number; // coefficient of variation = stddev/avg
  first_seen: string;
  last_seen: string;
}

/**
 * Candidate subscriptions: merchants with low-variance recurring charges.
 * Default: ≥3 charges in window, coefficient of variation < 0.15.
 */
export function subscriptionCandidates(
  opts: QueryOpts & { minCharges?: number; maxCv?: number } = {}
): SubscriptionCandidate[] {
  const o = resolveOpts(opts);
  const minCharges = opts.minCharges ?? 3;
  const maxCv = opts.maxCv ?? 0.15;
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT
         COALESCE(t.merchant_name, 'Unknown') AS merchant_name,
         COUNT(*) AS txn_count,
         ROUND(SUM(-t.amount), 2) AS total_spent,
         AVG(-t.amount) AS avg_amount,
         MIN(t.date) AS first_seen,
         MAX(t.date) AS last_seen,
         GROUP_CONCAT(-t.amount) AS amounts_csv
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE ${expenseFilterSql(o.includeTransfers, o.includeHidden)}
       GROUP BY merchant_name
       HAVING txn_count >= ?`
    )
    .all({ ...o }, minCharges) as Array<{
    merchant_name: string;
    txn_count: number;
    total_spent: number;
    avg_amount: number;
    first_seen: string;
    last_seen: string;
    amounts_csv: string;
  }>;

  const result: SubscriptionCandidate[] = [];
  for (const r of rows) {
    const amounts = r.amounts_csv.split(",").map(Number);
    const mean = r.avg_amount;
    const variance =
      amounts.reduce((sum, n) => sum + (n - mean) ** 2, 0) / amounts.length;
    const stddev = Math.sqrt(variance);
    const cv = mean > 0 ? stddev / mean : Infinity;
    if (cv > maxCv) continue;
    result.push({
      merchant_name: r.merchant_name,
      txn_count: r.txn_count,
      total_spent: r.total_spent,
      avg_amount: Math.round(mean * 100) / 100,
      stddev_amount: Math.round(stddev * 100) / 100,
      cv: Math.round(cv * 1000) / 1000,
      first_seen: r.first_seen,
      last_seen: r.last_seen,
    });
  }

  result.sort((a, b) => b.total_spent - a.total_spent);
  return result;
}
