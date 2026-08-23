import { readFileSync } from "node:fs";

const mandatoryIds = ["BE01", "BE02", "BE03", "BE04", "BE05", "BE06", "BE07", "BE08", "BE09", "BE10"];
const file = process.argv[2];
if (!file) throw new Error("EVIDENCE_PATH_REQUIRED");
const payload = JSON.parse(readFileSync(file, "utf8"));
const rows = Array.isArray(payload.evidence) ? payload.evidence : [];
const executedIds = rows.map((row) => row.id);
const duplicateIds = [...new Set(executedIds.filter((id, index) => executedIds.indexOf(id) !== index))];
const missingIds = mandatoryIds.filter((id) => !executedIds.includes(id));
const invalidIds = executedIds.filter((id) => !mandatoryIds.includes(id));
const failedRows = rows.filter((row) => row.result !== "PASS").map((row) => row.id);
const cleanup = !payload.cleanup?.ok || rows.some((row) => row.cleanupStatus !== "PASS");
const failures = { status: payload.status !== "PASS_BUDGET_EXPENSE_RUNTIME", mandatoryIdsMismatch: JSON.stringify(payload.mandatoryIds) !== JSON.stringify(mandatoryIds), missingIds, duplicateIds, invalidIds, failedRows, hardFailures: payload.hardFailures ?? [], cleanup, hygiene: payload.hygiene?.status !== "PASS_AUDIT_ARTIFACT_HYGIENE_SCAN", credentialPersistence: payload.credentialsPersisted !== false, productionTouch: payload.productionResourcesTouched !== false, rawGucIdentityUsed: payload.rawGucIdentityUsed !== false, globalPrismaFallback: payload.globalPrismaFallback !== false, ownerOrBypassUsedForTenantEvidence: payload.ownerOrBypassUsedForTenantEvidence !== false };
const failed = failures.status || failures.mandatoryIdsMismatch || missingIds.length || duplicateIds.length || invalidIds.length || failedRows.length || failures.hardFailures.length || cleanup || failures.hygiene || failures.credentialPersistence || failures.productionTouch || failures.rawGucIdentityUsed || failures.globalPrismaFallback || failures.ownerOrBypassUsedForTenantEvidence;
process.stdout.write(`${JSON.stringify({ status: failed ? "FAIL_BUDGET_EXPENSE_EVIDENCE" : "PASS_BUDGET_EXPENSE_EVIDENCE", mandatoryIds, executedIds, failures }, null, 2)}\n`);
process.exitCode = failed ? 2 : 0;
