import { prisma } from "@/lib/db";
import { analyzeLegacyTenantBackfill, applyLegacyTenantBackfill, LegacyTenantBackfillError, type LegacyTenantMapping } from "@/lib/tenant-backfill";

async function main() {
  const suffix = Date.now().toString(36);
  const orgA = await prisma.organization.create({ data: { name: `W02 A ${suffix}` } });
  const orgB = await prisma.organization.create({ data: { name: `W02 B ${suffix}` } });
  const beneficiaryA = await prisma.beneficiary.create({ data: { name: `W02 A ${suffix}`, phone: `51${suffix.slice(-8)}` } });
  const beneficiaryB = await prisma.beneficiary.create({ data: { name: `W02 B ${suffix}`, phone: `52${suffix.slice(-8)}` } });
  const checks: Array<{ name: string; status: "PASS" | "FAIL"; detail: string }> = [];
  const record = (name: string, ok: boolean, detail: string) => checks.push({ name, status: ok ? "PASS" : "FAIL", detail });
  try {
    const mapping: LegacyTenantMapping[] = [{ table: "beneficiaries", recordId: beneficiaryA.id, organizationId: orgA.id, source: "AUDIT_FIXTURE" }, { table: "beneficiaries", recordId: beneficiaryB.id, organizationId: orgB.id, source: "AUDIT_FIXTURE" }];
    const analyzed = await analyzeLegacyTenantBackfill(mapping);
    record("TWO_ORG_ANALYZE", analyzed.counters.unmapped === 0 && analyzed.counters.ambiguous === 0, JSON.stringify(analyzed.counters));
    const applied = await applyLegacyTenantBackfill(mapping);
    const [mappedA, mappedB] = await Promise.all([prisma.beneficiary.findUnique({ where: { id: beneficiaryA.id } }), prisma.beneficiary.findUnique({ where: { id: beneficiaryB.id } })]);
    record("EXPLICIT_A_B_APPLY", applied.counters.updated === 2 && mappedA?.organizationId === orgA.id && mappedB?.organizationId === orgB.id, JSON.stringify(applied.counters));
    record("B_NEVER_ASSIGNED_TO_A", mappedB?.organizationId === orgB.id, `B=${mappedB?.organizationId};A=${orgA.id}`);
    const unmapped = await prisma.beneficiary.create({ data: { name: `W02 U ${suffix}`, phone: `53${suffix.slice(-8)}` } });
    try {
      await applyLegacyTenantBackfill(mapping);
      record("UNMAPPED_NO_WRITE", false, "Apply was accepted with an unmapped record.");
    } catch (error) {
      const saved = await prisma.beneficiary.findUnique({ where: { id: unmapped.id } });
      record("UNMAPPED_NO_WRITE", error instanceof LegacyTenantBackfillError && saved?.organizationId === null, `${error instanceof LegacyTenantBackfillError};owner=${saved?.organizationId}`);
    }
    try {
      await applyLegacyTenantBackfill([...mapping, { table: "beneficiaries", recordId: unmapped.id, organizationId: orgA.id, source: "ONE" }, { table: "beneficiaries", recordId: unmapped.id, organizationId: orgB.id, source: "TWO" }]);
      record("AMBIGUOUS_NO_WRITE", false, "Ambiguous mapping was accepted.");
    } catch (error) {
      const saved = await prisma.beneficiary.findUnique({ where: { id: unmapped.id } });
      record("AMBIGUOUS_NO_WRITE", error instanceof LegacyTenantBackfillError && saved?.organizationId === null, `${error instanceof LegacyTenantBackfillError};owner=${saved?.organizationId}`);
    }
    try {
      await applyLegacyTenantBackfill([...mapping, { table: "beneficiaries", recordId: unmapped.id, organizationId: "cmxxxxxxxxxxxxxxxxxxxxxxxxx", source: "INVALID" }]);
      record("INVALID_REFERENCE_NO_WRITE", false, "Invalid organization reference was accepted.");
    } catch (error) {
      const saved = await prisma.beneficiary.findUnique({ where: { id: unmapped.id } });
      record("INVALID_REFERENCE_NO_WRITE", error instanceof LegacyTenantBackfillError && saved?.organizationId === null, `${error instanceof LegacyTenantBackfillError};owner=${saved?.organizationId}`);
    }
    try {
      await applyLegacyTenantBackfill([{ table: "beneficiaries", recordId: beneficiaryA.id, organizationId: orgB.id, source: "CONFLICT" }, { table: "beneficiaries", recordId: beneficiaryB.id, organizationId: orgB.id, source: "OK" }, { table: "beneficiaries", recordId: unmapped.id, organizationId: orgA.id, source: "OK" }]);
      record("CONFLICT_NO_WRITE", false, "Conflicting mapping was accepted.");
    } catch (error) {
      const saved = await prisma.beneficiary.findUnique({ where: { id: unmapped.id } });
      record("CONFLICT_NO_WRITE", error instanceof LegacyTenantBackfillError && saved?.organizationId === null, `${error instanceof LegacyTenantBackfillError};owner=${saved?.organizationId}`);
    }
    await prisma.beneficiary.delete({ where: { id: unmapped.id } });
    const graphDonor = await prisma.donor.create({ data: { name: `Graph Donor ${suffix}` } });
    const graphCampaign = await prisma.donationCampaign.create({ data: { title: `Graph Campaign ${suffix}`, targetAmount: 10, startDate: new Date() } });
    const graphProject = await prisma.project.create({ data: { title: `Graph Project ${suffix}`, targetAmount: 10, startDate: new Date() } });
    const graphDonation = await prisma.donation.create({ data: { amount: 1, donorId: graphDonor.id, campaignId: graphCampaign.id, projectId: graphProject.id } });
    try {
      const graphApply = await applyLegacyTenantBackfill([...mapping, { table: "donors", recordId: graphDonor.id, organizationId: orgA.id, source: "GRAPH" }, { table: "donation_campaigns", recordId: graphCampaign.id, organizationId: orgA.id, source: "GRAPH" }, { table: "projects", recordId: graphProject.id, organizationId: orgA.id, source: "GRAPH" }, { table: "donations", recordId: graphDonation.id, organizationId: orgA.id, source: "GRAPH" }]);
      const saved = await prisma.donation.findUnique({ where: { id: graphDonation.id } });
      record("HISTORICAL_NULL_GRAPH_APPLY", graphApply.counters.updated === 4 && saved?.organizationId === orgA.id, `updated=${graphApply.counters.updated};owner=${saved?.organizationId}`);
    } catch (error) {
      record("HISTORICAL_NULL_GRAPH_APPLY", false, String(error));
    }
    await prisma.donation.delete({ where: { id: graphDonation.id } }); await prisma.project.delete({ where: { id: graphProject.id } }); await prisma.donationCampaign.delete({ where: { id: graphCampaign.id } }); await prisma.donor.delete({ where: { id: graphDonor.id } });
    const missingMappingDonor = await prisma.donor.create({ data: { name: `Missing Map Donor ${suffix}` } });
    const missingMappingDonation = await prisma.donation.create({ data: { amount: 1, donorId: missingMappingDonor.id } });
    try {
      await applyLegacyTenantBackfill([...mapping, { table: "donations", recordId: missingMappingDonation.id, organizationId: orgA.id, source: "GRAPH" }]);
      record("MISSING_PARENT_MAPPING_NO_WRITE", false, "Donation with missing parent mapping was accepted.");
    } catch (error) {
      const saved = await prisma.donation.findUnique({ where: { id: missingMappingDonation.id } });
      record("MISSING_PARENT_MAPPING_NO_WRITE", error instanceof LegacyTenantBackfillError && error.code === "UNMAPPED_RECORD" && saved?.organizationId === null, `${error instanceof LegacyTenantBackfillError ? error.code : String(error)};owner=${saved?.organizationId}`);
    }
    await prisma.donation.delete({ where: { id: missingMappingDonation.id } }); await prisma.donor.delete({ where: { id: missingMappingDonor.id } });
    const donorA = await prisma.donor.create({ data: { name: `Donor A ${suffix}`, organizationId: orgA.id } });
    const campaignB = await prisma.donationCampaign.create({ data: { title: `Campaign B ${suffix}`, targetAmount: 10, startDate: new Date(), organizationId: orgB.id } });
    const conflictDonation = await prisma.donation.create({ data: { amount: 1, donorId: donorA.id, campaignId: campaignB.id } });
    try {
      await applyLegacyTenantBackfill([...mapping, { table: "donors", recordId: donorA.id, organizationId: orgA.id, source: "FIXTURE" }, { table: "donation_campaigns", recordId: campaignB.id, organizationId: orgB.id, source: "FIXTURE" }, { table: "donations", recordId: conflictDonation.id, organizationId: orgA.id, source: "FIXTURE" }]);
      record("CONFLICTING_PARENTS_NO_WRITE", false, "Donation with A/B parents was accepted.");
    } catch (error) {
      const saved = await prisma.donation.findUnique({ where: { id: conflictDonation.id } });
      record("CONFLICTING_PARENTS_NO_WRITE", error instanceof LegacyTenantBackfillError && error.code === "CONFLICTING_PARENT_ORGANIZATION" && saved?.organizationId === null, `${error instanceof LegacyTenantBackfillError ? error.code : String(error)};owner=${saved?.organizationId}`);
    }
    await prisma.donation.delete({ where: { id: conflictDonation.id } }); await prisma.donationCampaign.delete({ where: { id: campaignB.id } }); await prisma.donor.delete({ where: { id: donorA.id } });
    const rollbackA = await prisma.beneficiary.create({ data: { name: `Rollback A ${suffix}`, phone: `54${suffix.slice(-8)}` } });
    const rollbackB = await prisma.beneficiary.create({ data: { name: `Rollback B ${suffix}`, phone: `55${suffix.slice(-8)}` } });
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION w02_backfill_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."id" = '${rollbackB.id}' THEN RAISE EXCEPTION 'audit forced apply failure'; END IF; RETURN NEW; END; $$`);
    await prisma.$executeRawUnsafe('CREATE TRIGGER w02_backfill_fail_trigger BEFORE UPDATE OF "organizationId" ON "beneficiaries" FOR EACH ROW EXECUTE FUNCTION w02_backfill_fail()');
    try {
      await applyLegacyTenantBackfill([...mapping, { table: "beneficiaries", recordId: rollbackA.id, organizationId: orgA.id, source: "ROLLBACK" }, { table: "beneficiaries", recordId: rollbackB.id, organizationId: orgB.id, source: "ROLLBACK" }]);
      record("TRANSACTION_ROLLBACK_ON_APPLY_FAILURE", false, "Forced database failure was accepted.");
    } catch {
      const [savedA, savedB] = await Promise.all([prisma.beneficiary.findUnique({ where: { id: rollbackA.id } }), prisma.beneficiary.findUnique({ where: { id: rollbackB.id } })]);
      record("TRANSACTION_ROLLBACK_ON_APPLY_FAILURE", savedA?.organizationId === null && savedB?.organizationId === null, `A=${savedA?.organizationId};B=${savedB?.organizationId}`);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS w02_backfill_fail_trigger ON "beneficiaries"');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS w02_backfill_fail()');
      await prisma.beneficiary.deleteMany({ where: { id: { in: [rollbackA.id, rollbackB.id] } } });
    }
  } finally {
    await prisma.auditLog.deleteMany({ where: { action: "LEGACY_TENANT_BACKFILL_APPLIED" } });
    await prisma.beneficiary.deleteMany({ where: { id: { in: [beneficiaryA.id, beneficiaryB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  }
  const status = checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL";
  console.log(JSON.stringify({ runId: `W02-WP4-${new Date().toISOString()}`, status, checks }));
  await prisma.$disconnect();
  process.exit(status === "PASS" ? 0 : 1);
}

main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
