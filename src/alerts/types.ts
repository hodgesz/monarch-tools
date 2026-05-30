export type AlertType =
  | "large-purchase"
  | "new-recurring"
  | "budget-warning"
  | "budget-exceeded"
  | "anomaly"
  | "upcoming-bill";

export type Severity = "info" | "warning" | "critical";

export interface AlertResult {
  type: AlertType;
  severity: Severity;
  title: string;
  message: string;
  data: Record<string, unknown>;
  /** Stable key for deduplication — same fingerprint = same logical alert */
  fingerprint: string;
}
