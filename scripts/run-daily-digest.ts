import { getClient } from "../src/auth";
import { buildDailyDigest } from "../src/reports/daily-digest";
import { dailyDigestEmail } from "../src/email/templates";
import { sendEmail, closeTransport } from "../src/email/sender";

async function main() {
  const client = await getClient();
  try {
    const data = await buildDailyDigest(client);
    const html = dailyDigestEmail(data);
    await sendEmail(`Daily Digest — ${data.date}`, html);
    console.log("Daily digest sent.");
  } finally {
    closeTransport();
    await client.close?.();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Daily digest failed:", err.message ?? err);
    process.exit(1);
  });
