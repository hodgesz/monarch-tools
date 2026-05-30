import "dotenv/config";

export interface Config {
  email: string;
  password: string;
  mfaSecret?: string;
  cacheEncryptionKey?: string;
  logLevel: "debug" | "info" | "warn" | "error";
}

export function loadConfig(): Config {
  const email = process.env.MONARCH_EMAIL;
  const password = process.env.MONARCH_PASSWORD;

  if (!email || !password) {
    console.error(
      "Missing MONARCH_EMAIL or MONARCH_PASSWORD in .env file.\n" +
        "Copy .env.example to .env and fill in your credentials."
    );
    process.exit(1);
  }

  return {
    email,
    password,
    mfaSecret: process.env.MONARCH_MFA_SECRET || undefined,
    cacheEncryptionKey: process.env.MONARCH_CACHE_ENCRYPTION_KEY || undefined,
    logLevel:
      (process.env.MONARCH_LOG_LEVEL as Config["logLevel"]) || "warn",
  };
}

export interface AlertConfig {
  gmail: { user: string; appPassword: string };
  recipients: string[];
  thresholds: {
    largePurchase: number;
    budgetWarningPercent: number;
    budgetExceededPercent: number;
    anomalyMultiplier: number;
    upcomingBillsDays: number;
  };
}

export function loadAlertConfig(): AlertConfig {
  const user = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  const recipients = process.env.ALERT_RECIPIENTS;

  if (!user || !appPassword || !recipients) {
    console.error(
      "Missing GMAIL_USER, GMAIL_APP_PASSWORD, or ALERT_RECIPIENTS in .env file.\n" +
        "See .env.example for setup instructions."
    );
    process.exit(1);
  }

  return {
    gmail: { user, appPassword },
    recipients: recipients.split(",").map((e) => e.trim()),
    thresholds: {
      largePurchase: Number(process.env.ALERT_LARGE_PURCHASE_THRESHOLD) || 100,
      budgetWarningPercent:
        Number(process.env.ALERT_BUDGET_WARNING_PERCENT) || 80,
      budgetExceededPercent:
        Number(process.env.ALERT_BUDGET_EXCEEDED_PERCENT) || 100,
      anomalyMultiplier:
        Number(process.env.ALERT_ANOMALY_MULTIPLIER) || 1.5,
      upcomingBillsDays:
        Number(process.env.ALERT_UPCOMING_BILLS_DAYS) || 7,
    },
  };
}
