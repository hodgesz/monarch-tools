import { MonarchClient, MonarchSessionExpiredError } from "monarchmoney";
import { loadConfig, type Config } from "./config";

let clientInstance: MonarchClient | null = null;

/**
 * Get an authenticated MonarchClient. Reuses a cached instance within
 * the same process. Tries the saved session first, falls back to
 * credentials, and handles MFA/TOTP automatically when configured.
 */
export async function getClient(): Promise<MonarchClient> {
  if (clientInstance) {
    try {
      await clientInstance.ensureValidSession();
      return clientInstance;
    } catch (e) {
      if (e instanceof MonarchSessionExpiredError) {
        console.log("Session expired, re-authenticating...");
        clientInstance = null;
      } else {
        throw e;
      }
    }
  }

  const config = loadConfig();
  const client = new MonarchClient({
    baseURL: "https://api.monarch.com",
    email: config.email,
    password: config.password,
    cacheEncryptionKey: config.cacheEncryptionKey,
    logLevel: config.logLevel,
  });

  // Try loading a saved session first
  if (client.loadSession()) {
    const valid = await client.validateSession();
    if (valid) {
      clientInstance = client;
      return client;
    }
    console.log("Saved session is invalid, logging in fresh...");
    client.deleteSession();
  }

  await authenticate(client, config);
  clientInstance = client;
  return client;
}

async function authenticate(
  client: MonarchClient,
  config: Config
): Promise<void> {
  if (config.mfaSecret) {
    // directLogin is the recommended path when TOTP secret is available
    await client.directLogin({
      email: config.email,
      password: config.password,
      mfaSecretKey: config.mfaSecret,
      saveSession: true,
    });
  } else {
    await client.login({
      email: config.email,
      password: config.password,
      useSavedSession: false,
      saveSession: true,
    });
  }
}
