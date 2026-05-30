import type { AlertResult } from "../alerts/types";
import type { NormalizedTransaction } from "../fetchers/transactions";
import type { BudgetCategoryStatus } from "../fetchers/budgets";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#dc3545",
  warning: "#fd7e14",
  info: "#0d6efd",
};

const SEVERITY_ICONS: Record<string, string> = {
  critical: "🔴",
  warning: "🟡",
  info: "🔵",
};

// --- Alert Email ---

export function alertEmail(alerts: AlertResult[]): string {
  const items = alerts
    .map(
      (a) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">
        <span style="color: ${SEVERITY_COLORS[a.severity] ?? "#333"}">${SEVERITY_ICONS[a.severity] ?? ""}</span>
        <strong>${a.title}</strong><br>
        <span style="color: #666; font-size: 14px;">${a.message.replace(/\n/g, "<br>")}</span>
      </td>
    </tr>`
    )
    .join("");

  return `
<h2 style="margin: 0 0 16px 0;">Monarch Alerts</h2>
<p style="color: #666; margin-bottom: 20px;">${alerts.length} alert${alerts.length === 1 ? "" : "s"} as of ${new Date().toLocaleDateString()}</p>
<table style="width: 100%; border-collapse: collapse;">
  ${items}
</table>`;
}

// --- Daily Digest ---

export interface DailyDigestData {
  date: string;
  yesterdayTransactions: NormalizedTransaction[];
  monthToDateSpending: number;
  monthToDateIncome: number;
  budgetHighlights: BudgetCategoryStatus[];
  upcomingBillCount: number;
  upcomingBillTotal: number;
}

export function dailyDigestEmail(data: DailyDigestData): string {
  const txnRows = data.yesterdayTransactions
    .map(
      (t) => `
    <tr>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;">${t.merchantName}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; text-align: right; color: ${t.amount < 0 ? "#dc3545" : "#198754"};">$${Math.abs(t.amount).toFixed(2)}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; color: #666;">${t.categoryName}</td>
    </tr>`
    )
    .join("");

  const budgetRows = data.budgetHighlights
    .map((c) => {
      const pct = c.percentUsed;
      const color = pct >= 100 ? "#dc3545" : pct >= 80 ? "#fd7e14" : "#198754";
      return `
    <tr>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;">${c.categoryIcon} ${c.categoryName}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; text-align: right;">$${c.actualAmount.toFixed(0)} / $${c.plannedAmount.toFixed(0)}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; text-align: right; color: ${color}; font-weight: bold;">${pct === Infinity ? "No budget" : pct.toFixed(0) + "%"}</td>
    </tr>`;
    })
    .join("");

  return `
<h2 style="margin: 0 0 4px 0;">Daily Digest</h2>
<p style="color: #666; margin: 0 0 20px 0;">${data.date}</p>

<div style="display: flex; gap: 16px; margin-bottom: 24px;">
  <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; flex: 1;">
    <div style="font-size: 12px; color: #666; text-transform: uppercase;">Month Spending</div>
    <div style="font-size: 24px; font-weight: bold; color: #dc3545;">$${Math.abs(data.monthToDateSpending).toFixed(2)}</div>
  </div>
  <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; flex: 1;">
    <div style="font-size: 12px; color: #666; text-transform: uppercase;">Month Income</div>
    <div style="font-size: 24px; font-weight: bold; color: #198754;">$${Math.abs(data.monthToDateIncome).toFixed(2)}</div>
  </div>
  <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; flex: 1;">
    <div style="font-size: 12px; color: #666; text-transform: uppercase;">Upcoming Bills</div>
    <div style="font-size: 24px; font-weight: bold;">${data.upcomingBillCount}</div>
    <div style="font-size: 12px; color: #666;">$${data.upcomingBillTotal.toFixed(2)} due</div>
  </div>
</div>

${
  data.yesterdayTransactions.length > 0
    ? `
<h3 style="margin: 0 0 8px 0;">Yesterday's Transactions</h3>
<table style="width: 100%; border-collapse: collapse; font-size: 14px;">
  <tr style="background: #f8f9fa;">
    <th style="padding: 8px 12px; text-align: left;">Merchant</th>
    <th style="padding: 8px 12px; text-align: right;">Amount</th>
    <th style="padding: 8px 12px; text-align: left;">Category</th>
  </tr>
  ${txnRows}
</table>`
    : '<p style="color: #666;">No transactions yesterday.</p>'
}

${
  data.budgetHighlights.length > 0
    ? `
<h3 style="margin: 20px 0 8px 0;">Budget Highlights</h3>
<table style="width: 100%; border-collapse: collapse; font-size: 14px;">
  <tr style="background: #f8f9fa;">
    <th style="padding: 8px 12px; text-align: left;">Category</th>
    <th style="padding: 8px 12px; text-align: right;">Spent / Budget</th>
    <th style="padding: 8px 12px; text-align: right;">Used</th>
  </tr>
  ${budgetRows}
</table>`
    : ""
}`;
}

// --- Weekly Summary ---

export interface WeeklySummaryData {
  weekStartDate: string;
  weekEndDate: string;
  budgetProgress: BudgetCategoryStatus[];
  topSpendingCategories: Array<{ name: string; amount: number }>;
  weekTransactionCount: number;
  weekTotalSpent: number;
  monthComparison: {
    currentMonthSpent: number;
    lastMonthSamePoint: number;
    percentChange: number;
  };
  warehouse?: WarehouseInsights;
}

export interface WarehouseInsights {
  incomeByMonth: Array<{
    month: string;
    paychecks: number;
    otherIncome: number;
    trueIncome: number;
  }>;
  momTopMovers: Array<{
    category: string;
    current: number;
    prior: number;
    deltaAbs: number;
    deltaPct: number | null;
  }>;
  rollingAverageOutliers: Array<{
    category: string;
    avgMonthly: number;
    currentAmount: number;
    variancePct: number | null;
  }>;
  topMerchants: Array<{ name: string; total: number; count: number }>;
  subscriptionCandidates: Array<{
    name: string;
    avgAmount: number;
    totalSpent: number;
    chargeCount: number;
  }>;
  subscriptionMonthlyTotal: number;
}

export function weeklySummaryEmail(data: WeeklySummaryData): string {
  const budgetRows = data.budgetProgress
    .filter((c) => c.plannedAmount > 0)
    .sort((a, b) => b.percentUsed - a.percentUsed)
    .slice(0, 15)
    .map((c) => {
      const pct = c.percentUsed;
      const barWidth = Math.min(pct, 100);
      const color = pct >= 100 ? "#dc3545" : pct >= 80 ? "#fd7e14" : "#198754";
      return `
    <tr>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;">${c.categoryIcon} ${c.categoryName}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;">
        <div style="background: #e9ecef; border-radius: 4px; height: 12px; width: 100px; display: inline-block; vertical-align: middle;">
          <div style="background: ${color}; border-radius: 4px; height: 12px; width: ${barWidth}px;"></div>
        </div>
        <span style="font-size: 12px; color: ${color}; margin-left: 4px;">${pct.toFixed(0)}%</span>
      </td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; text-align: right;">$${c.actualAmount.toFixed(0)} / $${c.plannedAmount.toFixed(0)}</td>
    </tr>`;
    })
    .join("");

  const topCatRows = data.topSpendingCategories
    .slice(0, 8)
    .map(
      (c) => `
    <tr>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;">${c.name}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: bold;">$${Math.abs(c.amount).toFixed(2)}</td>
    </tr>`
    )
    .join("");

  const comp = data.monthComparison;
  const compColor = comp.percentChange > 0 ? "#dc3545" : "#198754";
  const compArrow = comp.percentChange > 0 ? "↑" : "↓";

  const warehouseSection = data.warehouse
    ? renderWarehouseSection(data.warehouse)
    : "";

  return `
<h2 style="margin: 0 0 4px 0;">Weekly Summary</h2>
<p style="color: #666; margin: 0 0 20px 0;">${data.weekStartDate} — ${data.weekEndDate}</p>

<div style="display: flex; gap: 16px; margin-bottom: 24px;">
  <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; flex: 1;">
    <div style="font-size: 12px; color: #666; text-transform: uppercase;">This Week</div>
    <div style="font-size: 24px; font-weight: bold;">${data.weekTransactionCount} txns</div>
    <div style="font-size: 14px; color: #dc3545;">$${Math.abs(data.weekTotalSpent).toFixed(2)} spent</div>
  </div>
  <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; flex: 1;">
    <div style="font-size: 12px; color: #666; text-transform: uppercase;">Month vs Last Month</div>
    <div style="font-size: 24px; font-weight: bold; color: ${compColor};">${compArrow} ${Math.abs(comp.percentChange).toFixed(0)}%</div>
    <div style="font-size: 12px; color: #666;">$${Math.abs(comp.currentMonthSpent).toFixed(0)} vs $${Math.abs(comp.lastMonthSamePoint).toFixed(0)}</div>
  </div>
</div>

<h3 style="margin: 0 0 8px 0;">Budget Progress</h3>
<table style="width: 100%; border-collapse: collapse; font-size: 14px;">
  <tr style="background: #f8f9fa;">
    <th style="padding: 8px 12px; text-align: left;">Category</th>
    <th style="padding: 8px 12px; text-align: left;">Progress</th>
    <th style="padding: 8px 12px; text-align: right;">Spent / Budget</th>
  </tr>
  ${budgetRows}
</table>

<h3 style="margin: 20px 0 8px 0;">Top Spending Categories (This Week)</h3>
<table style="width: 100%; border-collapse: collapse; font-size: 14px;">
  ${topCatRows}
</table>
${warehouseSection}`;
}

function fmtMoney(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtMoney2(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderWarehouseSection(w: WarehouseInsights): string {
  const incomeRows = w.incomeByMonth
    .map(
      (m) => `
    <tr>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;">${m.month}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; text-align: right;">${fmtMoney(m.paychecks)}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; text-align: right;">${fmtMoney(m.otherIncome)}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: bold;">${fmtMoney(m.trueIncome)}</td>
    </tr>`
    )
    .join("");

  const momRows = w.momTopMovers
    .map((r) => {
      const color = r.deltaAbs > 0 ? "#dc3545" : "#198754";
      const pct =
        r.deltaPct === null
          ? "—"
          : `${r.deltaPct > 0 ? "+" : ""}${r.deltaPct}%`;
      return `
    <tr>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;">${r.category}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #666;">${fmtMoney(r.prior)}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; text-align: right;">${fmtMoney(r.current)}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; text-align: right; color: ${color}; font-weight: bold;">${r.deltaAbs > 0 ? "+" : ""}${fmtMoney(r.deltaAbs)} (${pct})</td>
    </tr>`;
    })
    .join("");

  const outlierRows = w.rollingAverageOutliers
    .map((r) => {
      const color =
        r.variancePct === null
          ? "#666"
          : r.variancePct > 0
            ? "#dc3545"
            : "#198754";
      const pct =
        r.variancePct === null
          ? "—"
          : `${r.variancePct > 0 ? "+" : ""}${r.variancePct}%`;
      return `
    <tr>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;">${r.category}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #666;">${fmtMoney(r.avgMonthly)}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; text-align: right;">${fmtMoney(r.currentAmount)}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; text-align: right; color: ${color}; font-weight: bold;">${pct}</td>
    </tr>`;
    })
    .join("");

  const merchantRows = w.topMerchants
    .map(
      (m) => `
    <tr>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;">${m.name}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; text-align: right;">${fmtMoney(m.total)}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #666;">${m.count} txns</td>
    </tr>`
    )
    .join("");

  const subRows = w.subscriptionCandidates
    .map(
      (s) => `
    <tr>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0;">${s.name}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; text-align: right;">${fmtMoney2(s.avgAmount)}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #666;">${s.chargeCount}×</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #f0f0f0; text-align: right;">${fmtMoney(s.totalSpent)}</td>
    </tr>`
    )
    .join("");

  return `
<hr style="margin: 32px 0; border: 0; border-top: 1px solid #dee2e6;">
<h2 style="margin: 0 0 4px 0;">Longitudinal Insights</h2>
<p style="color: #666; margin: 0 0 20px 0; font-size: 13px;">From local warehouse (2026+ only, noise-filtered)</p>

<h3 style="margin: 20px 0 8px 0;">Income by Month</h3>
<table style="width: 100%; border-collapse: collapse; font-size: 14px;">
  <tr style="background: #f8f9fa;">
    <th style="padding: 8px 12px; text-align: left;">Month</th>
    <th style="padding: 8px 12px; text-align: right;">Paychecks</th>
    <th style="padding: 8px 12px; text-align: right;">Other</th>
    <th style="padding: 8px 12px; text-align: right;">Total (clean)</th>
  </tr>
  ${incomeRows}
</table>

${
  w.momTopMovers.length > 0
    ? `
<h3 style="margin: 20px 0 8px 0;">Biggest Month-over-Month Movers</h3>
<table style="width: 100%; border-collapse: collapse; font-size: 14px;">
  <tr style="background: #f8f9fa;">
    <th style="padding: 8px 12px; text-align: left;">Category</th>
    <th style="padding: 8px 12px; text-align: right;">Prior</th>
    <th style="padding: 8px 12px; text-align: right;">Current</th>
    <th style="padding: 8px 12px; text-align: right;">Δ</th>
  </tr>
  ${momRows}
</table>`
    : ""
}

${
  w.rollingAverageOutliers.length > 0
    ? `
<h3 style="margin: 20px 0 8px 0;">This Month vs Rolling Average</h3>
<table style="width: 100%; border-collapse: collapse; font-size: 14px;">
  <tr style="background: #f8f9fa;">
    <th style="padding: 8px 12px; text-align: left;">Category</th>
    <th style="padding: 8px 12px; text-align: right;">Avg/Month</th>
    <th style="padding: 8px 12px; text-align: right;">Current</th>
    <th style="padding: 8px 12px; text-align: right;">Variance</th>
  </tr>
  ${outlierRows}
</table>`
    : ""
}

<h3 style="margin: 20px 0 8px 0;">Top Merchants (2026 YTD)</h3>
<table style="width: 100%; border-collapse: collapse; font-size: 14px;">
  ${merchantRows}
</table>

<h3 style="margin: 20px 0 8px 0;">Subscription Candidates</h3>
<p style="color: #666; margin: 0 0 8px 0; font-size: 13px;">Recurring charges totaling ${fmtMoney(w.subscriptionMonthlyTotal)}/mo on average. Review candidates you may no longer need.</p>
<table style="width: 100%; border-collapse: collapse; font-size: 14px;">
  <tr style="background: #f8f9fa;">
    <th style="padding: 8px 12px; text-align: left;">Merchant</th>
    <th style="padding: 8px 12px; text-align: right;">Avg</th>
    <th style="padding: 8px 12px; text-align: right;">Charges</th>
    <th style="padding: 8px 12px; text-align: right;">Total</th>
  </tr>
  ${subRows}
</table>`;
}
