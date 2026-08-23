import { readFileSync } from "node:fs";

const mandatoryIds = ["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08", "R09", "R10", "R11", "R12", "R13", "R14", "R15"];
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
const failures = { status: payload.status !== "PASS_RLS_WAVE1_BENEFICIARY_RUNTIME", missingIds, duplicateIds, invalidIds, failedRows, hardFailures: payload.hardFailures ?? [], cleanup, credentialPersistence: payload.credentialsPersisted !== false, productionTouch: payload.productionResourcesTouched !== false, rawGucIdentityUsed: payload.rawGucIdentityUsed !== false, globalPrismaFallback: payload.globalPrismaFallback !== false, ownerOrBypassUsedForTenantEvidence: payload.ownerOrBypassUsedForTenantEvidence !== false };
const failed = failures.status || missingIds.length || duplicateIds.length || invalidIds.length || failedRows.length || failures.hardFailures.length || cleanup || failures.credentialPersistence || failures.productionTouch || failures.rawGucIdentityUsed || failures.globalPrismaFallback || failures.ownerOrBypassUsedForTenantEvidence;
process.stdout.write(`${JSON.stringify({ status: failed ? "FAIL_RLS_WAVE1_BENEFICIARY_EVIDENCE" : "PASS_RLS_WAVE1_BENEFICIARY_EVIDENCE", mandatoryIds, executedIds, failures }, null, 2)}\n`);
process.exitCode = failed ? 2 : 0;
