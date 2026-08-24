import Redis from "ioredis";

const TENANT_PUBLICATION_SUPERVISOR_HEARTBEAT_KEY = "asas:health:worker:tenant-publication-supervisor";

const url = process.env.REDIS_URL;
if (!url) throw new Error("REDIS_URL_MISSING");
const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });

try {
  await client.connect();
  const ttl = await client.ttl(TENANT_PUBLICATION_SUPERVISOR_HEARTBEAT_KEY);
  const pass = ttl > 0;
  process.stdout.write(JSON.stringify({ status: pass ? "PASS_VPS_STAGING_WORKER_HEARTBEAT" : "FAIL_VPS_STAGING_WORKER_HEARTBEAT", ttlPositive: pass, credentialsPersisted: false }) + "\n");
  process.exitCode = pass ? 0 : 2;
} finally {
  await client.quit().catch(() => undefined);
}
