import { getClient } from "../src/auth";
import { loadAlertConfig } from "../src/config";
import { runAllAlerts } from "../src/alerts";
import { dedup, markSent } from "../src/alerts/dedup";
import { alertEmail } from "../src/email/templates";
import { sendEmail, closeTransport } from "../src/email/sender";

async function main() {
  const client = await getClient();
  try {
    const config = loadAlertConfig();
    const allAlerts = await runAllAlerts(client, config);

    console.log(`${allAlerts.length} alert(s) detected.`);

    const alerts = dedup(allAlerts);

    if (alerts.length === 0) {
      console.log("All alerts already sent — nothing new.");
      return;
    }

    console.log(`${alerts.length} new alert(s) to send:`);
    for (const a of alerts) {
      console.log(`  [${a.severity}] ${a.title}`);
    }

    const html = alertEmail(alerts);
    await sendEmail(`Monarch Alerts: ${alerts.length} item(s)`, html);
    markSent(alerts);
    console.log("Alert email sent.");
  } finally {
    closeTransport();
    await client.close?.();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Alert run failed:", err.message ?? err);
    process.exit(1);
  });
