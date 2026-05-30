import { getClient } from "../src/auth";
import { buildWeeklySummary } from "../src/reports/weekly-summary";
import { weeklySummaryEmail } from "../src/email/templates";
import { sendEmail, closeTransport } from "../src/email/sender";

async function main() {
  const client = await getClient();
  try {
    const data = await buildWeeklySummary(client);
    const html = weeklySummaryEmail(data);
    await sendEmail(
      `Weekly Summary — ${data.weekStartDate} to ${data.weekEndDate}`,
      html
    );
    console.log("Weekly summary sent.");
  } finally {
    closeTransport();
    await client.close?.();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Weekly summary failed:", err.message ?? err);
    process.exit(1);
  });
