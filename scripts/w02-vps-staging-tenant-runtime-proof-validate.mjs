import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) throw new Error("VPS_STAGING_EVIDENCE_PATH_REQUIRED");
const payload = JSON.parse(readFileSync(path, "utf8"));
const required = Array.from({ length: 12 }, (_, index) => `VPS${String(index + 1).padStart(2, "0")}`);
const observed = new Map((payload.evidence ?? []).map((entry) => [entry.id, entry.result]));
const failures = required.filter((id) => observed.get(id) !== "PASS");
const valid = payload.status === "PASS_VPS_STAGING_TENANT_RUNTIME"
  && failures.length === 0
  && payload.credentialsPersistedInEvidence === false
  && payload.productionResourcesTouched === false
  && payload.rawGucIdentityUsed === false
  && payload.globalDataPlaneCredentialUsed === false
  && payload.ownerOrBypassUsedForTenantEvidence === false;
process.stdout.write(`${JSON.stringify({ status: valid ? "PASS_VPS_STAGING_TENANT_RUNTIME_EVIDENCE" : "FAIL_VPS_STAGING_TENANT_RUNTIME_EVIDENCE", checked: required.length, failures })}\n`);
process.exitCode = valid ? 0 : 2;
