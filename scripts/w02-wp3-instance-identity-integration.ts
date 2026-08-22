import { prisma } from "@/lib/db";
import { getOrCreateInstanceIdentity, verifyInstanceIdentity } from "@/lib/instance-identity";

const checks: Array<{ name: string; status: "PASS" | "FAIL"; detail: string }> = [];
const record = (name: string, ok: boolean, detail: string) => checks.push({ name, status: ok ? "PASS" : "FAIL", detail });

async function main() {
  const original = await prisma.instanceIdentity.findUnique({ where: { id: "singleton" } });
  try {
    await prisma.instanceIdentity.deleteMany();
    const created = await getOrCreateInstanceIdentity();
    const repeated = await getOrCreateInstanceIdentity();
    record("STABLE_IDENTITY", created.instanceId === repeated.instanceId, "Repeated resolution retains the random instance identity.");
    record("NO_HARDWARE_FINGERPRINT", /^[0-9a-f-]{36}$/i.test(created.instanceId), "Identity is random UUID, not host-derived.");
    const valid = await verifyInstanceIdentity();
    record("INTEGRITY_VALID", valid.valid, `Verification result: ${valid.reason}.`);
    const duplicateCount = await prisma.instanceIdentity.count();
    record("DUPLICATE_PREVENTED", duplicateCount === 1, `Singleton row count: ${duplicateCount}.`);
    await prisma.instanceIdentity.update({ where: { id: "singleton" }, data: { instanceId: crypto.randomUUID() } });
    const tampered = await verifyInstanceIdentity();
    record("TAMPER_DETECTED", !tampered.valid && tampered.reason === "TAMPERED", `Verification result: ${tampered.reason}.`);
  } finally {
    await prisma.auditLog.deleteMany({ where: { action: "INSTANCE_IDENTITY_CREATED" } });
    await prisma.instanceIdentity.deleteMany();
    if (original) await prisma.instanceIdentity.create({ data: original });
  }
  const status = checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL";
  console.log(JSON.stringify({ runId: `W02-WP3-${new Date().toISOString()}`, status, checks }));
  await prisma.$disconnect();
  process.exit(status === "PASS" ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
