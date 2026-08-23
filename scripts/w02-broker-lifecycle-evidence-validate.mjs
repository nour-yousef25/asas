import { readFileSync } from "node:fs";

const evidencePath = process.argv[2];
if (!evidencePath) throw new Error("Evidence path required");
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
const mandatoryIds = Array.from({ length: 10 }, (_, index) => `L${String(index + 1).padStart(2, "0")}`);
const rows = Array.isArray(evidence.evidence) ? evidence.evidence : [];
const ids = rows.map((row) => row?.id);
const count = (id) => ids.filter((value) => value === id).length;
const missingIds = mandatoryIds.filter((id) => count(id) === 0);
const duplicateIds = mandatoryIds.filter((id) => count(id) > 1);
const invalidIds = ids.filter((id) => !mandatoryIds.includes(id));
const failedRows = rows.filter((row) => row?.result !== "PASS" || row?.cleanupStatus !== "PASS").map((row) => row?.id ?? "UNKNOWN");
const failures = {
  status: evidence.status !== "PASS_BROKER_LIFECYCLE_RUNTIME_PROOF",
  missingIds,
  duplicateIds,
  invalidIds,
  failedRows,
  hardFailures: Array.isArray(evidence.hardFailures) ? evidence.hardFailures : ["HARD_FAILURES_MISSING"],
  cleanup: evidence.cleanup?.ok !== true || evidence.cleanup?.residueCount !== 0,
  credentialPersistence: evidence.credentialsPersisted !== false,
  productionTouch: evidence.productionResourcesTouched !== false,
};
const blocked = failures.status || failures.missingIds.length || failures.duplicateIds.length || failures.invalidIds.length || failures.failedRows.length || failures.hardFailures.length || failures.cleanup || failures.credentialPersistence || failures.productionTouch;
process.stdout.write(`${JSON.stringify({ status: blocked ? "BLOCKED" : "PASS_BROKER_LIFECYCLE_EVIDENCE", mandatoryIds, executedIds: ids, failures }, null, 2)}\n`);
process.exitCode = blocked ? 2 : 0;
