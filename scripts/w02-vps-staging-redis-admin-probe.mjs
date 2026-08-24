import { randomBytes } from "node:crypto";
import Redis from "ioredis";

const url = process.env.REDIS_URL;
if (!url) throw new Error("REDIS_URL_MISSING");
const user = `asas_probe_${Date.now()}_${process.pid}`;
const password = randomBytes(24).toString("hex");
const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });

try {
  await client.connect();
  const identity = await client.acl("WHOAMI");
  await client.acl("SETUSER", user, "on", `>${password}`, "+@all", "~asas:probe:*");
  await client.acl("DELUSER", user);
  process.stdout.write(JSON.stringify({ status: "PASS_VPS_STAGING_REDIS_ADMIN_PROBE", runtimeIdentity: identity ? "REDACTED" : "MISSING", credentialsPersisted: false }) + "\n");
} finally {
  await client.acl("DELUSER", user).catch(() => undefined);
  await client.quit().catch(() => undefined);
}
