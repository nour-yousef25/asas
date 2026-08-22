import { prisma } from "@/lib/db";
import { runLegacyTenantBackfill } from "@/lib/tenant-backfill";

async function main() {
  const suffix = Date.now().toString(36);
  const org = await prisma.organization.create({ data: { name: `W02 Backfill ${suffix}` } });
  const beneficiary = await prisma.beneficiary.create({ data: { name: `W02 Beneficiary ${suffix}`, phone: `05${Date.now().toString().slice(-8)}` } });
  const checks: Array<{ name: string; status: "PASS" | "FAIL"; detail: string }> = [];
  const record = (name: string, ok: boolean, detail: string) => checks.push({ name, status: ok ? "PASS" : "FAIL", detail });
  try {
    const dry = await runLegacyTenantBackfill({ organizationId: org.id, apply: false });
    record("DRY_RUN_DETECTS_UNASSIGNED", dry.rows.some((row) => row.table === "beneficiaries" && row.unassigned >= 1), JSON.stringify(dry.rows.find((row) => row.table === "beneficiaries")));
    const applied = await runLegacyTenantBackfill({ organizationId: org.id, apply: true });
    record("EXPLICIT_MAPPING_APPLIED", applied.rows.some((row) => row.table === "beneficiaries" && row.updated >= 1), JSON.stringify(applied.rows.find((row) => row.table === "beneficiaries")));
    const mapped = await prisma.beneficiary.findUnique({ where: { id: beneficiary.id } });
    record("NO_NULL_AFTER_APPLY", mapped?.organizationId === org.id, `organizationId=${mapped?.organizationId}`);
    const repeated = await runLegacyTenantBackfill({ organizationId: org.id, apply: true });
    record("IDEMPOTENT_REAPPLY", repeated.rows.every((row) => row.updated === 0), "Second apply updated zero rows.");
    try {
      await runLegacyTenantBackfill({ organizationId: "cmxxxxxxxxxxxxxxxxxxxxxxxxx", apply: true });
      record("UNKNOWN_MAPPING_REJECTED", false, "Unknown organization was accepted.");
    } catch {
      record("UNKNOWN_MAPPING_REJECTED", true, "Unknown organization was rejected.");
    }
  } finally {
    await prisma.auditLog.deleteMany({ where: { action: "LEGACY_TENANT_BACKFILL_APPLIED", organizationId: org.id } });
    await prisma.beneficiary.delete({ where: { id: beneficiary.id } });
    await prisma.organization.delete({ where: { id: org.id } });
  }
  const status = checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL";
  console.log(JSON.stringify({ runId: `W02-WP4-${new Date().toISOString()}`, status, checks }));
  await prisma.$disconnect();
  process.exit(status === "PASS" ? 0 : 1);
}

main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
