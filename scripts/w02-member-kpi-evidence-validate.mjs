import { readFileSync } from "node:fs";
const file = process.argv[2];
if (!file) throw new Error("EVIDENCE_FILE_REQUIRED");
const payload = JSON.parse(readFileSync(file, "utf8"));
const expected = ["MK01","MK02","MK03","MK04","MK05","MK06","MK07","MK08","MK09","MK10"];
const ids = (payload.evidence ?? []).map((item) => item.id);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
const missingIds = expected.filter((id) => !ids.includes(id));
const invalidIds = ids.filter((id) => !expected.includes(id));
const failedIds = (payload.evidence ?? []).filter((item) => item.result !== "PASS").map((item) => item.id);
const failures = [
  ...(payload.status !== "PASS_MEMBER_KPI_RUNTIME" ? ["STATUS"] : []),
  ...(missingIds.length ? ["MISSING"] : []), ...(duplicateIds.length ? ["DUPLICATE"] : []), ...(invalidIds.length ? ["INVALID"] : []), ...(failedIds.length ? ["FAILED"] : []),
  ...(!payload.cleanup?.ok ? ["CLEANUP"] : []), ...(payload.hygiene?.status !== "PASS_AUDIT_ARTIFACT_HYGIENE_SCAN" ? ["HYGIENE"] : []),
  ...(payload.credentialsPersisted || payload.productionResourcesTouched || payload.rawGucIdentityUsed || payload.globalPrismaFallback || payload.ownerOrBypassUsedForTenantEvidence ? ["SECURITY"] : []),
];
const result = { status: failures.length ? "FAIL_MEMBER_KPI_EVIDENCE_VALIDATION" : "PASS_MEMBER_KPI_EVIDENCE_VALIDATION", expected, executedIds: ids, missingIds, duplicateIds, invalidIds, failedIds, failures };
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = failures.length ? 2 : 0;
