import Redis from "ioredis";

const mode = process.env.ASAS_PROOF_REDIS_MODE;
const url = process.env.REDIS_URL;
const userA = process.env.ASAS_PROOF_REDIS_USER_A;
const userB = process.env.ASAS_PROOF_REDIS_USER_B;
const passwordA = process.env.ASAS_PROOF_REDIS_PASSWORD_A;
const passwordB = process.env.ASAS_PROOF_REDIS_PASSWORD_B;
const orgA = process.env.ASAS_PROOF_ORG_A;
const orgB = process.env.ASAS_PROOF_ORG_B;

if (!url || !mode || !userA || !userB || !orgA || !orgB) throw new Error("VPS_REDIS_FIXTURE_CONFIGURATION_MISSING");
if (mode === "provision" && (!passwordA || !passwordB)) throw new Error("VPS_REDIS_FIXTURE_PASSWORD_MISSING");
if (!/^[A-Za-z0-9_:-]{8,128}$/.test(userA) || !/^[A-Za-z0-9_:-]{8,128}$/.test(userB)) throw new Error("VPS_REDIS_FIXTURE_USER_INVALID");

const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });

async function unlinkPattern(pattern) {
  let cursor = "0";
  do {
    const [next, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = next;
    if (keys.length) await client.unlink(...keys);
  } while (cursor !== "0");
}

try {
  await client.connect();
  if (mode === "provision") {
    await client.acl("SETUSER", userA, "on", `>${passwordA}`, "+@all", `~bull:asas_tenant_${orgA}_*`, `~asas:tenant:${orgA}:*`);
    await client.acl("SETUSER", userB, "on", `>${passwordB}`, "+@all", `~bull:asas_tenant_${orgB}_*`, `~asas:tenant:${orgB}:*`);
  } else if (mode === "cleanup") {
    await Promise.all([
      unlinkPattern(`bull:asas_tenant_${orgA}_*`),
      unlinkPattern(`bull:asas_tenant_${orgB}_*`),
      unlinkPattern(`asas:tenant:${orgA}:*`),
      unlinkPattern(`asas:tenant:${orgB}:*`),
    ]);
    await client.acl("DELUSER", userA, userB);
  } else {
    throw new Error("VPS_REDIS_FIXTURE_MODE_INVALID");
  }
  process.stdout.write(JSON.stringify({ status: `PASS_VPS_REDIS_FIXTURE_${mode.toUpperCase()}`, credentialsPersisted: false }) + "\n");
} finally {
  await client.quit().catch(() => undefined);
}
