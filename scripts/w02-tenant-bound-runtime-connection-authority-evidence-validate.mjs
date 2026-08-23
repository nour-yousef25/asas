import { readFileSync } from "node:fs";

const mandatoryIds = ["A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10", "A11", "A12", "A13", "A14", "A15"];
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
const failures = { status: payload.status !== "PASS_TENANT_BOUND_RUNTIME_CONNECTION_AUTHORITY", missingIds, duplicateIds, invalidIds, failedRows, hardFailures: payload.hardFailures ?? [], cleanup, credentialPersistence: payload.credentialsPersisted !== false, productionTouch: payload.productionResourcesTouched !== false, globalPrismaFallback: payload.globalPrismaFallback !== false, rawGucUsed: payload.rawGucUsed !== false };
const failed = failures.status || missingIds.length || duplicateIds.length || invalidIds.length || failedRows.length || failures.hardFailures.length || cleanup || failures.credentialPersistence || failures.productionTouch || failures.globalPrismaFallback || failures.rawGucUsed;
process.stdout.write(`${JSON.stringify({ status: failed ? "FAIL_TENANT_BOUND_RUNTIME_CONNECTION_AUTHORITY_EVIDENCE" : "PASS_TENANT_BOUND_RUNTIME_CONNECTION_AUTHORITY_EVIDENCE", mandatoryIds, executedIds, failures }, null, 2)}\n`);
process.exitCode = failed ? 2 : 0;
