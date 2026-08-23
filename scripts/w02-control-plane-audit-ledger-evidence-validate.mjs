import { readFileSync } from "node:fs";

const ids = ["CP01", "CP02", "CP03", "CP04", "CP05", "CP06", "CP07", "CP08", "CP09", "CP10", "CP11", "CP12"];
const file = process.argv[2];
if (!file) throw new Error("EVIDENCE_PATH_REQUIRED");
const payload = JSON.parse(readFileSync(file, "utf8"));
const rows = Array.isArray(payload.evidence) ? payload.evidence : [];
const executed = rows.map((row) => row.id);
const duplicate = [...new Set(executed.filter((id, index) => executed.indexOf(id) !== index))];
const missing = ids.filter((id) => !executed.includes(id));
const unknown = executed.filter((id) => !ids.includes(id));
const failedRows = rows.filter((row) => row.result !== "PASS" || row.actual !== true || row.cleanupStatus !== "PASS").map((row) => row.id);
const failures = { status: payload.status !== "PASS_CONTROL_PLANE_LEDGER", mandatoryIdsMismatch: JSON.stringify(payload.mandatoryIds) !== JSON.stringify(ids), missing, duplicate, unknown, failedRows, hardFailures: payload.hardFailures ?? [], cleanup: !payload.cleanup?.ok, hygiene: payload.hygiene?.status !== "PASS_AUDIT_ARTIFACT_HYGIENE_SCAN", credentialsPersisted: payload.credentialsPersisted !== false, productionTouched: payload.productionResourcesTouched !== false, rawGuc: payload.rawGucIdentityUsed !== false, globalCredential: payload.globalTenantCredentialUsed !== false, bypass: payload.ownerOrBypassUsedForTenantEvidence !== false };
const fail = failures.status || failures.mandatoryIdsMismatch || missing.length || duplicate.length || unknown.length || failedRows.length || failures.hardFailures.length || failures.cleanup || failures.hygiene || failures.credentialsPersisted || failures.productionTouched || failures.rawGuc || failures.globalCredential || failures.bypass;
process.stdout.write(`${JSON.stringify({ status: fail ? "FAIL_CONTROL_PLANE_LEDGER_EVIDENCE" : "PASS_CONTROL_PLANE_LEDGER_EVIDENCE", mandatoryIds: ids, executedIds: executed, failures }, null, 2)}\n`);
process.exitCode = fail ? 2 : 0;
