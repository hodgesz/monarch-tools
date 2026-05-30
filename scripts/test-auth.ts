import { getClient } from "../src/auth";

async function main() {
  console.log("Connecting to Monarch Money...\n");

  const client = await getClient();

  // Verify we're logged in by fetching user profile
  const me = await client.get_me();
  console.log(
    "Logged in as:",
    (me as Record<string, unknown>)?.name ??
      (me as Record<string, unknown>)?.email ??
      me
  );

  // Pull accounts as a quick sanity check
  const accounts = await client.accounts.getAll();
  console.log(`\nFound ${accounts.length} accounts:\n`);
  for (const acct of accounts) {
    const label = acct.institutionName
      ? `${acct.displayName} (${acct.institutionName})`
      : acct.displayName;
    console.log(`  ${label}: $${acct.currentBalance.toFixed(2)}`);
  }

  console.log("\nAuth test passed!");
}

main().catch((err) => {
  console.error("Auth test failed:", err.message ?? err);
  process.exit(1);
});
