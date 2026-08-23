import { readFileSync } from "node:fs";

const evidencePath = process.argv[2];
if (!evidencePath) throw new Error("Evidence path required");
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
const mandatoryIds = ["O01", "O02", "O03", "O04", "O05", "O06"];
const rows = Array.isArray(evidence.evidence) ? evidence.evidence : [];
const ids = rows.map((row) => row?.id);
const count = (id) => ids.filter((value) => value === id).length;
const failures = {
  status: evidence.status !== "PASS_BENEFICIARY_OWNERSHIP_RUNTIME_PROOF",
  missingIds: mandatoryIds.filter((id) => count(id) === 0),
  duplicateIds: mandatoryIds.filter((id) => count(id) > 1),
  invalidIds: ids.filter((id) => !mandatoryIds.includes(id)),
  failedRows: rows.filter((row) => row?.result !== "PASS" || row?.cleanupStatus !== "PASS").map((row) => row?.id ?? "UNKNOWN"),
  hardFailures: Array.isArray(evidence.hardFailures) ? evidence.hardFailures : ["HARD_FAILURES_MISSING"],
  cleanup: evidence.cleanup?.ok !== true || evidence.cleanup?.residueCount !== 0,
  credentialPersistence: evidence.credentialsPersisted !== false,
  productionTouch: evidence.productionResourcesTouched !== false,
};
const blocked = failures.status || failures.missingIds.length || failures.duplicateIds.length || failures.invalidIds.length || failures.failedRows.length || failures.hardFailures.length || failures.cleanup || failures.credentialPersistence || failures.productionTouch;
process.stdout.write(`${JSON.stringify({ status: blocked ? "BLOCKED" : "PASS_BENEFICIARY_OWNERSHIP_EVIDENCE", mandatoryIds, executedIds: ids, failures }, null, 2)}\n`);
process.exitCode = blocked ? 2 : 0;
